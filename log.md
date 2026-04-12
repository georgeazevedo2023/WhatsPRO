---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-12

### Helpdesk: KPI grid no Contexto IA (commits 6b542b1 + c432fd0)

**`src/components/helpdesk/ContactInfoPanel.tsx`**

Grid 2 colunas acima das tags no bloco "Contexto IA":
- **Produto** (roxo) — tags `produto:` + `interesse:`
- **Em falta** (vermelho) — tag `marca_indisponivel:`
- **Início** (cinza) — `conversation.created_at` dd/mm hh:mm
- **Fim** (cinza) — `conversation.last_message_at` dd/mm hh:mm
- **Duração** (âmbar) — diferença início→fim em min/h
- **Atendido por IA** (azul/amarelo) — Sim / Shadow / Não derivado das tags

tsc = 0 erros ✅

---

### fix(orchestrator): post-handoff guard (commit 64b91a8) + deploy

**Causa:** após handoff, lead enviava "Ok" → novo flow criado → `smart_fill` encontrava respostas antigas em `long_memory.profile` → qualificação completava imediatamente → segundo handoff disparado → mensagem duplicada "Vou te encaminhar...".

**Fix:** antes de `createFlowState`, checa `flow_states WHERE status='handoff' AND completed_at >= now()-4h`. Se encontrado, retorna `{ skipped: 'post_handoff' }` sem criar novo flow nem enviar mensagem. Lead permanece com atendente humano.

**Deploy:** orchestrator ✅ (R48 em erros-e-licoes)

---

### fix(greeting): saudação dupla para leads migrados do ai-agent antigo (commit 460ddd5) + deploy

**Causa:** leads do ai-agent antigo tinham `lead_profiles.full_name` mas `long_memory.sessions_count=0`. Case C disparava `greeting_message` (template com "com quem eu falo?") mesmo com nome conhecido.

**Fix:** Cases B+C unificados — se `lead.lead_name` existe, sempre usa `known_lead_message`. Deploy: orchestrator ✅ (R47 em erros-e-licoes)

---

### S12 COMPLETO — Métricas + Migração por Instância + Rollback (commit b7017e8)

**M18 Fluxos v3.0 COMPLETO — 12/12 sprints shipped.**

**T1 — Migration (`20260416000002_s12_orchestrator_migration.sql`):**
- `instances.use_orchestrator BOOL DEFAULT false` — flag per-instance
- `flow_report_shares` table — token hex(16), expires_at 30 dias, RLS leitura pública
- RPC `create_flow_report_share(p_flow_id)` SECURITY DEFINER — retorna token

**T2 — Webhook per-instance (`whatsapp-webhook/index.ts`):**
- `getOrchestratorFlag(instanceId?)` — checa `instances.use_orchestrator` primeiro, fallback global `USE_ORCHESTRATOR`
- 2 call sites atualizados: poll_response (conv.instance_id) + handler principal (instance.id)

**T3 — Rollback automático (`orchestrator/index.ts`):**
- `input` declarado fora do try (acessível no catch)
- `handleOrchestratorFailure(instanceId)` — 3 falhas em 5min → `use_orchestrator=false` automático
- Contador em `system_settings` com key `orch_fail_{instanceId}`, janela 5min com reset

**T4 — FlowMetricsPanel (`src/components/flows/FlowMetricsPanel.tsx`):**
- KPI cards: sessões iniciadas, taxa conclusão, taxa handoff, custo USD
- Funil de conversão: BarChart horizontal (active/completed/handoff/abandoned)
- Timing médio: PieChart (intent/resolve/context/subagent/validator/send ms)
- Top 10 intents com progress bars CSS
- Botão "Compartilhar" → RPC → copia URL `{origin}/flows/report/{token}` — 30 dias

**T5 — FlowDetail + useFlows:**
- Nova tab "Métricas" (6ª tab) com `FlowMetricsPanel`
- Tab "Publicar" aprimorada: checklist de migração (publicado/triggers/shadow) + `OrchestratorToggle`
- `OrchestratorToggle`: Switch + Dialog confirmação GitHub-style (digitar nome do fluxo)
- 2 novos hooks: `useToggleOrchestrator` + `useCreateFlowShare`

**T6 — E2E (`supabase/functions/orchestrator/tests/e2e_orchestrator.sh`):**
- 5 cenários: novo_lead_saudacao / coleta_nome / intent_produto / shadow_sem_envio / followup_agendado
- Score: 20pts por cenário = 100 max. Threshold produção: ≥80
- Guard: verifica E2E_INSTANCE_ID configurado (NUNCA instância real)

**tsc --noEmit = EXIT:0 ✅ | 7 arquivos (3 novos + 4 editados) | 864 linhas**

---

## 2026-04-12

### fix(greeting): saudação dupla para leads migrados do ai-agent antigo (commit 460ddd5)

**Sintoma:** Lead "Eduardo" (nome salvo no ai-agent antigo em 01/abr) recebeu "Olá! Bem-vindo a Eletropiso, com quem eu falo?" novamente ao enviar mensagem hoje.

**Causa raiz:**
- ai-agent antigo salvou `lead_profiles.full_name = "Eduardo"` mas NUNCA escreveu `long_memory`
- Orchestrator via Case C: `sessionsCount = 0` (long_memory vazia) + `lead.lead_name = "Eduardo"` → enviava `greeting_message` (template configurado: "Olá! Bem-vindo a Eletropiso, com quem eu falo?") mesmo com nome conhecido

**Fix (greeting.ts):** Cases B e C unificados — se `lead.lead_name` existe (qualquer origem), sempre usa `known_lead_message`. Evita que `greeting_message` (que pode ter "com quem eu falo?") seja enviado a lead já identificado.

**Deploy:** orchestrator ✅

---

### BUG-1+BUG-3+BUG-5 corrigidos + deploy orchestrator + guided-flow-builder

**Commit 46a0a3e — 5 arquivos**

**BUG-1 (validator.ts) — name_frequency_ok não aplicava correção:**
- `checkNameFrequency` calculava `corrected` (remove ocorrências extras do nome) mas não o propagava — retornava issue sem o texto corrigido
- `applyCorrection` para `name_frequency_ok` retornava o texto original com comentário "complexo"
- Fix: add `corrected_text?: string` em `ValidatorIssue` (types.ts), `checkNameFrequency` armazena `corrected_text: corrected`, `applyCorrection` usa `issue.corrected_text ?? text`

**BUG-3 (process-flow-followups:179) — next_step por posição exata:**
- Buscava `position = currentPosition + 1` → falha silenciosa se há gaps (step deletado, reordenado)
- Fix: `.gt('position', currentPosition).order('position', ascending).limit(1)` → próximo step real

**BUG-5 (guided-flow-builder:88) — .single() em sessão expirada:**
- `.single()` lança PGRST116 se session_id não existe → crash 500 (R31)
- Fix: `.maybeSingle()` → sessão não encontrada cai no branch "criar nova"

**followup.ts — status 'complete' → 'continue':**
- Modificação da sessão anterior agora commitada

**Deploy:**
- `orchestrator` — 25 assets — ✅ deployed
- `guided-flow-builder` — 2 assets — ✅ deployed

**tsc --noEmit = 0 erros ✅**

---

### Auditoria S9-S11 + 2 bugs críticos corrigidos

**Auditoria completa de S9 (Validator+Metrics+Shadow), S10 (Survey+Followup+Handoff), S11 (Conversa Guiada+FlowEditor).**

**5 bugs encontrados (2 críticos, 2 médios, 1 baixo):**

**BUG-2 CRÍTICO (corrigido) — `survey.ts`: schema mismatch UI vs backend**
- `StepConfigForm.tsx` salva `{title, options[]}` (formato flat)
- `survey.ts` esperava `{questions: SurveyQuestion[]}` → `normalizeQuestions()` sempre retornava `[]` → survey completava imediatamente sem enviar nenhuma pergunta
- Fix: adicionado `normalizeQuestions(config)` que converte formato flat para `SurveyQuestion[]`. `SurveyConfig` agora aceita `title?`, `options?`, `tag_prefix?` além de `questions?`

**BUG-4 CRÍTICO (corrigido) — `FlowIntelPanel`: top intents e validator stats sempre vazios**
- Painel buscava `event_type === 'intent_detected'` (nunca logado) e `validator_corrected`/`validator_blocked` (não existem no CHECK)
- Fix 1: `orchestrator/index.ts` agora loga `intent_detected` com `{intent, confidence, layer, processing_time_ms}` após ter o `state.id`
- Fix 2: `FlowIntelPanel.tsx` validator stats agora lê de `validator_flagged` + classifica `issues[].action === 'block'` vs `'correct'`

**Bugs pendentes (médios):**
- BUG-1: `validator.ts:264` — `applyCorrection` para `name_frequency_ok` retorna `text` sem aplicar correção
- BUG-3: `process-flow-followups:175` — next_step usa `position = currentPosition + 1` (frágil com gaps)
- BUG-5: `guided-flow-builder/index.ts:88` — `.single()` crasha se sessão expirou (R31)

**Arquivos: 3 editados. tsc --noEmit = 0 erros ✅**

---

### S10 COMPLETO — Auditoria + 3 bugs corrigidos (Templates + Survey + Followup + Handoff)

**Sprint S10 — Camada 4 do M18 Fluxos v3.0**

**Subagentes backend (3 novos):**
- `supabase/functions/orchestrator/subagents/survey.ts`: envia enquetes via UAZAPI /send/menu, fuzzy match de respostas, NPS tag (nps_score:X), retry/pula pergunta, 2 tipos (poll/text)
- `supabase/functions/orchestrator/subagents/followup.ts`: agenda follow-up futuro em step_data, escalation levels, farewell imediato, max_escalations guard
- `supabase/functions/orchestrator/subagents/handoff.ts`: 3 níveis de briefing (minimal/standard/full), atribui dept/user, tags handoff:human/department/manager

**Cron + Orchestrator:**
- `supabase/functions/process-flow-followups/index.ts`: cron horário, busca flow_states com followup pendente, envia /send/text, executa post_action
- `orchestrator/index.ts`: `sendMenuToLead()` (type=list) + `sendPollToLead()` (type=poll); handleMediaSend expandido

**Templates instaláveis (1 clique):**
- `src/data/flowTemplates.ts`: FlowInstallDefinition + 4 FLOW_INSTALL_DEFINITIONS (vitrine/sdr-bant/suporte/pos-venda)
- `src/hooks/useInstallTemplate.ts`: mutation RPC install_flow_template → retorna UUID do flow criado
- `src/pages/dashboard/FlowTemplatesPage.tsx`: badge verde + botão Instalar + navega /flows/:id

**Migrations:**
- `20260415000003_install_flow_template.sql`: RPC atômica (cria flow+steps+triggers em 1 transação, rollback automático)
- `20260415000004_s10_register_flow_followups_cron.sql`: cron hourly do process-flow-followups

**3 bugs corrigidos na auditoria:**
- BUG-1 (`survey.ts`): enviava response_text E media.caption → mensagem duplicada para o lead → removido response_text do poll branch
- BUG-2 (`followup.ts`): retornava status:'complete' → flow_state ficava 'completed' e cron não encontrava → corrigido para status:'continue'
- BUG-3 (migrations): faltava migration de registro do cron process-flow-followups → criada 20260415000004

**Arquivos: 9 novos + 3 editados = 12 arquivos. tsc --noEmit = 0 erros ✅**

---

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
