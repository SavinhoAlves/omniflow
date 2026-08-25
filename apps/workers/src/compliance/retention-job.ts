import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";

const QUEUE_NAME = "retention-enforcement";
const JOB_NAME = "enforce-data-retention";
const CRON_PATTERN = "0 2 * * *"; // 2h UTC daily

const ANONYMIZED_NAME = "[DADOS REMOVIDOS]";
const ANONYMIZED_PHONE = "00000000000";

export async function scheduleRetentionJob(): Promise<void> {
  const connection = getRedisConnectionOptions();
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add(JOB_NAME, {}, { repeat: { pattern: CRON_PATTERN }, jobId: JOB_NAME });
  console.log(`[retention-job] Agendado: ${CRON_PATTERN} UTC`);
}

export function startRetentionWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      console.log("[retention-job] Iniciando enforcement de retenção de dados...");

      const companies = await tenantStorage.run({ isPlatform: true }, () =>
        prisma.company.findMany({
          where: { retentionDays: { not: null } },
          select: { id: true, name: true, retentionDays: true },
        })
      );

      let totalAnonymized = 0;

      for (const company of companies) {
        if (!company.retentionDays) continue;
        const cutoff = new Date(Date.now() - company.retentionDays * 24 * 60 * 60 * 1000);

        try {
          const staleContacts = await tenantStorage.run({ isPlatform: true }, () =>
            prisma.conversation.findMany({
              where: {
                companyId: company.id,
                status: "RESOLVED",
                updatedAt: { lt: cutoff },
              },
              select: { contactId: true },
              distinct: ["contactId"],
              take: 200,
            })
          );

          for (const { contactId } of staleContacts) {
            await tenantStorage.run({ isPlatform: true }, async () => {
              const contact = await prisma.contact.findFirst({
                where: { id: contactId, anonymizedAt: null },
                select: { id: true },
              });
              if (!contact) return;

              await prisma.contact.updateMany({
                where: { id: contactId },
                data: {
                  name: ANONYMIZED_NAME,
                  phoneNumber: `${ANONYMIZED_PHONE}_${contactId.slice(0, 8)}`,
                  avatarUrl: null,
                  notes: null,
                  anonymizedAt: new Date(),
                },
              });

              await prisma.consentLog.create({
                data: {
                  companyId: company.id,
                  contactId,
                  event: "OPT_OUT",
                  source: "retention_policy",
                },
              });
            });
            totalAnonymized++;
          }

          console.log(
            `[retention-job] ${company.name}: ${staleContacts.length} contato(s) anonimizado(s)`
          );
        } catch (err: any) {
          console.error(`[retention-job] Erro em ${company.name}:`, err.message);
        }
      }

      console.log(`[retention-job] Concluído: ${totalAnonymized} contato(s) anonimizado(s) em ${companies.length} empresa(s)`);
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[retention-job] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
