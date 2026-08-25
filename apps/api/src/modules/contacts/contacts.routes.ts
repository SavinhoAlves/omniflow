import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { ContactsService } from "./contacts.service";
import { logActivity } from "../../shared/activity-logger";

const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  phoneNumber: z.string().min(6).max(30),
  notes: z.string().optional(),
});

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
});

const consentSchema = z.object({
  event: z.enum(["OPT_IN", "OPT_OUT"]),
  source: z.string().min(1),
});

export async function contactsRoutes(app: FastifyInstance) {
  const service = new ContactsService();

  app.post(
    "/contacts",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const data = createContactSchema.parse(request.body);
      const contact = await service.create(auth.companyId, data);
      return reply.status(201).send(contact);
    }
  );

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

  // T4.3 — Exclusão/anonimização (LGPD Art. 18 IV)
  // Se o contato tem histórico de conversas, anonimiza os dados em vez de deletar.
  app.delete(
    "/contacts/:id",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const result = await service.delete(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: result.anonymized ? "contact.anonymized" : "contact.deleted",
        entity: "contact",
        entityId: id,
        ip: request.ip,
      });
      return reply.status(204).send();
    }
  );

  // T4.1 — Registro de consentimento (LGPD Art. 7 e 9)
  app.post(
    "/contacts/:id/consent",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const { event, source } = consentSchema.parse(request.body);
      await service.recordConsent(id, event, source, {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        recordedBy: auth.userId,
        companyId: auth.companyId,
      });
      return reply.send({ ok: true });
    }
  );

  // T4.1 — Histórico de consentimento
  app.get(
    "/contacts/:id/consent",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_VIEW_OWN) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const history = await service.getConsentHistory(id);
      return reply.send(history);
    }
  );

  // T4.2 — Exportação de dados pessoais (LGPD Art. 18 VI — portabilidade)
  app.get(
    "/contacts/:id/export",
    { preHandler: requirePermission(PERMISSIONS.CONVERSATIONS_CLOSE) },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const data = await service.exportData(id);
      logActivity({
        companyId: auth.companyId,
        userId: auth.userId,
        userName: auth.name,
        action: "contact.data_exported",
        entity: "contact",
        entityId: id,
        ip: request.ip,
      });
      reply.header("Content-Disposition", `attachment; filename="contact-${id}-export.json"`);
      reply.header("Content-Type", "application/json");
      return reply.send(data);
    }
  );
}
