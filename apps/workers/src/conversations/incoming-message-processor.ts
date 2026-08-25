import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";
import { sessionManager } from "../whatsapp/session-manager";
import { runBotFlow } from "../workflows/workflow-engine";

const OPT_OUT_KEYWORDS = new Set(["SAIR", "PARAR", "STOP", "CANCELAR", "DESCADASTRAR"])
const OPT_IN_KEYWORDS  = new Set(["VOLTAR", "START", "ATIVAR", "INICIAR"])

function normalizeKeyword(text: string): string {
  return text.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

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

        // 2. Upsert de contato (inclui optOut)
        const contact = await prisma.contact.upsert({
          where: { companyId_phoneNumber: { companyId, phoneNumber: fromNumber } },
          create: { companyId, phoneNumber: fromNumber, name: contactName || fromNumber },
          update: contactName ? { name: contactName } : {},
          // select explícito para garantir que optOut seja retornado
          // (Prisma retorna todos os campos no upsert por padrão)
        });

        // ── Opt-out / Opt-in ──────────────────────────────────────────────────
        const keyword = normalizeKeyword(text ?? "")

        if (OPT_OUT_KEYWORDS.has(keyword)) {
          // T4.1: registra opt-out no audit log de consentimento
          await prisma.contact.update({ where: { id: contact.id }, data: { optOut: true } });
          await prisma.consentLog.create({
            data: { companyId, contactId: contact.id, event: "OPT_OUT", source: "whatsapp_keyword" },
          });
          let convId: string | null = null;
          const anyConv = await prisma.conversation.findFirst({
            where: { companyId, contactId: contact.id, instanceId, status: { in: ["OPEN", "LEAD"] as any } },
            select: { id: true },
          });
          convId = anyConv?.id ?? null;
          if (convId) {
            await sessionManager.sendText(instanceId, fromNumber,
              "Você foi descadastrado das mensagens automáticas. Para receber novamente, envie VOLTAR.");
            await prisma.message.create({
              data: { conversationId: convId, direction: "OUTBOUND", type: "SYSTEM",
                content: "Contato optou por não receber mensagens automáticas (SAIR)." },
            });
          }
          console.log(`[opt-out] ${fromNumber} optou por sair.`);
          return;
        }

        const contactOptOut = await prisma.contact.findUnique({
          where: { id: contact.id }, select: { optOut: true },
        });
        if (contactOptOut?.optOut) {
          if (OPT_IN_KEYWORDS.has(keyword)) {
            // T4.1: registra opt-in no audit log de consentimento
            await prisma.contact.update({
              where: { id: contact.id },
              data: { optOut: false, consentGivenAt: new Date(), consentSource: "whatsapp_keyword" },
            });
            await prisma.consentLog.create({
              data: { companyId, contactId: contact.id, event: "OPT_IN", source: "whatsapp_keyword" },
            });
            console.log(`[opt-in] ${fromNumber} voltou a receber mensagens.`);
            // continua o fluxo normalmente — bot vai executar
          } else {
            console.log(`[opt-out] ${fromNumber} está descadastrado — bot não executado.`);
            return;
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        // 3. Busca conversa OPEN existente (ignora LEAD — leads ficam em fila separada)
        let isNewConversation = false;
        let conversation = await prisma.conversation.findFirst({
          where: { companyId, contactId: contact.id, instanceId, status: "OPEN" },
          select: { id: true, botNodeId: true, departmentId: true },
        });

        if (!conversation) {
          // Verifica se já existe uma conversa LEAD (para não criar duplicata)
          const existingLead = await prisma.conversation.findFirst({
            where: { companyId, contactId: contact.id, instanceId, status: "LEAD" as any },
            select: { id: true, botNodeId: true, departmentId: true },
          });

          if (existingLead) {
            conversation = existingLead;
          } else {
            isNewConversation = true;
            conversation = await prisma.conversation.create({
              data: {
                companyId,
                contactId: contact.id,
                instanceId,
                departmentId: instance.defaultDepartmentId ?? undefined,
                status: "LEAD" as any,
                lastMessageAt: new Date(),
              },
              select: { id: true, botNodeId: true, departmentId: true },
            });
          }
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

        // 6. Atualiza timestamp, janela de 24h e contador de não lidos
        const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.$executeRaw`
          UPDATE conversations
          SET last_message_at = NOW(),
              window_expires_at = ${windowExpiresAt},
              unread_count = unread_count + 1,
              updated_at = NOW()
          WHERE id = ${conversation.id} AND company_id = ${companyId}
        `;

        // 7. Recarrega status atual da conversa (pode ter mudado para OPEN via "Iniciar Atendimento")
        const freshConv = await prisma.conversation.findFirst({
          where: { id: conversation.id },
          select: { status: true, botNodeId: true },
        });

        console.log(`[incoming-processor] Mensagem de ${fromNumber} → conv ${conversation.id.slice(0, 8)} (nova=${isNewConversation}, status=${freshConv?.status})`);

        // 8. Bot só roda em conversas OPEN (não em LEAD)
        if (freshConv?.status !== "OPEN") {
          console.log(`[incoming-processor] Conversa em status ${freshConv?.status} — bot não executado.`);
          return;
        }

        const workflow = await prisma.workflow.findFirst({
          where: { companyId, enabled: true },
          select: { flowNodes: true, flowEdges: true },
        });

        if (!workflow) {
          console.log(`[incoming-processor] Nenhum workflow ativo para empresa ${companyId.slice(0, 8)} — bot não executado.`);
          return;
        }

        const shouldRunBot =
          workflow.flowNodes != null &&
          (isNewConversation || freshConv?.botNodeId != null);

        if (!shouldRunBot) return;

        const startNodeId = freshConv?.botNodeId ?? "start";
        const userTextForBot = freshConv?.botNodeId != null ? text : undefined;

        const result = runBotFlow({
          flowNodes: workflow.flowNodes as any[],
          flowEdges: (workflow.flowEdges ?? []) as any[],
          startNodeId,
          userText: userTextForBot,
          variables: { nome: contact.name ?? fromNumber, telefone: fromNumber },
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
              await sessionManager.sendListMenu(instanceId, fromNumber, botMsg.text, botMsg.menuOptions);
            } else {
              await sessionManager.sendText(instanceId, fromNumber, botMsg.text);
            }

            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                type: "TEXT",
                content: botMsg.text,
              },
            });
          } catch (err: any) {
            console.error(`[bot] Falha ao enviar mensagem:`, err.message);
          }
        }

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
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 20 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[incoming-processor] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
