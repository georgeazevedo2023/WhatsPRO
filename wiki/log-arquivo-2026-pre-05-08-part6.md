---
title: Log Arquivo Pré 2026-05-08 (parte 6)
type: log-archive
description: 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes pós-cutover
updated: 2026-05-11
---

# Log — Arquivo Pré 2026-05-08 (parte 6)

> Read-only.

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

