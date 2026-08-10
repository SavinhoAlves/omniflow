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

  const baileysWorker = startBaileysWorker();
  const incomingProcessor = startIncomingMessageProcessor();
  const beginConvProcessor = startBeginConversationProcessor();
  const statusProcessor = startMessageStatusProcessor();
  const phoneOutboundProcessor = startPhoneOutboundProcessor();

  console.log("Workers iniciados: Baileys + IncomingMessageProcessor + PhoneOutboundProcessor + MessageStatusProcessor");

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
    await Promise.all([baileysWorker.close(), incomingProcessor.close(), beginConvProcessor.close(), statusProcessor.close(), phoneOutboundProcessor.close()]);
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
