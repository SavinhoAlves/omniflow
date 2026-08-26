import makeWASocket, {
  DisconnectReason,
  WASocket,
  proto,
  generateWAMessageFromContent,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { QUEUE_NAMES } from "../queues/queue-names";

import { useDatabaseAuthState } from "./use-database-auth-state";
import { publishIncomingMessage } from "./publish-incoming-message";
import { publishPhoneOutbound } from "./publish-phone-outbound";

interface SessionEntry {
  socket: WASocket;
  status: "CONNECTED" | "CONNECTING" | "QR_PENDING" | "DISCONNECTED" | "ERROR";
  qrCode?: string;
  lastEventAt?: number;
  watchdogTimer?: ReturnType<typeof setTimeout>;
  clearSession?: () => Promise<void>;
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
 * PERSISTÊNCIA: usa PostgreSQL via useDatabaseAuthState (tabelas
 * bailey_sessions + bailey_session_keys). Sobrevive a restarts de
 * container — migração do disco local concluída na Fase 1 (T1.3).
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();

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
    // Se o status era ERROR (loggedOut), limpamos também o registro do banco
    // para que a próxima sessão gere um QR Code novo em vez de tentar reautenticar
    // com credenciais inválidas e falhar novamente.
    if (existing) {
      if (existing.status === "ERROR" && existing.clearSession) {
        await existing.clearSession().catch(() => {});
      }
      this.sessions.delete(instanceId);
    }

    const { state, saveCreds, clearSession } = await useDatabaseAuthState(instanceId);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["OmniFlow", "Chrome", "20.0.04"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 15000,
    });

    const entry: SessionEntry = { socket, status: "CONNECTING", lastEventAt: Date.now(), clearSession };
    this.sessions.set(instanceId, entry);

    // Watchdog: se nenhum evento chegar em 10 min com sessão CONNECTED, reconecta.
    // Detecta o estado "zombie" onde o WebSocket pode enviar mas não recebe push.
    // 10 min é suficiente — o keepAliveIntervalMs: 15s já mantém o socket vivo;
    // o watchdog é apenas segurança contra zombies de longa duração.
    const startWatchdog = () => {
      if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer);
      entry.watchdogTimer = setTimeout(() => {
        if (entry.status !== "CONNECTED") return;
        const silenceSec = Math.round((Date.now() - (entry.lastEventAt ?? 0)) / 1000);
        console.warn(`[session-manager:watchdog] ${instanceId.slice(0,8)} silêncio ${silenceSec}s — forçando reconexão`);
        try { socket.end(new Error("watchdog timeout")); } catch {}
      }, 600_000); // 10 minutos
    };

    const refreshWatchdog = () => {
      entry.lastEventAt = Date.now();
      startWatchdog();
    };

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;
      refreshWatchdog();

      if (qr) {
        entry.status = "QR_PENDING";
        entry.qrCode = qr;
      }

      if (connection === "open") {
        entry.status = "CONNECTED";
        entry.qrCode = undefined;
        console.log(`[session-manager] ${instanceId.slice(0,8)} conectado — watchdog ativo (10 min)`);
        startWatchdog();
      }

      if (connection === "close") {
        if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer);
        const disconnectCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = disconnectCode !== DisconnectReason.loggedOut;
        entry.status = shouldReconnect ? "DISCONNECTED" : "ERROR";

        if (shouldReconnect) {
          // Reconexão automática para desconexões transientes
          this.sessions.delete(instanceId);
          this.connect(instanceId).catch((err: Error) =>
            console.error(`[session-manager] Reconexão falhou para ${instanceId}:`, err.message)
          );
        } else {
          // loggedOut: credenciais invalidadas — limpa do banco
          // para que o próximo connect() gere um QR Code limpo.
          clearSession().catch(() => {});
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      refreshWatchdog();
      console.log(`[baileys:${instanceId.slice(0,8)}] messages.upsert type=${type} count=${messages.length}`);
      // notify = tempo real | append = entregue enquanto offline
      if (type !== "notify" && type !== "append") return;
      for (const msg of messages) {
        const jid = msg.key.remoteJid ?? "";
        console.log(`[baileys:${instanceId.slice(0,8)}] msg fromMe=${msg.key.fromMe} jid=${jid} id=${msg.key.id}`);
        // Aceita conversas 1-a-1: @s.whatsapp.net (número direto) ou @lid (identidade de privacidade)
        if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) continue;
        if (msg.key.fromMe) {
          // Mensagem enviada pelo celular físico — registra como OUTBOUND sem rodar bot
          await publishPhoneOutbound(instanceId, msg);
          continue;
        }
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
    const bare = to.replace(/^\+/, "");
    const jid = bare.includes("@") ? bare : `${bare}@s.whatsapp.net`;
    const result = await entry.socket.sendMessage(jid, { text });
    return { providerMessageId: result?.key.id ?? "", sentAt: new Date() };
  }

  async sendListMenu(
    instanceId: string,
    to: string,
    header: string,
    options: { id: string; label: string }[]
  ) {
    const entry = this.requireConnected(instanceId);
    const bare = to.replace(/^\+/, "");
    const jid = bare.includes("@") ? bare : `${bare}@s.whatsapp.net`;
    try {
      // Constrói listMessage via proto diretamente — a API de alto nível do Baileys
      // ignora buttonText/sections quando "text" está presente no objeto.
      const listProto: proto.IMessage = {
        listMessage: {
          title: header || "Selecione uma opção:",
          buttonText: "Ver opções",
          listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
          sections: [{
            title: "Opções disponíveis",
            rows: options.map((opt, i) => ({
              title: opt.label,
              rowId: String(i + 1),
            })),
          }],
        },
      };
      const waMsg = generateWAMessageFromContent(jid, listProto, {
        userJid: entry.socket.user?.id ?? "",
      });
      await entry.socket.relayMessage(jid, waMsg.message!, { messageId: waMsg.key.id! });
    } catch {
      // Contas pessoais não suportam mensagens de lista — envia como texto simples
      const lines = options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      await entry.socket.sendMessage(jid, { text: `${header || "Selecione uma opção:"}\n\n${lines}` });
    }
  }

  async sendMedia(
    instanceId: string,
    to: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string,
    ptt = false
  ) {
    const entry = this.requireConnected(instanceId);
    const bare = to.replace(/^\+/, "");
    const jid = bare.includes("@") ? bare : `${bare}@s.whatsapp.net`;

    const contentKey = mediaType === "document" ? "document" : mediaType;
    const result = await entry.socket.sendMessage(jid, {
      [contentKey]: { url: mediaUrl },
      caption: mediaType !== "audio" ? caption : undefined,
      ptt: mediaType === "audio" ? ptt : undefined,
      mimetype: mediaType === "audio" ? "audio/ogg; codecs=opus" : undefined,
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