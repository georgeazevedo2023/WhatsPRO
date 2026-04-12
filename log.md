---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-12

### S8+S9+S10 COMPLETOS — commits 943caff + 0d3f228

**Commit 1 (943caff): S8+S9 — Sales/Support/Validator/Metrics/Shadow + S10 subagentes backend**

S8 — Sales + Support Subagents (já existiam como ??, formalizados):
- `subagents/sales.ts` (358 linhas): busca 3 camadas (ILIKE→AND→fuzzy RPC), 1 foto→send/media, 2+→carousel, `products_shown[]` anti-repetição, follow-up LLM leve, exit rules, 8 sub-params
- `subagents/support.ts` (227 linhas): word overlap scoring, 3 faixas confiança (>=0.80/0.50/0), `unanswered_count`→handoff, 5 sub-params
- `services/intentDetector.ts` (S7 não commitado, incluído aqui)

S9 — Validator + Metrics + Shadow (já existiam como ??, formalizados):
- `services/validator.ts` (230 linhas): 10 checks sem LLM (size/language/prompt_leak/price/repetition/greeting/name_freq/emoji/markdown/pii), 3 ações (pass/correct/block), 3 falhas→auto handoff
- `services/metrics.ts` (55 linhas): createTimer→6 marks→finalize, `flow_events.timing_breakdown+cost_breakdown`
- `stateManager.ts`: logFlowEvent aceita timingBreakdown+costBreakdown opcionais
- `index.ts`: shadow gate, corrected_text no send, last_response salvo, validator_failures tracking

S10 subagentes backend:
- `subagents/survey.ts`: multi-question poll, fuzzy match opções, NPS tags auto, retry/skip per pergunta
- `subagents/followup.ts` (versão CORRIGIDA — ver bug abaixo): armazena schedule em step_data, sem flow_followups
- `subagents/handoff.ts`: briefing minimal/standard/full, department/assign, tags handoff:X
- `orchestrator/templates.ts`: 4 templates backend (Vitrine/SDR-BANT/Suporte/Pós-Venda)
- `migrations/20260415000003_install_flow_template.sql`: RPC atômica install_flow_template (rollback, p_publish)
- `subagents/index.ts`: wiring completo survey+followup+handoff → handlers reais

**Bug encontrado e corrigido: followup.ts usava flow_followups com CHECK constraint inválida**
- `flow_followups.detection_type` só aceita 7 valores de shadow mode — `'flow_followup'` violava o constraint
- Solução: armazenar schedule em `step_data` (followup_scheduled_at, followup_message, followup_sent)
- R44 adicionado em erros-e-licoes.md

**Commit 2 (0d3f228): S10 completo — Templates instalaveis + Menu Media + Cron Followup**

Templates 1-clique:
- `src/data/flowTemplates.ts`: FlowInstallDefinition + FLOW_INSTALL_DEFINITIONS (4 MVPs com steps/triggers/config completos)
- `src/hooks/useInstallTemplate.ts`: mutation → RPC `install_flow_template`, retorna UUID do flow criado
- `FlowTemplatesPage.tsx`: badge "Instala em 1 clique" (verde), botão "Instalar" com Loader2 loading state, navega para `/flows/:id` após sucesso

Menu media (UAZAPI /send/menu type:list):
- `orchestrator/index.ts`: `sendMenuToLead()` com title/footer opcionais
- `handleMediaSend`: case `'menu'` → `sendMenuToLead(token, jid, text, choices, title, footer)`

Cron `process-flow-followups`:
- `supabase/functions/process-flow-followups/index.ts`: cron horário (verifyCronOrService)
- Query: `flow_states` WHERE `followup_scheduled_at <= now()` AND `followup_sent != true` AND `subagent_type=followup`
- Busca jid via `lead_profiles→contacts`, token via `instances`
- Envia `/send/text`, marca `followup_sent=true`, executa post_action (next_step/complete/handoff)

**tsc --noEmit = 0 erros em ambos os commits ✅**

---

### S11 COMPLETO — Conversa Guiada + FlowEditor (commit 15007ff)

**Método:** 3 agentes paralelos (A1 backend, A2 steps panel, A3 UI avançada) + integração main.

**Auditoria do plano (pré-execução):**
- A1: `SurveyConfig/FollowupConfig/HandoffConfig` já existiam em `types.ts` — T2 reescrito para apenas `+menu` em SubagentMedia + `GuidedMessage`
- A2: `flow_steps` já em supabase auto-generated types — T4 simplificado para re-export
- A3: `FlowNewPage` já tinha card "Conversa Guiada" com `disabled: true` — T10 apenas ativou

**Agente 1 (Backend):**
- `supabase/migrations/20260416000001_s11_guided_sessions.sql` — tabela com TTL 24h + pg_cron cleanup 02:00 diário
- `types.ts` — `SubagentMedia` +`'menu'` type + campos `menu_title/menu_footer`; `GuidedMessage` interface nova
- `supabase/functions/guided-flow-builder/index.ts` — edge function: sessão persistente, gpt-4.1-mini com `response_format: json_object`, retry automático, retorna `draft_flow + suggestions`

**Agente 2 (FlowEditor Steps):**
- `src/types/flows.ts` — `FlowStep`, `SubagentType`, `SUBAGENT_TYPE_LABELS`, `SUBAGENT_TYPE_DESCRIPTIONS`
- `src/hooks/useFlowSteps.ts` — 5 hooks: useFlowSteps, useCreateFlowStep, useUpdateFlowStep, useDeleteFlowStep, useReorderFlowSteps (UPDATE sequencial)
- `src/components/flows/StepConfigForm.tsx` — formulário switch por tipo (8 tipos: greeting, qualification, sales, support, survey, followup, handoff, custom)
- `src/components/flows/FlowStepsPanel.tsx` — `@dnd-kit` drag-and-drop + SortableStep + AddStepDialog + Sheet de edição

**Agente 3 (UI Avançada):**
- `src/components/flows/FlowIntelPanel.tsx` — KPIs: total eventos, handoffs, custo USD, intents únicos; top 5 intents; validator stats 24h; últimos 10 eventos. Adaptou campos reais da tabela `flow_events` (input/output, não event_data)
- `src/components/flows/GuidedFlowBuilderModal.tsx` — chat UI com histórico, draft preview, sugestões clicáveis, Enter para enviar. Props: `instanceId` (não hook — padrão do projeto)

**Integração (Main):**
- `FlowDetail.tsx` — tab Subagentes: `<FlowStepsPanel flowId={id!} />`; nova tab Inteligência: `<FlowIntelPanel flowId={id!} />`
- `FlowNewPage.tsx` — card Conversa Guiada ativado (`disabled` removido), `GuidedFlowBuilderModal` integrado com `useInstances` (padrão FlowWizard)
- `npx tsc --noEmit` = 0 erros ✅

**7 novos + 4 editados = 11 arquivos. tsc: EXIT:0**

---

### S9 COMPLETO — Validator + Metrics + Shadow

**`services/validator.ts` (NOVO — ~230 linhas):**
- 10 checks automáticos (0 tokens LLM): size_ok, language_match, no_prompt_leak, price_accurate, no_repetition, no_greeting_repeat, name_frequency_ok, emoji_count_ok, no_markdown_artifacts, no_pii_exposure
- 3 ações: pass, correct (envia texto corrigido), block (não envia + loga validator_flagged)
- 3 falhas consecutivas (`validator_failures` em step_data) → auto handoff
- `corrected_text` usado no send (fix da auditoria)
- `last_response` salvo em step_data para check `no_repetition` na próxima msg

**`services/metrics.ts` (NOVO — ~55 linhas):**
- `createTimer()` → `mark(label)` → `finalize()` → `TimerBreakdown` + `CostBreakdown`
- 6 marks no pipeline: intent, resolve, context, subagent, validator, send
- Salva em `flow_events.timing_breakdown` e `flow_events.cost_breakdown` (colunas dedicadas JSONB)

**Shadow Mode:**
- Busca `flows.mode` após resolveFlow
- `isShadow = mode === 'shadow'` → bloqueia sendToLead + handleMediaSend
- Pipeline roda normalmente (intent, subagente, validator) mas NÃO envia
- Response inclui `shadow: true` e `message_sent: false`

**Arquivos modificados (4):**
- `types.ts` — ValidatorIssue, ValidationResult, TimerBreakdown, CostBreakdown
- `config/stateManager.ts` — logFlowEvent aceita timing_breakdown + cost_breakdown opcionais
- `services/index.ts` — stubs validateResponse + trackMetrics → imports reais
- `index.ts` — timer marks (6), shadow gate, corrected_text, last_response save, validator_failures tracking

**4 issues da auditoria corrigidos:**
- FIX#1: logFlowEvent escreve timing/cost nas colunas dedicadas (não no input JSONB)
- FIX#2: shadow_extractions.batch_id NOT NULL → S9 loga via flow_events, extractions = S11
- FIX#3: corrected_text usado no sendToLead (era ignorado)
- FIX#4: last_response salvo em step_data para no_repetition

**0 migrations.** E2E validado:
- Normal: message_sent=true, timing_ms=3481, breakdown completo no DB ✅
- Shadow: message_sent=false, shadow=true, timing_ms=712 ✅
- flow_events.timing_breakdown: {intent:142, resolve:96, context:392, subagent:89, validator:72, send:2466} ✅

---

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

> Entradas S1-S5 + notas arquivadas em:
> - `wiki/log-arquivo-2026-04-12-fluxos-s4s5.md` (S4/S5/notas)
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md` (S1/S2/S3/G1-G5/DTs)
> - `wiki/log-arquivo-2026-04-11-fluxos-design-b.md` (design anterior)
