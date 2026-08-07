import { tenantStorage } from "@omnichannel/database";
import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, CustomJwtPayload } from "../shared/jwt";

/**
 * Dados de autenticação/autorização já resolvidos, disponíveis em
 * qualquer handler depois deste middleware rodar. `permission.middleware.ts`
 * depende de `request.auth` estar populado.
 */
export interface RequestAuth {
  userId: string;
  companyId?: string; // ausente para usuários da plataforma (Super Admin)
  role: string;
  type: "platform" | "tenant";
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: RequestAuth;
  }
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Rotas marcadas como `public` (ver config: { public: true } nas
  // rotas) não exigem autenticação — mas como esse hook roda global
  // (onRequest), ele precisa saber pular sem barrar a requisição.
  if ((request.routeOptions?.config as any)?.public) {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Unauthorized", message: "Token de acesso ausente" });
    return;
  }

  let decoded: CustomJwtPayload;
  try {
    decoded = verifyAccessToken(authHeader.slice("Bearer ".length));
  } catch {
    reply.code(401).send({ error: "Unauthorized", message: "Token inválido ou expirado" });
    return;
  }

  // Usuário da plataforma (Super Admin) não pertence a nenhum
  // tenant — não passa pelo isolamento de company_id/RLS.
  if (decoded.type === "platform") {
    request.auth = {
      userId: decoded.sub,
      role: decoded.role,
      type: "platform",
      permissions: [],
    };
    return;
  }

  if (!decoded.companyId) {
    reply.code(401).send({ error: "Unauthorized", message: "Tenant company context is missing" });
    return;
  }

  request.auth = {
    userId: decoded.sub,
    companyId: decoded.companyId,
    role: decoded.role,
    type: "tenant",
    permissions: decoded.permissions ?? [],
  };

  tenantStorage.enterWith({ companyId: decoded.companyId });
}
