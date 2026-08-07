import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthError } from "./auth.service";

const registerSchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  companySlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE = "refresh_token";

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService();

  // Rotas marcadas como `public` pulam o middleware de tenant
  // (ver middlewares/tenant.middleware.ts), pois ainda não existe
  // um tenant autenticado neste ponto do fluxo.

  app.post(
    "/auth/register",
    { config: { public: true } },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const { accessToken, refreshToken } = await authService.registerCompany(body);

      reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOptions());
      return reply.status(201).send({ accessToken });
    }
  );

  app.post(
    "/auth/login",
    { config: { public: true } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      try {
        const { accessToken, refreshToken } = await authService.login(
          body.email,
          body.password,
          body.companySlug
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
    "/auth/refresh",
    { config: { public: true } },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE];
      if (!rawToken) return reply.status(401).send({ error: "Refresh token ausente" });

      try {
        const { accessToken, refreshToken } = await authService.refresh(rawToken);
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
    "/auth/logout",
    { config: { public: true } },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE];
      if (rawToken) await authService.logout(rawToken);
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
    path: "/auth",
    maxAge: 60 * 60 * 24 * 7, // 7 dias, espelha o TTL do refresh token
  };
}
