import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

const savedReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(4096),
  tags: z.array(z.string()).optional().default([]),
});

export async function savedRepliesRoutes(app: FastifyInstance) {
  // T5.1 — CRUD de respostas rápidas

  app.get(
    "/saved-replies",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { search } = request.query as { search?: string };
      const where: any = { companyId: auth.companyId };
      if (search) where.title = { contains: search, mode: "insensitive" };

      const replies = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.savedReply.findMany({
          where,
          orderBy: { title: "asc" },
          select: { id: true, title: true, content: true, tags: true, createdAt: true },
        })
      );
      return reply.send(replies);
    }
  );

  app.post(
    "/saved-replies",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const body = savedReplySchema.parse(request.body);
      const reply_ = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.savedReply.create({
          data: { companyId: auth.companyId, ...body, createdBy: auth.userId },
          select: { id: true, title: true, content: true, tags: true, createdAt: true },
        })
      );
      return reply.status(201).send(reply_);
    }
  );

  app.put(
    "/saved-replies/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const body = savedReplySchema.parse(request.body);
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.savedReply.updateMany({ where: { id, companyId: auth.companyId }, data: body })
      );
      return reply.send({ ok: true });
    }
  );

  app.delete(
    "/saved-replies/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.savedReply.deleteMany({ where: { id, companyId: auth.companyId } })
      );
      return reply.status(204).send();
    }
  );
}
