# Architecture Patterns

**Domain:** LLM Agent QA Framework
**Researched:** 2026-04-04

## Recommended Architecture

Build as an extension of the existing Playground page, not a separate module.

### System Diagram

```
                    +---------------------------+
                    |    AIAgentPlayground.tsx   |
                    |  (orchestrator component)  |
                    +---------------------------+
                    |  Tab: Manual  | Tab: E2E  |
                    |  Tab: Results | Tab: Score |
                    +------+--------+-----------+
                           |
              +------------+------------+
              |                         |
    +---------v---------+   +-----------v-----------+
    | useE2eBatchHistory|   |   useAgentScore       |
    | (React Query)     |   |   (React Query)       |
    +---+-------+-------+   +---+-------+-----------+
        |       |                |       |
   +----v--+ +--v-----+    +----v---+ +-v-----------+
   |e2e_   | |e2e_    |    |e2e_    | |ai_agent_    |
   |test_  | |test_   |    |test_   | |validations  |
   |runs   | |runs    |    |runs    | |             |
   |(list) | |(detail)|    |(rates) | |(scores)     |
   +-------+ +--------+    +--------+ +-------------+

    +--------------------------------------------------+
    |           agentScoring.ts (pure functions)        |
    |  computeComposite() | detectRegression()         |
    |  categorizeFailure() | suggestAction()           |
    +--------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `AIAgentPlayground.tsx` | Page orchestrator, tab routing | All tab components |
| `BatchHistoryTab.tsx` | Browse persistent batch history | `useE2eBatchHistory` |
| `ApprovalQueue.tsx` | List pending approvals, approve/reject | Supabase direct (simple CRUD) |
| `ReviewDrawer.tsx` | Detailed failure inspection | Parent passes data |
| `AgentScoreBar.tsx` | Visualize composite score + trend | `useAgentScore` |
| `RegressionReport.tsx` | Show regression analysis between batches | `regressionDetector.ts` |
| `useE2eBatchHistory.ts` | Fetch + cache batch data | Supabase `e2e_test_runs` |
| `useAgentScore.ts` | Compute composite from two sources | Supabase (both tables) |
| `agentScoring.ts` | Pure scoring/regression functions | None (pure computation) |
| `failureCategorizer.ts` | Map failure patterns to suggestions | None (pure rules) |

### Data Flow

**Read path (viewing history):**
```
BatchHistoryTab -> useE2eBatchHistory -> Supabase query -> e2e_test_runs
                                      -> GROUP BY batch_id
                                      -> Return: [{ batchId, passRate, timestamp, promptHash }]
```

**Write path (approval):**
```
ReviewDrawer -> approve/reject button -> Supabase UPDATE e2e_test_runs 
             -> SET approval, approved_by, approved_at, reviewer_notes
             -> Invalidate React Query cache
```

**Score computation:**
```
useAgentScore -> parallel queries:
  1. e2e_test_runs (last N days) -> passRate, toolAccuracy, avgLatency
  2. ai_agent_validations (last N days) -> avgScore
  -> agentScoring.computeComposite() -> { score, subScores, trend }
```

**Regression detection:**
```
BatchHistoryTab -> select two batches -> regressionDetector.detectRegression()
  -> { regressed, passRateDelta, newFailures[], fixedScenarios[] }
  -> failureCategorizer.categorize(newFailures) -> suggestions[]
```

## Patterns to Follow

### Pattern 1: Pure Computation Functions
**What:** All scoring, regression detection, and failure categorization in pure functions (no side effects, no hooks, no Supabase calls).
**When:** Any logic that transforms data.
**Why:** Testable with unit tests, reusable across components.
**Example:**
```typescript
// src/lib/agentScoring.ts
export function computeCompositeScore(
  e2eRuns: E2eRunRow[],
  validations: ValidationRow[],
): CompositeScore {
  const e2ePassRate = e2eRuns.filter(r => r.passed).length / e2eRuns.length * 100;
  const validatorAvg = validations.reduce((s, v) => s + v.score, 0) / validations.length * 10;
  // ... pure computation
}
```

### Pattern 2: React Query for All DB Reads
**What:** Use TanStack React Query for all Supabase reads with appropriate stale times.
**When:** Any component that reads from DB.
**Why:** Automatic caching, deduplication, background refetch. Already the pattern used everywhere in the codebase.
**Example:**
```typescript
// src/hooks/useE2eBatchHistory.ts
export function useE2eBatchHistory(agentId: string, days = 7) {
  return useQuery({
    queryKey: ['e2e-batches', agentId, days],
    queryFn: () => fetchBatches(agentId, days),
    staleTime: 60_000, // 1 min
  });
}
```

### Pattern 3: Optimistic UI for Approvals
**What:** When admin clicks approve/reject, update UI immediately, then persist to DB.
**When:** Approval actions.
**Why:** Feels instant. If DB write fails, rollback (same pattern as `handleUpdateConversation` in helpdesk).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate QA Dashboard Page
**What:** Creating a new `/dashboard/qa` route.
**Why bad:** Fragments the admin experience. Admin already knows the Playground page.
**Instead:** Add tabs/panels within existing Playground.

### Anti-Pattern 2: Storing Computed Scores in DB
**What:** Creating an `agent_scores` table updated by a cron job.
**Why bad:** Stale data, sync complexity, another migration, another edge function.
**Instead:** Compute on the fly from raw data (< 2000 rows, fast enough).

### Anti-Pattern 3: Complex State Machine for Test Lifecycle
**What:** Redux/Zustand store with test states (pending, running, passed, reviewing, approved, etc.).
**Why bad:** Over-engineered. The lifecycle is simple: run -> pass/fail -> review (if failed) -> approved/rejected.
**Instead:** DB columns + React Query invalidation.

### Anti-Pattern 4: LLM-as-Judge for E2E Evaluation
**What:** Using a second LLM to evaluate whether the agent's response was "good" during E2E.
**Why bad:** The Validator Agent already does this in production. Adding another LLM judge during E2E would be redundant and expensive.
**Instead:** Use tool-based evaluation (deterministic) for E2E. Validator scores come from production data.

## Scalability Considerations

| Concern | Current (22 scenarios) | At 50 scenarios | At 200 scenarios |
|---------|----------------------|-----------------|-------------------|
| Batch run time | ~5 min (22 * 15s avg) | ~12 min | ~50 min (need parallel) |
| DB storage | ~1000 rows/month | ~2500 rows/month | ~10000 rows/month |
| Score computation | Instant | Instant | May need DB-side aggregation |
| UI responsiveness | Fine | Fine | May need pagination in batch list |

**At 200 scenarios:** Would need to parallelize E2E execution (run 3-5 scenarios concurrently), add DB-side aggregation RPC, and paginate the batch history list. Not needed now.

## Sources

- Codebase analysis of existing component patterns
- [InfoQ: Evaluating AI Agents in Practice](https://www.infoq.com/articles/evaluating-ai-agents-lessons-learned/)
