// apps/api/src/modules/whatsapp/whatsapp.routes.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { WhatsAppService } from "./whatsapp.service";

const createInstanceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  providerType: z.enum(["BAILEYS", "META_CLOUD_API", "EVOLUTION_API"]),
  defaultDepartmentId: z.string().uuid().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

const sendTextSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1),
});

export async function whatsappRoutes(app: FastifyInstance) {
  const service = new WhatsAppService();

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

  // Webhook de entrada (Meta e Evolution chamam esta URL quando uma
  // mensagem chega). Pública por natureza — não há usuário logado
  // do lado do provider — mas cada provider tem seu próprio esquema
  // de verificação (assinatura HMAC na Meta, apikey na Evolution),
  // que entra na implementação real deste handler junto com o
  // módulo de Conversas (é lá que o evento normalizado é consumido).
  app.post("/whatsapp/webhook/:provider", { config: { public: true } }, async (request, reply) => {
    // TODO: validar assinatura, normalizar payload em
    // IncomingMessageEvent, publicar na fila `incoming-messages`
    // para o módulo de Conversas processar. Implementado junto com
    // esse módulo, para não duplicar a lógica de parsing aqui.
    const { provider } = request.params as { provider: string };
    request.log.info({ provider }, "Webhook recebido");
    return reply.status(200).send({ received: true });
  });
}