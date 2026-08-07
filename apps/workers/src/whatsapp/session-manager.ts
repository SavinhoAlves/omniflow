import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "node:path";
import fs from "node:fs/promises";
import { QUEUE_NAMES } from "../queues/queue-names";

import { publishIncomingMessage } from "./publish-incoming-message";

interface SessionEntry {
  socket: WASocket;
  status: "CONNECTED" | "CONNECTING" | "QR_PENDING" | "DISCONNECTED" | "ERROR";
  qrCode?: string;
}

/**
 * Mantém `Map<instanceId, SessionEntry>` em memória NESTE processo.
 * É por isso que `apps/workers` precisa rodar como uma quantidade
 * fixa e conhecida de réplicas (ou 1 réplica única para começar) —
 * diferente da API HTTP, que escala livremente porque é stateless.
 *
 * Se no futuro o volume exigir múltiplas réplicas de worker, a
 * distribuição de qual instância vive em qual réplica precisa de um
 * mecanismo de particionamento consistente (ex: hash do instanceId
 * módulo N réplicas) — não implementado nesta etapa, mas o design
 * abaixo (uma classe isolada, sem estado global espalhado) é o que
 * torna essa evolução possível sem reescrever tudo.
 *
 * PERSISTÊNCIA DE AUTH STATE: usamos `useMultiFileAuthState` do
 * próprio Baileys como ponto de partida (grava em disco local), mas
 * isso NÃO sobrevive a um container efêmero sendo recriado. Para
 * produção real, este é o primeiro ponto a trocar por uma
 * implementação que persista em Postgres ou S3 (o formato do estado
 * é serializável em JSON) — deixado como TODO explícito abaixo em
 * vez de mascarar a limitação.
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private readonly authDir = path.join(process.cwd(), ".baileys-sessions");

  async connect(instanceId: string): Promise<{ status: SessionEntry["status"]; qrCode?: string }> {
    const existing = this.sessions.get(instanceId);
    if (existing?.status === "CONNECTED") {
      return { status: "CONNECTED" };
    }

    // Se já existe uma sessão em processo de conexão ou aguardando QR,
    // reaproveitamos o socket existente em vez de recriar um novo loop em cima do mesmo diretório de auth.
    if (existing && (existing.status === "CONNECTING" || existing.status === "QR_PENDING")) {
      return { status: existing.status, qrCode: existing.qrCode };
    }

    // Se houver uma sessão morta/com erro anterior, limpamos do mapa antes de reiniciar.
    // Se o status era ERROR (loggedOut), deletamos também os arquivos de auth do disco
    // para que a próxima sessão gere um QR Code novo em vez de tentar reautenticar
    // com credenciais inválidas e falhar novamente.
    if (existing) {
      if (existing.status === "ERROR") {
        const staleSessionPath = path.join(this.authDir, instanceId);
        await fs.rm(staleSessionPath, { recursive: true, force: true }).catch(() => {});
      }
      this.sessions.delete(instanceId);
    }

    // TODO(produção): substituir por auth state persistido em
    // Postgres/S3. `useMultiFileAuthState` grava em
    // `${this.authDir}/${instanceId}` — funciona para desenvolvimento
    // local e para um único worker de longa duração, mas se perde
    // ao recriar o container.
    const sessionPath = path.join(this.authDir, instanceId);
    await fs.mkdir(sessionPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["OmniFlow", "Chrome", "20.0.04"],
    });

    const entry: SessionEntry = { socket, status: "CONNECTING" };
    this.sessions.set(instanceId, entry);

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        entry.status = "QR_PENDING";
        entry.qrCode = qr;
      }

      if (connection === "open") {
        entry.status = "CONNECTED";
        entry.qrCode = undefined;
      }

      if (connection === "close") {
        const disconnectCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = disconnectCode !== DisconnectReason.loggedOut;
        entry.status = shouldReconnect ? "DISCONNECTED" : "ERROR";

        if (shouldReconnect) {
          // Reconexão automática para desconexões transientes
          this.sessions.delete(instanceId);
          this.connect(instanceId);
        } else {
          // loggedOut: credenciais invalidadas — remove auth do disco
          // para que o próximo connect() gere um QR Code limpo.
          const sessionPath = path.join(this.authDir, instanceId);
          fs.rm(sessionPath, { recursive: true, force: true }).catch(() => {});
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        await publishIncomingMessage(instanceId, msg);
      }
    });

    // Aumentado ligeiramente o tempo de espera inicial para dar tempo
    // hábil ao Baileys gerar o primeiro evento de QR Code ou conexão aberta.
    let attempts = 0;
    while (entry.status === "CONNECTING" && !entry.qrCode && attempts < 15) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    return { status: entry.status, qrCode: entry.qrCode };
  }

  async disconnect(instanceId: string): Promise<void> {
    const entry = this.sessions.get(instanceId);
    if (!entry) return;
    try {
      await entry.socket.logout();
    } catch (e) {
      // Ignora erro caso o socket já esteja fechado
    }
    this.sessions.delete(instanceId);
  }

  getState(instanceId: string): { status: SessionEntry["status"]; qrCode?: string } {
    const entry = this.sessions.get(instanceId);
    if (!entry) return { status: "DISCONNECTED" };
    return { status: entry.status, qrCode: entry.qrCode };
  }

  async sendText(instanceId: string, to: string, text: string) {
    const entry = this.requireConnected(instanceId);
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    const result = await entry.socket.sendMessage(jid, { text });
    return { providerMessageId: result?.key.id ?? "", sentAt: new Date() };
  }

  async sendMedia(
    instanceId: string,
    to: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string
  ) {
    const entry = this.requireConnected(instanceId);
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

    const contentKey = mediaType === "document" ? "document" : mediaType;
    const result = await entry.socket.sendMessage(jid, {
      [contentKey]: { url: mediaUrl },
      caption,
    } as any);

    return { providerMessageId: result?.key.id ?? "", sentAt: new Date() };
  }

  private requireConnected(instanceId: string): SessionEntry {
    const entry = this.sessions.get(instanceId);
    if (!entry || entry.status !== "CONNECTED") {
      throw new Error(`Instância ${instanceId} não está conectada`);
    }
    return entry;
  }
}

export const sessionManager = new SessionManager();