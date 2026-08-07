import { FastifyReply, FastifyRequest } from "fastify";
import { PermissionKey } from "../shared/permissions.catalog";

/**
 * Uso em qualquer rota, depois do tenantMiddleware já ter populado
 * `request.auth`:
 *
 *   app.post("/campaigns", { preHandler: requirePermission(PERMISSIONS.CAMPAIGNS_CREATE) }, handler)
 *
 * Mantido como factory (função que retorna preHandler) em vez de
 * hook global porque a permissão exigida varia por rota — diferente
 * do tenantMiddleware, que é o mesmo para toda request autenticada.
 */
export function requirePermission(required: PermissionKey) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const auth = request.auth;
    if (!auth) {
      // Não deveria acontecer se tenantMiddleware rodou antes, mas
      // falhar explicitamente é melhor que assumir acesso.
      return reply.status(401).send({ error: "Não autenticado" });
    }

    if (!auth.permissions.includes(required)) {
      return reply.status(403).send({
        error: "Permissão insuficiente",
        required,
      });
    }
  };
}
