import { prisma } from "@omnichannel/database";

// Funil criado automaticamente na primeira vez que a empresa abre o CRM —
// assim o módulo funciona sem precisar rodar seed por tenant.
const DEFAULT_STAGES = [
  { name: "Novo lead",        color: "#a1a1aa", probability: 10,  rottenDays: 2 },
  { name: "Qualificação",     color: "#60a5fa", probability: 25,  rottenDays: 5 },
  { name: "Proposta enviada", color: "#a78bfa", probability: 50,  rottenDays: 7 },
  { name: "Negociação",       color: "#fbbf24", probability: 70,  rottenDays: 7 },
  { name: "Fechado — ganho",  color: "#34d399", probability: 100, rottenDays: null, isWon: true },
];

const DEFAULT_LOST_REASONS = [
  "Preço acima do orçamento",
  "Fechou com concorrente",
  "Financiamento negado",
  "Inviável tecnicamente",
  "Parou de responder",
];

export const TASK_TYPES = ["TASK", "CALL", "MEETING", "VISIT", "WHATSAPP"] as const;

export class CrmError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const dealListInclude = {
  contact: { select: { id: true, name: true, phoneNumber: true } },
  owner: { select: { id: true, name: true } },
  conversation: {
    select: { id: true, unreadCount: true, status: true, instance: { select: { providerType: true } } },
  },
  activities: {
    where: { dueAt: { not: null }, doneAt: null },
    orderBy: { dueAt: "asc" as const },
    take: 1,
    select: { id: true, type: true, title: true, dueAt: true },
  },
};

function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function serializeDeal(deal: any) {
  const { activities, value, ...rest } = deal;
  return {
    ...rest,
    value: toNumber(value),
    channel: deal.conversation?.instance?.providerType ?? null,
    nextTask: activities?.[0] ?? null,
  };
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

// A primeira tela do CRM dispara várias requisições em paralelo; sem isso
// cada uma criaria o seu próprio funil padrão.
const defaultsInFlight = new Map<string, Promise<void>>();

export class CrmService {
  // ── Funis e etapas ─────────────────────────────────────────────────────────

  async ensureDefaults(companyId: string) {
    let pending = defaultsInFlight.get(companyId);
    if (!pending) {
      pending = this.createDefaults(companyId).finally(() => defaultsInFlight.delete(companyId));
      defaultsInFlight.set(companyId, pending);
    }
    return pending;
  }

  private async createDefaults(companyId: string) {
    const count = await prisma.pipeline.count();
    if (count > 0) return;

    const pipeline = await prisma.pipeline.create({
      data: { companyId, name: "Vendas", isDefault: true, position: 0 },
    });
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({
        companyId,
        pipelineId: pipeline.id,
        name: s.name,
        color: s.color,
        probability: s.probability,
        rottenDays: s.rottenDays,
        isWon: !!s.isWon,
        position: i,
      })),
    });
    if ((await prisma.lostReason.count()) === 0) {
      await prisma.lostReason.createMany({
        data: DEFAULT_LOST_REASONS.map((name, i) => ({ companyId, name, position: i })),
      });
    }
  }

  async listPipelines(companyId: string) {
    await this.ensureDefaults(companyId);
    return prisma.pipeline.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        stages: { orderBy: { position: "asc" } },
        _count: { select: { deals: true } },
      },
    });
  }

  async createPipeline(companyId: string, name: string) {
    const position = await prisma.pipeline.count();
    const pipeline = await prisma.pipeline.create({ data: { companyId, name, position } });
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({
        companyId,
        pipelineId: pipeline.id,
        name: s.name,
        color: s.color,
        probability: s.probability,
        rottenDays: s.rottenDays,
        isWon: !!s.isWon,
        position: i,
      })),
    });
    return pipeline;
  }

  /**
   * Sincroniza as etapas: atualiza as que vieram com id, cria as novas e
   * remove as que sumiram (só se não tiverem negócios). A etapa de ganho é
   * fixa — sempre a última, e não pode ser removida.
   */
  async updatePipeline(
    companyId: string,
    id: string,
    data: {
      name?: string;
      color?: string;
      stages?: { id?: string; name: string; color: string; probability: number; rottenDays?: number | null }[];
    }
  ) {
    const pipeline = await prisma.pipeline.findFirst({ where: { id }, include: { stages: true } });
    if (!pipeline) throw new CrmError(404, "Funil não encontrado");

    if (data.name !== undefined || data.color !== undefined) {
      await prisma.pipeline.updateMany({ where: { id }, data: { name: data.name, color: data.color } });
    }

    if (data.stages) {
      const wonStage = pipeline.stages.find((s) => s.isWon);
      const incoming = data.stages.filter((s) => !s.id || s.id !== wonStage?.id);
      const keepIds = new Set(incoming.filter((s) => s.id).map((s) => s.id!));

      const removed = pipeline.stages.filter((s) => !s.isWon && !keepIds.has(s.id));
      for (const stage of removed) {
        const deals = await prisma.deal.count({ where: { stageId: stage.id } });
        if (deals > 0) {
          throw new CrmError(409, `A etapa "${stage.name}" tem ${deals} negócio(s). Mova-os antes de removê-la.`);
        }
      }
      if (removed.length) {
        await prisma.pipelineStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
      }

      for (const [i, s] of incoming.entries()) {
        const fields = {
          name: s.name,
          color: s.color,
          probability: Math.max(0, Math.min(100, s.probability)),
          rottenDays: s.rottenDays ?? null,
          position: i,
        };
        if (s.id && pipeline.stages.some((p) => p.id === s.id)) {
          await prisma.pipelineStage.updateMany({ where: { id: s.id }, data: fields });
        } else {
          await prisma.pipelineStage.create({ data: { ...fields, companyId, pipelineId: id } });
        }
      }
      if (wonStage) {
        await prisma.pipelineStage.updateMany({ where: { id: wonStage.id }, data: { position: incoming.length } });
      }
    }

    return prisma.pipeline.findFirst({ where: { id }, include: { stages: { orderBy: { position: "asc" } } } });
  }

  async deletePipeline(id: string) {
    const total = await prisma.pipeline.count();
    if (total <= 1) throw new CrmError(409, "A empresa precisa de pelo menos um funil.");
    const deals = await prisma.deal.count({ where: { pipelineId: id } });
    if (deals > 0) throw new CrmError(409, `Este funil tem ${deals} negócio(s). Mova-os antes de excluí-lo.`);
    await prisma.pipeline.deleteMany({ where: { id } });
  }

  // ── Motivos de perda ───────────────────────────────────────────────────────

  async listLostReasons(companyId: string) {
    await this.ensureDefaults(companyId);
    return prisma.lostReason.findMany({ orderBy: { position: "asc" } });
  }

  async replaceLostReasons(companyId: string, names: string[]) {
    await prisma.lostReason.deleteMany({});
    await prisma.lostReason.createMany({
      data: names.map((name, i) => ({ companyId, name, position: i })),
    });
    return this.listLostReasons(companyId);
  }

  async listMembers() {
    return prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // ── Negócios ───────────────────────────────────────────────────────────────

  async listDeals(filters: {
    pipelineId?: string;
    status?: string[];
    ownerId?: string;
    contactId?: string;
    conversationId?: string;
    search?: string;
  }) {
    const where: any = {};
    if (filters.pipelineId) where.pipelineId = filters.pipelineId;
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.conversationId) where.conversationId = filters.conversationId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { contact: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    const deals = await prisma.deal.findMany({
      where,
      include: { ...dealListInclude, stage: { select: { id: true, name: true, color: true, probability: true, isWon: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });
    return deals.map(serializeDeal);
  }

  async getDeal(id: string) {
    const deal = await prisma.deal.findFirst({
      where: { id },
      include: {
        ...dealListInclude,
        stage: true,
        pipeline: { include: { stages: { orderBy: { position: "asc" } } } },
        contact: {
          select: {
            id: true, name: true, phoneNumber: true, notes: true, optOut: true,
            consentGivenAt: true, consentSource: true,
          },
        },
        conversation: {
          select: {
            id: true, status: true, unreadCount: true, csatScore: true,
            instance: { select: { providerType: true, name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!deal) throw new CrmError(404, "Negócio não encontrado");

    const activities = await prisma.dealActivity.findMany({
      where: { dealId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return { ...serializeDeal(deal), activities };
  }

  async createDeal(
    companyId: string,
    userId: string,
    data: {
      title: string;
      value?: number;
      pipelineId?: string;
      stageId?: string;
      contactId?: string | null;
      conversationId?: string | null;
      ownerId?: string | null;
      expectedCloseDate?: string | null;
      source?: string | null;
      products?: { name: string; qty: number; price: number }[];
      followUpAt?: string | null;
    }
  ) {
    await this.ensureDefaults(companyId);

    const pipeline = data.pipelineId
      ? await prisma.pipeline.findFirst({ where: { id: data.pipelineId }, include: { stages: { orderBy: { position: "asc" } } } })
      : await prisma.pipeline.findFirst({
          orderBy: [{ isDefault: "desc" }, { position: "asc" }],
          include: { stages: { orderBy: { position: "asc" } } },
        });
    if (!pipeline) throw new CrmError(404, "Funil não encontrado");

    const stage = data.stageId ? pipeline.stages.find((s) => s.id === data.stageId) : pipeline.stages[0];
    if (!stage) throw new CrmError(400, "Etapa inválida para este funil");

    // Negócio criado a partir de uma conversa herda o contato dela
    let contactId = data.contactId ?? null;
    if (data.conversationId && !contactId) {
      const conv = await prisma.conversation.findFirst({ where: { id: data.conversationId }, select: { contactId: true } });
      contactId = conv?.contactId ?? null;
    }

    const products = data.products ?? [];
    const value = data.value ?? products.reduce((sum, p) => sum + p.qty * p.price, 0);
    const won = stage.isWon;

    const deal = await prisma.deal.create({
      data: {
        companyId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        contactId,
        conversationId: data.conversationId ?? null,
        ownerId: data.ownerId ?? userId,
        title: data.title,
        value,
        source: data.source ?? null,
        products,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        status: won ? "WON" : "OPEN",
        wonAt: won ? new Date() : null,
      },
    });

    await this.log(companyId, deal.id, userId, "SYSTEM", "Negócio criado", { kind: "created", stage: stage.name });

    if (data.followUpAt) {
      await prisma.dealActivity.create({
        data: {
          companyId,
          dealId: deal.id,
          type: "WHATSAPP",
          title: "Responder orçamento",
          dueAt: new Date(data.followUpAt),
          userId,
          assigneeId: deal.ownerId,
        },
      });
    }

    return deal;
  }

  async updateDeal(
    id: string,
    data: {
      title?: string;
      value?: number;
      ownerId?: string | null;
      expectedCloseDate?: string | null;
      source?: string | null;
      tags?: string[];
      products?: { name: string; qty: number; price: number }[];
    }
  ) {
    const patch: any = { ...data };
    if (data.expectedCloseDate !== undefined) {
      patch.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
    }
    const result = await prisma.deal.updateMany({ where: { id }, data: patch });
    if (result.count === 0) throw new CrmError(404, "Negócio não encontrado");
    return this.getDeal(id);
  }

  async moveDeal(companyId: string, id: string, stageId: string, userId: string) {
    const deal = await prisma.deal.findFirst({ where: { id }, include: { stage: true } });
    if (!deal) throw new CrmError(404, "Negócio não encontrado");
    const target = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: deal.pipelineId } });
    if (!target) throw new CrmError(400, "Etapa inválida para este funil");
    if (target.id === deal.stageId) return this.getDeal(id);

    await prisma.deal.updateMany({
      where: { id },
      data: {
        stageId: target.id,
        stageChangedAt: new Date(),
        status: target.isWon ? "WON" : "OPEN",
        wonAt: target.isWon ? new Date() : null,
        lostAt: null,
        lostReason: null,
        lostNote: null,
      },
    });
    await this.log(companyId, id, userId, "SYSTEM", `Etapa alterada: ${deal.stage.name} → ${target.name}`, {
      kind: "stage_change", from: deal.stage.name, to: target.name,
    });
    return this.getDeal(id);
  }

  async markWon(companyId: string, id: string, userId: string) {
    const deal = await prisma.deal.findFirst({ where: { id } });
    if (!deal) throw new CrmError(404, "Negócio não encontrado");
    const wonStage = await prisma.pipelineStage.findFirst({ where: { pipelineId: deal.pipelineId, isWon: true } });
    if (!wonStage) throw new CrmError(409, "Este funil não tem etapa de ganho");
    return this.moveDeal(companyId, id, wonStage.id, userId);
  }

  async markLost(companyId: string, id: string, userId: string, reason: string, note?: string) {
    const result = await prisma.deal.updateMany({
      where: { id },
      data: { status: "LOST", lostAt: new Date(), lostReason: reason, lostNote: note ?? null, wonAt: null },
    });
    if (result.count === 0) throw new CrmError(404, "Negócio não encontrado");
    await this.log(companyId, id, userId, "SYSTEM", `Negócio perdido: ${reason}`, { kind: "lost", reason }, note);
    return this.getDeal(id);
  }

  async reopen(companyId: string, id: string, userId: string) {
    const deal = await prisma.deal.findFirst({ where: { id }, include: { stage: true } });
    if (!deal) throw new CrmError(404, "Negócio não encontrado");
    let stageId = deal.stageId;
    if (deal.stage.isWon) {
      const last = await prisma.pipelineStage.findFirst({
        where: { pipelineId: deal.pipelineId, isWon: false },
        orderBy: { position: "desc" },
      });
      if (last) stageId = last.id;
    }
    await prisma.deal.updateMany({
      where: { id },
      data: { status: "OPEN", stageId, wonAt: null, lostAt: null, lostReason: null, lostNote: null },
    });
    await this.log(companyId, id, userId, "SYSTEM", "Negócio reaberto", { kind: "reopened" });
    return this.getDeal(id);
  }

  async deleteDeal(id: string) {
    const result = await prisma.deal.deleteMany({ where: { id } });
    if (result.count === 0) throw new CrmError(404, "Negócio não encontrado");
  }

  // ── Atividades e tarefas ───────────────────────────────────────────────────

  private async log(
    companyId: string, dealId: string, userId: string | null,
    type: string, title: string, meta: Record<string, unknown> = {}, content?: string
  ) {
    await prisma.dealActivity.create({
      data: { companyId, dealId, type, title, content: content ?? null, userId, meta: meta as any },
    });
  }

  async addActivity(
    companyId: string,
    dealId: string,
    userId: string,
    data: { type: string; title?: string; content?: string; dueAt?: string | null; assigneeId?: string | null }
  ) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId }, select: { id: true, ownerId: true } });
    if (!deal) throw new CrmError(404, "Negócio não encontrado");
    const isTask = !!data.dueAt;
    const activity = await prisma.dealActivity.create({
      data: {
        companyId,
        dealId,
        type: data.type,
        title: data.title ?? null,
        content: data.content ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        // Registros sem prazo (nota, ligação feita) já nascem concluídos
        doneAt: isTask ? null : new Date(),
        userId,
        assigneeId: isTask ? data.assigneeId ?? deal.ownerId ?? userId : null,
      },
      include: {
        user: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    // Mantém o negócio no topo das listas ordenadas por atividade recente
    await prisma.deal.updateMany({ where: { id: dealId }, data: { updatedAt: new Date() } });
    return activity;
  }

  async updateActivity(
    id: string,
    data: { done?: boolean; title?: string; content?: string; dueAt?: string | null; assigneeId?: string | null }
  ) {
    const patch: any = {};
    if (data.done !== undefined) patch.doneAt = data.done ? new Date() : null;
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.dueAt !== undefined) patch.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.assigneeId !== undefined) patch.assigneeId = data.assigneeId;
    const result = await prisma.dealActivity.updateMany({ where: { id }, data: patch });
    if (result.count === 0) throw new CrmError(404, "Atividade não encontrada");
    return prisma.dealActivity.findFirst({ where: { id } });
  }

  async deleteActivity(id: string) {
    await prisma.dealActivity.deleteMany({ where: { id } });
  }

  async listTasks(userId: string, scope: "mine" | "team") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const where: any = {
      dueAt: { not: null },
      deal: { status: { not: "LOST" } },
      OR: [{ doneAt: null }, { doneAt: { gte: todayStart } }],
    };
    if (scope === "mine") where.assigneeId = userId;
    return prisma.dealActivity.findMany({
      where,
      orderBy: { dueAt: "asc" },
      take: 300,
      include: {
        assignee: { select: { id: true, name: true } },
        deal: {
          select: {
            id: true, title: true, conversationId: true,
            contact: { select: { id: true, name: true, phoneNumber: true } },
          },
        },
      },
    });
  }

  async countOverdueTasks(userId: string) {
    return prisma.dealActivity.count({
      where: { assigneeId: userId, doneAt: null, dueAt: { lt: new Date() }, deal: { status: "OPEN" } },
    });
  }

  // ── Visão comercial ───────────────────────────────────────────────────────

  async overview(companyId: string, opts: { month?: string; pipelineId?: string }) {
    await this.ensureDefaults(companyId);

    const now = new Date();
    const [y, m] = opts.month
      ? opts.month.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const monthStart = startOfMonth(y, m - 1);
    const monthEnd = startOfMonth(y, m);
    const prevStart = startOfMonth(y, m - 2);
    const seriesStart = startOfMonth(y, m - 6);
    const seriesEnd = startOfMonth(y, m + 2);

    const pipeline = opts.pipelineId
      ? await prisma.pipeline.findFirst({ where: { id: opts.pipelineId }, include: { stages: { orderBy: { position: "asc" } } } })
      : await prisma.pipeline.findFirst({
          orderBy: [{ isDefault: "desc" }, { position: "asc" }],
          include: { stages: { orderBy: { position: "asc" } } },
        });
    const pipelineFilter = pipeline ? { pipelineId: pipeline.id } : {};

    const [closed, openDeals, createdInMonth, wonSeries, members, convs] = await Promise.all([
      prisma.deal.findMany({
        where: {
          ...pipelineFilter,
          OR: [
            { status: "WON", wonAt: { gte: prevStart, lt: monthEnd } },
            { status: "LOST", lostAt: { gte: monthStart, lt: monthEnd } },
          ],
        },
        select: { status: true, value: true, wonAt: true, createdAt: true, ownerId: true },
      }),
      prisma.deal.findMany({
        where: { ...pipelineFilter, status: "OPEN" },
        select: {
          id: true, title: true, value: true, stageId: true, expectedCloseDate: true, ownerId: true,
          stage: { select: { probability: true } },
          owner: { select: { name: true } },
          activities: { where: { dueAt: { not: null }, doneAt: null }, select: { id: true }, take: 1 },
        },
      }),
      prisma.deal.findMany({
        where: { ...pipelineFilter, createdAt: { gte: monthStart, lt: monthEnd } },
        select: { source: true },
      }),
      prisma.deal.findMany({
        where: { ...pipelineFilter, status: "WON", wonAt: { gte: seriesStart, lt: seriesEnd } },
        select: { value: true, wonAt: true },
      }),
      this.listMembers(),
      prisma.conversation.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd }, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        take: 2000,
      }),
    ]);

    const inMonth = (d: Date | null) => !!d && d >= monthStart && d < monthEnd;
    const wonMonth = closed.filter((d) => d.status === "WON" && inMonth(d.wonAt));
    const wonPrev = closed.filter((d) => d.status === "WON" && d.wonAt && d.wonAt < monthStart);
    const lostMonth = closed.filter((d) => d.status === "LOST");
    const sum = (list: { value: unknown }[]) => list.reduce((a, d) => a + toNumber(d.value), 0);

    const wonValue = sum(wonMonth);
    const prevWonValue = sum(wonPrev);
    const openValue = sum(openDeals);
    const weighted = openDeals.reduce((a, d) => a + toNumber(d.value) * d.stage.probability / 100, 0);
    const closedCount = wonMonth.length + lostMonth.length;
    const cycleDays = wonMonth.length
      ? wonMonth.reduce((a, d) => a + (d.wonAt!.getTime() - d.createdAt.getTime()) / 86400000, 0) / wonMonth.length
      : null;
    const firstResponseMin = convs.length
      ? convs.reduce((a, c) => a + (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000, 0) / convs.length
      : null;

    // Receita ganha nos 6 últimos meses + previsão ponderada (data prevista) até 2 meses à frente
    const series: { key: string; won: number; forecast: number }[] = [];
    for (let i = -5; i <= 2; i++) {
      const start = startOfMonth(y, m - 1 + i);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      series.push({ key, won: 0, forecast: 0 });
    }
    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const d of wonSeries) {
      const s = series.find((x) => x.key === keyOf(d.wonAt!));
      if (s) s.won += toNumber(d.value);
    }
    const currentKey = keyOf(monthStart);
    for (const d of openDeals) {
      // Sem data prevista, ou já vencida → entra no mês corrente
      const due = d.expectedCloseDate && d.expectedCloseDate >= monthStart ? d.expectedCloseDate : monthStart;
      const s = series.find((x) => x.key === keyOf(due));
      if (s) s.forecast += toNumber(d.value) * d.stage.probability / 100;
    }

    const stages = (pipeline?.stages ?? []).map((st) => {
      const deals = st.isWon ? wonMonth : openDeals.filter((d) => d.stageId === st.id);
      return { id: st.id, name: st.name, color: st.color, isWon: st.isWon, count: deals.length, value: sum(deals) };
    });

    const sources = new Map<string, number>();
    for (const d of createdInMonth) {
      const key = d.source || "Sem origem";
      sources.set(key, (sources.get(key) ?? 0) + 1);
    }

    const owners = members
      .map((u) => {
        const won = wonMonth.filter((d) => d.ownerId === u.id);
        const lost = lostMonth.filter((d) => d.ownerId === u.id).length;
        const open = openDeals.filter((d) => d.ownerId === u.id);
        return {
          id: u.id,
          name: u.name,
          wonCount: won.length,
          wonValue: sum(won),
          openCount: open.length,
          openValue: sum(open),
          winRate: won.length + lost ? won.length / (won.length + lost) : null,
        };
      })
      .filter((o) => o.wonCount || o.openCount)
      .sort((a, b) => b.wonValue - a.wonValue || b.openValue - a.openValue);

    const overdue = await prisma.dealActivity.findMany({
      where: { doneAt: null, dueAt: { lt: now }, deal: { status: "OPEN", ...pipelineFilter } },
      orderBy: { dueAt: "asc" },
      take: 6,
      select: {
        id: true, title: true, type: true, dueAt: true,
        assignee: { select: { name: true } },
        deal: { select: { id: true, title: true } },
      },
    });
    const idle = openDeals
      .filter((d) => d.activities.length === 0)
      .sort((a, b) => toNumber(b.value) - toNumber(a.value))
      .slice(0, 4)
      .map((d) => ({ id: d.id, title: d.title, value: toNumber(d.value), owner: d.owner?.name ?? null }));

    return {
      month: currentKey,
      pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
      kpis: {
        wonValue,
        prevWonValue,
        wonCount: wonMonth.length,
        openValue,
        openCount: openDeals.length,
        weighted,
        winRate: closedCount ? wonMonth.length / closedCount : null,
        avgTicket: wonMonth.length ? wonValue / wonMonth.length : null,
        cycleDays,
        firstResponseMin,
      },
      series,
      stages,
      sources: [...sources.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      owners,
      overdue,
      idle,
    };
  }
}
