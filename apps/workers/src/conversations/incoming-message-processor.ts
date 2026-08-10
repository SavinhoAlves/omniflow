import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";
import { sessionManager } from "../whatsapp/session-manager";
import { runBotFlow } from "../workflows/workflow-engine";

interface IncomingMessageJob {
  instanceId: string;
  fromNumber: string;
  contactName?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts";
  providerMessageId?: string;
  receivedAt: string | Date;
}

/**
 * Consome a fila `incoming-messages` publicada pelo Baileys (e futuramente
 * pela Meta/Evolution) e persiste Contact → Conversation → Message no banco.
 * Se o workflow da empresa estiver habilitado, executa o bot antes de entregar
 * a mensagem para um atendente.
 */
export function startIncomingMessageProcessor() {
  const worker = new Worker<IncomingMessageJob>(
    QUEUE_NAMES.INCOMING_MESSAGES,
    async (job: Job<IncomingMessageJob>) => {
      const { instanceId, fromNumber, contactName, text, mediaUrl, mediaType, providerMessageId } = job.data;

      if (!fromNumber) {
        console.warn(`[incoming-processor] Job ${job.id}: fromNumber ausente, ignorando.`);
        return;
      }

      await tenantStorage.run({ isPlatform: true }, async () => {
        // 1. Descobre o tenant da instância
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { id: instanceId },
          select: { id: true, companyId: true, defaultDepartmentId: true },
        });

        if (!instance) {
          console.warn(`[incoming-processor] Instância ${instanceId} não encontrada no banco.`);
          return;
        }

        const { companyId } = instance;

        // 2. Upsert de contato
        const contact = await prisma.contact.upsert({
          where: { companyId_phoneNumber: { companyId, phoneNumber: fromNumber } },
          create: { companyId, phoneNumber: fromNumber, name: contactName || fromNumber },
          update: contactName ? { name: contactName } : {},
        });

        // 3. Reutiliza conversa OPEN existente ou abre nova
        let isNewConversation = false;
        let conversation = await prisma.conversation.findFirst({
          where: { companyId, contactId: contact.id, instanceId, status: "OPEN" },
          select: { id: true, botNodeId: true, departmentId: true },
        });

        if (!conversation) {
          isNewConversation = true;
          conversation = await prisma.conversation.create({
            data: {
              companyId,
              contactId: contact.id,
              instanceId,
              departmentId: instance.defaultDepartmentId ?? undefined,
              lastMessageAt: new Date(),
            },
            select: { id: true, botNodeId: true, departmentId: true },
          });
        }

        // 4. Deduplicação: ignora mensagem já processada
        if (providerMessageId) {
          const existing = await prisma.message.findFirst({
            where: { providerMessageId },
            select: { id: true },
          });
          if (existing) {
            console.log(`[incoming-processor] Mensagem ${providerMessageId} já existe, ignorando.`);
            return;
          }
        }

        // 5. Persiste a mensagem inbound
        const msgType = text ? "TEXT"
          : mediaType === "image" ? "IMAGE"
          : mediaType === "video" ? "VIDEO"
          : mediaType === "audio" ? "AUDIO"
          : mediaType === "document" ? "DOCUMENT"
          : "SYSTEM";

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "INBOUND",
            type: msgType as any,
            content: text,
            mediaUrl: mediaUrl ?? undefined,
            providerMessageId,
          },
        });

        // 6. Atualiza timestamp
        await prisma.conversation.updateMany({
          where: { id: conversation.id, companyId },
          data: { lastMessageAt: new Date() },
        });

        console.log(`[incoming-processor] Mensagem de ${fromNumber} → conv ${conversation.id.slice(0, 8)} (nova=${isNewConversation})`);

        // 7. Executa o bot se o workflow da empresa estiver habilitado
        const workflow = await prisma.workflow.findFirst({
          where: { companyId, enabled: true },
          select: { flowNodes: true, flowEdges: true },
        });

        if (!workflow) {
          console.log(`[incoming-processor] Nenhum workflow ativo para empresa ${companyId.slice(0, 8)} — bot não executado.`);
        }

        const shouldRunBot =
          workflow?.flowNodes != null &&
          (isNewConversation || conversation.botNodeId != null);

        if (shouldRunBot) {
          const startNodeId = conversation.botNodeId ?? "start";
          // Usa o texto do usuário como seleção de menu apenas quando
          // o bot estava pausado num nó de menu (conversa existente)
          const userTextForBot = conversation.botNodeId != null ? text : undefined;

          const result = runBotFlow({
            flowNodes: workflow!.flowNodes as any[],
            flowEdges: (workflow!.flowEdges ?? []) as any[],
            startNodeId,
            userText: userTextForBot,
          });

          // Envia as mensagens do bot e persiste cada uma
          for (const msgText of result.messages) {
            try {
              await sessionManager.sendText(instanceId, fromNumber, msgText);
              await prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  direction: "OUTBOUND",
                  type: "TEXT",
                  content: msgText,
                },
              });
            } catch (err: any) {
              console.error(`[bot] Falha ao enviar mensagem:`, err.message);
            }
          }

          // Atualiza o estado do bot na conversa
          const convUpdate: Record<string, any> = {
            botNodeId: result.nextBotNodeId,
          };
          if (result.departmentId) {
            convUpdate.departmentId = result.departmentId;
          }
          if (result.endConversation) {
            convUpdate.status = "RESOLVED";
            convUpdate.botNodeId = null;
          }

          await prisma.conversation.updateMany({
            where: { id: conversation.id, companyId },
            data: convUpdate,
          });

          console.log(
            `[bot] Conv ${conversation.id.slice(0, 8)}: ` +
            `enviados ${result.messages.length} msg(s), ` +
            `próximo nó=${result.nextBotNodeId ?? "fim"}`
          );
        }
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 20 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[incoming-processor] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
