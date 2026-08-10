import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";

interface PhoneOutboundJob {
  instanceId: string;
  toNumber: string;
  text?: string;
  providerMessageId?: string;
  sentAt: string | Date;
}

export function startPhoneOutboundProcessor() {
  const worker = new Worker<PhoneOutboundJob>(
    QUEUE_NAMES.PHONE_OUTBOUND,
    async (job: Job<PhoneOutboundJob>) => {
      const { instanceId, toNumber, text, providerMessageId } = job.data;

      if (!toNumber || !text) return;

      await tenantStorage.run({ isPlatform: true }, async () => {
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { id: instanceId },
          select: { id: true, companyId: true },
        });
        if (!instance) return;

        const { companyId } = instance;

        // Evita duplicar mensagens que o próprio sistema já enviou (providerMessageId já existe)
        if (providerMessageId) {
          const already = await prisma.message.findFirst({
            where: { providerMessageId },
            select: { id: true },
          });
          if (already) return;
        }

        const contact = await prisma.contact.findFirst({
          where: { companyId, phoneNumber: toNumber },
          select: { id: true },
        });
        if (!contact) return; // contato desconhecido, sem conversa ativa no sistema

        // Procura conversa OPEN ou LEAD com esse contato nessa instância
        const conversation = await prisma.conversation.findFirst({
          where: {
            companyId,
            contactId: contact.id,
            instanceId,
            status: { in: ["OPEN", "LEAD"] },
          },
          select: { id: true },
          orderBy: { lastMessageAt: "desc" },
        });
        if (!conversation) return;

        await Promise.all([
          prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "OUTBOUND",
              type: "TEXT",
              content: text,
              providerMessageId: providerMessageId ?? undefined,
            },
          }),
          prisma.conversation.updateMany({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          }),
        ]);

        console.log(`[phone-outbound] Mensagem do celular registrada na conversa ${conversation.id.slice(0, 8)}`);
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[phone-outbound] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
