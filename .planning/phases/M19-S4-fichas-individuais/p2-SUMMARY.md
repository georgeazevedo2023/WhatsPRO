---
phase: m19-s4
plan: p2
subsystem: dashboard-gestao
tags: [ficha-vendedor, hooks, recharts, drill-down, react-query]
dependency_graph:
  requires: [m19-s4-p1, m19-s3]
  provides: [useManagerInstances, useVendorDetail, VendorDetailPage, VendorTrendChart, VendorKPICards]
  affects: [ManagerDashboard, SellerRankingChart, App.tsx]
tech_stack:
  added: []
  patterns: [react-query useQuery parallel queries, as-any views, memo StatsCard grid, LazySection chart, useParams drill-down]
key_files:
  created:
    - src/hooks/useManagerInstances.ts
    - src/hooks/useVendorDetail.ts
    - src/components/gestao/VendorKPICards.tsx
    - src/components/gestao/VendorTrendChart.tsx
    - src/pages/dashboard/gestao/VendorDetailPage.tsx
  modified:
    - src/pages/dashboard/ManagerDashboard.tsx
    - src/components/manager/SellerRankingChart.tsx
    - src/App.tsx
decisions:
  - convIds derivado de convsRes fora do bloco NPS para ser acessível no bloco de ticket médio
  - useManagerInstances extraído sem alterar queryKey existente para não invalidar cache
  - VendorDetailPage importa useManagerInstances e ManagerFilters para reutilizar padrão de filtros
  - Rota gestao/vendedor/:sellerId usa CrmRoute (super_admin + gerente) igual à rota pai
metrics:
  duration_min: 20
  completed_date: "2026-04-13"
  tasks_completed: 3
  files_created: 5
  files_modified: 3
---

# Phase M19-S4 Plan P2: Ficha do Vendedor Summary

**One-liner:** Ficha individual do vendedor com hook useVendorDetail (3 queries paralelas), grid 6 KPIs, LineChart diário, drill-down click no ranking e rota /dashboard/gestao/vendedor/:sellerId.

## Tasks Executadas

| Task | Nome | Commit | Arquivos |
|------|------|--------|---------|
| 2.1 | useManagerInstances + useVendorDetail | c0f9a17 | hooks/useManagerInstances.ts, hooks/useVendorDetail.ts, ManagerDashboard.tsx |
| 2.2 | VendorKPICards + VendorTrendChart | 9e97453 | components/gestao/VendorKPICards.tsx, components/gestao/VendorTrendChart.tsx |
| 2.3 | VendorDetailPage + drill-down | de2380b | pages/dashboard/gestao/VendorDetailPage.tsx, SellerRankingChart.tsx, App.tsx |

## Decisões Tomadas

1. **convIds scope corrigido** — inicialmente definido dentro do bloco `if (pollIds.length > 0)`, o que tornava inacessível no bloco de ticket médio. Movido para escopo do queryFn antes do bloco NPS (Rule 1 — bug fix automático).

2. **useManagerInstances** — queryKey mantido idêntico ao inline original `['manager-instances']` para não invalidar cache existente no ManagerDashboard ao refatorar.

3. **Rota CrmRoute** — VendorDetailPage registrada com `<CrmRoute>` igual à rota pai `gestao`, garantindo acesso apenas a super_admin + gerente.

4. **VendorTrendChart** — dados `avgResolutionMin` passados no tooltip mas sem `dataKey` própria (linha não plotada), apenas exibido no tooltip como informação adicional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] convIds fora de escopo no useVendorDetail**
- **Found during:** Task 2.3 (revisão final antes do commit)
- **Issue:** `convIds` era `const` dentro de `if (pollIds.length > 0)`, mas usado em `if (convIds !== undefined && convIds.length > 0)` abaixo — TS compilava com exit 0 mas a condição seria sempre `false` em runtime
- **Fix:** Movido `const convIds = convRows.map(...)` para antes do bloco NPS, derivado de `convRows` que já existia no escopo
- **Files modified:** `src/hooks/useVendorDetail.ts`
- **Commit:** de2380b

## Known Stubs

Nenhum. Todos os 6 KPIs são calculados com dados reais do DB.

## Verification

- `tsc --noEmit`: exit 0 (zero erros)
- 3 commits atômicos criados
- useManagerInstances extraído sem mudança funcional em ManagerDashboard
- SellerRankingChart exibe cursor-pointer + hover no ranking

## Self-Check: PASSED

Arquivos criados:
- src/hooks/useManagerInstances.ts: FOUND
- src/hooks/useVendorDetail.ts: FOUND
- src/components/gestao/VendorKPICards.tsx: FOUND
- src/components/gestao/VendorTrendChart.tsx: FOUND
- src/pages/dashboard/gestao/VendorDetailPage.tsx: FOUND

Commits: c0f9a17, 9e97453, de2380b — todos presentes em git log.
