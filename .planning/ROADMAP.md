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

### Milestone 2: Agent QA Framework
- Fluxo de aprovação admin no Playground
- Histórico persistente de batches entre deploys
- Barra de evolução do agente (score composto)
- Ciclo automatizado teste → ajuste → re-teste

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
