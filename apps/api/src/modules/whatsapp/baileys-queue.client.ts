import { Queue, QueueEvents } from "bullmq";

const QUEUE_NAME = "baileys-commands";

function getRedisConnectionOptions() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

/**
 * Implementa a interface `BaileysCommandQueue` esperada por
 * `BaileysProvider` (packages/providers). Publica o comando na fila
 * que `apps/workers` consome e aguarda o resultado — do ponto de
 * vista do service que chama `provider.connect()`, isso se comporta
 * como uma chamada assíncrona comum, mesmo por baixo dos panos
 * atravessando um worker separado.
 *
 * `waitUntilFinished` tem timeout de 30s — suficiente para conectar
 * um socket Baileys (que já tinha sessão salva) ou obter um QR Code,
 * mas não trava a request indefinidamente se o worker estiver fora
 * do ar.
 */
export class BaileysQueueClient {
  private queue: Queue;
  private queueEvents: QueueEvents;

  constructor() {
    const connection = getRedisConnectionOptions();
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  }

  async enqueue<T>(instanceId: string, command: string, payload?: unknown): Promise<T> {
    const job = await this.queue.add(command, { instanceId, command, payload });
    const result = await job.waitUntilFinished(this.queueEvents, 30_000);
    return result as T;
  }
}
