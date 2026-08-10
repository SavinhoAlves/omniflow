import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";
import { sessionManager } from "../whatsapp/session-manager";
import { runBotFlow } from "../workflows/workflow-engine";

interface BeginConversationJob {
  conversationId: string;
}

/**
 * Processa o evento "Iniciar Atendimento" disparado pelo agente na UI.
 * Muda status LEAD → OPEN e executa o bot a partir do início.
 */
export function startBeginConversationProcessor() {
  const worker = new Worker<BeginConversationJob>(
    QUEUE_NAMES.BEGIN_CONVERSATION,
    async (job: Job<BeginConversationJob>) => {
      const { conversationId } = job.data;

      await tenantStorage.run({ isPlatform: true }, async () => {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId },
          select: {
            id: true,
            companyId: true,
            instanceId: true,
            status: true,
            contact: { select: { id: true, name: true, phoneNumber: true } },
          },
        });

        if (!conversation) {
          console.warn(`[begin-conv] Conversa ${conversationId} não encontrada.`);
          return;
        }

        if ((conversation.status as string) !== "LEAD") {
          console.log(`[begin-conv] Conversa ${conversationId.slice(0, 8)} não está em LEAD (${conversation.status}), ignorando.`);
          return;
        }

        // Muda para OPEN e inicia o bot a partir de "start"
        await prisma.conversation.updateMany({
          where: { id: conversationId },
          data: { status: "OPEN", botNodeId: null },
        });

        const workflow = await prisma.workflow.findFirst({
          where: { companyId: conversation.companyId, enabled: true },
          select: { flowNodes: true, flowEdges: true },
        });

        if (!workflow?.flowNodes) {
          console.log(`[begin-conv] Nenhum workflow ativo — conversa aberta sem bot.`);
          return;
        }

        const { contact, instanceId, companyId } = conversation;

        const result = runBotFlow({
          flowNodes: workflow.flowNodes as any[],
          flowEdges: (workflow.flowEdges ?? []) as any[],
          startNodeId: "start",
          variables: { nome: contact.name ?? contact.phoneNumber, telefone: contact.phoneNumber },
        });

        for (const botMsg of result.messages) {
          if (botMsg.isDelay) {
            await new Promise((r) => setTimeout(r, botMsg.delayMs));
            continue;
          }

          if (botMsg.delayMs > 0) {
            await new Promise((r) => setTimeout(r, botMsg.delayMs));
          }

          try {
            if (botMsg.isMenu && botMsg.menuOptions?.length) {
              await sessionManager.sendListMenu(instanceId, contact.phoneNumber, botMsg.text, botMsg.menuOptions);
            } else {
              await sessionManager.sendText(instanceId, contact.phoneNumber, botMsg.text);
            }

            await prisma.message.create({
              data: {
                conversationId,
                direction: "OUTBOUND",
                type: "TEXT",
                content: botMsg.text,
              },
            });
          } catch (err: any) {
            console.error(`[begin-conv] Falha ao enviar:`, err.message);
          }
        }

        const convUpdate: Record<string, any> = { botNodeId: result.nextBotNodeId };
        if (result.departmentId) convUpdate.departmentId = result.departmentId;
        if (result.endConversation) { convUpdate.status = "RESOLVED"; convUpdate.botNodeId = null; }

        await prisma.conversation.updateMany({
          where: { id: conversationId, companyId },
          data: convUpdate,
        });

        console.log(
          `[begin-conv] Conv ${conversationId.slice(0, 8)}: enviados ${result.messages.length} msg(s), próximo nó=${result.nextBotNodeId ?? "fim"}`
        );
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[begin-conv] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
