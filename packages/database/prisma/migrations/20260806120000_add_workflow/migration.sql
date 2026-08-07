-- ============================================================
-- Fluxo de atendimento: workflows (1 por empresa, "default") +
-- workflow_rules (regras de direcionamento do menu do bot pro
-- departamento certo). RLS destas tabelas fica em prisma/rls.sql,
-- no mesmo padrão das demais (ver comentário lá).
-- ============================================================

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "welcome_message" TEXT,
    "fallback_department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "option_label" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflows_company_id_key" ON "workflows"("company_id");

-- CreateIndex
CREATE INDEX "workflows_company_id_idx" ON "workflows"("company_id");

-- CreateIndex
CREATE INDEX "workflow_rules_workflow_id_idx" ON "workflow_rules"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_rules_department_id_idx" ON "workflow_rules"("department_id");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_fallback_department_id_fkey" FOREIGN KEY ("fallback_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
