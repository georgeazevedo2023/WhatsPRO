---
phase: 06-padronizacao-de-data-fetching-e-error-boundaries
plan: "03"
subsystem: frontend-error-isolation
tags: [error-boundary, react, crash-isolation, deprecation]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [granular-error-boundaries, useSupabaseQuery-deprecated]
  affects: [DashboardHome, AIAgentPlayground, KanbanBoard, Broadcaster, LeadsBroadcaster]
tech_stack:
  added: []
  patterns: [ErrorBoundary class component wrapping, section prop for contextual error labels]
key_files:
  created: []
  modified:
    - src/pages/dashboard/DashboardHome.tsx
    - src/pages/dashboard/AIAgentPlayground.tsx
    - src/pages/dashboard/KanbanBoard.tsx
    - src/pages/dashboard/Broadcaster.tsx
    - src/pages/dashboard/LeadsBroadcaster.tsx
    - src/hooks/useSupabaseQuery.ts
decisions:
  - AIAgentPlayground tabs wrap individual tab components (not TabsContent) — all tabs render simultaneously, each gets its own boundary
  - KanbanBoard boundary placed inside page container, wrapping board content + CardDetailSheet but NOT header/nav
  - Broadcaster and LeadsBroadcaster boundaries wrap entire return JSX (single-responsibility pages)
  - useSupabaseQuery.ts file preserved unchanged except for JSDoc block addition — no logic removed
metrics:
  duration: "15m"
  completed: "2026-03-30"
  tasks: 2
  files_modified: 6
---

# Phase 06 Plan 03: ErrorBoundary Isolation + useSupabaseQuery Deprecation Summary

One-liner: 9 ErrorBoundary wrappers isolating 5 dashboard pages into crash-safe sections, and @deprecated JSDoc added to useSupabaseQuery.ts.

## What Was Built

### Task 1: ErrorBoundary Wrappers (9 total)

Added `import { ErrorBoundary } from '@/components/ErrorBoundary'` and wrapped specified sections across 5 pages:

**DashboardHome.tsx — 3 boundaries:**
- `section="Estatisticas"` — wraps KPI cards grid + secondary KPIs collapsible
- `section="Graficos"` — wraps 3 LazySection blocks (DashboardCharts, BusinessHoursChart, TopContactReasons)
- `section="Helpdesk e Grupos"` — wraps Instance Groups Breakdown, HelpdeskMetricsCharts, AgentPerformanceCard, E2eStatusCard, Recent Instances

**AIAgentPlayground.tsx — 3 boundaries:**
- `section="Playground Manual"` — wraps PlaygroundManualTab component
- `section="Playground Cenarios"` — wraps PlaygroundScenariosTab component
- `section="Playground E2E"` — wraps PlaygroundE2eTab component
- ResultsTab left without boundary per D-04 ("ResultsTab pode ser simples")

**KanbanBoard.tsx — 1 boundary:**
- `section="Kanban Board"` — wraps board content (DndContext + columns + DragOverlay + CardDetailSheet), header/toolbar excluded

**Broadcaster.tsx — 1 boundary:**
- `section="Broadcast"` — wraps entire multi-step broadcast flow

**LeadsBroadcaster.tsx — 1 boundary:**
- `section="Broadcast Leads"` — wraps entire leads broadcast flow

### Task 2: Deprecate useSupabaseQuery.ts

Added JSDoc block immediately before the `export function useSupabaseQuery<T>(` line:

```typescript
/**
 * @deprecated Use React Query (useQuery/useMutation from @tanstack/react-query) instead.
 * Remaining usages in Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx
 * will be migrated in a future phase.
 * @see src/components/admin/SecretsTab.tsx — reference migration pattern
 */
```

Function logic, interfaces, and exports unchanged.

## Verification

- DashboardHome.tsx: 7 occurrences of `ErrorBoundary` (import + 3 open + 3 close)
- AIAgentPlayground.tsx: 7 occurrences of `ErrorBoundary` (import + 3 open + 3 close)
- KanbanBoard.tsx: 3 occurrences of `ErrorBoundary` (import + 1 open + 1 close)
- Broadcaster.tsx: 3 occurrences of `ErrorBoundary` (import + 1 open + 1 close)
- LeadsBroadcaster.tsx: 3 occurrences of `ErrorBoundary` (import + 1 open + 1 close)
- useSupabaseQuery.ts: `@deprecated` annotation present
- DashboardHome.tsx, Leads.tsx, LeadDetail.tsx: 0 occurrences of `useSupabaseQuery`
- TypeScript: zero NEW errors introduced (pre-existing errors unchanged)
- App.tsx: NOT modified

## Decisions Made

- AIAgentPlayground renders all 4 tabs simultaneously (not via TabsContent conditional render), so each tab component gets its own wrapping boundary rather than a shared parent
- PlaygroundResultsTab left without a boundary per D-04 directive
- KanbanBoard header and navigation excluded from ErrorBoundary — only board interactivity isolated
- Broadcaster and LeadsBroadcaster are single-flow pages so entire return JSX wrapped (header included in boundary)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan adds ErrorBoundary wrappers only and deprecates a hook annotation. No stubs introduced.

## Self-Check: PASSED
