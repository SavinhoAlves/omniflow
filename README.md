# Omnichannel SaaS

Multi-tenancy, autenticação e RBAC básico, canais de WhatsApp, e o começo do
CRM (departamentos, atendentes e fluxo de atendimento com bot de triagem).

## Estrutura

```
apps/api        → Fastify + TypeScript (backend HTTP)
apps/workers     → processos separados (sessões Baileys, filas BullMQ)
apps/client      → painel do CLIENTE (dono do estabelecimento): conecta
                    canais, cria departamentos, cadastra atendentes,
                    configura o fluxo/bot de atendimento
apps/platform    → painel INTERNO da OmniFlow (Super Admin/Suporte):
                    gerencia as empresas clientes do SaaS
packages/database → Prisma schema + client com isolamento de tenant
packages/providers → abstração de providers de WhatsApp
```

`apps/client` e `apps/platform` são duas aplicações Nuxt independentes, com
logins, cookies e sessões completamente separados — uma pessoa da equipe
interna não usa a mesma tela nem a mesma sessão que o dono de uma empresa
cliente. Ambas conversam com a mesma API (`apps/api`), mas por rotas
diferentes: `/auth/*` para tenants, `/platform-auth/*` para a equipe interna.

## O que foi implementado

- **Multi-tenancy**: shared schema com `company_id`, middleware do Prisma que
  injeta o filtro automaticamente (`packages/database/src/client.ts`), e
  políticas RLS no Postgres como segunda camada de defesa (`prisma/rls.sql`).
- **Autenticação de tenant**: registro de empresa + owner, login por
  `companySlug` + email + senha, access token JWT (15min) e refresh token
  rotativo e revogável guardado como hash no banco.
- **Autenticação de plataforma**: login separado para a equipe interna
  (`PlatformUser`, roles `SUPER_ADMIN`/`SUPPORT`), com seu próprio par de
  tokens e cookie (`platform_refresh_token`) — nunca compartilha sessão com
  o login de tenant, mesmo se as duas apps forem acessadas na mesma máquina.
- **RBAC granular**: catálogo fixo de permissões em código
  (`shared/permissions.catalog.ts`), defaults por role (OWNER tem tudo,
  ADMIN e MEMBER têm listas específicas), e overrides pontuais por usuário
  (`UserPermissionOverride`) para exceções sem precisar mudar o role
  inteiro. As permissões resolvidas ficam embutidas no access token — checar
  permissão em uma rota (`requirePermission(...)`) não custa ida ao banco.
- **WhatsApp (abstração de provider)**: interface `IWhatsAppProvider`
  (`packages/providers`) com 3 implementações — Meta Cloud API e Evolution
  API funcionais via REST; Baileys com sessão real via
  `apps/workers/src/whatsapp/session-manager.ts`, rodando em processo
  separado da API (`apps/workers`) e comunicando-se com ela via fila BullMQ
  (`baileys-commands` para comandos, `incoming-messages` para eventos de
  entrada). Credenciais de cada instância são criptografadas (AES-256-GCM)
  antes de ir pro banco.
- **Departamentos e fluxo de atendimento (frontend)**: telas prontas em
  `apps/client` (`/departments`, `/workflows`) — direcionamento do bot por
  menu numerado, departamento padrão de fallback. Ainda sem os endpoints
  correspondentes na API (`GET/POST /departments`, `GET/PUT /workflows`);
  as telas já tentam consumir e caem num estado vazio/erro claro enquanto
  isso não existe.

## Como rodar

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/workers/.env.example apps/workers/.env
# preencher DATABASE_URL, JWT_ACCESS_SECRET, CREDENTIALS_ENCRYPTION_KEY
# (gerar com: openssl rand -hex 32) e REDIS_URL (Redis precisa estar rodando)
npm run db:generate
npm run db:migrate
psql $DATABASE_URL -f packages/database/prisma/rls.sql
npm run db:seed # cria uma empresa demo + um PlatformUser Super Admin

# em terminais separados:
npm run dev:api        # API — http://localhost:3333
npm run dev:workers
npm run dev:client      # painel do cliente — http://localhost:3000
npm run dev:platform    # painel interno — http://localhost:3001
```

Login do painel interno (criado pelo seed): `admin@omniflow.local` / `123456`
Login do painel do cliente (criado pelo seed): empresa `empresa-demonstrativa`,
`tenant@omniflow.local` / `123456`

Teste rápido da API:

```bash
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Ltda","ownerName":"Fulano","email":"fulano@acme.com","password":"senha1234"}'
```

Proteger uma rota futura por permissão:

```ts
app.post(
  "/campaigns",
  { preHandler: requirePermission(PERMISSIONS.CAMPAIGNS_CREATE) },
  handler
);
```

## Decisões importantes para lembrar ao construir os próximos módulos

1. **Toda tabela de domínio precisa de `companyId`** e entrar na allowlist
   `TENANT_SCOPED_MODELS` em `packages/database/src/client.ts` — senão o
   isolamento automático não se aplica a ela.
2. **Nunca conectar a aplicação ao Postgres com um role superuser** — isso
   ignora RLS silenciosamente e anula a segunda camada de defesa.
3. **Toda nova rota autenticada** já ganha isolamento de tenant de graça, só
   por estar registrada depois do hook `tenantMiddleware` em `server.ts`.
   Rotas que precisam ser públicas (ex: webhook do WhatsApp) usam
   `{ config: { public: true } }`.

## Limitação conhecida (documentada, não escondida)

O `SessionManager` do Baileys usa `useMultiFileAuthState`, que grava a sessão
em disco local do processo worker (`apps/workers/.baileys-sessions/`). Isso
funciona para desenvolvimento e para uma única réplica de worker de longa
duração, mas **não sobrevive a um container efêmero sendo recriado** (ex:
deploy, crash + restart em Kubernetes sem volume persistente). Antes de ir
para produção real, trocar por uma implementação de auth state que persista
em Postgres ou S3 — o formato do estado do Baileys é serializável em JSON,
então a troca é isolada dentro de `session-manager.ts`.

## Próximos passos sugeridos

1. Persistência de auth state do Baileys em Postgres/S3 (ver limitação acima)
2. Módulo de Contatos + Conversas — consome a fila `incoming-messages`
   publicada pelo worker, já nascendo com `requirePermission` e filtro por
   departamento
3. Módulo de Usuários (CRUD + tela de gestão de permissões, consumindo
   `/permissions/catalog` e `/permissions/overrides`)
