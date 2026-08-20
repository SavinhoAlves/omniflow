import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePlatform } from "../../middlewares/platform.middleware";
import { InstallationsService } from "./installations.service";

const createSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().optional(),
  version: z.string().optional(),
  status: z.enum(["PENDING", "ACTIVE", "MAINTENANCE", "OFFLINE"]).optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  version: z.string().optional(),
  status: z.enum(["PENDING", "ACTIVE", "MAINTENANCE", "OFFLINE"]).optional(),
  lastSyncAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function installationsRoutes(app: FastifyInstance) {
  const service = new InstallationsService();

  app.get(
    "/platform/installations",
    { preHandler: requirePlatform() },
    async (_request, reply) => {
      const installations = await service.list();
      return reply.send(installations);
    }
  );

  app.get(
    "/platform/companies/:companyId/installations",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const installations = await service.listByCompany(companyId);
      return reply.send(installations);
    }
  );

  app.post(
    "/platform/installations",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      try {
        const installation = await service.create(body);
        return reply.status(201).send(installation);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Empresa não encontrada" });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/platform/installations/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSchema.parse(request.body);
      try {
        const installation = await service.update(id, body);
        return reply.send(installation);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Instalação não encontrada" });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/platform/installations/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.delete(id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Instalação não encontrada" });
        }
        throw err;
      }
    }
  );
}
