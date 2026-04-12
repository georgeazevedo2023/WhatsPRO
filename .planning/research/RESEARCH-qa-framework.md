# Research: Agent QA Framework (Milestone 2)

**Project:** WhatsPRO
**Domain:** LLM Agent Testing / Quality Assurance
**Researched:** 2026-04-04
**Overall confidence:** HIGH (based on thorough codebase analysis + industry patterns)

---

## Executive Summary

WhatsPRO already has a substantial testing infrastructure for its AI Agent. The Playground page (`AIAgentPlayground.tsx`) provides 4 tabs: Manual Chat, Scenarios (simulated LLM), Results (in-memory), and E2E Real (WhatsApp). There are 22 hardcoded test scenarios across 17 categories, an E2E test runner edge function that sends real messages through the full stack, a scheduled runner (`e2e-scheduled`) with WhatsApp alerting, and a database table (`e2e_test_runs`) with approval workflow columns already migrated.

The gap between current state and the Milestone 2 vision is primarily in **UI/UX** and **workflow orchestration**, not in fundamental infrastructure. The database schema already supports approval workflows, batch IDs, and prompt hashing. What is missing: (1) a UI for admin approval of failed tests, (2) a way to browse persistent batch history, (3) a composite score that aggregates E2E results + validator metrics into a single agent health number, and (4) an automated loop that detects regressions and surfaces recommended adjustments.

The system is uniquely positioned because it has **two independent quality signals**: the Validator Agent (per-message scoring, 0-10) stored in `ai_agent_validations`, and E2E scenario results (pass/fail + tool correctness) stored in `e2e_test_runs`. The composite score should combine both.

---

## 1. Current State Analysis

### What Already Exists

#### Database Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `e2e_test_runs` | Stores E2E test results | `agent_id, scenario_id, passed, results (JSONB), run_type, approval, approved_by, approved_at, reviewer_notes, batch_id, tools_used, tools_missing, prompt_hash, category, latency_ms, error` |
| `ai_agent_validations` | Per-message validator scores | `agent_id, conversation_id, score, verdict (PASS/REWRITE/BLOCK), violations, bonuses, rewritten_text, suggestion, model, latency_ms` |
| `ai_agent_logs` | Agent execution logs | `event, tool_calls, latency_ms, input_tokens, output_tokens, conversation_id, agent_id` |

**Key observation:** The `e2e_test_runs` table already has `approval`, `approved_by`, `approved_at`, `reviewer_notes`, `batch_id`, and `prompt_hash` columns from migration `20260330180000_e2e_approval_and_batch.sql`. This means the DB schema for the approval workflow is DONE. Only the UI is missing.

#### Edge Functions
| Function | Purpose | Auth |
|----------|---------|------|
| `ai-agent-playground` | Simulated chat (mock UAZAPI, real DB queries) | super_admin |
| `e2e-test` | Real E2E runner (real UAZAPI + real ai-agent) | super_admin OR service_role |
| `e2e-scheduled` | Automated cron runner (6 scenarios, WhatsApp alerts) | cron/service_role |

#### Frontend Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `AIAgentPlayground.tsx` | `src/pages/dashboard/` | Main playground page (348 lines) |
| `PlaygroundManualTab.tsx` | `src/components/admin/ai-agent/playground/` | Manual chat tab |
| `PlaygroundScenariosTab.tsx` | same dir | Simulated scenario runner |
| `PlaygroundResultsTab.tsx` | same dir | In-memory results (NOT persistent) |
| `PlaygroundE2eTab.tsx` | same dir | Real E2E execution tab |
| `E2eStatusCard.tsx` | `src/components/dashboard/` | Dashboard card showing latest E2E results |
| `ValidatorMetrics.tsx` | `src/components/admin/ai-agent/` | Validator score analytics |

#### Test Scenarios
- **22 scenarios** hardcoded in `src/types/playground.ts` as `TEST_SCENARIOS`
- **17 categories**: vendas, suporte, troca, devolucao, defeito, curioso, vaga_emprego, indeciso, transbordo, pergunta_direta, midia (2), audio (3), objecao (5)
- **3 difficulty levels**: easy, medium, hard
- **Expected outcomes**: `tools_must_use`, `tools_must_not_use`, `should_handoff`, `should_block`, `max_turns`
- **e2e-scheduled** has a reduced set of 6 scenarios for automated quick runs (~2min)

#### Current Workflow
1. Admin opens Playground > E2E Real tab
2. Enters test phone number
3. Clicks "Run" on individual scenario OR "Rodar Todos" for batch
4. Results displayed in real-time with live steps
5. Results saved to `e2e_test_runs` (best-effort)
6. Passing tests get `approval: 'auto_approved'`; failing tests get `approval: null`
7. `e2e-scheduled` runs automatically (pg_cron, currently commented out) every 6 hours
8. On failures, WhatsApp alert sent to configured number
9. `E2eStatusCard` on dashboard shows latest batch summary

### What is Missing (per Backlog Item)

| Backlog Item | DB Ready? | Backend Ready? | Frontend Ready? |
|-------------|-----------|----------------|-----------------|
| 1. Admin approval flow | YES (columns exist) | PARTIAL (save works, no approve/reject endpoint) | NO |
| 2. Persistent batch history | YES (batch_id exists) | YES (saves to DB) | NO (PlaygroundResultsTab is in-memory only) |
| 3. Composite score bar | NO (no aggregate table/RPC) | NO | NO |
| 4. Automated test-adjust-retest | PARTIAL (e2e-scheduled exists) | NO (no adjustment logic) | NO |

---

## 2. Backlog Item 1: Admin Approval Flow

### What It Solves
When an E2E test fails, an admin needs to review the failure, understand what went wrong, and either approve (false positive / acceptable behavior) or reject (real regression requiring fix). Currently, failed tests sit in the DB with `approval: null` and no one looks at them.

### Technical Approach

**No new edge function needed.** The approval can be a direct Supabase update from the frontend (RLS already allows super_admin UPDATE on `e2e_test_runs`).

**Frontend work:**
1. **ApprovalQueue component** — new component showing failed tests with `approval IS NULL`, grouped by batch
2. **Review drawer/modal** — shows full E2E step details, agent responses, tools used vs expected, with approve/reject buttons + notes field
3. **Integration point** — accessible from E2E tab or from a new "Pendentes" badge on the Playground header

**Data flow:**
```
Failed test (approval=null) → Admin reviews → 
  Approve: UPDATE approval='human_approved', approved_by=uid, approved_at=now(), reviewer_notes='...'
  Reject:  UPDATE approval='human_rejected', approved_by=uid, approved_at=now(), reviewer_notes='...'
```

**Complexity:** LOW-MEDIUM. Schema is ready. RLS policy exists. Only UI work.

**Files to create/modify:**
- NEW: `src/components/admin/ai-agent/playground/ApprovalQueue.tsx`
- NEW: `src/components/admin/ai-agent/playground/ReviewDrawer.tsx`
- MODIFY: `PlaygroundE2eTab.tsx` — add pending count badge + link to approval queue
- MODIFY: `AIAgentPlayground.tsx` — add approval queue state

### Key Design Decisions
- **Approve = "this behavior is acceptable"** (not "the test passed"). This is important for cases where the LLM gives a valid but different response than expected.
- **Rejected tests should flag the scenario** for prompt tuning. This is the link to backlog item 4.
- **Auto-approve on pass** is already implemented (good default).

---

## 3. Backlog Item 2: Persistent Batch History

### What It Solves
Currently, `PlaygroundResultsTab` shows only in-memory results from the current session. When the admin closes the browser, all results are lost. The `E2eStatusCard` on the dashboard shows only the latest batch. There is no way to browse historical batches, compare across deploys, or see trends.

### Technical Approach

**Data is already in the DB.** The `e2e_test_runs` table has `batch_id`, `created_at`, and all result data. This is purely a frontend read problem.

**Frontend work:**
1. **BatchHistoryTab or enhanced ResultsTab** — replace in-memory `runHistory` with DB query
2. **Batch list view** — group by `batch_id`, show aggregate pass/fail/skip counts per batch
3. **Batch detail view** — click a batch to see all scenario results, expandable
4. **Deploy correlation** — use `prompt_hash` column to group batches by prompt version (already exists in schema but never populated)
5. **Trend chart** — simple line chart showing pass rate over time (last 30 days)

**Data queries needed:**
```sql
-- List batches
SELECT batch_id, MIN(created_at) as started_at, 
       COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
       MAX(prompt_hash) as prompt_hash
FROM e2e_test_runs 
WHERE agent_id = $1 AND batch_id IS NOT NULL
GROUP BY batch_id ORDER BY started_at DESC LIMIT 50;

-- Batch details
SELECT * FROM e2e_test_runs WHERE batch_id = $1 ORDER BY created_at;

-- Trend (daily pass rate, last 30 days)
SELECT DATE(created_at) as day, 
       COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed
FROM e2e_test_runs WHERE agent_id = $1 AND created_at > now() - interval '30 days'
GROUP BY DATE(created_at) ORDER BY day;
```

**For prompt_hash population**, add to `saveE2eResult` in `AIAgentPlayground.tsx`:
```typescript
// Hash the agent's current system prompt for version tracking
const promptHash = await crypto.subtle.digest('SHA-256', 
  new TextEncoder().encode(agent.system_prompt || '')).then(
  buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('').substring(0, 12)
);
```

**Complexity:** MEDIUM. Data exists, need frontend components + one prompt hash feature.

**Files to create/modify:**
- NEW: `src/components/admin/ai-agent/playground/BatchHistoryTab.tsx`
- NEW: `src/hooks/useE2eBatchHistory.ts` — React Query hook for batch data
- MODIFY: `AIAgentPlayground.tsx` — add new tab or replace ResultsTab
- MODIFY: `saveE2eResult` function — populate `prompt_hash`

### Key Design Decisions
- **Keep 30-day retention** (already has `cleanup_old_e2e_runs()` RPC). Sufficient for tracking between deploys.
- **prompt_hash is critical** for correlating "which prompt version caused the regression". Should be populated on every save.
- **Do NOT build a full diff viewer** for prompts. Just show the hash and timestamp — admin knows what they changed.

---

## 4. Backlog Item 3: Composite Score (Agent Evolution Bar)

### What It Solves
Currently there are two separate quality signals with no unified view:
- Validator Agent: per-message score (0-10), stored in `ai_agent_validations`
- E2E Tests: pass/fail per scenario, stored in `e2e_test_runs`

The admin has no single number to answer "is my agent getting better or worse?"

### Technical Approach

**Composite Score Formula (recommended):**
```
Agent Score = (0.4 * E2E_Pass_Rate) + (0.3 * Validator_Avg_Score_Normalized) + (0.2 * Tool_Accuracy) + (0.1 * Latency_Score)

Where:
- E2E_Pass_Rate = passed / total E2E tests (last 7 days), 0-100
- Validator_Avg_Score_Normalized = avg validator score * 10 (already 0-10, scale to 0-100)
- Tool_Accuracy = 1 - (tools_missing + tools_unexpected) / total_expected_tools, 0-100
- Latency_Score = max(0, 100 - (avg_latency_ms - 3000) / 100), capped at 0-100
```

This gives a 0-100 score where:
- 90+ = Excellent (green)
- 70-89 = Good (blue)
- 50-69 = Needs attention (yellow)
- <50 = Critical (red)

**Backend work:**
- NEW RPC: `compute_agent_score(agent_id, days)` — a PostgreSQL function that queries both tables and computes the composite score
- OR: compute client-side from two React Query hooks (simpler, no migration)

**Recommendation: Compute client-side.** The data volumes are small (max 2000 validator rows + 50 batch runs in 7 days). A PostgreSQL RPC would be premature optimization.

**Frontend work:**
1. **AgentScoreBar component** — horizontal progress bar with color zones, current score, and trend arrow
2. **Score breakdown tooltip** — shows the 4 sub-scores on hover
3. **Trend sparkline** — mini chart showing score over last 7/14/30 days
4. **Placement:** Top of Playground page header + Agent admin tab (Metricas)

**Data hooks:**
```typescript
// useAgentScore.ts
function useAgentScore(agentId: string, days = 7) {
  const { data: e2eRuns } = useQuery(['e2e-runs', agentId, days], ...);
  const { data: validations } = useQuery(['validations', agentId, days], ...);
  
  return useMemo(() => computeCompositeScore(e2eRuns, validations), [e2eRuns, validations]);
}
```

**Complexity:** MEDIUM. Two data sources already exist. Formula is straightforward. Main work is the visualization.

**Files to create:**
- NEW: `src/hooks/useAgentScore.ts`
- NEW: `src/components/admin/ai-agent/AgentScoreBar.tsx`
- NEW: `src/lib/agentScoring.ts` — pure functions for score computation
- MODIFY: `AIAgentPlayground.tsx` — add score bar to header
- MODIFY: `ValidatorMetrics.tsx` — integrate score display

### Key Design Decisions
- **Weight E2E higher (0.4)** because it tests the full pipeline. Validator only tests response quality.
- **Latency matters but is low weight (0.1)** because it varies by UAZAPI and LLM provider, not just agent quality.
- **Tool accuracy (0.2)** catches "agent answered correctly but used wrong tools" which is a structural issue.
- **Do NOT include token cost** in the score. That is an operational metric, not a quality metric.

---

## 5. Backlog Item 4: Automated Test-Adjust-Retest Cycle

### What It Solves
Currently, when E2E tests fail, the admin manually investigates, adjusts prompts, and re-runs. This is the most ambitious backlog item — it envisions partial automation of this cycle.

### What is Realistic vs Aspirational

**Realistic (build this):**
1. **Regression detection** — after each batch, compare with previous batch. If pass rate dropped, flag as regression.
2. **Failure categorization** — group failures by type (missing tool, unexpected tool, no handoff, unexpected handoff, no response)
3. **Suggested actions** — based on failure pattern, suggest specific prompt section to edit (e.g., "3 scenarios failed because search_products was not called -> Review SDR qualification rules in Prompt Studio")
4. **One-click retest** — after making changes, button to re-run only the failed scenarios from the last batch

**Aspirational (defer to later milestone):**
- Auto-edit prompts based on failures (LLM-powered prompt tuning)
- Auto-create new test scenarios from production conversations
- A/B testing of prompt variants

### Technical Approach

**Regression detection:**
```typescript
// Compare latest batch with previous batch
function detectRegression(currentBatch: E2eRunResult[], previousBatch: E2eRunResult[]): RegressionReport {
  const currentPassRate = current.filter(r => r.pass).length / current.length;
  const previousPassRate = previous.filter(r => r.pass).length / previous.length;
  
  const newFailures = current.filter(r => !r.pass && 
    previous.find(p => p.scenario_id === r.scenario_id)?.pass);
  
  return {
    regressed: currentPassRate < previousPassRate,
    passRateDelta: currentPassRate - previousPassRate,
    newFailures, // scenarios that were passing before
    fixedScenarios, // scenarios that were failing before and now pass
  };
}
```

**Failure categorization rules:**
| Failure Pattern | Suggested Action |
|----------------|------------------|
| `tools_missing: ['search_products']` | "Agent did not search. Check SDR qualification rules — is the trigger too restrictive?" |
| `tools_missing: ['handoff_to_human']` | "Agent did not handoff. Check transbordo rules in Prompt Studio." |
| `tools_unexpected: ['search_products']` | "Agent searched when it should not have. Check FAQ/Knowledge Base for this topic." |
| `tools_unexpected: ['handoff_to_human']` | "Agent handed off prematurely. Check handoff triggers — maybe keyword overlap with info terms." |
| No response from agent | "Agent returned empty. Check circuit breaker status and LLM provider health." |
| Latency > 15s per step | "Slow responses. Check UAZAPI health and LLM provider latency." |

**One-click retest:**
```typescript
// Re-run only failed scenarios from a specific batch
async function retestFailures(batchId: string) {
  const { data: failures } = await supabase
    .from('e2e_test_runs')
    .select('scenario_id')
    .eq('batch_id', batchId)
    .eq('passed', false);
  
  const scenariosToRetest = TEST_SCENARIOS.filter(s => 
    failures.some(f => f.scenario_id === s.id));
  
  await runBatch(scenariosToRetest, `retest_${batchId}`);
}
```

**Complexity:** HIGH. Regression detection is medium, but failure categorization and suggested actions require domain-specific mapping. One-click retest is straightforward.

**Files to create:**
- NEW: `src/lib/regressionDetector.ts` — pure functions for regression analysis
- NEW: `src/lib/failureCategorizer.ts` — maps failure patterns to suggestions
- NEW: `src/components/admin/ai-agent/playground/RegressionReport.tsx`
- MODIFY: `PlaygroundE2eTab.tsx` — add "Retest Failures" button
- MODIFY: `AIAgentPlayground.tsx` — add retest batch logic

---

## 6. Recommended Phase Structure

### Phase 1: Persistent History + Prompt Hash (2-3 days)
- Replace in-memory `PlaygroundResultsTab` with DB-backed `BatchHistoryTab`
- Populate `prompt_hash` on every E2E save
- Add batch list view + batch detail view
- Add simple trend chart (pass rate over 30 days)

**Rationale:** Foundation for everything else. Cannot do regression detection without historical data accessible in UI. Low risk, mostly frontend.

### Phase 2: Admin Approval Flow (2-3 days)
- Build `ApprovalQueue` component
- Build `ReviewDrawer` for detailed failure inspection
- Add pending count badge to E2E tab
- Connect approve/reject to DB update

**Rationale:** Depends on browsable history (Phase 1). Admin needs to see the failures before they can approve/reject them. Low risk.

### Phase 3: Composite Score Bar (3-4 days)
- Build `useAgentScore` hook combining E2E + validator data
- Build `AgentScoreBar` with color zones, breakdown tooltip, trend sparkline
- Place in Playground header + Metricas tab
- Define scoring formula and thresholds

**Rationale:** Requires validator data (already in production) + E2E data (improved in Phase 1). The score formula needs careful calibration with real data.

### Phase 4: Automated Regression Cycle (4-5 days)
- Build regression detection comparing batches
- Build failure categorization with suggested actions
- Add "Retest Failures" button
- Enhance `e2e-scheduled` to save regression reports
- Optional: WhatsApp alert includes regression summary

**Rationale:** Most complex phase. Depends on historical batches (Phase 1) and score baseline (Phase 3). Higher risk because failure categorization rules need iteration.

### Total Estimate: 11-15 days

---

## 7. Architecture Patterns

### Data Flow
```
e2e-scheduled (cron every 6h)
  -> e2e-test (real WhatsApp + real ai-agent)
    -> e2e_test_runs (results saved)
      -> BatchHistoryTab (admin views)
        -> ApprovalQueue (admin reviews failures)
          -> regressionDetector (compares batches)
            -> AgentScoreBar (composite visualization)
```

### Component Boundaries
| Component | Responsibility | Data Source |
|-----------|---------------|-------------|
| `useE2eBatchHistory` | Fetch + cache batch history | `e2e_test_runs` via Supabase |
| `useAgentScore` | Compute composite score | `e2e_test_runs` + `ai_agent_validations` |
| `agentScoring.ts` | Pure scoring functions | None (pure computation) |
| `regressionDetector.ts` | Compare batches, detect regressions | Batch result arrays |
| `failureCategorizer.ts` | Map failures to suggestions | Failure pattern constants |
| `BatchHistoryTab` | Browse persistent batch history | `useE2eBatchHistory` |
| `ApprovalQueue` | Review + approve/reject failures | `e2e_test_runs` filtered |
| `AgentScoreBar` | Visualize composite score | `useAgentScore` |
| `RegressionReport` | Show regression analysis | `regressionDetector` output |

### Anti-Patterns to Avoid
1. **Do NOT build a separate "QA Dashboard" page.** Keep everything in the existing Playground page with additional tabs/panels. The admin is already familiar with this page.
2. **Do NOT store computed scores in the DB.** Compute on the fly from raw data. Stored scores become stale and create sync problems.
3. **Do NOT auto-edit prompts.** LLM-powered auto-tuning sounds cool but is unpredictable and could make things worse. Keep the human in the loop.
4. **Do NOT duplicate test scenarios in the DB.** Keep them hardcoded in `src/types/playground.ts`. DB storage adds complexity (versioning, migration) without clear benefit at this scale (22 scenarios).

---

## 8. Pitfalls

### Critical

#### Pitfall: E2E Tests Are Non-Deterministic
**What goes wrong:** LLM responses vary between runs. A scenario that passed yesterday might fail today with the exact same prompt.
**Why it happens:** Temperature > 0, LLM model updates, different context window content.
**Prevention:** 
- Use `temperature: 0.1` for E2E tests (not 0 — some models behave oddly at 0).
- Focus pass/fail criteria on tool usage (deterministic) not response text (non-deterministic).
- Accept 85% pass rate as "healthy" rather than requiring 100%.
- Track trends, not individual runs.

#### Pitfall: Approval Queue Becomes a Graveyard
**What goes wrong:** Admin never reviews pending approvals. Queue grows to 500+ items. Becomes useless.
**Prevention:** 
- Show pending count prominently (badge on Playground tab).
- Auto-expire old pending approvals after 7 days (mark as `expired`, not `rejected`).
- Weekly WhatsApp reminder if pending > 10.

#### Pitfall: Composite Score Gaming
**What goes wrong:** Score becomes the target instead of actual quality. Admin tweaks thresholds or disables failing tests to inflate the score.
**Prevention:** 
- Score is advisory, not a gate. No deployments blocked by score.
- Show sub-score breakdown always (no hiding behind aggregate).
- Track number of active vs disabled scenarios.

### Moderate

#### Pitfall: Real WhatsApp Messages During E2E
**What goes wrong:** E2E tests send real messages to a real phone number. If the number is a customer, they get confused by test messages.
**Prevention:** Already mitigated — test uses a dedicated number (`e2eNumber`). Add a warning if the number matches any existing lead's phone.

#### Pitfall: e2e-scheduled Costs
**What goes wrong:** 6 scenarios every 6 hours = 24 runs/day. Each run uses LLM tokens. At ~500 tokens/step with 2-3 steps average, that is ~36K tokens/day.
**Impact:** ~$0.50/day with gpt-4.1-mini. Acceptable.
**Prevention:** Monitor token usage in the score dashboard.

### Minor

#### Pitfall: Batch Race Conditions
**What goes wrong:** Two batch runs trigger simultaneously (manual + cron), creating interleaved results.
**Prevention:** Use `batch_id` to isolate. Frontend already generates unique batch IDs.

---

## 9. Technology Considerations

### No New Dependencies Needed
The entire QA framework can be built with existing stack:
- **Frontend:** React + TanStack Query + shadcn/ui (all already in use)
- **Charts:** Already using Recharts (in `ValidatorMetrics.tsx` and dashboard)
- **Backend:** Supabase client queries (no new edge functions for Phases 1-3)
- **DB:** Existing tables + possibly 1 new RPC for trend aggregation

### Why NOT Use an External Eval Framework
Tools like DeepEval, LangSmith Evaluation, or Confident AI are designed for generic LLM evaluation. WhatsPRO's testing needs are highly domain-specific:
- Tool usage correctness (8 specific tools)
- SDR qualification flow adherence
- Handoff trigger accuracy
- Validator Agent integration

Building on the existing custom infrastructure is more maintainable than integrating an external framework that would need extensive customization to match WhatsPRO's specific evaluation criteria.

---

## 10. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Current state analysis | HIGH | Direct codebase reading, all files verified |
| DB schema readiness | HIGH | Read actual migration SQL files |
| Phase 1 (History) | HIGH | Straightforward frontend work, data exists |
| Phase 2 (Approval) | HIGH | Schema ready, RLS ready, only UI |
| Phase 3 (Score) | MEDIUM | Formula needs calibration with real production data |
| Phase 4 (Auto cycle) | MEDIUM | Failure categorization rules will need iteration |
| Estimates | MEDIUM | Depend on developer familiarity with codebase |

---

## 11. Open Questions

1. **Should scenarios be editable by admin?** Currently hardcoded. Adding DB-stored custom scenarios would be a significant scope increase. Recommend deferring.
2. **Should the composite score block deployments?** Recommend NO — advisory only. CI/CD gating on LLM quality is fragile due to non-determinism.
3. **How many days of history to show by default?** Recommend 7 days with option for 14/30. Matches the 30-day retention policy.
4. **Should regression alerts go to WhatsApp?** The `e2e-scheduled` already sends failure alerts. Adding regression context ("3 scenarios regressed since last batch") would be high value, low effort.
5. **What is the target E2E pass rate?** Need baseline data. Run 5-10 batches over a week, then set threshold (likely 80-85%).

---

## Sources

- Codebase analysis: direct file reads of all relevant source files
- [Confident AI: Test Cases, Goldens, and Datasets](https://www.confident-ai.com/docs/llm-evaluation/core-concepts/test-cases-goldens-datasets)
- [Confident AI: Definitive AI Agent Evaluation Guide](https://www.confident-ai.com/blog/definitive-ai-agent-evaluation-guide)
- [Microsoft: AI Agent Performance Measurement](https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2026/02/04/ai-agent-performance-measurement/)
- [InfoQ: Evaluating AI Agents in Practice](https://www.infoq.com/articles/evaluating-ai-agents-lessons-learned/)
- [Maxim AI: Building a Golden Dataset](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/)
- [LangSmith Evaluation](https://www.langchain.com/evaluation)
