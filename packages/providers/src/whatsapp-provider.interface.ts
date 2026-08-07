/**
 * Contrato único que toda implementação de provider precisa respeitar.
 * Nenhum service ou controller da aplicação deve conhecer Baileys,
 * Meta Cloud API ou Evolution API diretamente — apenas esta interface.
 */

export interface SendTextMessageInput {
  to: string; // E.164, ex: "5521999999999"
  text: string;
}

// [Update 4] mediaId alternativo ao link; filename para documentos
export interface SendMediaMessageInput {
  to: string;
  mediaType: "image" | "video" | "audio" | "document";
  mediaUrl?: string;   // envio por URL pública
  mediaId?: string;    // envio por ID pré-carregado (Meta — preferível)
  caption?: string;
  filename?: string;   // documentos apenas
}

// [Update 4] Upload de mídia → media_id (Meta: válido 30 dias)
export interface UploadMediaInput {
  fileBuffer: Buffer;
  mimeType: string;  // ex: "image/jpeg", "application/pdf"
  filename: string;
}

export interface UploadMediaResult {
  mediaId: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  sentAt: Date;
}

// [Update 5] Template HSM — mensagem proativa aprovada pela Meta
export interface TemplateParameter {
  type: "text" | "image" | "video" | "document" | "payload" | "currency" | "date_time";
  text?: string;
  image?: { id?: string; link?: string };
  video?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
  payload?: string; // quick_reply button payloads
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url" | "copy_code";
  index?: number; // buttons only
  parameters: TemplateParameter[];
}

export interface SendTemplateMessageInput {
  to: string;
  templateName: string;
  languageCode: string; // ex: "pt_BR", "en_US"
  components?: TemplateComponent[];
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
 * Evento normalizado de mensagem recebida — formato único que chega
 * na fila `incoming-messages`, independente do provider de origem.
 */
export interface IncomingMessageEvent {
  instanceId: string;
  fromNumber: string;
  contactName?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts";
  providerMessageId: string;
  receivedAt: Date;
}

// [Update 2] Evento de status de entrega — chega via webhook Meta
export interface MessageStatusEvent {
  instanceId: string;
  providerMessageId: string; // wamid.xxx
  status: "sent" | "delivered" | "read" | "failed";
  recipientNumber: string;
  timestamp: Date;
  errorCode?: number;
  errorMessage?: string;
}

export interface IWhatsAppProvider {
  connect(instanceId: string): Promise<ConnectionState>;
  disconnect(instanceId: string): Promise<void>;
  getConnectionState(instanceId: string): Promise<ConnectionState>;
  sendTextMessage(instanceId: string, input: SendTextMessageInput): Promise<SendMessageResult>;
  sendMediaMessage(instanceId: string, input: SendMediaMessageInput): Promise<SendMessageResult>;

  // Opcional — não suportado por Baileys/Evolution (retornam UnsupportedOperationError)
  sendTemplateMessage?(instanceId: string, input: SendTemplateMessageInput): Promise<SendMessageResult>;
  uploadMedia?(instanceId: string, input: UploadMediaInput): Promise<UploadMediaResult>;
}
