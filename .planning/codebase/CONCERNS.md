# Codebase Concerns

**Analysis Date:** 2026-04-04

## Build Health

**Status:** GREEN — build succeeds in 6.8s, 0 errors, 0 warnings.

**Tests:** All 198 pass, 3 skipped. No flaky tests detected.

**Bundle size highlights:**
- `vendor-pdf`: 593 kB (gzip 177 kB) — largest chunk, lazy-loaded
- `vendor-charts`: 410 kB (gzip 110 kB) — Recharts
- `vendor-xlsx`: 332 kB (gzip 113 kB) — XLSX export
- `HelpDesk`: 140 kB — largest app chunk
- `AIAgentConfig`: 152 kB — second largest
- `AIAgentPlayground`: 69 kB

No blockers for Milestone 2. Build is clean.

---

## Tech Debt

### HIGH: TypeScript Strict Mode Disabled

- Issue: `strict: false`, `strictNullChecks: false`, `noImplicitAny: false` in `tsconfig.json`. App-level `tsconfig.app.json` has `noImplicitAny: true` but `strict: false`.
- Files: `tsconfig.json`, `tsconfig.app.json`
- Impact: Null reference bugs in runtime that TS should catch at compile time. New QA Framework tables will have nullable columns (approval, approved_by, batch_id) that could silently be `undefined` without strictNullChecks.
- Fix approach: Not a blocker for M2, but all new code should explicitly handle null/undefined. Do NOT enable strict globally now — too many existing violations.

### HIGH: 38 Untracked Migration Files

- Issue: 38 migration files in `supabase/migrations/` are untracked (`??` in git). These include foundational tables (`01_enums_and_tables`, `02_functions`, `03_rls_enable`, etc.) alongside feature migrations.
- Files: `supabase/migrations/20260320005239_01_enums_and_tables.sql` through `supabase/migrations/20260329020000_add_openai_api_key_to_agents.sql` (38 files)
- Impact: New M2 migrations could conflict with untracked ones. If someone clones the repo, they miss 38 migrations. Risk of schema drift between environments.
- Fix approach: Commit all 38 untracked migrations BEFORE starting M2 work. Verify ordering has no conflicts. This is a prerequisite.

### HIGH: `supabase as any` Pattern in useCampaigns

- Issue: All 8 Supabase queries in `src/hooks/useCampaigns.ts` cast `supabase as any` to bypass type checking. This means the `utm_campaigns` table IS in types.ts but the hook bypasses it.
- Files: `src/hooks/useCampaigns.ts` (lines 12, 23, 58, 76, 95, 138, 163, 190)
- Impact: No compile-time validation of query shapes. Column renames or removals will break at runtime, not build time. If M2 adds similar patterns for `e2e_test_batches`, the problem compounds.
- Fix approach: Remove `as any` casts — `utm_campaigns` is already in `src/integrations/supabase/types.ts` (line 2507). For M2, ensure new tables are in types.ts BEFORE writing hooks.

### MEDIUM: ai-agent/index.ts is a 2458-Line Monolith

- Issue: The core AI Agent edge function is a single 2458-line file with 85 DB operations, 12 shared module imports, and deeply nested try-catch blocks.
- Files: `supabase/functions/ai-agent/index.ts`
- Impact: Adding M2 features (approval hooks, scoring callbacks) will make this file even harder to maintain. Changes have high regression risk. The function already hits Supabase's ~25s gateway timeout (documented in CLAUDE.md as "debounce NO RETRY on 500").
- Fix approach: For M2, add integration points (webhooks, event emitters) rather than more inline code. Long-term: extract tool handlers, prompt builder, and DB operations into separate modules under `_shared/`.

### MEDIUM: Playground Divergence from Production

- Issue: `ai-agent-playground/index.ts` (373 lines) "mirrors" production but is a separate implementation. It imports the same shared helpers but has its own request handling, tool execution loop, and response format.
- Files: `supabase/functions/ai-agent-playground/index.ts`, `supabase/functions/ai-agent/index.ts`
- Impact: M2 Playground approval flow will add more code to playground only. Every production ai-agent change must be manually replicated. Drift is already happening (playground is v4, production is v2/Sprint 3).
- Fix approach: For M2, consider extracting shared agent execution logic into `_shared/agentCore.ts` that both functions call. This reduces sync burden.

### MEDIUM: `e2e_test_batches` Table Missing from Types

- Issue: The migration `20260330180000_e2e_approval_and_batch.sql` adds `batch_id` column to `e2e_test_runs` but there is no `e2e_test_batches` table. Types.ts has `e2e_test_runs` but no batch table. M2 will need a dedicated batch table.
- Files: `src/integrations/supabase/types.ts`, `supabase/migrations/20260330180000_e2e_approval_and_batch.sql`
- Impact: M2 batch history feature needs a new table + migration + types.ts update. The current `batch_id` column is a loose text field with no FK constraint.
- Fix approach: Create `e2e_test_batches` table in M2's first migration, add FK from `e2e_test_runs.batch_id`, regenerate types.

### LOW: 56 `as any` / `: any` Occurrences Across 24 Files

- Issue: Scattered type-unsafe code in components and hooks.
- Files: `src/components/kanban/CardDetailSheet.tsx` (5), `src/components/leads/LeadHistorySection.tsx` (5), `src/components/admin/ai-agent/MetricsConfig.tsx` (3), `src/components/helpdesk/ContactInfoPanel.tsx` (3), and 20 others
- Impact: Runtime errors on data shape changes. Low immediate risk but creates maintenance burden.
- Fix approach: Address per-file when touching those files. Not a blocker.

---

## Security Considerations

### MEDIUM: Open RLS Policies on Internal Tables

- Risk: Several tables use `USING (true)` / `WITH CHECK (true)` RLS policies, effectively allowing any authenticated user to read/write.
- Files:
  - `supabase/migrations/20260401000000_phase1_validator_prompt_studio_foundation.sql` — `ai_agent_validations` FOR ALL USING (true)
  - `supabase/migrations/20260325095121_scrape_jobs.sql` — `scrape_jobs` FOR ALL USING (true)
  - `supabase/migrations/20260322021531_create_ai_agent_tables_v3.sql` — `ai_debounce_queue` FOR ALL USING (true)
  - `supabase/migrations/20260325080938_follow_up_cadences.sql` — `follow_up_cadences` USING (true)
- Current mitigation: These tables are accessed via service_role_key in edge functions, not directly from frontend. The `USING (true)` policy exists so service_role can operate without policy bypass.
- Recommendations: For M2, if `e2e_test_runs` or batch tables are queried from frontend (Playground UI), ensure RLS restricts to `super_admin` role only. Current e2e_test_runs already has proper super_admin SELECT policy.

### LOW: ai-agent Auth is Anon Key Check Only

- Risk: The ai-agent function validates caller by comparing Bearer token to `SUPABASE_ANON_KEY`. This is intentional (called by debounce/webhook, not users) but means anyone with the anon key can invoke it.
- Files: `supabase/functions/ai-agent/index.ts` (lines 44-49)
- Current mitigation: Anon key is public by design in Supabase. The function validates `agent_id`, `instance_id`, and `conversation_id` exist in DB before processing. `verify_jwt = false` is correct for internal functions.
- Recommendations: No change needed for M2. Document this pattern for new edge functions.

---

## Performance Bottlenecks

### MEDIUM: 85 DB Operations in Single ai-agent Invocation

- Problem: A single AI Agent request can execute up to 85 Supabase queries/mutations depending on code path (greeting check, context load, tool execution, logging, summary, TTS, etc.).
- Files: `supabase/functions/ai-agent/index.ts`
- Cause: Sequential DB calls in tool execution loop. Some are parallelized with `Promise.all` (lines 71-73, 440-444) but many are sequential.
- Improvement path: For M2, if adding scoring/validation DB writes, batch them or fire-and-forget. The function already hits the 25s Supabase gateway timeout on complex flows.

### LOW: Large Frontend Components

- Problem: Several components exceed 600 lines.
- Files:
  - `src/integrations/supabase/types.ts` — 3060 lines (auto-generated, acceptable)
  - `src/components/helpdesk/ContactInfoPanel.tsx` — 865 lines
  - `src/components/dashboard/Sidebar.tsx` — 815 lines
  - `src/components/dashboard/BackupModule.tsx` — 810 lines
  - `src/pages/dashboard/Leads.tsx` — 793 lines
  - `src/components/broadcast/LeadMessageForm.tsx` — 771 lines
- Cause: Feature accumulation without extraction.
- Improvement path: Not blocking M2. Extract sub-components when modifying these files.

---

## Fragile Areas

### HIGH: Playground ↔ Production Sync

- Files: `supabase/functions/ai-agent/index.ts`, `supabase/functions/ai-agent-playground/index.ts`
- Why fragile: Any AI Agent behavior change requires updating two separate files. The playground already has its own version numbering ("v4") vs production ("v2/Sprint 3"). M2 will add approval flow to playground only, increasing divergence further.
- Safe modification: Always update both files when changing shared behavior. Use `_shared/` helpers for any new logic.
- Test coverage: 7 playground test files exist (`PlaygroundEdgeCases`, `PlaygroundGreeting`, `PlaygroundIntegration`, `PlaygroundMediaAudio`, `PlaygroundPrompt`, `PlaygroundScenarios`, `PlaygroundTools`), but these test the frontend component, not the edge function logic.

### MEDIUM: Migration Ordering with 106 Total Files

- Files: `supabase/migrations/` (68 committed + 38 untracked = 106 files)
- Why fragile: 21 migrations added in the last 2 weeks alone. Some have overlapping concerns (multiple `utm_campaigns` migrations, multiple FK cascade fixes). Adding M2 migrations into this mix risks ordering conflicts.
- Safe modification: Use timestamps well ahead of existing ones. Test migration order with `supabase db reset` before committing.
- Test coverage: No automated migration testing.

### MEDIUM: types.ts Sync with Database

- Files: `src/integrations/supabase/types.ts` (3060 lines, auto-generated via `supabase gen types`)
- Why fragile: Every migration requires regenerating types. If types.ts gets out of sync (which it currently is — `utm_campaign_visits` exists in DB but not in types, hence the `as any` casts in useCampaigns), queries silently break at runtime.
- Safe modification: Run `supabase gen types typescript` after EVERY migration, before writing any frontend code that touches new tables.
- Test coverage: None. TypeScript compiler only catches issues if types exist.

---

## Test Coverage Gaps

### HIGH: No Edge Function Integration Tests

- What's not tested: All 26 edge functions have zero integration tests. The `_shared/` modules have 4 unit test files (`agentHelpers.test.ts`, `aiRuntime.test.ts`, `carousel.test.ts`, `circuitBreaker.test.ts`, `supabaseClient.test.ts`) but the actual edge function handlers are untested.
- Files: `supabase/functions/ai-agent/index.ts`, `supabase/functions/ai-agent-playground/index.ts`, `supabase/functions/whatsapp-webhook/index.ts`
- Risk: The 2458-line ai-agent function is the most critical code path and has no automated tests. M2's "automated test-adjust-retest cycle" will add complexity to untested code.
- Priority: HIGH — M2 should establish edge function testing patterns as part of the QA Framework itself.

### MEDIUM: Frontend Tests Cover Mocked Components Only

- What's not tested: All 17 frontend test files mock Supabase entirely. No tests verify actual query shapes, RLS policies, or data transformations.
- Files: `src/test/setup.ts` (global mocks), `src/pages/dashboard/__tests__/` (7 files), `src/hooks/__tests__/` (4 files), `src/components/` tests (6 files)
- Risk: Type changes in DB schema won't be caught until runtime.
- Priority: MEDIUM — acceptable for unit tests, but M2 should add at least smoke tests that verify query shapes match types.

### LOW: No E2E Browser Tests

- What's not tested: No Playwright/Cypress tests exist. User flows (login, create conversation, AI agent interaction) are untested end-to-end.
- Files: No test config for E2E frameworks detected.
- Risk: UI regressions in the Playground approval flow (M2) will only be caught manually.
- Priority: LOW for M2 specifically, since the Agent QA Framework focuses on AI behavior testing, not UI testing.

---

## Dependencies at Risk

### LOW: Deno Edge Functions vs Node Frontend

- Risk: Edge functions use Deno runtime with `.ts` extensions in imports. Shared test files (`_shared/*.test.ts`) run in Vitest (Node). The test environment differences could mask runtime issues.
- Impact: A test passing in Vitest doesn't guarantee the same code works in Deno's Supabase Edge Runtime.
- Migration plan: No action needed, but M2 should be aware that `_shared/` tests don't test Deno-specific behavior (Deno.env, Deno.serve, etc.).

---

## Pre-M2 Checklist (MUST DO)

1. **Commit 38 untracked migrations** — Risk of schema drift is unacceptable. All untracked migrations in `supabase/migrations/` must be committed before M2 starts.

2. **Commit 5 modified files** — `src/test/setup.ts`, two Playground test files, `uazapi.md`, and `cli-latest` have uncommitted changes. Clean working tree before branching.

3. **Regenerate types.ts** — Run `supabase gen types typescript --local > src/integrations/supabase/types.ts` to ensure frontend types match the full 106-migration schema. This will eliminate the need for `as any` casts on `utm_campaigns`.

4. **Create `e2e_test_batches` migration** — The `batch_id` column exists on `e2e_test_runs` but has no parent table. M2's batch history feature needs this table designed upfront.

5. **Extract shared agent logic** — Before adding approval hooks to playground, extract the system prompt builder, tool definitions, and tool execution loop from `ai-agent/index.ts` into `_shared/agentCore.ts`. This prevents further playground/production divergence.

---

*Concerns audit: 2026-04-04*
