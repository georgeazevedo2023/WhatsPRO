# Feature Landscape

**Domain:** LLM Agent QA Framework
**Researched:** 2026-04-04

## Table Stakes

Features the admin expects from a QA system. Missing = framework feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent test history | Results lost on page close is unacceptable | Low | DB data exists, need UI |
| Batch grouping | Multiple scenarios per run must be grouped | Low | `batch_id` column exists |
| Pass/fail summary per batch | Quick overview of agent health | Low | Aggregate query |
| Individual scenario detail view | Admin needs to see what went wrong | Medium | Expand existing E2E live steps |
| Approve/reject failed tests | Distinguish real regressions from LLM variance | Medium | DB schema ready |
| Composite health indicator | Single number for "is my agent OK?" | Medium | Formula + visualization |

## Differentiators

Features that elevate beyond basic QA. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Trend chart (pass rate over time) | Visual regression detection at a glance | Low | Recharts line chart |
| Prompt version tracking | Correlate quality changes to prompt edits | Low | `prompt_hash` column exists |
| Failure categorization with suggestions | Tells admin WHERE to fix, not just WHAT failed | Medium | Domain-specific rule mapping |
| One-click retest of failures | Rapid iteration after prompt tweaks | Low | Filter + re-run batch |
| Regression alerts via WhatsApp | Admin notified proactively | Low | `e2e-scheduled` already sends alerts |
| Score breakdown tooltip | Transparency into composite calculation | Low | UI only |
| Auto-expire stale pending approvals | Prevents approval queue rot | Low | 7-day TTL |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-prompt editing | LLM editing its own prompts is unpredictable and risky | Show suggestions, let admin decide |
| DB-stored editable scenarios | Adds versioning complexity for 22 scenarios | Keep hardcoded in TypeScript |
| Deployment gates based on score | Non-deterministic tests make hard gates unreliable | Advisory score only |
| Full prompt diff viewer | Over-engineered for this scale | Show hash + timestamp, admin remembers changes |
| External eval framework integration | Over-engineered, needs extensive customization | Build on existing custom infrastructure |
| Per-message approval workflow | Too granular, floods admin | Keep approval at scenario level |

## Feature Dependencies

```
Persistent History -> Approval Flow (need to browse before reviewing)
Persistent History -> Trend Chart (need historical data points)
Persistent History + Prompt Hash -> Regression Detection (compare batches by version)
E2E Data + Validator Data -> Composite Score (both data sources needed)
Regression Detection -> Suggested Actions (categorize failures first)
```

## MVP Recommendation

Prioritize:
1. Persistent batch history with trend chart (highest immediate value, admin currently loses all data)
2. Composite score bar (gives the "single number" the admin wants)
3. Approval flow (prevents approval queue from being useful only if queue is manageable)

Defer: Automated regression cycle — highest complexity, needs baseline data from Phases 1-3 to calibrate.

## Sources

- Codebase analysis of existing Playground functionality
- [Microsoft: AI Agent Performance Measurement](https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2026/02/04/ai-agent-performance-measurement/) — composite scoring approach
