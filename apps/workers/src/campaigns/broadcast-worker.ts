import { Worker, Job } from "bullmq";
import { prisma, tenantStorage } from "@omnichannel/database";
import { getRedisConnectionOptions } from "../queues/queue-names";
import { sendTemplateViaChannel, sendTextViaChannel } from "../whatsapp/channel-sender";

const QUEUE_NAME = "campaign-broadcast";
// Throttle: max messages per second to avoid Meta rate-limit (80 msg/s per WABA)
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

// Todas as queries rodam com `await` dentro do contexto: a query do Prisma só
// executa no await, e tabelas tenant-scoped (Contact) recusam acesso fora dele.
const db = <T>(fn: () => Promise<T>) => tenantStorage.run({ isPlatform: true }, async () => await fn());

/** {{nome}} → nome do contato (vale no texto livre e nos parâmetros do template) */
function withContactName(text: string, name: string) {
  return text.replace(/\{\{\s*nome\s*\}\}/gi, name);
}

function templateBodyText(components: unknown): string {
  const list = Array.isArray(components) ? components : [];
  const body = list.find((c: any) => String(c?.type).toUpperCase() === "BODY");
  return typeof body?.text === "string" ? body.text : "";
}

/** Quantidade de variáveis {{1}}, {{2}}… no corpo do template */
function bodyParamCount(bodyText: string) {
  const nums = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

async function bump(campaignId: string, column: "sent_count" | "failed_count") {
  await db(() =>
    column === "sent_count"
      ? prisma.$executeRaw`UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = ${campaignId}`
      : prisma.$executeRaw`UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = ${campaignId}`
  );
}

/** Falha que impede qualquer envio (ex.: sem template): encerra a campanha explicando o motivo */
async function failCampaign(campaignId: string, reason: string) {
  const res = await db(() =>
    prisma.campaignRecipient.updateMany({
      where: { campaignId, status: "PENDING" },
      data: { status: "FAILED", errorMessage: reason },
    })
  );
  await db(() =>
    prisma.campaign.updateMany({
      where: { id: campaignId, status: "RUNNING" },
      data: { status: "COMPLETED", completedAt: new Date(), failedCount: { increment: res.count } },
    })
  );
  console.warn(`[broadcast] Campanha ${campaignId.slice(0, 8)} não enviada: ${reason}`);
}

async function processBroadcast(campaignId: string) {
  const campaign = await db(() =>
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        instance: { select: { id: true, providerType: true } },
      },
    })
  );

  if (!campaign || campaign.status !== "RUNNING") return;

  const params = (campaign.templateParams ?? {}) as Record<string, string>;
  const isMeta = campaign.instance.providerType === "META_CLOUD_API";
  const bodyText = campaign.template ? templateBodyText(campaign.template.components) : "";
  const paramCount = bodyParamCount(bodyText);
  const paramsFor = (name: string) =>
    Array.from({ length: paramCount }, (_, i) => withContactName(params[String(i + 1)] ?? "", name));

  // Meta só aceita mensagem proativa por template aprovado; os demais canais
  // enviam texto livre (ou o corpo do template com as variáveis preenchidas).
  let freeText = "";
  if (isMeta) {
    if (!campaign.template) return failCampaign(campaignId, "Campanha sem template — o WhatsApp oficial só permite template aprovado");
    if (campaign.template.status !== "APPROVED") {
      return failCampaign(campaignId, `Template "${campaign.template.name}" não está aprovado (${campaign.template.status})`);
    }
  } else {
    freeText = campaign.messageText?.trim() || "";
    if (!freeText && bodyText) {
      freeText = bodyText.replace(/\{\{(\d+)\}\}/g, (_m, n: string) => params[n] ?? `{{${n}}}`);
    }
    if (!freeText) return failCampaign(campaignId, "Campanha sem mensagem");
  }

  let lastId: string | undefined;

  while (true) {
    // Cancelada no meio do disparo: para sem marcar como concluída
    const current = await db(() => prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } }));
    if (current?.status !== "RUNNING") {
      console.log(`[broadcast] Campanha ${campaignId.slice(0, 8)} interrompida (${current?.status}).`);
      return;
    }

    // Paginação por id: o status muda a cada envio, então cursor+skip pularia destinatários
    const recipients = await db(() =>
      prisma.campaignRecipient.findMany({
        where: { campaignId, status: "PENDING", ...(lastId ? { id: { gt: lastId } } : {}) },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        select: { id: true, phone: true, contactId: true },
      })
    );
    if (recipients.length === 0) break;
    lastId = recipients[recipients.length - 1].id;

    // Revalida no momento do envio: o contato pode ter pedido opt-out (ou sido
    // anonimizado) depois que a campanha foi disparada.
    const contacts = await db(() =>
      prisma.contact.findMany({
        where: { id: { in: recipients.map((r) => r.contactId) } },
        select: { id: true, name: true, optOut: true, anonymizedAt: true },
      })
    );
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    for (const recipient of recipients) {
      const contact = contactById.get(recipient.contactId);
      if (!contact || contact.optOut || contact.anonymizedAt) {
        await db(() =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id },
            data: {
              status: "SKIPPED",
              errorMessage: contact?.optOut
                ? "Contato pediu para não receber mensagens (opt-out)"
                : "Contato anonimizado ou removido (LGPD)",
            },
          })
        );
        continue;
      }

      const name = contact.name || "";
      const target = { instanceId: campaign.instance.id, providerType: campaign.instance.providerType, to: recipient.phone };
      try {
        const providerMessageId = isMeta
          ? await sendTemplateViaChannel(target, {
              name: campaign.template!.name,
              language: campaign.template!.language,
              bodyParams: paramsFor(name),
            })
          : await sendTextViaChannel(target, withContactName(freeText, name));

        await db(() =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id },
            data: { status: "SENT", sentAt: new Date(), messageId: providerMessageId, errorMessage: null },
          })
        );
        await bump(campaignId, "sent_count");
      } catch (err: any) {
        await db(() =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id },
            data: { status: "FAILED", errorMessage: String(err?.message ?? err).slice(0, 500) },
          })
        );
        await bump(campaignId, "failed_count");
      }
    }

    // Throttle between batches
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  // Mark campaign as completed
  await db(() =>
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
