---
phase: 2
slug: blindagem-do-webhook-e-dedup-de-greeting
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-29
---

# Phase 2 — Validation Strategy

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
| 02-T1 | greeting dedup fallback | 1 | DT-03 | unit | `npx vitest run supabase/functions/_shared/__tests__/ --reporter=verbose` | ❌ Wave 0 |  ⬜ pending |
| 02-T2 | job_queue transcription | 2 | DT-04 | integration | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 02-T3 | atomic msg counter | 2 | DT-07 | unit | `npx vitest run supabase/functions/_shared/__tests__/ --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 02-T4 | mergeTags migration | 1 | DT-13 | unit | `npx vitest run supabase/functions/_shared/__tests__/ --reporter=verbose` | ✅ exists | ⬜ pending |
| 02-T5 | unauthorizedResponse | 1 | DT-09 | unit | `npx vitest run --reporter=verbose` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `supabase/functions/_shared/agentHelpers.test.ts` — criado por 02-01 Task 1 (TDD). Inclui:
  - 4 testes ativos de `mergeTags`
  - 3 stubs `describe.skip` para `handleGreetingRpcError` (ativados em Task 2)
- [x] Atomic counter — verificação manual (RPC de DB, não unit-testável sem banco)

*Wave 0 coberto pelo TDD de 02-01 Task 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| job_queue transcription executa no process-jobs | DT-04 | Requer infra de banco real | Inserir job manual + verificar status via SELECT |
| Greeting não duplica em requests simultâneos | DT-03 | Requer concorrência real | Enviar 2 requests simultâneos ao ai-agent para a mesma conversation_id |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
