---
title: Auditoria Completa do Projeto WhatsPRO — 2026-05-05
tags: [auditoria, security, bugs, vulnerabilidades, plano-correcao, p0, p1, p2, p3]
sources: [5 ondas paralelas Explore: backend, frontend, db, vault, config/deploy]
updated: 2026-05-05
---

# Auditoria Completa — 2026-05-05

> Auditoria 100% read-only por 5 subagentes em paralelo (Backend, Frontend, DB, Vault, Config/Deploy). Achados validados pelo orquestrador antes de classificar — alguns P0/P1 dos agentes foram rebaixados pra P3 após verificação. Nenhum P0 confirmado.

## Sumário executivo

| Área | Saúde | P0 | P1 | P2 | P3 |
|---|:-:|:-:|:-:|:-:|:-:|
| Backend (edge fns) | 7.0/10 | 0 | 2 | 2 | 1 |
| Frontend (React) | 6.5/10 | 0 | 2 | 3 | 0 |
| Database & RLS | 7.5/10 | 0 | 2 | 2 | 1 |
| Documentação & Vault | 7.5/10 | 0 | 0 | 1 | 4 |
| Config & Deploy | 5.5/10 | 0 | 2 | 3 | 1 |
| **Total** | **6.8/10** | **0** | **8** | **11** | **7** |

**Nenhum P0 confirmado.** 8 P1s reais (3 backend/frontend, 2 DB, 3 config). Saúde geral: boa, com 2 áreas pra atenção (frontend + config).

## P1 — Atenção (8 itens, fix em ≤2h cada)

### P1-1. `process-flow-followups`: cron 1x/h batendo em fn fantasma
- **Onde:** `cron.job` jobid 3 → `…/functions/v1/process-flow-followups`
- **Sintoma:** Fn está no repo (`supabase/functions/process-flow-followups/index.ts`, ~150 linhas) mas NÃO está deployada em prod (`mcp__supabase__list_edge_functions` confirma ausência). Cron rodou 24x nas últimas 24h batendo 404. Outro padrão R96.
- **Risco:** Followups de flow agendados nunca rodam. Leads podem deixar de receber mensagens automáticas.
- **Fix:** `npx supabase functions deploy process-flow-followups` (~30s) + smoke do cron na próxima hora.

### P1-2. `verify_jwt` drift entre config.toml e prod
- **Onde:** 2 fns divergem
  - `activate-ia`: config `false`, prod `true`
  - `ai-agent-playground`: config `true`, prod `false`
- **Risco:** Próximo `supabase deploy --project-ref` pode reverter configs em produção, quebrando crons (se prod virar config) ou expondo fn admin sem auth (se config virar prod). `ai-agent-playground` `false` em prod = qualquer um chama sem JWT (manual auth dentro? precisa ler).
- **Fix:** Ler ambas as fns pra confirmar manual-auth, então ou (a) atualizar config.toml pra refletir prod, ou (b) re-deploy pra alinhar prod com config. ⚠️ HIGH RISK em `ai-agent-playground` (file na lista de high-risk do RULES.md) — exige aprovação explícita.

### P1-3. 26 funções SECURITY DEFINER sem `SET search_path`
- **Onde:** `pg_proc` confirmou 26, **9 são helpers críticos de RLS**: `is_super_admin`, `has_role`, `has_inbox_access`, `is_inbox_member`, `get_inbox_role`, `is_gerente`, `can_access_kanban_board`, `can_access_kanban_card`, `handle_new_user`.
- **Risco:** Privilege escalation teórico — atacante com permissão de criar schema/tabela poderia injetar `auth.users` fake e bypass dos checks de role. Em multi-tenant Supabase, criar schema requer service_role, então risco real é baixo, mas é defense-in-depth obrigatório (regra Supabase advisor).
- **Fix:** Migration `ALTER FUNCTION public.X SET search_path TO 'public', 'auth', 'storage'` em batch. Sem deploy, sem reload — instantâneo.

### P1-4. `process-jobs/processProfilePicFetch`: fetch sem timeout (R-Free Forever)
- **Onde:** `supabase/functions/process-jobs/index.ts:66`
- **Sintoma:** `fetch(UAZAPI_URL + '/contact/getProfilePic')` sem timeout. Se UAZAPI travar, o cron `process-jobs` fica pendurado.
- **Risco:** Embora `process-jobs` esteja praticamente morta hoje (job_queue vazia há 30d), se voltar a ser usada (transcribe_audio enfileira), travamento bloqueia toda a fila.
- **Fix:** `await fetchWithTimeout(url, init, 30000)` (helper já existe em `_shared/`).

### P1-5. `processProfilePicFetch`: UPDATE silencioso (R88 pattern)
- **Onde:** `supabase/functions/process-jobs/index.ts:76`
- **Sintoma:** `await supabase.from('contacts').update({...}).eq('jid', ...)` sem check `{error}`. Se RLS nega ou row não existe, falha silenciosa.
- **Risco:** Profile pictures nunca são atualizadas, debug impossível.
- **Fix:** Adicionar `if (updateRes.error) log.warn(...)` (padrão R88).

### P1-6. ChatPanel: `getSessionUserId()` async chamada sem await
- **Onde:** `src/components/helpdesk/ChatPanel.tsx:206`
- **Sintoma:** Linha 206 retorna Promise; linha 207 compara `payload.agent_id !== currentUserId` → Promise nunca === string, condição **sempre verdadeira**. Typing indicator dispara errado.
- **Risco:** Atendente vê "fulano está digitando" mesmo quando ele próprio digita. UX confusa, log poluído com falsos positivos.
- **Fix:** Cachear userId em `useRef` no mount do componente, usar valor cacheado na callback do broadcast.

### P1-7. ChatPanel: Promise.then sem error handling
- **Onde:** `src/components/helpdesk/ChatPanel.tsx:83-84`
- **Sintoma:** `supabase.from('conversations').select('status_ia')...maybeSingle().then(({ data }) => setIaAtivada(...))` ignora `error` param. Se falhar, `iaAtivada` fica `false` silente.
- **Risco:** Toggle IA mostra estado errado em caso de RLS bug ou erro de rede.
- **Fix:** Trocar `.then` por `await` em useEffect async, com try/catch.

### P1-8. FK órfãs em `form_sessions` e `form_submissions`
- **Onde:** 4 FKs com `ON DELETE NO ACTION` apontando pra `conversations`/`contacts`/`whatsapp_forms`
- **Sintoma:** Quando uma `conversation` é deletada (retention), `form_sessions` ficam órfãs eternamente. Hoje 0 órfãs (sorte), mas schema permite acúmulo.
- **Risco:** DB bloat lento, JOINs em relatórios podem retornar dados incompletos sem warning.
- **Fix:** Migration `ALTER TABLE form_sessions ALTER CONSTRAINT … ON DELETE SET NULL` (ou CASCADE se quisermos limpeza total).

## P2 — Médio (11 itens, fix em ≤4h cada)

| # | Área | Item |
|---|---|---|
| P2-1 | Backend | `activate-ia` usa `browserCorsHeaders` estático (não respeita ALLOWED_ORIGIN dinâmico) |
| P2-2 | Backend | `activate-ia` URL webhook hardcoded (`fluxwebhook.wsmart.com.br/webhook/receb_out_neo`) — sem env var fallback |
| P2-3 | Frontend | `helpdeskBroadcast.ts:50,68` — UPDATE direto sem checar count (R93 pattern não aplicado) |
| P2-4 | Frontend | ChatPanel: optimistic UI sem rollback no toggle IA (linha 260-262) |
| P2-5 | Frontend | `PasteTab.tsx:26-64` — validação de telefone só no client, sem schema Zod |
| P2-6 | DB | `flow_followups` policies: `service_role` com `USING(true)` (defense-in-depth fraca) |
| P2-7 | DB | `keep_alive` única tabela sem RLS (single exception, viola padrão) |
| P2-8 | Config | `apply-env-secrets` deployada em prod desde 2025-03-21 (v7) **sem código no repo nem em config.toml** — fn órfã não auditável |
| P2-9 | Config | `ALLOWED_ORIGIN` secret pode estar ausente — fallback `*` em dev/staging |
| P2-10 | Config | Docker `:latest` tag em compose.yml (não-reproducível) + porta 80 sem TLS forçado |
| P2-11 | Vault | 3 wikis acima do limite 200 linhas: `log-arquivo-2026-04-04-a-09.md` (755), `auditoria-admin-2026-05-04.md` (209), `log-arquivo-2026-04-29-eletropiso.md` (203) |

## P3 — Baixo (7 itens, backlog)

| # | Item |
|---|---|
| P3-1 | `processProfilePicFetch` sem log de resposta de erro UAZAPI |
| P3-2 | Migrations sem `IF NOT EXISTS` uniforme em CREATE INDEX (157 migrations, 25% coverage) |
| P3-3 | `index.md` não lista `wiki/log-arquivo-2026-04-27-auditoria-geral.md` (ref órfã) |
| P3-4 | `wiki/decisoes-chave.md` frontmatter `updated:` desatualizado vs git log |
| P3-5 | Dockerfile JWT publishable hardcoded (REBAIXADO de P0 — chave é pública por design, mas migrar pra build arg melhora reproducibilidade) |
| P3-6 | PRD.md vs package.json version drift (REBAIXADO de P0 — package.json é artifact, não fonte) |
| P3-7 | `index.md` não documenta estrutura de subpastas wiki/casos-de-uso (37/84 wikis) |

---

## Plano de Correção em Sprints

### Sprint 1 — P1 quick wins seguros (≤4h, sem HIGH RISK)
**Goal:** fechar 5 P1s que não tocam código HIGH RISK e têm fix isolado. Zero risco de regressão.

| # | Item | Fix | Tempo | Validação |
|---|---|---|---|---|
| 1 | P1-3 | Migration `SET search_path` nas 26 fns | 30min | `pg_proc` query confirma 0 sem search_path |
| 2 | P1-4 | `fetchWithTimeout` em process-jobs:66 | 15min | tsc OK + smoke local |
| 3 | P1-5 | `if (error) log.warn` em process-jobs:76 | 10min | tsc OK |
| 4 | P1-8 | Migration FK form_sessions/submissions ON DELETE SET NULL | 30min | conferir 0 órfãs antes/depois |
| 5 | P1-1 | `supabase functions deploy process-flow-followups` | 5min | smoke cron próxima hora; log 200 OK |

**Total: ~1h30. Critério de sucesso:** 5 commits, todos passam tsc + vitest, zero deploy quebrado.

### Sprint 2 — P1 frontend (1h30) ✅ SHIPPED 2026-05-05
**Goal:** fechar 2 P1s do ChatPanel + 1 backend (CORS dinâmico).

| # | Item | Fix | Tempo | Status |
|---|---|---|---|---|
| 6 | P1-6 | Cachear userId em useRef em ChatPanel.tsx:206 | 20min | ✅ |
| 7 | P1-7 | Trocar `.then` por async/await + try/catch em ChatPanel.tsx:83-84 | 15min | ✅ |
| 8 | P2-1 | activate-ia usa `getDynamicCorsHeaders(req)` | 20min | ✅ (deploy pareado com Sprint 3) |
| 9 | P2-3 | helpdeskBroadcast `.update().select()` + count check (R93 pattern) | 30min | ✅ |

**Resultado:** tsc 0, vitest 736 pass / 5 fail / 3 skip = idêntico ao baseline. Zero regressão. Validação manual ainda pendente no helpdesk (2 abas, typing indicator).

### Sprint 3 — P1 HIGH RISK (verify_jwt drift) — exige aprovação explícita
**Goal:** alinhar config.toml com prod nos 2 casos divergentes.

⚠️ **HIGH RISK:** `ai-agent-playground` está na lista do RULES.md de fns que exigem aprovação. Antes de tocar:
1. Ler `ai-agent-playground/index.ts` (manual auth interno?)
2. Ler `activate-ia/index.ts` (manual auth interno?)
3. Decidir caminho (atualizar config OU re-deploy)
4. **Esperar aprovação explícita** do usuário antes de qualquer mudança

### Sprint 4 — P2 medium (4h)
- P2-2: env var FLUX_WEBHOOK_URL pra activate-ia
- P2-4: rollback optimistic UI ChatPanel toggle IA
- P2-5: schema Zod em PasteTab
- P2-9: setar `ALLOWED_ORIGIN` no Supabase secrets (operacional)
- P2-11: particionar 3 wikis acima de 200 linhas

### Sprint 5 — P2 cleanup (4h)
- P2-6: revisar policies `flow_followups` (deletar service_role policy?)
- P2-7: ENABLE RLS em `keep_alive` + policy permissiva
- P2-8: investigar `apply-env-secrets` órfã — deletar de prod ou versionar no repo
- P2-10: tag `:${GITHUB_SHA:0:7}` em compose.yml + non-root user

### Sprint 6 — P3 backlog (deixar pra próxima manutenção)
Todos os P3 podem aguardar ou ser quick wins espalhados em sessões futuras.

---

## Garantias

- ✅ Zero `git push` sem aprovação
- ✅ Zero deploy de edge fn sem smoke pré-deploy
- ✅ HIGH RISK fns (`ai-agent`, `ai-agent-playground`, `e2e-test`, `types`) só com aprovação explícita por commit
- ✅ Migrations testadas em local (`npx supabase db reset` se workspace local existe) antes de aplicar prod
- ✅ Cada fix passa tsc + vitest existentes; novos testes onde lógica não-trivial

## Não-escopo desta auditoria

- Performance de queries DB (precisa EXPLAIN ANALYZE com tráfego real)
- Penetration testing (precisa ferramenta externa)
- Code review linha-a-linha de `ai-agent/index.ts` (HIGH RISK, sessão dedicada)
- Refactor de débitos técnicos amplos (escopo de roadmap)

## Validação dos achados (filtro crítico aplicado)

Os 5 agentes Explore reportaram 25 achados (5 P0, 5 P1, 11 P2, 4 P3). Após validação cruzada:
- **3 P0 → P3** (Dockerfile JWT publishable, PRD vs package.json, frontmatter date) — falsos positivos por classificação agressiva
- **2 P0 → P1** (ChatPanel async sem await: bug real mas UX, não vulnerabilidade)
- **1 achado novo descoberto na validação:** `apply-env-secrets` em prod sem código no repo (P2-8)
- Distribuição final: 0 P0, 8 P1, 11 P2, 7 P3

## Links

- [[wiki/erros-e-licoes]] — 96 regras existentes (R88, R93, R96 mais relevantes pra esta auditoria)
- [[wiki/free-forever-playbook]] — sentinel R96 (relacionado a P1-1)
- [[RULES.md]] — HIGH RISK files (relevante pra Sprint 3)
- [[CLAUDE.md]] — protocolo de aprovação
