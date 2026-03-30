---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-30T10:27:26.552Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 10
  completed_plans: 8
---

# STATE.md — WhatsPRO (Snapshot 2026-03-29)

## Status Geral do Projeto

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| Frontend (React) | Compila | Build produz chunks otimizados (10 vendor chunks) |
| Backend (Edge Functions) | Deploy OK | 27+ funcs ativas em Deno, Supabase hospedado |
| Banco de Dados | Estavel | 102 migrations, 47 tabelas, 343 RLS policies |
| Testes | Parcial | ~20 arquivos de teste; vitest configurado, cobertura baixa |
| TypeScript | Leniente | `strict: false`, `noImplicitAny: false` no tsconfig.app.json |

---

## O Que Ja Esta Codificado e Compilando

### Frontend (src/)

- **Helpdesk completo**: chat real-time, labels, atribuicao, departamentos, notas internas
- **AI Agent Config**: 15+ paineis (GeneralConfig, BrainConfig, CatalogConfig, KnowledgeConfig, GuardrailsConfig, VoiceConfig, RulesConfig, ExtractionConfig, FollowUpConfig, BlockedNumbersConfig, SubAgentsConfig, BusinessInfoConfig, MetricsConfig)
- **Playground v2**: tool inspector, thumbs up/down, overrides, cenarios, personas
- **CRM Kanban**: drag-drop, campos customizados, boards shared/private, contact_id FK
- **Leads**: import CSV/Excel, perfil completo (26 campos), timeline, modal conversa
- **Broadcast**: texto, midia, carrossel (ate 10 cards), agendamento, delay configuravel
- **Campanhas UTM**: links, QR codes, metricas, atribuicao IA
- **Intelligence/Dashboard**: metricas de agente, volume, graficos, agent performance card
- **Admin**: gestao usuarios (CRUD), departamentos, inboxes, secrets, backup, audit log
- **Global Search**: Ctrl+K command palette cross-inbox
- **Settings**: relatorio de turno via WhatsApp

### Backend (supabase/functions/)

- **ai-agent**: 8 tools, loop LLM (OpenAI primary + Gemini fallback), circuit breaker, greeting, handoff, shadow mode, SDR flow, TTS, carousel copy chain
- **ai-agent-debounce**: atomic append (RPC), 10s window, retry 5xx
- **ai-agent-playground**: ambiente isolado super_admin
- **whatsapp-webhook**: intake completo (texto, midia, audio, carrossel, contato vCard), dedup, contact upsert, lead auto-add, UTM attribution, follow-up status
- **transcribe-audio**: Gemini ASR, 90s timeout
- **uazapi-proxy**: token resolution server-side, admin endpoints
- **process-jobs**: SKIP LOCKED job queue (lead_auto_add, profile_pic)
- **process-scheduled-messages**: cron, atomic claim
- **process-follow-ups**: cadencia automatica
- **scrape-product / scrape-products-batch**: import catalogo via URL
- **health-check**: DB + MV + env verification (200/503)
- **admin-create/delete/update-user**: CRUD com audit log
- **e2e-test / e2e-scheduled**: testes sinteticos

---

## Divida Tecnica Imediata

### CRITICA (Impacto em Producao)

#### DT-01: Nome de Modelo LLM Invalido

- **Arquivo**: `supabase/functions/_shared/llmProvider.ts:64`
- **Problema**: Default `'gpt-4.1-mini'` — nao e um model ID valido da OpenAI
- **Impacto**: Se agent.model nao estiver configurado, requests falham silenciosamente
- **Fix**: Alterar para model ID correto (ex: `gpt-4.1-mini` pode ser intencional se OpenAI lancou — verificar)
- **Nota**: O mesmo default aparece em `ai-agent/index.ts`

#### DT-02: Shadow Mode Ignora Circuit Breaker

- **Arquivo**: `supabase/functions/ai-agent/index.ts` (secao shadow)
- **Problema**: Shadow mode chama Gemini API diretamente, bypassing `callLLM()` e o circuit breaker
- **Impacto**: Se Gemini estiver DOWN, shadow mode faz requests infinitos sem protecao
- **Fix**: Rotear shadow mode pelo `callLLM()` ou aplicar circuit breaker manualmente

#### DT-03: Fallback de Greeting Dedup Ausente

- **Arquivo**: `supabase/functions/ai-agent/index.ts`
- **Problema**: Dedup depende de RPC `try_insert_greeting`; se RPC falhar, greeting duplica
- **Impacto**: Lead recebe 2+ greetings em requests simultaneos
- **Fix**: Adicionar fallback com advisory lock ou catch + skip

#### DT-04: Audio Transcription Sem Retry

- **Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`
- **Problema**: Transcribe-audio e fire-and-forget (EdgeRuntime.waitUntil); se crashar, audio perdido
- **Impacto**: Mensagens de audio podem nunca ser transcritas
- **Fix**: Usar job_queue para retry ou adicionar status tracking na message

### ALTA PRIORIDADE

#### DT-05: TypeScript strict: false

- **Arquivo**: `tsconfig.app.json`
- **Problema**: `strict: false` + `noImplicitAny: false` permite `any` implicito em todo o frontend
- **Impacto**: Bugs de tipo passam despercebidos; refatoracoes perigosas
- **Fix**: Habilitar `strict: true` incrementalmente (por pasta/modulo)

#### DT-06: Validacao de Formularios Incompleta (Frontend)

- **Locais afetados**:
  - `Settings.tsx:296` — sem validacao de formato de telefone
  - `GuardrailsConfig` — max_discount_percent aceita -1 ou 150%
  - `BrainConfig` — temperature sem validacao de range (pode aceitar >2 ou <0)
  - `ExtractionConfig:86` — campo custom criado com label vazio
  - `BlockedNumbersConfig` — aceita qualquer sequencia de 10+ digitos (ex: "1111111111")
- **Impacto**: Dados invalidos persistidos no banco
- **Fix**: Adicionar Zod schemas por formulario

#### DT-07: Race Condition no Limite de Mensagens do Lead

- **Arquivo**: `supabase/functions/ai-agent/index.ts`
- **Problema**: `max_lead_messages` faz count dinamico; mensagens concorrentes podem bypassar limite
- **Impacto**: Lead envia 10+ msgs antes do handoff automatico
- **Fix**: Usar contador atomico na row de conversation (UPDATE ... SET count = count + 1 RETURNING)

#### DT-08: Componentes Gigantes Sem Decomposicao

- **Arquivos**:
  - `AIAgentPlayground.tsx` — 1353 LOC, 17 useState, 8+ useCallback
  - `Sidebar.tsx` — 812 LOC
  - `BackupModule.tsx` — 810 LOC
  - `LeadMessageForm.tsx` — 764 LOC
  - `ContactInfoPanel.tsx` — 750 LOC
  - `CatalogConfig.tsx` — 704 LOC
- **Impacto**: Dificuldade de manutencao, re-renders desnecessarios, bugs escondidos
- **Fix**: Extrair sub-componentes logicos

#### DT-09: Error Handling Inconsistente entre Edge Functions

- **Problema**:
  - `auth.ts` retorna null (permissivo)
  - `llmProvider.ts` lanca excecoes (fail-loud)
  - `rateLimit.ts` retorna defaults (fail-open)
  - `webhook` retorna HTTP status codes
- **Impacto**: Comportamento imprevisivel em cascata de erros
- **Fix**: Padronizar com Result<T, E> pattern ou consistent error responses

#### DT-10: Carousel Copy Cache Sem Invalidacao

- **Arquivo**: `supabase/functions/ai-agent/index.ts:69-150`
- **Problema**: Cache keyed por `product.id:numCards`; se titulo/preco mudar, cache stale por 24h
- **Impacto**: Carousel envia copy desatualizada apos editar produto
- **Fix**: Invalidar cache no update do produto (ou usar hash do produto como key)

### MEDIA PRIORIDADE

#### DT-11: N+1 Queries no ai-agent

- Agent carrega labels, historico, knowledge separadamente apos Promise.all inicial
- Poderia batchear com joins (dependendo do RLS)

#### DT-12: Carousel Auto-Send Message Hardcoded

- `'Confira:'` hardcoded como texto antes do carrossel
- Deveria ser configuravel por agente

#### DT-13: Codigo Duplicado entre Edge Functions

- Criacao de Supabase Client repetida em 20+ funcoes
- Carousel building duplicado entre ai-agent e search_products
- mergeTags() so existe em ai-agent, deveria estar em agentHelpers

#### DT-14: Observabilidade Limitada

- Logging detalhado mas sem metricas estruturadas
- Sem percentis de latencia, error rates por tipo, token usage trends
- Circuit breaker state so em logs

#### DT-15: Auto-Save Race Condition (AIAgentTab)

- `pendingSaveRef` pode enfileirar multiplos saves mas so um executa
- Sem deteccao de conflito (duas abas editando mesmo agente)

#### DT-16: Uso Inconsistente de React Query

- `Settings.tsx` usa `useQuery/useMutation` do React Query
- `DashboardHome.tsx` usa hook customizado `useSupabaseQuery`
- Hooks faltam retry, stale-while-revalidate, cancellation

#### DT-17: Error Boundaries Insuficientes

- Apenas 1 ErrorBoundary.tsx (nivel root)
- Faltam boundaries em: secoes do dashboard, modals complexos, playground, broadcast

---

## Saude do Schema (Frontend vs Banco)

### Tipos Supabase (src/integrations/supabase/types.ts)

- **Status**: Sincronizado com migrations (auto-gerado)
- **47 tabelas** definidas, incluindo ai_agents (29 campos), lead_profiles (26 campos)
- **4 enums**: app_role, inbox_role, kanban_field_type, kanban_visibility
- **40+ funcoes RPC** tipadas
- **Nenhum descompasso** detectado entre types e migrations recentes

### Pontos de Atencao

- Campos `Json | null` sem tipagem especifica: business_hours, extraction_fields, sub_agents, follow_up_rules
- Campos `metadata: Json | null` muito genericos em varias tabelas
- Frontend usa `any` em ~10 locais (LeadDetail:29, Leads:99, UsersManagement:38, etc.)

---

## Onde Paramos (Ultimo Trabalho)

### Ultima Sessao

- **Fase**: Phase 4 — Decomposicao de Componentes Gigantes
- **Plano Concluido**: 04-02-PLAN.md (CatalogConfig decomposition — CatalogTable + CatalogProductForm)
- **Proximo**: Phase 4 — verificar se ha mais planos pendentes
- **Timestamp**: 2026-03-30

### Ultimos 5 Commits

1. `0d80712` — feat(04-02): extract CatalogProductForm, slim orchestrator to 273 LOC
2. `924d049` — feat(04-02): extract CatalogTable sub-component with filters, grid, bulk actions
3. `eddbaa7` — feat(03-01): Settings.tsx — recipient_number inline validation
4. `8d14190` — feat(03-01): ExtractionConfig + BlockedNumbersConfig — local inline validation
5. `28411d4` — feat(03-01): add fieldErrors prop + inline error display to 4 config panels

### Decisoes Tomadas

- handleImportFromUrl e handleGenerateDescription movidos para CatalogProductForm — handlers UI-transient do dialog, so tocam form state
- fileInputRef criado dentro de CatalogProductForm — ref UI-local para input de arquivo dentro do Dialog
- Product interface e EMPTY_PRODUCT exportados de CatalogConfig para importacao nos sub-componentes
- hasActiveFilters cast para !!boolean antes de passar para CatalogTable (era string|boolean no orchestrator)
- CatalogConfig.tsx reduzido de 704 para 273 LOC — DT-08-catalog resolvido
- computeResults movido para playground.ts como funcao pura (sem refs, sem side effects) — DT-08 resolvido para Playground
- scrollRef/inputRef/fileInputRef criados dentro de PlaygroundManualTab (UI-local per D-02) — auto-scroll via useEffect interno
- overridesRef adicionado ao orchestrator para evitar stale closure em sendToAgent e runScenario (refs read latest value)
- testGuardrail removido (eslint-disable unused — dead code desde a criacao)
- Zod schemas usam .partial() — cada campo e validado independentemente via SCHEMA_MAP routing
- fieldErrorsRef (nao state) usado no guard do doSave — evita stale closure em callbacks memoizados
- max_tokens Input nao clampeia via Math.min/max — Zod valida e mostra erro inline em vez de correcao silenciosa
- ExtractionConfig e BlockedNumbersConfig usam local state (nao fieldErrors prop) — operacoes de add de array nao passam por AIAgentTab
- VoiceConfig min HTML attr corrigido de 50 para 10 — alinhado com schema voiceSchema.min(10)
- Shadow mode usa callLLM() com model: agent.model || 'gemini-2.5-flash' — roteia Gemini-first quando o modelo e gemini-*, OpenAI-first caso contrario
- Shadow mode errors sao apenas logados (nao re-lançados) porque extracao de shadow e nao-critica
- gpt-4.1-mini confirmado como model ID valido da OpenAI (lancado 2025-04-14)
- vitest.config.ts extendido para cobrir supabase/functions/_shared/ tests
- executeToolSafe retorna string de erro em portugues — LLM pode continuar conversa sem o resultado da tool
- Token ceiling de 8192 faz trimming (nao break) — mantém ultimas 6 mensagens
- request_id e o mesmo UUID no retry (cenario 5xx) — rastreabilidade completa da cadeia de retry
- mergeTags e escapeLike movidos para _shared/agentHelpers — fonte unica de verdade para todas as edge functions
- greeting_rpc_error e um code path distinto de greeting_duplicate para observabilidade de falhas de DB
- unauthorizedResponse() usado em ai-agent e whatsapp-webhook — sem mais construcao inline de 401
- increment_lead_msg_count RPC usa UPDATE...RETURNING atomico — sem SELECT separado; fallback counterErr=0 evita crash
- max_retries=1 em transcribe_audio jobs (2 tentativas total); job.max_retries ?? 3 preserva compatibilidade

### Divida Tecnica Resolvida

- **DT-01** (Nome de Modelo LLM Invalido): Confirmado gpt-4.1-mini como valido, comentario adicionado
- **DT-02** (Shadow Mode Ignora Circuit Breaker): Shadow mode agora usa callLLM() com circuit breaker
- **DT-03** (Fallback de Greeting Dedup Ausente): greeting_rpc_error retorna reason distinto com log estruturado
- **DT-04** (Audio Transcription Sem Retry): Webhook enfileira job_queue em vez de chamada sincrona; process-jobs executa com retry
- **DT-07** (Race Condition no Limite de Mensagens): Substituido COUNT(*) por increment_lead_msg_count() RPC atomico
- **DT-06** (Validacao de Formularios Incompleta): Zod schemas + inline errors + auto-save guard + phone validation Settings.tsx
- **DT-09 parcial** (Error Handling Inconsistente): unauthorizedResponse() padronizado em ai-agent + webhook
- **DT-13 parcial** (Codigo Duplicado): mergeTags e escapeLike centralizados em agentHelpers
- **P1-03** (Tool execution sem isolamento): executeToolSafe wrapper adicionado
- **P1-04** (Token ceiling ausente): MAX_ACCUMULATED_INPUT_TOKENS=8192 adicionado com trimming
- **P1-05** (Correlation IDs ausentes): request_id flui do debounce para o ai-agent
- **P2-T2** (Audio transcription sem retry): RESOLVIDO via job_queue
- **P2-T3** (Race condition contador mensagens): RESOLVIDO via RPC atomica

### Phase 1 Status

- [x] 01-01-PLAN.md — Shadow mode circuit breaker fix + model ID audit + CB unit tests (DONE 2026-03-29)
- [x] 01-02-PLAN.md — Tool execution isolation + token ceiling + correlation IDs (DONE 2026-03-29)
- **Phase 1 COMPLETA** — Todos os planos executados

### Phase 2 Status

- [x] 02-01-PLAN.md — Greeting dedup fallback + mergeTags migration + 401 standardization (DONE 2026-03-29)
- [x] 02-02-PLAN.md — Audio transcription via job_queue + atomic lead message counter (DONE 2026-03-29)
- **Phase 2 COMPLETA** — Todos os planos executados

### Phase 3 Status

- [x] 03-01-PLAN.md — Zod validation schemas + inline errors + auto-save guard + phone validation (DONE 2026-03-29)
- **Phase 3 COMPLETA** — Todos os planos executados

### Phase 4 Status

- [x] 04-01-PLAN.md — AIAgentPlayground decomposition: 1353 LOC → 276 LOC orchestrator + 4 tab sub-components + types file (DONE 2026-03-30)
- [x] 04-02-PLAN.md — CatalogConfig decomposition — CatalogTable + CatalogProductForm (DONE 2026-03-30)

### Phase 5 Status

- [x] 05-01-PLAN.md — Type contracts: src/types/agent.ts (4 JSON field interfaces + JsonField helper) + src/types/playground.ts (E2eResult + E2eLiveStep) (DONE 2026-03-30)

### Divida Tecnica Resolvida (Adicional)

- **DT-08-catalog** (CatalogConfig gigante): CatalogConfig.tsx de 704 para 273 LOC via CatalogTable + CatalogProductForm
- **DT-05 parcial** (TypeScript strict: false): Criados src/types/agent.ts e src/types/playground.ts — contratos tipados para campos Json do agente e resultados E2e

### Decisoes Tomadas (Phase 5)

- src/types/playground.ts criado do zero (Phase 04 nao o havia criado como esperado); apenas tipos E2e adicionados
- JsonField<T> = T | null helper para alias limpo de campos Json nulos do Supabase
- E2eResult.agent_raw tipado como Record<string, unknown> | null para acesso mais facil downstream

### Contexto

- Trabalho recente focado em tipagem estrita (Phase 5 iniciada): src/types/agent.ts e src/types/playground.ts criados
- Phase 5 Plan 01 completo: contratos de tipo estabelecidos para uso downstream
- Suite total: 173 testes passando
- Ultima sessao: 2026-03-30
