// packages/database/src/client.ts
import { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

interface TenantContext {
  companyId?: string;
  isPlatform?: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentCompanyId(): string {
  const ctx = tenantStorage.getStore();
  if (!ctx?.companyId) {
    throw new Error(
      "Tentativa de acessar o banco fora de um contexto de tenant. " +
        "Toda query precisa ocorrer dentro de tenantStorage.run(...)."
    );
  }
  return ctx.companyId;
}

const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Department",
  "WhatsAppInstance",
  "Workflow",
  "Contact",
  "Conversation",
]);

function createPrismaClient() {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = tenantStorage.getStore();
          
          // BYPASS: Se for o Master User (Platform), a query é executada livremente.
          if (ctx?.isPlatform) {
            return query(args);
          }

          // 1. ISOLAMENTO NO NÍVEL DA APLICAÇÃO (Substitui Prisma.$use)
          if (model && TENANT_SCOPED_MODELS.has(model)) {
            const companyId = getCurrentCompanyId();
            args = args ?? ({} as any);

            switch (operation) {
              case "create":
                (args as any).data = { ...(args as any).data, companyId };
                break;
              case "createMany":
                (args as any).data = ((args as any).data as any[]).map((d) => ({
                  ...d,
                  companyId,
                }));
                break;
              case "findFirst":
              case "findFirstOrThrow":
              case "findMany":
              case "count":
              case "updateMany":
              case "deleteMany":
              case "aggregate":
              case "groupBy":
                (args as any).where = { ...(args as any).where, companyId };
                break;
              case "findUnique":
              case "findUniqueOrThrow": {
                // `query` está vinculado à operação original (findUnique/findUniqueOrThrow),
                // então não podemos simplesmente modificar `operation` e chamar query(args) —
                // isso continuaria executando findUnique com companyId no where, o que falha
                // porque {id, companyId} não é uma constraint única definida no schema.
                // A solução correta: chamar basePrisma[model].findFirst/findFirstOrThrow
                // diretamente, passando companyId no where, dentro da mesma transação RLS.
                const findOp = operation === "findUnique" ? "findFirst" : "findFirstOrThrow";
                const modelKey = model!.charAt(0).toLowerCase() + model!.slice(1);
                (args as any).where = { ...(args as any).where, companyId };
                if (ctx?.companyId) {
                  const [, result] = await basePrisma.$transaction([
                    basePrisma.$executeRawUnsafe(
                      `SELECT set_config('app.current_company_id', $1, true)`,
                      ctx.companyId
                    ),
                    (basePrisma as any)[modelKey][findOp](args),
                  ]);
                  return result;
                }
                return (basePrisma as any)[modelKey][findOp](args);
              }
              case "update":
              case "delete":
                (args as any).where = { ...(args as any).where, companyId };
                break;
              case "upsert":
                (args as any).where = { ...(args as any).where, companyId };
                (args as any).create = { ...(args as any).create, companyId };
                break;
            }
          }

          // 2. ISOLAMENTO NO NÍVEL DO BANCO DE DADOS (PostgreSQL RLS)
          // Resolve o Connection Pool Leak.
          if (ctx?.companyId) {
            // A $transaction GARANTE a fixação da conexão ('Connection Pinning').
            // Usamos 'true' (is_local) para que a configuração expire automaticamente ao 
            // fim da transação, descartando a necessidade de funções de 'reset'.
            const [, result] = await basePrisma.$transaction([
              basePrisma.$executeRawUnsafe(
                `SELECT set_config('app.current_company_id', $1, true)`, 
                ctx.companyId
              ),
              query(args),
            ]);
            return result;
          }

          // Executa a operação livremente se não houver companyId e não cair nas regras acima
          return query(args);
        },
      },
    },
  });
}

export const prisma = createPrismaClient();

// As funções setPostgresTenantContext e resetPostgresTenantContext foram deletadas intencionalmente.

export { Prisma };
// Exportação customizada para manter o intelisense da extensão
export type CustomPrismaClient = ReturnType<typeof createPrismaClient>;