import { prisma, tenantStorage } from "@omnichannel/database";
import { logActivity } from "../../shared/activity-logger";

const ANONYMIZED_NAME = "[DADOS REMOVIDOS]";
const ANONYMIZED_PHONE = "00000000000";

export class ContactsService {
  async list(search?: string) {
    const where: any = { anonymizedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search } },
      ];
    }
    return prisma.contact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        avatarUrl: true,
        notes: true,
        optOut: true,
        consentGivenAt: true,
        consentSource: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
    });
  }

  async get(contactId: string) {
    return prisma.contact.findFirstOrThrow({
      where: { id: contactId },
      include: {
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 10,
          include: {
            messages: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 1 },
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async create(companyId: string, data: { name: string; phoneNumber: string; notes?: string }) {
    return prisma.contact.upsert({
      where: { companyId_phoneNumber: { companyId, phoneNumber: data.phoneNumber } },
      create: { companyId, phoneNumber: data.phoneNumber, name: data.name, notes: data.notes },
      update: { name: data.name, notes: data.notes ?? undefined },
      select: { id: true, name: true, phoneNumber: true, avatarUrl: true, notes: true, createdAt: true },
    });
  }

  async update(contactId: string, data: { name?: string; notes?: string }) {
    return prisma.contact.updateMany({ where: { id: contactId }, data });
  }

  // T4.1 — Record consent event
  async recordConsent(
    contactId: string,
    event: "OPT_IN" | "OPT_OUT",
    source: string,
    options?: { ip?: string; userAgent?: string; recordedBy?: string; companyId?: string }
  ) {
    const contact = await prisma.contact.findFirstOrThrow({
      where: { id: contactId },
      select: { id: true, companyId: true },
    });

    const companyId = options?.companyId ?? contact.companyId;

    await Promise.all([
      prisma.contact.updateMany({
        where: { id: contactId },
        data: {
          optOut: event === "OPT_OUT",
          consentGivenAt: event === "OPT_IN" ? new Date() : undefined,
          consentSource: event === "OPT_IN" ? source : undefined,
        },
      }),
      prisma.consentLog.create({
        data: {
          companyId,
          contactId,
          event,
          source,
          ip: options?.ip,
          userAgent: options?.userAgent,
          recordedBy: options?.recordedBy,
        },
      }),
    ]);

    logActivity({
      companyId,
      userId: options?.recordedBy,
      action: event === "OPT_IN" ? "contact.consent_given" : "contact.consent_revoked",
      entity: "contact",
      entityId: contactId,
      details: { source, event },
      ip: options?.ip,
      userAgent: options?.userAgent,
    });
  }

  async getConsentHistory(contactId: string) {
    return prisma.consentLog.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
    });
  }

  // T4.2 — Data portability export (LGPD Art. 18 VI)
  async exportData(contactId: string) {
    const contact = await prisma.contact.findFirstOrThrow({
      where: { id: contactId },
      include: {
        conversations: {
          include: {
            messages: {
              where: { isInternal: false },
              orderBy: { createdAt: "asc" },
              select: {
                id: true, direction: true, type: true, content: true,
                mediaUrl: true, createdAt: true, deliveryStatus: true,
              },
            },
          },
        },
        consentLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      lgpdNote: "Exportação gerada nos termos da LGPD Art. 18 VI — direito à portabilidade de dados.",
      contact: {
        id: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        notes: contact.notes,
        optOut: contact.optOut,
        consentGivenAt: contact.consentGivenAt,
        consentSource: contact.consentSource,
        createdAt: contact.createdAt,
      },
      conversations: contact.conversations.map((conv) => ({
        id: conv.id,
        status: conv.status,
        createdAt: conv.createdAt,
        messages: conv.messages,
      })),
      consentHistory: contact.consentLogs,
    };
  }

  // T4.3 — Soft anonymization instead of hard delete (LGPD Art. 18 IV)
  // Replaces PII with markers; preserves conversation structure for analytics.
  async anonymize(contactId: string, requestedBy?: string) {
    const contact = await prisma.contact.findFirstOrThrow({
      where: { id: contactId },
      select: { id: true, companyId: true, name: true, phoneNumber: true },
    });

    await Promise.all([
      prisma.contact.updateMany({
        where: { id: contactId },
        data: {
          name: ANONYMIZED_NAME,
          phoneNumber: `${ANONYMIZED_PHONE}_${contactId.slice(0, 8)}`,
          avatarUrl: null,
          notes: null,
          consentGivenAt: null,
          consentSource: null,
          anonymizedAt: new Date(),
        },
      }),
      // Record the erasure event in consent log for auditability
      prisma.consentLog.create({
        data: {
          companyId: contact.companyId,
          contactId,
          event: "OPT_OUT",
          source: "erasure_request",
          recordedBy: requestedBy,
        },
      }),
    ]);

    logActivity({
      companyId: contact.companyId,
      userId: requestedBy,
      action: "contact.anonymized",
      entity: "contact",
      entityId: contactId,
      beforeState: { name: contact.name, phoneNumber: contact.phoneNumber },
      afterState: { name: ANONYMIZED_NAME, anonymizedAt: new Date().toISOString() },
    });
  }

  // T4.3 — Hard delete (only for unstarted contacts with no conversation history)
  async delete(contactId: string) {
    const convCount = await prisma.conversation.count({ where: { contactId } });
    if (convCount > 0) {
      // Has history — anonymize instead of deleting to preserve analytics
      await this.anonymize(contactId);
      return { anonymized: true };
    }
    await prisma.contact.deleteMany({ where: { id: contactId } });
    return { deleted: true };
  }

  // T4.5 — Retention enforcement: called by the daily BullMQ job
  static async enforceRetentionForCompany(companyId: string, retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Find resolved conversations older than retention window
    const stale = await tenantStorage.run({ companyId }, () =>
      prisma.conversation.findMany({
        where: {
          companyId,
          status: "RESOLVED",
          updatedAt: { lt: cutoff },
        },
        select: { id: true, contactId: true },
        take: 100, // batch
      })
    );

    if (stale.length === 0) return 0;

    // Anonymize the linked contacts (unique)
    const contactIds = [...new Set(stale.map((c) => c.contactId))];
    for (const contactId of contactIds) {
      await tenantStorage.run({ companyId }, async () => {
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, anonymizedAt: null },
          select: { id: true },
        });
        if (contact) {
          await prisma.contact.updateMany({
            where: { id: contactId },
            data: {
              name: ANONYMIZED_NAME,
              phoneNumber: `${ANONYMIZED_PHONE}_${contactId.slice(0, 8)}`,
              avatarUrl: null,
              notes: null,
              anonymizedAt: new Date(),
            },
          });
        }
      });
    }

    return stale.length;
  }
}
