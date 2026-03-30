---
phase: 07-consolidacao-de-helpers-e-reducao-de-duplicacao-backend
plan: "02"
subsystem: edge-functions
tags: [refactor, edge-functions, shared-utilities, dedup-removal]
dependency_graph:
  requires: ["07-01"]
  provides: ["supabaseClient-adoption-14-functions", "response-helper-adoption-14-functions", "logger-adoption-14-functions"]
  affects: ["all-14-small-edge-functions"]
tech_stack:
  added: []
  patterns:
    - "createServiceClient() / createUserClient(req) from _shared/supabaseClient.ts"
    - "successResponse() / errorResponse() from _shared/response.ts"
    - "createLogger() from _shared/logger.ts"
    - "unauthorizedResponse() from _shared/auth.ts"
key_files:
  created: []
  modified:
    - supabase/functions/health-check/index.ts
    - supabase/functions/cleanup-old-media/index.ts
    - supabase/functions/group-reasons/index.ts
    - supabase/functions/process-jobs/index.ts
    - supabase/functions/e2e-test/index.ts
    - supabase/functions/scrape-product/index.ts
    - supabase/functions/ai-agent-debounce/index.ts
    - supabase/functions/database-backup/index.ts
    - supabase/functions/activate-ia/index.ts
    - supabase/functions/admin-create-user/index.ts
    - supabase/functions/admin-delete-user/index.ts
    - supabase/functions/admin-update-user/index.ts
    - supabase/functions/go/index.ts
    - supabase/functions/fire-outgoing-webhook/index.ts
decisions:
  - "go/index.ts preserves HTML/text/plain responses — only logger added, no successResponse (non-JSON endpoint)"
  - "health-check preserves custom 200/503 response shape — successResponse not used (health check has non-standard body)"
  - "scrape-product has no Supabase client — skipped supabaseClient migration, only added response + logger"
  - "group-reasons has no Supabase client — skipped supabaseClient migration, only added response + logger"
  - "ai-agent-debounce and process-jobs already had createLogger — only migrated client + responses"
  - "database-backup.createUserClient(req): getUser() called without token arg — relies on Authorization header set internally"
  - "activate-ia keeps explicit token extraction for getUser(token) call — matches original behavior"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-30"
  tasks_completed: 2
  files_modified: 14
---

# Phase 07 Plan 02: Migrate 14 Small Functions to Shared Utilities Summary

**One-liner:** Eliminated ~60% of duplicated boilerplate in 14 edge functions by migrating to centralized supabaseClient.ts, response.ts, and logger.ts shared utilities.

## What Was Done

Migrated all 14 edge functions (all under 250 LOC) from inline boilerplate patterns to shared utilities created in Plan 01:

### Task 1: 7 Simple Service-Client Functions
- **health-check**: Module-level `createServiceClient()` replaces inline `createClient(url, key)`. Logger added. Custom 200/503 response shape preserved (not wrapped in successResponse).
- **cleanup-old-media**: `createServiceClient()` inside handler. All `console.log/error` replaced with `log.info/error`. `successResponse`/`errorResponse` used.
- **group-reasons**: No Supabase client — only added `successResponse`/`errorResponse` + `createLogger`. `console.error` calls migrated to structured logger.
- **process-jobs**: Already had `createLogger`. Module-level `createServiceClient()` replaces `createClient`. 401 inline response replaced with `errorResponse`. Success response wrapped in `successResponse`.
- **e2e-test**: Module-level `createServiceClient()`. All inline `new Response(JSON.stringify(...))` calls replaced. `console.error` migrated to structured logger.
- **scrape-product**: No Supabase client (confirmed by reading file). Only added `successResponse`/`errorResponse` + `createLogger`. `console.error` migrated.
- **ai-agent-debounce**: Already had `createLogger`. Module-level `createServiceClient()`. All `console.log/warn/error` replaced with structured logger calls.

### Task 2: 7 User/Dual-Client Functions
- **database-backup**: Dual-client — `createUserClient(req)` for user auth + `createServiceClient()` for admin ops. `console.error` migrated. `unauthorizedResponse` used for 401s.
- **activate-ia**: Dual-client — `createUserClient(req)` for auth verification + `createServiceClient()` for instance access check. `console.log/error` migrated.
- **admin-create-user**: `createUserClient(req)` for super_admin check + `createServiceClient()` for auth.admin operations. `console.error` migrated. `unauthorizedResponse` used.
- **admin-delete-user**: Same dual-client pattern as admin-create-user. `console.error` migrated.
- **admin-update-user**: Same dual-client pattern. `console.error` migrated, profile error now uses `log.warn`.
- **go** (UTM redirect): `createServiceClient()`. HTML/text responses preserved as-is (non-JSON endpoint). Only logger added. `console.error` migrated.
- **fire-outgoing-webhook**: `createUserClient(req)` for user auth. `successResponse`/`errorResponse` used. `console.error` migrated.

## Verification

All acceptance criteria met:
- Zero `createClient` from `esm.sh` across all 14 files
- Zero `console.log/error/warn` across all 14 files (all migrated to structured logger)
- OPTIONS preflight responses preserved (`new Response(null, { headers: corsHeaders })`)
- `go/index.ts` HTML/text responses preserved (non-JSON endpoint)
- `health-check` custom 200/503 shape preserved
- All 198 tests pass (22 test files, 3 skipped)

## Deviations from Plan

None — plan executed exactly as written.

**Special handling notes (within plan scope):**
- `health-check`: Plan noted "preserve exact response shapes" — kept raw `new Response(JSON.stringify(body), { status: allOk ? 200 : 503 })` instead of `successResponse` since the status code is dynamic (200 or 503) and the body shape is non-standard.
- `go`: All responses are HTML/text/plain — no JSON responses to convert. Logger added, `createServiceClient()` applied. Plan noted "only convert JSON error responses to errorResponse()" — go had no JSON responses at all.
- `database-backup`: `createUserClient(req)` extracts Authorization header internally per supabaseClient.ts implementation. The `auth.getUser()` call (without token arg) works because the Authorization header is propagated as a global header to the Supabase client.
- `activate-ia`: Kept explicit `authHeader.replace('Bearer ', '')` + `getUser(token)` pattern to match original behavior exactly.

## Known Stubs

None — all 14 functions are fully wired. No placeholder data flows to UI.

## Self-Check

All committed files verified below.
