import { prisma, tenantStorage } from "@omnichannel/database";

export interface LogParams {
  companyId: string;
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export function logActivity(params: LogParams): void {
  tenantStorage.run({ isPlatform: true }, () => {
    prisma.activityLog
      .create({ data: params })
      .catch((err: Error) => console.error("[activity-log] Falha:", err.message));
  });
}
