import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { WhatsAppProviderFactory, WhatsAppProviderType } from "@omnichannel/providers";
import { getRedisConnectionOptions } from "../queues/queue-names";
import { sessionManager } from "../whatsapp/session-manager";
import { decryptCredentials } from "../whatsapp/credentials-crypto";

// Canais por API (Meta, Evolution, Messenger, Instagram). Baileys não passa
// por aqui: a sessão vive neste mesmo processo e é usada direto.
const providerFactory = new WhatsAppProviderFactory({
  getCredentials: async (instanceId) => {
    const inst = await tenantStorage.run({ isPlatform: true }, () =>
      prisma.whatsAppInstance.findFirstOrThrow({ where: { id: instanceId }, select: { credentials: true } })
    );
    if (!inst.credentials) throw new Error(`Instância ${instanceId} sem credenciais`);
    return decryptCredentials(inst.credentials as string);
  },
  baileysQueue: {
    enqueue: async () => {
      throw new Error("Baileys é enviado direto pela sessão do worker");
    },
  },
});

type MediaKind = "image" | "video" | "audio" | "document";

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

  if (conv.instance.providerType === "BAILEYS") {
    if (media) await sessionManager.sendMedia(conv.instance.id, to, media.url, media.kind, msg.content);
    else await sessionManager.sendText(conv.instance.id, to, msg.content);
  } else {
    const provider = providerFactory.get(conv.instance.providerType as WhatsAppProviderType);
    if (media) await provider.sendMediaMessage(conv.instance.id, { to, mediaType: media.kind, mediaUrl: media.url, caption: msg.content });
    else await provider.sendTextMessage(conv.instance.id, { to, text: msg.content });
  }

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction: "OUTBOUND",
      type: media ? (media.kind.toUpperCase() as any) : "TEXT",
      content: msg.content,
      mediaUrl: media?.url,
      authorId: msg.createdById,
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
