import bcrypt from "bcryptjs";
import { prisma } from "@omnichannel/database";
import {
  signPlatformAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../../shared/jwt";
import { AuthError } from "../auth/auth.service";

const BCRYPT_ROUNDS = 12;

/**
 * Autenticação da equipe interna (Super Admin, Suporte, Operador) —
 * completamente separada da autenticação de tenant (auth.service.ts).
 * PlatformUser não pertence a nenhuma empresa e não passa por RLS/
 * isolamento de tenant.
 */
export class PlatformAuthService {
  async login(email: string, password: string) {
    const platformUser = await prisma.platformUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!platformUser || !platformUser.active) {
      throw new AuthError("Credenciais inválidas");
    }

    const validPassword = await bcrypt.compare(password, platformUser.passwordHash);
    if (!validPassword) {
      throw new AuthError("Credenciais inválidas");
    }

    return this.issueTokens(platformUser.id, platformUser.role, platformUser.name);
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const stored = await prisma.platformRefreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { platformUser: true },
    });
    if (!stored || !stored.platformUser.active) {
      throw new AuthError("Refresh token inválido ou expirado");
    }

    await prisma.platformRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.platformUserId, stored.platformUser.role, stored.platformUser.name);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await prisma.platformRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(platformUserId: string, role: string, name: string) {
    const accessToken = signPlatformAccessToken({
      sub: platformUserId,
      name,
      role: role as "SUPER_ADMIN" | "SUPPORT",
    });

    const { token: refreshToken, hash, expiresAt } = generateRefreshToken();
    await prisma.platformRefreshToken.create({
      data: { platformUserId, tokenHash: hash, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
