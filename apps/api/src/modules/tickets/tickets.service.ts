import { prisma } from "@omnichannel/database";

export class TicketsService {
  async listByCompany(companyId: string) {
    return prisma.supportTicket.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async list(filters?: { status?: string; priority?: string }) {
    return prisma.supportTicket.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.priority && { priority: filters.priority as any }),
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: {
        company: { select: { id: true, name: true } },
      },
    });
  }

  async create(input: {
    companyId: string;
    title: string;
    description: string;
    type?: "SYNC" | "INSTALLATION" | "BUG" | "OTHER";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    notes?: string;
  }) {
    return prisma.supportTicket.create({
      data: {
        companyId: input.companyId,
        title: input.title,
        description: input.description,
        type: input.type ?? "OTHER",
        priority: input.priority ?? "MEDIUM",
        notes: input.notes ?? null,
      },
    });
  }

  async update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      type: "SYNC" | "INSTALLATION" | "BUG" | "OTHER";
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      notes: string;
    }>
  ) {
    const data: Record<string, any> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) data.type = input.type;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "RESOLVED" || input.status === "CLOSED") {
        data.resolvedAt = new Date();
      }
    }
    return prisma.supportTicket.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.supportTicket.delete({ where: { id } });
  }
}
