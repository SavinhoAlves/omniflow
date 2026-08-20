import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePlatform } from "../../middlewares/platform.middleware";
import { TicketsService } from "./tickets.service";

const createSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().min(1),
  type: z.enum(["SYNC", "INSTALLATION", "BUG", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(1).optional(),
  type: z.enum(["SYNC", "INSTALLATION", "BUG", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  notes: z.string().optional(),
});

export async function ticketsRoutes(app: FastifyInstance) {
  const service = new TicketsService();

  app.get(
    "/platform/tickets",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { status, priority } = request.query as { status?: string; priority?: string };
      const tickets = await service.list({ status, priority });
      return reply.send(tickets);
    }
  );

  app.get(
    "/platform/companies/:companyId/tickets",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const tickets = await service.listByCompany(companyId);
      return reply.send(tickets);
    }
  );

  app.post(
    "/platform/tickets",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      try {
        const ticket = await service.create(body);
        return reply.status(201).send(ticket);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Empresa não encontrada" });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/platform/tickets/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSchema.parse(request.body);
      try {
        const ticket = await service.update(id, body);
        return reply.send(ticket);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Ticket não encontrado" });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/platform/tickets/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.delete(id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Ticket não encontrado" });
        }
        throw err;
      }
    }
  );
}
