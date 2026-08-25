import { FastifyInstance } from "fastify";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";

// In-process event bus: conversationId → Set of writer callbacks.
// Workers insert messages into Postgres; the API polls for them here.
// For multi-replica deployments, replace with Redis pub/sub subscription.
const subscribers = new Map<string, Set<(data: string) => void>>();

export function broadcastConversationEvent(conversationId: string, event: unknown) {
  const subs = subscribers.get(conversationId);
  if (!subs?.size) return;
  const payload = JSON.stringify(event);
  for (const write of subs) {
    try { write(payload); } catch { /* client disconnected */ }
  }
}

export async function sseRoutes(app: FastifyInstance) {
  // SSE stream for a conversation — streams new messages as they arrive.
  // Client connects once; server pushes events without repeated HTTP requests.
  // Replaces the 3-5s frontend polling loop.
  app.get(
    "/conversations/:id/events",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const companyId = (request as any).auth?.companyId as string;

      // Validate conversation belongs to this company
      const exists = await tenantStorage.run({ companyId }, () =>
        prisma.conversation.findFirst({ where: { id }, select: { id: true } })
      );
      if (!exists) {
        return reply.status(404).send({ error: "Conversa não encontrada" });
      }

      // Hijack the connection — Fastify will not send a response automatically
      reply.hijack();
      const raw = reply.raw;
      raw.setHeader("Content-Type", "text/event-stream");
      raw.setHeader("Cache-Control", "no-cache, no-transform");
      raw.setHeader("Connection", "keep-alive");
      raw.setHeader("X-Accel-Buffering", "no");   // disable nginx buffering
      raw.flushHeaders();

      // Track the newest message seen so far (poll anchor)
      let since = new Date();

      const write = (payload: string) => {
        raw.write(`data: ${payload}\n\n`);
      };

      // Register this subscriber
      if (!subscribers.has(id)) subscribers.set(id, new Set());
      subscribers.get(id)!.add(write);

      // Track conversation update timestamp to detect mutations (assign, status, priority)
      let convUpdatedAt: Date | null = null;

      // DB poll loop — checks for messages newer than `since`.
      // Even with SSE, we poll so that messages written by other workers
      // (Baileys, webhooks) are delivered to clients on this replica.
      const pollInterval = setInterval(async () => {
        try {
          const [messages, conv] = await tenantStorage.run({ companyId }, () =>
            Promise.all([
              prisma.message.findMany({
                where: { conversationId: id, createdAt: { gt: since } },
                include: { author: { select: { id: true, name: true } } },
                orderBy: { createdAt: "asc" },
              }),
              prisma.conversation.findFirst({
                where: { id },
                select: { updatedAt: true, status: true, priority: true, assignedToId: true, unreadCount: true },
              }),
            ])
          );

          for (const msg of messages) {
            write(JSON.stringify({ type: "message", data: msg }));
            if (msg.createdAt > since) since = msg.createdAt;
          }

          // Notify when conversation metadata changes (status, assignee, priority)
          if (conv && (!convUpdatedAt || conv.updatedAt > convUpdatedAt)) {
            if (convUpdatedAt !== null) {
              write(JSON.stringify({ type: "conversation_updated", data: conv }));
            }
            convUpdatedAt = conv.updatedAt;
          }
        } catch {
          // DB error — client will reconnect via EventSource retry
        }
      }, 1500);

      // Keepalive ping every 25 seconds to prevent proxy/LB timeouts
      const pingInterval = setInterval(() => {
        raw.write(": ping\n\n");
      }, 25000);

      // Cleanup on client disconnect
      const cleanup = () => {
        clearInterval(pollInterval);
        clearInterval(pingInterval);
        subscribers.get(id)?.delete(write);
        if (subscribers.get(id)?.size === 0) subscribers.delete(id);
      };

      request.raw.on("close", cleanup);
      request.raw.on("error", cleanup);
    }
  );
}
