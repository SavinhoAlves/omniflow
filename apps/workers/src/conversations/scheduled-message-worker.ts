import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";

const QUEUE_NAME = "scheduled-messages";
const SEND_JOB = "send-due-messages";
// Check every minute
const CRON_PATTERN = "* * * * *";

async function sendDueMessages() {
  const now = new Date();

  const due = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: now } },
      include: { conversation: { select: { id: true, companyId: true, instanceId: true, channelType: true } } },
      take: 50,
      orderBy: { scheduledAt: "asc" },
    })
  );

  if (due.length === 0) return;
  console.log(`[scheduled-messages] ${due.length} mensagem(ns) para enviar`);

  for (const msg of due) {
    try {
      // Mark as processing atomically to avoid double-send
      const updated = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.scheduledMessage.updateMany({
          where: { id: msg.id, status: "PENDING" },
          data: { status: "SENT", sentAt: now },
        })
      );

      if (updated.count === 0) continue; // Already picked up by another instance

      // Send via outbound queue — reuse existing phone-outbound pattern
      const { Queue: Q } = await import("bullmq");
      const outboundQueue = new Q("phone-outbound", { connection: getRedisConnectionOptions() });
      await outboundQueue.add("send-message", {
        conversationId: msg.conversationId,
        companyId: msg.conversation.companyId,
        content: msg.content,
        mediaUrl: msg.mediaUrl ?? undefined,
        mediaType: msg.mediaType ?? undefined,
        scheduledMessageId: msg.id,
      });
    } catch (err: any) {
      console.error(`[scheduled-messages] Falha ao enviar msg ${msg.id}:`, err.message);
      await tenantStorage.run({ isPlatform: true }, () =>
        prisma.scheduledMessage.updateMany({
          where: { id: msg.id },
          data: { status: "FAILED", errorMessage: err.message },
        })
      );
    }
  }
}

export async function scheduleMessageJobs(): Promise<void> {
  const connection = getRedisConnectionOptions();
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add(SEND_JOB, {}, { repeat: { pattern: CRON_PATTERN }, jobId: SEND_JOB });
  console.log(`[scheduled-messages] Job agendado: ${CRON_PATTERN}`);
}

export function startScheduledMessageWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === SEND_JOB) {
        await sendDueMessages();
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[scheduled-messages] Job ${job?.name} falhou:`, err.message);
  });

  return worker;
}
