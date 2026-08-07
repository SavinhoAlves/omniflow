-- Cria o role de aplicação que a API e os Workers usam em runtime.
--
-- IMPORTANTE: sem SUPERUSER nem BYPASSRLS — o Row Level Security do
-- Postgres precisa estar ativo para esse role para que a segunda camada
-- de defesa de isolamento de tenant funcione. Ver packages/database/prisma/rls.sql.
--
-- CREATEDB: necessário para o Prisma criar o shadow database durante
-- `prisma migrate dev`. Não é equivalente a SUPERUSER.

CREATE ROLE omnichannel_app WITH
  LOGIN
  PASSWORD 'omnichannel_dev'
  NOSUPERUSER
  CREATEDB
  NOCREATEROLE
  NOREPLICATION;

-- Tornar omnichannel_app dono do banco para herdar todos os
-- privilégios de schema, inclusive CREATE no public schema
-- (restrição introduzida no PostgreSQL 15).
ALTER DATABASE omnichannel OWNER TO omnichannel_app;
