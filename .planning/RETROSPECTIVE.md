# Retrospective — WhatsPRO

## Milestone: v1.0 — Refatoração e Blindagem do Módulo Agente IA

**Shipped:** 2026-04-04
**Phases:** 7 | **Plans:** 17 | **Commits:** ~210

### What Was Built
- Circuit breaker + LLM fallback chain blindado em todas as chamadas
- Webhook dedup + greeting race condition eliminada (advisory lock atômico)
- Zod validation em todos os formulários do AI Agent (4 schemas, 15 tests)
- Decomposição de monólitos (Playground 1353→276 LOC, Catalog 704→273 LOC)
- Tipagem estrita + noImplicitAny (erros TS 219→107)
- React Query migration + 9 ErrorBoundary wrappers
- 28 edge functions consolidadas em shared utilities (zero duplicação)

### What Worked
- **GSD workflow phases**: 7 fases em sequência lógica (backend crítico → frontend → tipagem → data fetching → consolidação)
- **Parallel plan execution**: múltiplos planos por fase aceleraram delivery
- **Shared utilities pattern**: supabaseClient.ts + response.ts + logger.ts eliminaram 60%+ de boilerplate
- **Zod-first validation**: schemas reutilizáveis que servem tanto para validação quanto para tipagem
- **Component decomposition strategy**: extrair tipos primeiro, depois sub-componentes, por último orquestrador

### What Was Inefficient
- **ROADMAP.md status desatualizado**: phases 3-7 marcadas "Em planejamento" mesmo após execução — tooling não atualizou automaticamente
- **One-liner extraction failures**: CLI summary-extract não conseguiu extrair one-liners de vários SUMMARY.md — formato inconsistente
- **No PROJECT.md from start**: projeto começou sem PROJECT.md, dificultando evolução de requirements

### Patterns Established
- `createServiceClient()` / `createUserClient()` para todas as edge functions
- `successResponse()` / `errorResponse()` com CORS padronizado
- `createLogger()` com structured JSON + correlation IDs
- `executeToolSafe()` wrapper para tool isolation
- ErrorBoundary granular por seção (não por página inteira)
- React Query keys como constantes exportadas (DASHBOARD_KEYS, etc.)

### Key Lessons
1. **Consolidar shared utilities PRIMEIRO** — deveria ter sido Phase 1, não 7. Todas as fases anteriores duplicaram código que depois foi consolidado.
2. **noImplicitAny > strict:true** — habilitar strict em projeto existente gera centenas de erros fora de escopo. noImplicitAny dá 80% do benefício com 20% do esforço.
3. **Form validation precisa de Zod desde o início** — dados inválidos no banco causam bugs downstream difíceis de rastrear.
4. **React Query elimina classes inteiras de bugs** — stale data, loading states inconsistentes, cache invalidation manual.
5. **Component decomposition threshold**: >500 LOC = extrair sub-componentes. >300 LOC = avaliar.

### Cost Observations
- Model mix: ~70% sonnet (executor), ~20% opus (planner), ~10% haiku (research)
- Sessions: ~15 sessions across 2 days of GSD execution
- Notable: Phase 7 (4 plans, 28 functions) was most complex but ran smoothly due to established patterns

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 7 |
| Plans | 17 |
| Commits | ~210 |
| TypeScript LOC | 68,884 |
| TS Errors (start → end) | 219 → 107 |
| Test Count | 198+ |
| Edge Functions | 28 |
