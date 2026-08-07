import bcrypt from "bcryptjs";
import { prisma, tenantStorage, Prisma } from "@omnichannel/database";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../../shared/jwt";
import { PermissionsService } from "../permissions/permissions.service";

const BCRYPT_ROUNDS = 12;

export class AuthService {
  private permissionsService = new PermissionsService();

  /**
   * Cria uma nova empresa (tenant) + o primeiro usuário (OWNER) +
   * um departamento padrão "Geral". Esta é a ÚNICA rota que cria
   * registros SEM um tenant já existente, por isso não passa pelo
   * middleware de tenant — é tratada como pública.
   */
  async registerCompany(input: {
    companyName: string;
    ownerName: string;
    email: string;
    password: string;
  }) {
    const slug = await this.generateUniqueSlug(input.companyName);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // Transação: empresa + owner + departamento padrão nascem juntos
    // ou nada é criado — não queremos empresa órfã sem usuário.
    //
    // `Company` não está na allowlist de isolamento (é a raiz do
    // tenant), então pode ser criada sem contexto. Já `Department`
    // e `User` exigem contexto de tenant no middleware do Prisma —
    // como o companyId só existe DEPOIS de criar a empresa, abrimos
    // o contexto (`enterWith`) assim que ela é criada, antes de
    // criar o restante dentro da mesma transação.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({
        data: { name: input.companyName, slug },
      });

      tenantStorage.enterWith({ companyId: company.id });

      const department = await tx.department.create({
        data: {
          companyId: company.id,
          name: "Geral",
          isDefault: true,
        },
      });

      const user = await tx.user.create({
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

      return { company, user };
    });

    return this.issueTokens(result.user.id, result.user.name, result.company.id, "OWNER", []);
  }

  async login(email: string, password: string, companySlug: string) {
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });
    if (!company || !company.active) {
      throw new AuthError("Empresa não encontrada ou inativa");
    }

    // Login roda ANTES do middleware de tenant popular o contexto
    // (é ele quem descobre qual é o tenant, a partir do slug).
    // Por isso abrimos o contexto aqui manualmente, assim que
    // sabemos o companyId — dali em diante o middleware do Prisma
    // volta a proteger todas as queries normalmente.
    tenantStorage.enterWith({ companyId: company.id });

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.active) {
      throw new AuthError("Credenciais inválidas");
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new AuthError("Credenciais inválidas");
    }

    const departmentIds = await prisma.userDepartment
      .findMany({ where: { userId: user.id }, select: { departmentId: true } })
      .then((rows: { departmentId: string }[]) => rows.map((r) => r.departmentId));

    return this.issueTokens(user.id, user.name, company.id, user.role, departmentIds);
  }

  /**
   * Rotação de refresh token: o token antigo é revogado e um novo
   * par é emitido. Isso limita o dano de um refresh token roubado —
   * se o token antigo for reutilizado após a rotação, é sinal de
   * comprometimento (a aplicação pode detectar e revogar toda a
   * sessão, embora essa detecção avançada fique para uma iteração
   * futura).
   */
  async refresh(rawRefreshToken: string) {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    // Contexto de tenant ainda não existe neste ponto (o refresh
    // chega via cookie, sem passar pelo tenantMiddleware) — o
    // RefreshToken não está na allowlist de isolamento, então esta
    // busca funciona sem contexto. O contexto é aberto logo depois,
    // assim que sabemos a qual empresa o usuário pertence.
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored) throw new AuthError("Refresh token inválido ou expirado");

    tenantStorage.enterWith({ companyId: stored.user.companyId });

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const departmentIds = await prisma.userDepartment
      .findMany({
        where: { userId: stored.userId },
        select: { departmentId: true },
      })
      .then((rows: { departmentId: string }[]) => rows.map((r) => r.departmentId));

    return this.issueTokens(
      stored.userId,
      stored.user.name,
      stored.user.companyId,
      stored.user.role,
      departmentIds
    );
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    name: string,
    companyId: string,
    role: string,
    departmentIds: string[]
  ) {
    const permissions = await this.permissionsService.resolveForUser(userId, role);

    const accessToken = signAccessToken({
      sub: userId,
      name,
      companyId,
      role: role as "OWNER" | "ADMIN" | "MEMBER",
      departmentIds,
      permissions,
    });

    const { token: refreshToken, hash, expiresAt } = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { userId, tokenHash: hash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const base = companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
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

export class AuthError extends Error {}
