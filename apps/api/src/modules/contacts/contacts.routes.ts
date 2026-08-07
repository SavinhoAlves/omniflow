import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { ContactsService } from "./contacts.service";

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export async function contactsRoutes(app: FastifyInstance) {
  const service = new ContactsService();

  app.get(
    "/contacts",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { search } = request.query as { search?: string };
      const contacts = await service.list(search);
      return reply.send(contacts);
    }
  );

  app.get(
    "/contacts/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const contact = await service.get(id);
      return reply.send(contact);
    }
  );

  app.put(
    "/contacts/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = updateContactSchema.parse(request.body);
      await service.update(id, data);
      return reply.send({ ok: true });
    }
  );
}
