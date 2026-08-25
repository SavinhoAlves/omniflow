import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";

const QUEUE_NAME = "automation-engine";
const AUTO_CLOSE_JOB = "check-idle-conversations";
const SLA_JOB = "check-sla-breaches";
// Every 15 minutes — idle check + SLA check
const CRON_PATTERN = "*/15 * * * *";

// ── T6.1: Execute automation rules ──────────────────────────────────────────

interface AutomationContext {
  conversationId: string;
  companyId: string;
  contactId?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  departmentId?: string | null;
  trigger: string;
  lastMessageText?: string;
}

function evaluateConditions(conditions: any[], ctx: AutomationContext): boolean {
  if (!conditions.length) return true;
  return conditions.every((cond) => {
    const fieldValue = (ctx as any)[cond.field];
    switch (cond.operator) {
      case "equals":      return fieldValue === cond.value;
      case "not_equals":  return fieldValue !== cond.value;
      case "contains":    return typeof fieldValue === "string" && fieldValue.includes(cond.value);
      case "starts_with": return typeof fieldValue === "string" && fieldValue.startsWith(cond.value);
      case "in":          return Array.isArray(cond.value) && cond.value.includes(fieldValue);
      default:            return false;
    }
  });
}

async function executeActions(actions: any[], ctx: AutomationContext) {
  for (const action of actions) {
    try {
      switch (action.type) {
        case "assign_department":
          await prisma.conversation.updateMany({
            where: { id: ctx.conversationId },
            data: { departmentId: action.params.departmentId },
          });
          break;
        case "assign_agent":
          await prisma.conversation.updateMany({
            where: { id: ctx.conversationId },
            data: { assignedToId: action.params.agentId },
          });
          break;
        case "set_priority":
          await prisma.conversation.updateMany({
            where: { id: ctx.conversationId },
            data: { priority: action.params.priority },
          });
          break;
        case "add_tag":
          await prisma.$executeRaw`
            UPDATE conversations
            SET tags = array_append(tags, ${action.params.tag}::text)
            WHERE id = ${ctx.conversationId}
              AND NOT (${action.params.tag}::text = ANY(tags))
          `;
          break;
        case "close":
          await prisma.conversation.updateMany({
            where: { id: ctx.conversationId },
            data: { status: "RESOLVED" },
          });
          break;
      }
    } catch (err: any) {
      console.error(`[automation] Ação ${action.type} falhou para conv ${ctx.conversationId}:`, err.message);
    }
  }
}

export async function runAutomationRules(ctx: AutomationContext) {
  const rules = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.automationRule.findMany({
      where: { companyId: ctx.companyId, enabled: true, trigger: ctx.trigger },
      orderBy: [{ priority: "asc" }],
    })
  );

  for (const rule of rules) {
    const conditions = (rule.conditions as any[]) ?? [];
    const actions = (rule.actions as any[]) ?? [];
    if (evaluateConditions(conditions, ctx)) {
      await tenantStorage.run({ isPlatform: true }, () => executeActions(actions, ctx));
      console.log(`[automation] Regra "${rule.name}" executada para conv ${ctx.conversationId.slice(0, 8)}`);
    }
  }
}

// ── T6.2: Auto-close idle conversations ─────────────────────────────────────

async function checkIdleConversations() {
  const companies = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.company.findMany({
      where: {
        automationRules: {
          some: { trigger: "idle", enabled: true },
        },
      },
      select: { id: true, automationRules: {
        where: { trigger: "idle", enabled: true },
        select: { id: true, conditions: true, actions: true, name: true },
      }},
    })
  );

  for (const company of companies) {
    for (const rule of company.automationRules) {
      const conditions = (rule.conditions as any[]) ?? [];
      // Extract idle threshold from conditions (field: "idleMinutes", operator: "gte")
      const idleCond = conditions.find((c) => c.field === "idleMinutes");
      if (!idleCond) continue;

      const idleMs = Number(idleCond.value) * 60 * 1000;
      const cutoff = new Date(Date.now() - idleMs);

      const idleConvs = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.conversation.findMany({
          where: {
            companyId: company.id,
            status: "OPEN",
            lastMessageAt: { lt: cutoff },
          },
          select: { id: true, companyId: true, priority: true, tags: true, departmentId: true },
          take: 50,
        })
      );

      for (const conv of idleConvs) {
        const ctx: AutomationContext = {
          conversationId: conv.id,
          companyId: conv.companyId,
          priority: conv.priority,
          tags: conv.tags,
          departmentId: conv.departmentId,
          trigger: "idle",
        };
        await tenantStorage.run({ isPlatform: true }, () => executeActions(rule.actions as any[], ctx));
        console.log(`[auto-close] Conv ${conv.id.slice(0, 8)} — regra "${rule.name}" executada`);
      }
    }
  }
}

// ── T6.3: SLA breach detection ───────────────────────────────────────────────

async function checkSlaBreaches() {
  const now = new Date();

  const policies = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.slaPolicy.findMany({
      select: { companyId: true, priority: true, firstResponseMin: true, resolutionMin: true },
    })
  );

  for (const policy of policies) {
    const firstResponseCutoff = new Date(now.getTime() - policy.firstResponseMin * 60 * 1000);

    // Conversations that never had a first response within SLA
    await tenantStorage.run({ isPlatform: true }, () =>
      prisma.conversation.updateMany({
        where: {
          companyId: policy.companyId,
          priority: policy.priority,
          status: "OPEN",
          firstResponseAt: null,
          slaBreachedAt: null,
          createdAt: { lt: firstResponseCutoff },
        },
        data: { slaBreachedAt: now },
      })
    );
  }
}

// ── Scheduled worker ─────────────────────────────────────────────────────────

export async function scheduleAutomationJobs(): Promise<void> {
  const connection = getRedisConnectionOptions();
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add(AUTO_CLOSE_JOB, {}, { repeat: { pattern: CRON_PATTERN }, jobId: AUTO_CLOSE_JOB });
  await queue.add(SLA_JOB, {}, { repeat: { pattern: CRON_PATTERN }, jobId: SLA_JOB });
  console.log(`[automation-engine] Jobs agendados: ${CRON_PATTERN}`);
}

export function startAutomationWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === AUTO_CLOSE_JOB) {
        await checkIdleConversations();
      } else if (job.name === SLA_JOB) {
        await checkSlaBreaches();
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[automation-engine] Job ${job?.name} falhou:`, err.message);
  });

  return worker;
}
