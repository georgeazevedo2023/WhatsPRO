---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-05-04 (Sprint C — Fila Inteligente de Handoff D30)

### Goal
Aterrissar o cron `requeue-conversations` que processa timeouts da fila a cada minuto, lida com horário comercial (pausa relógio + envia `out_of_hours_message` 1x), detecta atendente órfão, notifica gestor em loop completo, reativa pausados quando expediente reabre com 5min completos (Q5).

### Arquivos novos
- `_shared/businessHours.ts` — `isOutsideBusinessHours(business_hours, extended_hours_until)` extraído do ai-agent (que mantém versão inline; refator DRY no Sprint H).
- `requeue-conversations/index.ts` — edge fn cron 1min com 5 cases (A orphan, B horário, C respondido, D timeout, E loop completo) + reativação de pausados. Realtime broadcast `queue-update` em cada decisão.
- Migration `20260504000008_handoff_queue_cron.sql` — `cron.schedule('handoff-queue-requeue', '* * * * *', ...)` com idempotência (unschedule antes).
- Update `config.toml` — `[functions.requeue-conversations] verify_jwt=false`.

### SYNC RULE auditada
Banco N/A (sem schema novo) | types.ts N/A | admin Sprint D | ALLOWED_FIELDS N/A | backend ✅ | prompt N/A | system_settings N/A | docs ✅

### Auditoria
- tsc 0 erros.
- deno check OK em `businessHours.ts` + `requeue-conversations`.
- vitest 662 passam, 5 falhas pré-existentes em FormBuilder (sem regressão).

### Deploy ao vivo + cron-apply (autorizado pelo user)
- `npx supabase functions deploy requeue-conversations` → **v1** ativa.
- `apply_migration handoff_queue_cron` → `cron.schedule('handoff-queue-requeue', '* * * * *')` registrado (jobid=12, active=true).

### Smoke ao vivo (em prod) + bug pre-existing R92 descoberto
- 1º tick às 21:21:00 BRT → **401** (Bearer ANON_KEY do vault não bate com env das edge fns).
- **Diagnóstico:** Supabase rotacionou `SUPABASE_ANON_KEY` no env das edge fns para `sb_publishable_*` mas vault continuava com JWT legacy. Bug afetava SILENCIOSAMENTE TODOS os crons (`process-jobs`, `process-flow-followups`, `aggregate-metrics-*`, `e2e-scheduled`) — `cron.job_run_details` mostrava "succeeded" porque o SQL retorna 1 row, mas `net._http_response.status_code` revelava 401.
- **Hotfix:** `vault.update_secret(..., 'sb_publishable_...')`. Cache do pg_net levou 1-2 ticks pra propagar.
- **Tick 21:24:00 BRT → 200 OK** com queue vazia (`expired_processed: 0`, todos os counters 0). Cron 100% funcional.
- **R92 documentada** em `wiki/erros-e-licoes.md` — afeta múltiplos crons históricamente.

### Frase para retomar
"implementar fila inteligente Sprint D" — admin UI (DepartmentsTab QueueConfig + drag-drop ordem + AdminInboxes default_dept).

---

## 2026-05-04 (Sprint B — Fila Inteligente de Handoff D30)

### Goal
Aterrissar o backend da Fila (HIGH RISK em `ai-agent/index.ts`, 6 paths) com fallback try/catch em cada um — se algo falhar, comportamento volta a ser igual ao pré-D30 (status_ia=SHADOW + assigned_to=NULL).

### Arquivos novos
- `supabase/functions/_shared/handoffDepartment.ts` — cascata D-α (profile→funnel→inbox→null).
- `supabase/functions/_shared/handoffQueue.ts` — `assignHandoff` orquestra D-β (reusar último assignee elegível) → modo OFF (default_assignee) ou ON (RPC) → cria `handoff_queue_events` → UPDATE `conversations.assigned_to` → lookup nome (`auth.users.raw_user_meta_data->>full_name`, primeiro nome). `applyAssigneeNameTemplate` substitui `{handoff_assignee_name}` (D-γ).
- `supabase/functions/assign-handoff/index.ts` — edge fn wrapper HTTP fino (verify_jwt=false + `verifyCronOrService`). Para cron Sprint C + helpdesk Sprint F. ai-agent importa direto (sem latência HTTP).
- Update `supabase/config.toml` — entry `[functions.assign-handoff] verify_jwt=false`.

### Modificações em `ai-agent/index.ts` (HIGH RISK)
- Closure `runQueueAssignment(handoffMessageTemplate)` resolve dept via `resolveHandoffDepartment` + chama `assignHandoff` + aplica D-γ. Try/catch interno → fallback retorna `{ assigned_user_id: null, finalMessage: template sem substituição }`.
- 6 paths integrados (cada um chama runQueueAssignment ANTES de `sendTextMsg(handoffMsg)`):
  1. handoff_trigger imediato (texto)
  2. Auto-handoff `lead_msg_count >= MAX_LEAD_MESSAGES`
  3. Tool `handoff_to_human`
  4. Validator BLOCK
  5. Implicit text-handoff (D-γ não aplica — texto livre do LLM, mas fila ainda cria evento + setta assigned_to)
  6. Deferred handoff trigger (após LLM)

### Auditoria
- tsc = 0 erros.
- vitest = 662 passam, 5 falhas pré-existentes em `FormBuilder.test.tsx` (sem regressão).
- deno check do novo código OK. ai-agent acumula 73 erros TS18047 (possibly null) PRÉ-EXISTENTES — projeto não usa deno como gate.

### SYNC RULE auditada
1. Banco ✅ (Sprint A) | 2. types.ts N/A | 3. Admin UI Sprint D | 4. ALLOWED_FIELDS N/A | 5. Backend ✅ | 6. Prompt N/A (`{handoff_assignee_name}` é em handoff_message, não prompt_sections) | 7. system_settings N/A | 8. Docs ✅

### Pendências
- **Deploy:** `npx supabase functions deploy ai-agent` + `npx supabase functions deploy assign-handoff`. Não automatizado — autorização explícita necessária.
- **Smoke E2E em prod:** 1 conversa por path (validar atribuição visível no helpdesk, badge "Em fila", nome do atendente na msg de handoff). Antes de declarar "shipped".
- **Sprint C:** cron `requeue-conversations` (timeout reattribution + pausa horário comercial + sino gestor por volta).
- **Sprint D:** admin UI (DepartmentsTab QueueConfig + AdminInboxes default_dept).

### Deploy ao vivo (autorizado pelo user)
- `npx supabase functions deploy ai-agent` → v173 → **v174** ✅
- `npx supabase functions deploy assign-handoff` → **v1** ✅ (novo)

### Smoke ao vivo (em prod)
- `OPTIONS /assign-handoff` → 200 (CORS preflight OK)
- `POST /assign-handoff` sem auth → 401 (gate funcionando)
- `POST /assign-handoff` com anon key legacy → 401 (anon key local não bate com `SUPABASE_ANON_KEY` do env das fns; **não-bloqueante** — gate de auth está funcionando, e cron + helpdesk usarão service_role na Sprint C/F).
- `pick_next_assignee` ao vivo no banco: retornou `user_id` válido + cursor avançou para 40 (4ª posição). Resetado para 0 após smoke.
- `handoff_queue_events` vazia (nenhum handoff real disparou ainda; aguarda lead enviar mensagem via WhatsApp).
- 0 erros nos logs do ai-agent v174 desde deploy.

### Frase para retomar
"implementar fila inteligente Sprint C" — cron de requeue + lógica horário comercial.

---

## 2026-05-04 (Sprint A — Fila Inteligente de Handoff D30)

### Goal
Aterrissar o schema completo da Fila Inteligente de Handoff (D30) em prod sem tocar `ai-agent/index.ts` (HIGH RISK). Sprint A do plano de 8 sprints — só DB.

### O que foi shipado (6 migrations)

- **A.1** `20260504000002_handoff_queue_departments.sql` — `queue_mode_enabled bool=false`, `queue_mode_timeout_minutes int=5 CHECK 1-60`, `default_assignee_id uuid → auth.users`, `last_assignee_position int=0`.
- **A.2** `20260504000003_handoff_queue_department_members.sql` — `queue_position int` (drag-drop), `queue_paused bool=false`, `queue_paused_reason text`, `gestor_in_queue bool=false`. Index parcial `(department_id, queue_position) WHERE queue_paused=false`. **Backfill:** `queue_position` de membros existentes via `ROW_NUMBER() * 10` particionado por dept (espaçado para inserts futuros).
- **A.3** `20260504000004_handoff_queue_inboxes_default_dept.sql` — `inboxes.default_department_id uuid → departments` (D-α: fallback de dept). Index parcial em FK.
- **A.4** `20260504000005_handoff_queue_business_hours.sql` — `ai_agents.extended_hours_until timestamptz` + tabela `business_hours_exceptions` com RLS (super_admin manage + inbox users SELECT).
- **A.5** `20260504000006_handoff_queue_events.sql` — tabela `handoff_queue_events` com 5 status (active/responded/timed_out/manual_override/cancelled), 3 índices (incluindo o do cron `(expires_at) WHERE status='active'` — R28 IMMUTABLE), RLS (super_admin all + inbox users SELECT).
- **A.6** `20260504000007_handoff_queue_pick_next_assignee.sql` — RPC `pick_next_assignee(_department_id uuid, _skip_user_ids uuid[]) RETURNS uuid`, `SECURITY DEFINER SET search_path = public, pg_temp`, **`SELECT FOR UPDATE` no cursor (R91 mitigado)**. Pula paused, gerentes sem `gestor_in_queue`, skip_user_ids. Q4 loop infinito. REVOKE EXECUTE de PUBLIC/anon/authenticated, GRANT só para service_role.

### Smoke tests (em prod via mcp__supabase__execute_sql)

- ✅ Schema check: 13/13 objetos confirmados (4+4+1+1+1+1+1).
- ✅ `pick_next_assignee('00…0')` → `NULL` (dept inexistente).
- ✅ Rotação 8 chamadas no dept "Vendas" (6 membros, 1 gestor excluído por default): `f363→5300→6e18→4d79→d027→f363→5300→6e18` — 5 distintos + loop ao 1º.
- ✅ Reset de `last_assignee_position` aplicado após smoke.

### Auditoria

- `npx supabase gen types typescript` → `src/integrations/supabase/types.ts` regenerado (5803 linhas, 20 referências às novas keys).
- `npx tsc --noEmit` = 0 erros.
- 6 arquivos novos em `supabase/migrations/`.

### Pendências para Sprints B-H

- **Atenção:** wiki original dizia `conversations.assigned_user_id` — coluna real é `assigned_to`. Sprint B (`assign-handoff` edge fn + 6 paths em ai-agent) precisa usar `assigned_to`.
- Migration A.2 backfill destravou rotação imediata (não precisa drag-drop UI da Sprint D para round-robin funcionar).
- D30 status atualizado em `wiki/decisoes-chave.md` e `wiki/casos-de-uso/handoff-fila-detalhado.md`.

### Próximo (Sprint B)
`assign-handoff` edge function + integrar 6 paths em `ai-agent/index.ts` (HIGH RISK, fallback try/catch) + dept resolution (profile→funnel→inbox) + variável `{handoff_assignee_name}` em `prompt_sections.handoff_text`.

---

> Sessão 2026-05-04 manhã (Auditoria Vault + Módulo Admin Sprint 0+1+2 + R90 hotfix user_roles) arquivada em:
> - [[wiki/log-arquivo-2026-05-04-admin]]

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
