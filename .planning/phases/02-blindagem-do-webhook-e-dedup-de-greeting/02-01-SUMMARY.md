---
phase: 02-blindagem-do-webhook-e-dedup-de-greeting
plan: "01"
subsystem: ai-agent / whatsapp-webhook / shared
tags: [greeting-dedup, shared-helpers, unauthorized-response, unit-tests, tdd]
dependency_graph:
  requires: []
  provides: [mergeTags-shared, greeting-rpc-error-path, standardized-401]
  affects: [ai-agent, whatsapp-webhook, agentHelpers]
tech_stack:
  added: []
  patterns: [TDD RED/GREEN, shared utility extraction, Result destructuring]
key_files:
  created:
    - supabase/functions/_shared/agentHelpers.test.ts
  modified:
    - supabase/functions/_shared/agentHelpers.ts
    - supabase/functions/ai-agent/index.ts
    - supabase/functions/whatsapp-webhook/index.ts
decisions:
  - mergeTags and escapeLike both moved to agentHelpers — single source of truth for all edge functions
  - greeting_rpc_error is a distinct code path from greeting_duplicate so observability tools can differentiate DB failures from legitimate dedup
  - unauthorizedResponse() used everywhere — no more inline 401 construction
metrics:
  duration_seconds: 352
  completed_date: "2026-03-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 02 Plan 01: Greeting Dedup Fallback + mergeTags Migration + 401 Standardization Summary

**One-liner:** Resolved DT-03 (greeting RPC error now skips with distinct reason), DT-13 (mergeTags migrated from ai-agent to shared agentHelpers), and DT-09 partial (both ai-agent and whatsapp-webhook now use unauthorizedResponse() helper instead of inline 401 construction).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move mergeTags to shared agentHelpers + unit tests | `2b65a59` | agentHelpers.ts, agentHelpers.test.ts, ai-agent/index.ts |
| 2 | Add greeting dedup fallback + standardize unauthorized responses | `8cc2a0c` | ai-agent/index.ts, whatsapp-webhook/index.ts |

## What Was Built

### Task 1: mergeTags migration + unit tests (TDD)

- **mergeTags** exported from `_shared/agentHelpers.ts` — was a local-only function in ai-agent
- **escapeLike** was already in agentHelpers but duplicated locally in ai-agent — duplicate removed
- **`_shared/agentHelpers.test.ts`** created with 4 mergeTags unit tests:
  - Add tag to empty array
  - Replace existing key value
  - Add multiple new tags
  - Empty inputs return empty
- 3 `describe.skip` stubs for `handleGreetingRpcError` (Wave 0 placeholders)
- All 5 mergeTags call sites in ai-agent continue to work unchanged (same signature)

### Task 2: Greeting dedup fallback + standardized 401

- **DT-03 fixed**: `try_insert_greeting` RPC result now destructures `error: greetError` and checks it before checking `inserted`
  - If RPC fails: `log.warn(...)` + returns `{ reason: 'greeting_rpc_error' }` — skips greeting safely
  - If RPC succeeds but duplicate: existing `greeting_duplicate` path preserved unchanged
- **unauthorizedResponse()** now used in both:
  - `ai-agent/index.ts` — replaced inline `new Response(JSON.stringify({ error: 'Unauthorized' }), ...)`
  - `whatsapp-webhook/index.ts` — same replacement

## Verification

- `npx vitest run` — 158 passed, 3 skipped (stubs), 0 failures
- `npm run build` — compiled in 6.73s, no errors
- Single `mergeTags` definition across all edge functions (agentHelpers.ts:178)
- Both greeting reason codes confirmed present in ai-agent
- `unauthorizedResponse` import + usage confirmed in both files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] escapeLike also removed from ai-agent**
- **Found during:** Task 1
- **Issue:** `escapeLike` was defined locally in ai-agent AND exported from agentHelpers — same duplicate pattern as mergeTags
- **Fix:** Added `escapeLike` to the import from agentHelpers and removed the local function definition
- **Files modified:** supabase/functions/ai-agent/index.ts
- **Commit:** 2b65a59

## Known Stubs

- `describe.skip('handleGreetingRpcError')` in `agentHelpers.test.ts` — 3 stub tests skipped. `handleGreetingRpcError` function not yet extracted (Wave 0 placeholder per plan spec). No blocking impact — greeting dedup fallback is inline in ai-agent, stubs are documentation only.

## Self-Check: PASSED

- `supabase/functions/_shared/agentHelpers.test.ts` — FOUND
- `supabase/functions/_shared/agentHelpers.ts` (mergeTags export) — FOUND
- Commit `2b65a59` — FOUND
- Commit `8cc2a0c` — FOUND
