---
phase: 06-padronizacao-de-data-fetching-e-error-boundaries
plan: "02"
subsystem: frontend-dashboard
tags: [react-query, useQuery, realtime, dashboard, data-fetching]
dependency_graph:
  requires: []
  provides: [DashboardHome-react-query]
  affects: [src/pages/dashboard/DashboardHome.tsx]
tech_stack:
  added: []
  patterns: [useQuery, useQueryClient, DASHBOARD_KEYS, Realtime-invalidateQueries]
key_files:
  created: []
  modified:
    - src/pages/dashboard/DashboardHome.tsx
decisions:
  - "DASHBOARD_KEYS constant defined with 3 keys: main, helpdeskLeads, groupsStats"
  - "buildQuery helper replaced with applyDbFilter(q: any) + eslint-disable to avoid Supabase deep type instantiation error"
  - "weekRes.data entries cast to { created_at: string | null }[] to satisfy noImplicitAny"
  - "Groups stats query uses enabled: rawInstances.length > 0 (replaces setTimeout 100ms)"
  - "staleTime: 5 * 60 * 1000 on groups stats — UAZAPI calls expensive, cache for 5min"
  - "Realtime callback calls queryClient.invalidateQueries per D-01 (not direct setState)"
metrics:
  duration_seconds: 297
  completed_date: "2026-03-30"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 06 Plan 02: DashboardHome React Query Migration Summary

**One-liner:** Migrated DashboardHome from 3 manual useState+useEffect fetch functions to 3 useQuery calls with DASHBOARD_KEYS and Realtime-triggered queryClient.invalidateQueries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate fetchData + fetchHelpdeskLeadsStats to useQuery | 83eafe2 | src/pages/dashboard/DashboardHome.tsx |

## What Was Built

DashboardHome.tsx fully migrated to React Query pattern:

1. **Query 1 — Main data** (`DASHBOARD_KEYS.main(isSuperAdmin)`): Parallel fetch of instances + user count. Key includes `isSuperAdmin` flag so re-runs if role changes.

2. **Query 2 — Helpdesk leads stats** (`DASHBOARD_KEYS.helpdeskLeads(filters.instanceId)`): Keyed by selected instanceId filter. Auto-refetches when filter changes (replaces `useEffect([filters.instanceId])`).

3. **Query 3 — Groups stats** (`DASHBOARD_KEYS.groupsStats(instanceIdsKey)`): Keyed by sorted join of instance IDs. Guards with `enabled: rawInstances.length > 0` and caches for 5 min (`staleTime: 5 * 60 * 1000`). Replaces `setTimeout(100ms)` artificial delay.

**Realtime subscription** preserved on `helpdesk-leads-realtime` channel — callback now calls `queryClient.invalidateQueries` instead of direct setState, per D-01.

**Removed state variables:** `rawInstances` (useState), `totalUsers` (useState), `loading` (useState), `loadingStats` (useState), `instanceStats` (useState), `helpdeskLeads` (useState) — all replaced by useQuery data/isLoading aliases.

**Removed functions:** `fetchData`, `fetchHelpdeskLeadsStats`, `fetchGroupsStats` — logic moved inline to queryFn.

**Removed useEffects:** `useEffect(() => fetchData(), [isSuperAdmin])` and `useEffect(() => fetchHelpdeskLeadsStats(...), [filters.instanceId])` — replaced by queryKey dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error in buildQuery helper**
- **Found during:** Task 1 verification
- **Issue:** Plan's `buildQuery(baseQuery: ReturnType<typeof supabase.from>)` caused TS2589 "Type instantiation is excessively deep" when passing already-chained `PostgrestFilterBuilder` arguments
- **Fix:** Renamed to `applyDbFilter(q: any)` with `eslint-disable-next-line @typescript-eslint/no-explicit-any`; cast `weekRes.data` to `{ created_at: string | null }[]` to satisfy noImplicitAny
- **Files modified:** src/pages/dashboard/DashboardHome.tsx
- **Commit:** 83eafe2

## Verification Results

- `grep -c "useQuery" DashboardHome.tsx` → **5** (>= 3 required)
- Old state setters (`setInstances|setTotalUsers|setLoading|setLoadingStats|setInstanceStats|setHelpdeskLeads`) → **0**
- `grep -c "invalidateQueries"` → **1** (Realtime callback)
- `grep -c "setTimeout"` → **0** (artificial delay removed)
- `grep -c "DASHBOARD_KEYS"` → **5** (constant defined + used in 3 queries)
- `grep -c "staleTime"` → **1** (groups stats query)
- `grep -c "enabled: rawInstances"` → **1** (groups stats guard)
- `grep -c "helpdesk-leads-realtime"` → **1** (Realtime channel preserved)
- TypeScript: zero new errors in DashboardHome.tsx

## Self-Check: PASSED
