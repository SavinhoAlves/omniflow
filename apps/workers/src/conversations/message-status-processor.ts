import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";

interface MessageStatusJob {
  instanceId: string;
  providerMessageId: string; // wamid.xxx
  status: "sent" | "delivered" | "read" | "failed";
  recipientNumber: string;
  timestamp: string | Date;
  errorCode?: number;
  errorMessage?: string;
}

const STATUS_MAP: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/**
 * Consome a fila `message-status-updates` publicada pelo webhook Meta
 * e atualiza `Message.deliveryStatus` no banco.
 *
 * Usa bypass de RLS via isPlatform — processo interno de confiança.
 */
/**
 * Atualiza o destinatário de campanha e os contadores (entregues/lidas/falhas).
 * Só conta transições "para frente", então webhooks repetidos ou fora de
 * ordem (read antes de delivered) não inflam os números.
 */
async function updateCampaignRecipient(providerMessageId: string, status: MessageStatusJob["status"], errorCode?: number) {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { messageId: providerMessageId },
    select: { id: true, campaignId: true, status: true },
  });
  if (!recipient) return;

  const now = new Date();
  const wasDelivered = recipient.status === "DELIVERED" || recipient.status === "READ";

  if (status === "delivered" && recipient.status === "SENT") {
    await prisma.campaignRecipient.updateMany({ where: { id: recipient.id, status: "SENT" }, data: { status: "DELIVERED", deliveredAt: now } });
    await prisma.$executeRaw`UPDATE campaigns SET delivered_count = delivered_count + 1, updated_at = NOW() WHERE id = ${recipient.campaignId}`;
  } else if (status === "read" && recipient.status !== "READ" && recipient.status !== "FAILED") {
    await prisma.campaignRecipient.updateMany({
      where: { id: recipient.id },
      data: { status: "READ", readAt: now, ...(wasDelivered ? {} : { deliveredAt: now }) },
    });
    await prisma.$executeRaw`
      UPDATE campaigns
      SET read_count = read_count + 1,
          delivered_count = delivered_count + ${wasDelivered ? 0 : 1},
          updated_at = NOW()
      WHERE id = ${recipient.campaignId}
    `;
  } else if (status === "failed" && recipient.status !== "FAILED") {
    await prisma.campaignRecipient.updateMany({
      where: { id: recipient.id },
      data: { status: "FAILED", errorMessage: `Falha de entrega informada pela Meta${errorCode != null ? ` (código ${errorCode})` : ""}` },
    });
    await prisma.$executeRaw`UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = ${recipient.campaignId}`;
  }
}

export function startMessageStatusProcessor() {
  const worker = new Worker<MessageStatusJob>(
    QUEUE_NAMES.MESSAGE_STATUS_UPDATES,
    async (job: Job<MessageStatusJob>) => {
      const { instanceId, providerMessageId, status, errorCode } = job.data;

      await tenantStorage.run({ isPlatform: true }, async () => {
        // Campanhas não criam Message: o status vai para o destinatário
        await updateCampaignRecipient(providerMessageId, status, errorCode);

        const message = await prisma.message.findFirst({
          where: {
            providerMessageId,
            conversation: { instanceId },
          },
          select: { id: true },
        });

        if (!message) {
          // Mensagem enviada antes deste sistema ou por outro processo
          return;
        }

        const deliveryStatus = STATUS_MAP[status] ?? "SENT";

        await prisma.message.update({
          where: { id: message.id },
          data: {
            deliveryStatus: deliveryStatus as any,
            ...(errorCode != null ? { deliveryErrorCode: errorCode } : {}),
          },
        });
      });
    },
    { connection: getRedisConnectionOptions(), concurrency: 50 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[status-processor] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
