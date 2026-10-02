import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

const audienceFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
  segment: z.enum(["all", "opted_in"]).optional().default("opted_in"),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  instanceId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  audienceFilter: audienceFilterSchema.optional().default({}),
  templateParams: z.record(z.string().max(500)).optional().default({}),
  messageText: z.string().max(4000).optional(),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * Garante que a campanha tem o que enviar no canal escolhido: a Meta só aceita
 * template aprovado da própria instância; os demais canais aceitam texto livre
 * (ou o corpo de um template). Retorna a mensagem de erro, ou null se ok.
 */
async function contentError(companyId: string, input: { instanceId: string; templateId?: string | null; messageText?: string | null }) {
  return tenantStorage.run({ companyId }, async () => {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: input.instanceId, companyId },
      select: { providerType: true },
    });
    if (!instance) return "Canal não encontrado";
    const template = input.templateId
      ? await prisma.template.findFirst({ where: { id: input.templateId, companyId }, select: { instanceId: true, status: true, name: true } })
      : null;
    if (input.templateId && !template) return "Template não encontrado";
    if (template && template.instanceId !== input.instanceId) return "O template escolhido pertence a outro canal";
    if (instance.providerType === "META_CLOUD_API") {
      if (!template) return "No WhatsApp oficial a campanha precisa de um template aprovado";
      if (template.status !== "APPROVED") return `O template "${template.name}" não está aprovado pela Meta`;
      return null;
    }
    if (!input.messageText?.trim() && !template) return "Escreva a mensagem da campanha";
    return null;
  });
}

/**
 * Filtro de público usado na prévia e no disparo — os dois precisam bater.
 * Contatos com opt-out nunca entram, em nenhum segmento (LGPD): o opt-out
 * não limpa consentGivenAt, então só o filtro de consentimento não basta.
 */
function audienceWhere(companyId: string, filter: z.infer<typeof audienceFilterSchema> | Record<string, any>) {
  const where: any = { companyId, anonymizedAt: null, optOut: false };
  if (filter.segment === "opted_in" || !filter.segment) {
    where.consentGivenAt = { not: null };
  }
  if (filter.tags?.length) where.tags = { hasSome: filter.tags };
  if (filter.contactIds?.length) where.id = { in: filter.contactIds };
  return where;
}

export async function campaignsRoutes(app: FastifyInstance) {
  // T7.1: Campaign CRUD + audience preview

  app.get(
    "/campaigns",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { status } = request.query as { status?: string };

      const campaigns = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.findMany({
          where: {
            companyId: auth.companyId,
            ...(status ? { status } : {}),
          },
          include: {
            template: { select: { id: true, name: true, language: true } },
            instance: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      );
      return reply.send(campaigns);
    }
  );

  app.get(
    "/campaigns/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      const campaign = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.findFirst({
          where: { id, companyId: auth.companyId },
          include: {
            template: true,
            instance: { select: { id: true, name: true, providerType: true } },
            createdBy: { select: { id: true, name: true } },
          },
        })
      );
      if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada" });
      return reply.send(campaign);
    }
  );

  app.post(
    "/campaigns",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos", issues: parsed.error.issues });
      const body = parsed.data;

      const invalid = await contentError(auth.companyId, body);
      if (invalid) return reply.status(400).send({ error: invalid });

      const campaign = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.create({
          data: {
            companyId: auth.companyId,
            instanceId: body.instanceId,
            createdById: auth.userId,
            name: body.name,
            templateId: body.templateId,
            audienceFilter: body.audienceFilter as any,
            templateParams: body.templateParams as any,
            messageText: body.messageText?.trim() || null,
            scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
          },
        })
      );
      return reply.status(201).send(campaign);
    }
  );

  app.put(
    "/campaigns/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const body = createSchema.partial().parse(request.body);

      // Only DRAFT campaigns can be edited
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.updateMany({
          where: { id, companyId: auth.companyId, status: "DRAFT" },
          data: {
            ...(body.name ? { name: body.name } : {}),
            ...(body.templateId !== undefined ? { templateId: body.templateId } : {}),
            ...(body.audienceFilter ? { audienceFilter: body.audienceFilter as any } : {}),
            ...(body.templateParams ? { templateParams: body.templateParams as any } : {}),
            ...(body.messageText !== undefined ? { messageText: body.messageText.trim() || null } : {}),
            ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
          },
        })
      );
      return reply.send({ ok: true });
    }
  );

  app.delete(
    "/campaigns/:id",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.deleteMany({ where: { id, companyId: auth.companyId, status: { in: ["DRAFT", "CANCELLED"] } } })
      );
      return reply.status(204).send();
    }
  );

  // T7.1: Audience preview — count matching contacts without starting campaign
  app.post(
    "/campaigns/audience-preview",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const body = audienceFilterSchema.parse(request.body);

      const where = audienceWhere(auth.companyId, body);

      const count = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.contact.count({ where })
      );
      return reply.send({ count });
    }
  );

  // T7.2: Launch campaign — resolve audience and enqueue broadcast
  app.post(
    "/campaigns/:id/launch",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      const campaign = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.findFirst({
          where: { id, companyId: auth.companyId, status: { in: ["DRAFT", "SCHEDULED"] } },
          include: { instance: { select: { id: true, providerType: true } } },
        })
      );
      if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada ou não está em DRAFT" });

      const invalid = await contentError(auth.companyId, campaign);
      if (invalid) return reply.status(400).send({ error: invalid });

      // Resolve audience
      const where = audienceWhere(auth.companyId, (campaign.audienceFilter ?? {}) as any);

      const contacts = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.contact.findMany({
          where,
          select: { id: true, phoneNumber: true },
          take: 100_000,
        })
      );

      if (contacts.length === 0) {
        return reply.status(400).send({ error: "Audiência vazia — nenhum contato elegível" });
      }

      // Insert recipients and update campaign counters
      await tenantStorage.run({ isPlatform: true }, async () => {
        await prisma.$executeRaw`
          INSERT INTO campaign_recipients (id, campaign_id, contact_id, phone, status, created_at)
          SELECT gen_random_uuid()::text, ${campaign.id}, c.id, c.phone_number, 'PENDING', NOW()
          FROM contacts c
          WHERE c.id = ANY(${contacts.map((c) => c.id)}::text[])
          ON CONFLICT (campaign_id, contact_id) DO NOTHING
        `;
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "RUNNING", startedAt: new Date(), totalCount: contacts.length },
        });
      });

      // Enqueue broadcast job
      const { Queue } = await import("bullmq");
      const broadcastQueue = new Queue("campaign-broadcast", {
        connection: { host: process.env.REDIS_HOST ?? "127.0.0.1", port: Number(process.env.REDIS_PORT ?? 6379) },
      });
      await broadcastQueue.add("broadcast", { campaignId: campaign.id }, { jobId: `broadcast-${campaign.id}` });

      return reply.send({ ok: true, recipients: contacts.length });
    }
  );

  // T7.3: Campaign analytics
  app.get(
    "/campaigns/:id/analytics",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      const campaign = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.findFirst({
          where: { id, companyId: auth.companyId },
          select: {
            id: true, name: true, status: true,
            totalCount: true, sentCount: true, deliveredCount: true,
            readCount: true, failedCount: true,
            startedAt: true, completedAt: true,
          },
        })
      );
      if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada" });

      const deliveryRate = campaign.totalCount > 0
        ? Math.round((campaign.deliveredCount / campaign.totalCount) * 100)
        : 0;
      const readRate = campaign.totalCount > 0
        ? Math.round((campaign.readCount / campaign.totalCount) * 100)
        : 0;

      return reply.send({ ...campaign, deliveryRate, readRate });
    }
  );

  // Cancel a running/scheduled campaign
  app.post(
    "/campaigns/:id/cancel",
    { preHandler: requirePermission(PERMISSIONS.WHATSAPP_MANAGE_INSTANCES) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.campaign.updateMany({
          where: { id, companyId: auth.companyId, status: { in: ["DRAFT", "SCHEDULED", "RUNNING", "PAUSED"] } },
          data: { status: "CANCELLED" },
        })
      );
      return reply.send({ ok: true });
    }
  );
}
