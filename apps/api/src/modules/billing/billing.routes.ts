import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

// T10.1: record usage — called internally by other modules
export async function incrementUsage(
  companyId: string,
  field: "conversations" | "campaigns" | "aiCalls",
  amount = 1
) {
  const period = new Date().toISOString().slice(0, 7); // "2026-08"

  await tenantStorage.run({ isPlatform: true }, async () => {
    // Upsert the row, then increment the specific column
    await prisma.$executeRaw`
      INSERT INTO usage_meters (id, company_id, period, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${companyId}, ${period}, NOW(), NOW())
      ON CONFLICT (company_id, period) DO NOTHING
    `;

    if (field === "conversations") {
      await prisma.$executeRaw`
        UPDATE usage_meters
        SET conversations = conversations + ${amount}, updated_at = NOW()
        WHERE company_id = ${companyId} AND period = ${period}
      `;
    } else if (field === "campaigns") {
      await prisma.$executeRaw`
        UPDATE usage_meters
        SET campaigns = campaigns + ${amount}, updated_at = NOW()
        WHERE company_id = ${companyId} AND period = ${period}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE usage_meters
        SET ai_calls = ai_calls + ${amount}, updated_at = NOW()
        WHERE company_id = ${companyId} AND period = ${period}
      `;
    }
  });
}

// T10.2: check limit — returns true if within plan limits
export async function checkLimit(
  companyId: string,
  resource: "conversations" | "campaigns" | "agents" | "instances"
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const sub = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    })
  );

  if (!sub) return { allowed: true, current: 0, limit: 999999 }; // No subscription = free

  const plan = sub.plan;
  const period = new Date().toISOString().slice(0, 7);

  if (resource === "conversations") {
    const meter = await tenantStorage.run({ isPlatform: true }, () =>
      prisma.usageMeter.findUnique({ where: { companyId_period: { companyId, period } } })
    );
    const current = meter?.conversations ?? 0;
    return { allowed: current < plan.maxConversationsPerMonth, current, limit: plan.maxConversationsPerMonth };
  }

  if (resource === "campaigns") {
    const meter = await tenantStorage.run({ isPlatform: true }, () =>
      prisma.usageMeter.findUnique({ where: { companyId_period: { companyId, period } } })
    );
    const current = meter?.campaigns ?? 0;
    return { allowed: current < plan.maxCampaignsPerMonth, current, limit: plan.maxCampaignsPerMonth };
  }

  if (resource === "agents") {
    const current = await tenantStorage.run({ companyId }, () =>
      prisma.user.count({ where: { companyId, active: true } })
    );
    return { allowed: current < plan.maxAgents, current, limit: plan.maxAgents };
  }

  if (resource === "instances") {
    const current = await tenantStorage.run({ companyId }, () =>
      prisma.whatsAppInstance.count({ where: { companyId } })
    );
    return { allowed: current < plan.maxInstances, current, limit: plan.maxInstances };
  }

  return { allowed: true, current: 0, limit: 999999 };
}

export async function billingRoutes(app: FastifyInstance) {
  // T10.2: Get available plans
  app.get("/billing/plans", { config: { public: true } }, async (_request, reply) => {
    const plans = await tenantStorage.run({ isPlatform: true }, () =>
      prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } })
    );
    return reply.send(plans);
  });

  // Get current subscription
  app.get(
    "/billing/subscription",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const sub = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.subscription.findUnique({
          where: { companyId: auth.companyId },
          include: { plan: true },
        })
      );
      return reply.send(sub ?? { plan: null, status: "none" });
    }
  );

  // T10.1: Get usage for current period
  app.get(
    "/billing/usage",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const period = new Date().toISOString().slice(0, 7);

      const [meter, sub] = await Promise.all([
        tenantStorage.run({ companyId: auth.companyId }, () =>
          prisma.usageMeter.findUnique({
            where: { companyId_period: { companyId: auth.companyId, period } },
          })
        ),
        tenantStorage.run({ isPlatform: true }, () =>
          prisma.subscription.findUnique({
            where: { companyId: auth.companyId },
            include: { plan: true },
          })
        ),
      ]);

      const plan = sub?.plan;
      return reply.send({
        period,
        conversations: {
          current: meter?.conversations ?? 0,
          limit: plan?.maxConversationsPerMonth ?? 999999,
        },
        campaigns: {
          current: meter?.campaigns ?? 0,
          limit: plan?.maxCampaignsPerMonth ?? 999999,
        },
        aiCalls: {
          current: meter?.aiCalls ?? 0,
          limit: plan?.aiEnabled ? 999999 : 0,
        },
      });
    }
  );

  // T10.3: Upsert/change subscription (platform admin only in real app; here for setup)
  app.put(
    "/billing/subscription",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const body = z.object({
        planName: z.string(),
        externalId: z.string().optional(),
      }).parse(request.body);

      const plan = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.plan.findUnique({ where: { name: body.planName } })
      );
      if (!plan) return reply.status(404).send({ error: "Plano não encontrado" });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const sub = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.subscription.upsert({
          where: { companyId: auth.companyId },
          create: {
            companyId: auth.companyId,
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            externalId: body.externalId,
          },
          update: {
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            externalId: body.externalId,
          },
          include: { plan: true },
        })
      );
      return reply.send(sub);
    }
  );

  // T10.2: Check a specific limit (for frontend gating)
  app.get(
    "/billing/limits/:resource",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { resource } = request.params as { resource: string };
      const valid = ["conversations", "campaigns", "agents", "instances"] as const;
      if (!valid.includes(resource as any)) {
        return reply.status(400).send({ error: "Recurso inválido" });
      }
      const result = await checkLimit(auth.companyId, resource as typeof valid[number]);
      return reply.send(result);
    }
  );
}
