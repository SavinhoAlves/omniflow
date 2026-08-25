try { process.loadEnvFile(); } catch {}
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@omnichannel/database";
import { authRoutes } from "./modules/auth/auth.routes";
import { platformAuthRoutes } from "./modules/platform-auth/platform-auth.routes";
import { permissionsRoutes } from "./modules/permissions/permissions.routes";
import { whatsappRoutes } from "./modules/whatsapp/whatsapp.routes";
import { departmentsRoutes } from "./modules/departments/departments.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { companiesRoutes } from "./modules/companies/companies.routes";
import { companyProfileRoutes } from "./modules/company-profile/company-profile.routes";
import { workflowsRoutes } from "./modules/workflows/workflows.routes";
import { conversationsRoutes } from "./modules/conversations/conversations.routes";
import { sseRoutes } from "./modules/conversations/sse.routes";
import { presenceRoutes } from "./modules/conversations/presence.routes";
import { savedRepliesRoutes } from "./modules/productivity/saved-replies.routes";
import { automationsRoutes } from "./modules/automations/automations.routes";
import { scheduledMessagesRoutes } from "./modules/conversations/scheduled-messages.routes";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { aiRoutes } from "./modules/ai/ai.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { contactsRoutes } from "./modules/contacts/contacts.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { messengerRoutes } from "./modules/messenger/messenger.routes";
import { activityLogRoutes } from "./modules/activity-log/activity-log.routes";
import { contractsRoutes } from "./modules/contracts/contracts.routes";
import { installationsRoutes } from "./modules/installations/installations.routes";
import { ticketsRoutes } from "./modules/tickets/tickets.routes";
import { tenantMiddleware } from "./middlewares/tenant.middleware";
import { rateLimitPlugin } from "./plugins/rate-limit.plugin";
import { securityPlugin } from "./plugins/security.plugin";

export function buildServer() {
  const app = Fastify({ logger: true });

  // Fastify rejects POST with Content-Type: application/json but no body.
  // Override the parser to treat an empty body as undefined instead of an error.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body || (body as string).trim() === "") {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  app.register(cookie);

  // Security headers e rate limiting são registrados diretamente
  // no app raiz (não via app.register) para que os hooks se apliquem
  // a TODAS as rotas, independente de escopo de plugin.
  securityPlugin(app);
  rateLimitPlugin(app);

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
  });

  // Hook global de tenant — usa o ÚNICO prisma client tenant-aware
  // exportado por @omnichannel/database (nunca um client "cru"
  // separado, senão o SET de RLS acontece numa conexão diferente da
  // que as queries de fato usam).
  app.addHook("onRequest", async (request, reply) => {
    await tenantMiddleware(request, reply);
  });

  // Health básico
  app.get(
    "/health",
    { config: { public: true } },
    async () => ({
      status: "ok",
    })
  );

  // Teste real do PostgreSQL
  app.get(
    "/health/database",
    { config: { public: true } },
    async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;

        return {
          status: "ok",
          database: "connected",
        };
      } catch (error) {
        app.log.error(error);

        return {
          status: "error",
          database: "disconnected",
        };
      }
    }
  );

  // Serve arquivos de mídia enviados pelos atendentes
  const MIME_MAP: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", mp4: "video/mp4", webm: "video/webm", oga: "audio/ogg",
    ogg: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", pdf: "application/pdf",
  };
  app.get("/uploads/:filename", { config: { public: true } }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    if (!/^[\w.-]+$/.test(filename)) return reply.status(400).send();
    const filePath = path.join(process.cwd(), "uploads", filename);
    try {
      const buffer = await fs.readFile(filePath);
      const ext = filename.split(".").pop() ?? "";
      reply.header("Content-Type", MIME_MAP[ext] ?? "application/octet-stream");
      reply.header("Cache-Control", "public, max-age=86400");
      return reply.send(buffer);
    } catch {
      return reply.status(404).send({ error: "Arquivo não encontrado" });
    }
  });

  app.register(authRoutes);
  app.register(platformAuthRoutes);
  app.register(permissionsRoutes);
  app.register(whatsappRoutes);
  app.register(departmentsRoutes);
  app.register(usersRoutes);
  app.register(companiesRoutes);
  app.register(companyProfileRoutes);
  app.register(workflowsRoutes);
  app.register(conversationsRoutes);
  app.register(sseRoutes);
  app.register(presenceRoutes);
  app.register(savedRepliesRoutes);
  app.register(automationsRoutes);
  app.register(scheduledMessagesRoutes);
  app.register(campaignsRoutes);
  app.register(aiRoutes);
  app.register(billingRoutes);
  app.register(contactsRoutes);
  app.register(reportsRoutes);
  app.register(messengerRoutes);
  app.register(activityLogRoutes);
  app.register(contractsRoutes);
  app.register(installationsRoutes);
  app.register(ticketsRoutes);

  return app;
}

async function start() {
  const app = buildServer();

  const port = Number(process.env.PORT ?? 3333);

  try {
    await app.listen({
      port,
      host: "0.0.0.0",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
