-- Phase 6 (T6.4): Scheduled Messages

CREATE TABLE "scheduled_messages" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"      TEXT        NOT NULL,
  "conversation_id" TEXT        NOT NULL,
  "created_by_id"   TEXT        NOT NULL,
  "content"         TEXT        NOT NULL,
  "media_url"       TEXT,
  "media_type"      TEXT,
  "scheduled_at"    TIMESTAMPTZ NOT NULL,
  "sent_at"         TIMESTAMPTZ,
  "status"          TEXT        NOT NULL DEFAULT 'PENDING',
  "error_message"   TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduled_messages_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "scheduled_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE,
  CONSTRAINT "scheduled_messages_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
);

CREATE INDEX "scheduled_messages_status_scheduled_at_idx"
  ON "scheduled_messages" ("status", "scheduled_at");
CREATE INDEX "scheduled_messages_company_conversation_idx"
  ON "scheduled_messages" ("company_id", "conversation_id");
