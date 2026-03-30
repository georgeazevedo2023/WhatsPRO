---
phase: 6
slug: padronizacao-de-data-fetching-e-error-boundaries
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | React Query migration DashboardHome | integration | `npx vitest run` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | React Query migration Leads | integration | `npx vitest run` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | React Query migration LeadDetail | integration | `npx vitest run` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | ErrorBoundary Dashboard sections | manual | visual verification | N/A | ⬜ pending |
| 06-02-02 | 02 | 2 | ErrorBoundary Playground tabs | manual | visual verification | N/A | ⬜ pending |
| 06-02-03 | 02 | 2 | ErrorBoundary Kanban board | manual | visual verification | N/A | ⬜ pending |
| 06-03-01 | 03 | 2 | Loading skeletons consistency | manual | visual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. vitest already configured and running.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ErrorBoundary isolates sections | Crash in 1 section doesn't crash others | Requires simulating render error | Temporarily throw in one section, verify others render |
| Loading skeletons visible | Loading states visible on all async ops | Visual verification | Throttle network in DevTools, verify skeletons appear |
| Stale-while-revalidate | Dashboard shows stale data while refreshing | Behavioral | Navigate away and back, verify instant data then refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
