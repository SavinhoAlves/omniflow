import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS, PermissionKey, splitPermissionKey } from "../../shared/permissions.catalog";

const overrideSchema = z.object({
  userId: z.string().uuid(),
  permission: z.custom<PermissionKey>((v) => Object.values(PERMISSIONS).includes(v as any)),
  granted: z.boolean(),
});

export async function permissionsRoutes(app: FastifyInstance) {
  // Só quem gerencia usuários pode ajustar permissões pontuais —
  // reutiliza a mesma permissão de USERS_MANAGE em vez de criar uma
  // nova, já que conceder permissão é, na prática, gerenciar o
  // usuário.
  app.post(
    "/permissions/overrides",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (request, reply) => {
      const body = overrideSchema.parse(request.body);
      const { resource, action } = splitPermissionKey(body.permission);

      // upsert: se já existir override para esse par (userId,
      // resource, action), atualiza; senão cria. Evita duplicidade e
      // permite "mudar de ideia" (grant -> revoke) sem lixo no banco.
      const override = await prisma.userPermissionOverride.upsert({
        where: {
          userId_resource_action: { userId: body.userId, resource, action },
        },
        create: { userId: body.userId, resource, action, allowed: body.granted },
        update: { allowed: body.granted },
      });

      return reply.status(200).send(override);
    }
  );

  app.get(
    "/permissions/catalog",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (_request, reply) => {
      // Exposto pra UI construir a tela de configuração de
      // permissões dinamicamente, sem hardcodar a lista no frontend.
      return reply.send({ permissions: Object.values(PERMISSIONS) });
    }
  );
}
