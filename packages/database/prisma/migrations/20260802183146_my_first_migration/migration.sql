/*
  Warnings:

  - The values [MANAGER,AGENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `document` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `is_default` on the `departments` table. All the data in the column will be lost.
  - The primary key for the `role_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `permission` on the `role_permissions` table. All the data in the column will be lost.
  - The primary key for the `user_departments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `is_manager` on the `user_departments` table. All the data in the column will be lost.
  - You are about to drop the column `granted` on the `user_permission_overrides` table. All the data in the column will be lost.
  - You are about to drop the column `permission` on the `user_permission_overrides` table. All the data in the column will be lost.
  - You are about to drop the column `avatar_url` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `avatar_url` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `business_hours` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `connection_status` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `credentials` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `default_department_id` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `provider_type` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_url` on the `whatsapp_instances` table. All the data in the column will be lost.
  - You are about to drop the column `welcome_message` on the `whatsapp_instances` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnpj]` on the table `companies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,role,resource,action]` on the table `role_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,department_id]` on the table `user_departments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,resource,action]` on the table `user_permission_overrides` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `action` to the `role_permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `role_permissions` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `role_permissions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `resource` to the `role_permissions` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `user_departments` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `action` to the `user_permission_overrides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resource` to the `user_permission_overrides` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "role_permissions" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- DropForeignKey
ALTER TABLE "whatsapp_instances" DROP CONSTRAINT "whatsapp_instances_default_department_id_fkey";

-- DropIndex
DROP INDEX "companies_slug_key";

-- DropIndex
DROP INDEX "user_permission_overrides_user_id_permission_key";

-- DropIndex
DROP INDEX "users_company_id_email_key";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "document",
DROP COLUMN "plan",
DROP COLUMN "slug",
DROP COLUMN "status",
DROP COLUMN "timezone",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cnpj" TEXT;

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "color",
DROP COLUMN "is_default";

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
DROP COLUMN "permission",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "resource" TEXT NOT NULL,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_departments" DROP CONSTRAINT "user_departments_pkey",
DROP COLUMN "is_manager",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_permission_overrides" DROP COLUMN "granted",
DROP COLUMN "permission",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "resource" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar_url",
DROP COLUMN "status",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "whatsapp_instances" DROP COLUMN "avatar_url",
DROP COLUMN "business_hours",
DROP COLUMN "connection_status",
DROP COLUMN "credentials",
DROP COLUMN "default_department_id",
DROP COLUMN "description",
DROP COLUMN "phone_number",
DROP COLUMN "provider_type",
DROP COLUMN "webhook_url",
DROP COLUMN "welcome_message",
ADD COLUMN     "number" TEXT,
ADD COLUMN     "qrcode" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DISCONNECTED';

-- DropEnum
DROP TYPE "CompanyStatus";

-- DropEnum
DROP TYPE "InstanceConnectionStatus";

-- DropEnum
DROP TYPE "Plan";

-- DropEnum
DROP TYPE "UserStatus";

-- DropEnum
DROP TYPE "WhatsAppProviderType";

-- CreateTable
CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_refresh_tokens" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "platform_refresh_tokens_platform_user_id_idx" ON "platform_refresh_tokens"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_cnpj_key" ON "companies"("cnpj");

-- CreateIndex
CREATE INDEX "role_permissions_company_id_idx" ON "role_permissions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_company_id_role_resource_action_key" ON "role_permissions"("company_id", "role", "resource", "action");

-- CreateIndex
CREATE INDEX "user_departments_user_id_idx" ON "user_departments"("user_id");

-- CreateIndex
CREATE INDEX "user_departments_department_id_idx" ON "user_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_user_id_department_id_key" ON "user_departments"("user_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_user_id_resource_action_key" ON "user_permission_overrides"("user_id", "resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "platform_refresh_tokens" ADD CONSTRAINT "platform_refresh_tokens_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
