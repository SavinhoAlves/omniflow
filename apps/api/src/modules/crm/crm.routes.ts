import { FastifyInstance, FastifyReply } from "fastify";
import { z, ZodTypeAny } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { logActivity } from "../../shared/activity-logger";
import { CrmError, CrmService } from "./crm.service";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().positive(),
  price: z.number().min(0),
});

const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  value: z.number().min(0).optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  contactId: z.string().uuid().nullish(),
  conversationId: z.string().uuid().nullish(),
  ownerId: z.string().uuid().nullish(),
  expectedCloseDate: z.string().nullish(),
  source: z.string().max(200).nullish(),
  products: z.array(productSchema).optional(),
  followUpAt: z.string().nullish(),
});

const updateDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  value: z.number().min(0).optional(),
  ownerId: z.string().uuid().nullish(),
  expectedCloseDate: z.string().nullish(),
  source: z.string().max(200).nullish(),
  tags: z.array(z.string().max(50)).optional(),
  products: z.array(productSchema).optional(),
});

const activitySchema = z.object({
  type: z.enum(["NOTE", "TASK", "CALL", "MEETING", "VISIT", "WHATSAPP"]),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  dueAt: z.string().nullish(),
  assigneeId: z.string().uuid().nullish(),
});

const updateActivitySchema = z.object({
  done: z.boolean().optional(),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  dueAt: z.string().nullish(),
  assigneeId: z.string().uuid().nullish(),
});

const stageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  probability: z.number().int().min(0).max(100),
  rottenDays: z.number().int().min(1).max(365).nullish(),
});

const updatePipelineSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  stages: z.array(stageSchema).min(1).max(15).optional(),
});

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown, reply: FastifyReply): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    reply.status(400).send({ error: "Dados inválidos", issues: result.error.issues });
    return null;
  }
  return result.data;
}

export async function crmRoutes(app: FastifyInstance) {
  const service = new CrmService();
  const view = { preHandler: requirePermission(PERMISSIONS.CRM_VIEW) };
  const manage = { preHandler: requirePermission(PERMISSIONS.CRM_MANAGE) };

  // Erros de regra de negócio (404/409) viram resposta HTTP em vez de 500
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CrmError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    reply.send(error);
  });

  // ── Funis ──────────────────────────────────────────────────────────────────

  app.get("/crm/pipelines", view, async (request) => {
    return service.listPipelines(request.auth!.companyId!);
  });

  app.post("/crm/pipelines", manage, async (request, reply) => {
    const body = parseBody(z.object({ name: z.string().min(1).max(80) }), request.body, reply);
    if (!body) return;
    const pipeline = await service.createPipeline(request.auth!.companyId!, body.name);
    return reply.status(201).send(pipeline);
  });

  app.put("/crm/pipelines/:id", manage, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updatePipelineSchema, request.body, reply);
    if (!body) return;
    return service.updatePipeline(request.auth!.companyId!, id, body);
  });

  app.delete("/crm/pipelines/:id", manage, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deletePipeline(id);
    return reply.status(204).send();
  });

  app.get("/crm/lost-reasons", view, async (request) => {
    return service.listLostReasons(request.auth!.companyId!);
  });

  app.put("/crm/lost-reasons", manage, async (request, reply) => {
    const body = parseBody(z.object({ names: z.array(z.string().min(1).max(100)).min(1).max(30) }), request.body, reply);
    if (!body) return;
    return service.replaceLostReasons(request.auth!.companyId!, body.names);
  });

  app.get("/crm/members", view, async () => service.listMembers());

  // ── Negócios ───────────────────────────────────────────────────────────────

  app.get("/crm/deals", view, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return service.listDeals({
      pipelineId: q.pipelineId,
      status: q.status ? q.status.split(",").filter((s) => ["OPEN", "WON", "LOST"].includes(s)) : undefined,
      ownerId: q.ownerId,
      contactId: q.contactId,
      conversationId: q.conversationId,
      search: q.search?.trim() || undefined,
    });
  });

  app.post("/crm/deals", view, async (request, reply) => {
    const auth = request.auth!;
    const body = parseBody(createDealSchema, request.body, reply);
    if (!body) return;
    const deal = await service.createDeal(auth.companyId!, auth.userId, body);
    logActivity({
      companyId: auth.companyId!, userId: auth.userId, userName: auth.name,
      action: "deal.created", entity: "deal", entityId: deal.id, ip: request.ip,
    });
    return reply.status(201).send(deal);
  });

  app.get("/crm/deals/:id", view, async (request) => {
    const { id } = request.params as { id: string };
    return service.getDeal(id);
  });

  app.patch("/crm/deals/:id", view, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateDealSchema, request.body, reply);
    if (!body) return;
    return service.updateDeal(id, body);
  });

  app.post("/crm/deals/:id/move", view, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = parseBody(z.object({ stageId: z.string().uuid() }), request.body, reply);
    if (!body) return;
    return service.moveDeal(auth.companyId!, id, body.stageId, auth.userId);
  });

  app.post("/crm/deals/:id/won", view, async (request) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const deal = await service.markWon(auth.companyId!, id, auth.userId);
    logActivity({
      companyId: auth.companyId!, userId: auth.userId, userName: auth.name,
      action: "deal.won", entity: "deal", entityId: id, ip: request.ip,
    });
    return deal;
  });

  app.post("/crm/deals/:id/lost", view, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = parseBody(
      z.object({ reason: z.string().min(1).max(100), note: z.string().max(2000).optional() }),
      request.body,
      reply
    );
    if (!body) return;
    const deal = await service.markLost(auth.companyId!, id, auth.userId, body.reason, body.note);
    logActivity({
      companyId: auth.companyId!, userId: auth.userId, userName: auth.name,
      action: "deal.lost", entity: "deal", entityId: id, details: { reason: body.reason }, ip: request.ip,
    });
    return deal;
  });

  app.post("/crm/deals/:id/reopen", view, async (request) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    return service.reopen(auth.companyId!, id, auth.userId);
  });

  app.delete("/crm/deals/:id", view, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    await service.deleteDeal(id);
    logActivity({
      companyId: auth.companyId!, userId: auth.userId, userName: auth.name,
      action: "deal.deleted", entity: "deal", entityId: id, ip: request.ip,
    });
    return reply.status(204).send();
  });

  // ── Atividades e tarefas ───────────────────────────────────────────────────

  app.post("/crm/deals/:id/activities", view, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = parseBody(activitySchema, request.body, reply);
    if (!body) return;
    const activity = await service.addActivity(auth.companyId!, id, auth.userId, body);
    return reply.status(201).send(activity);
  });

  app.patch("/crm/activities/:id", view, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateActivitySchema, request.body, reply);
    if (!body) return;
    return service.updateActivity(id, body);
  });

  app.delete("/crm/activities/:id", view, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteActivity(id);
    return reply.status(204).send();
  });

  app.get("/crm/tasks", view, async (request) => {
    const { scope } = request.query as { scope?: string };
    return service.listTasks(request.auth!.userId, scope === "team" ? "team" : "mine");
  });

  app.get("/crm/tasks/overdue-count", view, async (request) => {
    return { count: await service.countOverdueTasks(request.auth!.userId) };
  });

  // ── Visão comercial ───────────────────────────────────────────────────────

  app.get("/crm/overview", view, async (request) => {
    const { month, pipelineId } = request.query as { month?: string; pipelineId?: string };
    return service.overview(request.auth!.companyId!, {
      month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
      pipelineId,
    });
  });
}
