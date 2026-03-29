---
phase: 02-blindagem-do-webhook-e-dedup-de-greeting
plan: "02"
subsystem: api
tags: [job_queue, atomic-counter, audio-transcription, postgresql, supabase, edge-functions]

# Dependency graph
requires:
  - phase: 02-01-blindagem-do-webhook-e-dedup-de-greeting
    provides: shared agentHelpers (mergeTags), unauthorizedResponse, greeting dedup fallback

provides:
  - conversations.lead_msg_count column with increment_lead_msg_count() RPC
  - Audio transcription routed through job_queue (max_retries=1)
  - process-jobs handles transcribe_audio job type
  - Lead message counter resets to 0 on ia_cleared
  - Retry-aware error handling in process-jobs (uses job.max_retries)

affects:
  - ai-agent
  - whatsapp-webhook
  - process-jobs
  - LeadDetail

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic column increment via RPC (increment_lead_msg_count) instead of COUNT(*) to eliminate race conditions"
    - "Job queue as async task dispatch: webhook inserts job, process-jobs executes with retry"
    - "max_retries field on job_queue rows drives retry policy per job type (not hardcoded)"

key-files:
  created:
    - supabase/migrations/20260329030000_add_lead_msg_count.sql
  modified:
    - supabase/functions/ai-agent/index.ts
    - supabase/functions/whatsapp-webhook/index.ts
    - supabase/functions/process-jobs/index.ts
    - src/pages/dashboard/LeadDetail.tsx

key-decisions:
  - "increment_lead_msg_count RPC does UPDATE...RETURNING so counter increment and read are atomic — no SELECT after UPDATE"
  - "counterErr fallback to 0 means rate limiting never crashes the ai-agent request"
  - "max_retries=1 on transcribe_audio jobs means 2 total attempts (attempt 0 + retry 1) before marking failed"
  - "job.max_retries ?? 3 preserves backward compatibility for lead_auto_add and profile_pic_fetch jobs"
  - "fetchWithTimeout kept in webhook import — still used by media download and profile pic endpoints"

patterns-established:
  - "Async side-effects in webhook use job_queue insert, never synchronous HTTP calls"
  - "Retry policy encoded in job row (max_retries), not hardcoded in handler"

requirements-completed: [P2-T2, P2-T3]

# Metrics
duration: 25min
completed: 2026-03-29
---

# Phase 02 Plan 02: Audio Transcription via job_queue + Atomic Lead Message Counter Summary

**Audio transcription routed through job_queue (max_retries=1) and lead message limit switched from COUNT(*) to atomic column increment, eliminating DT-04 and DT-07**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-29T15:40:00Z
- **Completed:** 2026-03-29T15:50:00Z
- **Tasks:** 2
- **Files modified:** 4 modified, 1 created

## Accomplishments
- Created migration adding `lead_msg_count INTEGER DEFAULT 0` column to conversations with `increment_lead_msg_count()` RPC that atomically increments and returns the new count
- Replaced COUNT(*) race condition in ai-agent with single atomic RPC call — DT-07 resolved
- Replaced 90s synchronous transcription call in webhook with a single `job_queue` insert — DT-04 resolved
- Added `processTranscribeAudio` handler to process-jobs that calls transcribe-audio with 90s timeout and proper error propagation
- Updated process-jobs error handler to respect `job.max_retries` per row instead of hardcoded `3`
- Added `lead_msg_count: 0` reset to LeadDetail ia_cleared action so counter restarts cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration + atomic lead message counter in ai-agent** - `9680bab` (feat)
2. **Task 2: Route audio transcription through job_queue** - `268ddf6` (feat)

## Files Created/Modified
- `supabase/migrations/20260329030000_add_lead_msg_count.sql` - Adds lead_msg_count column + increment_lead_msg_count() RPC
- `supabase/functions/ai-agent/index.ts` - Uses increment_lead_msg_count RPC instead of COUNT(*); counterErr fallback to 0
- `supabase/functions/whatsapp-webhook/index.ts` - Replaces 90s fetchWithTimeout with job_queue insert for transcribe_audio
- `supabase/functions/process-jobs/index.ts` - Adds fetchWithTimeout import, processTranscribeAudio handler, max_retries-aware retry logic
- `src/pages/dashboard/LeadDetail.tsx` - Adds lead_msg_count: 0 to ia_cleared update

## Decisions Made
- `increment_lead_msg_count` uses `UPDATE...RETURNING` so the increment and read are a single atomic operation — no separate SELECT needed
- `counterErr` fallback of `0` means if the RPC fails the ai-agent request continues normally (no crash). The counter may be slightly off in failure scenarios but rate limiting remains best-effort, not blocking
- `max_retries=1` for transcription jobs means 2 total attempts: the initial claim (attempts=0) plus one retry (attempts=1). When `job.attempts >= 1`, job is marked `failed`
- `job.max_retries ?? 3` preserves existing behavior for `lead_auto_add` and `profile_pic_fetch` jobs which have no max_retries in their rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The grep check for "count: 'exact', head: true" initially looked like a false positive (failure) but was correctly identified as matching `ai_agent_logs` queries (for playground), not the removed `conversation_messages` counter. No actual issue.

## User Setup Required

None - no external service configuration required. The migration `20260329030000_add_lead_msg_count.sql` must be applied to the database before deploying the edge functions.

## Next Phase Readiness
- Phase 02 plan 02 complete. DT-04 and DT-07 are now resolved.
- The `transcribe_audio` job type is handled by process-jobs. Ensure `process-jobs` cron is active so jobs are consumed.
- `increment_lead_msg_count` RPC requires the migration to be applied before deploying ai-agent.
- No blockers for subsequent phases.

---
*Phase: 02-blindagem-do-webhook-e-dedup-de-greeting*
*Completed: 2026-03-29*
