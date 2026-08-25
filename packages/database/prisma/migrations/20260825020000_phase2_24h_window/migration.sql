-- Phase 2 (T2.4): 24h messaging window control for WhatsApp
-- windowExpiresAt is refreshed every time an inbound message arrives.
-- The API uses it to compute windowStatus: open | expired | none.

ALTER TABLE "conversations"
  ADD COLUMN "window_expires_at" TIMESTAMPTZ;

CREATE INDEX "conversations_window_expires_at_idx"
  ON "conversations" ("window_expires_at")
  WHERE "window_expires_at" IS NOT NULL;
