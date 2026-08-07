import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { CompanyProfileService } from "./company-profile.service";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
});

export async function companyProfileRoutes(app: FastifyInstance) {
  const service = new CompanyProfileService();

  app.get(
    "/companies/me",
    { preHandler: requirePermission(PERMISSIONS.SETTINGS_MANAGE) },
    async (request, reply) => {
      // request.auth.companyId sempre existe aqui: requirePermission só
      // passa pra usuário type "tenant" (plataforma tem permissions: []
      // e nunca bate com nenhuma permissão exigida).
      const profile = await service.getProfile(request.auth!.companyId!);
      return reply.send(profile);
    }
  );

  app.patch(
    "/companies/me",
    { preHandler: requirePermission(PERMISSIONS.SETTINGS_MANAGE) },
    async (request, reply) => {
      const body = updateSchema.parse(request.body);
      const profile = await service.updateProfile(request.auth!.companyId!, body);
      return reply.send(profile);
    }
  );
}
