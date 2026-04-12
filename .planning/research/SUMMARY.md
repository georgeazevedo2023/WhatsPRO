# Research Summary: Agent QA Framework (Milestone 2)

**Domain:** LLM Agent Testing / Quality Assurance
**Researched:** 2026-04-04
**Overall confidence:** HIGH

## Executive Summary

WhatsPRO already has ~70% of the infrastructure needed for a complete Agent QA Framework. The database schema supports approval workflows (`e2e_test_runs` with approval/batch columns), E2E tests run through real WhatsApp (`e2e-test` edge function), a scheduled runner with WhatsApp alerts exists (`e2e-scheduled`), and 22 test scenarios cover 17 categories. Two independent quality signals exist: Validator Agent scores (per-message, `ai_agent_validations`) and E2E pass/fail results (`e2e_test_runs`).

The gap is primarily UI/UX and workflow orchestration. The `PlaygroundResultsTab` only shows in-memory results (lost on page close). No UI exists for approving/rejecting failed tests despite DB columns being ready. No composite score aggregates the two quality signals. No regression detection compares batches over time.

The recommended approach builds entirely on existing infrastructure with no new dependencies. Four phases of 2-5 days each, totaling 11-15 days, progressively build: persistent history, approval workflow, composite scoring, and automated regression detection.

## Key Findings

**Stack:** No new dependencies needed. React + TanStack Query + shadcn/ui + Supabase queries. Recharts already available for charts.
**Architecture:** Two existing quality signal sources (validator + E2E) feed into a composite score computed client-side.
**Critical pitfall:** LLM non-determinism means E2E tests are inherently flaky. Target 80-85% pass rate, not 100%. Track trends, not individual runs.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Persistent History + Prompt Hash** (2-3 days)
   - Addresses: Backlog item 2 (batch history)
   - Avoids: Building on unstable foundation
   - Foundation for all subsequent phases

2. **Admin Approval Flow** (2-3 days)
   - Addresses: Backlog item 1 (approval workflow)
   - Avoids: Approval queue graveyard pitfall (add auto-expire + alerts)
   - Depends on Phase 1 (browsable history)

3. **Composite Score Bar** (3-4 days)
   - Addresses: Backlog item 3 (evolution bar)
   - Avoids: Score gaming (show sub-scores always)
   - Requires both data sources accessible

4. **Automated Regression Cycle** (4-5 days)
   - Addresses: Backlog item 4 (test-adjust-retest)
   - Avoids: Auto-prompt-editing (keep human in loop)
   - Highest complexity, most iteration needed

**Phase ordering rationale:**
- Phase 1 before Phase 2: Cannot review failures you cannot browse
- Phase 3 after Phase 1+2: Score needs historical data to calibrate
- Phase 4 last: Regression detection compares batches (needs history) and triggers retests

**Research flags for phases:**
- Phase 3: Composite score formula needs calibration with real production data (run baseline batches first)
- Phase 4: Failure categorization rules will need iteration based on actual failure patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new tech, all existing |
| Features | HIGH | Backlog items are well-defined |
| Architecture | HIGH | Building on proven existing infrastructure |
| Pitfalls | MEDIUM | Non-determinism risk is real but manageable |

## Gaps to Address

- Baseline E2E pass rate data needed before setting composite score thresholds
- Whether to make test scenarios editable by admin (currently hardcoded) — recommend deferring
- Optimal cron frequency for e2e-scheduled (currently 6h, may want configurable)
