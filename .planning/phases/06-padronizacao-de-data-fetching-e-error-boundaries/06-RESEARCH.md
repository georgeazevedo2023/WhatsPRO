# Phase 06: Padronizacao de Data Fetching e Error Boundaries — Research

**Researched:** 2026-03-30
**Domain:** React Query migration + Error Boundary granularity in React 18 + TypeScript
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migração de Data Fetching**

- **D-01:** Realtime + React Query no DashboardHome: manter canal Realtime como `useEffect` separado; no callback chamar `queryClient.invalidateQueries()`. React Query dispara o refetch automaticamente. Padrão reconhecido — não criar abstração nova.
- **D-02:** `useSupabaseQuery.ts` recebe `@deprecated` JSDoc após a migração dos 3 arquivos alvo. O arquivo NÃO é deletado nesta fase. Os arquivos remanescentes (Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx) continuam funcionando.
- **D-03:** Query keys: usar prefixo descritivo por domínio (ex: `['dashboard-stats', instanceId]`, `['leads', instanceId, filters]`, `['lead-detail', contactId]`). Facilita invalidação granular no Realtime callback.

**Error Boundaries**

- **D-04:** Granularidade por seção lógica (não cards individuais):
  - **DashboardHome**: 3 blocos — (1) stats cluster, (2) charts section, (3) helpdesk/groups section
  - **Playground**: 3 tabs separadas — ManualTab, ScenariosTab, E2eTab (ResultsTab pode ser simples)
  - **Kanban board**: board inteiro como unidade
  - **Broadcast modal**: o modal como unidade
- **D-05:** Usar `ErrorBoundary` existente (`src/components/ErrorBoundary.tsx`) — não criar novo componente. A prop `section` já permite contexto no error message.
- **D-06:** ErrorBoundary de rota em App.tsx **não é substituído** — os novos boundaries são adicionados _dentro_ das páginas, aninhados abaixo do boundary de rota.

**staleTime e Cache**

- **D-07:** Confiar no QueryClient global configurado em `src/App.tsx`: `staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: true`. Nenhuma configuração adicional por query key.

**Loading Skeletons**

- **D-08:** Usar componente `Skeleton` existente (`@/components/ui/skeleton`) — já importado em DashboardHome. Inline skeletons per-section, sem criar componentes compartilhados.
- **D-09:** Loading state via `isLoading` do React Query (não mais `const [loading, setLoading] = useState(true)` manual).

### Claude's Discretion

- Organização dos query keys em constante ou inline: usar objeto de constantes se >5 queries no mesmo arquivo; caso contrário, inline.
- Se algum fetch em DashboardHome.tsx tiver dependência entre queries (fetch A depende do resultado de B), usar `enabled: !!dependencyData` para encadear.
- Ordem de execução dos planos (DashboardHome primeiro vs Leads primeiro): decidir baseado em risco e dependências.

### Deferred Ideas (OUT OF SCOPE)

- Migração de Intelligence.tsx, ScheduledMessages.tsx e Settings.tsx (ficam para fase futura).
- Qualquer mudança de backend.
- Qualquer comportamento novo.
</user_constraints>

---

## Summary

Esta fase é uma migração de padrão de data fetching — sem mudanças de comportamento. O trabalho é mecânico mas requer atenção: substituir `useState+useEffect` e `useSupabaseQuery` por `useQuery`/`useMutation` do TanStack React Query v5 (já instalado: `@tanstack/react-query@5.83.0`), e adicionar `<ErrorBoundary>` nas seções lógicas especificadas.

O projeto já tem React Query funcionando em produção (SecretsTab, useCampaigns, BroadcastHistory, etc.). O padrão canônico a seguir está em `src/components/admin/SecretsTab.tsx`. O QueryClient global está configurado em `src/App.tsx` com os parâmetros corretos para stale-while-revalidate. O componente `ErrorBoundary` em `src/components/ErrorBoundary.tsx` já tem retry e prop `section`.

O maior risco da fase é a integração Realtime+ReactQuery no DashboardHome: o canal Supabase Realtime deve permanecer como `useEffect` separado, com o callback chamando `queryClient.invalidateQueries()`. Esse padrão é canônico na documentação do TanStack Query com Supabase e não exige abstração nova.

**Primary recommendation:** Executar as migrações em ordem de complexidade crescente: LeadDetail (1 useEffect monolítico → múltiplos useQuery independentes), depois Leads (fetchLeads já isolado em useCallback), depois DashboardHome (múltiplos useEffect + Realtime subscription). ErrorBoundaries ao final, como camada transversal.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | 5.83.0 | Data fetching, caching, stale-while-revalidate | Já instalado, QueryClient global configurado, usado em produção |
| react | 18.x | Framework | Projeto padrão |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/components/ui/skeleton | shadcn/ui (instalado) | Loading placeholders | isLoading = true, substituindo estados manuais |
| @/components/ErrorBoundary | local | Catch render crashes por seção | Em volta de cada bloco lógico independente |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useQuery` inline | hook customizado por feature | Hook customizado reduz boilerplate em uso múltiplo mas adiciona arquivos; inline é mais legível para migrações pontuais. Claude decide por volume (>5 queries = constantes). |
| `queryClient.invalidateQueries()` no Realtime | `queryClient.setQueryData()` otimístico | setQueryData exige parsear o payload do evento e mapear ao formato cacheado — mais frágil. invalidateQueries é mais simples e sempre correto. |

**Installation:**

Nenhuma instalação necessária — `@tanstack/react-query@5.83.0` já está no projeto.

---

## Architecture Patterns

### Query Key Convention (D-03)

```typescript
// Por domínio — prefixo descritivo + identificadores variáveis
const QUERY_KEYS = {
  dashboardStats: (instanceId: string | null) => ['dashboard-stats', instanceId],
  helpdeskLeads:  (instanceId: string | null) => ['helpdesk-leads', instanceId],
  groupsStats:    (instanceId: string | null) => ['groups-stats', instanceId],
} as const;

// Inline quando < 5 queries no arquivo:
queryKey: ['leads', selectedInstanceId]
queryKey: ['lead-detail', contactId]
```

### Pattern 1: useQuery com Supabase (padrão SecretsTab)

**What:** Substituir `useState([])+useEffect(fetch)+setLoading` por um único `useQuery`.
**When to use:** Qualquer fetch de leitura sem dependência de estado de formulário.

```typescript
// Source: src/components/admin/SecretsTab.tsx (padrão canônico no projeto)
const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
  queryKey: ['system-settings'],
  queryFn: async () => {
    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) throw error;
    return data;
  },
});
```

### Pattern 2: Dependência encadeada com `enabled`

**What:** Query B só executa quando Query A retornou dados.
**When to use:** LeadDetail — a busca de conversas depende do `contactId`; extração fields depende de `instanceId`.

```typescript
// Source: TanStack Query v5 docs — enabled option
const { data: contact } = useQuery({
  queryKey: ['lead-contact', contactId],
  queryFn: async () => { /* fetch contact */ },
  enabled: !!contactId,
});

const { data: conversations } = useQuery({
  queryKey: ['lead-conversations', contactId],
  queryFn: async () => { /* fetch convs */ },
  enabled: !!contact, // só executa após contact carregado
});
```

### Pattern 3: Realtime + React Query (D-01)

**What:** Manter canal Supabase Realtime como `useEffect` separado. No callback, chamar `queryClient.invalidateQueries()`.
**When to use:** DashboardHome — canal `helpdesk-leads-realtime` que ouve INSERT em `lead_database_entries`.

```typescript
// Padrão canônico para Supabase Realtime + React Query
const queryClient = useQueryClient();

useEffect(() => {
  const channel = supabase
    .channel('helpdesk-leads-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'lead_database_entries',
      filter: 'source=eq.helpdesk',
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-leads', filters.instanceId] });
    })
    .subscribe();

  return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
}, [filters.instanceId, queryClient]);
```

### Pattern 4: useMutation para operações de escrita

**What:** Substituir `async handleX() { setState; await supabase.update(); setState; }` por `useMutation`.
**When to use:** toggleIaBlock em Leads.tsx (update de `contacts.ia_blocked_instances`).

```typescript
// Source: src/components/admin/SecretsTab.tsx (updateMutation como referência)
const toggleIaMutation = useMutation({
  mutationFn: async ({ contactId, newBlocked }: { contactId: string; newBlocked: string[] }) => {
    const { error } = await supabase
      .from('contacts')
      .update({ ia_blocked_instances: newBlocked })
      .eq('id', contactId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['leads', selectedInstanceId] });
    toast.success('IA atualizada');
  },
  onError: (err) => handleError(err, 'Erro ao alterar IA', 'Leads'),
});
```

### Pattern 5: ErrorBoundary por seção lógica (D-04, D-05)

**What:** Envolver blocos lógicos independentes com `<ErrorBoundary section="nome">`.
**When to use:** Qualquer seção que pode crashar de forma independente (charts, tabs, board inteiro).

```tsx
// Source: src/components/ErrorBoundary.tsx — interface existente
import { ErrorBoundary } from '@/components/ErrorBoundary';

// DashboardHome — 3 blocos
<ErrorBoundary section="Stats">
  {/* KPI cards + collapsible details */}
</ErrorBoundary>

<ErrorBoundary section="Charts">
  {/* DashboardCharts + BusinessHoursChart + TopContactReasons */}
</ErrorBoundary>

<ErrorBoundary section="Helpdesk e Grupos">
  {/* HelpdeskMetricsCharts + AgentPerformanceCard + Instance groups + E2eStatusCard */}
</ErrorBoundary>

// AIAgentPlayground — por tab content
<ErrorBoundary section="Playground Manual">
  <PlaygroundManualTab ... />
</ErrorBoundary>
<ErrorBoundary section="Playground Cenários">
  <PlaygroundScenariosTab ... />
</ErrorBoundary>
<ErrorBoundary section="Playground E2E">
  <PlaygroundE2eTab ... />
</ErrorBoundary>

// KanbanBoard — board inteiro
<ErrorBoundary section="Kanban Board">
  {/* todo o conteúdo do board */}
</ErrorBoundary>

// Broadcaster / LeadsBroadcaster — modal como unidade
// Broadcaster.tsx usa um fluxo multi-step (não é um Dialog), então envolver o return inteiro:
<ErrorBoundary section="Broadcast">
  {/* step-based UI */}
</ErrorBoundary>
```

### Pattern 6: Skeleton loading per-section (D-08, D-09)

**What:** Substituir `if (loading) return <FullPageSkeleton />` por skeletons inline por seção, usando `isLoading` do React Query.
**When to use:** Todas as seções migradas — cada bloco tem seu próprio loading state.

```tsx
// Source: src/components/admin/SecretsTab.tsx (isLoading + Skeleton)
import { Skeleton } from '@/components/ui/skeleton';

// Por seção — não por página inteira
{isLoadingStats ? (
  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
    {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
  </div>
) : (
  <StatsCards ... />
)}
```

### Recommended Project Structure (sem mudanças)

```
src/
├── pages/dashboard/
│   ├── DashboardHome.tsx      # migração RQ: 2 useQuery + Realtime invalidation
│   ├── Leads.tsx              # migração RQ: 1 useQuery + 1 useMutation
│   └── LeadDetail.tsx         # migração RQ: múltiplos useQuery encadeados
├── hooks/
│   └── useSupabaseQuery.ts    # adicionar @deprecated JSDoc (não deletar)
└── components/
    ├── ErrorBoundary.tsx      # existente, sem modificação
    ├── kanban/                # ErrorBoundary no KanbanBoard.tsx pai
    └── admin/ai-agent/playground/  # ErrorBoundary por tab
```

### Anti-Patterns to Avoid

- **Page-level single QueryKey:** Colocar todo o fetch de uma página em um único `useQuery` com objeto gigante. Cada recurso independente deve ter seu próprio `useQuery` com sua query key — permite invalidação granular.
- **Refetch manual com boolean state:** Manter `[reloadKey, setReloadKey]` para forçar refetch. Substituir por `refetch()` do React Query ou `queryClient.invalidateQueries()`.
- **ErrorBoundary em cada card individual:** Granularidade excessiva gera overhead de manutenção. Manter blocos lógicos (D-04).
- **Deletar useSupabaseQuery.ts nesta fase:** Intelligence.tsx, ScheduledMessages.tsx e Settings.tsx ainda dependem do hook. Apenas adicionar JSDoc `@deprecated`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache + stale-while-revalidate | `useState` + `useEffect` + timestamp tracking | `useQuery` do React Query | SWR, dedup de requests, retry, gcTime já implementados |
| Loading + error + data states triplo | 3 `useState` separados | `{ data, isLoading, error }` do `useQuery` | Menos bugs, estado consistente |
| Invalidação após mutation | `refetch()` manual + reload | `queryClient.invalidateQueries()` no `onSuccess` | Invalida somente queries relevantes, não todas |
| Error fallback de seção | `state.hasError + conditional render` customizado | `<ErrorBoundary section="...">` existente | Já tem retry, log, estilo consistente com projeto |

**Key insight:** React Query já resolve cache, deduplicação, stale-while-revalidate e retry. A migração é remover código manual — não adicionar complexidade.

---

## Common Pitfalls

### Pitfall 1: reloadKey pattern não removido

**What goes wrong:** LeadDetail usa `[reloadKey, setReloadKey]` para forçar refetch quando convModalOpen fecha. Após migração para `useQuery`, o mesmo efeito é obtido com `queryClient.invalidateQueries(['lead-detail', contactId])`.
**Why it happens:** Padrão antigo para contornar ausência de React Query.
**How to avoid:** Identificar todos os `setReloadKey(k => k + 1)` e substituir por `queryClient.invalidateQueries()` no local correto.
**Warning signs:** `useState(0)` com nome `reloadKey`, `refreshKey`, `fetchKey` etc.

### Pitfall 2: Closure stale no Realtime callback

**What goes wrong:** O callback do canal Realtime captura `filters.instanceId` no momento do `useEffect`. Se o estado mudar, o callback ainda chama `invalidateQueries` com a query key antiga.
**Why it happens:** O `useEffect` só re-executa quando as dependências mudam — mas se o canal for recriado a cada mudança de filtro, há flash de unsubscribe/subscribe.
**How to avoid:** Incluir `filters.instanceId` no array de dependências do `useEffect` do Realtime (padrão já presente no código atual — manter). A cada mudança de instanceId, o canal é recriado com a query key correta.
**Warning signs:** `queryClient.invalidateQueries` dentro de callback que não lista `queryClient` nas dependências.

### Pitfall 3: `isLoading` vs `isPending` no React Query v5

**What goes wrong:** No React Query v5, `isLoading` é `true` quando a query está buscando dados pela primeira vez E não tem dados em cache. `isPending` é `true` quando não há dados (mesmo se desabilitada). Para a maioria dos casos de skeleton inicial, `isLoading` é o correto.
**Why it happens:** A v5 renomeou alguns estados em relação à v4.
**How to avoid:** Usar `isLoading` para exibir skeletons de carregamento inicial (padrão já em SecretsTab). Usar `isFetching` para indicadores de refresh em background.
**Warning signs:** Skeleton nunca some, ou some antes dos dados chegarem.

### Pitfall 4: QueryFn retorna dado de forma diferente do useSupabaseQuery

**What goes wrong:** `useSupabaseQuery` retorna `T[]` e inicializa `data` com `[]`. O `useQuery` retorna `data: T[] | undefined` até o primeiro fetch. Código que faz `leads.map(...)` sem guard vai crashar se `data` for `undefined`.
**Why it happens:** API diferente entre os dois hooks.
**How to avoid:** Usar default value no destructuring: `const { data: leads = [] } = useQuery(...)`. Padrão já usado em SecretsTab: `const { data: settings = [], isLoading }`.
**Warning signs:** `Cannot read properties of undefined (reading 'map')` após migração.

### Pitfall 5: auto-save em LeadDetail — não migrar para useMutation

**What goes wrong:** LeadDetail tem um `autoSave` com debounce de 1s que persiste campos editáveis do lead_profile. Esse fluxo usa `setSaveStatus('saving'/'saved')` para feedback visual inline. Migrar para `useMutation` quebraria o feedback customizado de "Salvando..." / "Salvo".
**Why it happens:** useMutation tem `isPending` mas não tem estados `saved` distintos.
**How to avoid:** Manter o `autoSave` como `useCallback` com `setState` manual. Só migrar os fetches de leitura para `useQuery`. A regra do escopo é "zero useSupabaseQuery" — não "zero useState".
**Warning signs:** Remoção do `saveTimerRef` e `saveStatus` state.

---

## Code Examples

### Migração completa — DashboardHome fetch principal

```typescript
// Source: padrão de SecretsTab.tsx + D-01 do CONTEXT.md
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ANTES:
// const [rawInstances, setInstances] = useState<Instance[]>([]);
// const [totalUsers, setTotalUsers] = useState(0);
// const [loading, setLoading] = useState(true);
// useEffect(() => { fetchData(); }, [isSuperAdmin]);

// DEPOIS:
const DASHBOARD_KEYS = {
  main:          (isAdmin: boolean) => ['dashboard-main', isAdmin] as const,
  helpdeskLeads: (instanceId: string | null) => ['helpdesk-leads', instanceId] as const,
  groupsStats:   () => ['groups-stats'] as const,
} as const;

const { data: mainData, isLoading } = useQuery({
  queryKey: DASHBOARD_KEYS.main(isSuperAdmin),
  queryFn: async () => {
    const [instancesRes, usersRes] = await Promise.all([
      supabase.from('instances').select('*').eq('disabled', false).order('created_at', { ascending: false }),
      isSuperAdmin
        ? supabase.from('user_profiles').select('*', { count: 'exact', head: true })
        : Promise.resolve({ count: 0 }),
    ]);
    if (instancesRes.error) throw instancesRes.error;
    return {
      instances: (instancesRes.data || []) as Instance[],
      totalUsers: isSuperAdmin ? ((usersRes as any).count || 0) : 0,
    };
  },
});

const rawInstances = mainData?.instances ?? [];
const totalUsers   = mainData?.totalUsers ?? 0;
```

### Migração — useSupabaseQuery → useQuery (Leads.tsx)

```typescript
// ANTES:
// const [leads, setLeads] = useState<LeadData[]>([]);
// const [loading, setLoading] = useState(false);
// const fetchLeads = useCallback(async () => { ... setLeads(rows); }, [selectedInstanceId]);
// useEffect(() => { fetchLeads(); }, [fetchLeads]);

// DEPOIS:
const { data: leads = [], isLoading: loading } = useQuery({
  queryKey: ['leads', selectedInstanceId],
  queryFn: async (): Promise<LeadData[]> => {
    if (!selectedInstanceId) return [];
    // ... lógica do fetchLeads existente, sem setLeads/setLoading
    return leadRows;
  },
  enabled: !!selectedInstanceId,
});
```

### @deprecated JSDoc para useSupabaseQuery.ts (D-02)

```typescript
// Source: D-02 do CONTEXT.md
/**
 * @deprecated Use React Query (useQuery/useMutation from @tanstack/react-query) instead.
 * Remaining usages in Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx
 * will be migrated in a future phase.
 * @see src/components/admin/SecretsTab.tsx — reference migration pattern
 */
export function useSupabaseQuery<T>(
  options: UseSupabaseQueryOptions<T>,
): UseSupabaseQueryResult<T> {
  // ... código existente inalterado
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState+useEffect` para fetches | `useQuery` (React Query v5) | v5 lançado 2023, já instalado | Stale-while-revalidate, dedup, retry automáticos |
| `isLoading` como flag booleana no state | `isLoading` + `isFetching` do RQ | React Query v5 | Distinção entre first-load e background-refresh |
| `queryKey: ['resource']` como array inline | Objeto de constantes por domínio | Padrão de equipe (>5 queries) | Previne typos, facilita invalidação |
| `catch` + `setError` manual | `error` do `useQuery` | React Query v5 | Retry automático antes de expor erro |

**Deprecated/outdated:**
- `useSupabaseQuery.ts`: hook customizado que replica subset do React Query. Recebe `@deprecated` — não deletar nesta fase.
- `const [loading, setLoading] = useState(true)` combinado com `useEffect fetch`: substituído por `isLoading` do `useQuery`.
- `const [reloadKey, setReloadKey] = useState(0)` para forçar refetch: substituído por `queryClient.invalidateQueries()`.

---

## Open Questions

1. **Broadcaster.tsx — é uma página multi-step, não um modal Dialog**
   - O CONTEXT.md menciona "Broadcast modal" mas o arquivo `Broadcaster.tsx` é uma página de fluxo por etapas (instance → groups → message), não um Dialog.
   - `LeadsBroadcaster.tsx` tem estrutura similar.
   - O que pode ser o "modal" referido é o `BroadcastProgressModal.tsx` que aparece durante o envio.
   - **Recommendation:** Na ausência de um componente Dialog identificável como "broadcast modal", envolver o `return` principal de `Broadcaster.tsx` e `LeadsBroadcaster.tsx` com `<ErrorBoundary section="Broadcast">`. Confirmar com o usuário se o `BroadcastProgressModal` precisa de boundary próprio.

2. **fetchGroupsStats — lazy com setTimeout(100ms)**
   - Atualmente usa `setTimeout(() => fetchGroupsStats(instances), 100)` para não bloquear render inicial.
   - Após migração, pode usar `useQuery` com `enabled: rawInstances.length > 0` + `staleTime: Infinity` (stats de grupos da UAZAPI não mudam sem ação do usuário).
   - O botão "Refresh" chama `fetchGroupsStats` diretamente — com React Query, seria `refetch()` da query.
   - **Recommendation:** Migrar para `useQuery` com `enabled: rawInstances.length > 0` e `staleTime: 5 * 60 * 1000` (5 min). O setTimeout artificial é desnecessário pois `fetchGroupsStats` já é uma query separada que não bloqueia o render principal.

---

## Environment Availability

Step 2.6: SKIPPED — fase é puramente de mudanças em código frontend. Nenhuma dependência externa além do projeto em si. `@tanstack/react-query@5.83.0` já instalado e verificado.

---

## Validation Architecture

`workflow.nyquist_validation` não está definido em `.planning/config.json` — tratado como habilitado.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (inferido do projeto Vite + React) |
| Config file | `vite.config.ts` ou `vitest.config.ts` |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

Esta fase não tem IDs de requirements formais (phase requirement IDs: null). Os critérios de aceite do CONTEXT.md mapeiam para:

| Critério | Tipo de Teste | Verificação |
|----------|--------------|-------------|
| Zero useSupabaseQuery nos 3 arquivos alvo | Static grep | `grep -r "useSupabaseQuery" src/pages/dashboard/DashboardHome.tsx src/pages/dashboard/Leads.tsx src/pages/dashboard/LeadDetail.tsx` → zero resultados |
| Loading states visíveis | Visual / manual | Verificar skeleton em network throttle |
| Crash em 1 seção não derruba outras | Manual / smoke | Forçar erro em child de ErrorBoundary, confirmar outros blocos renderizam |
| stale-while-revalidate ativo | Comportamento herdado | QueryClient global já configurado com `staleTime: 60s` — não requer teste separado |

### Wave 0 Gaps

Nenhum arquivo de teste novo precisa ser criado para esta fase — a migração é de comportamento existente (sem novos comportamentos), e os critérios de aceite são verificáveis por grep estático e inspeção visual. Se testes unitários dos hooks migrados forem desejados, criariam arquivos em `src/pages/dashboard/__tests__/` — mas não são necessários para validar esta fase.

---

## Sources

### Primary (HIGH confidence)

- Código-fonte do projeto (lido diretamente):
  - `src/components/admin/SecretsTab.tsx` — padrão canônico useQuery+useMutation no projeto
  - `src/hooks/useCampaigns.ts` — useQuery com query keys, padrão de referência
  - `src/components/ErrorBoundary.tsx` — interface completa, props disponíveis
  - `src/App.tsx` — QueryClient global, configuração exata (staleTime 60s, gcTime 5min, retry 1)
  - `src/pages/dashboard/DashboardHome.tsx` — código atual completo
  - `src/pages/dashboard/Leads.tsx` — código atual completo
  - `src/pages/dashboard/LeadDetail.tsx` — código atual completo
  - `src/hooks/useSupabaseQuery.ts` — interface a ser deprecada
- `npm list @tanstack/react-query` — versão confirmada: 5.83.0

### Secondary (MEDIUM confidence)

- TanStack Query v5 docs — padrões de `enabled`, `invalidateQueries`, `isLoading` vs `isFetching` (conhecimento de treinamento verificado por código existente no projeto que usa a v5 corretamente)

### Tertiary (LOW confidence)

- Nenhum.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @tanstack/react-query@5.83.0 verificado por `npm list`, código existente confirma API v5
- Architecture: HIGH — padrões canônicos extraídos de código em produção no mesmo projeto
- Pitfalls: HIGH — identificados a partir da análise do código atual dos 3 arquivos alvo

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stack estável, sem fast-moving dependencies nesta fase)
