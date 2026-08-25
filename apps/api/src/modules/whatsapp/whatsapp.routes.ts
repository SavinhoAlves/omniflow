// apps/api/src/modules/whatsapp/whatsapp.routes.ts
import { createHmac, timingSafeEqual } from "crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { WhatsAppService } from "./whatsapp.service";
import { IncomingQueueClient } from "./incoming-queue.client";
import { logActivity } from "../../shared/activity-logger";

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
    // value is `any` here because different fields have different value shapes
    value: any;
    field: string;
  }[];
}

// ── T2.3: Payload shapes para quality / status webhooks ──────────────────────

interface MetaTemplateStatusValue {
  event?: string;                  // APPROVED | REJECTED | PAUSED | DISABLED | DELETED
  message_template_id?: number;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
}

interface MetaTemplateQualityValue {
  previous_quality_score?: string; // GREEN | YELLOW | RED
  new_quality_score?: string;
  message_template_id?: number;
  message_template_name?: string;
  message_template_language?: string;
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

  app.patch(
    "/whatsapp/instances/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        defaultDepartmentId: z.string().uuid().nullable().optional(),
      }).parse(request.body);
      const updated = await service.updateInstance(id, body);
      return reply.send(updated);
    }
  );

  app.delete(
    "/whatsapp/instances/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      await service.deleteInstance(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "whatsapp.instance_deleted",
        entity: "whatsapp_instance",
        entityId: id,
        ip: request.ip,
      });
      return reply.status(204).send();
    }
  );

  app.post(
    "/whatsapp/instances/:id/disconnect",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      await service.disconnect(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "whatsapp.disconnected",
        entity: "whatsapp_instance",
        entityId: id,
        ip: request.ip,
      });
      return reply.send({ ok: true });
    }
  );

  app.post(
    "/whatsapp/instances/:id/connect",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const state = await service.connect(id);
      if (state.status === "CONNECTED" || state.status === "QR_PENDING") {
        logActivity({
          companyId: auth.companyId,
          userId: auth.userId,
          userName: auth.name,
          action: "whatsapp.connect_requested",
          entity: "whatsapp_instance",
          entityId: id,
          details: { status: state.status },
          ip: request.ip,
        });
      }
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

  // ── Templates Meta ───────────────────────────────────────────────────────

  // Lista templates do cache local (rápido — sem chamar Meta)
  app.get(
    "/whatsapp/instances/:id/templates",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_VIEW_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const templates = await service.listTemplates(id);
        return reply.send(templates);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Dispara sync imediato com a Meta (pull + upsert no cache local)
  app.post(
    "/whatsapp/instances/:id/templates/sync",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await service.syncTemplates(id);
        return reply.send({ success: true, ...result });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // ── Embedded Signup (Meta OAuth para onboarding sem token manual) ────────

  // Passo 1: Redireciona para o fluxo OAuth do Facebook
  // O frontend abre esta URL em uma nova janela/popup.
  app.get(
    "/whatsapp/embedded-signup/start",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const appId = process.env.META_APP_ID;
      if (!appId) {
        return reply.status(500).send({ error: "META_APP_ID não configurado" });
      }
      const redirectUri = encodeURIComponent(
        `${process.env.API_URL ?? "http://localhost:3333"}/whatsapp/embedded-signup/callback`
      );
      const scope = encodeURIComponent(
        "whatsapp_business_management,whatsapp_business_messaging,business_management"
      );
      const state = Buffer.from(JSON.stringify({ companyId: (request as any).auth?.companyId }))
        .toString("base64url");

      const url =
        `https://www.facebook.com/dialog/oauth?client_id=${appId}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=${scope}` +
        `&response_type=code` +
        `&state=${state}`;

      return reply.send({ url });
    }
  );

  // Passo 2: Callback OAuth — troca code por token e retorna dados para o frontend
  // O frontend chama este endpoint após o popup Meta redirecionar de volta.
  app.post(
    "/whatsapp/embedded-signup/complete",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const { code } = request.body as { code?: string };
      if (!code) return reply.status(400).send({ error: "code é obrigatório" });

      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      if (!appId || !appSecret) {
        return reply.status(500).send({ error: "META_APP_ID / META_APP_SECRET não configurados" });
      }

      const redirectUri = `${process.env.API_URL ?? "http://localhost:3333"}/whatsapp/embedded-signup/callback`;

      // 1. Troca code por user access token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v25.0/oauth/access_token` +
        `?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      );
      if (!tokenRes.ok) {
        const e = await tokenRes.text();
        return reply.status(400).send({ error: `Falha ao trocar code: ${e}` });
      }
      const { access_token: userToken } = (await tokenRes.json()) as { access_token: string };

      // 2. Busca WABAs vinculadas ao token
      const wabaRes = await fetch(
        `https://graph.facebook.com/v25.0/me/businesses?fields=id,name,whatsapp_business_accounts&access_token=${userToken}`
      );
      if (!wabaRes.ok) {
        const e = await wabaRes.text();
        return reply.status(400).send({ error: `Falha ao listar WABAs: ${e}` });
      }
      const wabaData = (await wabaRes.json()) as { data: any[] };

      // Retorna lista de WABAs para o frontend selecionar qual registrar
      return reply.send({ userToken, businesses: wabaData.data });
    }
  );

  // Passo 3 (opcional): Troca GET callback Meta → redireciona para o frontend com code
  app.get(
    "/whatsapp/embedded-signup/callback",
    { config: { public: true } },
    async (request, reply) => {
      const { code, error } = request.query as { code?: string; error?: string };
      const frontendUrl = process.env.FRONTEND_URL?.split(",")[0] ?? "http://localhost:3000";

      if (error || !code) {
        return reply.redirect(`${frontendUrl}/whatsapp/setup?error=${encodeURIComponent(error ?? "cancelled")}`);
      }
      return reply.redirect(`${frontendUrl}/whatsapp/setup?code=${encodeURIComponent(code)}`);
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
        const { field, value } = change;

        // ── Mensagens recebidas → fila incoming-messages ─────────────────
        if (field === "messages") {
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

          // Status de entrega → fila message-status-updates
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

        // ── T2.3: Qualidade / status de template ─────────────────────────
        if (field === "message_template_status_update") {
          const v = value as MetaTemplateStatusValue;
          if (v.message_template_id) {
            await tenantStorage.run({ isPlatform: true }, () =>
              prisma.template.updateMany({
                where: { providerId: String(v.message_template_id) },
                data: {
                  status: v.event ?? "PENDING",
                  rejectionReason: v.reason ?? null,
                },
              })
            );
            request.log.info(
              { templateId: v.message_template_id, event: v.event },
              "Template status atualizado via webhook Meta"
            );
          }
        }

        if (field === "message_template_quality_update") {
          const v = value as MetaTemplateQualityValue;
          if (v.message_template_id) {
            await tenantStorage.run({ isPlatform: true }, () =>
              prisma.template.updateMany({
                where: { providerId: String(v.message_template_id) },
                data: { quality: v.new_quality_score ?? null },
              })
            );
            request.log.info(
              { templateId: v.message_template_id, quality: v.new_quality_score },
              "Template quality atualizado via webhook Meta"
            );
          }
        }
      }
    }
  });

  // Webhook para Evolution API (provider=evolution ou evolution-api)
  app.post("/whatsapp/webhook/:provider", { config: { public: true } }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    if (provider === "meta") {
      return reply.status(200).send({ received: true });
    }

    if (provider !== "evolution" && provider !== "evolution-api") {
      request.log.warn({ provider }, "Provider desconhecido no webhook");
      return reply.status(200).send({ received: true });
    }

    // Assinatura HMAC opcional (Evolution API v2 suporta x-evolution-signature)
    const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
    if (webhookSecret) {
      const sig = request.headers["x-evolution-signature"] as string | undefined;
      if (!sig) {
        request.log.warn("Webhook Evolution sem x-evolution-signature");
        return reply.status(200).send({ received: true });
      }
      const rawBody = JSON.stringify(request.body);
      const expected = "sha256=" + createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      try {
        if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          request.log.warn("Assinatura inválida no webhook Evolution");
          return reply.status(200).send({ received: true });
        }
      } catch {
        request.log.warn("Erro ao validar assinatura Evolution");
        return reply.status(200).send({ received: true });
      }
    }

    // instanceId vem na query string: /whatsapp/webhook/evolution?instanceId=<uuid>
    const { instanceId } = request.query as { instanceId?: string };
    if (!instanceId) {
      request.log.warn("Webhook Evolution recebido sem instanceId na query string");
      return reply.status(200).send({ received: true });
    }

    const payload = request.body as EvolutionWebhookPayload;
    if (!payload?.event) return reply.status(200).send({ received: true });

    request.log.info({ event: payload.event, instanceId: instanceId.slice(0, 8) }, "Webhook Evolution");

    // ── Mensagens recebidas ──────────────────────────────────────────────────
    if (payload.event === "messages.upsert") {
      const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
      if (!data?.key) return reply.status(200).send({ received: true });

      // Ignorar mensagens enviadas pelo próprio número (outbound)
      if (data.key.fromMe) return reply.status(200).send({ received: true });

      // Somente conversas diretas (não grupos)
      const remoteJid = data.key.remoteJid ?? "";
      if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid")) {
        return reply.status(200).send({ received: true });
      }

      const fromNumber = remoteJid.replace(/@s\.whatsapp\.net$|@lid$/, "");
      const { text, mediaType, mediaUrl } = extractEvolutionMessage(data.message);
      const ts = data.messageTimestamp;

      await incomingQueue.publishIncomingMessage({
        instanceId,
        fromNumber,
        contactName: data.pushName,
        text,
        mediaUrl,
        mediaType,
        providerMessageId: data.key.id,
        receivedAt: ts ? new Date(Number(ts) * 1000) : new Date(),
      });
    }

    // ── Status de entrega ────────────────────────────────────────────────────
    if (payload.event === "messages.update") {
      const updates = Array.isArray(payload.data) ? payload.data : [payload.data];
      for (const upd of updates) {
        if (!upd?.key?.fromMe) continue; // só rastreia mensagens enviadas por nós
        const status = mapEvolutionStatus(upd.update?.status);
        if (!status) continue;
        const remoteJid = upd.key.remoteJid ?? "";
        const recipientNumber = remoteJid.replace(/@s\.whatsapp\.net$|@lid$/, "");
        await incomingQueue.publishStatusUpdate({
          instanceId,
          providerMessageId: upd.key.id,
          status,
          recipientNumber,
          timestamp: new Date(),
        });
      }
    }

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

// ── Tipos e helpers para Evolution API webhook ────────────────────────────────

interface EvolutionMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; url?: string; directPath?: string };
  videoMessage?: { caption?: string; url?: string; directPath?: string };
  audioMessage?: { url?: string; directPath?: string; ptt?: boolean };
  documentMessage?: { caption?: string; url?: string; directPath?: string; fileName?: string };
  stickerMessage?: { url?: string; directPath?: string };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number };
  contactMessage?: { displayName?: string };
}

interface EvolutionDataItem {
  key: { remoteJid?: string; fromMe?: boolean; id: string };
  pushName?: string;
  message?: EvolutionMessage;
  messageType?: string;
  messageTimestamp?: number | string;
  update?: { status?: number | string };
}

interface EvolutionWebhookPayload {
  event: string;
  instance?: string;
  data: EvolutionDataItem | EvolutionDataItem[];
}

function extractEvolutionMessage(msg?: EvolutionMessage): {
  text?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts";
  mediaUrl?: string;
} {
  if (!msg) return {};
  if (msg.conversation) return { text: msg.conversation };
  if (msg.extendedTextMessage?.text) return { text: msg.extendedTextMessage.text };
  if (msg.imageMessage) return { mediaType: "image", mediaUrl: msg.imageMessage.url, text: msg.imageMessage.caption };
  if (msg.videoMessage) return { mediaType: "video", mediaUrl: msg.videoMessage.url, text: msg.videoMessage.caption };
  if (msg.audioMessage) return { mediaType: "audio", mediaUrl: msg.audioMessage.url };
  if (msg.documentMessage) return { mediaType: "document", mediaUrl: msg.documentMessage.url, text: msg.documentMessage.caption };
  if (msg.stickerMessage) return { mediaType: "sticker", mediaUrl: msg.stickerMessage.url };
  if (msg.locationMessage) return { mediaType: "location" };
  if (msg.contactMessage) return { mediaType: "contacts" };
  return {};
}

function mapEvolutionStatus(
  raw?: number | string
): "sent" | "delivered" | "read" | "failed" | undefined {
  // Evolution usa inteiros de Baileys (WAMessageStatus) ou strings uppercase
  switch (String(raw)) {
    case "2": case "SERVER_ACK": return "sent";
    case "3": case "DELIVERY_ACK": return "delivered";
    case "4": case "READ": return "read";
    case "5": case "PLAYED": return "read"; // áudio/vídeo reproduzido → read
    case "0": case "ERROR": return "failed";
    default: return undefined; // PENDING (1) e desconhecidos → ignorar
  }
}
