import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";
import { decryptCredentials } from "./credentials-crypto";

const QUEUE_NAME = "template-sync";
const JOB_NAME = "sync-all-meta-templates";
// 3h UTC = meia-noite BRT — janela de baixo tráfego
const CRON_PATTERN = "0 3 * * *";
const META_API_VERSION = "v25.0";

async function fetchMetaTemplates(wabaId: string, accessToken: string): Promise<any[]> {
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates` +
    `?fields=id,name,status,language,category,components,quality_score&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta templates fetch error (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { data: any[] };
  return data.data ?? [];
}

async function syncInstanceTemplates(instanceId: string, companyId: string): Promise<number> {
  const raw = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.whatsAppInstance.findFirst({
      where: { id: instanceId },
      select: { credentials: true },
    })
  );
  if (!raw?.credentials) return 0;

  let creds: { wabaId?: string; accessToken?: string };
  try {
    creds = decryptCredentials(raw.credentials);
  } catch {
    return 0;
  }

  if (!creds.wabaId || !creds.accessToken) return 0;

  const templates = await fetchMetaTemplates(creds.wabaId, creds.accessToken);
  const now = new Date();

  await Promise.all(
    templates.map((t: any) =>
      tenantStorage.run({ isPlatform: true }, () =>
        prisma.template.upsert({
          where: { instanceId_providerId: { instanceId, providerId: t.id } },
          create: {
            companyId,
            instanceId,
            providerId: t.id,
            name: t.name,
            language: t.language,
            category: t.category ?? "UTILITY",
            status: t.status ?? "PENDING",
            components: t.components ?? [],
            syncedAt: now,
          },
          update: {
            status: t.status ?? "PENDING",
            components: t.components ?? [],
            syncedAt: now,
          },
        })
      )
    )
  );

  return templates.length;
}

export async function scheduleTemplateSyncJob(): Promise<void> {
  const connection = getRedisConnectionOptions();
  const queue = new Queue(QUEUE_NAME, { connection });

  // Register a repeatable job (idempotent — BullMQ deduplicates by repeat key)
  await queue.add(JOB_NAME, {}, { repeat: { pattern: CRON_PATTERN }, jobId: JOB_NAME });
  console.log(`[template-sync] Job agendado: ${CRON_PATTERN} UTC`);
}

export function startTemplateSyncWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      console.log("[template-sync] Iniciando sincronização de templates...");

      const instances = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.whatsAppInstance.findMany({
          where: { providerType: "META_CLOUD_API" },
          select: { id: true, companyId: true, name: true },
        })
      );

      let total = 0;
      for (const inst of instances) {
        try {
          const count = await syncInstanceTemplates(inst.id, inst.companyId);
          console.log(`[template-sync] ${inst.name}: ${count} templates sincronizados`);
          total += count;
        } catch (err: any) {
          console.error(`[template-sync] Falha em ${inst.name}:`, err.message);
        }
      }

      console.log(`[template-sync] Concluído: ${total} templates em ${instances.length} instância(s)`);
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[template-sync] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
