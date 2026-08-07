import {
  IWhatsAppProvider,
  ConnectionState,
  SendTextMessageInput,
  SendMediaMessageInput,
  SendMessageResult,
} from "../whatsapp-provider.interface";

interface MetaCredentials {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string; // WhatsApp Business Account ID
}

interface MetaSendMessageResponse {
  messages: { id: string }[];
}

/**
 * Provider oficial da Meta (WhatsApp Business Platform / Cloud API).
 *
 * Diferença fundamental dos outros dois providers: não existe
 * conceito de QR Code ou "conexão" no sentido de sessão — o número
 * já vem vinculado à conta Meta Business via `phoneNumberId`, então
 * `connect()`/`disconnect()` aqui são no-ops que apenas validam
 * que o token ainda é válido.
 *
 * `getCredentials` busca de `WhatsAppInstance.credentials` (JSON
 * criptografado) — a busca/decriptação fica no service que injeta
 * este provider, não aqui, pra manter esta classe sem dependência
 * do Prisma.
 */
export class MetaCloudApiProvider implements IWhatsAppProvider {
  private readonly apiVersion = "v20.0";

  constructor(private readonly getCredentials: (instanceId: string) => Promise<MetaCredentials>) {}

  async connect(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const isValid = await this.validateToken(creds);
    return { status: isValid ? "CONNECTED" : "ERROR" };
  }

  async disconnect(): Promise<void> {
    // Não há sessão pra encerrar do lado da Meta — desconectar aqui
    // significa apenas marcar a instância como inativa no nosso
    // banco, o que é responsabilidade do service, não do provider.
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
      to: input.to,
      type: "text",
      text: { body: input.text },
    });
    return { providerMessageId: response.messages[0].id, sentAt: new Date() };
  }

  async sendMediaMessage(
    instanceId: string,
    input: SendMediaMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const response = await this.callGraphApi<MetaSendMessageResponse>(creds, {
      messaging_product: "whatsapp",
      to: input.to,
      type: input.mediaType,
      [input.mediaType]: { link: input.mediaUrl, caption: input.caption },
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
    const url = `https://graph.facebook.com/${this.apiVersion}/${creds.phoneNumberId}?fields=id`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    return res.ok;
  }
}
