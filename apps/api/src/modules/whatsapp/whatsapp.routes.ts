// apps/api/src/modules/whatsapp/whatsapp.routes.ts
import { createHmac, timingSafeEqual } from "crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { WhatsAppService } from "./whatsapp.service";
import { IncomingQueueClient } from "./incoming-queue.client";

// ── Schemas de validação ─────────────────────────────────────────────────────

const createInstanceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  providerType: z.enum(["BAILEYS", "META_CLOUD_API", "EVOLUTION_API", "FACEBOOK_MESSENGER", "INSTAGRAM"]),
  defaultDepartmentId: z.string().uuid().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

const sendTextSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1),
});

const sendMediaSchema = z.object({
  to: z.string().min(8),
  mediaType: z.enum(["image", "video", "audio", "document"]),
  mediaUrl: z.string().url().optional(),
  mediaId: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
}).refine((d) => d.mediaUrl || d.mediaId, {
  message: "Forneça mediaUrl ou mediaId",
});

const sendTemplateSchema = z.object({
  to: z.string().min(8),
  templateName: z.string().min(1),
  languageCode: z.string().min(2).default("pt_BR"),
  components: z.array(z.any()).optional(),
});

// ── Tipos do payload Meta ────────────────────────────────────────────────────

interface MetaWebhookEntry {
  id: string;
  changes: {
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: { profile: { name: string }; wa_id: string }[];
      messages?: MetaWebhookMessage[];
      statuses?: MetaWebhookStatus[];
    };
    field: string;
  }[];
}

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; url?: string; mime_type?: string; caption?: string };
  video?: { id: string; url?: string; mime_type?: string; caption?: string };
  audio?: { id: string; url?: string; mime_type?: string };
  document?: { id: string; url?: string; mime_type?: string; filename?: string; caption?: string };
  sticker?: { id: string; url?: string; mime_type?: string };
}

interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string; message?: string }[];
}

// ── Registro de rotas ────────────────────────────────────────────────────────

export async function whatsappRoutes(app: FastifyInstance) {
  const service = new WhatsAppService();
  const incomingQueue = new IncomingQueueClient();

  // ── Gestão de instâncias ─────────────────────────────────────────────────

  app.post(
    "/whatsapp/instances",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const body = createInstanceSchema.parse(request.body);
      const instance = await service.createInstance(body);
      return reply.status(201).send(instance);
    }
  );

  app.get(
    "/whatsapp/instances",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (_request, reply) => {
      const instances = await service.listInstances();
      return reply.send(instances);
    }
  );

  app.post(
    "/whatsapp/instances/:id/connect",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const state = await service.connect(id);
      return reply.send({ status: state.status, qrCode: state.qrCode ?? null });
    }
  );

  // ── Envio de mensagens ───────────────────────────────────────────────────

  app.post(
    "/whatsapp/instances/:id/messages/text",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = sendTextSchema.parse(request.body);
      const result = await service.sendTextMessage(id, body.to, body.text);
      return reply.send(result);
    }
  );

  // [Update 4] Envio de mídia (imagem, vídeo, áudio, documento)
  app.post(
    "/whatsapp/instances/:id/messages/media",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = sendMediaSchema.parse(request.body);
      const result = await service.sendMediaMessage(id, body);
      return reply.send(result);
    }
  );

  // [Update 4] Upload de mídia para obter media_id (Meta Cloud API apenas)
  app.post(
    "/whatsapp/instances/:id/media/upload",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "Arquivo não enviado" });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      const result = await service.uploadMedia(id, {
        fileBuffer,
        mimeType: data.mimetype,
        filename: data.filename,
      });
      return reply.send(result);
    }
  );

  // [Update 5] Envio de template HSM
  app.post(
    "/whatsapp/instances/:id/messages/template",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = sendTemplateSchema.parse(request.body);
      const result = await service.sendTemplateMessage(id, body);
      return reply.send(result);
    }
  );

  // ── Webhooks ─────────────────────────────────────────────────────────────

  // [Update 3] GET — verificação de webhook Meta (desafio hub.challenge)
  app.get("/whatsapp/webhook/meta", { config: { public: true } }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const mode      = q["hub.mode"];
    const token     = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    const stored = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!stored) {
      request.log.warn("META_WEBHOOK_VERIFY_TOKEN não configurado");
      return reply.status(500).send({ error: "Webhook não configurado" });
    }

    if (mode === "subscribe" && token === stored) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send({ error: "Verificação inválida" });
  });

  // [Update 2 & 3] POST — recebe eventos Meta (mensagens + status de entrega)
  // URL de configuração: https://sua-api.com/whatsapp/webhook/meta?instanceId=UUID
  app.post("/whatsapp/webhook/meta", { config: { public: true } }, async (request, reply) => {
    // Responde 200 imediatamente — Meta requer resposta em < 20s
    // e re-tenta se receber timeout. O processamento vai para a fila.
    reply.status(200).send({ received: true });

    const instanceId = (request.query as Record<string, string>)["instanceId"];
    if (!instanceId) {
      request.log.warn("Webhook Meta recebido sem instanceId na query string");
      return;
    }

    // [Update 2] Validação da assinatura HMAC-SHA256
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret) {
      const signature = request.headers["x-hub-signature-256"] as string | undefined;
      if (!signature) {
        request.log.warn({ instanceId }, "Webhook sem X-Hub-Signature-256");
        return;
      }
      const rawBody = JSON.stringify(request.body);
      const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
      try {
        if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          request.log.warn({ instanceId }, "Assinatura de webhook inválida");
          return;
        }
      } catch {
        request.log.warn({ instanceId }, "Erro ao validar assinatura de webhook");
        return;
      }
    }

    const payload = request.body as { object?: string; entry?: MetaWebhookEntry[] };
    if (payload.object !== "whatsapp_business_account") return;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const { value } = change;

        // [Update 3] Mensagens recebidas → fila incoming-messages
        for (const msg of value.messages ?? []) {
          const contact = value.contacts?.find((c) => c.wa_id === msg.from);
          const mediaType = resolveMediaType(msg.type);
          const mediaUrl  = resolveMediaUrl(msg);

          await incomingQueue.publishIncomingMessage({
            instanceId,
            fromNumber: msg.from,
            contactName: contact?.profile?.name,
            text: msg.text?.body,
            mediaUrl,
            mediaType,
            providerMessageId: msg.id,
            receivedAt: new Date(Number(msg.timestamp) * 1000),
          });
        }

        // [Update 2] Status de entrega → fila message-status-updates
        for (const status of value.statuses ?? []) {
          await incomingQueue.publishStatusUpdate({
            instanceId,
            providerMessageId: status.id,
            status: status.status,
            recipientNumber: status.recipient_id,
            timestamp: new Date(Number(status.timestamp) * 1000),
            errorCode: status.errors?.[0]?.code,
            errorMessage: status.errors?.[0]?.title,
          });
        }
      }
    }
  });

  // Webhook genérico para Evolution API (rota existente — mantida)
  app.post("/whatsapp/webhook/:provider", { config: { public: true } }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    if (provider === "meta") {
      // Capturado pela rota específica acima — não deve chegar aqui
      return reply.status(200).send({ received: true });
    }
    request.log.info({ provider }, "Webhook recebido (Evolution/outro)");
    // TODO: normalizar payload Evolution e publicar na fila incoming-messages
    return reply.status(200).send({ received: true });
  });
}

// ── Helpers de normalização do payload Meta ──────────────────────────────────

function resolveMediaType(
  type: string
): "image" | "video" | "audio" | "document" | "sticker" | undefined {
  switch (type) {
    case "image":    return "image";
    case "video":    return "video";
    case "audio":    return "audio";
    case "document": return "document";
    case "sticker":  return "sticker";
    default:         return undefined;
  }
}

function resolveMediaUrl(msg: MetaWebhookMessage): string | undefined {
  // URLs de mídia do webhook Meta expiram em 5 min — devem ser
  // re-fetched via GET /media/{id} antes de usar. Aqui armazenamos
  // o media_id no campo mediaUrl para downstream download posterior.
  const mediaId =
    msg.image?.id   ??
    msg.video?.id   ??
    msg.audio?.id   ??
    msg.document?.id ??
    msg.sticker?.id;
  return mediaId ? `meta:media:${mediaId}` : undefined;
}
