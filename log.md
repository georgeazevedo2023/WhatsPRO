---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-12

### Auditoria completa + 13 bug fixes (commits f3e2218 + 1be5ad1)

**Processo:** 3 agentes de auditoria em paralelo (edge functions, DB, frontend) → plano → 3 agentes de implementação em paralelo → tsc 0 erros → commits.

**41 bugs encontrados → 13 críticos/altos corrigidos:**
- C1 form-bot: `fetchWithTimeout` não importado → polls nunca disparavam
- C2 ai-agent:71,72,112 `.single()` → `.maybeSingle()` (crash em IDs inválidos)
- C3 migration `190828`: `UNIQUE NULLS NOT DISTINCT` (PG15+) → 2 índices parciais PG14 + migration fix `20260415000002`
- C4 `useCreateFunnel:122`: `FORM_TEMPLATES[]` acessado como object → `.find()`
- C5 `FlowWizard:368`: `as any` removido; `TriggerFormSheet` aceita `TriggerFormData`
- A1 `qualification:211` sobrescrevia `custom_fields` → merge via `buildLeadProfilePatch`
- A2 `uazapi-proxy:57,697` `.single()` → `.maybeSingle()`
- A5 `FunnelDetail:105` dep array `[funnel?.id]` expandido para todos os campos sincronizados
- A8 `FunnelWizard` canProceed step 2 valida ≥1 recurso
- M1 `form-bot:257,398,420` `.single()` após insert → `.maybeSingle()`
- M2 `qualification` `lead.custom_fields ?? {}` em todos os call sites
- M7 `FlowWizard` botão publicar desabilitado sem triggers
- M8 `FunnelDetail` useEffect sync com try/catch

**2 falsos positivos identificados:** stateManager (já usava `.maybeSingle()`), ChatPanel (já tinha `.unsubscribe()`)
**Novas regras:** R39-R43 documentadas em erros-e-licoes.md

---

### S8 COMPLETO — Sales + Support Subagents

**`subagents/sales.ts` (NOVO — 358 linhas):**
- Pipeline busca 3 camadas: ILIKE → word-by-word AND → fuzzy RPC (`search_products_fuzzy`)
- 1 produto + 1 foto → `send/media`, 1 + 2+ fotos → carousel multi-foto, 2+ → carousel multi-produto (max 10)
- `products_shown[]` no step_data — não repete produtos já exibidos
- Follow-up LLM leve (~200 tokens): responde sobre produtos mostrados (preço, desconto, frete)
- Exit rules: `max_messages`, `search_fail >= N` → handoff
- Tags automáticas: `interesse:CATEGORIA`, `produto:BUSCA`, `search_fail:N`
- `isFollowUpMessage()`: 12 patterns BR (quanto, parcela, frete, quero, esse, etc.)
- Config: 8 sub-params (recommendation_mode, max_products, max_failures, carousel_buttons, auto_tag)

**`subagents/support.ts` (NOVO — 227 linhas):**
- Busca `ai_agent_knowledge` via word overlap scoring (sem pgvector — ILIKE + normalização)
- 3 faixas confiança: >=0.80 resposta direta (0 tokens) | 0.50-0.79 LLM formula | <0.50 handoff
- Boost scoring: FAQ title match +0.15, FAQ type +0.05
- `unanswered_count` no step_data — 2x sem resposta → handoff
- LLM formulation: top 3 matches como contexto, temperature 0.3, max 250 tokens
- Config: 5 sub-params (confidence_high/medium, max_unanswered, enable_llm, post_action)

**Arquivos modificados (4):**
- `types.ts` — SalesConfig, SupportConfig, AgentConfig, CarouselCardPayload, SubagentMedia expandido
- `config/contextBuilder.ts` — `fetchAgentConfig()` resolve `instance_id → agent_id` + carousel_button_* + personality
- `index.ts` — `broadcastEvent()`, `sendMediaToLead()`, `sendCarouselToLead()` (4 variantes UAZAPI), `handleMediaSend()`, `resolveInstanceAndInbox()`, tag application via `tags_to_set`
- `subagents/index.ts` — stubs sales+support → handlers reais

**3 bloqueantes da auditoria corrigidos:**
- B1: `agent_id` resolvido via `fetchAgentConfig(instance_id)` em Promise.all no contextBuilder
- B2: `broadcastEvent()` criado com `fetchFireAndForget` de `_shared/fetchWithTimeout.ts`
- B3: `sendMediaToLead()` + `sendCarouselToLead()` + INSERT `conversation_messages` + broadcastEvent

**0 migrations** — usa tabelas e RPCs existentes (`search_products_fuzzy`, `ai_agent_knowledge`, `ai_agents`)

**TypeScript:** `npx tsc --noEmit` = 0 erros ✅

---

### S7 COMPLETO — Intent Detector 3 Camadas

**`services/intentDetector.ts` (NOVO — 290 linhas):**
- L1 Normalização (~5ms): 50+ abreviações BR (vc→voce, qro→quero, etc.), dedup letras (oiiii→oi), emoji→sinal (😡→[negativo]), remove acentos
- L2 Fuzzy Match (~12ms): Levenshtein (threshold 1/2 por tamanho), Soundex PT (dígrafos ch/lh/nh), dicionário 13 intents × ~15 sinônimos, phrase match multi-word
- L3 LLM Semântico (~200ms): só se L2 confidence < 70, prompt curto 100 tokens, timeout 3s + fallback L2
- 13 intents por prioridade: cancelamento > pessoa > reclamacao > suporte > produto > orcamento > status > agendamento > faq > promocao > b2b > continuacao > generico

**Arquivos modificados (5):**
- `types.ts` — DetectedIntent, IntentDetectorResult, intent_history: DetectedIntent[]
- `services/index.ts` — stub → import real do intentDetector.ts
- `config/flowResolver.ts` — resolveFlow recebe intents, case 'intent' real (min_confidence + keywords boost)
- `index.ts` — detectIntents antes de resolveFlow, bypass cancelamento (LGPD opt-out: tag + abandon flow), intent info no response
- `config/contextBuilder.ts` — buildContext recebe intents, injeta em step_data.intent_history

**Bypass implementado:**
- `cancelamento` → tag optout:lgpd + motivo:cancelamento, abandona flow ativo, NÃO responde
- `pessoa`, `reclamacao`, `produto` → flags para subagentes (S8+)

**E2E validado (10 cenários):**
- "oi" → generico 100 L2 2ms ✅
- "qro tinta" → produto 100 L2 3ms (abbrev) ✅
- "orcamnto" → orcamento 80 L2 3ms (fuzzy Levenshtein) ✅
- "Para de mandar msg" → cancelamento BYPASS ✅
- "Quero falar com Mayara" → pessoa 95 L2 6ms ✅
- "Meu pedido veio errado" → suporte 100 L2 4ms (phrase match) ✅
- "Cade meu pedido" → status 100 L2 5ms ✅
- "siiiim qro comprar" → produto 100 L2 5ms (dedup+abbrev) ✅
- "quanto custa o piso" → produto 100 L2 4ms ✅
- "PESSIMO atendimento" → reclamacao 100 L2 2ms ✅

**Performance:** 100% resolvido em L2 (2-6ms), 0 chamadas LLM, custo R$0
**Deploy:** orchestrator redeploy 3x (initial + intent info no_flow + suporte synonyms fix)

---

### Fix polls+cors + S6 Qualification Subagent (commits 5f171ea + 18149e0)

**Fix polls (5f171ea):** `/send/poll` → `/send/menu` + `question→text`, `options→choices` em 4 arquivos:
- `automationEngine.ts` (2x: send_poll action + triggerNps)
- `ai-agent/index.ts` (tool send_poll)
- `form-bot/index.ts` (2x: firstField + nextField)
- `uazapi-proxy/index.ts` (poll proxy + getDynamicCorsHeaders — fix CORS dinâmico)

**S6 Qualification Subagent (18149e0):**
- `qualification.ts` (novo) — subagente REAL de qualificação de leads
  - 4 tipos MVP: `text`, `boolean`, `currency_brl`, `select` (fuzzy match por inclusão + número)
  - `smart_fill`: pula perguntas já no `long_memory.profile` (< maxAgeDays)
  - retry logic: `fallback_retries` (default 2) — pula pergunta ao esgotar
  - exit rules: `max_messages`, `qualification_complete` → advance / handoff
  - Salva: `long_memory.profile`, `lead_profiles.custom_fields`, `step_data.qualification_answers`
- `subagents/index.ts` — qualification stub → handler real (S6 ✅)
- `funnelTemplates.ts` — `UTM_SOURCE_OPTIONS`, `UTM_MEDIUM_OPTIONS`, `COLUMN_COLORS`
- `useCreateFunnel.ts` — campos custom no wizard: kanbanTitle, kanbanColumns, bioTemplate, bioTitle, bioDescription, bioButtons, formWelcomeMessage, formCompletionMessage

**Deploy:** orchestrator, ai-agent, form-bot, uazapi-proxy, whatsapp-webhook

---

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
