import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

const createSchema = z.object({
  content: z.string().min(1),
  scheduledAt: z.string().datetime(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
});

export async function scheduledMessagesRoutes(app: FastifyInstance) {
  // List scheduled messages for a conversation
  app.get(
    "/conversations/:id/scheduled",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const messages = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.scheduledMessage.findMany({
          where: { conversationId: id, companyId: auth.companyId, status: { in: ["PENDING", "SENT", "FAILED"] } },
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true, content: true, scheduledAt: true, sentAt: true, status: true,
            errorMessage: true, mediaUrl: true, mediaType: true, createdAt: true,
            createdBy: { select: { id: true, name: true } },
          },
        })
      );
      return reply.send(messages);
    }
  );

  // Create a scheduled message
  app.post(
    "/conversations/:id/scheduled",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const body = createSchema.parse(request.body);

      const scheduledAt = new Date(body.scheduledAt);
      if (scheduledAt <= new Date()) {
        return reply.status(400).send({ error: "scheduledAt deve ser uma data futura" });
      }

      // Verify conversation belongs to company
      const conv = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.conversation.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true } })
      );
      if (!conv) return reply.status(404).send({ error: "Conversa não encontrada" });

      const msg = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.scheduledMessage.create({
          data: {
            companyId: auth.companyId,
            conversationId: id,
            createdById: auth.userId,
            content: body.content,
            scheduledAt,
            mediaUrl: body.mediaUrl,
            mediaType: body.mediaType,
          },
        })
      );
      return reply.status(201).send(msg);
    }
  );

  // Cancel a scheduled message
  app.delete(
    "/conversations/:id/scheduled/:msgId",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { msgId } = request.params as { id: string; msgId: string };

      const updated = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.scheduledMessage.updateMany({
          where: { id: msgId, companyId: auth.companyId, status: "PENDING" },
          data: { status: "CANCELLED" },
        })
      );

      if (updated.count === 0) {
        return reply.status(404).send({ error: "Mensagem não encontrada ou já enviada" });
      }
      return reply.status(204).send();
    }
  );
}
