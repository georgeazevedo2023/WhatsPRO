---
title: Log Arquivo Pré 2026-05-08 (parte 5)
type: log-archive
updated: 2026-05-11
---

# Log — Arquivo Pré 2026-05-08 (parte 5)

> Read-only. Index pai: [[log.md]] · Anteriores: [[wiki/log-arquivo-2026-04-04-a-09]]

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

