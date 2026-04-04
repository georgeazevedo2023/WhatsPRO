# Roadmap: WhatsPRO

## Milestones

- ✅ **v1.0 Refatoração e Blindagem** — Phases 1-7 (shipped 2026-04-04)

## Phases

<details>
<summary>✅ v1.0 Refatoração e Blindagem (Phases 1-7) — SHIPPED 2026-04-04</summary>

- [x] Phase 1: Blindagem do LLM Provider e Circuit Breaker (2/2 plans) — 2026-03-29
- [x] Phase 2: Blindagem do Webhook e Dedup de Greeting (2/2 plans) — 2026-03-29
- [x] Phase 3: Validação Estrita de Formulários Frontend (1/1 plan) — 2026-03-29
- [x] Phase 4: Decomposição de Componentes Gigantes (2/2 plans) — 2026-03-30
- [x] Phase 5: Tipagem Estrita do Supabase Frontend (3/3 plans) — 2026-03-30
- [x] Phase 6: Padronização de Data Fetching e Error Boundaries (3/3 plans) — 2026-03-30
- [x] Phase 7: Consolidação de Helpers e Redução de Duplicação Backend (4/4 plans) — 2026-03-30

</details>

## Backlog

### Milestone 2: Agent QA Framework — IN PROGRESS

#### Pre-requisitos (2026-04-04)
- [x] Fix bug activeSubAgents→activeSub (ai-agent/index.ts:2353)
- [x] Commitar 38 migrations históricas
- [x] Criar tabela e2e_test_batches com FK não-destrutiva
- [x] Regenerar types.ts com schema completo

#### F1: Histórico Persistente de Batches (2026-04-04)
- [x] useE2eBatchHistory/useE2eBatchRuns/useCreateBatch/useCompleteBatch hooks
- [x] BatchHistoryTab — lista expansível com score bar e badges de status
- [x] runAllE2e cria/finaliza batch row no DB
- [x] 44 testes, tsc clean — commit 4fe98ad

#### F2: Fluxo de Aprovação Admin (próximo)
- [ ] Hook useE2eApproval + mutation approve/reject
- [ ] ApprovalQueue + ReviewDrawer components
- [ ] Badge de pendentes no header do Playground

#### F3: Barra de Evolução (Score Composto)
- [ ] agentScoring.ts — computeCompositeScore (E2E 40% + Validator 30% + Tools 20% + Latência 10%)
- [ ] useAgentScore hook
- [ ] AgentScoreBar component com Recharts trend chart

#### F4: Ciclo Automatizado Teste → Ajuste → Re-teste
- [ ] Migration: colunas de regressão + pg_cron
- [ ] e2e-scheduled edge function evoluída
- [ ] E2eSchedulePanel + RegressionBadge + BatchHistoryPanel

### Milestone 3: Observabilidade e Monitoramento
- Dashboard de saúde do agente (latência, tokens, error rates)
- Alertas automáticos (circuit breaker, taxa de erro)
- Tracing distribuído end-to-end

### Milestone 4: Escalabilidade
- Particionamento de tabelas (conversations, messages)
- Cache layer (knowledge base, catálogo)
- Worker dedicado para transcrição

### Milestone 5: Feature Expansion
- Multi-modelo por agente
- A/B testing de prompts
- Analytics avançado (sentiment, topic clustering)

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. LLM + Circuit Breaker | v1.0 | 2/2 | ✅ Complete | 2026-03-29 |
| 2. Webhook + Greeting | v1.0 | 2/2 | ✅ Complete | 2026-03-29 |
| 3. Form Validation | v1.0 | 1/1 | ✅ Complete | 2026-03-29 |
| 4. Component Decomposition | v1.0 | 2/2 | ✅ Complete | 2026-03-30 |
| 5. Strict Typing | v1.0 | 3/3 | ✅ Complete | 2026-03-30 |
| 6. Data Fetching + ErrorBoundary | v1.0 | 3/3 | ✅ Complete | 2026-03-30 |
| 7. Backend Helpers Consolidation | v1.0 | 4/4 | ✅ Complete | 2026-03-30 |
| M2 Pre-requisitos | M2 Agent QA | — | ✅ Complete | 2026-04-04 |
| M2 F1: Batch History | M2 Agent QA | 1/4 | ✅ Complete | 2026-04-04 |
| M2 F2: Approval Flow | M2 Agent QA | 2/4 | 📋 Pending | — |
| M2 F3: Score Bar | M2 Agent QA | 3/4 | 📋 Pending | — |
| M2 F4: Auto Cycle | M2 Agent QA | 4/4 | 📋 Pending | — |
