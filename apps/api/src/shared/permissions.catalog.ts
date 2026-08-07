/**
 * Catálogo único de permissões do sistema.
 *
 * Fica em código (não em tabela editável pelo cliente) porque
 * novas permissões nascem junto com cada módulo — é o time de
 * produto que define, não o usuário final. O que o usuário final
 * controla são os `UserPermissionOverride` (ver auth types).
 *
 * Convenção de nomenclatura: "modulo.acao". Isso facilita agrupar
 * na UI de configuração de permissões por módulo mais tarde.
 */
export const PERMISSIONS = {
  // Conversas / Atendimento
  CONVERSATIONS_VIEW_OWN: "conversations.view_own",
  CONVERSATIONS_VIEW_DEPARTMENT: "conversations.view_department",
  CONVERSATIONS_VIEW_ALL: "conversations.view_all",
  CONVERSATIONS_TRANSFER: "conversations.transfer",
  CONVERSATIONS_CLOSE: "conversations.close",

  // WhatsApp / Instâncias
  WHATSAPP_MANAGE_INSTANCES: "whatsapp.manage_instances",
  WHATSAPP_VIEW_INSTANCES: "whatsapp.view_instances",

  // Usuários e Departamentos
  USERS_MANAGE: "users.manage",
  DEPARTMENTS_MANAGE: "departments.manage",

  // Fluxo de atendimento (bot de boas-vindas + direcionamento)
  WORKFLOWS_MANAGE: "workflows.manage",
  WORKFLOWS_VIEW: "workflows.view",

  // Campanhas
  CAMPAIGNS_CREATE: "campaigns.create",
  CAMPAIGNS_VIEW: "campaigns.view",

  // Relatórios e Financeiro
  REPORTS_VIEW: "reports.view",
  BILLING_MANAGE: "billing.manage",

  // Configurações da empresa
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * O banco guarda cada permissão como (resource, action) — mais fácil
 * de indexar/agrupar do que uma string única. O catálogo em código,
 * porém, usa a convenção "modulo.acao" (mais legível/typo-safe nas
 * rotas). Estas funções convertem entre os dois formatos; o split
 * é sempre no PRIMEIRO ponto, já que "action" pode conter "_" mas
 * nunca ".".
 */
export function splitPermissionKey(permission: PermissionKey): { resource: string; action: string } {
  const dotIndex = permission.indexOf(".");
  return {
    resource: permission.slice(0, dotIndex),
    action: permission.slice(dotIndex + 1),
  };
}

export function joinPermissionKey(resource: string, action: string): string {
  return `${resource}.${action}`;
}

/**
 * Permissões padrão por role. Isso é a "seed" que popula
 * RolePermission no banco — mantida aqui como fonte da verdade em
 * código, e sincronizada pro banco via script de seed (idempotente,
 * roda em todo deploy).
 *
 * OWNER sempre tem tudo — não listamos explicitamente, é tratado
 * como bypass total no hasPermission() (ver permissions.service.ts).
 *
 * O enum UserRole só tem OWNER/ADMIN/MEMBER — os antigos MANAGER e
 * AGENT foram consolidados em MEMBER.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<"ADMIN" | "MEMBER", PermissionKey[]> = {
  ADMIN: [
    PERMISSIONS.CONVERSATIONS_VIEW_ALL,
    PERMISSIONS.CONVERSATIONS_TRANSFER,
    PERMISSIONS.CONVERSATIONS_CLOSE,
    PERMISSIONS.WHATSAPP_MANAGE_INSTANCES,
    PERMISSIONS.WHATSAPP_VIEW_INSTANCES,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.DEPARTMENTS_MANAGE,
    PERMISSIONS.WORKFLOWS_MANAGE,
    PERMISSIONS.WORKFLOWS_VIEW,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    // BILLING_MANAGE fica de fora do default — só OWNER por padrão,
    // empresa pode conceder via override se quiser.
  ],
  MEMBER: [
    PERMISSIONS.CONVERSATIONS_VIEW_OWN,
    PERMISSIONS.CONVERSATIONS_TRANSFER,
    PERMISSIONS.CONVERSATIONS_CLOSE,
    PERMISSIONS.WHATSAPP_VIEW_INSTANCES,
    PERMISSIONS.WORKFLOWS_VIEW,
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
};
