-- Phase 5 (T5.1–T5.5): Productivity features

-- T5.2: Tags array on conversations (PostgreSQL TEXT[])
ALTER TABLE "conversations"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- T5.1: Saved replies (canned responses)
CREATE TABLE "saved_replies" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id" TEXT        NOT NULL,
  "title"      TEXT        NOT NULL,
  "content"    TEXT        NOT NULL,
  "tags"       TEXT[]      NOT NULL DEFAULT '{}',
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "saved_replies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_replies_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "saved_replies_company_id_idx" ON "saved_replies" ("company_id");
