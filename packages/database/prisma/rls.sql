-- ============================================================
-- Row Level Security — defesa em profundidade contra vazamento
-- de dados entre empresas (tenants).
--
-- Rodar DEPOIS de `prisma migrate deploy`, pois depende das
-- tabelas já existirem. Adicionar ao script de deploy/CI.
--
-- Requer que a aplicação use um DB role SEM privilégio BYPASSRLS
-- (o superuser do Postgres ignora RLS por padrão — nunca conectar
-- a aplicação com o role de superuser).
-- ============================================================

-- Exemplo para as tabelas já modeladas nesta etapa.
-- Ao criar novas tabelas com company_id, repetir o padrão abaixo.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON users
  USING (company_id = current_setting('app.current_company_id', true));

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_departments ON departments
  USING (company_id = current_setting('app.current_company_id', true));

ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_whatsapp_instances ON whatsapp_instances
  USING (company_id = current_setting('app.current_company_id', true));

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workflows ON workflows
  USING (company_id = current_setting('app.current_company_id', true));

-- workflow_rules não tem company_id direto (chega nele via
-- workflow_id) — mesmo caso de refresh_tokens/user_departments
-- abaixo: protegida indiretamente pelo join com workflows na
-- aplicação. Se um dia for consultada diretamente sem join,
-- considerar RLS própria via subquery em workflow_id.

-- companies NÃO tem RLS por company_id (é a própria raiz do tenant).
-- Acesso a ela é controlado na camada de aplicação (ex: só o próprio
-- usuário pode ler os dados da sua company).

-- refresh_tokens e user_departments são acessadas via join com users,
-- então herdam a proteção indiretamente, mas se algum dia forem
-- consultadas diretamente sem join, considerar RLS própria também.

-- ============================================================
-- Módulo de Conversas — contacts, conversations, messages
-- ============================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_contacts ON contacts
  USING (company_id = current_setting('app.current_company_id', true));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_conversations ON conversations
  USING (company_id = current_setting('app.current_company_id', true));

-- messages não tem company_id direto — proteção via subquery na
-- tabela pai (conversations). Assim um tenant nunca lê mensagens
-- de conversas de outro tenant mesmo sem o app.current_company_id
-- estando set em queries diretas.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_messages ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE company_id = current_setting('app.current_company_id', true)
    )
  );
