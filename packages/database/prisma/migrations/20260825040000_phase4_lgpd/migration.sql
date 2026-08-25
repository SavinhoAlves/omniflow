-- Phase 4 (T4.1–T4.5): LGPD Compliance

-- T4.5: Data retention policy per company
ALTER TABLE "companies"
  ADD COLUMN "retention_days" INTEGER;

-- T4.1 + T4.3: Consent tracking and anonymization on Contact
ALTER TABLE "contacts"
  ADD COLUMN "consent_given_at" TIMESTAMPTZ,
  ADD COLUMN "consent_source"   TEXT,
  ADD COLUMN "anonymized_at"    TIMESTAMPTZ;

-- T4.1: Consent audit log
CREATE TABLE "consent_logs" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"  TEXT        NOT NULL,
  "contact_id"  TEXT        NOT NULL,
  "event"       TEXT        NOT NULL,
  "source"      TEXT        NOT NULL,
  "ip"          TEXT,
  "user_agent"  TEXT,
  "recorded_by" TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consent_logs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "consent_logs_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE
);

CREATE INDEX "consent_logs_company_id_contact_id_idx" ON "consent_logs" ("company_id", "contact_id");
CREATE INDEX "consent_logs_company_id_created_at_idx" ON "consent_logs" ("company_id", "created_at" DESC);
