# Phase 6: Padronizacao de Data Fetching e Error Boundaries — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Unificar o padrão de data fetching nos 3 arquivos alvo (DashboardHome.tsx, Leads.tsx, LeadDetail.tsx) migrando de `useSupabaseQuery`/`useState+useEffect` para React Query (`useQuery`/`useMutation`). Adicionar Error Boundaries granulares por seção lógica nas páginas especificadas. Implementar loading skeletons consistentes em todas as operações async do escopo.

Escopo estrito: `src/pages/dashboard/DashboardHome.tsx`, `src/pages/dashboard/Leads.tsx`, `src/pages/dashboard/LeadDetail.tsx` + adição de ErrorBoundary em Playground (3 tabs), Kanban board e Broadcast modal. Zero mudanças de backend. Zero novos comportamentos.

Os demais arquivos que usam `useSupabaseQuery` (Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx) ficam **fora** do escopo desta fase — serão migrados em fase futura.

</domain>

<decisions>
## Implementation Decisions

### Migração de Data Fetching

- **D-01:** Integração Realtime + React Query no DashboardHome: manter o canal Realtime como useEffect separado, mas no callback chamar `queryClient.invalidateQueries()` com a query key relevante. React Query dispara o refetch automaticamente. Padrão reconhecido — não criar abstração nova.
- **D-02:** `useSupabaseQuery.ts` recebe `@deprecated` JSDoc após a migração dos 3 arquivos alvo:
  ```ts
  /**
   * @deprecated Use React Query (useQuery/useMutation from @tanstack/react-query) instead.
   * Remaining usages in Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx
   * will be migrated in a future phase.
   */
  ```
  O arquivo NÃO é deletado nesta fase. Os arquivos remanescentes continuam funcionando.
- **D-03:** Query keys: usar prefixo descritivo por domínio (ex: `['dashboard-stats', instanceId]`, `['leads', instanceId, filters]`, `['lead-detail', contactId]`). Facilita invalidação granular no Realtime callback.

### Error Boundaries

- **D-04:** Granularidade: **seções lógicas**, não cards individuais. Específico por página:
  - **DashboardHome**: 3 blocos — (1) stats cluster, (2) charts section, (3) helpdesk/groups section
  - **Playground**: 3 tabs separadas — ManualTab, ScenariosTab, E2eTab (ResultsTab pode ser simples)
  - **Kanban board**: board inteiro como unidade
  - **Broadcast modal**: o modal como unidade
- **D-05:** Usar o `ErrorBoundary` existente (`src/components/ErrorBoundary.tsx`) — não criar novo componente. A prop `section` já permite contexto no error message.
- **D-06:** ErrorBoundary de rota em App.tsx **não é substituído** — os novos boundaries são adicionados _dentro_ das páginas, aninhados abaixo do boundary de rota.

### staleTime e Cache

- **D-07:** Confiar no QueryClient global configurado em `src/App.tsx`: `staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: true`. Nenhuma configuração adicional por query key. O comportamento stale-while-revalidate já está ativo por design do React Query.

### Loading Skeletons

- **D-08:** Usar o componente `Skeleton` existente (`@/components/ui/skeleton`) — já importado em DashboardHome. Inline skeletons per-section (sem criar componentes de skeleton compartilhados). DashboardHome já tem estrutura adequada — ajustar onde necessário.
- **D-09:** Loading state via `isLoading` do React Query (não mais `const [loading, setLoading] = useState(true)` manual).

### Claude's Discretion

- Organização dos query keys em constante ou inline: Claude decide baseado no volume (se >5 queries no mesmo arquivo, usar objeto de constantes; caso contrário inline).
- Se algum fetch em DashboardHome.tsx tiver dependência entre queries (fetch A depende do resultado de B), Claude pode usar `enabled: !!dependencyData` para encadear — sem consultar.
- Ordem de execução dos planos (DashboardHome primeiro vs Leads primeiro): Claude decide baseado em risco e dependências.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos de escopo direto (migração RQ)
- `src/pages/dashboard/DashboardHome.tsx` — useEffect+useState manual + Realtime subscription + parallel fetches
- `src/pages/dashboard/Leads.tsx` — mistura useInstances() (já RQ) com useState manual para leads
- `src/pages/dashboard/LeadDetail.tsx` — data fetching de contato, lead_profile, kanban, conversas

### Hook a deprecar
- `src/hooks/useSupabaseQuery.ts` — recebe @deprecated JSDoc; remanescentes (Intelligence, ScheduledMessages, Settings) fora do escopo

### Componente ErrorBoundary existente
- `src/components/ErrorBoundary.tsx` — class component com retry; prop `section` para contexto
- `src/App.tsx` — ErrorBoundary de rota já aplicado (não modificar, apenas aninhar dentro)

### Componentes que recebem ErrorBoundary interno
- `src/pages/dashboard/AIAgentPlayground.tsx` + `src/components/admin/ai-agent/playground/` — 3 tabs separadas
- `src/components/kanban/` (ou similar) — Kanban board como unidade
- Broadcast modal (localizar caminho exato durante planejamento)

### Config de React Query
- `src/App.tsx` (linhas ~51-60) — QueryClient global: staleTime 1min, gcTime 5min, retry 1

### Skeleton component
- Importar de `@/components/ui/skeleton` — já disponível via shadcn/ui

</canonical_refs>

<code_context>
## Existing Code Insights

### React Query já em uso (padrão de referência)
- `src/components/admin/SecretsTab.tsx` — useQuery + useMutation + invalidateQueries (modelo a seguir)
- `src/hooks/useCampaigns.ts` — múltiplos useQuery com query keys, useMutation com invalidação
- `src/components/broadcast/BroadcastHistory.tsx` — useQuery + deleteMutation + invalidateQueries

### useSupabaseQuery interface atual
```ts
// src/hooks/useSupabaseQuery.ts
useSupabaseQuery<T>({ queryFn, enabled, deps, shouldSkip, errorLabel })
  → { data: T[], loading: boolean, error: Error | null, refetch: () => Promise<void> }
// Equivalente RQ: useQuery({ queryKey, queryFn, enabled })
//   → { data, isLoading, error, refetch }
```

### Realtime no DashboardHome (padrão atual)
```ts
// useEffect com supabase.channel() que ouve INSERT em lead_database_entries
// Após migração: no callback do Realtime, chamar:
// queryClient.invalidateQueries({ queryKey: ['dashboard-stats', instanceId] })
```

### ErrorBoundary interface
```tsx
<ErrorBoundary section="Nome da Seção">
  {children}
</ErrorBoundary>
// section prop usada no error message: "Erro em Nome da Seção"
```

### QueryClient global
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 min
      gcTime: 5 * 60 * 1000,     // 5 min
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
```
</code_context>
