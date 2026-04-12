# P2: Types Regeneration + e2e_test_batches Table

**Researched:** 2026-04-04
**Domain:** Supabase schema sync + DB schema design
**Project:** WhatsPRO — `euljumeflwtljegknawy`

---

## Summary

Two tightly related schema-sync tasks.

**Task 1 (types.ts):** The file is partially out of sync. The `utm_campaigns` and `utm_visits` tables ARE present in `types.ts` (lines 2507-2650), so the `as any` casts in `useCampaigns.ts` are a leftover from when those tables didn't exist — they can be removed today without any regeneration. The real gap is in `e2e_test_runs`: the batch-approval migration (`20260330180000`) added 10 columns that are absent from `types.ts`, causing TypeScript to silently ignore type errors whenever `saveE2eResult` inserts `run_type`, `batch_id`, `category`, `tools_used`, `tools_missing`, `approval`, `approved_by`, `approved_at`, `reviewer_notes`, `prompt_hash`. Regeneration via `npx supabase gen types` will close this gap.

**Task 2 (e2e_test_batches):** `e2e_test_runs.batch_id` is `TEXT` with no FK. The playground generates batch IDs like `batch_1712345678901` client-side and writes them into individual run rows, but there is no parent record. Creating `e2e_test_batches` with a proper UUID PK + FK upgrade from `batch_id TEXT` to `batch_id UUID` gives: (a) batch-level aggregation without GROUP BY on every query, (b) `composite_score` stored once per batch, (c) FK integrity.

**Primary recommendation:** Execute Task 2 first (define table DDL), then regenerate types to pick up both the batch migration columns AND the new batches table in one pass.

---

## Task 1 — types.ts Regeneration

### Gap Analysis

#### Tables present in migrations vs types.ts

| Table | In Migrations | In types.ts | Status |
|-------|-------------|-------------|--------|
| `admin_audit_log` | yes | yes | OK |
| `ai_agent_knowledge` | yes | yes | OK |
| `ai_agent_logs` | yes | yes | OK |
| `ai_agent_media` | yes | yes | OK |
| `ai_agent_products` | yes | yes | OK |
| `ai_agents` | yes | yes | OK |
| `ai_agent_validations` | yes (20260401) | yes | OK |
| `ai_debounce_queue` | yes | yes | OK |
| `broadcast_logs` | yes | yes | OK |
| `contacts` | yes | yes | OK |
| `conversation_labels` | yes | yes | OK |
| `conversation_messages` | yes | yes | OK |
| `conversations` | yes | yes | OK |
| `department_members` | yes | yes | OK |
| `departments` | yes | yes | OK |
| `e2e_test_batches` | NO — new table needed | NO | MISSING (new) |
| `e2e_test_runs` | yes | yes but STALE | COLUMNS MISSING |
| `follow_up_executions` | yes (20260325) | yes | OK |
| `inbox_users` | yes | yes | OK |
| `inboxes` | yes | yes | OK |
| `instance_connection_logs` | yes | yes | OK |
| `instances` | yes | yes | OK |
| `job_queue` | yes | yes | OK |
| `kanban_*` (6 tables) | yes | yes | OK |
| `labels` | yes | yes | OK |
| `lead_database_entries` | yes | yes | OK |
| `lead_databases` | yes | yes | OK |
| `lead_profiles` | yes | yes | OK |
| `message_templates` | yes | yes | OK |
| `playground_evaluations` | yes | yes | OK |
| `playground_test_suites` | yes | yes | OK |
| `rate_limit_log` | yes (20260323) | yes | OK |
| `scheduled_message_logs` | yes | yes | OK |
| `scheduled_messages` | yes | yes | OK |
| `scrape_jobs` | yes (20260325) | yes | OK |
| `shift_report_configs` | yes | yes | OK |
| `shift_report_logs` | yes | yes | OK |
| `system_settings` | yes | yes | OK |
| `user_instance_access` | yes | yes | OK |
| `user_profiles` | yes | yes | OK |
| `user_roles` | yes | yes | OK |
| `utm_campaigns` | yes (20260324) | yes | OK |
| `utm_visits` | yes (20260324) | yes | OK |

**Note on `follow_up_cadences`:** Migration `20260325080938` only adds columns to `ai_agents` and creates `follow_up_executions`. There is no separate `follow_up_cadences` table.

#### Stale columns in e2e_test_runs

Migration `20260330180000_e2e_approval_and_batch.sql` added these columns. None are in `types.ts`:

| Column | Type | Default | Used in code |
|--------|------|---------|-------------|
| `run_type` | `text` | `'single'` | YES — `saveE2eResult` in AIAgentPlayground.tsx:157 |
| `approval` | `text` | `NULL` | YES — AIAgentPlayground.tsx:162 |
| `approved_by` | `uuid` | `NULL` | not yet in frontend |
| `approved_at` | `timestamptz` | `NULL` | not yet in frontend |
| `reviewer_notes` | `text` | `NULL` | not yet in frontend |
| `batch_id` | `text` | `NULL` | YES — AIAgentPlayground.tsx:158 |
| `category` | `text` | `NULL` | YES — AIAgentPlayground.tsx:159 |
| `tools_used` | `text[]` | `'{}'` | YES — AIAgentPlayground.tsx:160 |
| `tools_missing` | `text[]` | `'{}'` | YES — AIAgentPlayground.tsx:161 |
| `prompt_hash` | `text` | `NULL` | not yet in frontend |

**Impact today:** `supabase.from('e2e_test_runs').insert({...})` accepts unknown keys silently because TypeScript infers `any` for the insert object when extra keys are present. No runtime error, but no type safety.

### The `as any` cast root cause in useCampaigns.ts

`utm_campaigns` and `utm_visits` ARE present in types.ts (confirmed at lines 2507 and 2584). The `(supabase as any)` casts in `useCampaigns.ts` are **unnecessary leftovers** — the tables were added to the DB first and types were regenerated later, but the hook was never updated to remove the casts. These can be removed without any regeneration.

### Regeneration Command

```bash
export SUPABASE_ACCESS_TOKEN=sbp_7058fea1d8fac79d182b89c06fc334686fa0c512
npx supabase gen types typescript \
  --project-id euljumeflwtljegknawy \
  --schema public \
  > src/integrations/supabase/types.ts
```

**Prerequisite:** Run Task 2 migration (create `e2e_test_batches`) BEFORE regenerating so the new table is captured in one pass.

### Files requiring manual fixes after regeneration

Regeneration replaces the entire file. The following manual changes must be applied afterward:

| File | Issue | Fix |
|------|-------|-----|
| `src/hooks/useCampaigns.ts` | 9 occurrences of `(supabase as any)` | Remove all casts — types already exist |
| `src/integrations/supabase/client.ts` | Imports `Database` from types.ts | Verify import path unchanged after regen |
| `src/pages/dashboard/AIAgentPlayground.tsx` | Inserts `run_type`, `batch_id`, etc. into `e2e_test_runs` | After regen those fields will be typed — remove any `as any` if added |

**Low-risk items:** All other queries using the typed client are currently working. Regeneration will add columns to existing types, not remove them — so existing queries remain valid.

### What could break

1. **Column rename or type change in DB:** If a migration changed a column type (e.g., NOT NULL added), generated types will differ from hand-edited types.ts. Run `tsc --noEmit` immediately after regen to surface errors.
2. **Extra hand-written types at end of file:** Check if anything was manually appended after the last line of the generated block — the regen will overwrite it.
3. **`__InternalSupabase.PostgrestVersion`:** The current file has `"14.4"`. New regen may update this value — safe to accept.

### Rollback

```bash
git checkout src/integrations/supabase/types.ts
```

The file is version-controlled. Rollback is instant.

---

## Task 2 — e2e_test_batches Table Design

### Current state

- `e2e_test_runs.batch_id` is `TEXT NOT NULL DEFAULT 'single'` with no FK.
- Client generates IDs like `batch_1712345678901` (timestamp string).
- `E2eStatusCard.tsx` approximates batch grouping using a 5-minute time window — a workaround for the missing parent table.
- No aggregated batch-level data exists; every batch summary requires a GROUP BY over individual runs.

### Proposed Table DDL

```sql
-- Migration: YYYYMMDDHHMMSS_create_e2e_test_batches.sql

CREATE TABLE IF NOT EXISTS public.e2e_test_batches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID        NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  instance_id   TEXT        NOT NULL,
  run_type      TEXT        NOT NULL DEFAULT 'batch'
                            CHECK (run_type IN ('batch', 'scheduled', 'manual')),
  status        TEXT        NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'completed', 'aborted')),
  total         INT         NOT NULL DEFAULT 0,
  passed        INT         NOT NULL DEFAULT 0,
  failed        INT         NOT NULL DEFAULT 0,
  skipped       INT         NOT NULL DEFAULT 0,
  composite_score NUMERIC(5,2),          -- 0.00 – 100.00
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries (latest batch per agent)
CREATE INDEX IF NOT EXISTS idx_e2e_batches_agent_created
  ON public.e2e_test_batches(agent_id, created_at DESC);

-- RLS
ALTER TABLE public.e2e_test_batches ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read
CREATE POLICY "super_admin_read_e2e_batches"
  ON public.e2e_test_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Service role inserts (edge function + frontend with service key)
CREATE POLICY "service_insert_e2e_batches"
  ON public.e2e_test_batches FOR INSERT
  WITH CHECK (true);

-- super_admin can update (mark completed, set score)
CREATE POLICY "super_admin_update_e2e_batches"
  ON public.e2e_test_batches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
```

### FK Migration: batch_id TEXT -> UUID with FK

The existing `batch_id TEXT` column in `e2e_test_runs` must become a FK to `e2e_test_batches.id`. Options:

**Option A — New UUID column with FK (recommended, non-breaking):**

```sql
-- Add new typed FK column alongside existing batch_id
ALTER TABLE public.e2e_test_runs
  ADD COLUMN IF NOT EXISTS batch_uuid UUID
    REFERENCES public.e2e_test_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_e2e_runs_batch_uuid
  ON public.e2e_test_runs(batch_uuid, created_at DESC);
```

Rationale: The existing `batch_id TEXT` column has historical data (format `batch_TIMESTAMP`). Dropping it would lose history. Adding `batch_uuid UUID` preserves old rows and gives new runs a proper FK. After a retention window (30 days per existing cleanup function), the TEXT column can be dropped.

**Option B — Drop and replace (clean but destructive):**

```sql
-- Only safe if e2e_test_runs has no production data yet
ALTER TABLE public.e2e_test_runs DROP COLUMN batch_id;
ALTER TABLE public.e2e_test_runs
  ADD COLUMN batch_id UUID REFERENCES public.e2e_test_batches(id) ON DELETE SET NULL;
```

Use Option A unless confirmed no important historical data exists.

### Batch Aggregation RPC

A lightweight RPC avoids repeated GROUP BY in frontend:

```sql
CREATE OR REPLACE FUNCTION public.get_e2e_batch_summary(p_batch_id UUID)
RETURNS TABLE(
  total     INT,
  passed    INT,
  failed    INT,
  skipped   INT,
  avg_latency_ms NUMERIC
) AS $$
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE passed = true)::INT,
    COUNT(*) FILTER (WHERE passed = false AND skipped = false)::INT,
    COUNT(*) FILTER (WHERE skipped = true)::INT,
    AVG(latency_ms)::NUMERIC
  FROM public.e2e_test_runs
  WHERE batch_uuid = p_batch_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### TypeScript Interface

```typescript
// src/types/e2eTestBatches.ts

export interface E2eTestBatch {
  id: string;                         // UUID
  agent_id: string;
  instance_id: string;
  run_type: 'batch' | 'scheduled' | 'manual';
  status: 'running' | 'completed' | 'aborted';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  composite_score: number | null;     // 0-100
  started_at: string;                 // ISO 8601
  completed_at: string | null;
  created_by: string | null;          // user UUID
  created_at: string;
}

export type E2eTestBatchInsert = Omit<E2eTestBatch, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};
```

Note: after types.ts regeneration this interface will be auto-generated in `Database['public']['Tables']['e2e_test_batches']`. Keep the manual interface until that regen happens.

### Client-side changes needed

**AIAgentPlayground.tsx — `runAllE2e` function:**

```typescript
// Before starting batch: INSERT into e2e_test_batches
const { data: batch } = await supabase
  .from('e2e_test_batches')
  .insert({
    agent_id: selectedAgentId,
    instance_id: selectedAgent.instance_id,
    run_type: 'batch',
    status: 'running',
    total: scenarios.length,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  })
  .select('id')
  .single();

const batchId = batch?.id;  // UUID, used as batch_uuid in run inserts

// After all runs complete: UPDATE e2e_test_batches
await supabase
  .from('e2e_test_batches')
  .update({
    status: batchAbortRef.current ? 'aborted' : 'completed',
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    completed_at: new Date().toISOString(),
    composite_score: /* compute from results */,
  })
  .eq('id', batchId);
```

**E2eStatusCard.tsx:** Replace the 5-minute time window hack with a proper batch query:

```typescript
// Current (brittle):
const batchStart = new Date(new Date(latestRun.created_at).getTime() - 5 * 60 * 1000).toISOString();

// New (correct):
const { data: latestBatch } = await supabase
  .from('e2e_test_batches')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

---

## Risk Assessment

### Task 1 — types.ts Regeneration

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Regen produces different column order / naming | LOW | LOW | TypeScript structural typing — order doesn't matter |
| Regen removes manually added helper types | MEDIUM | LOW | Check end of file before regen; git diff confirms |
| New columns in DB not matching expected TypeScript types | MEDIUM | MEDIUM | Run `tsc --noEmit` immediately after regen |
| Access token expired or invalid | HIGH | LOW | Token is in memory reference; test with `npx supabase projects list` first |
| Breaking change if DB has column type mismatch vs hand-edited types | MEDIUM | LOW | Review diff carefully; types.ts is git-tracked |

### Task 2 — e2e_test_batches

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Migration applied to already-running system with existing batch_id TEXT data | MEDIUM | LOW | Use Option A (additive column) not Option B (drop/replace) |
| Frontend still writes batch_id TEXT while batch_uuid UUID is empty | LOW | LOW | Two columns coexist; existing rows remain valid |
| RLS policy blocks frontend insert (user JWT, not service role) | HIGH | MEDIUM | Verify playground uses service role or the `WITH CHECK (true)` policy covers it |
| composite_score calculation not defined | LOW | HIGH | Define formula before implementing: `(passed / total) * 100` |

---

## Step-by-Step Execution Plan

### Phase A: Task 2 — Create migration (do this FIRST)

1. Create migration file `supabase/migrations/YYYYMMDD_create_e2e_test_batches.sql` with the DDL above (Option A for batch_id).
2. Apply to remote: `npx supabase db push --project-ref euljumeflwtljegknawy`.
3. Verify in Supabase Studio that `e2e_test_batches` table exists with correct columns and RLS enabled.

### Phase B: Task 1 — Regenerate types

4. Confirm access token: `export SUPABASE_ACCESS_TOKEN=sbp_7058fea1d8fac79d182b89c06fc334686fa0c512 && npx supabase projects list`.
5. Run regen command (see above). Output to `src/integrations/supabase/types.ts`.
6. Run `git diff src/integrations/supabase/types.ts` — verify new tables and columns appear, no existing types removed.
7. Run `npm run build` or `npx tsc --noEmit` — fix any newly surfaced type errors.

### Phase C: Remove `as any` from useCampaigns.ts

8. In `src/hooks/useCampaigns.ts` — remove all 9 `(supabase as any)` casts.
9. Replace `campaigns || []).map((c: any)` with properly typed equivalent (type will be `Database['public']['Tables']['utm_campaigns']['Row']`).
10. Run `npm run build` again to confirm.

### Phase D: Update AIAgentPlayground.tsx

11. Update `saveE2eResult` to use `batch_uuid` instead of `batch_id` when inserting into `e2e_test_runs`.
12. Add batch create/complete logic to `runAllE2e`.

### Phase E: Update E2eStatusCard.tsx

13. Replace the 5-minute time window approximation with a direct `e2e_test_batches` query.

### Phase F: Verify

14. `npm run build` — zero TypeScript errors.
15. Manual test: run an E2E batch in the playground, verify a row appears in `e2e_test_batches` and individual rows in `e2e_test_runs` have `batch_uuid` populated.

---

## Rollback Strategy

### Task 1 rollback

```bash
git checkout src/integrations/supabase/types.ts
git checkout src/hooks/useCampaigns.ts
```

No DB changes involved. Complete rollback in < 30 seconds.

### Task 2 rollback

```sql
-- In Supabase Studio or via migration
ALTER TABLE public.e2e_test_runs DROP COLUMN IF EXISTS batch_uuid;
DROP TABLE IF EXISTS public.e2e_test_batches;
```

Safe because `batch_uuid` is a new column (existing data unaffected). Old `batch_id TEXT` column is untouched.

---

## Environment

| Tool | Available | Version | Notes |
|------|-----------|---------|-------|
| `npx supabase` | YES | 2.84.10 | Available via npx |
| `supabase` CLI (global) | NO | — | Must use `npx supabase` |
| Supabase project | YES | euljumeflwtljegknawy | Linked |
| Access token | YES | `sbp_7058fea1d8fac79d182b89c06fc334686fa0c512` | From project memory |

**Regeneration requires internet access** — the CLI calls the Supabase introspection API.

---

## Appendix: complete e2e_test_runs column set post-migration

After regeneration, `e2e_test_runs.Row` should contain:

```typescript
{
  id: string
  agent_id: string
  instance_id: string
  test_number: string
  scenario_id: string
  scenario_name: string
  total_steps: number
  passed: boolean
  skipped: boolean
  skip_reason: string | null
  results: Json
  latency_ms: number | null
  error: string | null
  created_at: string
  // Added by 20260330 migration:
  run_type: string              // 'single' | 'batch' | 'manual'
  approval: string | null       // 'auto_approved' | 'human_approved' | 'human_rejected'
  approved_by: string | null    // UUID
  approved_at: string | null
  reviewer_notes: string | null
  batch_id: string | null       // legacy TEXT — will coexist with batch_uuid
  category: string | null
  tools_used: string[]
  tools_missing: string[]
  prompt_hash: string | null
  // Added by Task 2 migration:
  batch_uuid: string | null     // UUID FK to e2e_test_batches.id
}
```
