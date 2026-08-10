import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { ConversationsService } from "./conversations.service";
import { logActivity } from "../../shared/activity-logger";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
});

const assignSchema = z.object({
  assignedToId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

const statusSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
});

const initiateSchema = z.object({
  contactPhone: z.string().min(4).max(30),
  instanceId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4096).optional(),
});

export async function conversationsRoutes(app: FastifyInstance) {
  const service = new ConversationsService();

  // ── Iniciar conversa outbound ────────────────────────────────────────────────
  // Cria (ou reutiliza) uma conversa e envia a primeira mensagem proativamente.
  app.post(
    "/conversations/start",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const auth = request.auth!;
      const body = initiateSchema.parse(request.body);
      const conversation = await service.startConversation({
        ...body,
        authorId: auth.userId,
      });
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "conversation.started",
        entity: "conversation",
        entityId: conversation.id,
        details: { contactPhone: body.contactPhone },
        ip: request.ip,
      });
      return reply.status(201).send(conversation);
    }
  );

  // ── Listagem ─────────────────────────────────────────────────────────────────

  app.get(
    "/conversations",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const query = request.query as {
        status?: string;
        mine?: string;
        departmentId?: string;
        search?: string;
      };

      const conversations = await service.list({
        status: (query.status as "OPEN" | "RESOLVED" | "LEAD") || undefined,
        mine: query.mine === "true",
        userId: auth.userId,
        departmentId: query.departmentId,
        search: query.search,
        canViewAll: auth.permissions.includes("conversations.view_all"),
        userDepartmentIds: auth.departmentIds,
      });

      return reply.send(conversations);
    }
  );

  app.get(
    "/conversations/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const conversation = await service.get(id);
      return reply.send(conversation);
    }
  );

  app.get(
    "/conversations/:id/messages",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { before } = request.query as { before?: string };
      const messages = await service.getMessages(id, before);
      return reply.send(messages);
    }
  );

  // ── Envio de mensagem ────────────────────────────────────────────────────────

  app.post(
    "/conversations/:id/messages",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const { content } = sendMessageSchema.parse(request.body);
      try {
        const message = await service.sendMessage(id, auth.userId, content);
        return reply.status(201).send(message);
      } catch (err: any) {
        if (err.code === "WINDOW_CLOSED") {
          return reply.status(422).send({ error: err.message, code: "WINDOW_CLOSED" });
        }
        throw err;
      }
    }
  );

  // ── Envio de mídia ────────────────────────────────────────────────────────────

  app.post(
    "/conversations/:id/media",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const body = request.body as { data: string; mimeType: string; filename: string };
      if (!body?.data || !body?.mimeType || !body?.filename) {
        return reply.status(400).send({ error: "data, mimeType e filename são obrigatórios" });
      }
      try {
        const message = await service.sendMedia(id, auth.userId, body);
        return reply.status(201).send(message);
      } catch (err: any) {
        if (err.code === "WINDOW_CLOSED") {
          return reply.status(422).send({ error: err.message, code: "WINDOW_CLOSED" });
        }
        throw err;
      }
    }
  );

  // ── Atribuição e status ──────────────────────────────────────────────────────

  app.delete(
    "/conversations/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      await service.deleteConversation(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "conversation.deleted",
        entity: "conversation",
        entityId: id,
        ip: request.ip,
      });
      return reply.status(204).send();
    }
  );

  app.patch(
    "/conversations/:id/assign",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const data = assignSchema.parse(request.body);
      await service.assign(id, data);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "conversation.transferred",
        entity: "conversation",
        entityId: id,
        details: { assignedToId: data.assignedToId, departmentId: data.departmentId },
        ip: request.ip,
      });
      return reply.send({ ok: true });
    }
  );

  // ── Iniciar atendimento de lead ──────────────────────────────────────────────

  app.post(
    "/conversations/:id/begin",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      await service.beginConversation(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "conversation.begun",
        entity: "conversation",
        entityId: id,
        ip: request.ip,
      });
      return reply.send({ ok: true });
    }
  );

  app.patch(
    "/conversations/:id/status",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const { status } = statusSchema.parse(request.body);
      await service.changeStatus(id, status);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: status === "RESOLVED" ? "conversation.closed" : "conversation.reopened",
        entity: "conversation",
        entityId: id,
        ip: request.ip,
      });
      return reply.send({ ok: true });
    }
  );
}
