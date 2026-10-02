-- CRM: automações do funil (gatilhos por funil, ações ao entrar na etapa)
-- e controle da pesquisa de satisfação enviada ao ganhar um negócio.

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "csat_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "automations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN     "on_enter" JSONB NOT NULL DEFAULT '[]';

