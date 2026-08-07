import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { UsersService } from "./users.service";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
  departmentIds: z.array(z.string().uuid()).optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  const service = new UsersService();

  app.get(
    "/users",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (_request, reply) => {
      const users = await service.list();
      return reply.send(users);
    }
  );

  app.post(
    "/users",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      try {
        const user = await service.create(body);
        return reply.status(201).send(user);
      } catch (err) {
        // P2002 = violação de unique constraint — aqui só pode ser
        // (companyId, email), já que email não é mais único global
        // (ver migration fix_schema_drift).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.status(409).send({ error: "Já existe um atendente com este email" });
        }
        throw err;
      }
    }
  );
}
