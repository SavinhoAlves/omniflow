import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
  trigger: z.enum(["conversation_created", "message_received", "idle"]),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(["equals", "contains", "starts_with", "not_equals", "in"]),
    value: z.unknown(),
  })),
  actions: z.array(z.object({
    type: z.enum(["assign_department", "assign_agent", "set_priority", "add_tag", "close", "send_message"]),
    params: z.record(z.unknown()).optional().default({}),
  })),
});

const slaPolicySchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  firstResponseMin: z.number().int().min(1),
  resolutionMin: z.number().int().min(1),
});

export async function automationsRoutes(app: FastifyInstance) {
  // ── T6.1 — Automation rules CRUD ─────────────────────────────────────────────

  app.get(
    "/automations/rules",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const rules = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.automationRule.findMany({
          where: { companyId: auth.companyId },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        })
      );
      return reply.send(rules);
    }
  );

  app.post(
    "/automations/rules",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const body = ruleSchema.parse(request.body);
      const rule = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.automationRule.create({
          data: { companyId: auth.companyId, ...body },
        })
      );
      return reply.status(201).send(rule);
    }
  );

  app.put(
    "/automations/rules/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const body = ruleSchema.partial().parse(request.body);
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.automationRule.updateMany({ where: { id, companyId: auth.companyId }, data: body as any })
      );
      return reply.send({ ok: true });
    }
  );

  app.delete(
    "/automations/rules/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.automationRule.deleteMany({ where: { id, companyId: auth.companyId } })
      );
      return reply.status(204).send();
    }
  );

  // ── T6.3 — SLA policies ───────────────────────────────────────────────────────

  app.get(
    "/automations/sla",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const policies = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.slaPolicy.findMany({
          where: { companyId: auth.companyId },
          orderBy: { priority: "asc" },
        })
      );
      return reply.send(policies);
    }
  );

  app.put(
    "/automations/sla",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const body = slaPolicySchema.parse(request.body);
      const policy = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.slaPolicy.upsert({
          where: { companyId_priority: { companyId: auth.companyId, priority: body.priority } },
          create: { companyId: auth.companyId, ...body },
          update: { firstResponseMin: body.firstResponseMin, resolutionMin: body.resolutionMin },
        })
      );
      return reply.send(policy);
    }
  );
}
