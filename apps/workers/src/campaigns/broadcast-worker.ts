import { Queue, Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";

const QUEUE_NAME = "campaign-broadcast";
// Throttle: max messages per second to avoid Meta rate-limit (80 msg/s per WABA)
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

async function buildTemplateText(
  components: any[],
  params: Record<string, string>
): Promise<string> {
  const body = components.find((c: any) => c.type === "BODY");
  if (!body?.text) return "";
  return body.text.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => params[n] ?? `{{${n}}}`);
}

async function processBroadcast(campaignId: string) {
  const campaign = await tenantStorage.run({ isPlatform: true }, () =>
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        instance: { select: { id: true, providerType: true, companyId: true } },
      },
    })
  );

  if (!campaign || campaign.status !== "RUNNING") return;

  const companyId = campaign.companyId;
  const params = (campaign.templateParams ?? {}) as Record<string, string>;

  let cursor: string | undefined;

  while (true) {
    const recipients = await tenantStorage.run({ isPlatform: true }, () =>
      prisma.campaignRecipient.findMany({
        where: { campaignId, status: "PENDING" },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "asc" },
        select: { id: true, phone: true, contactId: true },
      })
    );

    if (recipients.length === 0) break;

    const outboundQueue = new Queue("phone-outbound", { connection: getRedisConnectionOptions() });
    const content = campaign.template
      ? await buildTemplateText((campaign.template.components as any[]) ?? [], params)
      : "";

    for (const recipient of recipients) {
      try {
        await outboundQueue.add("send-campaign-message", {
          companyId,
          instanceId: campaign.instanceId,
          phone: recipient.phone,
          content,
          templateName: campaign.template?.name,
          templateLanguage: campaign.template?.language,
          templateParams: params,
          campaignId,
          recipientId: recipient.id,
        });

        await tenantStorage.run({ isPlatform: true }, () =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id },
            data: { status: "SENT", sentAt: new Date() },
          })
        );

        await tenantStorage.run({ isPlatform: true }, () =>
          prisma.$executeRaw`
            UPDATE campaigns
            SET sent_count = sent_count + 1, updated_at = NOW()
            WHERE id = ${campaignId}
          `
        );
      } catch (err: any) {
        await tenantStorage.run({ isPlatform: true }, () =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id },
            data: { status: "FAILED", errorMessage: err.message },
          })
        );
        await tenantStorage.run({ isPlatform: true }, () =>
          prisma.$executeRaw`
            UPDATE campaigns
            SET failed_count = failed_count + 1, updated_at = NOW()
            WHERE id = ${campaignId}
          `
        );
      }
    }

    cursor = recipients[recipients.length - 1].id;

    // Throttle between batches
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  // Mark campaign as completed
  await tenantStorage.run({ isPlatform: true }, () =>
    prisma.campaign.updateMany({
      where: { id: campaignId, status: "RUNNING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
  );

  console.log(`[broadcast] Campanha ${campaignId.slice(0, 8)} concluída`);
}

export function startBroadcastWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { campaignId } = job.data;
      if (!campaignId) return;
      await processBroadcast(campaignId);
    },
    { connection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[broadcast] Job ${job?.id} falhou:`, err.message);
  });

  return worker;
}
