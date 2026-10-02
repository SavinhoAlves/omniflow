// Envio pelo canal da instância, usado por mensagens agendadas e campanhas.
//
// Baileys usa a sessão que vive neste processo; os demais canais (Meta Cloud
// API, Evolution, Messenger, Instagram) passam pelos providers HTTP.

import { prisma, tenantStorage } from "@omnichannel/database";
import { WhatsAppProviderFactory, WhatsAppProviderType } from "@omnichannel/providers";
import { sessionManager } from "./session-manager";
import { decryptCredentials } from "./credentials-crypto";

const providerFactory = new WhatsAppProviderFactory({
  getCredentials: async (instanceId) => {
    // await dentro do run: a query só executa no await e WhatsAppInstance é tenant-scoped
    const inst = await tenantStorage.run({ isPlatform: true }, async () =>
      await prisma.whatsAppInstance.findFirstOrThrow({ where: { id: instanceId }, select: { credentials: true } })
    );
    if (!inst.credentials) throw new Error(`Instância ${instanceId} sem credenciais`);
    return decryptCredentials(inst.credentials as string);
  },
  baileysQueue: {
    enqueue: async () => {
      throw new Error("Baileys é enviado direto pela sessão do worker");
    },
  },
});

export type MediaKind = "image" | "video" | "audio" | "document";

export interface ChannelTarget {
  instanceId: string;
  providerType: string;
  to: string;
}

/** Texto (com mídia opcional). Retorna o id da mensagem no provedor, quando houver. */
export async function sendTextViaChannel(
  target: ChannelTarget,
  text: string,
  media?: { url: string; kind: MediaKind } | null
): Promise<string | null> {
  if (target.providerType === "BAILEYS") {
    if (media) {
      await sessionManager.sendMedia(target.instanceId, target.to, media.url, media.kind, text);
      return null;
    }
    const res = await sessionManager.sendText(target.instanceId, target.to, text);
    return res.providerMessageId || null;
  }
  const provider = providerFactory.get(target.providerType as WhatsAppProviderType);
  const res = media
    ? await provider.sendMediaMessage(target.instanceId, { to: target.to, mediaType: media.kind, mediaUrl: media.url, caption: text })
    : await provider.sendTextMessage(target.instanceId, { to: target.to, text });
  return res.providerMessageId || null;
}

/** Template aprovado da Meta, com os parâmetros do corpo na ordem {{1}}, {{2}}… */
export async function sendTemplateViaChannel(
  target: ChannelTarget,
  template: { name: string; language: string; bodyParams: string[] }
): Promise<string | null> {
  const provider = providerFactory.get(target.providerType as WhatsAppProviderType);
  if (!provider.sendTemplateMessage) {
    throw new Error("Este canal não suporta templates");
  }
  const res = await provider.sendTemplateMessage(target.instanceId, {
    to: target.to,
    templateName: template.name,
    languageCode: template.language,
    components: template.bodyParams.length
      ? [{ type: "body", parameters: template.bodyParams.map((text) => ({ type: "text" as const, text })) }]
      : [],
  });
  return res.providerMessageId || null;
}
