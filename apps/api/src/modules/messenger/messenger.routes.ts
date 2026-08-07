// apps/api/src/modules/messenger/messenger.routes.ts
import { createHmac, timingSafeEqual } from "crypto";
import { FastifyInstance } from "fastify";
import { IncomingQueueClient } from "../whatsapp/incoming-queue.client";

interface MessagingEntry {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: { type: string; payload: { url?: string; sticker_id?: number } }[];
    is_echo?: boolean;
  };
  read?: { watermark: number };
  delivery?: { watermark: number };
  postback?: { payload: string; title: string };
}

interface MetaPageWebhookPayload {
  object: "page" | "instagram";
  entry: {
    id: string;
    time: number;
    messaging: MessagingEntry[];
  }[];
}

export async function messengerRoutes(app: FastifyInstance) {
  const incomingQueue = new IncomingQueueClient();

  // ── GET — verificação de webhook Meta (mesmo token do WhatsApp) ──────────────
  app.get("/messenger/webhook", { config: { public: true } }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const mode      = q["hub.mode"];
    const token     = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    const stored = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!stored) {
      return reply.status(500).send({ error: "META_WEBHOOK_VERIFY_TOKEN não configurado" });
    }
    if (mode === "subscribe" && token === stored) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send({ error: "Verificação inválida" });
  });

  // ── POST — eventos Messenger e Instagram ─────────────────────────────────────
  // URL de configuração no Meta Developer Portal:
  //   Messenger:  https://sua-api.com/messenger/webhook?instanceId=UUID
  //   Instagram:  https://sua-api.com/messenger/webhook?instanceId=UUID
  app.post("/messenger/webhook", { config: { public: true } }, async (request, reply) => {
    // Responde 200 imediatamente — Meta re-tenta se houver timeout
    reply.status(200).send({ received: true });

    const instanceId = (request.query as Record<string, string>)["instanceId"];
    if (!instanceId) {
      request.log.warn("Messenger webhook sem instanceId");
      return;
    }

    // Validação HMAC-SHA256 (mesmo app secret para todos os produtos Meta)
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret) {
      const signature = request.headers["x-hub-signature-256"] as string | undefined;
      if (signature) {
        const expected = "sha256=" + createHmac("sha256", appSecret)
          .update(JSON.stringify(request.body))
          .digest("hex");
        try {
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            request.log.warn({ instanceId }, "Assinatura Messenger inválida");
            return;
          }
        } catch {
          return;
        }
      }
    }

    const payload = request.body as MetaPageWebhookPayload;
    if (payload.object !== "page" && payload.object !== "instagram") return;

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        // Ignorar echoes (mensagens enviadas pelo próprio sistema)
        if (event.message?.is_echo) continue;

        // Ignorar eventos de leitura e entrega (sem mensagem de texto)
        if (!event.message && !event.postback) continue;

        const senderId = event.sender.id;
        const mid      = event.message?.mid ?? `postback-${event.timestamp}`;
        const text     = event.message?.text ?? event.postback?.title;

        // Mídia recebida (imagem, vídeo, áudio, arquivo)
        const firstAttachment = event.message?.attachments?.[0];
        let mediaUrl: string | undefined;
        let mediaType: "image" | "video" | "audio" | "document" | undefined;

        if (firstAttachment) {
          mediaUrl = firstAttachment.payload?.url;
          switch (firstAttachment.type) {
            case "image":  mediaType = "image";    break;
            case "video":  mediaType = "video";    break;
            case "audio":  mediaType = "audio";    break;
            case "file":   mediaType = "document"; break;
          }
        }

        await incomingQueue.publishIncomingMessage({
          instanceId,
          fromNumber: senderId,  // PSID/IGSID armazenado como "phoneNumber"
          text,
          mediaUrl,
          mediaType,
          providerMessageId: mid,
          receivedAt: new Date(event.timestamp),
        });
      }
    }
  });
}
