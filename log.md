---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-12

### S4 COMPLETO — Flow Triggers Engine (commit 75b1cb9)
- **F1 — types.ts:** sync schema real — `completed_steps`, `completed_at`, `instance_id`, `conversation_id`, StepData expandido (`message_count`, `total_message_count`, `context_vars`, `intent_history`, `last_subagent`)
- **F2 — stateManager.ts:** `createFlowState` atômica via `ON CONFLICT DO NOTHING RETURNING` (aproveita `uq_flow_states_active_lead_flow` — sem nova RPC) + `increment_message_count` + `completed_steps_append` + `finalizeFlowState` seta `completed_at`
- **F3 — flowResolver.ts:** `checkCooldown()` real (query `flow_events`) | `checkActivation()` ('always' ok, outros stub S5+) | `normalizeText()` remove acentos | `isLeadCreated` flag
- **F4 — index.ts:** `handleAdvance` real — `fetchNextStep` por position > current → avança `flow_step_id`, `completed_steps`, reseta `message_count`. Sem próximo → `flow_completed`
- **5 bugs de schema corrigidos:**
  - `conversations.lead_id` → join `conversations→inboxes→lead_profiles` (R34)
  - `conversations.instance_id` → via `inboxes.instance_id` (R34)
  - `from('leads')` → `from('lead_profiles')` + join `contacts` (R34)
  - `step_type` → `subagent_type` em `fetchFirstStep` (R35)
  - `step_type` → `subagent_type` em `fetchStepConfig` (R35)
- **E2E validado (curl real):** "oi" → `status=active`, `flow_step_id=<greeting>`, `message_count=1`, events `flow_started`+`tool_called` ✅
- **R34+R35 documentados** em erros-e-licoes.md
- **Deploy:** orchestrator redeploy 3x (fix incremental)

### S5 COMPLETO — Memory Service + Greeting Subagent (commit 935fb3f)

**Implementado (9 arquivos modificados/criados):**
- `services/memory.ts` — `loadMemory`, `saveShortMemory` (RPC), `upsertLongMemory` (RPC fix B#2), `saveLeadName`
- `subagents/greeting.ts` — 4 casos: B=retornante, C=novo com nome, D=pede nome, A=coleta nome. `extractName` sem LLM (patterns BR + heurística)
- `services/index.ts` — `loadMemory`/`saveShortMemory` reais; stubs: `detectIntents`, `validateResponse`, `trackMetrics`
- `contextBuilder.ts` — `Promise.all` com `loadMemory` | injeta `short_memory`/`long_memory` | busca `contacts.jid`
- `subagents/index.ts` — `greetingSubagent` no `SUBAGENT_MAP`; fix B#1 `getStepType` lê `subagent_type`
- `index.ts` — `sendToLead` via UAZAPI, `lead_profile_patch`, `validateResponse` (stub passa tudo)
- `stateManager.ts` — remove `step_data: {}` no insert (fix B#3)
- Migration `20260415000001` — `upsert_lead_long_memory` RPC

**3 bugs corrigidos:**
- B#1: `getStepType` lia `step_type` (undefined) → `subagent_type` no step_config
- B#2: PostgREST `.upsert({ onConflict: 'col,col,col' })` falha → RPC com `INSERT ON CONFLICT`
- B#3: `step_data: {}` sobrescreve DEFAULT banco → omitir campo + `?? 0` no check

**E2E validado:** Case B ✅ `sessions_count++` | Case C ✅ `greeting+UAZAPI sent` | Case D ✅ `status=continue, pede nome` | Case A ✅ `full_name="Carlos Melo", long_memory.profile.name` salvo

**Novas regras:** R36 (PostgREST onConflict), R37 (step_data:{} sobrescreve DEFAULT), R38 (?? 0 em message_count)

### Nota S4 (2026-04-12)
- **(a) Qualidade do conteúdo:** 9.0/10 — implementação sólida, ON CONFLICT elegante, cooldown real, handleAdvance completo. Gap: activation business_hours ainda stub (intencional S5+)
- **(b) Orquestração entre arquivos:** 8.5/10 — types/stateManager/resolver/index bem sincronizados. Vault atualizado com entradas S3+S4, R32-R35, roadmap. Gap: index.md não foi atualizado com os novos arquivos de S3 (hooks, componentes, templates)
- **(c) Estado do vault:** 8.5/10 — log arquivado (S1/S2/design → log-arquivo-2026-04-11-fluxos-v3-s1s2.md), roadmap-sprints comprimido. Gap: texto stale sobre migration inexistente em S4 ainda presente no roadmap-sprints
- **Ação imediata:** corrigir texto stale do S4 em fluxos-roadmap-sprints.md + atualizar index.md com arquivos S3

---

## 2026-04-11

### S3 COMPLETO — Flow CRUD Admin UI (commit 9862f2d)
- **Entregáveis:** 5 páginas + 3 componentes + 2 hooks + 12 templates + tipos. 14 arquivos novos.
- **4 bugs corrigidos:** B1 App.tsx 5 rotas | B2 Sidebar sem nav | B3 useState→useEffect | B4 path errado
- **Nota:** 2/10 antes → **9.5/10** depois. Critério: /dashboard/flows acessível ✅

### S2 COMPLETO + Auditoria — Orchestrator Skeleton (commits 367b4b0 + 7bb2f8e)
- 7 arquivos orchestrator | whatsapp-webhook fork | USE_ORCHESTRATOR='false' ✅
- 6 bugs corrigidos pós-auditoria (nota 6.5→9.2) — R29/R30/R31

### S1 COMPLETO — Database + Tipos (commit e084c87)
- 4 migrations, 14 tabelas, seed SDR, types.ts 4943 linhas, tsc exit 0 ✅

---

> Entradas design phase arquivadas em:
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md` (S1/S2/G1-G5/DTs)
> - `wiki/log-arquivo-2026-04-11-fluxos-design-b.md` (design anterior)
