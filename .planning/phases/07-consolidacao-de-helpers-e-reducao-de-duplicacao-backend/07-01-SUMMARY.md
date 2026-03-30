---
phase: 07-consolidacao-de-helpers-e-reducao-de-duplicacao-backend
plan: "01"
subsystem: backend-shared
tags: [shared-modules, supabase-client, carousel, llm-metrics, refactor]

dependency_graph:
  requires: []
  provides:
    - supabase/functions/_shared/supabaseClient.ts
    - supabase/functions/_shared/carousel.ts
  affects:
    - supabase/functions/_shared/auth.ts
    - supabase/functions/_shared/llmProvider.ts
    - all edge functions that use createClient inline (D-01 migration targets)

tech_stack:
  added:
    - supabaseClient.ts: createServiceClient() + createUserClient() factory pattern
    - carousel.ts: LRU-cached AI copy generation chain (Groq → Gemini → static)
  patterns:
    - D-01: centralized Supabase client factory (DRY — eliminates 20+ inline createClient)
    - D-03: carousel logic extracted from ai-agent to shared module
    - D-05: LLM latency_ms telemetry in LLMResponse interface

key_files:
  created:
    - supabase/functions/_shared/supabaseClient.ts
    - supabase/functions/_shared/supabaseClient.test.ts
    - supabase/functions/_shared/carousel.ts
    - supabase/functions/_shared/carousel.test.ts
  modified:
    - supabase/functions/_shared/auth.ts
    - supabase/functions/_shared/llmProvider.ts

decisions:
  - "createUserClient(req) extracts Authorization header internally — token still extracted separately in verifyAuth for supabase.auth.getUser(token)"
  - "API keys read inside generateCarouselCopies() body (not module-level) — avoids stale closure when Deno isolate env changes between requests (RESEARCH pitfall 3)"
  - "vi.mock('https://esm.sh/@supabase/supabase-js@2') required in supabaseClient.test.ts — Node ESM loader cannot fetch https:// URLs"
  - "createLogger('auth') instantiated inside verifyCronOrService() call (not module-level) — consistent with per-request logging pattern"
  - "latency_ms added to both callOpenAI and callGemini independently — callLLM does not need changes since it returns the result as-is"

metrics:
  duration_seconds: 621
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
  tests_added: 25
  tests_total: 198
  completed_date: "2026-03-30"
---

# Phase 07 Plan 01: Foundational Shared Modules (supabaseClient + carousel + LLM metrics) Summary

**One-liner:** Centralized Supabase client factory (`createServiceClient`/`createUserClient`) + extracted carousel AI copy chain with LRU cache + LLM latency telemetry, establishing D-01/D-03/D-05 import targets before 28-function migration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create supabaseClient.ts + carousel.ts + unit tests | f859e39 | _shared/supabaseClient.ts, supabaseClient.test.ts, carousel.ts, carousel.test.ts |
| 2 | Update auth.ts + add LLM metrics to llmProvider.ts | 78f7c6f | _shared/auth.ts, _shared/llmProvider.ts |

## What Was Built

### supabaseClient.ts (D-01)

Two factory functions eliminating repeated `createClient(url, key)` calls:
- `createServiceClient()`: SERVICE_ROLE_KEY client for admin/RLS-bypass operations
- `createUserClient(req)`: ANON_KEY + user JWT client for RLS-scoped operations

This is the import target that subsequent plans (07-02 through 07-07) will use to migrate the remaining 20+ edge functions.

### carousel.ts (D-03)

Full carousel logic extracted from `ai-agent/index.ts` lines 19-148:
- `cleanProductTitle(title)`: removes redundant brand segments using 3-word subsequence overlap detection
- `generateCarouselCopies(product, numCards)`: Groq → Gemini → static fallback chain with 2s timeout per provider
- `parseCopyResponse(text, count)`: JSON array extractor from LLM freetext response
- LRU cache: 200 entries max, 24h TTL, evicts oldest on overflow
- Exports: `cleanProductTitle`, `generateCarouselCopies`, `parseCopyResponse`, `buildCarousel`, `CAROUSEL_CACHE_TTL_MS`, `CAROUSEL_CACHE_MAX_SIZE`

### auth.ts (D-01 prerequisite)

Migrated 2 inline `createClient` calls to factory:
- `verifyAuth()`: `createClient(url, anon, {Authorization})` → `createUserClient(req)`
- `verifySuperAdmin()`: `createClient(url, service)` → `createServiceClient()`
- `verifyCronOrService()`: 3 `console.error/log` → `createLogger('auth')` structured output

Zero inline `createClient` remaining in auth.ts.

### llmProvider.ts (D-05)

- Added `latency_ms: number` to `LLMResponse` interface
- `callOpenAI()`: `const startMs = Date.now()` at top, `latency_ms: Date.now() - startMs` in return
- `callGemini()`: same pattern
- 3 `console.warn` → `log.warn()` structured logging via `createLogger('llm-provider')`

## Test Results

- **25 new tests** added (5 supabaseClient + 20 carousel)
- **198 tests passing** total (3 skipped — same as pre-plan baseline)
- No regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node ESM loader cannot fetch https:// URLs in tests**
- **Found during:** Task 1 — supabaseClient.test.ts
- **Issue:** `supabaseClient.ts` imports from `https://esm.sh/@supabase/supabase-js@2`; Node's ESM loader throws `ERR_UNSUPPORTED_ESM_URL_SCHEME` when running tests
- **Fix:** Added `vi.mock('https://esm.sh/@supabase/supabase-js@2', ...)` at top of test file to provide a mock `createClient` that returns a stub Supabase client object
- **Files modified:** `supabase/functions/_shared/supabaseClient.test.ts`
- **Commit:** f859e39

## Known Stubs

None — all exports are fully implemented. `buildCarousel()` is a new utility added beyond the plan scope (minimal implementation, not used by existing code until 07-02+ migrations).

## Self-Check: PASSED
