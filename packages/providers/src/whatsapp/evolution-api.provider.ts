import {
  IWhatsAppProvider,
  ConnectionState,
  SendTextMessageInput,
  SendMediaMessageInput,
  SendMessageResult,
} from "../whatsapp-provider.interface";

interface EvolutionCredentials {
  baseUrl: string; // URL da instância Evolution API self-hosted
  apiKey: string;
  instanceName: string; // nome da instância dentro da Evolution API
}

interface EvolutionConnectResponse {
  qrcode?: { base64?: string };
  instance?: { state?: string };
}

interface EvolutionSendMessageResponse {
  key: { id: string };
}

/**
 * Provider para Evolution API (self-hosted, usa Baileys por baixo
 * dos panos mas expõe uma REST API estável). Boa opção intermediária
 * entre Baileys puro (mais controle, mais responsabilidade
 * operacional) e Meta Cloud API (oficial, mas com limitações de
 * template/janela de 24h).
 */
export class EvolutionApiProvider implements IWhatsAppProvider {
  constructor(
    private readonly getCredentials: (instanceId: string) => Promise<EvolutionCredentials>
  ) {}

  async connect(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const res = await this.request<EvolutionConnectResponse>(
      creds,
      "GET",
      `/instance/connect/${creds.instanceName}`
    );

    if (res.qrcode?.base64) {
      return { status: "QR_PENDING", qrCode: res.qrcode.base64 };
    }
    return { status: this.mapStatus(res.instance?.state) };
  }

  async disconnect(instanceId: string): Promise<void> {
    const creds = await this.getCredentials(instanceId);
    await this.request(creds, "DELETE", `/instance/logout/${creds.instanceName}`);
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    const creds = await this.getCredentials(instanceId);
    const res = await this.request<EvolutionConnectResponse>(
      creds,
      "GET",
      `/instance/connectionState/${creds.instanceName}`
    );
    return { status: this.mapStatus(res.instance?.state) };
  }

  async sendTextMessage(
    instanceId: string,
    input: SendTextMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const res = await this.request<EvolutionSendMessageResponse>(
      creds,
      "POST",
      `/message/sendText/${creds.instanceName}`,
      {
        number: input.to,
        text: input.text,
      }
    );
    return { providerMessageId: res.key.id, sentAt: new Date() };
  }

  async sendMediaMessage(
    instanceId: string,
    input: SendMediaMessageInput
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(instanceId);
    const res = await this.request<EvolutionSendMessageResponse>(
      creds,
      "POST",
      `/message/sendMedia/${creds.instanceName}`,
      {
        number: input.to,
        mediatype: input.mediaType,
        media: input.mediaUrl,
        caption: input.caption,
      }
    );
    return { providerMessageId: res.key.id, sentAt: new Date() };
  }

  private mapStatus(evolutionState?: string): ConnectionState["status"] {
    switch (evolutionState) {
      case "open":
        return "CONNECTED";
      case "connecting":
        return "CONNECTING";
      case "close":
        return "DISCONNECTED";
      default:
        return "ERROR";
    }
  }

  private async request<T = unknown>(
    creds: EvolutionCredentials,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method,
      headers: {
        apikey: creds.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Evolution API error (${res.status}): ${error}`);
    }
    return res.json() as Promise<T>;
  }
}
