/**
 * Nomes de fila e conexão Redis usados tanto pela API (que publica
 * comandos) quanto pelos Workers (que consomem). Mantido como
 * constantes simples duplicadas entre `apps/api` e `apps/workers`
 * por ora — se um terceiro consumidor aparecer, vale extrair para
 * um pacote `packages/queue-config` compartilhado.
 */
export const QUEUE_NAMES = {
  BAILEYS_COMMANDS: "baileys-commands",
  INCOMING_MESSAGES: "incoming-messages",
} as const;

export function getRedisConnectionOptions() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}
