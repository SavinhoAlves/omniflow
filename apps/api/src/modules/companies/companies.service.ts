import bcrypt from "bcryptjs";
import { prisma, tenantStorage, Prisma } from "@omnichannel/database";

const BCRYPT_ROUNDS = 12;

/**
 * Deliberadamente NÃO reaproveita AuthService.registerCompany:
 * aquele fluxo é de auto-cadastro de tenant (emite accessToken +
 * seta cookie de sessão pro dono recém-criado, pensado pra rodar
 * fora de qualquer autenticação prévia). Este aqui é o Super Admin
 * da plataforma criando uma empresa PARA outra pessoa — não faz
 * sentido devolver um token de sessão de terceiro pra quem está
 * logado como plataforma. A lógica de criação (empresa + owner +
 * departamento padrão) é intencionalmente duplicada, pequena o
 * bastante pra não valer a pena uma abstração compartilhada que
 * acabaria acoplando dois fluxos de auth que devem ficar separados.
 */
export class CompaniesService {
  async list() {
    return prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        cnpj: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async create(input: {
    companyName: string;
    ownerName: string;
    email: string;
    password: string;
  }) {
    const slug = await this.generateUniqueSlug(input.companyName);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({
        data: { name: input.companyName, slug },
      });

      // Mesma mecânica de auth.service.ts: Department/User exigem
      // contexto de tenant no middleware do Prisma, e o companyId só
      // existe depois de criar a empresa — abre o contexto assim que
      // ela nasce, antes do resto da transação.
      tenantStorage.enterWith({ companyId: company.id });

      const department = await tx.department.create({
        data: {
          companyId: company.id,
          name: "Geral",
          isDefault: true,
        },
      });

      await tx.user.create({
        data: {
          companyId: company.id,
          name: input.ownerName,
          email: input.email.toLowerCase(),
          passwordHash,
          role: "OWNER",
          userDepartments: {
            create: { departmentId: department.id, isManager: true },
          },
        },
      });

      return company;
    });
  }

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const base = companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let slug = base;
    let attempt = 0;
    while (await prisma.company.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }
    return slug;
  }
}
