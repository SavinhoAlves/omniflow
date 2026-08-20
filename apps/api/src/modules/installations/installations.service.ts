import { prisma } from "@omnichannel/database";

export class InstallationsService {
  async listByCompany(companyId: string) {
    return prisma.installation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async list() {
    return prisma.installation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
  }

  async create(input: {
    companyId: string;
    name: string;
    location?: string;
    version?: string;
    status?: "PENDING" | "ACTIVE" | "MAINTENANCE" | "OFFLINE";
    notes?: string;
  }) {
    return prisma.installation.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        location: input.location ?? null,
        version: input.version ?? null,
        status: input.status ?? "PENDING",
        notes: input.notes ?? null,
      },
    });
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      location: string;
      version: string;
      status: "PENDING" | "ACTIVE" | "MAINTENANCE" | "OFFLINE";
      lastSyncAt: string;
      notes: string;
    }>
  ) {
    return prisma.installation.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.version !== undefined && { version: input.version }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.lastSyncAt !== undefined && { lastSyncAt: new Date(input.lastSyncAt) }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  async delete(id: string) {
    return prisma.installation.delete({ where: { id } });
  }
}
