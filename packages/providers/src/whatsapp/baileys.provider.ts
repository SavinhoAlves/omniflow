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

/**
 * Provider Baileys — conexão direta ao protocolo multi-device do
 * WhatsApp Web, sem depender de nenhum serviço terceiro. Maior
 * controle e zero custo por mensagem, mas com responsabilidade
 * operacional real: é uma conexão de socket persistente por
 * instância, não uma chamada HTTP stateless como os outros dois
 * providers.
 *
 * DECISÃO ARQUITETURAL IMPORTANTE: diferente de Meta/Evolution
 * (onde qualquer processo da API pode simplesmente fazer uma
 * requisição HTTP), sessões Baileys DEVEM viver em um processo
 * dedicado (`apps/workers`), nunca dentro do processo Fastify que
 * atende HTTP:
 *
 *  - Uma empresa com 50 instâncias = 50 sockets abertos e vivos.
 *    Isso não pode escalar horizontalmente do mesmo jeito que a API
 *    HTTP (que é stateless e escala em N réplicas atrás de um load
 *    balancer) — cada socket precisa "morar" em um processo
 *    específico, senão a mesma instância tentaria conectar 2x.
 *  - Por isso este provider, quando chamado a partir da API, na
 *    verdade delega para o processo de workers via fila (BullMQ) ou
 *    RPC interno — NUNCA mantém o socket no próprio processo da API.
 *  - `SessionManager` (a implementar em apps/workers) é quem de fato
 *    guarda o mapa `instanceId -> socket Baileys` em memória naquele
 *    processo, persiste `authState` (credenciais de sessão) em
 *    Redis ou Postgres a cada `creds.update`, e reidrata as sessões
 *    ativas quando o worker reinicia.
 *
 * A classe abaixo é a fachada que a API usa; ela não mantém socket
 * nenhum — apenas traduz cada chamada em uma mensagem para a fila
 * que o worker consome.
 */

interface BaileysCommandQueue {
  enqueue<T>(instanceId: string, command: string, payload?: unknown): Promise<T>;
}

export class BaileysProvider implements IWhatsAppProvider {
  constructor(private readonly queue: BaileysCommandQueue) {}

  async connect(instanceId: string): Promise<ConnectionState> {
    // Pede ao worker para iniciar (ou retomar) a sessão. O worker
    // responde de forma assíncrona com o QR Code via evento
    // Socket.IO para o frontend — esta chamada apenas dispara o
    // processo e retorna o estado inicial.
    return this.queue.enqueue<ConnectionState>(instanceId, "connect");
  }

  async disconnect(instanceId: string): Promise<void> {
    await this.queue.enqueue<void>(instanceId, "disconnect");
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    return this.queue.enqueue<ConnectionState>(instanceId, "get_state");
  }

  async sendTextMessage(
    instanceId: string,
    input: SendTextMessageInput
  ): Promise<SendMessageResult> {
    return this.queue.enqueue<SendMessageResult>(instanceId, "send_text", input);
  }

  async sendMediaMessage(
    instanceId: string,
    input: SendMediaMessageInput
  ): Promise<SendMessageResult> {
    return this.queue.enqueue<SendMessageResult>(instanceId, "send_media", input);
  }

  // [Update 4] Upload delegado ao worker (Baileys usa streams, não HTTP)
  async uploadMedia(instanceId: string, input: UploadMediaInput): Promise<UploadMediaResult> {
    return this.queue.enqueue<UploadMediaResult>(instanceId, "upload_media", input);
  }

  // [Update 5] Templates não existem no protocolo não-oficial do Baileys
  async sendTemplateMessage(_instanceId: string, _input: SendTemplateMessageInput): Promise<SendMessageResult> {
    throw new Error("Templates HSM não são suportados pelo provider Baileys (protocolo não-oficial). Use META_CLOUD_API ou EVOLUTION_API.");
  }
}

/**
 * PRÓXIMA ETAPA (fora do escopo desta entrega): implementar
 * `apps/workers/src/whatsapp/session-manager.ts`, que:
 *   1. Consome a fila `baileys-commands` (BullMQ).
 *   2. Mantém `Map<instanceId, WASocket>` em memória.
 *   3. Usa `useMultiFileAuthState` (ou uma versão adaptada que
 *      persiste em Redis, mais adequada a containers efêmeros) para
 *      guardar/restaurar credenciais de sessão.
 *   4. Emite eventos normalizados (`IncomingMessageEvent`) para a
 *      fila `incoming-messages`, que o módulo de Conversas consome
 *      — desacoplando totalmente o parsing de mensagens do protocolo
 *      específico do Baileys.
 */
