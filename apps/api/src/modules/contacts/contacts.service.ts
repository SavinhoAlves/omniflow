import { prisma } from "@omnichannel/database";

export class ContactsService {
  async list(search?: string) {
    const where: any = {};
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
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async update(contactId: string, data: { name?: string; notes?: string }) {
    return prisma.contact.updateMany({
      where: { id: contactId },
      data,
    });
  }
}
