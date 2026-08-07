import { prisma } from "@omnichannel/database";
import {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PermissionKey,
  splitPermissionKey,
  joinPermissionKey,
} from "../../shared/permissions.catalog";

export class PermissionsService {
  /**
   * Resolve a lista final de permissões de um usuário: defaults do
   * role, ajustados pelos overrides pontuais dele. Chamado uma vez
   * no login/refresh — o resultado é embutido no access token, então
   * não há custo de banco nas requisições seguintes. O preço disso é
   * que uma mudança de permissão só reflete no próximo refresh
   * (máximo 15min de defasagem, aceitável para este caso de uso).
   */
  async resolveForUser(userId: string, role: string): Promise<string[]> {
    if (role === "OWNER") {
      // OWNER sempre tem tudo — bypass total, não vale a pena listar.
      return Object.values(PERMISSIONS);
    }

    const defaults =
      DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];

    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId },
    });

    const resolved = new Set<string>(defaults);
    for (const override of overrides) {
      const key = joinPermissionKey(override.resource, override.action);
      if (override.allowed) resolved.add(key);
      else resolved.delete(key);
    }

    return Array.from(resolved);
  }

  hasPermission(userPermissions: string[], required: PermissionKey): boolean {
    return userPermissions.includes(required);
  }

  /** Exposto para permissions.routes.ts converter o payload da API (permission dot-key) no formato do banco. */
  static splitPermissionKey = splitPermissionKey;
}
