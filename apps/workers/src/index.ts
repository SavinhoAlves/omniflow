// loadEnvFile DEVE ser a primeira coisa — Prisma lê DATABASE_URL
// de process.env quando o módulo é importado. Com ESM, imports
// estáticos são hoisted, então precisamos de imports dinâmicos
// para garantir que o env seja carregado antes.
try { process.loadEnvFile(); } catch {}

async function bootstrap() {
  const { startBaileysWorker } = await import("./whatsapp/baileys-worker");
  const { startIncomingMessageProcessor } = await import("./conversations/incoming-message-processor");

  const baileysWorker = startBaileysWorker();
  const incomingProcessor = startIncomingMessageProcessor();

  console.log("Workers iniciados: Baileys + IncomingMessageProcessor");

  const shutdown = async () => {
    console.log("Encerrando workers...");
    await Promise.all([baileysWorker.close(), incomingProcessor.close()]);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  console.error("Worker bootstrap falhou:", err);
  process.exit(1);
});
