// loadEnvFile DEVE ser a primeira coisa — Prisma lê DATABASE_URL
// de process.env quando o módulo é importado. Com ESM, imports
// estáticos são hoisted, então precisamos de imports dinâmicos
// para garantir que o env seja carregado antes.
try { process.loadEnvFile(); } catch {}

async function bootstrap() {
  const { startBaileysWorker } = await import("./whatsapp/baileys-worker");
  const { startIncomingMessageProcessor } = await import("./conversations/incoming-message-processor");
  const { startBeginConversationProcessor } = await import("./conversations/begin-conversation-processor");
  const { startMessageStatusProcessor } = await import("./conversations/message-status-processor");
  const { startPhoneOutboundProcessor } = await import("./conversations/phone-outbound-processor");
  const { prisma, tenantStorage } = await import("@omnichannel/database");
  const { sessionManager } = await import("./whatsapp/session-manager");

  const { scheduleTemplateSyncJob, startTemplateSyncWorker } = await import("./whatsapp/template-sync-job");
  const { scheduleRetentionJob, startRetentionWorker } = await import("./compliance/retention-job");
  const { scheduleAutomationJobs, startAutomationWorker } = await import("./automations/automation-engine");
  const { scheduleMessageJobs, startScheduledMessageWorker } = await import("./conversations/scheduled-message-worker");
  const { startBroadcastWorker } = await import("./campaigns/broadcast-worker");

  const baileysWorker = startBaileysWorker();
  const incomingProcessor = startIncomingMessageProcessor();
  const beginConvProcessor = startBeginConversationProcessor();
  const statusProcessor = startMessageStatusProcessor();
  const phoneOutboundProcessor = startPhoneOutboundProcessor();
  const templateSyncWorker = startTemplateSyncWorker();
  const retentionWorker = startRetentionWorker();
  const automationWorker = startAutomationWorker();
  const scheduledMessageWorker = startScheduledMessageWorker();
  const broadcastWorker = startBroadcastWorker();

  // Agenda job diário de sync de templates (cron 0 3 * * *)
  await scheduleTemplateSyncJob();
  // Agenda job diário de retenção de dados LGPD (cron 0 2 * * *)
  await scheduleRetentionJob();
  // Agenda jobs de automação (idle + SLA) a cada 15 min
  await scheduleAutomationJobs();
  // Agenda job de mensagens agendadas a cada 1 min
  await scheduleMessageJobs();

  console.log("Workers iniciados: Baileys + IncomingMessageProcessor + PhoneOutboundProcessor + MessageStatusProcessor + TemplateSyncJob + RetentionJob + AutomationEngine + ScheduledMessages");

  // Reconecta automaticamente todas as instâncias Baileys que estavam CONNECTED
  // quando o processo morreu. As sessões ficam em memória — sem isso, cada restart
  // do worker exigiria reconexão manual via UI.
  tenantStorage.run({ isPlatform: true }, async () => {
    try {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { providerType: "BAILEYS", connectionStatus: "CONNECTED" },
        select: { id: true, name: true },
      });

      if (instances.length === 0) {
        console.log("[auto-reconnect] Nenhuma instância Baileys para reconectar.");
        return;
      }

      console.log(`[auto-reconnect] Reconectando ${instances.length} instância(s)...`);

      await Promise.all(
        instances.map(async (inst) => {
          try {
            const result = await sessionManager.connect(inst.id);
            console.log(`[auto-reconnect] ${inst.name} → ${result.status}`);
          } catch (err: any) {
            console.error(`[auto-reconnect] Falha ao reconectar ${inst.name}:`, err.message);
          }
        })
      );
    } catch (err: any) {
      console.error("[auto-reconnect] Erro ao buscar instâncias:", err.message);
    }
  });

  const shutdown = async () => {
    console.log("Encerrando workers...");
    await Promise.all([baileysWorker.close(), incomingProcessor.close(), beginConvProcessor.close(), statusProcessor.close(), phoneOutboundProcessor.close(), templateSyncWorker.close(), retentionWorker.close(), automationWorker.close(), scheduledMessageWorker.close(), broadcastWorker.close()]);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Impede crash por promises Baileys não capturadas (ex: close code 1006)
process.on("unhandledRejection", (reason) => {
  console.error("[workers] unhandledRejection (não fatal):", reason);
});

bootstrap().catch((err) => {
  console.error("Worker bootstrap falhou:", err);
  process.exit(1);
});
