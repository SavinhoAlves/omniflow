try { process.loadEnvFile(); } catch {}
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
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
import { contactsRoutes } from "./modules/contacts/contacts.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { messengerRoutes } from "./modules/messenger/messenger.routes";
import { tenantMiddleware } from "./middlewares/tenant.middleware";

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
  app.register(contactsRoutes);
  app.register(reportsRoutes);
  app.register(messengerRoutes);

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
