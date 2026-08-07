import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { DepartmentsService } from "./departments.service";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function departmentsRoutes(app: FastifyInstance) {
  const service = new DepartmentsService();

  app.get(
    "/departments",
    // Sem preHandler extra: tenantMiddleware (onRequest) já garante que o
    // usuário é um tenant autenticado válido. Departamentos são dados de
    // configuração visíveis a qualquer role — MEMBER precisa deles para
    // carregar Workflows e o Dashboard. Apenas criação/edição exige
    // DEPARTMENTS_MANAGE (rotas abaixo).
    async (_request, reply) => {
      const departments = await service.list();
      return reply.send(departments);
    }
  );

  app.post(
    "/departments",
    { preHandler: requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE) },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      const department = await service.create(body);
      return reply.status(201).send(department);
    }
  );

  app.patch(
    "/departments/:id",
    { preHandler: requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSchema.parse(request.body);
      try {
        const department = await service.update(id, body);
        return reply.send(department);
      } catch (err) {
        // P2025 = "Record to update not found" — dispara tanto pra
        // um id inexistente quanto pra um id de OUTRO tenant (o
        // middleware do Prisma injeta companyId no where, então a
        // query simplesmente não encontra a linha nesse segundo
        // caso também). Mesmo retorno pros dois: 404, nunca vaza
        // qual dos dois motivos foi.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Departamento não encontrado" });
        }
        throw err;
      }
    }
  );
}
