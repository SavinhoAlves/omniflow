-- ============================================================
-- Correção de drift: a migration anterior ("my_first_migration")
-- removeu colunas que o restante do código (auth.service.ts,
-- whatsapp.service.ts, seed.ts) continua usando. Esta migration
-- restaura o que é necessário, mantendo os pontos bons da anterior
-- (platform_users, role_permissions/user_permission_overrides no
-- formato resource/action).
-- ============================================================

-- CreateEnum
CREATE TYPE "WhatsAppProviderType" AS ENUM ('BAILEYS', 'META_CLOUD_API', 'EVOLUTION_API');

-- CreateEnum
CREATE TYPE "InstanceConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'QR_PENDING', 'ERROR');

-- companies: restaurar slug (login é feito por slug + email + senha)
ALTER TABLE "companies" ADD COLUMN "slug" TEXT;
-- backfill best-effort a partir do nome, para linhas já existentes
UPDATE "companies" SET "slug" = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || substring(id, 1, 8) WHERE "slug" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- users: email volta a ser único por empresa (não globalmente) —
-- múltiplos tenants podem ter usuários com o mesmo email.
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_company_id_email_key" ON "users"("company_id", "email");

-- departments: restaurar is_default (departamento padrão criado no registro da empresa)
ALTER TABLE "departments" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- user_departments: restaurar is_manager
ALTER TABLE "user_departments" ADD COLUMN "is_manager" BOOLEAN NOT NULL DEFAULT false;

-- whatsapp_instances: restaurar campos de integração com provider
ALTER TABLE "whatsapp_instances"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "phone_number" TEXT,
  ADD COLUMN "provider_type" "WhatsAppProviderType",
  ADD COLUMN "credentials" TEXT,
  ADD COLUMN "connection_status" "InstanceConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  ADD COLUMN "default_department_id" TEXT;

-- Linhas existentes não tinham provider_type; assume-se BAILEYS como
-- default histórico só para permitir tornar a coluna NOT NULL.
UPDATE "whatsapp_instances" SET "provider_type" = 'BAILEYS' WHERE "provider_type" IS NULL;
ALTER TABLE "whatsapp_instances" ALTER COLUMN "provider_type" SET NOT NULL;

-- migra o antigo campo "status" (texto livre) para o novo enum, e "number" para "phone_number"
UPDATE "whatsapp_instances" SET "connection_status" = CASE
  WHEN "status" IN ('CONNECTED','DISCONNECTED','CONNECTING','QR_PENDING','ERROR') THEN "status"::"InstanceConnectionStatus"
  ELSE 'DISCONNECTED'
END;
UPDATE "whatsapp_instances" SET "phone_number" = "number" WHERE "number" IS NOT NULL;

ALTER TABLE "whatsapp_instances" DROP COLUMN "status";
ALTER TABLE "whatsapp_instances" DROP COLUMN "number";

ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_default_department_id_fkey"
  FOREIGN KEY ("default_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
