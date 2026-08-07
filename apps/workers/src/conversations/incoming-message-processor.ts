import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";

interface IncomingMessageJob {
  instanceId: string;
  fromNumber: string;
  contactName?: string;
  text?: string;
  providerMessageId?: string;
  receivedAt: string | Date;
}

/**
 * Consome a fila `incoming-messages` publicada pelo Baileys (e futuramente
 * pela Meta/Evolution) e persiste Contact → Conversation → Message no banco.
 *
 * Usa `tenantStorage.run({ isPlatform: true })` para contornar o isolamento
 * de tenant na camada de aplicação — o worker é um processo interno de
 * confiança, não uma request de usuário. Em produção, a conta de DB do worker
 * deve ser diferente da da API e ter BYPASSRLS no Postgres.
 */
export function startIncomingMessageProcessor() {
  const worker = new Worker<IncomingMessageJob>(
    QUEUE_NAMES.INCOMING_MESSAGES,
    async (job: Job<IncomingMessageJob>) => {
      const { instanceId, fromNumber, contactName, text, providerMessageId } = job.data;

      if (!fromNumber) {
        console.warn(`[incoming-processor] Job ${job.id}: fromNumber ausente, ignorando.`);
        return;
      }

      await tenantStorage.run({ isPlatform: true }, async () => {
        // 1. Descobre o tenant da instância (bypass de RLS pelo isPlatform)
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { id: instanceId },
          select: { id: true, companyId: true, defaultDepartmentId: true },
        });

        if (!instance) {
          console.warn(`[incoming-processor] Instância ${instanceId} não encontrada.`);
          return;
        }

        const { companyId } = instance;

        // 2. Upsert de contato — telefone é a chave natural do cliente
        const contact = await prisma.contact.upsert({
          where: { companyId_phoneNumber: { companyId, phoneNumber: fromNumber } },
          create: {
            companyId,
            phoneNumber: fromNumber,
            name: contactName || fromNumber,
          },
          update: contactName ? { name: contactName } : {},
        });

        // 3. Reutiliza conversa OPEN existente ou abre nova
        let conversation = await prisma.conversation.findFirst({
          where: { companyId, contactId: contact.id, instanceId, status: "OPEN" },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              companyId,
              contactId: contact.id,
              instanceId,
              departmentId: instance.defaultDepartmentId ?? undefined,
              lastMessageAt: new Date(),
            },
          });
        }

        // 4. Persiste a mensagem
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "INBOUND",
            type: text ? "TEXT" : "SYSTEM",
            content: text,
            providerMessageId,
          },
        });

        // 5. Atualiza timestamp da última mensagem na conversa
        await prisma.conversation.updateMany({
          where: { id: conversation.id, companyId },
          data: { lastMessageAt: new Date() },
        });
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 20 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[incoming-processor] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
