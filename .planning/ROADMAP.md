# ROADMAP.md — WhatsPRO

## Milestone 1: Refatoracao e Blindagem do Modulo Agente IA
**Objetivo**: Eliminar divida tecnica critica no core do AI Agent, blindar webhooks, e preparar base para features futuras.
**Escopo**: Backend (edge functions) + Frontend (config panels) + Tipagem

---

### Phase 1: Blindagem do LLM Provider e Circuit Breaker
**Status**: [x] COMPLETA (2/2 plans concluidos)
**Prioridade**: CRITICA
**Escopo**: `supabase/functions/_shared/llmProvider.ts`, `circuitBreaker.ts`, `ai-agent/index.ts`, `ai-agent-debounce/index.ts`
**Plans:** 2/2 plans executed

**Objetivo**: Garantir que TODAS as chamadas LLM passem pelo circuit breaker e que o fallback chain funcione corretamente.

Plans:
- [x] 01-01-PLAN.md — Shadow mode circuit breaker fix + model ID audit + CB unit tests (DONE 2026-03-29)
- [x] 01-02-PLAN.md — Tool execution isolation + token ceiling + correlation IDs (DONE 2026-03-29)

**Criterios de Aceite**:
- [x] Shadow mode usa callLLM() com circuit breaker
- [x] Tool execution failures nao causam loop infinito (executeToolSafe retorna string de erro)
- [x] Logs possuem correlation ID rastreavel do debounce ao LLM (request_id via createLogger)
- [x] Testes unitarios cobrem cenarios de CircuitBreaker (11 tests) e executeToolSafe pattern (3 tests)

---

### Phase 2: Blindagem do Webhook e Dedup de Greeting
**Status**: [x] COMPLETA (2/2 plans concluidos)
**Prioridade**: CRITICA
**Escopo**: `supabase/functions/whatsapp-webhook/index.ts`, `ai-agent/index.ts`, `agentHelpers.ts`, `process-jobs/index.ts`
**Plans:** 2/2 plans complete

**Objetivo**: Eliminar race conditions no webhook e garantir greeting unico por sessao.

Plans:
- [x] 02-01-PLAN.md — Greeting dedup fallback + mergeTags migration + unauthorized response standardization
- [x] 02-02-PLAN.md — Atomic lead message counter + audio transcription via job_queue

**Tarefas**:
1. Adicionar fallback de dedup para greeting (quando RPC `try_insert_greeting` falhar)
2. Implementar retry para audio transcription (usar job_queue em vez de fire-and-forget puro)
3. Tornar lead message counter atomico (UPDATE SET count = count + 1 RETURNING em vez de query separada)
4. Mover `mergeTags()` para `_shared/agentHelpers.ts` (atualmente duplicado)
5. Padronizar error responses entre edge functions (extrair helper `unauthorizedResponse()`)

**Criterios de Aceite**:
- [x] Greeting nunca duplica mesmo com requests simultaneos (teste de concorrencia)
- [x] Audio transcription tem retry via job_queue
- [x] Lead message limit e atomico (sem bypass por concorrencia)
- [x] mergeTags() em agentHelpers, importado por todas as funcoes que usam

---

### Phase 3: Validacao Estrita de Formularios (Frontend)
**Status**: [ ] Em planejamento
**Prioridade**: ALTA
**Escopo**: `src/components/admin/ai-agent/`, `src/pages/dashboard/Settings.tsx`
**Plans:** 1/1 plans complete

**Objetivo**: Impedir dados invalidos de chegarem ao banco via formularios de configuracao do agente.

Plans:
- [x] 03-01-PLAN.md — Zod schemas in AIAgentTab + inline errors in all config panels + phone validation in Settings.tsx

**Tarefas**:
1. Criar Zod schemas para cada painel de configuracao do agente:
   - GuardrailsConfig: max_discount_percent (0-100)
   - BrainConfig: temperature (0.0-1.0), max_tokens (100-8192), model (enum valido)
   - RulesConfig: handoff_cooldown (5-1440), max_lead_messages (1-50)
   - VoiceConfig: voice_max_text_length (10-500)
   - ExtractionConfig: custom key (regex alphanumeric), label (non-empty)
2. Adicionar validacao de telefone em Settings.tsx (formato brasileiro)
3. Adicionar validacao de telefone em BlockedNumbersConfig (formato internacional)
4. Integrar schemas com auto-save do AIAgentTab (validar antes de persist)

**Criterios de Aceite**:
- [ ] Nenhum formulario aceita valores fora do range especificado
- [ ] Telefones validados com regex brasileiro (10-13 digitos com DDI)
- [ ] Erros de validacao mostrados inline no campo
- [ ] Auto-save nao dispara com dados invalidos

---

### Phase 4: Decomposicao de Componentes Gigantes
**Status**: [ ] Em planejamento
**Prioridade**: ALTA
**Escopo**: `src/pages/dashboard/AIAgentPlayground.tsx`, `src/components/admin/ai-agent/CatalogConfig.tsx`
**Plans:** 2/2 plans complete

**Objetivo**: Reduzir complexidade dos componentes maiores para facilitar manutencao e performance.

Plans:
- [x] 04-01-PLAN.md — AIAgentPlayground decomposition: types to playground.ts + 4 tab sub-components + orchestrator <300 LOC
- [x] 04-02-PLAN.md — CatalogConfig decomposition: CatalogTable + CatalogProductForm + orchestrator <300 LOC

**Criterios de Aceite**:
- [ ] AIAgentPlayground.tsx < 300 LOC (orquestrador)
- [ ] CatalogConfig.tsx < 300 LOC
- [ ] Nenhuma regressao funcional (testes existentes passam)
- [ ] Tipos exportados e reutilizaveis

---

### Phase 5: Tipagem Estrita do Supabase (Frontend)
**Status**: [ ] Em planejamento
**Prioridade**: MEDIA
**Escopo**: `tsconfig.app.json`, `src/types/agent.ts`, `src/types/playground.ts`, `LeadDetail.tsx`, `Leads.tsx`, `AIAgentPlayground.tsx`, `PlaygroundE2eTab.tsx`
**Plans:** 3 plans

**Objetivo**: Eliminar `any` explicitos nos arquivos de escopo, tipar campos Json do agente, e habilitar strict mode.

Plans:
- [x] 05-01-PLAN.md — Create type definitions (agent.ts + E2eResult/E2eLiveStep in playground.ts)
- [x] 05-02-PLAN.md — Replace all any in Leads.tsx and LeadDetail.tsx
- [x] 05-03-PLAN.md — Replace all any in AIAgentPlayground.tsx + PlaygroundE2eTab.tsx + enable strict:true

**Criterios de Aceite**:
- [ ] Zero `any` explicitos nos 4 arquivos de escopo + PlaygroundE2eTab
- [ ] Campos Json tipados com interfaces especificas (BusinessHours, ExtractionField, FollowUpRule, SubAgentConfig)
- [ ] Build compila sem erros com strict: true (ou noImplicitAny: true se >10 erros fora de escopo)
- [ ] Nenhum `@ts-ignore` adicionado
- [ ] catch blocks usam `unknown` com instanceof Error guard

---

### Phase 6: Padronizacao de Data Fetching e Error Boundaries
**Status**: [ ] Em planejamento
**Prioridade**: MEDIA
**Escopo**: `src/hooks/`, `src/pages/dashboard/`, `src/components/ErrorBoundary.tsx`
**Plans:** 3/3 plans complete

**Objetivo**: Unificar patterns de data fetching e proteger UI contra crashes isolados.

Plans:
- [x] 06-01-PLAN.md — React Query migration for LeadDetail.tsx + Leads.tsx (useQuery, useMutation, invalidateQueries)
- [x] 06-02-PLAN.md — React Query migration for DashboardHome.tsx (3 useQuery + Realtime invalidation)
- [x] 06-03-PLAN.md — ErrorBoundary granular (9 boundaries across 5 pages) + deprecate useSupabaseQuery.ts

**Criterios de Aceite**:
- [ ] Todos os data fetches usam React Query (zero useSupabaseQuery)
- [ ] Crash em 1 secao do dashboard nao derruba as outras
- [ ] Loading states visiveis em todas as operacoes async
- [ ] Stale-while-revalidate ativo para dados do dashboard

---

### Phase 7: Consolidacao de Helpers e Reducao de Duplicacao (Backend)
**Status**: [ ] Em planejamento
**Prioridade**: MEDIA
**Escopo**: `supabase/functions/_shared/`, todas as 28 edge functions
**Plans:** 2/4 plans executed

**Objetivo**: Eliminar codigo duplicado e centralizar utilities compartilhadas em todas as edge functions.

Plans:
- [x] 07-01-PLAN.md — Foundation: supabaseClient.ts + carousel.ts + LLM metrics + auth.ts update
- [x] 07-02-PLAN.md — Migrate 14 small functions (<250 LOC) to shared utilities
- [ ] 07-03-PLAN.md — Migrate 10 medium functions (242-414 LOC) to shared utilities
- [ ] 07-04-PLAN.md — Migrate 4 large functions (426-1898 LOC) + carousel integration + configurable carousel_text

**Criterios de Aceite**:
- [ ] Supabase client criado em 1 lugar, importado por todas as funcoes
- [ ] Zero duplicacao de carousel building logic
- [ ] Error responses padronizadas com CORS correto (successResponse/errorResponse)
- [ ] Carousel auto-send text configuravel (agent.carousel_text)
- [ ] Metricas LLM basicas registradas em logs estruturados (latency_ms, token_count, provider)
- [ ] Todas as 28 funcoes usam createLogger (zero console.log/error)

---

## Proximos Milestones (Backlog)

### Milestone 2: Observabilidade e Monitoramento
- Dashboard de saude do agente (latencia, token usage, error rates)
- Alertas automaticos (circuit breaker OPEN, taxa de erro alta)
- Tracing distribuido (correlation IDs end-to-end)

### Milestone 3: Escalabilidade
- Particionamento de tabelas grandes (conversations, messages)
- Cache layer para knowledge base e catalogo
- Worker dedicado para transcricao de audio

### Milestone 4: Feature Expansion
- Multi-modelo por agente (diferentes LLMs para diferentes tools)
- A/B testing de system prompts
- Analytics avancado de conversas (sentiment trending, topic clustering)
