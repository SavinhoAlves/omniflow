-- =============================================================
-- FASE 1 — Fundação de Segurança
-- T1.2: Refresh token family tracking (reuse detection)
-- T1.3: Baileys session persistence (PostgreSQL)
-- T1.5: Activity log expandido (before/after, ip, requestId)
-- =============================================================

-- T1.2: Adicionar family_id e replaced_by_id em refresh_tokens
-- family_id: identifica a "família" de refresh tokens (uma cadeia de rotação)
-- replaced_by_id: aponta para o token que substituiu este (para auditoria)
ALTER TABLE "refresh_tokens"
  ADD COLUMN "family_id"     TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "replaced_by_id" TEXT;

-- Índice para buscar toda a família rapidamente (revogação em cascata)
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");

-- T1.5: Expandir activity_logs com campos de auditoria enriquecida
ALTER TABLE "activity_logs"
  ADD COLUMN "before_state" JSONB,
  ADD COLUMN "after_state"  JSONB,
  ADD COLUMN "ip_address"   TEXT,
  ADD COLUMN "user_agent"   TEXT,
  ADD COLUMN "request_id"   TEXT;

-- T1.3: Tabelas para persistência de sessão Baileys
CREATE TABLE "bailey_sessions" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "instance_id" TEXT NOT NULL,
  "creds"       JSONB,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bailey_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bailey_sessions_instance_id_key" ON "bailey_sessions" ("instance_id");

CREATE TABLE "bailey_session_keys" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "session_id" TEXT NOT NULL,
  "key_type"   TEXT NOT NULL,
  "key_id"     TEXT NOT NULL,
  "value"      JSONB NOT NULL,

  CONSTRAINT "bailey_session_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bailey_session_keys_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "bailey_sessions" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "bailey_session_keys_session_id_key_type_key_id_key"
  ON "bailey_session_keys" ("session_id", "key_type", "key_id");

CREATE INDEX "bailey_session_keys_session_id_idx" ON "bailey_session_keys" ("session_id");
