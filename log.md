---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-05-06 (noite — HOTFIX R102: dept NULL em conversas atendidas pela IA + smoke completo)

**Smoke E2E completo finalmente:** usuária mandou "Olá" no WhatsApp, IA respondeu "Olá! Bem-vindo a Eletropiso, com quem eu falo?". 🎉

**3 dúvidas reportadas pela usuária — diagnóstico:**

1. **Conversa George não aparece na lista** — está sim no DB (`828e45b2-...`, last_msg 23:27). **Cache stale do React Query** (hook `useHelpdeskConversations` carregou antes do INSERT, realtime broadcast não invalidou). **Refresh resolve.** Não é bug de DB.
2. **Botão "Ativar IA" desligado** — DB diz `status_ia='ligada'` ✅. Mesmo cache stale. **Refresh resolve.**
3. **Departamento "Nenhum"** — DB confirma `department_id=NULL` ❌. **Bug real R102.**

### R102 — Webhook não populava dept em conversas novas

**Causa:** `whatsapp-webhook/index.ts:789-801` setava apenas `inbox_id, contact_id, status, priority, is_read, last_message_at` no INSERT de conversa nova. R95 (2026-05-05) corrigiu o caminho do `assign-handoff`, mas conversas atendidas pela IA (que NUNCA fazem handoff) ficavam sem dept indefinidamente.

**Impacto:** 16 conversas Eletropiso afetadas (incluindo a recém-criada do George).

**Fix aplicado:**
1. **Backfill SQL via MCP** — 16 conversas ganharam `department_id=Vendas` (UPDATE com JOIN inboxes WHERE dept IS NULL AND default_department_id IS NOT NULL)
2. **Fix código:** SELECT de inbox passa a incluir `default_department_id`; INSERT de conversa popula `department_id: inbox.default_department_id ?? null`. tsc 0.

**Pendente operacional:** usuário precisa rodar `npx supabase functions deploy whatsapp-webhook --project-ref prfcbfumyrrycsrcrvms` (eu não tenho PAT da org nova). Sem deploy, próximas conversas novas voltam a entrar com dept NULL — backfill cobre só as existentes.

**SYNC RULE:** N/A (fix backend isolado, não AI Agent feature).

**R102 documentado** em `wiki/erros-e-licoes.md` (linhas 226-247) com regra preventiva: ao criar registro novo em tabela com FK opcional para config default em parent, popular desde criação — não confiar em fluxo posterior (handoff) pra setar.

### Status final do smoke E2E migração

✅ Mensagem WhatsApp recebida pelo webhook (R101 fechou o gate)
✅ IA processou e respondeu corretamente
✅ Conversa criada no helpdesk
✅ Department populado após R102 backfill (refresh do UI mostra "Vendas")
⚠️ Cache stale do React Query — refresh resolve, mas merece investigação do hook `useHelpdeskConversations`/realtime broadcast em sessão futura

**Smoke E2E migração Eletropiso COMPLETO.** Atendentes operam plenamente no projeto novo.

**Frase pra retomar:**
- **"investigar realtime cache stale helpdesk"** — atacar #1 e #2 (cache stale ao receber msg nova)
- **"prossiga"** — Onda 5 Playwright
- **"pausar projeto antigo"** — pausar `euljumeflwtljegknawy` (recuperável 30d) já que smoke 100%

---

## 2026-05-06 (noite — HOTFIX R101: GRANTs faltando para service_role)

**Goal:** Smoke E2E real da migração — usuária mandou WhatsApp pro Eletropiso, n8n recebeu UAZAPI webhook, encaminhou pro `whatsapp-webhook` do projeto novo, **404 "Instance not found"**. Atendentes não recebiam mensagens.

**Cadeia de diagnóstico:**
1. SQL direto: `SELECT * FROM instances WHERE name='Eletropiso'` → 1 row OK (token bate, owner_jid bate)
2. Reproduzi 404 via curl direto na edge fn
3. Testei query OR via PostgREST com publishable key → `[]` (esperado por RLS)
4. Policies RLS de `instances`: 4 policies normais
5. **GRANTs:** `anon`, `authenticated`, `postgres` tinham SELECT. **`service_role` NÃO tinha GRANT em NENHUMA das 91 tabelas public.**

**Causa raiz:** R98 (hotfix da migração) corrigiu GRANTs para `anon`/`authenticated` mas esqueceu `service_role`. Service_role normalmente bypassa RLS, mas precisa do GRANT básico antes — sem ele, recebe `[]` silenciosamente em SELECTs (sem erro 42501, sem nada). **TODAS as 41 edge fns que usam `createServiceClient()` estavam silenciosamente quebradas** desde o cutover (5h atrás).

**Fix:** Migration `20260506232300_r101_grant_service_role_public.sql` aplicada via MCP. Aplica os mesmos GRANTs do R98, mas para `service_role`.

**Validação:**
- `service_role_has_grants` 0 → 91 tabelas
- `curl POST /functions/v1/whatsapp-webhook` com payload UAZAPI Eletropiso → **200 OK + conversation_id `4e1625cd-...`**
- Cleanup: deletei conversa de teste + contact duplicado "George Test" (`410e62c1-...`); George real (`d54caaac...`, criado 2026-02-24) intacto

**SYNC RULE:** N/A (fix infraestrutural, não AI Agent feature). Migration registrada no repo.

**R101 documentado** em `wiki/erros-e-licoes.md` (linhas 191-225) com:
- Cadeia completa de descoberta
- Por que escapou (R98 cobriu apenas anon/authenticated, service_role não testado)
- Regra preventiva: ao replicar projeto Supabase, conferir GRANTs em **3 roles** (anon, authenticated, service_role)
- Verificação rápida via `information_schema.role_table_grants`
- **Smoke E2E real é o único teste que pega esse padrão** (Playwright client-side não detecta — passa pelo authenticated com RLS, não service_role)

**Próximo:** smoke E2E real completo — usuária precisa **mandar outra msg WhatsApp** (n8n não retentou a primeira). Validar fluxo end-to-end (msg recebida → IA responde → conversa visível no helpdesk).

**Frase pra retomar:**
- **"continuar smoke E2E"** — você manda outra msg pro 558181696546 e eu valido fluxo completo
- **"prossiga"** — Onda 5 Playwright

---

## 2026-05-06 (tarde — Playwright Onda 4: 30 testes interativos, 0 bugs)

**Goal:** quarta onda Playwright cobrindo interações leves (clicks, fill+restore, navegação tabs/passos) em Helpdesk conversation, AI Agent tabs, Kanban Board detail, Funnels Wizard, Flows Wizard, Lead detail.

**Specs novos (`e2e/19..24`):**
- `19-helpdesk-conversation.spec.ts` — lista lateral, click conversa, URL, header inbox, console errors
- `20-ai-agent-tabs.spec.ts` — Setup default, navegar Prompt/Qualificação/Inteligência, **fill+restore input** (padrão read-only pra testar editável sem destruir dados de prod)
- `21-kanban-detail.spec.ts` — /crm lista, click board, /crm/:id, sidebar, sem 401/403
- `22-funnels-wizard.spec.ts` — Wizard renderiza, etapas, 7 tipos, cards interativos, conteúdo
- `23-flows-wizard.spec.ts` — /flows/new/wizard, /templates, /new modes, /flows lista, RLS
- `24-lead-detail.spec.ts` — Lista leads, click → /leads/:id, sem ErrorBoundary, RLS, sidebar

**Run inicial: 29/30 PASS.** 1 falha em Funnels Wizard #4 — passo 1 do wizard é "Qual o objetivo do seu funil?" (cards clicáveis, sem inputs). Fix: validar elementos interativos em vez de inputs.

**Run final: 30/30 PASS** após fix.

**Padrão novo "fill+restore"** documentado em `20-ai-agent-tabs.spec.ts:5` — testa que input é editável sem persistir mudança em prod.

### Cobertura acumulada (4 ondas)

| Onda | Testes | Pass | Bugs reais | Tempo |
|------|---:|---:|---:|---:|
| 1 | 30 | 30/30 | 0 | 3.7min |
| 2 | 30 | 30/30 | 1 (R100) | 6.1min |
| 3 | 30 | 30/30 | 0 | 3.9min |
| 4 | 30 | 30/30 | 0 | ~6min |
| **Total** | **120** | **120/120 ✅** | **1** | **~20min suite full** |

**SYNC RULE:** N/A (infra de testes).

**Áreas ainda não cobertas:** drag-drop (flaky), realtime multi-session, CRUD destrutivo (prod = Eletropiso real), upload, edge cases (session expira, network slow).

**Frase pra retomar:**
- **"prossiga"** — Onda 5 (~30 testes): scenarios reais com fill+restore extensivo, helpdesk reply input, validação de templates, hover/keyboard nav, error boundaries
- **"continuar smoke E2E migracao"** — você manda msg pro 558181696546

---

## 2026-05-06 (manhã — Playwright Onda 3: 30 testes profundos, 0 bugs)

**Goal:** terceira onda Playwright cobrindo Métricas profundas, Admin profundo, Catálogo, Knowledge, Forms e Bio Page editor.

**Specs novos (`e2e/13..18`):**
- `13-metricas-deep.spec.ts` — /gestao/transbordo, /gestao/origem, KPIs, filtros, /assistant input
- `14-admin-deep.spec.ts` — /admin/secrets, /admin/docs, /admin/backup, users new btn, /admin/inboxes Eletropiso
- `15-catalog-deep.spec.ts` — lista produtos, btn add, busca, sem 401/403, conteúdo migrado
- `16-knowledge-deep.spec.ts` — header, btn novo FAQ, lista, sem 401/403, sem white screen
- `17-forms-deep.spec.ts` — página, btn novo, lista (6 forms), sem 401/403, sidebar
- `18-bio-deep.spec.ts` — página, btn criar, lista, sem 401/403, sem white screen

**Resultado: 31/31 PASS** em 3.9min. **Zero falhas na primeira run** — lições das Ondas 1+2 (seletores tolerantes, count, OR locator, texto-âncora múltiplo) aplicadas desde o começo.

**Confirmações cruzadas:**
- R98 (GRANTs) corrigido em todas as RLS testadas
- R99 (27 colunas) corrigido — páginas dependentes renderizam
- R100 (SelectItem) era a única bomba relógio (grep confirma)

**Cobertura acumulada (3 ondas):** 90 testes, 90/90 PASS, 1 bug real corrigido (R100), suite completa em ~14min.

**Commit `d92a99a` pushed** (R100 fix + 60 testes Onda 1+2 + Playwright setup). CI buildou em ~57s, Portainer redeployou — produção ganhou o fix R100 + os 60 testes históricos.

**SYNC RULE:** N/A (infra de testes, sem feature do AI Agent).

**Próximas ondas (~6h cada):**
- **Onda 4:** CRUD profundo — abrir conversa Helpdesk, salvar AI Agent campos, drag-drop Kanban, Wizard funis 4 passos, Flows wizard 4 etapas, NPS/Polls editor
- **Onda 5:** Realtime, edge cases (session expira, network slow), regression de R93/R94/R95

**Frase pra retomar:**
- **"prossiga"** — Onda 4 (CRUD profundo, ~30 testes)
- **"continuar smoke E2E migracao"** — você manda msg pro 558181696546

---

## 2026-05-06 (manhã — Playwright Onda 2: 30 testes deep + bug R100 corrigido)

**Goal:** aprofundar cobertura E2E em 6 áreas (Helpdesk deep, AI Agent deep, Leads/CRM deep, Campanhas, Broadcast, Flows) — 30 testes a mais sobre os 30 da Onda 1.

**Specs novos (`e2e/07..12`):**
- `07-helpdesk-deep.spec.ts` — inbox selector, tabs escopo, painel central, sem 401/403 (R98 regression), QueuePauseToggle
- `08-ai-agent-deep.spec.ts` — tab Setup fields, tab Qualificação categorias (Eletropiso 23 cat), /knowledge, /playground tabs, /catalog
- `09-leads-crm-deep.spec.ts` — filtro/busca leads, sidebar, /crm placeholder, /funnels lista, /funnels/new wizard
- `10-campanhas.spec.ts` — /campaigns lista, /new form, placeholders, sidebar Disparador, sem 4xx/5xx
- `11-broadcast.spec.ts` — /broadcast main, /history, /leads, /templates, /scheduled
- `12-flows.spec.ts` — /flows lista, /new selector, /new/templates, /instances Eletropiso visível, /assistant widget

**Run inicial: 25/30 PASS (5 fail).**
- 4 falhas eram seletor frágil (QueuePauseToggle só renderiza se user em deptos, Playground tem 4 tabs com botão só na Manual, Sidebar Campanhas dentro de Collapsible Disparador) → ajustadas
- **1 falha era BUG REAL** → R100

### 🚨 R100 — Bug em CampaignForm corrigido

**Detectado por Playwright** quando a fn `/campaigns/new` lançou ErrorBoundary:
> `A <Select.Item /> must have a value prop that is not an empty string.`

**Causa:** `src/components/campaigns/CampaignForm.tsx:309` tinha `<SelectItem value="">Nenhum</SelectItem>`. Radix Select reserva `value=""` para placeholder; ao montar, lança erro síncrono → componente inteiro crasha → criação de campanha 100% inacessível.

**Fix:** sentinel `__none__` com mapeamento bidirecional no `value`/`onValueChange`. Estado interno e payload do INSERT permanecem `""` ("sem funil"). Grep confirmou: era a única ocorrência no projeto.

**Validação pós-fix:**
- `tsc --noEmit` = 0 erros
- 5/5 testes Campanhas passam
- Todas as 60 specs Onda 1+2 passam: **61/61 PASS** (60 testes + 1 setup) em 6.1min

**Regra 100 documentada** em [[wiki/erros-e-licoes]] — checklist de PR: `grep -rn 'SelectItem value=""' src/` deve sempre retornar 0.

### SYNC RULE
Frontend único arquivo (`CampaignForm.tsx`) — não é feature do AI Agent, sem 8-way sync.

### Auditoria
- 5 ondas de seletor frágil corrigidas (sem bug)
- 1 bug real corrigido (R100)
- Wiki nova `playwright-onda2.md` (~120 linhas)
- Wiki `erros-e-licoes.md` ganhou R100 (linha ~163, total 187)
- Working tree: `CampaignForm.tsx` modificado + 6 specs novos + config + setup + wiki

### Frase pra retomar
- **"prossiga"** — Onda 3 (~30 testes, 6h): Métricas profundas (4 fichas), Admin CRUD, Catálogo CRUD, Knowledge CRUD
- **"continuar smoke E2E migracao"** — você manda msg pro 558181696546 e eu valido
- **"commit + push fix R100"** — produção pega o fix

---

## 2026-05-06 (manhã — Playwright Onda 1: 30 testes smoke, 31/31 PASS)

**Goal:** introduzir suite Playwright cobrindo 30 testes (5/spec × 6 áreas) sobre dev local pra dar uma safety net antes da Onda 2/3/4 com mais profundidade.

**Setup novo:**
- `@playwright/test@1.59.x` + `dotenv` em devDependencies
- `playwright.config.ts` (ESM, `workers: 1`, storageState global, trace/screenshot/video em falhas)
- `e2e/global.setup.ts` — autentica 1x e salva `e2e/.auth/admin.json` (gitignored)
- `e2e/01..06-*.spec.ts` — 6 specs cobrindo Auth, Helpdesk, AI Agent, Leads/CRM, Admin, Dashboard/Métricas
- `.env.local` já tinha `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`TEST_BASE_URL=http://localhost:8080`

**Run inicial: 22/30 PASS (9 fail)** — todas as 9 falhas eram **seletor frágil, zero bug real na app**:
- Sidebar Helpdesk como `<button>` (não `<a role=link>`)
- Spans com `sm:hidden` (responsive)
- HelpDesk/AdminPanel/ManagerDashboard sem `<h1>/<h2>` explícito
- AIAgentTab usa `<button>` custom (não shadcn Tabs com `role="tab"`)
- AdminPanel é `<Navigate>` puro pra `/admin/inboxes`
- Cookies persistindo entre testes de auth-positivo → auth-negativo

**Run final: 31/31 PASS em 3.7min.** Auditoria completa em `wiki/playwright-onda1.md`.

**Lições documentadas para próximas ondas:**
- Não usar h1/h2 como âncora — várias páginas-chave não têm
- Sidebar global ("Atendimento") = ponto de teste estável quando logado
- Limpeza de auth: `clearCookies` + `localStorage.clear()` + `sessionStorage.clear()` antes de cada teste sem-auth
- `getByRole('tab')` retorna 0 em AIAgentTab (e provavelmente outras seções) — usar texto direto

**SYNC RULE:** N/A (infra de testes, não AI Agent feature). Não atualiza PRD nem RoadmapTab.

**Próximas ondas (após decisão do usuário):**
- Onda 2 (~30 testes, 6h): Core Atendimento — Helpdesk profundo, AI Agent CRUD, Leads CRUD
- Onda 3 (~30 testes, 6h): Canais — Campanhas, Bio, Forms, Funis, Broadcast
- Onda 4 (~30 testes, 8h): Plataforma — Dashboard, Métricas (4 fichas), Admin (7 sub), Instâncias

**Pendências paralelas (não relacionadas a Playwright):**
- Smoke E2E migração Eletropiso pausado (esperando user mandar msg WhatsApp pro 558181696546)
- Cleanup n8n (`event-processor` 404 + `process-jobs` 401 — ver [[wiki/free-forever-playbook]])
- Rotação credenciais pós-migração (ver [[wiki/migracao-eletropiso-COMPLETA]])

---

## 2026-05-06 (madrugada — HOTFIX 3: 27 colunas faltando em 7 tabelas)

**Sintoma:** Após login + GRANTs, frontend mostrava "0 conversas / Nenhuma conversa nesta caixa" mesmo com 17 rows em `conversations` no DB.

**Causa raiz:** Coluna `archived` faltando em `public.conversations` (frontend filtra `archived=false`). Auditoria expandida via `dblink` cruzando `information_schema.columns` revelou **27 colunas faltando em 7 tabelas**. Origem: migrations Lovable que pulei (substituidas pelo snapshot 2026-03-20) tinham vários `ALTER TABLE ADD COLUMN` que não rodaram.

**Tabelas afetadas:**
- `ai_agents` (8 colunas: business_info, excluded_products, extraction_address_enabled, handoff_message, max_enrichment_questions, returning_greeting_message, voice_name, voice_reply_to_audio)
- `bio_pages` (9 colunas relacionadas ao Bio Link e captura de leads)
- `bio_buttons` (3 colunas: starts_at, ends_at, catalog_product_id)
- `ai_agent_knowledge`, `ai_agent_media` (updated_at)
- `e2e_test_batches` (4 colunas)
- `lead_profiles` (objections text[])
- `conversations` (archived bool)

**Fix:**
1. ALTER TABLE ADD COLUMN IF NOT EXISTS pra cada coluna (com default copiado do antigo)
2. UPDATE via dblink pra preencher VALORES reais do antigo (defaults dos ALTERs ficaram com valor padrão, dados originais perdidos)
3. NOTIFY pgrst, 'reload schema'

**Validação:**
- `ai_agents.business_info IS NOT NULL` = 1 (Eletropiso preenchida)
- `conversations.archived = false` = 17 (correto)

**Lição (R99):** Ao replicar schema entre projetos via skip de migrations Lovable + snapshot, NÃO basta replay das migrations subsequentes — também precisa re-puxar via dblink/dump as colunas adicionadas pelas Lovable migrations puladas. Auditoria via cross-DB diff em `information_schema.columns` é o método definitivo: `WHERE (table_name, column_name) NOT IN (SELECT ... FROM novo)`.

---

## 2026-05-06 (madrugada — HOTFIX 2: GRANTs faltando em todas tabelas public)

**Sintoma:** Após login OK, frontend mostrava "Você não tem acesso a nenhuma caixa" + sidebar com role "Atendente" + 403 em queries diretas (`user_roles`, `user_profiles`, `departments`, `instances`, `inbox_users`, `handoff_queue_events`).

**Body do 403:** `{"code":"42501","message":"permission denied for table user_roles","hint":"GRANT SELECT ON public.user_roles TO authenticated"}`

**Causa raiz:** Postgres exige 2 camadas: GRANT (permissão básica de operação) + RLS (filtro de rows). Sem GRANT, RLS nem é avaliado — bloqueia direto. As migrations Lovable que pulei (Sprints 1-2 da migração marcou como skipped) tinham os GRANTs implícitos. Sem rodar, anon/authenticated ficaram sem permissão em **todas as tabelas public**.

**Validação adicional:** `is_super_admin('a1b4fd3e...')` rpc retorna `true` (função funciona). Policies RLS estão idênticas ao antigo. Apenas GRANTs faltavam.

**Fix:**
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
```

**Pegadinha:** primeira tentativa incluiu `GRANT EXECUTE ON ALL FUNCTIONS` — falhou em `dblink_connect_u` (função interna sem permissão) e abortou TODA a transação. Removendo a parte de funções, GRANTs nas tabelas passaram. Defaults garantem que tabelas futuras herdam.

**Validação:**
- `GET /rest/v1/user_roles` (com Bearer George) → retorna row super_admin ✅
- `GET /rest/v1/instances` → retorna Eletropiso ✅
- `GET /rest/v1/conversations` → HTTP 206 ✅

**Lição (R98):** Ao replicar schema entre projetos Supabase via push de migrations + skip seletivo, conferir manualmente que `GRANT ... TO anon, authenticated` foi aplicado em todas as tabelas `public`. Sem GRANT, RLS é cosmético — PostgREST retorna 403/42501 antes mesmo de avaliar as policies.

**Próximo:** smoke E2E completa (recarregar frontend + verificar conversas + IA + cron).

---

## 2026-05-06 (madrugada — HOTFIX auth.users após cutover: instance_id NULL)

**Sintoma:** Após cutover, login `george.azevedo2023@gmail.com` retornava 400 "Invalid login credentials" mesmo com hash bcrypt validado matematicamente via SQL (`crypt('123456@', encrypted_password) = encrypted_password` retornava true).

**Causa raiz:** Quando inseri os 7 auth.users via SQL (Onda 2), **omiti** o campo `instance_id` no INSERT — ficou NULL no novo. No antigo era `00000000-0000-0000-0000-000000000000` (UUID zero, padrão GoTrue/Supabase Auth). GoTrue usa esse campo pra rotear users — sem ele, Auth API retorna `user_not_found` mesmo com row presente em `auth.users`.

**Sintoma secundário:** `auth.identities` também estava vazio. Identities são usadas pra mapear provider→user no login. Inseri todas via dblink antes de descobrir o problema do `instance_id`. Identities sozinhas não resolveram — instance_id era a causa raiz.

**Fix:**
```sql
UPDATE auth.users SET instance_id = '00000000-0000-0000-0000-000000000000' WHERE instance_id IS NULL;
```

Validação: `POST /auth/v1/token?grant_type=password` retornou JWT válido após o UPDATE. Login confirmado funcional.

**Lição (R97):** Ao migrar `auth.users` via SQL direto (sem passar pelo Admin API do Supabase), conferir manualmente que `instance_id` está populado. Padrão default `'00000000-0000-0000-0000-000000000000'` é pré-requisito pro GoTrue enxergar o user. Mesmo `auth.identities` populadas e hash válido não bastam.

**Próximo:** smoke E2E completa — login de outro atendente + helpdesk + IA + cron.

---

## 2026-05-06 (madrugada — Ondas 6+7 SHIPPED: CUTOVER LIVE)

**Onda 7 (n8n + UAZAPI) feito pelo usuário:**
- Fluxo 1 `requeue-conversations` (1min): URL atualizada `prfcbfumyrrycsrcrvms.supabase.co` + Bearer publishable nova
- Fluxo 2 `whatsapp-webhook` (UAZAPI inbound): URL atualizada
- UAZAPI webhook na instância Eletropiso continua apontando `https://fluxwebhook.wsmart.com.br/webhook/eletropiso_2026` (mesmo n8n cluster, sem mudança necessária)

**Smoke pré-push:**
- `whatsapp-webhook`: 200 + skip event não-message (correto)
- `requeue-conversations`: 200 + processou fila (vazia)

**Onda 6 push + deploy:**
- GitHub bloqueou push por secret scanning (Groq key em log.md de commits anteriores). User clicou "Allow" no link unblock.
- Commit `629916e` pushed (após `git commit --amend` redigindo log.md atual).
- CI build success em 57s.
- Webhook Portainer disparado: 204 No Content.
- Container redeployado com bundle novo `index-PKnxTzaI.js`.
- Verificado: 2 ocorrências de `prfcbfumyrrycsrcrvms.supabase.co` no bundle, zero `euljumeflwtljegknawy`.

**CUTOVER COMPLETO** — atendentes Eletropiso a partir de agora conversam com o novo projeto.

**Lição aprendida (feedback memory salva):** NUNCA escrever valores de API keys em plaintext em arquivos committed (mesmo log.md/wiki). Sempre usar descrição/hash/preview até 8 chars. GitHub secret scanning bloqueia push e exige unblock manual.

**Próximo:** Onda 8 — smoke E2E (login atendente, mandar msg, IA responde, fluxo completo) + pausar projeto antigo se OK.

---

## 2026-05-06 (madrugada — Onda 6 PRONTA — commit cutover NÃO pushed)

Frontend rebuildado pra apontar pro novo Supabase. **Não pushed** — usuário decide momento do cutover.

**Arquivos atualizados (`euljumeflwtljegknawy` → `prfcbfumyrrycsrcrvms`):**
- `.env` (3 vars)
- `Dockerfile` (ENV vars no build)
- `supabase/config.toml` (project_id)
- `src/pages/BioPage.tsx` (3 fallbacks)
- `src/pages/CampaignRedirect.tsx` (1 fallback)
- `src/hooks/useCampaigns.ts` (1 fallback)
- `src/hooks/useBioPages.ts` (1 fallback)

Validação: `npx tsc --noEmit` passou (0 erros).

**Cutover acontece quando o usuário rodar `git push`** + redeploy via Portainer. CI vai buildar nova imagem com env do novo, atendentes do Eletropiso vão começar a chamar `prfcbfumyrrycsrcrvms`.

**Próximo:** Onda 7 — usuário atualiza n8n workflow URL + UAZAPI webhook URL no painel.

---

## 2026-05-06 (madrugada — Onda 5 SHIPPED: 15 pg_cron jobs no novo)

10 crons SQL-only herdados do replay schema + 5 HTTP recriados via `cron.schedule()` com URL apontando pra `prfcbfumyrrycsrcrvms.supabase.co`:

| jobid | nome | schedule | tipo |
|---:|---|---|---|
| 23 | process-flow-followups | 0 * * * * | HTTP |
| 24 | aggregate-metrics-hourly | 0 * * * * | HTTP |
| 25 | aggregate-metrics-daily-consolidation | 30 0 * * * | HTTP |
| 26 | platform-usage-snapshot | 11 6 * * * | SQL |
| 27 | e2e-automated-tests | 0 */6 * * * | HTTP |

**NÃO recriado:** `requeue-conversations` (D30) — n8n já cuida no novo cluster (decisão do user).

**Smoke:** disparo manual em `process-flow-followups` retornou 500 `permission denied for table flow_states` — fn está viva (Bearer aceito), erro de RLS interno. Debug fica pra Onda 8 (smoke E2E completa). Não-bloqueante pra próxima onda.

**Próximo:** Onda 6 — frontend Docker rebuild com URL+publishable do novo.

---

## 2026-05-06 (madrugada — Onda 4 SHIPPED: 41 edge fns deployadas no novo)

`npx supabase functions deploy --project-ref prfcbfumyrrycsrcrvms` (sem args = todas) deployou 41 fns em ~2 min, todas v1 ACTIVE.

Fns deployadas: activate-ia, admin-create-user, admin-delete-user, admin-update-user, aggregate-metrics, ai-agent, ai-agent-debounce, ai-agent-playground, analyze-summaries, assign-handoff, assistant-chat, auto-summarize, bio-public, cleanup-old-media, database-backup, db-cleanup-old-backups, db-retention-backup, e2e-scheduled, e2e-test, fire-outgoing-webhook, form-bot, form-public, go, group-reasons, guided-flow-builder, health-check, orchestrator, process-flow-followups, process-follow-ups, process-jobs, process-scheduled-messages, refresh-avatar, requeue-conversations, scrape-product, scrape-products-batch, send-shift-report, summarize-conversation, sync-conversations, transcribe-audio, uazapi-proxy, whatsapp-webhook.

**verify_jwt** alinhado com config.toml em todas (sem drift).

NÃO deployadas (corretamente):
- `apply-env-secrets` (já deletada do antigo na Sprint 5)
- `keep-alive` (não é fn, só cron SQL no novo)

**Próximo:** Onda 5 — recriar 12 pg_cron jobs no novo com URLs apontando pra `prfcbfumyrrycsrcrvms.supabase.co`.

---

## 2026-05-06 (madrugada — Onda 3 SHIPPED: 8 secrets + vault publishable)

**Edge fn secrets (8/8 setados via `supabase secrets set --project-ref prfcbfumyrrycsrcrvms`):**

| Secret | Validado HTTP |
|---|---|
| `UAZAPI_SERVER_URL` (servidor produção wsmart) | ✅ 26 instâncias visíveis |
| `UAZAPI_ADMIN_TOKEN` (admin token) | ✅ |
| `GROQ_API_KEY` (principal) | ✅ Llama 3.3 70B respondeu |
| `GEMINI_API_KEY` | ✅ 49 modelos |
| `MISTRAL_API_KEY` | ✅ 68 modelos |
| `OPENAI_API_KEY` (Metrics) | ✅ 133 modelos |
| `ALLOWED_ORIGIN` (`crm.wsmart.com.br`) | (já setado anterior) |
| `INTERNAL_FUNCTION_KEY` (regenerada 32 bytes) | (já setado anterior) |

(valores em `<REDACTED>` — ver painel Supabase Settings → Edge Functions → Secrets)

**Vault DB:** `SUPABASE_ANON_KEY` = publishable key do projeto novo (formato `sb_publishable_*`).

**Próximo:** Onda 4 — deploy 41 edge fns (HIGH RISK: ai-agent, ai-agent-playground, e2e-test exigem aprovação por commit).

---

## 2026-05-06 (madrugada — Onda 2 storage + Onda 3 parcial)

**Storage (Onda 2 final):** 4 objects copiados via curl (download URL pública antigo → POST com service_role do novo). Bucket `bio-images` criado primeiro (faltava no novo).
- contact-avatars/d54caaac-...jpg (2.7KB - George avatar)
- bio-images/.../4772e872-...png (63KB)
- bio-images/.../70c6b77c-...png (2.2MB)
- bio-images/.../fe7e212c-...png (2.2MB)

**Onda 3 parcial:**
- Vault secret `SUPABASE_ANON_KEY` setado com publishable do novo (`sb_publishable_ayu87rwh94XQcMt1_1ka_w_hOQy8rZe`) — usado pelos crons via Bearer.
- Vault secret legacy `supabase_anon_key` (lowercase) já existia do replay (provavelmente Supabase auto-cria).
- Edge fn secrets `ALLOWED_ORIGIN=https://crm.wsmart.com.br` e `INTERNAL_FUNCTION_KEY=c22c5d696ddc7969dd9527990d86f25ad0d1c16d973187b47dfcf7fe9901e800` (regenerada) setados via `supabase secrets set`.

**Pendente Onda 3:** 6 secrets externos — usuário precisa passar valores:
- UAZAPI_SERVER_URL, UAZAPI_ADMIN_TOKEN
- GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY

---

## 2026-05-06 (madrugada — Onda 2 dados shipped via dblink: 1944 rows + diff zero vs antigo)

**Estratégia bem-sucedida:** habilitar `dblink` extension no novo + connection string com senha DB do antigo + `INSERT INTO ... SELECT * FROM jsonb_populate_recordset(NULL::tabela, dblink(...))`. 4 batches em ~5 minutos.

**Cross-check final (diff = 0 em todas):**

| Tabela | Antigo | Novo | Diff |
|---|---:|---:|---:|
| auth_users (Eletropiso) | 7 | 7 | 0 ✅ |
| contacts (escopo) | 15 | 15 | 0 ✅ |
| conversations | 17 | 17 | 0 ✅ |
| conversation_messages | 1341 | 1341 | 0 ✅ |
| ai_agent_validations | 274 | 274 | 0 ✅ |
| lead_database_entries | 5 | 5 | 0 ✅ |
| flow_steps | 2 | 2 | 0 ✅ |
| flow_triggers | 1 | 1 | 0 ✅ |

**Total geral migrado:** ~1.944 rows + globais (admin_audit_log 17, system_settings 13, db_retention_policies 7, notifications 7, platform_usage_history 4).

**Roles preservados:**
- super_admin: George (`a1b4fd3e-e44c-4b2a-90aa-daf95e60f1b4`)
- gerente: Josafa
- user: Alberto, Djavan, Jussara, Lucas, Slone

**Hashes bcrypt preservados** — atendentes logam no novo com mesma senha do antigo.

**Pendente:** 4 storage objects (1 contact-avatar George + 3 bio-images) — copiar via Storage API.

**Próximo:** Onda 2 storage + Onda 3 (vault secrets + edge fn env vars) + Onda 4 (deploy 41 edge fns).

---

## 2026-05-06 (madrugada — Onda 2 PARCIAL: auth + core multi-tenant + contacts)

**Migrado para o novo `prfcbfumyrrycsrcrvms`:**
- 7 auth users (hash bcrypt preservado — login funciona com senha antiga)
- 7 user_profiles + 7 user_roles (super_admin × George, gerente × Josafa, user × 5)
- 1 instance Eletropiso `r466a98889b5809`
- 1 inbox + 1 dept "Vendas"
- 6 department_members (queue_position 10/20/30/40/50/60)
- 6 inbox_users (todos role=agente)
- 7 user_instance_access
- 15 contacts (escopo Eletropiso)

**Pendente (~1.900 rows):**
- 13 lead_profiles, 17 conversations, **1.341 conversation_messages**, 5 lead_score_history, 2 lead_memory
- 1 ai_agent, 7 products, 13 knowledge, **274 ai_agent_validations**, 4 agent_profiles
- Kanban (1 board + 8 colunas), lead_databases (1+5), forms (6+25 fields), flows (1+2+1+2+12)
- 11 handoff_queue_events
- Globais (~40 rows: system_settings 13, admin_audit_log 17, db_retention_policies 7, platform_usage_history 4)
- Storage objects (4: 1 contact-avatar + 3 bio-images)

**Bloqueio identificado:** estratégia manual `jsonb_to_recordset` por tabela não escala pra 1.341 messages + 274 validations. Próxima sessão precisa usar uma das abordagens:
- **A)** `dblink` direto entre os 2 projetos (precisa senha DB do antigo — você passar via chat)
- **B)** `npx supabase db dump --data-only` linkando antigo, filtrar por instance_id, aplicar via psql
- **C)** Script Python com cliente postgres lendo antigo + escrevendo novo (mais robusto mas requer setup)

**Frase de retomada:** "continuar onda 2 — escolhi opção [A/B/C]"

---

## 2026-05-06 (madrugada — Onda 1 da migração shipped: schema replicado no novo)

**Estado final do projeto novo `prfcbfumyrrycsrcrvms`:**
- 164 migrations registradas em `supabase_migrations.schema_migrations`
- **91 base tables + 6 views** (vs antigo 88 + 6) — 3 tabelas extras inócuas
- **224 policies RLS** (+2 vs antigo 222)
- 85 functions, 353 indexes, 41 triggers
- 10 crons ativos (todos SQL-only — 6 crons HTTP desabilitados aguardando Onda 5 com URLs corretas)

**Estratégia aplicada:**
1. Push CLI das 159 migrations locais com 56 Lovable iniciais marcadas como skipped (superseded pelo snapshot 2026-03-20).
2. Skipped 1 seed migration (hardcoded user George — vai ser criado na Onda 2).
3. Skipped duplicada `20260324013238_utm_campaigns` (criada 2x).
4. Aplicou parcialmente `20260404000001_create_e2e_test_batches` (CREATE POLICY com ref `public.users` — bug histórico, ignora policy igual antigo fez).
5. Aplicou parcialmente `20260414000001_m17_f5_nps` (CREATE POLICY IF NOT EXISTS — sintaxe inválida em PG; ignora policies igual antigo fez).
6. Trazendo 4 migrations antigo-MCP-only via `statements` column (`platform_usage_history`, `enable_handoff_queue_events_retention`, `rpc_set_my_queue_paused_d30_r93`, +2 cron-skipped).
7. Aplicou 4 últimas locais via MCP direto (search_path com guard de existência, form_fks_on_delete, db_to_fn_metrics, keep_alive_enable_rls).
8. Criou 4 tabelas globais antigo-MCP-only inline (`admin_audit_log`, `job_queue`, `playground_evaluations`, `playground_test_suites`).
9. Replicou 9 policies que faltavam (e2e_test_batches × 3, notifications × 2, ai_agent_* × 3, rate_limit_log × 1).
10. Desabilitou 6 crons HTTP no novo apontando para projetos errados (`crzcpnczpuzwieyzbqev` ou `euljumeflwtljegknawy`) — recriados na Onda 5.

**Gaps conhecidos (a tratar depois):**
- Repo local tem migrations duplicadas (Sprint 1 names em local AND antigo-MCP-only). Repo precisa reconciliar pra futuros `db push` funcionarem.
- 3 tabelas extras no novo (provavelmente vieram de migrations duplicadas tipo `20260323100000_utm_campaigns` + `20260324013238`). Inócuas.

**Próximo passo:** Onda 2 — migrar dados Eletropiso (~1.900 rows + 7 auth users) do antigo pro novo.

---

## 2026-05-06 (madrugada — Sprint 5 código shipped: P2-7, P2-8, P2-10)

3 fixes parte da Sprint 5 (só código que vai pro novo via repo; operacional fica pra setar direto no novo):

- P2-7 `keep_alive` ENABLE RLS via migration `20260506014000_keep_alive_enable_rls`. Sem policies → service_role bypass garante cron continua. Aplicada no projeto antigo via MCP `apply_migration`.
- P2-8 `apply-env-secrets` deletada de prod via CLI `supabase functions delete`. Sem código no repo desde 2026-03-21.
- P2-10 `docker-compose.yml` agora usa `ghcr.io/.../whatspro:${IMAGE_TAG:-latest}` — CI seta SHA em prod, dev mantém latest.

**Skip:** P2-6 era falso positivo. `pg_policy` confirmou ZERO policies em `flow_followups` (não "USING(true)" como auditoria sugeria). Já seguro.

tsc 0. Migration registrada também localmente em `supabase/migrations/`.

**Próximo:** Onda 1 — replay 159 migrations locais no projeto novo `prfcbfumyrrycsrcrvms` (drop placeholder `keepalive` antes).

---

## 2026-05-06 (madrugada — 4 bloqueios da Onda 1 resolvidos)

Usuário respondeu os 4 bloqueios pendentes da migração:
1. ✅ Descartar 5 instâncias disabled — confirmado.
2. ✅ Migrar `keep_alive` (cron crítico do Free Forever, insere 1 row/dia pra não pausar projeto). RLS pode ser enabled — service_role bypass garante cron continua.
3. ✅ Delete `apply-env-secrets` em prod (Sprint 5 P2-8).
4. ✅ 8 custom secrets listados via screenshot do painel: UAZAPI_SERVER_URL, UAZAPI_ADMIN_TOKEN, GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY, INTERNAL_FUNCTION_KEY, ALLOWED_ORIGIN. Defaults Supabase (SUPABASE_*, SB_*, DENO_*) auto-provê. Migrar com mesmos valores exceto INTERNAL_FUNCTION_KEY (regenerar — recomendação minha aceita pelo usuário).

Wiki atualizada: [[wiki/migracao-eletropiso-inventario]] agora documenta os 8 secrets + decisões dos bloqueios.

**Smoke test ainda pendente** (toggle IA + typing indicator + Playground).

**Próximo:** smoke test pelo usuário + Sprint 5 código (3h, sem dependência) ou pular pra Onda 1 (replay schema, ~2h).

---

## 2026-05-06 (madrugada — Onda 0 da migração Eletropiso shipped)

**Frase ativa:** continuar migração eletropiso (mesma sessão da Sprint 3).

Inventário read-only do projeto antigo (`euljumeflwtljegknawy`) via MCP. Saída: [[wiki/migracao-eletropiso-inventario]] (175 linhas).

**Achados-chave:**
- `instance_id` Eletropiso: `r466a98889b5809` (única `disabled=false` de 6 instâncias).
- 7 auth users (1 super_admin + 1 gerente + 5 atendentes), todos vinculados à Eletropiso. Migram 100%.
- Volume: ~1.900 rows escopadas (1.341 mensagens + 274 validações IA dominam). DB total: 26.6 MB.
- 4 storage objects (1 contact-avatar + 3 bio-images) — volume manual viável.
- 2 vault secrets (`supabase_anon_key` legacy + `SUPABASE_ANON_KEY` publishable) — re-criar com chaves do novo projeto.
- 12 pg_cron jobs ativos. **4 têm URL hardcoded** apontando pro projeto antigo — atualizar antes de ativar no novo.
- 160 migrations no histórico — replay direto na Onda 1 (auditável e idempotente).
- 43 edge functions ativas — 41 migram, `apply-env-secrets` órfã não migra (decidir delete vs versionar).

**Bloqueios pré-Onda 1 a confirmar com usuário:**
1. Descartar mesmo as 5 instâncias disabled (sem clones de teste)?
2. Nome da tabela `keep_alive` vs `keepalive` (já no novo)?
3. `apply-env-secrets`: delete em prod ou versionar no repo?
4. Env vars das edge functions: usuário precisa listar no painel Settings → Edge Functions → Secrets (não acessível via MCP).

**Próximo passo:** Sprint 4 (P2 medium, ~4h) ou aguardar respostas + iniciar Onda 1 (replay schema).

---

## 2026-05-06 (madrugada — Sprint 3 da auditoria shipped: P1-2 verify_jwt drift fechado)

**Aprovação explícita do usuário** ("vai com a opção A, sprint 3" + "s") pra tocar arquivo HIGH RISK (`ai-agent-playground/index.ts`).

**Auditoria do estado real (via MCP `list_edge_functions` no projeto antigo):**
- `activate-ia` em prod: `verify_jwt=true` v11 (config.toml dizia `false`)
- `ai-agent-playground` em prod: `verify_jwt=false` v21 (config.toml dizia `true`)

**Decisão:** alinhar AMBAS para `false`. Análise: ambas têm manual auth interno robusto (`getUser` + check super_admin em activate-ia; `verifySuperAdmin` em playground). Manter `false` no gateway é seguro e evita risco de mexer em fn HIGH RISK.

**Execução:**
1. `supabase/config.toml:54-55` — playground `true → false` + comentário.
2. `npx supabase functions deploy activate-ia --project-ref euljumeflwtljegknawy` — v11 → v12 (já trazia fix CORS da Sprint 2).
3. NÃO deployar playground (HIGH RISK; config agora reflete prod, não há drift).
4. MCP confirmou estado pós-deploy: ambas `verify_jwt=false`.

**Pendente:** smoke test manual no helpdesk (toggle IA) + Playground (super_admin abre, conversa flui).

**Próximo passo:** Sprint 4 (P2 medium, ~4h, sem HIGH RISK) ou Onda 0 do inventário Eletropiso (~30min) — lembrete: ainda faltam **Sprints 4, 5, 6** da auditoria antes da migração.

---

## 2026-05-05 (noite tardia — Sprint 2 da auditoria shipped, sessão de migração ativa)

**Frase retomada:** "continuar migração eletropiso" → MCP `supabase-novo` confirmado conectado ao projeto destino `prfcbfumyrrycsrcrvms` (vazio — só `keepalive` placeholder). Estratégia mantida: Sprints 2-6 da auditoria PRIMEIRO, depois 8 ondas de migração.

**Sprint 2 shipped (4 fixes, ~30min):**
- P1-6 `ChatPanel.tsx:206` — `getSessionUserId()` async sem await → cacheado em `currentUserIdRef` no mount.
- P1-7 `ChatPanel.tsx:80-85` — `.then` sem error handling → IIFE async + try/catch + `cancelled` flag.
- P2-1 `activate-ia/index.ts` — `browserCorsHeaders` estático → `getDynamicCorsHeaders(req)` por request.
- P2-3 `helpdeskBroadcast.ts:50,68` — UPDATE sem count check (R93 pattern) → `.select('id')` + check `data.length === 0` em `updateConversationAndBroadcast` e `assignAgent`.

**Validação:** tsc 0, vitest 736 pass / 5 fail (FormBuilder pré-existente) / 3 skip = **idêntico ao baseline**. Zero regressão. Frontend não precisa deploy; `activate-ia` deploy fica pareado com Sprint 3 (verify_jwt drift, HIGH RISK).

**Credenciais do projeto novo passadas em chat** (DB pwd, Service Role JWT, PAT). Memorando: rotacionar TODAS após migração concluir (já no handoff).

**Próximo:** aprovar Sprint 3 (HIGH RISK — toca `ai-agent-playground/index.ts`) ou pular pra Sprint 4 (P2 medium, ~4h, sem HIGH RISK).

---

## 2026-05-05 (noite — PAUSA pra migração Eletropiso, handoff salvo)

Decisão: usuário quer migrar Eletropiso pra Supabase NOVO (`prfcbfumyrrycsrcrvms`), em conta separada da org `qwxxtqdqletmetdnqmes`. Estratégia confirmada: **Clean migration** (só Eletropiso, descarta lixo de teste). Ordem: **Sprints 2-6 da auditoria PRIMEIRO** (corrigir tudo no antigo, ~12-14h), DEPOIS migração 8 ondas (~6-8h). Total: 18-22h multi-sessão.

**Bloqueio atual:** MCP Supabase aqui só vê org antiga (`qwxxtqdqletmetdnqmes`), não o projeto novo. Próxima sessão precisa MCP reconfigurado com `Personal Access Token sbp_64d35110…` (que está no histórico desta conversa).

Handoff completo: [[wiki/migracao-eletropiso-handoff]] (175 linhas) — frase de retomada **"continuar migração eletropiso"**.

⚠️ Credenciais (DB password, Service Role JWT, Personal Access Token) foram passadas em chat — **rotacionar após migração**.

---

## 2026-05-05 (noite — Sprint 1 da auditoria: 5 P1s shipped, commit e4def62)

Auto-auditoria do plano antes de executar (filtragem pegou 6 problemas: ordem, baseline ausente, Sprint 2 redundante). Shipped: **P1-3** ALTER FUNCTION SET search_path em 24 fns SECURITY DEFINER (9 helpers RLS), **P1-4+5** fetchWithTimeout 30s + log warn em process-jobs/processProfilePicFetch, **P1-8** 6 FKs form_sessions/submissions migradas (CASCADE pra NOT NULL, SET NULL pra nullable), **P1-1** process-flow-followups deployada v1 + config.toml — smoke 200 OK, cron jobid 3 (1x/h) volta a funcionar (R96 fechado). Baseline e final: tsc 0, vitest 736 pass = **zero regressão**. Frase retomada: "executar Sprint 2".

---

## 2026-05-05 (noite — Auditoria completa do projeto: 5 ondas paralelas)

### Goal
Auditoria 100% read-only do projeto inteiro procurando inconsistências, bugs e vulnerabilidades. Saída: documento priorizado P0-P3 + plano de correção em sprints.

### Execução
- 5 subagentes Explore em paralelo (Backend, Frontend, DB, Vault, Config&Deploy)
- Cada um produziu top 5 achados com file:line concretos + severity
- Orquestrador validou achados suspeitos antes de finalizar (rebaixou 3 P0 falsos positivos pra P3, descobriu 1 P2 novo)

### Resultado
**Saúde geral: 6.8/10**
- **0 P0 confirmados** (3 P0 dos agentes eram falsos positivos)
- **8 P1 reais**: 2 backend, 2 frontend, 2 DB, 3 config
- **11 P2** + **7 P3**

**Top 5 P1 mais urgentes:**
1. `process-flow-followups` cron 1x/h batendo em fn fantasma (igual R96, mas crítico — followups de leads não rodam há tempo indeterminado)
2. `verify_jwt` drift entre config.toml e prod (`activate-ia` + `ai-agent-playground`)
3. 26 funções SECURITY DEFINER sem `SET search_path` (9 são helpers RLS críticos: `is_super_admin`, `has_role`, etc)
4. ChatPanel.tsx:206 `getSessionUserId()` async chamada sem await (typing indicator falha sempre)
5. FK órfãs em `form_sessions`/`form_submissions` (ON DELETE NO ACTION acumula órfãs)

### Plano de correção
Documento completo: [[wiki/auditoria-completa-2026-05-05]] (187 linhas)
- Sprint 1: 5 P1s seguros (~1h30) — quick wins sem HIGH RISK
- Sprint 2: P1 frontend + P2 CORS (~1h30)
- Sprint 3: P1 HIGH RISK verify_jwt drift (exige aprovação explícita)
- Sprint 4-5: P2 (4h+4h)
- Sprint 6: P3 backlog

### Auditoria
- 5 agentes paralelos ~5min, validação cruzada via SQL/Read
- Docs: auditoria-completa (187 linhas), log, index
- Frase pra retomar: **"executar Sprint 1 da auditoria"** (5 P1 seguros, ~1h30, sem HIGH RISK)

---

## 2026-05-05 (tarde — Auditoria órfãos n8n + Fase 2 defesa em código)

### Goal
Investigar a fundo os 2 bugs anotados ao final da sessão da manhã (`event-processor` 404 a cada 10s, `process-jobs` 401 a cada 60s) e shipar defesa em código pra detectar a próxima ocorrência sem auditoria manual.

### Auditoria forense (resumo)
- **`event-processor`**: `function_id: null` na log → fn nunca foi deployada. Zero refs no codebase além de log.md histórico. Zero entries em `cron.job`/`net._http_response`. Origem: workflow legacy no n8n WSMARTvps batendo em endpoint fantasma.
- **`process-jobs`**: fn existe v4, `verify_jwt=true`, jamais esteve em `cron.job` (cron history zerado). Tabela `job_queue` VAZIA há ≥30d (0 rows total). Único enfileirador: `whatsapp-webhook/index.ts:1056` (transcribe_audio). 401 = mesmo padrão R92 (token externo desincronizou pós-vault rotation). Funcionalidade afetada: zero — não há jobs pra processar mesmo se a fn rodasse OK.
- **Custo Free Forever**: 8.640 + 1.440 = **~10.080 invocações/dia** = ~302k/mês = **~60% do limite Free Tier** queimadas em ruído. Maior gap silencioso descoberto.
- **Por que monitoring não viu**: tráfego externo NÃO passa por `net._http_response` (só schema interno do `pg_net`). `snapshot_platform_usage()` era cego pra esse tráfego. `cron.job_run_details` também — porque não tem cron interno.

### Fase 2 — defesa em código (3 deliverables)

**1. Migration `20260505000002_platform_usage_db_to_fn_metrics`**
- Adiciona colunas `db_to_fn_calls_24h` (int) + `db_to_fn_error_pct_24h` (numeric) em `platform_usage_history`
- Estende `snapshot_platform_usage()` pra ler `net._http_response` últimas 24h
- Eleva `alert_level` pra `yellow` se ≥10 chamadas E ≥50% retornaram 4xx/5xx (sentinel R96)
- Adiciona notificação dedicada `db_to_fn_health_alert` (separada do alerta principal de capacidade)
- Smoke OK: snapshot id=4 → `db_to_fn_calls_24h: 127`, `db_to_fn_error_pct_24h: 10.24%` (abaixo do threshold, alert green correto)

**2. Wiki `erros-e-licoes.md`**
- R96 adicionado: chamadores externos invisíveis ao monitoring DB (159 linhas total)
- Linka pro SOP do playbook

**3. Wiki `free-forever-playbook.md`**
- Camada 3: menciona sentinel R96 explicitamente
- Nova seção §5 "Auditoria de tráfego órfão" com SOP de 3 passos (5min/mês)
- Snapshot histórico documentado: 2 órfãos descobertos 2026-05-05
- Cross-ref pro R96
- 200 linhas (no limite)

### Pendente operacional (fora do repo, requer acesso n8n)
- Deletar workflow `event-processor` no n8n WSMARTvps (endpoint nunca existiu)
- Decidir: deletar workflow `process-jobs` (job_queue vazio 30d) ou atualizar token pro novo `SUPABASE_ANON_KEY` publishable
- Após decommissionar `process-jobs`: avaliar deletar a edge fn também (regra: código sem chamador é trabalho morto)

### SYNC RULE
banco ✅ (1 migration) | types.ts N/A | admin UI N/A | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅ (erros-e-licoes + free-forever-playbook + log)

### Auditoria
- Migration aplicada via MCP, smoke OK (snapshot id=4 retorna nova métrica)
- Limites de linhas: erros-e-licoes 159, playbook 200, log será revisto na próxima rotação
- Working tree pronto pra commit (1 migration + 2 wikis + log)

### Frase pra retomar
- **"continuar n8n cleanup"** — quando você puder abrir n8n e me passar lista de workflows ativos
- **"continuar testes D30 cenário 8"** — override manual via select Agente Responsável (ainda em pé)

---

## 2026-05-05 — PAUSA DE SESSÃO (handoff antes de limpar contexto)

### O que essa sessão entregou
1. **D30 Sprints E + G + H** (3 sprints, 78 testes Vitest novos, 1 retention policy seed) — D30 100% completo (8/8 sprints)
2. **Plano "Free Forever" 4 camadas** — cron→n8n + retention policies + monitoring 60% + playbook
3. **3 bugs reais corrigidos via testes manuais ao vivo**:
   - **R93** — UPDATE direto bloqueado por RLS silente (QueuePauseToggle): RPC SECURITY DEFINER + 8 testes
   - **R94** — Header/painel direito stale ao mudar assignee em background: useEffect observa queueEvents
   - **R95** — handoffQueue não populava `conversations.department_id`: +1 linha + redeploy 3 edge fns + backfill SQL
4. **Wiki Playwright specs** (8 cenários reproduzíveis em `wiki/testes-d30-sprint-f-playwright.md`)

### Validações ao vivo (Sprint F)
- ✅ Configurar QueueConfig (Modo ON, ordem Lucas→...→Josafá, timeout 5min)
- ✅ Inbox Eletropiso → default_dept Vendas
- ✅ pick_next_assignee 8x via SQL (round-robin perfeito + pula gestor)
- ✅ Toggle Disponível/Pausado persiste no DB (após R93 fix)
- ✅ Round-robin pula pausado, reincorpora ao despausar
- ✅ Badge "Em fila — \<Nome\> (3:42)" + countdown ao vivo (decrementa 1s)
- ✅ Cron n8n processa timeouts → round-robin avança automaticamente
- ✅ Header e painel direito sincronizam (após R94 fix)
- ✅ Painel direito mostra "Departamento: Vendas" (após R95 fix)
- ⏸ Cenário 8 (override manual via select Agente Responsável): aguarda usuária finalizar

### Estado prod ao pausar
- DB: 26.6 MB / 500 MB (5.32%) 🟢
- 12 crons ativos (jobid 13 platform-usage-snapshot novo, jobid 12 handoff-queue-requeue removido)
- n8n VPS rodando workflow `requeue-conversations` 1x/min
- Edge fns prod: ai-agent v175, assign-handoff v2, requeue-conversations v2 (após R95 redeploy)
- 7 retention policies ativas
- Working tree limpo após commit `3e54930`

### Frase pra retomar
- **"continuar testes D30 Sprint F"** — retoma do cenário 8 (override manual), depois cenários remanescentes (horário comercial, expediente estendido)
- **"continuar bugs do helpdesk"** — atacar `event-processor` 404 e `process-jobs` 401 (descobertos durante audit)
- **"finalizar Plano Free Forever"** — Camada 5/6 do playbook (não-shipadas, opcionais)

### Memory atualizada
- `~/.claude/projects/.../memory/project_d30_fila_sprint_a.md` (continua)
- `~/.claude/projects/.../memory/project_free_forever.md` (nova)
- Plus: criada referência aos 3 fixes R93/R94/R95 no MEMORY.md

### Auditoria final
- `npx tsc --noEmit` = 0 erros
- `npx vitest run` = 736 passam (+8 do QueuePauseToggle), 5 pré-existentes em FormBuilder (sem regressão nesta sessão)
- Smoke Playwright: prod /login boota OK, 0 errors críticos no console
- Cleanup: 0 queue_events ativos, conversa Josafa de teste desatribuída

---

> Detalhes individuais R93/R94/R95 + Free Forever 4 camadas + Sprint H D30 (2026-05-05 manhã) arquivados em:
> - [[wiki/log-arquivo-2026-05-05-r93-r96-manha]]
>
> Sessões D30 Sprint A (DB), Sprint B (backend HIGH RISK), Sprint C (cron + R92 hotfix vault) — 2026-05-04 — arquivadas em:
> - [[wiki/log-arquivo-2026-05-04-d30-abc]]
>
> Sessões D30 Sprints D (Admin UI), F (Helpdesk UI), G (Tests + Retention), E (Modo Estendido) — 2026-05-04/05 — arquivadas em:
> - [[wiki/log-arquivo-2026-05-05-d30-defg-e]]

---

## 2026-04-30 (resumo — entrada completa arquivada)

Sessão começou com auditoria do vault (5 fixes documentais — log rotation, roadmap, index, planning files), evoluiu pra investigação dos 3 handoffs duplicados na conversa Josafa (R85+R86), e terminou shipando feature D28 completa (Excluded Products) — UI editável pelo admin pra cadastrar produtos que a tenant não vende. Validada em prod com lead George ("tem caixa de correio?" → fallback automático sem transbordo).

**Resumo do que foi shipado:**
- **R85+R86** — fix 3 handoffs duplicados Josafa (guard SHADOW + reset counter em 5 paths)
- **D28 Excluded Products** (edge fn v171→v172) — schema JSONB editável + helper word-boundary + UI tab Qualificação + fallback automático + validado em prod com lead George
- **R88** — CHECK constraint silent fail descoberto via teste real (`excluded_product_match` whitelist)
- **R89** — UI controlled input com `.trim()` em onChange quebra digitação livre (KeywordsInput sub-componente)
- **D29 VALID_KEYS dinâmico** (edge fn v173) — `buildValidTagKeys()` em `_shared/serviceCategories.ts`, R84 RESOLVIDO em prod (Eletropiso `tipo_tinta`)
- **v7.18.0 Avatares em Storage** — bucket público + helper `avatarStorage.ts` + edge fn `refresh-avatar` + migration `20260430000002`. Pendência: deploy 3 fns + frontend.
- **47 testes (D28) + 9 (D29)** = 100% passam. Bundle prod `index-CFmkOcne.js`.

---

> Sessão 2026-04-29 (Eletropiso — 23 categorias + 7 fixes ai-agent v162→v169 + BusinessHoursEditor + audit) arquivada em:
> - [[wiki/log-arquivo-2026-04-29-eletropiso]]
>
> Sessões 2026-04-27 (M19-S10 v1+v2+v3) e 2026-04-28 (Deploy 16 commits represados → prod) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]]
>
> Sessão 2026-04-27 manhã (Auditoria geral + 210 melhorias documentadas) e 2026-04-26 (Refactor do Orquestrador CLAUDE.md/RULES.md) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-auditoria-geral]]
>
> Sessão maratona 2026-04-25 (Helpdesk inbox permissions + M19 S8 + S8.1) arquivada em:
> - [[wiki/log-arquivo-2026-04-25-s8-helpdesk]]
>
> Entrada de 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright):
> - `wiki/log-arquivo-2026-04-14-helpdesk-audit.md`
>
> Entradas de M19 S3-S5 (2026-04-13):
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
