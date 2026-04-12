# Domain Pitfalls

**Domain:** LLM Agent QA Framework
**Researched:** 2026-04-04

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: LLM Non-Determinism Makes Tests Flaky
**What goes wrong:** The same E2E scenario produces different results on different runs. A test that passed 3 times in a row suddenly fails, then passes again. Admin loses trust in the test suite.
**Why it happens:** LLM temperature > 0, model weights change between provider updates, context window content varies slightly.
**Consequences:** False negatives erode trust. Admin starts ignoring failures. Real regressions slip through.
**Prevention:**
- Evaluate on tool usage (deterministic: did agent call `search_products`?) not response text (non-deterministic: "did agent say the right thing?")
- Set a realistic pass threshold (80-85%, not 100%)
- Track trends over multiple batches, not individual run results
- Use low temperature (0.1) for E2E tests
- Auto-approve tests that fail < 15% of the time (flaky threshold)
**Detection:** Pass rate oscillates between 70-100% without any prompt changes.

### Pitfall 2: Approval Queue Rot
**What goes wrong:** Admin never reviews pending approvals. Queue grows indefinitely. Component becomes useless dead weight.
**Why it happens:** No urgency mechanism. Reviewing failures is tedious. Admin forgets the queue exists.
**Consequences:** Entire approval workflow becomes wasted development effort.
**Prevention:**
- Show pending count prominently in Playground header (red badge)
- Auto-expire pending approvals after 7 days (status: `expired`)
- Optional: weekly WhatsApp reminder if pending > 10
- Keep the review UI fast — drawer, not page navigation
- Pre-categorize failures (saves admin time understanding what happened)
**Detection:** Pending count keeps growing week over week.

### Pitfall 3: Score Gaming
**What goes wrong:** The composite score becomes the goal instead of actual agent quality. Admin disables failing scenarios, adjusts thresholds, or manipulates inputs to inflate the score.
**Why it happens:** Goodhart's law — "when a measure becomes a target, it ceases to be a good measure."
**Consequences:** Score shows 95 while real lead experience is poor.
**Prevention:**
- Score is advisory, never a deployment gate
- Always show sub-score breakdown (cannot hide behind aggregate)
- Track number of active scenarios (declining count is a red flag)
- Show "scenarios disabled" count alongside the score
**Detection:** Score goes up while validator average or customer complaints stay the same.

## Moderate Pitfalls

### Pitfall 1: Test Environment Drift from Production
**What goes wrong:** Playground E2E tests pass but production agent fails. Or vice versa.
**Why it happens:** E2E tests use `ai-agent-playground` (mock UAZAPI) for simulated tests, but `e2e-test` calls the real `ai-agent`. Different code paths, different tool execution.
**Prevention:** The E2E Real tab already uses the real `ai-agent` function. Only use E2E Real results for quality metrics. Simulated (Scenarios tab) is for quick iteration only.

### Pitfall 2: Prompt Hash Collisions / Meaninglessness
**What goes wrong:** Prompt hash changes even when the actual behavior-relevant part of the prompt did not change (e.g., admin edited a typo in the greeting).
**Why it happens:** Hash covers the full prompt including cosmetic sections.
**Prevention:** Hash only the behavior-critical prompt sections (SDR flow, product rules, handoff rules) not the full system prompt. Or accept that hash is approximate and focus on timestamp correlation.

### Pitfall 3: Cost Surprise from Frequent E2E Runs
**What goes wrong:** Admin enables more frequent cron (every 1 hour instead of 6) and token costs spike.
**Why it happens:** Each E2E run uses real LLM tokens + UAZAPI sends.
**Prevention:** Show estimated cost per batch in the UI. Default to 6-hour intervals. Cap manual batch runs at 3/day with a warning.

## Minor Pitfalls

### Pitfall 1: Batch ID Format Inconsistency
**What goes wrong:** Manual runs from Playground use `batch_${Date.now()}`, scheduled runs don't set batch_id.
**Prevention:** Ensure `e2e-scheduled` also sets a batch_id. Use consistent format: `batch_{source}_{timestamp}` (e.g., `batch_manual_1712345678`, `batch_cron_1712345678`).

### Pitfall 2: Timezone Issues in Trend Charts
**What goes wrong:** Daily aggregation uses UTC dates, but admin expects BRT (UTC-3). A test run at 22:00 BRT shows on the "next day" in the chart.
**Prevention:** Use `toZonedTime(BRAZIL_TZ)` from date-fns-tz (already in use for date dividers in ChatPanel).

### Pitfall 3: Stale React Query Cache After Batch Run
**What goes wrong:** Admin runs a batch, switches to History tab, sees old data.
**Prevention:** Invalidate `['e2e-batches']` query key after any batch completes.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Persistent History | Prompt hash meaninglessness | Hash only critical prompt sections OR accept approximate tracking |
| Phase 2: Approval Flow | Queue rot | Auto-expire after 7 days + prominent pending badge |
| Phase 3: Composite Score | Score formula is arbitrary initially | Start with equal weights, calibrate after 2 weeks of data |
| Phase 3: Composite Score | Score gaming | Advisory only, always show breakdown |
| Phase 4: Regression Detection | False regression alerts from flaky tests | Require 2+ consecutive failures to flag as regression, not single run |
| Phase 4: Failure Categorization | Rules are incomplete initially | Start with 6-8 common patterns, add more as real failures surface |

## Sources

- [Confident AI: LLM Testing in 2026](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) — non-determinism strategies
- [InfoQ: Evaluating AI Agents in Practice](https://www.infoq.com/articles/evaluating-ai-agents-lessons-learned/) — hybrid evaluation approach
- Codebase analysis of existing test infrastructure
