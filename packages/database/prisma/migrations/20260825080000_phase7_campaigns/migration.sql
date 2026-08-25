-- Phase 7 (T7.1–T7.3): Marketing Campaigns

CREATE TABLE "campaigns" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"      TEXT        NOT NULL,
  "instance_id"     TEXT        NOT NULL,
  "created_by_id"   TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'DRAFT',
  "template_id"     TEXT,
  "audience_filter" JSONB       NOT NULL DEFAULT '{}',
  "template_params" JSONB       NOT NULL DEFAULT '{}',
  "scheduled_at"    TIMESTAMPTZ,
  "started_at"      TIMESTAMPTZ,
  "completed_at"    TIMESTAMPTZ,
  "total_count"     INTEGER     NOT NULL DEFAULT 0,
  "sent_count"      INTEGER     NOT NULL DEFAULT 0,
  "delivered_count" INTEGER     NOT NULL DEFAULT 0,
  "read_count"      INTEGER     NOT NULL DEFAULT 0,
  "failed_count"    INTEGER     NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaigns_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "campaigns_instance_id_fkey"
    FOREIGN KEY ("instance_id") REFERENCES "whatsapp_instances" ("id"),
  CONSTRAINT "campaigns_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id"),
  CONSTRAINT "campaigns_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "templates" ("id") ON DELETE SET NULL
);

CREATE INDEX "campaigns_company_id_status_idx" ON "campaigns" ("company_id", "status");
CREATE INDEX "campaigns_company_id_scheduled_at_idx" ON "campaigns" ("company_id", "scheduled_at");

CREATE TABLE "campaign_recipients" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "campaign_id"   TEXT        NOT NULL,
  "contact_id"    TEXT        NOT NULL,
  "phone"         TEXT        NOT NULL,
  "status"        TEXT        NOT NULL DEFAULT 'PENDING',
  "message_id"    TEXT,
  "error_message" TEXT,
  "sent_at"       TIMESTAMPTZ,
  "delivered_at"  TIMESTAMPTZ,
  "read_at"       TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_recipients_campaign_id_contact_id_key"
    UNIQUE ("campaign_id", "contact_id"),
  CONSTRAINT "campaign_recipients_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE,
  CONSTRAINT "campaign_recipients_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id")
);

CREATE INDEX "campaign_recipients_campaign_id_status_idx"
  ON "campaign_recipients" ("campaign_id", "status");
