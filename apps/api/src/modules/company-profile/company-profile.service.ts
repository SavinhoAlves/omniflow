import { prisma } from "@omnichannel/database";

/**
 * Deliberadamente um módulo separado de `companies` (que é
 * exclusivo de plataforma, protegido por `requirePlatform()`).
 * `Company` não está na allowlist de tenant-scoping do Prisma (é a
 * raiz do tenant, não faria sentido filtrar a própria empresa PELA
 * própria empresa) — então aqui o isolamento é manual: todo método
 * recebe `companyId` explicitamente (vindo de `request.auth.companyId`,
 * nunca de input do cliente) em vez de confiar em injeção automática.
 */
export class CompanyProfileService {
  async getProfile(companyId: string) {
    return prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { id: true, name: true, slug: true, cnpj: true },
    });
  }

  async updateProfile(companyId: string, input: { name?: string; cnpj?: string }) {
    return prisma.company.update({
      where: { id: companyId },
      data: input,
      select: { id: true, name: true, slug: true, cnpj: true },
    });
  }
}
