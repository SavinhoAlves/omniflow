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
export function startMessageStatusProcessor() {
  const worker = new Worker<MessageStatusJob>(
    QUEUE_NAMES.MESSAGE_STATUS_UPDATES,
    async (job: Job<MessageStatusJob>) => {
      const { instanceId, providerMessageId, status, errorCode } = job.data;

      await tenantStorage.run({ isPlatform: true }, async () => {
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
