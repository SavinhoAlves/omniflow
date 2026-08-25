-- Phase 2 (T2.2): Template cache table for Meta HSM templates
-- Synced daily via BullMQ scheduled job; updated in real-time via quality webhooks.

CREATE TABLE "templates" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"       TEXT        NOT NULL,
  "instance_id"      TEXT        NOT NULL,
  "provider_id"      TEXT        NOT NULL,
  "name"             TEXT        NOT NULL,
  "language"         TEXT        NOT NULL,
  "category"         TEXT        NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'PENDING',
  "quality"          TEXT,
  "components"       JSONB       NOT NULL DEFAULT '[]',
  "rejection_reason" TEXT,
  "synced_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "templates_instance_id_fkey"
    FOREIGN KEY ("instance_id") REFERENCES "whatsapp_instances" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "templates_instance_id_provider_id_key" ON "templates" ("instance_id", "provider_id");
CREATE UNIQUE INDEX "templates_instance_id_name_language_key" ON "templates" ("instance_id", "name", "language");
CREATE INDEX "templates_company_id_idx" ON "templates" ("company_id");
CREATE INDEX "templates_instance_id_status_idx" ON "templates" ("instance_id", "status");
