---
phase: 07-consolidacao-de-helpers-e-reducao-de-duplicacao-backend
plan: "03"
subsystem: edge-functions
tags: [refactor, supabase, edge-functions, shared-utilities, logging]
dependency_graph:
  requires: ["07-01"]
  provides: ["07-03"]
  affects: [process-follow-ups, scrape-products-batch, auto-summarize, process-scheduled-messages, e2e-scheduled, summarize-conversation, analyze-summaries, ai-agent-playground, sync-conversations, send-shift-report]
tech_stack:
  added: []
  patterns: [createServiceClient, createUserClient, successResponse, errorResponse, createLogger]
key_files:
  created: []
  modified:
    - supabase/functions/process-follow-ups/index.ts
    - supabase/functions/scrape-products-batch/index.ts
    - supabase/functions/auto-summarize/index.ts
    - supabase/functions/process-scheduled-messages/index.ts
    - supabase/functions/e2e-scheduled/index.ts
    - supabase/functions/summarize-conversation/index.ts
    - supabase/functions/analyze-summaries/index.ts
    - supabase/functions/ai-agent-playground/index.ts
    - supabase/functions/sync-conversations/index.ts
    - supabase/functions/send-shift-report/index.ts
decisions:
  - "process-scheduled-messages preserved raw REST API pattern (fetchWithTimeout to /rest/v1/) — original design used direct HTTP for its PATCH operations rather than the SDK client; added response helpers + logger without forcing SDK refactor"
  - "analyze-summaries: GROQ_API_KEY read inside handler body (not module-level const) — avoids stale closure when env changes between requests"
  - "sync-conversations: renamed module-level variable from serviceClient to serviceClient (was duplicate with request-level supabase = createUserClient(req)) — cleaner dual-client naming"
  - "ai-agent-playground: removed SUPABASE_URL + SERVICE_ROLE_KEY module-level consts after migration to createServiceClient(); still needed SUPABASE_URL for e2e-scheduled fetch to /functions/v1/e2e-test"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 10
---

# Phase 07 Plan 03: Migrate 10 Medium Edge Functions to Shared Utilities Summary

Migrated 10 medium-sized edge functions (242-414 LOC) from inline client creation and raw Response construction to centralized `createServiceClient`/`createUserClient`, `successResponse`/`errorResponse`, and `createLogger` shared utilities.

## What Was Done

### Task 1: 5 Background/Cron Functions (commit 704b878)

- **process-follow-ups**: Replaced `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` with `createServiceClient()`. All `console.log/error/warn` replaced with `log.info/error/warn` structured entries. Raw `new Response(JSON.stringify(...))` replaced with `successResponse`/`errorResponse`.
- **scrape-products-batch**: Same transformation. Preserved background `processJob()` fire-and-forget pattern. `any` in `imgs.filter((i: any))` narrowed to `(i: unknown)`.
- **auto-summarize**: Removed `serve` import from `deno.land/std`. `createServiceClient()` at module level. All 12 inline Response constructions replaced. `catch(e)` → `catch` (unused binding).
- **process-scheduled-messages**: Original function used raw `fetchWithTimeout` to Supabase REST API rather than the SDK (special pattern). Added `createLogger` + `successResponse`/`errorResponse` without forcing an SDK migration on those REST calls.
- **e2e-scheduled**: `createServiceClient()` + response helpers + logger. `any` types in scenario/result handling replaced with `Record<string, unknown>`. Still reads `SUPABASE_URL` + `SERVICE_ROLE_KEY` as consts for the direct `/functions/v1/e2e-test` fetch call.

### Task 2: 5 Mixed-Client Functions (commit 4e05fba)

- **summarize-conversation**: Removed `serve` import. `createUserClient(req)` for auth verification, `createServiceClient()` (module-level `serviceSupabase`) for writes. 16 response helper calls.
- **analyze-summaries**: `createUserClient(req)` + module-level `createServiceClient()`. `GROQ_API_KEY` moved inside handler body. `any` casts replaced with typed `Record<string, string/unknown>`.
- **ai-agent-playground**: `createServiceClient()` replaces inline `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`. All tool function parameters typed as `Record<string, unknown>` instead of `any`. Response helpers + logger added.
- **sync-conversations**: `createUserClient(req)` for auth/RLS + `serviceClient` (module-level `createServiceClient()`) for instance token lookup. All `console.log/error` replaced. `successResponse`/`errorResponse` throughout.
- **send-shift-report**: Removed `serve` import. `createServiceClient()` (module-level `serviceSupabase`) + `createUserClient(req)` for manual trigger path. `processShiftReport` parameter typed as `Record<string, unknown>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing typing] scrape-products-batch imgs.filter type narrowed**
- **Found during:** Task 1 migration
- **Issue:** `imgs.filter((i: any) => ...)` used `any` cast
- **Fix:** Changed to `(i: unknown)` with explicit `(i as string).startsWith()`
- **Files modified:** supabase/functions/scrape-products-batch/index.ts
- **Commit:** 704b878

**2. [Rule 2 - Missing typing] analyze-summaries Record types for any casts**
- **Found during:** Task 2 migration
- **Issue:** Multiple `as any` casts for AI response parsing and conversation maps
- **Fix:** Replaced with `Record<string, string>`, `Record<string, unknown>`, `Array<Record<string, unknown>>`
- **Files modified:** supabase/functions/analyze-summaries/index.ts
- **Commit:** 4e05fba

**3. [Rule 1 - Unused import] ai-agent-playground buildPlaygroundResponse removed**
- **Found during:** Task 2 migration — import in original file was unused
- **Fix:** Removed from import list (was in the original but never called in the file)
- **Files modified:** supabase/functions/ai-agent-playground/index.ts
- **Commit:** 4e05fba

## Verification Results

All 10 functions verified against acceptance criteria:
- Zero `createClient.*esm.sh` in any of the 10 files
- All 10 have `successResponse|errorResponse` (minimum 3 occurrences each)
- All 10 have `createLogger` (2 occurrences = import + instantiation)
- 9/10 have `createServiceClient` (process-scheduled-messages uses raw REST pattern — no SDK client needed)
- 5/10 have `createUserClient` (the dual-client functions)
- All 198 tests pass, 3 skipped (pre-existing)

## Self-Check

Files exist:
- supabase/functions/process-follow-ups/index.ts: MODIFIED
- supabase/functions/scrape-products-batch/index.ts: MODIFIED
- supabase/functions/auto-summarize/index.ts: MODIFIED
- supabase/functions/process-scheduled-messages/index.ts: MODIFIED
- supabase/functions/e2e-scheduled/index.ts: MODIFIED
- supabase/functions/summarize-conversation/index.ts: MODIFIED
- supabase/functions/analyze-summaries/index.ts: MODIFIED
- supabase/functions/ai-agent-playground/index.ts: MODIFIED
- supabase/functions/sync-conversations/index.ts: MODIFIED
- supabase/functions/send-shift-report/index.ts: MODIFIED

Commits exist: 704b878, 4e05fba

## Self-Check: PASSED
