import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { ReportsService } from "./reports.service";

const periodSchema = z
  .enum(["today", "7d", "30d", "90d"])
  .default("7d");

export async function reportsRoutes(app: FastifyInstance) {
  const service = new ReportsService();
  const guard = { preHandler: requirePermission(PERMISSIONS.REPORTS_VIEW) };

  app.get("/reports/overview", guard, async (request, reply) => {
    const { period } = request.query as { period?: string };
    const data = await service.getOverview(periodSchema.parse(period ?? "7d"));
    return reply.send(data);
  });

  app.get("/reports/volume", guard, async (request, reply) => {
    const { period } = request.query as { period?: string };
    const data = await service.getVolume(periodSchema.parse(period ?? "7d"));
    return reply.send(data);
  });

  app.get("/reports/agents", guard, async (request, reply) => {
    const { period } = request.query as { period?: string };
    const data = await service.getAgents(periodSchema.parse(period ?? "7d"));
    return reply.send(data);
  });

  app.get("/reports/departments", guard, async (request, reply) => {
    const { period } = request.query as { period?: string };
    const data = await service.getDepartments(periodSchema.parse(period ?? "7d"));
    return reply.send(data);
  });
}
