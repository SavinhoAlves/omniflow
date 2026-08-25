-- Phase 3 (T3.3 + T3.5): Internal notes + priority + unread counter

-- T3.5: priority field on conversations (LOW | MEDIUM | HIGH | URGENT)
ALTER TABLE "conversations"
  ADD COLUMN "priority"     TEXT NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "unread_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "conversations_company_id_priority_idx" ON "conversations" ("company_id", "priority");

-- T3.3: internal flag on messages (agent notes — not sent to customer)
ALTER TABLE "messages"
  ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "messages_conversation_id_is_internal_idx" ON "messages" ("conversation_id", "is_internal");
