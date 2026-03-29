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
**Status**: [ ] Em planejamento
**Prioridade**: CRITICA
**Escopo**: `supabase/functions/whatsapp-webhook/index.ts`, `ai-agent/index.ts`, `agentHelpers.ts`, `process-jobs/index.ts`
**Plans:** 2 plans

**Objetivo**: Eliminar race conditions no webhook e garantir greeting unico por sessao.

Plans:
- [ ] 02-01-PLAN.md — Greeting dedup fallback + mergeTags migration + unauthorized response standardization
- [ ] 02-02-PLAN.md — Atomic lead message counter + audio transcription via job_queue

**Tarefas**:
1. Adicionar fallback de dedup para greeting (quando RPC `try_insert_greeting` falhar)
2. Implementar retry para audio transcription (usar job_queue em vez de fire-and-forget puro)
3. Tornar lead message counter atomico (UPDATE SET count = count + 1 RETURNING em vez de query separada)
4. Mover `mergeTags()` para `_shared/agentHelpers.ts` (atualmente duplicado)
5. Padronizar error responses entre edge functions (extrair helper `unauthorizedResponse()`)

**Criterios de Aceite**:
- [ ] Greeting nunca duplica mesmo com requests simultaneos (teste de concorrencia)
- [ ] Audio transcription tem retry via job_queue
- [ ] Lead message limit e atomico (sem bypass por concorrencia)
- [ ] mergeTags() em agentHelpers, importado por todas as funcoes que usam

---

### Phase 3: Validacao Estrita de Formularios (Frontend)
**Status**: [ ] Pendente
**Prioridade**: ALTA
**Escopo**: `src/components/admin/ai-agent/`, `src/pages/dashboard/Settings.tsx`

**Objetivo**: Impedir dados invalidos de chegarem ao banco via formularios de configuracao do agente.

**Tarefas**:
1. Criar Zod schemas para cada painel de configuracao do agente:
   - GuardrailsConfig: max_discount_percent (0-100), blocked_phrases (non-empty)
   - BrainConfig: temperature (0.0-2.0), max_tokens (1-8192), model (enum valido)
   - RulesConfig: handoff_cooldown (5-1440), max_lead_messages (1-50)
   - VoiceConfig: voice_max_text_length (10-500)
   - ExtractionConfig: custom key (regex alphanumeric), label (non-empty)
2. Adicionar validacao de telefone em Settings.tsx (formato brasileiro)
3. Adicionar validacao de telefone em BlockedNumbersConfig (formato internacional)
4. Integrar schemas com auto-save do AIAgentTab (validar antes de persist)

**Criterios de Aceite**:
- [ ] Nenhum formulario aceita valores fora do range especificado
- [ ] Telefones validados com regex brasileiro (11-13 digitos com DDI)
- [ ] Erros de validacao mostrados inline no campo
- [ ] Auto-save nao dispara com dados invalidos

---

### Phase 4: Decomposicao de Componentes Gigantes
**Status**: [ ] Pendente
**Prioridade**: ALTA
**Escopo**: `src/pages/dashboard/AIAgentPlayground.tsx`, `src/components/admin/ai-agent/CatalogConfig.tsx`

**Objetivo**: Reduzir complexidade dos componentes maiores para facilitar manutencao e performance.

**Tarefas**:
1. AIAgentPlayground.tsx (1353 LOC) -> extrair:
   - PlaygroundChat (display de mensagens + input)
   - PlaygroundToolInspector (inspecao de tools usadas)
   - PlaygroundScenarioRunner (execucao de cenarios)
   - PlaygroundMetrics (metricas de performance)
2. CatalogConfig.tsx (704 LOC) -> extrair:
   - CatalogTable (listagem + filtros + sort)
   - CatalogImportPanel (CSV + batch scrape)
   - CatalogProductForm (formulario de produto)
3. Extrair tipos inline do Playground para `src/types/playground.ts`

**Criterios de Aceite**:
- [ ] AIAgentPlayground.tsx < 300 LOC (orquestrador)
- [ ] CatalogConfig.tsx < 300 LOC
- [ ] Nenhuma regressao funcional (testes existentes passam)
- [ ] Tipos exportados e reutilizaveis

---

### Phase 5: Tipagem Estrita do Supabase (Frontend)
**Status**: [ ] Pendente
**Prioridade**: MEDIA
**Escopo**: `tsconfig.app.json`, `src/integrations/supabase/types.ts`, componentes com `any`

**Objetivo**: Eliminar `any` implicitos e preparar caminho para strict mode.

**Tarefas**:
1. Substituir `any` explicitos nos 10+ locais identificados:
   - LeadDetail.tsx:29 (contact state)
   - Leads.tsx:99 (tag filter)
   - UsersManagement.tsx:38 (instance info)
   - AIAgentPlayground.tsx (inline types)
2. Criar tipos especificos para campos Json:
   - `BusinessHours` (start: string, end: string)
   - `ExtractionField` (key: string, label: string, enabled: boolean)
   - `FollowUpRule` (days: number, message: string)
   - `SubAgentConfig` (mode: string, prompt: string)
3. Habilitar `strict: true` no tsconfig.app.json (fix errors incrementalmente)

**Criterios de Aceite**:
- [ ] Zero `any` explicitos em componentes de configuracao do agente
- [ ] Campos Json tipados com interfaces especificas
- [ ] Build compila sem erros com strict: true
- [ ] Nenhum `@ts-ignore` ou `@ts-expect-error` adicionado

---

### Phase 6: Padronizacao de Data Fetching e Error Boundaries
**Status**: [ ] Pendente
**Prioridade**: MEDIA
**Escopo**: `src/hooks/`, `src/pages/dashboard/`, `src/components/ErrorBoundary.tsx`

**Objetivo**: Unificar patterns de data fetching e proteger UI contra crashes isolados.

**Tarefas**:
1. Migrar `useSupabaseQuery` -> React Query (useQuery/useMutation) em:
   - DashboardHome.tsx
   - Leads.tsx
   - LeadDetail.tsx
2. Adicionar Error Boundaries granulares:
   - Dashboard sections (cada card independente)
   - Playground (chat, tools, scenarios separados)
   - Broadcast modal
   - CRM Kanban board
3. Implementar loading skeletons consistentes em todas as paginas

**Criterios de Aceite**:
- [ ] Todos os data fetches usam React Query (zero useSupabaseQuery)
- [ ] Crash em 1 secao do dashboard nao derruba as outras
- [ ] Loading states visiveis em todas as operacoes async
- [ ] Stale-while-revalidate ativo para dados do dashboard

---

### Phase 7: Consolidacao de Helpers e Reducao de Duplicacao (Backend)
**Status**: [ ] Pendente
**Prioridade**: MEDIA
**Escopo**: `supabase/functions/_shared/`, todas as edge functions

**Objetivo**: Eliminar codigo duplicado e centralizar utilities compartilhadas.

**Tarefas**:
1. Extrair `createSupabaseClient()` para `_shared/supabaseClient.ts` (usado em 20+ funcoes)
2. Mover carousel building logic para helper compartilhado (duplicado entre ai-agent e search_products)
3. Centralizar error response helpers: `unauthorizedResponse()`, `badRequestResponse()`, `serverErrorResponse()`
4. Tornar `'Confira:'` (carousel auto-send text) configuravel por agente
5. Adicionar metricas estruturadas basicas (latencia LLM, token count, error rate por provider)

**Criterios de Aceite**:
- [ ] Supabase client criado em 1 lugar, importado por todas as funcoes
- [ ] Zero duplicacao de carousel building logic
- [ ] Error responses padronizadas com CORS correto
- [ ] Carousel auto-send text configuravel
- [ ] Metricas basicas registradas em logs estruturados

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
