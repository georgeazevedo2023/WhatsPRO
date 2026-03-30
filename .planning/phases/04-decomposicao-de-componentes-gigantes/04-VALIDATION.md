---
phase: 4
slug: decomposicao-de-componentes-gigantes
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-T1 | Extrair tipos para playground.ts | 1 | D-07/D-15 | build | `npx tsc --noEmit` | ✅ exists (tsc) | ⬜ pending |
| 04-T2 | Extrair PlaygroundManualTab | 1 | D-03/D-12 | regression | `npx vitest run --reporter=verbose` | ✅ exists | ⬜ pending |
| 04-T3 | Extrair PlaygroundScenariosTab | 1 | D-03/D-12 | regression | `npx vitest run --reporter=verbose` | ✅ exists | ⬜ pending |
| 04-T4 | Extrair PlaygroundResultsTab + E2eTab | 1 | D-03/D-12 | regression | `npx vitest run --reporter=verbose` | ✅ exists | ⬜ pending |
| 04-T5 | Extrair CatalogTable + CatalogProductForm | 1 | D-09/D-13 | regression | `npx vitest run --reporter=verbose` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Nenhum novo arquivo de teste precisa ser criado antes da execução.

**Descoberta do researcher:** Os 7 arquivos de teste do Playground (`PlaygroundEdgeCases`, `PlaygroundScenarios`, etc.) importam exclusivamente de `_shared/agentHelpers.ts` — NÃO de `AIAgentPlayground.tsx`. A decisão D-08 (atualizar imports) tem trabalho mínimo ou nulo; o executor deve verificar com grep e documentar o resultado.

*Wave 0 status: complete — nenhum stub necessário.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AIAgentPlayground renderiza corretamente após extração | D-12 | Requer renderização DOM | Acessar /playground → trocar agentes → enviar mensagem → verificar chat funciona |
| CatalogConfig CRUD funciona após extração | D-13 | Requer renderização + Supabase | Acessar CatalogConfig → criar produto → editar → deletar → verificar persistência |
| Tabs do Playground navegam corretamente | D-03 | Requer interação DOM | Clicar em cada tab (Manual, Cenários, Resultados, E2E) → verificar que conteúdo correto renderiza |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
