import { FastifyInstance } from "fastify";
import { prisma, tenantStorage } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { suggestReplies, categorize, analyzeSentiment, summarize, analyzeAndPersist } from "./ai.service";

export async function aiRoutes(app: FastifyInstance) {
  // T8.1: Reply suggestions
  app.get(
    "/ai/conversations/:id/suggestions",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      // Check if fresh cached result exists (< 5 min old)
      const cached = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.aiConversationMeta.findUnique({
          where: { conversationId: id },
          select: { suggestedReplies: true, lastProcessedAt: true },
        })
      );

      const cacheAge = cached?.lastProcessedAt
        ? Date.now() - cached.lastProcessedAt.getTime()
        : Infinity;

      if (cached && cacheAge < 5 * 60 * 1000) {
        return reply.send({ suggestions: cached.suggestedReplies });
      }

      const suggestions = await suggestReplies(id, auth.companyId);
      return reply.send({ suggestions });
    }
  );

  // T8.2: Auto-categorize
  app.post(
    "/ai/conversations/:id/categorize",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const category = await categorize(id, auth.companyId);
      return reply.send({ category });
    }
  );

  // T8.3: Sentiment analysis
  app.get(
    "/ai/conversations/:id/sentiment",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const result = await analyzeSentiment(id, auth.companyId);
      return reply.send(result);
    }
  );

  // T8.4: Conversation summary
  app.get(
    "/ai/conversations/:id/summary",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      const cached = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.aiConversationMeta.findUnique({
          where: { conversationId: id },
          select: { summary: true },
        })
      );

      if (cached?.summary) {
        return reply.send({ summary: cached.summary });
      }

      const summary = await summarize(id, auth.companyId);
      return reply.send({ summary });
    }
  );

  // Full analysis (all 4 in parallel) + persist
  app.post(
    "/ai/conversations/:id/analyze",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };
      const result = await analyzeAndPersist(id, auth.companyId);
      return reply.send(result);
    }
  );

  // Get stored AI metadata for a conversation
  app.get(
    "/ai/conversations/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = (request as any).auth!;
      const { id } = request.params as { id: string };

      const meta = await tenantStorage.run({ companyId: auth.companyId }, () =>
        prisma.aiConversationMeta.findUnique({ where: { conversationId: id } })
      );

      if (!meta) return reply.status(404).send({ error: "Análise não encontrada para esta conversa" });
      return reply.send(meta);
    }
  );
}
