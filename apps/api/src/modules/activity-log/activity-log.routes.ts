import { FastifyInstance } from "fastify";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

export async function activityLogRoutes(app: FastifyInstance) {
  app.get(
    "/logs",
    { preHandler: requirePermission(PERMISSIONS.LOGS_VIEW) },
    async (request, reply) => {
      const auth = request.auth!;
      const q = request.query as {
        action?: string;
        userId?: string;
        from?: string;
        to?: string;
        page?: string;
      };

      const page  = Math.max(1, Number(q.page ?? 1));
      const limit = 50;
      const skip  = (page - 1) * limit;

      const where: Record<string, unknown> = { companyId: auth.companyId };
      if (q.action)  where.action = q.action;
      if (q.userId)  where.userId = q.userId;
      if (q.from || q.to) {
        where.createdAt = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to   ? { lte: new Date(q.to)   } : {}),
        };
      }

      const [logs, total] = await tenantStorage.run({ isPlatform: true }, () =>
        Promise.all([
          prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.activityLog.count({ where }),
        ])
      );

      return reply.send({ logs, total, page, pages: Math.ceil(total / limit) });
    }
  );
}
