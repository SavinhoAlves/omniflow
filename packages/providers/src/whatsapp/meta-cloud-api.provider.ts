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

interface MetaCredentials {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
}

interface MetaSendMessageResponse {
  messages: { id: string; message_status?: string }[];
  contacts: { input: string; wa_id: string }[];
}

interface MetaMediaUploadResponse {
  id: string;
}

/**
 * Provider oficial da Meta (WhatsApp Business Platform / Cloud API).
 *
 * Versão v25.0 — suportada até 18/02/2028.
 * v20.0 foi aposentada em 24/09/2026.
 *
 * Não existe conceito de QR Code ou sessão: o número está vinculado
 * via phoneNumberId (credencial) e o token é validado a cada
 * chamada ao Graph API.
 */
export class MetaCloudApiProvider implements IWhatsAppProvider {
  // [Update 1] Migrado de v20.0 (sunset 24/09/2026) para v25.0
  private readonly apiVersion = "v25.0";

  constructor(private readonly getCredentials: (instanceId: string) => Promise<MetaCredentials>) {}

  async connect(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const isValid = await this.validateToken(creds);
    return { status: isValid ? "CONNECTED" : "ERROR" };
  }

  async disconnect(): Promise<void> {
    return;
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const isValid = await this.validateToken(creds);
    return { status: isValid ? "CONNECTED" : "ERROR" };
  }

  async sendTextMessage(
    instanceId: string,
    input: SendTextMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const response = await this.callGraphApi<MetaSendMessageResponse>(creds, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { body: input.text, preview_url: false },
    });
    return { providerMessageId: response.messages[0].id, sentAt: new Date() };
  }

  // [Update 4] Suporte a envio por media_id (além de link) e filename para documentos
  async sendMediaMessage(
    instanceId: string,
    input: SendMediaMessageInput
  ): Promise<SendMessageResult> {
    if (!input.mediaUrl && !input.mediaId) {
      throw new Error("sendMediaMessage requer mediaUrl ou mediaId");
    }

    const creds = await this.getCredentials(instanceId);

    const mediaPayload: Record<string, unknown> = {};
    if (input.mediaId) {
      mediaPayload.id = input.mediaId;
    } else {
      mediaPayload.link = input.mediaUrl;
    }
    if (input.caption) mediaPayload.caption = input.caption;
    if (input.filename && input.mediaType === "document") {
      mediaPayload.filename = input.filename;
    }

    const response = await this.callGraphApi<MetaSendMessageResponse>(creds, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: input.mediaType,
      [input.mediaType]: mediaPayload,
    });
    return { providerMessageId: response.messages[0].id, sentAt: new Date() };
  }

  // [Update 4] Upload de mídia para obter media_id (válido 30 dias)
  async uploadMedia(instanceId: string, input: UploadMediaInput): Promise<UploadMediaResult> {
    const creds = await this.getCredentials(instanceId);
    const url = `https://graph.facebook.com/${this.apiVersion}/${creds.phoneNumberId}/media`;

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", input.mimeType);
    form.append(
      "file",
      new Blob([input.fileBuffer], { type: input.mimeType }),
      input.filename
    );

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      body: form,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Meta media upload error (${res.status}): ${error}`);
    }

    const data = (await res.json()) as MetaMediaUploadResponse;
    return { mediaId: data.id };
  }

  // [Update 5] Templates HSM — mensagens proativas com aprovação prévia da Meta
  async sendTemplateMessage(
    instanceId: string,
    input: SendTemplateMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);

    const response = await this.callGraphApi<MetaSendMessageResponse>(creds, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: input.components ?? [],
      },
    });

    return { providerMessageId: response.messages[0].id, sentAt: new Date() };
  }

  private async callGraphApi<T = unknown>(creds: MetaCredentials, body: unknown): Promise<T> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${creds.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Meta Cloud API error (${res.status}): ${error}`);
    }
    return res.json() as Promise<T>;
  }

  private async validateToken(creds: MetaCredentials): Promise<boolean> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${creds.phoneNumberId}?fields=id,display_phone_number`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    return res.ok;
  }
}
