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
  templateName: z.string().optional(),
  languageCode: z.string().optional(),
  templateComponents: z.array(z.any()).optional(),
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
      try {
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
      } catch (err: any) {
        if (err.code === "USE_TEMPLATE") {
          return reply.status(422).send({ error: err.message, code: "USE_TEMPLATE" });
        }
        throw err;
      }
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
        priority?: string;
        unreadOnly?: string;
        cursor?: string;
        limit?: string;
      };

      const result = await service.list({
        status: (query.status as "OPEN" | "RESOLVED" | "LEAD") || undefined,
        mine: query.mine === "true",
        userId: auth.userId,
        departmentId: query.departmentId,
        search: query.search,
        priority: query.priority,
        unreadOnly: query.unreadOnly === "true",
        canViewAll: auth.permissions.includes("conversations.view_all"),
        userDepartmentIds: auth.departmentIds,
        cursor: query.cursor,
        limit: query.limit ? Number(query.limit) : undefined,
      });

      return reply.send(result);
    }
  );

  app.get(
    "/conversations/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const conversation = await service.get(id);
      const now = new Date();
      const windowStatus = conversation.windowExpiresAt
        ? conversation.windowExpiresAt > now ? "open" : "expired"
        : "none";
      // Mark as read — reset unread counter when an agent opens the conversation
      void service.markRead(id).catch(() => {});
      return reply.send({ ...conversation, windowStatus });
    }
  );

  app.get(
    "/conversations/:id/messages",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { before, cursor, limit } = request.query as {
        before?: string; cursor?: string; limit?: string;
      };
      const result = await service.getMessages(id, {
        before,
        cursor,
        limit: limit ? Number(limit) : undefined,
      });
      return reply.send(result);
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

  // ── Busca global de mensagens (T5.5) ─────────────────────────────────────────

  app.get(
    "/conversations/search",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { q, limit } = request.query as { q?: string; limit?: string };
      if (!q || q.trim().length < 2) {
        return reply.status(400).send({ error: "Parâmetro 'q' deve ter pelo menos 2 caracteres" });
      }
      const results = await service.search(q.trim(), limit ? Number(limit) : 20);
      return reply.send(results);
    }
  );

  // ── Ações em lote (T5.3) ─────────────────────────────────────────────────────

  const bulkSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
  });

  app.post(
    "/conversations/bulk/assign",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const { ids } = bulkSchema.parse(request.body);
      const { assignedToId } = request.body as { assignedToId?: string | null };
      await service.bulkAssign(ids, assignedToId ?? null);
      return reply.send({ ok: true, count: ids.length });
    }
  );

  app.post(
    "/conversations/bulk/status",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const { ids } = bulkSchema.parse(request.body);
      const { status } = z.object({ status: z.enum(["OPEN", "RESOLVED"]) }).parse(request.body);
      await service.bulkStatus(ids, status);
      return reply.send({ ok: true, count: ids.length });
    }
  );

  app.post(
    "/conversations/bulk/tag",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const { ids } = bulkSchema.parse(request.body);
      const { tags } = z.object({ tags: z.array(z.string()) }).parse(request.body);
      await service.bulkTag(ids, tags);
      return reply.send({ ok: true, count: ids.length });
    }
  );

  // ── Tags de conversa (T5.2) ──────────────────────────────────────────────────

  app.patch(
    "/conversations/:id/tags",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tags } = z.object({ tags: z.array(z.string()) }).parse(request.body);
      await service.updateTags(id, tags);
      return reply.send({ ok: true });
    }
  );

  // ── Notas internas (T3.3) ────────────────────────────────────────────────────

  app.post(
    "/conversations/:id/notes",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const { content } = z.object({ content: z.string().min(1).max(4096) }).parse(request.body);
      const note = await service.addNote(id, auth.userId, content);
      return reply.status(201).send(note);
    }
  );

  // ── Prioridade (T3.5) ────────────────────────────────────────────────────────

  app.patch(
    "/conversations/:id/priority",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { priority } = z.object({
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      }).parse(request.body);
      await service.setPriority(id, priority);
      return reply.send({ ok: true });
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
