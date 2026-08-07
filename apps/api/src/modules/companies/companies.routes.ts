import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@omnichannel/database";
import { requirePlatform } from "../../middlewares/platform.middleware";
import { CompaniesService } from "./companies.service";

const createSchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function companiesRoutes(app: FastifyInstance) {
  const service = new CompaniesService();

  app.get(
    "/companies",
    { preHandler: requirePlatform() },
    async (_request, reply) => {
      const companies = await service.list();
      return reply.send(companies);
    }
  );

  app.post(
    "/companies",
    { preHandler: requirePlatform() },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      try {
        const company = await service.create(body);
        return reply.status(201).send(company);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.status(409).send({ error: "Já existe uma empresa ou usuário com estes dados" });
        }
        throw err;
      }
    }
  );
}
