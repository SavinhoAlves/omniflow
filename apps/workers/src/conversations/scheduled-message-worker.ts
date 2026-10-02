import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";
import { sendTextViaChannel, type MediaKind } from "../whatsapp/channel-sender";

/** Entrega uma mensagem agendada pelo canal da conversa e registra no histórico */
async function deliver(msg: {
  id: string;
  conversationId: string;
  createdById: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
}) {
  const conv = await prisma.conversation.findFirst({
    where: { id: msg.conversationId },
    select: {
      id: true,
      windowExpiresAt: true,
      contact: { select: { phoneNumber: true, optOut: true } },
      instance: { select: { id: true, providerType: true } },
    },
  });
  if (!conv) throw new Error("Conversa não encontrada");
  if (conv.contact.optOut) throw new Error("Contato pediu para não receber mensagens automáticas (opt-out)");
  if (conv.instance.providerType === "META_CLOUD_API" && (!conv.windowExpiresAt || conv.windowExpiresAt < new Date())) {
    throw new Error("Janela de 24 horas encerrada — use um template aprovado");
  }

  const to = conv.contact.phoneNumber;
  const media = msg.mediaUrl
    ? { url: msg.mediaUrl, kind: (["image", "video", "audio"].includes(msg.mediaType ?? "") ? msg.mediaType : "document") as MediaKind }
    : null;

  // providerMessageId permite que o status de entrega (webhook Meta) atualize esta mensagem
  const providerMessageId = await sendTextViaChannel(
    { instanceId: conv.instance.id, providerType: conv.instance.providerType, to },
    msg.content,
    media
  );

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction: "OUTBOUND",
      type: media ? (media.kind.toUpperCase() as any) : "TEXT",
      content: msg.content,
      mediaUrl: media?.url,
      authorId: msg.createdById,
      providerMessageId: providerMessageId ?? undefined,
    },
  });
  await prisma.conversation.updateMany({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
}

const QUEUE_NAME = "scheduled-messages";
const SEND_JOB = "send-due-messages";
// Check every minute
const CRON_PATTERN = "* * * * *";

async function sendDueMessages() {
  const now = new Date();

  const due = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: now } },
      include: { conversation: { select: { id: true, companyId: true, instanceId: true } } },
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

      // Antes isto ia para a fila "phone-outbound", que só registra mensagens
      // enviadas pelo celular — nada era entregue. Agora envia pelo canal.
      await tenantStorage.run({ companyId: msg.conversation.companyId }, () => deliver(msg));
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
