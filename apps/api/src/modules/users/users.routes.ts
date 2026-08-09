import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { UsersService } from "./users.service";
import { logActivity } from "../../shared/activity-logger";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
  departmentIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  active: z.boolean().optional(),
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
        const auth = request.auth!;
        const user = await service.create(body);
        logActivity({
          companyId: auth.companyId,
          userId: auth.userId,
          userName: auth.name,
          action: "user.created",
          entity: "user",
          entityId: user.id,
          details: { name: user.name, email: user.email, role: user.role },
          ip: request.ip,
        });
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

  app.patch(
    "/users/:id",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const body = updateSchema.parse(request.body);
      try {
        const updated = await service.update(id, body);
        logActivity({
          companyId: auth.companyId,
          userId: auth.userId,
          userName: auth.name,
          action: "user.updated",
          entity: "user",
          entityId: id,
          details: { changes: body },
          ip: request.ip,
        });
        return reply.send(updated);
      } catch (err: any) {
        if (err.code === "OWNER_PROTECTED") return reply.status(403).send({ error: err.message });
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.status(409).send({ error: "Já existe um atendente com este email" });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/users/:id",
    { preHandler: requirePermission(PERMISSIONS.USERS_MANAGE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      try {
        await service.delete(id);
        logActivity({
          companyId: auth.companyId,
          userId: auth.userId,
          userName: auth.name,
          action: "user.deleted",
          entity: "user",
          entityId: id,
          ip: request.ip,
        });
        return reply.status(204).send();
      } catch (err: any) {
        if (err.code === "OWNER_PROTECTED") return reply.status(403).send({ error: err.message });
        throw err;
      }
    }
  );
}
