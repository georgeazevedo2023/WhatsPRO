---
phase: 01-blindagem-llm-circuit-breaker
plan: "01"
subsystem: api
tags: [ai-agent, circuit-breaker, llm, openai, gemini, shadow-mode, vitest]

requires: []

provides:
  - Shadow mode in ai-agent uses callLLM() with automatic circuit breaker protection and OpenAI fallback
  - Shadow mode tool definitions use OpenAI JSON Schema format (lowercase types) via LLMToolDef[]
  - CircuitBreaker class has 11 unit tests covering all state transitions (CLOSED/OPEN/HALF_OPEN)
  - vitest.config.ts extended to include supabase/functions/_shared/**/*.test.ts
  - gpt-4.1-mini model ID confirmed valid with inline comment

affects:
  - 01-02-PLAN.md
  - ai-agent
  - llmProvider
  - circuitBreaker

tech-stack:
  added: []
  patterns:
    - "Shadow mode LLM calls route through callLLM() — never direct fetchWithTimeout to LLM providers"
    - "Tool definitions use OpenAI JSON Schema format (lowercase types) everywhere — callLLM converts to Gemini format internally"

key-files:
  created:
    - supabase/functions/_shared/circuitBreaker.test.ts
  modified:
    - supabase/functions/ai-agent/index.ts
    - vitest.config.ts

key-decisions:
  - "Shadow mode uses callLLM() with model: agent.model || 'gemini-2.5-flash' — routes Gemini-first when agent model is gemini-*, OpenAI-first otherwise"
  - "Shadow mode error is caught and logged (not re-thrown) because shadow extraction is non-critical — conversation continues regardless"
  - "gpt-4.1-mini confirmed as valid OpenAI model ID (released 2025-04-14)"
  - "vitest.config.ts extended to cover supabase/functions/_shared/ tests so CircuitBreaker can be tested in Node environment (no Deno deps)"

patterns-established:
  - "All LLM calls in ai-agent MUST route through callLLM() — no direct fetchWithTimeout to Gemini/OpenAI URLs"
  - "Tool definitions always use LLMToolDef[] with lowercase JSON Schema types"

requirements-completed: [DT-01, DT-02]

duration: 15min
completed: 2026-03-29
---

# Phase 01 Plan 01: Shadow Mode Circuit Breaker Fix + Model ID Audit + CB Unit Tests Summary

**Shadow mode refactored from direct Gemini fetchWithTimeout to callLLM() with automatic circuit breaker protection, OpenAI fallback, and LLMToolDef[] with lowercase JSON Schema; CircuitBreaker class now has 11 vitest unit tests covering all state transitions**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-29T11:30:00Z
- **Completed:** 2026-03-29T11:46:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Eliminated the DT-02 critical defect: shadow mode no longer bypasses the circuit breaker by calling Gemini directly
- Shadow mode now routes through callLLM() which provides automatic circuit breaker protection and OpenAI fallback chain
- Shadow tool definitions converted from Gemini-native uppercase types (OBJECT/ARRAY/STRING) to OpenAI JSON Schema lowercase (object/array/string) via LLMToolDef[]
- Confirmed and documented gpt-4.1-mini model ID validity (DT-01)
- Created 11 CircuitBreaker unit tests covering: CLOSED/OPEN/HALF_OPEN state machine, threshold behavior, time-based reset, reset(), and call() with/without fallback
- Extended vitest.config.ts to include supabase/functions/_shared/ test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor shadow mode to use callLLM() and confirm model ID** - `1c04c67` (feat)
2. **Task 2: Add CircuitBreaker unit tests** - `8014885` (test)

## Files Created/Modified
- `supabase/functions/ai-agent/index.ts` - Shadow mode block refactored: removed direct Gemini fetch, replaced with callLLM(); tool defs use LLMToolDef[] with lowercase types; gpt-4.1-mini comment added
- `supabase/functions/_shared/circuitBreaker.test.ts` - 11 unit tests for CircuitBreaker state machine (new)
- `vitest.config.ts` - Extended include pattern to cover supabase/functions/_shared/**/*.test.ts

## Decisions Made
- Shadow mode uses `agent.model || 'gemini-2.5-flash'` as the callLLM model: when agent.model is `gemini-*`, callLLM routes Gemini-first; when it is `gpt-4.1-mini`, callLLM routes OpenAI-first. Both paths have circuit breaker protection and the other provider as fallback.
- Shadow mode errors are caught and only logged (not re-thrown). Shadow extraction is best-effort — it should never block or fail the main conversation flow.
- Top-level `const GEMINI_API_KEY` at line 10 was kept because it is still used by carousel copy logic elsewhere in the file; only the shadow-mode-scoped usage was removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts include pattern update**
- **Found during:** Task 2 (CircuitBreaker unit tests)
- **Issue:** The worktree's vitest.config.ts only included `src/**/*.{test,spec}.{ts,tsx}` — running `npx vitest run supabase/functions/_shared/circuitBreaker.test.ts` would pass the file directly but it still needed the config update for consistency and for `npx vitest run` to discover it generically
- **Fix:** Added `"supabase/functions/_shared/**/*.{test,spec}.{ts,tsx}"` to the include array, matching the pattern already present in the main branch's vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** Tests pass with `npx vitest run supabase/functions/_shared/circuitBreaker.test.ts`
- **Committed in:** 8014885 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required update to test runner config so CircuitBreaker tests are discoverable. No scope creep.

## Issues Encountered
None beyond the vitest config update documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DT-01 and DT-02 resolved; shadow mode is now fully protected by circuit breaker
- Ready for 01-02-PLAN.md: Tool execution isolation + token ceiling + correlation IDs
- CircuitBreaker test infrastructure established as pattern for future LLM provider tests

---
*Phase: 01-blindagem-llm-circuit-breaker*
*Completed: 2026-03-29*
