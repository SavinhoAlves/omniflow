# Bug Log — OmniFlow
Auditoria feita em: 2026-08-08

---

## 🔴 CRÍTICO — ADMIN bloqueado do módulo de conversas

**Impacto:** Um usuário com role ADMIN não consegue acessar nenhuma rota do módulo de conversas nem de contatos. A tela de Conversas retorna 403 para ADMIN.

**Causa raiz:** O ADMIN tem `conversations.view_all` no seu conjunto de permissões, mas todas as rotas de conversas e contatos usam `conversations.view_own` como guard. Como ADMIN não tem `view_own`, o middleware bloqueia.

Rotas afetadas:
- `POST /conversations/start`
- `GET /conversations`
- `GET /conversations/:id`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`
- `GET /contacts`
- `GET /contacts/:id`
- `PUT /contacts/:id`

**Fix aplicado:** Adicionado `CONVERSATIONS_VIEW_OWN` ao conjunto padrão do ADMIN em `permissions.catalog.ts`. Se você pode ver tudo (`view_all`), implicitamente pode ver o que é seu (`view_own`).

---

## 🟡 MÉDIO — `conversations.view_department` é código morto

**Impacto:** Nenhum impacto direto no usuário, mas confunde quem lê o código e o seed do banco popula uma permissão que nunca é verificada.

**Causa raiz:** `CONVERSATIONS_VIEW_DEPARTMENT` foi definida no catálogo mas nunca foi usada como guard em nenhuma rota. A lógica de filtro por departamento existe no service (parâmetro `departmentId` na query), mas qualquer usuário autenticado com `view_own` já consegue usá-la — a permissão não controla nada.

**Recomendação:** Remover do catálogo OU implementar: usuários com `view_department` veem apenas conversas do seu departamento, enquanto `view_all` vê todas (sem filtro de departamento).

---

## 🟡 MÉDIO — Iniciar conversa outbound exige pouca permissão

**Impacto:** Qualquer MEMBER consegue iniciar uma conversa ativa com um cliente (ação proativa/comercial), mas não consegue transferir nem fechar conversas. O nível de permissão está inconsistente.

**Causa raiz:** `POST /conversations/start` usa `CONVERSATIONS_VIEW_OWN` como guard — a permissão mais básica do sistema. Iniciar uma conversa outbound deveria exigir pelo menos `CONVERSATIONS_TRANSFER` ou uma permissão dedicada `conversations.initiate`.

**Recomendação:** Trocar o guard de `/conversations/start` para `CONVERSATIONS_TRANSFER` no curto prazo. No longo prazo, criar `CONVERSATIONS_INITIATE` separado.

---

## 🟡 MÉDIO — Worker aceita conversas de grupos WhatsApp

**Impacto:** Mensagens de grupos WhatsApp criavam Conversations no banco com JIDs `@g.us`, poluindo o inbox de atendimento com mensagens que não são de clientes individuais.

**Fix aplicado:** `session-manager.ts` agora filtra e aceita apenas JIDs `@s.whatsapp.net` (números diretos 1-a-1). Canais (`@newsletter`), grupos (`@g.us`) e qualquer outro tipo são descartados antes de entrar na fila.

**Pendência:** Conversas indevidas que já entraram no banco não foram limpas automaticamente. Rodar a query abaixo no banco para remover:
```sql
DELETE FROM "Message"
WHERE "conversationId" IN (
  SELECT id FROM "Conversation"
  WHERE "externalId" NOT LIKE '%@s.whatsapp.net'
    AND "externalId" IS NOT NULL
);
DELETE FROM "Conversation"
WHERE "externalId" NOT LIKE '%@s.whatsapp.net'
  AND "externalId" IS NOT NULL;
```

---

## 🟢 MENOR — `conversations.service.ts` usa `where: any`

**Impacto:** Sem impacto em runtime. Risco de introduzir um campo inválido no filtro sem que o TypeScript avise.

**Causa raiz:** A função `list()` monta o objeto `where` dinamicamente com múltiplos filtros opcionais. TypeScript não consegue inferir o tipo correto sem um tipo auxiliar do Prisma.

**Recomendação:** Tipar com `Prisma.ConversationWhereInput` do pacote `@prisma/client`.

---

## 🟢 MENOR — Double non-null assertion em company-profile.routes.ts

**Impacto:** Sem impacto em runtime. `request.auth!.companyId!` usa `!` duas vezes — é seguro por design (o middleware garante que auth existe), mas é ruído de leitura.

**Recomendação:** Encapsular em helper `getAuth(request)` que retorna o tipo sem nullables.

---

## ✅ Já corrigidos em sessões anteriores

- Campo `qrcode` vs `qrCode` no schema Prisma — **corrigido**
- `GET /departments` bloqueava MEMBER — **corrigido**
- Webhook params tipado com `as any` — **corrigido**
- Seed com formato de permissões incorreto — **corrigido**
- Worker sem auto-reconnect ao reiniciar — **corrigido**
- Worker sem watchdog para sessões zombie — **corrigido**
