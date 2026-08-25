-- Phase 8 (T8.1–T8.4): AI Conversation Metadata

CREATE TABLE "ai_conversation_meta" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id"   TEXT        NOT NULL,
  "sentiment"         TEXT,
  "sentiment_score"   DOUBLE PRECISION,
  "category"          TEXT,
  "summary"           TEXT,
  "suggested_replies" JSONB       NOT NULL DEFAULT '[]',
  "last_processed_at" TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ai_conversation_meta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversation_meta_conversation_id_key" UNIQUE ("conversation_id"),
  CONSTRAINT "ai_conversation_meta_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE
);

CREATE INDEX "ai_conversation_meta_conversation_id_idx"
  ON "ai_conversation_meta" ("conversation_id");
