import { Queue } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";

const phoneOutboundQueue = new Queue(QUEUE_NAMES.PHONE_OUTBOUND, {
  connection: getRedisConnectionOptions(),
});

/**
 * Captura mensagens enviadas diretamente do celular físico (fromMe=true)
 * e as registra no banco como OUTBOUND, mantendo o histórico sincronizado
 * com o que o atendente faz fora do sistema.
 */
export async function publishPhoneOutbound(instanceId: string, rawMessage: any) {
  const text =
    rawMessage.message?.conversation ??
    rawMessage.message?.extendedTextMessage?.text ??
    rawMessage.message?.imageMessage?.caption ??
    rawMessage.message?.videoMessage?.caption ??
    undefined;

  const rawJid = rawMessage.key.remoteJid ?? "";
  let toNumber: string;
  if (rawJid.endsWith("@s.whatsapp.net")) {
    const bare = rawJid.replace("@s.whatsapp.net", "");
    toNumber = bare.startsWith("+") ? bare : `+${bare}`;
  } else if (rawJid.endsWith("@lid")) {
    toNumber = rawJid;
  } else {
    return; // grupo ou JID desconhecido — ignora
  }

  await phoneOutboundQueue.add("phone-outbound", {
    instanceId,
    toNumber,
    text,
    providerMessageId: rawMessage.key.id,
    sentAt: new Date(),
  });
}
