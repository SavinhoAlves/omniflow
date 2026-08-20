-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('PENDING', 'ACTIVE', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SYNC', 'INSTALLATION', 'BUG', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "client_contracts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'TRIAL',
    "value" DECIMAL(10,2),
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "version" TEXT,
    "status" "InstallationStatus" NOT NULL DEFAULT 'PENDING',
    "last_sync_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'OTHER',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contracts_company_id_idx" ON "client_contracts"("company_id");

-- CreateIndex
CREATE INDEX "installations_company_id_idx" ON "installations"("company_id");

-- CreateIndex
CREATE INDEX "support_tickets_company_id_idx" ON "support_tickets"("company_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- AddForeignKey
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
