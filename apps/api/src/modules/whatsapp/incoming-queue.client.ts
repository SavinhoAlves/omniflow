import { Queue } from "bullmq";
import type { IncomingMessageEvent, MessageStatusEvent } from "@omnichannel/providers";

function getRedisOptions() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const { hostname, port, password } = new URL(url);
  return {
    host: hostname,
    port: Number(port || 6379),
    password: password || undefined,
  };
}

const INCOMING = "incoming-messages";
const STATUS   = "message-status-updates";

/**
 * Publicador de eventos de webhook para as filas BullMQ.
 * Instanciado uma vez por processo API — as filas são lazy-connect.
 */
export class IncomingQueueClient {
  private readonly incomingQueue: Queue;
  private readonly statusQueue: Queue;

  constructor() {
    const connection = getRedisOptions();
    this.incomingQueue = new Queue(INCOMING, { connection });
    this.statusQueue   = new Queue(STATUS,   { connection });
  }

  async publishIncomingMessage(event: IncomingMessageEvent): Promise<void> {
    await this.incomingQueue.add("incoming", event, { removeOnComplete: 100, removeOnFail: 50 });
  }

  async publishStatusUpdate(event: MessageStatusEvent): Promise<void> {
    await this.statusQueue.add("status", event, { removeOnComplete: 500, removeOnFail: 100 });
  }
}
