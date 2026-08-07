import { Worker, Job } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queues/queue-names";
import { sessionManager } from "./session-manager";

interface BaileysCommandJob {
  instanceId: string;
  command: "connect" | "disconnect" | "get_state" | "send_text" | "send_media";
  payload?: any;
}

/**
 * Este worker é o outro lado da fachada `BaileysProvider` (ver
 * packages/providers/src/whatsapp/baileys.provider.ts). A API
 * publica um job aqui e espera a resposta via `job.waitUntilFinished`
 * — ver `apps/api/src/modules/whatsapp/baileys-queue.client.ts`.
 *
 * `concurrency: 50` é seguro aqui porque cada handler é rápido
 * (delega para um socket já aberto em memória) — não confundir com
 * o número de sessões simultâneas, que é ilimitado dentro da memória
 * disponível do processo.
 */
export function startBaileysWorker() {
  const worker = new Worker<BaileysCommandJob>(
    QUEUE_NAMES.BAILEYS_COMMANDS,
    async (job: Job<BaileysCommandJob>) => {
      const { instanceId, command, payload } = job.data;

      switch (command) {
        case "connect":
          return sessionManager.connect(instanceId);

        case "disconnect":
          return sessionManager.disconnect(instanceId);

        case "get_state":
          return sessionManager.getState(instanceId);

        case "send_text":
          return sessionManager.sendText(instanceId, payload.to, payload.text);

        case "send_media":
          return sessionManager.sendMedia(
            instanceId,
            payload.to,
            payload.mediaUrl,
            payload.mediaType,
            payload.caption
          );

        default: {
          const _exhaustive: never = command;
          throw new Error(`Comando desconhecido: ${_exhaustive}`);
        }
      }
    },
    { connection: getRedisConnectionOptions(), concurrency: 50 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} (${job?.data.command}) falhou:`, err);
  });

  return worker;
}
