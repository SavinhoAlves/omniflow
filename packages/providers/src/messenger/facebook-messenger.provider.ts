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

export interface MessengerCredentials {
  pageId: string;
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
 * Provider Facebook Messenger — envia/recebe mensagens via Graph API v25.0.
 *
 * Credenciais: { pageId, pageAccessToken }
 *  - pageId: ID numérico da Página do Facebook
 *  - pageAccessToken: token permanente gerado via System User no Business Manager
 *
 * Limitações do protocolo Messenger vs WhatsApp:
 *  - Só é possível responder dentro de 24h após o usuário escrever (janela de serviço)
 *  - Não há conceito de "sessão" ou QR code — connect() valida o token
 *  - Templates têm formato diferente (generic, button, receipt — não HSM)
 */
export class FacebookMessengerProvider implements IWhatsAppProvider {
  private readonly apiVersion = "v25.0";
  private readonly baseUrl = "https://graph.facebook.com";

  constructor(
    private readonly getCredentials: (instanceId: string) => Promise<MessengerCredentials>
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

  // Templates Messenger têm formato diferente de HSM (WhatsApp)
  async sendTemplateMessage(
    instanceId: string,
    input: SendTemplateMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    // Messenger usa Generic Template — components[0].parameters[0] como título
    const title = input.components?.[0]?.parameters?.[0]?.text ?? input.templateName;
    const res = await this.callSendApi<MessengerSendResponse>(creds, {
      recipient: { id: input.to },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{ title }],
          },
        },
      },
    });
    return { providerMessageId: res.message_id, sentAt: new Date() };
  }

  // Upload de attachment para reutilização (attachment_id)
  async uploadMedia(instanceId: string, input: UploadMediaInput): Promise<UploadMediaResult> {
    const creds = await this.getCredentials(instanceId);
    const url = `${this.baseUrl}/${this.apiVersion}/me/message_attachments?access_token=${creds.pageAccessToken}`;

    const attachmentType = input.mimeType.startsWith("image/") ? "image"
      : input.mimeType.startsWith("video/") ? "video"
      : input.mimeType.startsWith("audio/") ? "audio"
      : "file";

    const form = new FormData();
    form.append("message", JSON.stringify({
      attachment: {
        type: attachmentType,
        payload: { is_reusable: true },
      },
    }));
    form.append("filedata", new Blob([input.fileBuffer], { type: input.mimeType }), input.filename);

    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Messenger upload error (${res.status}): ${await res.text()}`);
    const data = await res.json() as { attachment_id: string };
    return { mediaId: data.attachment_id };
  }

  private async callSendApi<T>(creds: MessengerCredentials, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.pageId}/messages?access_token=${creds.pageAccessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Messenger API error (${res.status}): ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async validateToken(creds: MessengerCredentials): Promise<boolean> {
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.pageId}?fields=id,name&access_token=${creds.pageAccessToken}`;
    const res = await fetch(url);
    return res.ok;
  }
}
