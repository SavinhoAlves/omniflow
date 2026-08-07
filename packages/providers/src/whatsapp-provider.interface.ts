/**
 * Contrato único que TODA implementação de provider precisa
 * respeitar. Nenhum service ou controller da aplicação deve
 * conhecer Baileys, Meta Cloud API ou Evolution API diretamente —
 * apenas esta interface.
 *
 * Ao adicionar um novo provider no futuro (ex: Twilio, Gupshup),
 * basta criar uma nova classe que implemente `IWhatsAppProvider` e
 * registrá-la em `provider.factory.ts`. Nada mais muda.
 */

export interface SendTextMessageInput {
  to: string; // número no formato E.164, ex: "5521999999999"
  text: string;
}

export interface SendMediaMessageInput {
  to: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "document";
  caption?: string;
}

export interface SendMessageResult {
  providerMessageId: string; // id retornado pelo provider, pra rastrear status
  sentAt: Date;
}

export type InstanceConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_PENDING"
  | "ERROR";

export interface ConnectionState {
  status: InstanceConnectionStatus;
  qrCode?: string; // presente apenas quando status === "QR_PENDING"
}

/**
 * Eventos que um provider pode emitir de forma assíncrona
 * (mensagem recebida, mudança de status de conexão, confirmação de
 * entrega). A implementação concreta é responsável por traduzir o
 * formato nativo do provider para este formato normalizado antes de
 * repassar ao restante da aplicação (via fila/BullMQ, nunca síncrono
 * — ver whatsapp.events.ts).
 */
export interface IncomingMessageEvent {
  instanceId: string;
  fromNumber: string;
  contactName?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "location" | "contact";
  providerMessageId: string;
  receivedAt: Date;
}

export interface IWhatsAppProvider {
  /** Inicia a conexão da instância (pode gerar QR Code ou usar token direto). */
  connect(instanceId: string): Promise<ConnectionState>;

  /** Encerra a sessão da instância no provider. */
  disconnect(instanceId: string): Promise<void>;

  /** Consulta o estado atual de conexão sem forçar reconexão. */
  getConnectionState(instanceId: string): Promise<ConnectionState>;

  sendTextMessage(instanceId: string, input: SendTextMessageInput): Promise<SendMessageResult>;

  sendMediaMessage(instanceId: string, input: SendMediaMessageInput): Promise<SendMessageResult>;
}
