---
phase: 01-blindagem-llm-circuit-breaker
plan: "02"
subsystem: api
tags: [ai-agent, tool-isolation, token-ceiling, correlation-id, structured-logging, vitest]

requires:
  - 01-01 (shadow mode uses callLLM, CircuitBreaker tests, vitest config extended)

provides:
  - executeToolSafe wrapper isolates tool exceptions from LLM retry loop in ai-agent
  - MAX_ACCUMULATED_INPUT_TOKENS=8192 ceiling prevents unbounded context growth in tool loop
  - request_id correlation ID flows from ai-agent-debounce to ai-agent in JSON body
  - Structured logging (createLogger) replaces raw console calls in main LLM loop and debounce
  - aiRuntime.test.ts with 13 tests (10 aiRuntime helpers + 3 executeToolSafe pattern tests)

affects:
  - ai-agent
  - ai-agent-debounce
  - aiRuntime tests

tech-stack:
  added: []
  patterns:
    - "All tool calls in ai-agent loop MUST go through executeToolSafe — never direct executeTool in the while loop"
    - "Token context trimming: keep last 6 messages when totalInputTokens > 8192 and toolRounds >= 1"
    - "Correlation ID: generated in debounce as crypto.randomUUID(), passed as request_id to ai-agent, used in createLogger"

key-files:
  created:
    - supabase/functions/_shared/aiRuntime.test.ts
  modified:
    - supabase/functions/ai-agent/index.ts
    - supabase/functions/ai-agent-debounce/index.ts

key-decisions:
  - "executeToolSafe returns a Portuguese error string to the LLM on exception — LLM can still respond without the tool result"
  - "Token ceiling trims to last 6 messages (3 pairs) rather than breaking the loop — preserves recent context while staying within bounds"
  - "request_id is passed on both initial and retry calls from debounce — same ID for full traceability in 5xx retry scenario"
  - "executeToolSafe tested via pattern replica (not direct import) since it is an inline function inside Deno.serve handler"

requirements-completed: [P1-03, P1-04, P1-05]

duration: 12min
completed: 2026-03-29
---

# Phase 01 Plan 02: Tool Execution Isolation + Token Ceiling + Correlation IDs Summary

**executeToolSafe wrapper isolates DB/network tool exceptions from LLM retries, MAX_ACCUMULATED_INPUT_TOKENS=8192 ceiling trims context after 8192 accumulated input tokens, and request_id correlation IDs flow from debounce through ai-agent with structured JSON logging**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-29T11:50:00Z
- **Completed:** 2026-03-29T12:02:00Z
- **Tasks:** 2
- **Files modified:** 3 (ai-agent/index.ts, ai-agent-debounce/index.ts, _shared/aiRuntime.test.ts)

## Accomplishments

- Eliminated P1-03 defect: tool exceptions (DB, network) no longer trigger LLM retries — they return a graceful Portuguese error string that the LLM can use to continue the conversation
- Added P1-04 token ceiling: `MAX_ACCUMULATED_INPUT_TOKENS = 8192` with context trimming (keep last 6 messages) when ceiling is exceeded after at least 1 tool round
- Implemented P1-05 correlation IDs: `request_id` generated in `ai-agent-debounce` via `crypto.randomUUID()`, passed to `ai-agent` in the JSON body (both initial and retry calls), used as the logger request ID
- Structured logging via `createLogger` replaces raw `console.log/warn/error` in the main LLM loop and `processAfterDelay` closure
- Created `aiRuntime.test.ts` with 13 tests: 10 original aiRuntime helper tests (from main branch) + 3 new `executeToolSafe` pattern tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add executeToolSafe wrapper, token ceiling, correlation ID to ai-agent** - `f0586a9` (feat)
2. **Task 2: Wire correlation ID from debounce to ai-agent, add executeToolSafe tests** - `497ee3d` (feat)

## Files Created/Modified

- `supabase/functions/ai-agent/index.ts` - Added `import { createLogger }`, `request_id` extraction, `executeToolSafe` wrapper after `executeTool`, `MAX_ACCUMULATED_INPUT_TOKENS` constant, `totalInputTokens` accumulator with ceiling check, replaced console calls in main loop with `log.info/warn/error`
- `supabase/functions/ai-agent-debounce/index.ts` - Added `import { createLogger }`, `request_id = crypto.randomUUID()`, `log = createLogger(...)`, `request_id` in both ai-agent fetch bodies, replaced console calls in `processAfterDelay` with `log.info/warn/error`
- `supabase/functions/_shared/aiRuntime.test.ts` - 13 unit tests: aiRuntime helpers (createQueuedMessage, buildLegacyQueueUpdate, resolveNextFollowUpStep, formatFollowUpMessage, shouldTriggerAiAgentFromWebhook) + executeToolSafe pattern (success, exception isolation, meaningful error string)

## Test Results

- `npx vitest run supabase/functions/_shared/` — 24 tests pass (11 CircuitBreaker + 13 aiRuntime)
- `npx vitest run` — 148 tests pass across 16 test files (no regressions)

## Decisions Made

- `executeToolSafe` returns `"Erro interno ao executar ${name}. Responda ao lead sem usar este resultado."` — Portuguese because it is fed back to the LLM as a tool result and should be in the same language as the conversation
- Token ceiling of 8192 is intentionally conservative — it triggers context trimming (not loop break) so the LLM still gets a chance to respond
- `request_id` is the same UUID on retry (5xx scenario) — this enables correlation of the full retry chain in logs
- `executeToolSafe` tested via inline pattern replica (not import) because it is defined inside the `Deno.serve` handler closure and cannot be imported

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing 01-01 changes**
- **Found during:** Start of execution
- **Issue:** The worktree branch `worktree-agent-a22fdf48` was branched before the 01-01 commits landed on master, so the shadow mode refactoring and circuitBreaker.test.ts were absent
- **Fix:** `git merge master` (fast-forward merge) — brought in 01-01 changes before proceeding
- **Files affected:** supabase/functions/ai-agent/index.ts, supabase/functions/_shared/circuitBreaker.test.ts, vitest.config.ts, .planning/* files
- **Impact:** Required; no scope change

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required git merge to bring worktree up to date with master. No scope creep.

## Known Stubs

None — all changes are wired to production code paths.

## Issues Encountered

None beyond the worktree merge documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- P1-03, P1-04, P1-05 resolved
- Phase 1 (Blindagem do LLM Provider e Circuit Breaker) complete — both plans done
- Ready for Phase 2: Blindagem do Webhook e Dedup de Greeting
- All 24 shared-function tests passing; all 148 suite tests passing

---
*Phase: 01-blindagem-llm-circuit-breaker*
*Completed: 2026-03-29*
