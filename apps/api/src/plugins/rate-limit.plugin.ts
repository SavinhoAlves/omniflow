import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface WindowEntry {
  count: number;
  resetAt: number; // Unix timestamp (seconds)
}

// In-memory fixed-window rate limiter.
// Adequate for single-replica deployments. For multi-replica, swap
// the `windows` Map for a Redis INCR/EXPIRE implementation.
const windows = new Map<string, WindowEntry>();

function checkLimit(
  key: string,
  limit: number,
  windowSeconds: number
): { allowed: boolean; current: number; resetAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const fullKey = `rl:${key}`;
  const entry = windows.get(fullKey);

  if (!entry || now >= entry.resetAt) {
    windows.set(fullKey, { count: 1, resetAt: now + windowSeconds });
    return { allowed: true, current: 1, resetAt: now + windowSeconds };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    current: entry.count,
    resetAt: entry.resetAt,
  };
}

// Prune stale entries every 5 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, entry] of windows.entries()) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}, 5 * 60 * 1000).unref();

interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
  message: string;
}

async function enforce(
  req: FastifyRequest,
  reply: FastifyReply,
  rule: RateLimitRule
): Promise<boolean> {
  const { allowed, current, resetAt } = checkLimit(
    rule.key,
    rule.limit,
    rule.windowSeconds
  );

  reply.header("X-RateLimit-Limit", rule.limit);
  reply.header("X-RateLimit-Remaining", Math.max(0, rule.limit - current));
  reply.header("X-RateLimit-Reset", resetAt);

  if (!allowed) {
    reply
      .status(429)
      .header("Retry-After", resetAt - Math.floor(Date.now() / 1000))
      .send({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: rule.message,
        },
      });
    return false;
  }
  return true;
}

export function rateLimitPlugin(app: FastifyInstance): void {
  app.addHook("preHandler", async (req, reply) => {
    const url = req.url.split("?")[0];

    // ── AUTH: 5 tentativas por minuto por IP ──────────────────
    if (
      url === "/auth/login" ||
      url === "/auth/register" ||
      url === "/platform-auth/login"
    ) {
      const allowed = await enforce(req, reply, {
        key: `auth:${req.ip}`,
        limit: 5,
        windowSeconds: 60,
        message: "Muitas tentativas de autenticação. Aguarde 1 minuto.",
      });
      if (!allowed) return;
    }

    // ── TENANT: 300 req / minuto por empresa ──────────────────
    const companyId = (req as any).auth?.companyId;
    if (companyId) {
      const allowed = await enforce(req, reply, {
        key: `tenant:${companyId}`,
        limit: 300,
        windowSeconds: 60,
        message: "Limite de requisições excedido. Aguarde 1 minuto.",
      });
      if (!allowed) return;
    }
  });
}
