import { prisma } from "@omnichannel/database";
import { buildContractHtml } from "./contracts.template";

export class ContractsService {
  async listByCompany(companyId: string) {
    return prisma.clientContract.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async list() {
    return prisma.clientContract.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
  }

  async create(input: {
    companyId: string;
    plan: string;
    status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
    value?: number;
    billingCycle?: "MONTHLY" | "ANNUAL";
    startDate: string;
    endDate?: string;
    notes?: string;
  }) {
    return prisma.clientContract.create({
      data: {
        companyId: input.companyId,
        plan: input.plan,
        status: input.status ?? "TRIAL",
        value: input.value ?? null,
        billingCycle: input.billingCycle ?? "MONTHLY",
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(
    id: string,
    input: Partial<{
      plan: string;
      status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
      value: number;
      billingCycle: "MONTHLY" | "ANNUAL";
      startDate: string;
      endDate: string | null;
      notes: string;
    }>
  ) {
    return prisma.clientContract.update({
      where: { id },
      data: {
        ...(input.plan !== undefined && { plan: input.plan }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.billingCycle !== undefined && { billingCycle: input.billingCycle }),
        ...(input.startDate !== undefined && { startDate: new Date(input.startDate) }),
        ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  async delete(id: string) {
    return prisma.clientContract.delete({ where: { id } });
  }

  async getDocument(id: string): Promise<string> {
    const contract = await prisma.clientContract.findUniqueOrThrow({
      where: { id },
      include: { company: { select: { name: true, cnpj: true, slug: true } } },
    });

    return buildContractHtml({
      company: contract.company,
      plan: contract.plan,
      value: contract.value ? Number(contract.value) : null,
      billingCycle: contract.billingCycle as "MONTHLY" | "ANNUAL",
      startDate: contract.startDate,
      endDate: contract.endDate,
      notes: contract.notes,
      signatureStatus: contract.signatureStatus,
      signerName: contract.signerName,
      signedAt: contract.signedAt,
      signatureData: contract.signatureData,
    });
  }

  async signDigital(id: string, signerName: string, signatureData: string) {
    return prisma.clientContract.update({
      where: { id },
      data: {
        signatureStatus: "SIGNED_DIGITAL",
        signerName,
        signatureData,
        signedAt: new Date(),
      },
    });
  }

  async signPhysical(id: string, signerName: string) {
    return prisma.clientContract.update({
      where: { id },
      data: {
        signatureStatus: "SIGNED_PHYSICAL",
        signerName,
        signedAt: new Date(),
      },
    });
  }

  async revokeSignature(id: string) {
    return prisma.clientContract.update({
      where: { id },
      data: {
        signatureStatus: "PENDING",
        signerName: null,
        signatureData: null,
        signedAt: null,
      },
    });
  }
}
