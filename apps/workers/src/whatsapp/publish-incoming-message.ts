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
  // Extrai texto da mensagem — inclui respostas de menus interativos (lista/botão)
  const text =
    rawMessage.message?.conversation ??
    rawMessage.message?.extendedTextMessage?.text ??
    rawMessage.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
    rawMessage.message?.buttonsResponseMessage?.selectedButtonId ??
    undefined;

  const rawJid = rawMessage.key.remoteJid ?? "";
  let fromNumber: string;
  if (rawJid.endsWith("@s.whatsapp.net")) {
    const bare = rawJid.replace("@s.whatsapp.net", "");
    fromNumber = bare.startsWith("+") ? bare : `+${bare}`;
  } else if (rawJid.endsWith("@lid")) {
    // LID JID: identificador de privacidade do WhatsApp multi-device.
    // Usamos o JID completo como identificador único do contato.
    fromNumber = rawJid;
  } else {
    return; // JID desconhecido
  }

  await incomingQueue.add("incoming", {
    instanceId,
    fromNumber,
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
