---
phase: 1
slug: blindagem-llm-circuit-breaker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/test supabase/functions/_shared/aiRuntime.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/functions/_shared/aiRuntime.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DT-01 (model audit) | manual | grep `gpt-4.1-mini` llmProvider.ts | N/A | pending |
| 01-01-02 | 01 | 1 | DT-02 (shadow CB) | unit | `npx vitest run aiRuntime.test.ts` | partial | pending |
| 01-02-01 | 02 | 1 | DT-03 (tool isolation) | unit | `npx vitest run aiRuntime.test.ts` | partial | pending |
| 01-02-02 | 02 | 1 | DT-14 (correlation ID) | integration | grep `request_id` in logs | N/A | pending |
| 01-03-01 | 03 | 2 | DT-04 (max-tokens) | unit | `npx vitest run aiRuntime.test.ts` | partial | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/aiRuntime.test.ts` — extend existing tests for shadow mode CB, tool isolation, correlation ID
- [ ] Verify vitest can import Deno edge function modules (may need mocking)

*Existing test file aiRuntime.test.ts already exists — extend rather than create.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shadow mode uses circuit breaker in production | DT-02 | Requires live Gemini API | Deploy to staging, trigger shadow mode, check logs for callLLM path |
| Correlation ID propagates debounce to agent | DT-14 | Requires multi-function invocation | Trigger debounce, verify request_id in both function logs |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
