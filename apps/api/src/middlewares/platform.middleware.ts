import { FastifyReply, FastifyRequest } from "fastify";

/**
 * Bloqueia rotas exclusivas de plataforma (ex: gestão de empresas
 * clientes) para qualquer requisição que não seja de um PlatformUser
 * autenticado (Super Admin/Suporte).
 *
 * Por que isto não pode reusar `requirePermission()`: aquele
 * middleware checa `auth.permissions`, que é a lista de permissões
 * de TENANT (ver PERMISSIONS em permissions.catalog.ts) — um
 * usuário de plataforma sempre tem `permissions: []` (ver
 * tenantMiddleware), então `requirePermission` barraria sempre,
 * mesmo para um Super Admin legítimo. É um espaço de autorização
 * diferente (plataforma vs. tenant), por isso o middleware próprio.
 */
export function requirePlatform() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const auth = request.auth;
    if (!auth) {
      return reply.status(401).send({ error: "Não autenticado" });
    }

    if (auth.type !== "platform") {
      // 404 em vez de 403: rotas de plataforma nem deveriam ser
      // "descobríveis" por um tenant comum tentando enumerar a API.
      return reply.status(404).send({ error: "Não encontrado" });
    }
  };
}
