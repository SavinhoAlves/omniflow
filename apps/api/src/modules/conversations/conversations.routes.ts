import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { ConversationsService } from "./conversations.service";

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
  message: z.string().min(1).max(4096),
});

export async function conversationsRoutes(app: FastifyInstance) {
  const service = new ConversationsService();

  // ── Iniciar conversa outbound ────────────────────────────────────────────────
  // Cria (ou reutiliza) uma conversa e envia a primeira mensagem proativamente.
  app.post(
    "/conversations/start",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const body = initiateSchema.parse(request.body);
      const conversation = await service.startConversation({
        ...body,
        authorId: auth.userId,
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
        status: (query.status as "OPEN" | "RESOLVED") || undefined,
        mine: query.mine === "true",
        userId: auth.userId,
        departmentId: query.departmentId,
        search: query.search,
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
      const message = await service.sendMessage(id, auth.userId, content);
      return reply.status(201).send(message);
    }
  );

  // ── Atribuição e status ──────────────────────────────────────────────────────

  app.patch(
    "/conversations/:id/assign",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_TRANSFER) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = assignSchema.parse(request.body);
      await service.assign(id, data);
      return reply.send({ ok: true });
    }
  );

  app.patch(
    "/conversations/:id/status",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status } = statusSchema.parse(request.body);
      await service.changeStatus(id, status);
      return reply.send({ ok: true });
    }
  );
}
