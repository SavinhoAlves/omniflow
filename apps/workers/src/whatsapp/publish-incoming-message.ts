import { Queue } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";

const incomingQueue = new Queue(QUEUE_NAMES.INCOMING_MESSAGES, {
  connection: getRedisConnectionOptions(),
});

/**
 * Normaliza uma mensagem recebida do Baileys (formato proprietário
 * da lib) para `IncomingMessageEvent` (o mesmo formato que
 * Meta/Evolution também vão publicar a partir de seus webhooks) e
 * publica na fila. O módulo de Conversas consome exclusivamente
 * esse formato — nunca sabe que a mensagem veio do Baileys
 * especificamente, o que mantém o desacoplamento de provider até a
 * última ponta.
 */
export async function publishIncomingMessage(instanceId: string, rawMessage: any) {
  const text =
    rawMessage.message?.conversation ??
    rawMessage.message?.extendedTextMessage?.text ??
    undefined;

  await incomingQueue.add("incoming", {
    instanceId,
    fromNumber: rawMessage.key.remoteJid?.replace("@s.whatsapp.net", ""),
    contactName: rawMessage.pushName,
    text,
    providerMessageId: rawMessage.key.id,
    receivedAt: new Date(),
    // Extração de mídia (image/video/audio/document) fica para
    // quando o módulo de Conversas for implementado — aqui só
    // repassamos o necessário para mensagens de texto, que é o caso
    // mais comum, sem acoplar este worker à lógica de download e
    // armazenamento de mídia que pertence a outro módulo.
  });
}
