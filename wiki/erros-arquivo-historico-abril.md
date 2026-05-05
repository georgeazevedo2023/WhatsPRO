---
title: Erros Arquivados — Histórico Abril 2026
type: errors-archive
source: wiki/erros-e-licoes.md
archived: 2026-05-05
---

# Erros arquivados — Histórico Abril 2026

> Bugs detalhados de 2026-04-11 a 2026-04-13. Regras preventivas (R28-R38, R29) seguem ativas em [[wiki/erros-e-licoes]].

---

## PostgreSQL IMMUTABLE em índice parcial — `now()` proibido (2026-04-11)

**O que:** Migration `20260415000001` falharia em produção com `ERROR: functions in index predicate must be marked IMMUTABLE`. O índice `idx_lead_memory_lookup` usava `WHERE expires_at IS NULL OR expires_at > now()`.

**Causa:** PostgreSQL exige que funções em predicados de índice parcial sejam IMMUTABLE. `now()` é VOLATILE — muda a cada chamada. O predicado de índice é avaliado na criação, não na query.

**Correção:** Predicado simplificado para `WHERE expires_at IS NULL` (IMMUTABLE). Filtro dinâmico `expires_at > now()` movido para as queries que consultam o índice.

**Regra 28 (preventiva):** NUNCA usar `now()`, `CURRENT_TIMESTAMP` ou qualquer função VOLATILE em predicados de índice parcial (`WHERE` do `CREATE INDEX`). O filtro temporal vai na query, não no índice.

---

## S2 Orchestrator — 6 bugs críticos encontrados na auditoria (2026-04-11)

**O que:** Após commit 367b4b0 (S2 Orchestrator skeleton), auditoria encontrou 6 bugs que impediriam qualquer insert no banco.

**Bugs encontrados:**
1. `current_step_id` em vez de `flow_step_id` (4 arquivos) — campo não existe na tabela
2. `.single()` em `updateFlowState` → crash se state não encontrado
3. `.single()` em `createFlowState` → pode crashar em race condition
4. `instance_id` NOT NULL ausente no insert de `flow_states`
5. `flow_id` + `instance_id` NOT NULL ausentes no insert de `flow_events`
6. `event_type: 'subagent_called'` violaria CHECK constraint — tipo inválido (correto: `tool_called`)
7. Coluna `event_data` não existe em `flow_events` — campo correto é `input` JSONB

**Causa raiz:** Tipos definidos sem validar contra schema real do banco. Nomes de colunas inventados (`current_step_id`, `event_data`) sem conferir migration. CHECK constraint não consultada.

**Correção:** Commit 7bb2f8e — `flow_step_id` em todos os arquivos, `.maybeSingle()` + error check, campos NOT NULL incluídos, `tool_called` como event_type, `input` JSONB em vez de `event_data`.

**Regras preventivas derivadas:** R29, R30, R31, R32, R33, R34, R35.

---

## M19 S2 aggregate-metrics — 3 bugs críticos (2026-04-13)

**B#1 — PostgREST `.eq()` com tabela relacionada não faz JOIN:**
`eq('inboxes.instance_id', instanceId)` não é uma sintaxe PostgREST válida para filtrar em FK. Retorna array vazio silenciosamente — conversas nunca eram agregadas, métricas zeravam.
**Correção:** 2 passos: buscar `inboxes.id WHERE instance_id=X`, depois `conversations.in('inbox_id', ids)`.
**Regra:** Ao precisar filtrar conversas por instância, SEMPRE usar join explícito em 2 etapas. PostgREST suporta embedded filters apenas com select `!inner()` e alias, não com `.eq('fk_table.column')`.

**B#2 — `conversations.resolved_at` não existe:**
Coluna selecionada e usada para calcular `avg_resolution_minutes`, mas o campo não existe na tabela (não foi incluído no schema). Causava erros silenciosos (`undefined`).
**Correção:** Usar `updated_at` como proxy para conversas com `status='resolved'`.
**Regra (reforço R29):** SEMPRE verificar schema real da tabela antes de selecionar colunas.

**B#3 — Schema criado mas populate não implementado (T7/T8):**
`lead_score_history` e `conversion_funnel_events` foram criadas nas migrations com RLS e índices corretos, mas nenhuma edge function inseria dados nelas. Auditoria encontrou 0 referências em código.
**Correção:** Adicionadas `updateLeadScores()` e `recordFunnelEvents()` em `aggregate-metrics`.
**Regra:** Após criar uma tabela nova, verificar SEMPRE se existe código que a popula. Schema sem populate = tabela fantasma.

---

## S5 Orchestrator — 3 bugs em Memory Service + Greeting (2026-04-12)

**B#1 — `getStepType` lia campo inexistente:** `context.step_config.step_type` (undefined) → sempre despachava para stub 'custom'. Corrigido: `contextBuilder` injeta `subagent_type` no `step_config`; `getStepType` lê `subagent_type`.

**B#2 — PostgREST `.upsert({ onConflict: 'col,col,col' })` falha:** `"there is no unique or exclusion constraint matching"`. PostgREST não resolve constraint por lista de colunas. Solução: criar RPC `upsert_lead_long_memory` com `INSERT … ON CONFLICT (lead_id, memory_type, scope)` — idêntica à `upsert_lead_short_memory` mas sem TTL. R36 preventivo.

**B#3 — `step_data: {}` no insert sobrescreve DEFAULT:** `createFlowState` passava `step_data: {}`, sobrescrevendo o DEFAULT do banco `{message_count: 0, ...}`. Resultado: `message_count = undefined`. Check `isFirstMessage = (message_count === 0)` → false → `upsertLongMemory` nunca chamada. Correção dupla: (1) remover `step_data` do insert; (2) `?? 0` no check. R37+R38 preventivos.

**E2E validado (commit 935fb3f):** Case B (sessions_count++), Case C (greeting+UAZAPI), Case D (pede nome→continue), Case A (extrai nome ASCII→advance, salva full_name + long_memory).
