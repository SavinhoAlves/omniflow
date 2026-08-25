-- Phase 10 (T10.1–T10.3): SaaS / Billing

-- T10.2: Plans
CREATE TABLE "plans" (
  "id"                          TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "name"                        TEXT          NOT NULL,
  "display_name"                TEXT          NOT NULL,
  "price_monthly"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "max_agents"                  INTEGER       NOT NULL DEFAULT 3,
  "max_instances"               INTEGER       NOT NULL DEFAULT 1,
  "max_conversations_per_month" INTEGER       NOT NULL DEFAULT 500,
  "max_campaigns_per_month"     INTEGER       NOT NULL DEFAULT 0,
  "ai_enabled"                  BOOLEAN       NOT NULL DEFAULT false,
  "analytics_enabled"           BOOLEAN       NOT NULL DEFAULT false,
  "created_at"                  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plans_name_key" UNIQUE ("name")
);

-- Seed default plans
INSERT INTO "plans" ("name", "display_name", "price_monthly", "max_agents", "max_instances", "max_conversations_per_month", "max_campaigns_per_month", "ai_enabled", "analytics_enabled") VALUES
  ('free',         'Grátis',        0,      2, 1, 100,   0, false, false),
  ('starter',      'Starter',       97,     5, 2, 1000,  2, false, false),
  ('professional', 'Professional',  297,   15, 5, 5000, 10, true,  true),
  ('enterprise',   'Enterprise',   997,    99, 20, 999999, 99, true, true);

-- T10.2: Subscriptions
CREATE TABLE "subscriptions" (
  "id"                   TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"           TEXT        NOT NULL,
  "plan_id"              TEXT        NOT NULL,
  "status"               TEXT        NOT NULL DEFAULT 'ACTIVE',
  "current_period_start" TIMESTAMPTZ NOT NULL,
  "current_period_end"   TIMESTAMPTZ NOT NULL,
  "external_id"          TEXT,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_company_id_key" UNIQUE ("company_id"),
  CONSTRAINT "subscriptions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans" ("id")
);

CREATE INDEX "subscriptions_company_id_idx" ON "subscriptions" ("company_id");

-- T10.1: Usage metering
CREATE TABLE "usage_meters" (
  "id"            TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"    TEXT    NOT NULL,
  "period"        TEXT    NOT NULL,
  "conversations" INTEGER NOT NULL DEFAULT 0,
  "campaigns"     INTEGER NOT NULL DEFAULT 0,
  "ai_calls"      INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usage_meters_company_id_period_key" UNIQUE ("company_id", "period"),
  CONSTRAINT "usage_meters_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "usage_meters_company_id_period_idx" ON "usage_meters" ("company_id", "period");
