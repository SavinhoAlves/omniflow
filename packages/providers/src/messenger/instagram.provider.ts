import {
  IWhatsAppProvider,
  ConnectionState,
  SendTextMessageInput,
  SendMediaMessageInput,
  SendMessageResult,
  SendTemplateMessageInput,
  UploadMediaInput,
  UploadMediaResult,
} from "../whatsapp-provider.interface";

export interface InstagramCredentials {
  pageId: string;        // Facebook Page ID vinculada à conta Instagram
  igAccountId: string;   // Instagram Business Account ID
  pageAccessToken: string;
}

interface MessengerSendResponse {
  recipient_id: string;
  message_id: string;
}

const MEDIA_TYPE_MAP: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  document: "file",
};

/**
 * Provider Instagram Messaging via Messenger Platform (Graph API v25.0).
 *
 * Credenciais: { pageId, igAccountId, pageAccessToken }
 *  - pageId: Facebook Page ID vinculada à conta Business do Instagram
 *  - igAccountId: Instagram Business Account ID (para validação)
 *  - pageAccessToken: token permanente com instagram_business_manage_messages
 *
 * Regras:
 *  - Só responder dentro de 24h após mensagem do usuário (janela de serviço)
 *  - Human Agent tag estende para 7 dias
 *  - CDN URLs de mídia recebida expiram quando o conteúdo é deletado
 */
export class InstagramProvider implements IWhatsAppProvider {
  private readonly apiVersion = "v25.0";
  private readonly baseUrl = "https://graph.facebook.com";

  constructor(
    private readonly getCredentials: (instanceId: string) => Promise<InstagramCredentials>
  ) {}

  async connect(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const valid = await this.validateToken(creds);
    return { status: valid ? "CONNECTED" : "ERROR" };
  }

  async disconnect(): Promise<void> {
    return;
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const valid = await this.validateToken(creds);
    return { status: valid ? "CONNECTED" : "ERROR" };
  }

  async sendTextMessage(
    instanceId: string,
    input: SendTextMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const res = await this.callSendApi<MessengerSendResponse>(creds, {
      recipient: { id: input.to },
      messaging_type: "RESPONSE",
      message: { text: input.text },
    });
    return { providerMessageId: res.message_id, sentAt: new Date() };
  }

  async sendMediaMessage(
    instanceId: string,
    input: SendMediaMessageInput
  ): Promise<SendMessageResult> {
    if (!input.mediaUrl && !input.mediaId) {
      throw new Error("sendMediaMessage requer mediaUrl ou mediaId");
    }
    const creds = await this.getCredentials(instanceId);
    const attachmentType = MEDIA_TYPE_MAP[input.mediaType] ?? "file";

    const payload: Record<string, unknown> = input.mediaId
      ? { attachment_id: input.mediaId, is_reusable: true }
      : { url: input.mediaUrl, is_reusable: true };

    const res = await this.callSendApi<MessengerSendResponse>(creds, {
      recipient: { id: input.to },
      messaging_type: "RESPONSE",
      message: {
        attachment: { type: attachmentType, payload },
      },
    });
    return { providerMessageId: res.message_id, sentAt: new Date() };
  }

  async sendTemplateMessage(
    instanceId: string,
    input: SendTemplateMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const title = input.components?.[0]?.parameters?.[0]?.text ?? input.templateName;
    const res = await this.callSendApi<MessengerSendResponse>(creds, {
      recipient: { id: input.to },
      message: {
        attachment: {
          type: "template",
          payload: { template_type: "generic", elements: [{ title }] },
        },
      },
    });
    return { providerMessageId: res.message_id, sentAt: new Date() };
  }

  async uploadMedia(_instanceId: string, _input: UploadMediaInput): Promise<UploadMediaResult> {
    throw new Error("uploadMedia não suportado para Instagram. Use mediaUrl diretamente.");
  }

  private async callSendApi<T>(creds: InstagramCredentials, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.pageId}/messages?access_token=${creds.pageAccessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Instagram API error (${res.status}): ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async validateToken(creds: InstagramCredentials): Promise<boolean> {
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.igAccountId}?fields=id,username&access_token=${creds.pageAccessToken}`;
    const res = await fetch(url);
    return res.ok;
  }
}
