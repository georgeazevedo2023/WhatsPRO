---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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
