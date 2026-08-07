import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PlatformAuthService } from "./platform-auth.service";
import { AuthError } from "../auth/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Nome e path de cookie DIFERENTES do fluxo de tenant
// (ver auth.routes.ts) — de propósito. Mesmo que as duas apps
// (client e platform) apontem pro mesmo domínio de API em dev,
// um login não pode sobrescrever a sessão do outro no mesmo
// navegador.
const REFRESH_COOKIE = "platform_refresh_token";

export async function platformAuthRoutes(app: FastifyInstance) {
  const platformAuthService = new PlatformAuthService();

  app.post(
    "/platform-auth/login",
    { config: { public: true } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      try {
        const { accessToken, refreshToken } = await platformAuthService.login(
          body.email,
          body.password
        );
        reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOptions());
        return reply.send({ accessToken });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  app.post(
    "/platform-auth/refresh",
    { config: { public: true } },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE];
      if (!rawToken) return reply.status(401).send({ error: "Refresh token ausente" });

      try {
        const { accessToken, refreshToken } = await platformAuthService.refresh(rawToken);
        reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOptions());
        return reply.send({ accessToken });
      } catch (err) {
        if (err instanceof AuthError) {
          reply.clearCookie(REFRESH_COOKIE);
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  app.post(
    "/platform-auth/logout",
    { config: { public: true } },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE];
      if (rawToken) await platformAuthService.logout(rawToken);
      reply.clearCookie(REFRESH_COOKIE);
      return reply.status(204).send();
    }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/platform-auth",
    maxAge: 60 * 60 * 24 * 7,
  };
}
