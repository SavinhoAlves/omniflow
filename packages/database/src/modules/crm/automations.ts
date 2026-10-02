// packages/database/src/modules/crm/automations.ts
//
// Automações do funil de vendas. Ficam no pacote compartilhado porque os
// gatilhos acontecem nos dois processos: o bot direciona conversas no worker,
// enquanto envio de mensagens/documentos e mudanças de etapa passam pela API.
//
// Todas as funções recebem companyId explícito e rodam dentro do contexto de
// tenant dessa empresa — funcionam tanto numa request autenticada quanto num
// job do worker (que roda com isPlatform).
//
// Mensagens automáticas não são enviadas daqui: viram ScheduledMessage, e o
// scheduled-message-worker cuida da entrega (canal, opt-out, janela de 24h).

import { prisma, tenantStorage } from "../../client";

export interface PipelineAutomations {
  /** Cria o negócio quando a conversa é direcionada a um destes departamentos */
  createOnDepartment?: { enabled: boolean; departmentIds: string[] };
  /** Move o negócio quando um documento com a palavra-chave é enviado na conversa */
  proposalDocument?: { enabled: boolean; keyword: string; stageId: string | null };
  /** Negócio sem responsável fica com quem responde primeiro na conversa */
  assignFirstResponder?: { enabled: boolean };
  /** Envia pesquisa de satisfação quando o negócio é ganho */
  csatOnWon?: { enabled: boolean; message: string };
}

export type StageAction =
  | { type: "create_task"; taskType: string; title: string; dueInHours: number }
  | { type: "send_message"; text: string; delayMinutes: number };

export const DEFAULT_CSAT_MESSAGE =
  "Olá, {{nome}}! Obrigado pela confiança. De 1 a 5, como você avalia o nosso atendimento? Responda só com o número.";

const CSAT_REPLY_WINDOW_MS = 72 * 60 * 60 * 1000;
const TASK_TYPES = new Set(["TASK", "CALL", "MEETING", "VISIT", "WHATSAPP"]);

// ── Leitura defensiva do JSON salvo ─────────────────────────────────────────

export function readAutomations(json: unknown): PipelineAutomations {
  const raw = (json && typeof json === "object" ? json : {}) as Record<string, any>;
  const out: PipelineAutomations = {};
  if (raw.createOnDepartment) {
    out.createOnDepartment = {
      enabled: !!raw.createOnDepartment.enabled,
      departmentIds: Array.isArray(raw.createOnDepartment.departmentIds)
        ? raw.createOnDepartment.departmentIds.filter((x: unknown) => typeof x === "string")
        : [],
    };
  }
  if (raw.proposalDocument) {
    out.proposalDocument = {
      enabled: !!raw.proposalDocument.enabled,
      keyword: typeof raw.proposalDocument.keyword === "string" ? raw.proposalDocument.keyword : "proposta",
      stageId: typeof raw.proposalDocument.stageId === "string" ? raw.proposalDocument.stageId : null,
    };
  }
  if (raw.assignFirstResponder) {
    out.assignFirstResponder = { enabled: !!raw.assignFirstResponder.enabled };
  }
  if (raw.csatOnWon) {
    out.csatOnWon = {
      enabled: !!raw.csatOnWon.enabled,
      message: typeof raw.csatOnWon.message === "string" && raw.csatOnWon.message.trim()
        ? raw.csatOnWon.message
        : DEFAULT_CSAT_MESSAGE,
    };
  }
  return out;
}

export function readStageActions(json: unknown): StageAction[] {
  if (!Array.isArray(json)) return [];
  const actions: StageAction[] = [];
  for (const a of json) {
    if (a?.type === "create_task" && typeof a.title === "string" && a.title.trim()) {
      actions.push({
        type: "create_task",
        taskType: TASK_TYPES.has(a.taskType) ? a.taskType : "TASK",
        title: a.title.trim(),
        dueInHours: Math.max(0, Math.min(24 * 90, Number(a.dueInHours) || 0)),
      });
    } else if (a?.type === "send_message" && typeof a.text === "string" && a.text.trim()) {
      actions.push({
        type: "send_message",
        text: a.text.trim(),
        delayMinutes: Math.max(0, Math.min(60 * 24 * 30, Number(a.delayMinutes) || 0)),
      });
    }
  }
  return actions;
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function withTenant<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId }, fn);
}

/** Erros de automação nunca derrubam o fluxo principal (envio de mensagem, bot, etc.) */
export async function runAutomation(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    console.error(`[crm-automation] ${label} falhou:`, err?.message ?? err);
  }
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function render(text: string, vars: { nome: string; negocio: string }) {
  return text.replace(/\{\{\s*nome\s*\}\}/gi, vars.nome).replace(/\{\{\s*negocio\s*\}\}/gi, vars.negocio);
}

async function logAutomation(
  companyId: string,
  dealId: string,
  title: string,
  meta: Record<string, unknown> = {},
  content?: string,
  userId: string | null = null
) {
  await prisma.dealActivity.create({
    data: {
      companyId,
      dealId,
      type: "SYSTEM",
      title,
      content: content ?? null,
      userId,
      meta: { kind: "automation", ...meta } as any,
    },
  });
}

/** ScheduledMessage exige um autor; usa quem disparou a ação ou o dono da empresa */
async function authorFor(companyId: string, preferred?: string | null) {
  if (preferred) return preferred;
  const user = await prisma.user.findFirst({
    where: { companyId, active: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }], // OWNER vem primeiro no enum
    select: { id: true },
  });
  return user?.id ?? null;
}

async function scheduleMessage(
  companyId: string,
  conversationId: string,
  content: string,
  createdById: string,
  delayMinutes = 0
) {
  return prisma.scheduledMessage.create({
    data: {
      companyId,
      conversationId,
      createdById,
      content,
      scheduledAt: new Date(Date.now() + delayMinutes * 60_000),
    },
  });
}

/** Mensagem automática avulsa (ex.: agradecimento da pesquisa) entregue pelo worker em qualquer canal */
export function scheduleAutomationMessage(input: { companyId: string; conversationId: string; text: string }) {
  const { companyId, conversationId, text } = input;
  return withTenant(companyId, async () => {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      select: { assignedToId: true },
    });
    const author = await authorFor(companyId, conv?.assignedToId);
    if (!author) return null;
    return scheduleMessage(companyId, conversationId, text, author);
  });
}

// ── Etapas ───────────────────────────────────────────────────────────────────

/** Executa as ações configuradas em "Ao entrar na etapa" */
export function runStageEntry(input: { companyId: string; dealId: string; stageId: string; actorUserId?: string | null }) {
  const { companyId, dealId, stageId, actorUserId } = input;
  return withTenant(companyId, async () => {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, companyId },
      select: { name: true, onEnter: true },
    });
    const actions = readStageActions(stage?.onEnter);
    if (!stage || !actions.length) return;

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, companyId },
      select: {
        id: true, title: true, ownerId: true, conversationId: true,
        contact: { select: { name: true, phoneNumber: true, optOut: true } },
      },
    });
    if (!deal) return;

    for (const action of actions) {
      if (action.type === "create_task") {
        await prisma.dealActivity.create({
          data: {
            companyId,
            dealId,
            type: action.taskType,
            title: action.title,
            dueAt: new Date(Date.now() + action.dueInHours * 3_600_000),
            assigneeId: deal.ownerId ?? actorUserId ?? null,
            meta: { kind: "automation", source: "stage", stage: stage.name } as any,
          },
        });
        continue;
      }

      // send_message
      if (!deal.conversationId) {
        await logAutomation(companyId, dealId, "Mensagem automática não enviada", { stage: stage.name },
          "O negócio não está ligado a uma conversa.");
        continue;
      }
      if (deal.contact?.optOut) {
        await logAutomation(companyId, dealId, "Mensagem automática não enviada", { stage: stage.name },
          "O contato pediu para não receber mensagens automáticas (opt-out).");
        continue;
      }
      const author = await authorFor(companyId, actorUserId ?? deal.ownerId);
      if (!author) continue;
      const text = render(action.text, {
        nome: deal.contact?.name || deal.contact?.phoneNumber || "",
        negocio: deal.title,
      });
      await scheduleMessage(companyId, deal.conversationId, text, author, action.delayMinutes);
      await logAutomation(
        companyId, dealId,
        action.delayMinutes ? `Mensagem automática agendada (em ${action.delayMinutes} min)` : "Mensagem automática na fila de envio",
        { stage: stage.name }, text
      );
    }
  });
}

/**
 * Move o negócio de etapa, registra na linha do tempo e dispara as automações
 * da etapa de destino (e a pesquisa de satisfação, se for a etapa de ganho).
 * Retorna false quando não houve mudança.
 */
export function moveDealToStage(input: {
  companyId: string;
  dealId: string;
  stageId: string;
  actorUserId?: string | null;
  /** Preenchido quando quem move é uma automação; vira o texto da atividade */
  reason?: string;
}) {
  const { companyId, dealId, stageId, actorUserId, reason } = input;
  return withTenant(companyId, async () => {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, companyId },
      include: { stage: true },
    });
    if (!deal) throw Object.assign(new Error("Negócio não encontrado"), { statusCode: 404 });
    const target = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: deal.pipelineId, companyId },
    });
    if (!target) throw Object.assign(new Error("Etapa inválida para este funil"), { statusCode: 400 });
    if (target.id === deal.stageId && deal.status === "OPEN") return false;

    const becameWon = target.isWon && deal.status !== "WON";
    await prisma.deal.updateMany({
      where: { id: dealId, companyId },
      data: {
        stageId: target.id,
        stageChangedAt: new Date(),
        status: target.isWon ? "WON" : "OPEN",
        wonAt: target.isWon ? (deal.wonAt ?? new Date()) : null,
        lostAt: null,
        lostReason: null,
        lostNote: null,
      },
    });
    await prisma.dealActivity.create({
      data: {
        companyId,
        dealId,
        type: "SYSTEM",
        title: `${reason ? "Etapa alterada automaticamente" : "Etapa alterada"}: ${deal.stage.name} → ${target.name}`,
        content: reason ?? null,
        userId: reason ? null : actorUserId ?? null,
        meta: { kind: reason ? "automation" : "stage_change", from: deal.stage.name, to: target.name } as any,
      },
    });

    await runAutomation("ações da etapa", () => runStageEntry({ companyId, dealId, stageId: target.id, actorUserId }));
    if (becameWon) await runAutomation("pesquisa de satisfação", () => onDealWon({ companyId, dealId, actorUserId }));
    return true;
  });
}

// ── Gatilhos ─────────────────────────────────────────────────────────────────

/** Pesquisa de satisfação ao ganhar o negócio */
export function onDealWon(input: { companyId: string; dealId: string; actorUserId?: string | null }) {
  const { companyId, dealId, actorUserId } = input;
  return withTenant(companyId, async () => {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, companyId },
      select: {
        id: true, title: true, ownerId: true, conversationId: true,
        pipeline: { select: { automations: true } },
        contact: { select: { name: true, phoneNumber: true, optOut: true } },
      },
    });
    if (!deal) return;
    const cfg = readAutomations(deal.pipeline.automations).csatOnWon;
    if (!cfg?.enabled) return;

    if (!deal.conversationId) {
      await logAutomation(companyId, dealId, "Pesquisa de satisfação não enviada", {}, "O negócio não está ligado a uma conversa.");
      return;
    }
    if (deal.contact?.optOut) {
      await logAutomation(companyId, dealId, "Pesquisa de satisfação não enviada", {}, "O contato pediu para não receber mensagens automáticas (opt-out).");
      return;
    }
    const author = await authorFor(companyId, actorUserId ?? deal.ownerId);
    if (!author) return;
    const text = render(cfg.message, {
      nome: deal.contact?.name || deal.contact?.phoneNumber || "",
      negocio: deal.title,
    });
    await scheduleMessage(companyId, deal.conversationId, text, author);
    await prisma.conversation.updateMany({
      where: { id: deal.conversationId, companyId },
      data: { csatRequestedAt: new Date() },
    });
    await logAutomation(companyId, dealId, "Pesquisa de satisfação na fila de envio", {}, text);
  });
}

/** Conversa direcionada a um departamento (pelo bot ou por transferência) */
export function onConversationDepartmentChanged(input: {
  companyId: string;
  conversationId: string;
  departmentId: string | null | undefined;
  actorUserId?: string | null;
}) {
  const { companyId, conversationId, departmentId, actorUserId } = input;
  if (!departmentId) return Promise.resolve();
  return withTenant(companyId, async () => {
    const pipelines = await prisma.pipeline.findMany({
      where: { companyId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { stages: { orderBy: { position: "asc" } } },
    });
    const pipeline = pipelines.find((p) => {
      const cfg = readAutomations(p.automations).createOnDepartment;
      return cfg?.enabled && cfg.departmentIds.includes(departmentId);
    });
    if (!pipeline) return;

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      select: {
        id: true, contactId: true, assignedToId: true,
        contact: { select: { name: true, phoneNumber: true } },
        department: { select: { name: true } },
        instance: { select: { providerType: true } },
      },
    });
    if (!conv) return;

    // Um negócio em aberto por conversa — e por contato dentro do mesmo funil
    const existing = await prisma.deal.findFirst({
      where: {
        companyId,
        status: "OPEN",
        OR: [{ conversationId }, { contactId: conv.contactId, pipelineId: pipeline.id }],
      },
      select: { id: true },
    });
    if (existing) return;

    const stage = pipeline.stages.find((s) => !s.isWon);
    if (!stage) return;
    const contactName = conv.contact.name || conv.contact.phoneNumber;
    const departmentName = conv.department?.name ?? "atendimento";

    const deal = await prisma.deal.create({
      data: {
        companyId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        contactId: conv.contactId,
        conversationId,
        ownerId: conv.assignedToId ?? null,
        title: `${contactName} — ${departmentName}`,
        source: `Atendimento — ${departmentName}`,
      },
    });
    await logAutomation(companyId, deal.id, "Negócio criado automaticamente", { trigger: "department" },
      `A conversa foi direcionada ao departamento ${departmentName}.`);
    await runAutomation("ações da etapa inicial", () =>
      runStageEntry({ companyId, dealId: deal.id, stageId: stage.id, actorUserId }));
  });
}

/** Atendente respondeu na conversa: negócios sem responsável ficam com ele */
export function onAgentReply(input: { companyId: string; conversationId: string; userId: string }) {
  const { companyId, conversationId, userId } = input;
  return withTenant(companyId, async () => {
    const deals = await prisma.deal.findMany({
      where: { companyId, conversationId, status: "OPEN", ownerId: null },
      select: { id: true, pipeline: { select: { automations: true } } },
    });
    const eligible = deals.filter((d) => readAutomations(d.pipeline.automations).assignFirstResponder?.enabled);
    if (!eligible.length) return;

    const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { name: true } });
    for (const d of eligible) {
      // updateMany com ownerId: null evita sobrescrever se duas respostas chegarem juntas
      const res = await prisma.deal.updateMany({ where: { id: d.id, companyId, ownerId: null }, data: { ownerId: userId } });
      if (!res.count) continue;
      await prisma.dealActivity.updateMany({
        where: { dealId: d.id, companyId, assigneeId: null, dueAt: { not: null }, doneAt: null },
        data: { assigneeId: userId },
      });
      await logAutomation(companyId, d.id, "Responsável definido automaticamente", { trigger: "first_reply" },
        `${user?.name ?? "Um atendente"} respondeu primeiro na conversa.`);
    }
  });
}

/** Documento enviado na conversa: se o nome tiver a palavra-chave, avança o negócio */
export function onOutboundDocument(input: { companyId: string; conversationId: string; filename: string; userId?: string | null }) {
  const { companyId, conversationId, filename, userId } = input;
  return withTenant(companyId, async () => {
    const deals = await prisma.deal.findMany({
      where: { companyId, conversationId, status: "OPEN" },
      select: {
        id: true,
        stage: { select: { position: true } },
        pipeline: { select: { automations: true, stages: { orderBy: { position: "asc" } } } },
      },
    });
    for (const d of deals) {
      const cfg = readAutomations(d.pipeline.automations).proposalDocument;
      if (!cfg?.enabled) continue;
      const keyword = normalize(cfg.keyword.trim() || "proposta");
      if (!normalize(filename).includes(keyword)) continue;
      const target = cfg.stageId
        ? d.pipeline.stages.find((s) => s.id === cfg.stageId)
        : d.pipeline.stages.find((s) => normalize(s.name).includes("proposta"));
      // Só avança: nunca devolve um negócio para uma etapa anterior
      if (!target || target.position <= d.stage.position) continue;
      await moveDealToStage({
        companyId,
        dealId: d.id,
        stageId: target.id,
        actorUserId: userId,
        reason: `Documento "${filename}" enviado na conversa.`,
      });
    }
  });
}

/**
 * Resposta do contato a uma pesquisa de satisfação pendente. Retorna a nota
 * quando a mensagem foi consumida como avaliação (o bot não deve rodar).
 */
export function handleCsatReply(input: { companyId: string; contactId: string; instanceId: string; text?: string | null }) {
  const { companyId, contactId, instanceId, text } = input;
  const match = (text ?? "").trim().match(/^(?:nota\s*)?([1-5])(?:\s*(?:estrelas?|\/\s*5))?[.!]?$/i);
  if (!match) return Promise.resolve(null);
  const score = Number(match[1]);
  return withTenant(companyId, async () => {
    const conv = await prisma.conversation.findFirst({
      where: {
        companyId, contactId, instanceId,
        csatRequestedAt: { gte: new Date(Date.now() - CSAT_REPLY_WINDOW_MS) },
      },
      orderBy: { csatRequestedAt: "desc" },
      select: { id: true },
    });
    if (!conv) return null;
    await prisma.conversation.updateMany({
      where: { id: conv.id, companyId },
      data: { csatScore: score, csatRequestedAt: null },
    });
    const deals = await prisma.deal.findMany({ where: { companyId, conversationId: conv.id }, select: { id: true } });
    for (const d of deals) {
      await logAutomation(companyId, d.id, `Avaliação recebida: ${score}/5`, { trigger: "csat", score });
    }
    return { conversationId: conv.id, score };
  });
}
