import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePlatform } from "../../middlewares/platform.middleware";
import { ContractsService } from "./contracts.service";

const createSchema = z.object({
  companyId: z.string().uuid(),
  plan: z.string().min(1),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
  value: z.number().positive().optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  plan: z.string().min(1).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
  value: z.number().positive().optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
});

const signDigitalSchema = z.object({
  signerName: z.string().min(1),
  signatureData: z.string().min(1),
});

const signPhysicalSchema = z.object({
  signerName: z.string().min(1),
});

export async function contractsRoutes(app: FastifyInstance) {
  const service = new ContractsService();

  app.get(
    "/platform/contracts",
    { preHandler: requirePlatform() },
    async (_request, reply) => {
      const contracts = await service.list();
      return reply.send(contracts);
    }
  );

  app.get(
    "/platform/companies/:companyId/contracts",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const contracts = await service.listByCompany(companyId);
      return reply.send(contracts);
    }
  );

  app.post(
    "/platform/contracts",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      try {
        const contract = await service.create(body);
        return reply.status(201).send(contract);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Empresa não encontrada" });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/platform/contracts/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSchema.parse(request.body);
      try {
        const contract = await service.update(id, body);
        return reply.send(contract);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/platform/contracts/:id",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.delete(id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );

  // GET /platform/contracts/:id/document — retorna HTML do contrato preenchido
  app.get(
    "/platform/contracts/:id/document",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const html = await service.getDocument(id);
        return reply.header("Content-Type", "text/html; charset=utf-8").send(html);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );

  // POST /platform/contracts/:id/sign-digital
  app.post(
    "/platform/contracts/:id/sign-digital",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = signDigitalSchema.parse(request.body);
      try {
        const contract = await service.signDigital(id, body.signerName, body.signatureData);
        return reply.send(contract);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );

  // POST /platform/contracts/:id/sign-physical
  app.post(
    "/platform/contracts/:id/sign-physical",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = signPhysicalSchema.parse(request.body);
      try {
        const contract = await service.signPhysical(id, body.signerName);
        return reply.send(contract);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );

  // DELETE /platform/contracts/:id/signature — revoga assinatura
  app.delete(
    "/platform/contracts/:id/signature",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const contract = await service.revokeSignature(id);
        return reply.send(contract);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.status(404).send({ error: "Contrato não encontrado" });
        }
        throw err;
      }
    }
  );
}
