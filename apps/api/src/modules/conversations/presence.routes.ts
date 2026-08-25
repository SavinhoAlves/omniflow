import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

// In-memory agent presence store.
// TTL: 90s — agents must heartbeat every 60s or they go offline.
// For multi-replica: swap for Redis HSET with EXPIRE.

interface PresenceEntry {
  userId: string;
  name: string;
  status: "online" | "away" | "busy";
  companyId: string;
  updatedAt: number;
}

const TTL_MS = 90_000;
const presence = new Map<string, PresenceEntry>(); // key = userId

// Prune stale entries every minute
setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of presence.entries()) {
    if (entry.updatedAt < cutoff) presence.delete(key);
  }
}, 60_000).unref();

export async function presenceRoutes(app: FastifyInstance) {
  // Agent heartbeat — call every 30-60s to stay online
  app.post(
    "/presence/heartbeat",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { status } = (request.body as any) ?? {};

      presence.set(auth.userId, {
        userId: auth.userId,
        name: auth.name,
        status: (["online", "away", "busy"].includes(status) ? status : "online") as PresenceEntry["status"],
        companyId: auth.companyId,
        updatedAt: Date.now(),
      });

      return reply.send({ ok: true });
    }
  );

  // List online agents for this company (for inbox agent selector)
  app.get(
    "/presence",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const cutoff = Date.now() - TTL_MS;
      const online: Omit<PresenceEntry, "companyId">[] = [];

      for (const entry of presence.values()) {
        if (entry.companyId === auth.companyId && entry.updatedAt >= cutoff) {
          const { companyId: _, ...safe } = entry;
          online.push(safe);
        }
      }

      return reply.send(online);
    }
  );
}
