-- Phase 6 (T6.1–T6.3): Automations + SLA

-- T6.3: SLA tracking columns on conversations
ALTER TABLE "conversations"
  ADD COLUMN "first_response_at" TIMESTAMPTZ,
  ADD COLUMN "sla_breached_at"   TIMESTAMPTZ;

-- T6.1: Automation rules
CREATE TABLE "automation_rules" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"  TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "enabled"     BOOLEAN     NOT NULL DEFAULT true,
  "priority"    INTEGER     NOT NULL DEFAULT 0,
  "trigger"     TEXT        NOT NULL,
  "conditions"  JSONB       NOT NULL DEFAULT '[]',
  "actions"     JSONB       NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_rules_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "automation_rules_company_id_enabled_idx" ON "automation_rules" ("company_id", "enabled");
CREATE INDEX "automation_rules_company_id_trigger_idx" ON "automation_rules" ("company_id", "trigger");

-- T6.3: SLA policies
CREATE TABLE "sla_policies" (
  "id"                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"          TEXT        NOT NULL,
  "priority"            TEXT        NOT NULL DEFAULT 'MEDIUM',
  "first_response_min"  INTEGER     NOT NULL,
  "resolution_min"      INTEGER     NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sla_policies_company_id_priority_key" UNIQUE ("company_id", "priority"),
  CONSTRAINT "sla_policies_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "sla_policies_company_id_idx" ON "sla_policies" ("company_id");
