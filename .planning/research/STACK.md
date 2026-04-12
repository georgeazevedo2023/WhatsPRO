# Technology Stack

**Project:** Agent QA Framework (Milestone 2)
**Researched:** 2026-04-04

## Recommended Stack

No new technologies needed. Build entirely on existing WhatsPRO stack.

### Core (Already in Use)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React 18 | 18.x | UI components | Already the frontend framework |
| TanStack React Query 5 | 5.x | Data fetching + caching | Already used for all Supabase queries |
| shadcn/ui | latest | UI components (cards, badges, drawers) | Already the component library |
| Supabase Client | latest | DB queries, RLS-protected | Already the backend |

### Visualization
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | 2.x | Trend charts, score sparklines | Already used in ValidatorMetrics + dashboard |

### Backend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Edge Functions (Deno) | - | E2E test execution | `e2e-test` and `e2e-scheduled` already exist |
| PostgreSQL | 17 | Data storage, RPC functions | Already the database |

### Supporting Libraries (Already Available)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| date-fns + ptBR locale | Date formatting for batch history | Already used in E2eStatusCard |
| crypto.subtle | SHA-256 for prompt hash | Built into browser, no import needed |
| Vaul (drawer) | Review drawer for approval flow | Already used for TicketResolutionDrawer |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Eval Framework | Custom (existing) | DeepEval / LangSmith | Over-engineered for 22 domain-specific scenarios. External frameworks need extensive customization to match WhatsPRO's 8-tool evaluation criteria. |
| Score Storage | Client-side computation | DB-stored aggregate | Small data volume (<2000 rows). Stored scores create staleness/sync issues. |
| Charts | Recharts (existing) | Chart.js / D3 | Already in bundle, team knows it |
| Batch Comparison | Custom diff logic | External diffing lib | Simple array comparison, no library needed |

## Installation

```bash
# No new packages needed
# All dependencies already in package.json
```

## Sources

- Direct codebase analysis of existing dependencies
- [Confident AI: Definitive AI Agent Evaluation Guide](https://www.confident-ai.com/blog/definitive-ai-agent-evaluation-guide) — confirms custom evaluation is common for domain-specific agents
