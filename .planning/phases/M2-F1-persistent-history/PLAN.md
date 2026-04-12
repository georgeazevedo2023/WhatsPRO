# Feature F1: Histórico Persistente de Batches

## Contexto

### O que existe hoje
- `e2e_test_batches` tabela criada por `20260404000001_create_e2e_test_batches.sql`
- `e2e_test_runs.batch_uuid UUID FK` aponta para `e2e_test_batches.id`
- `e2e_test_runs.batch_id TEXT` ainda existe (legado) — contém `batch_TIMESTAMP`
- `runAllE2e()` no frontend gera `batchId = batch_${Date.now()}`, salva em `batch_id TEXT`, mas NUNCA cria linha em `e2e_test_batches`
- `PlaygroundResultsTab` mostra apenas `runHistory[]` state em memória
- `types.ts` tem `e2e_test_batches` mas com estrutura diferente da migração nova (precisa regen)

### Discrepância crítica de schema
O `types.ts` atual tem `e2e_test_batches.batch_id: string` e `started_at/completed_at/metadata`.
A migração `20260404000001` tem `id UUID PK`, `created_at`, `status`, `approved_by`, `approved_at`, `reviewer_notes`, `prompt_hash`, `created_by`.
**Solução: regenerar `types.ts` antes de qualquer código frontend.**

---

## O que NÃO mudar

- `ai-agent-playground` edge function — processa turnos individuais, não gerencia batches
- `runE2eScenario()` — lógica interna inalterada, apenas recebe `batch_uuid` adicional
- `e2e_test_runs` existentes com `batch_id TEXT` — preservados como legado
- `PlaygroundManualTab`, `PlaygroundScenariosTab` — sem alterações
- `saveE2eResult()` signature existente — será incrementada, não substituída
- RLS e índices existentes — migração nova só adiciona, não remove
- `e2e-test` e `e2e-scheduled` edge functions — fora de escopo desta feature

---

## Tarefa 1 — Regenerar types.ts e adicionar tipos TypeScript para histórico

**Risco: MEDIUM**
**Depende de: nenhuma**

### Arquivo: `src/integrations/supabase/types.ts`

Verificar se o schema no `types.ts` atual bate com `20260404000001_create_e2e_test_batches.sql`.
A migração cria:

```sql
CREATE TABLE e2e_test_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_type TEXT NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled', 'regression')),
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  composite_score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  prompt_hash TEXT
);
```

O `types.ts` atual tem um schema diferente (`batch_id string`, `started_at`, `completed_at`, `metadata`).
Rodar `npx supabase gen types typescript --local > src/integrations/supabase/types.ts` após aplicar a migração.

Se regeneração não for possível em dev, atualizar manualmente o bloco `e2e_test_batches` em `types.ts`:

```typescript
e2e_test_batches: {
  Row: {
    id: string
    agent_id: string
    created_at: string
    run_type: string
    total: number
    passed: number
    failed: number
    composite_score: number | null
    status: string
    approved_by: string | null
    approved_at: string | null
    reviewer_notes: string | null
    created_by: string | null
    prompt_hash: string | null
  }
  Insert: {
    id?: string
    agent_id: string
    created_at?: string
    run_type?: string
    total?: number
    passed?: number
    failed?: number
    composite_score?: number | null
    status?: string
    approved_by?: string | null
    approved_at?: string | null
    reviewer_notes?: string | null
    created_by?: string | null
    prompt_hash?: string | null
  }
  Update: {
    id?: string
    agent_id?: string
    created_at?: string
    run_type?: string
    total?: number
    passed?: number
    failed?: number
    composite_score?: number | null
    status?: string
    approved_by?: string | null
    approved_at?: string | null
    reviewer_notes?: string | null
    created_by?: string | null
    prompt_hash?: string | null
  }
  Relationships: [
    {
      foreignKeyName: "e2e_test_batches_agent_id_fkey"
      columns: ["agent_id"]
      isOneToOne: false
      referencedRelation: "ai_agents"
      referencedColumns: ["id"]
    }
  ]
}
```

### Arquivo: `src/types/playground.ts`

Adicionar tipos para histórico de batches ao final do arquivo:

```typescript
// Batch history types (F1 — persistent history)
export interface E2eBatchSummary {
  id: string              // UUID da linha em e2e_test_batches
  agent_id: string
  created_at: string
  run_type: 'manual' | 'scheduled' | 'regression'
  total: number
  passed: number
  failed: number
  composite_score: number | null
  status: 'running' | 'complete' | 'approved' | 'rejected'
  prompt_hash: string | null
  created_by: string | null
}

export interface E2eBatchDetail extends E2eBatchSummary {
  runs: E2eBatchRun[]
}

export interface E2eBatchRun {
  id: string
  scenario_id: string
  scenario_name: string
  category: string | null
  passed: boolean
  tools_used: string[] | null
  tools_missing: string[] | null
  latency_ms: number | null
  error: string | null
  results: unknown   // JSON dos steps — typed as unknown, cast on render
  created_at: string
  approval: string | null
}
```

### Verificação
```
npx tsc --noEmit
```
Sem erros de tipo.

---

## Tarefa 2 — Criar hook `useE2eBatchHistory` e ciclo de vida do batch no frontend

**Risco: MEDIUM**
**Depende de: Tarefa 1**

### Arquivo novo: `src/hooks/useE2eBatchHistory.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { E2eBatchSummary, E2eBatchRun } from '@/types/playground'

// Lista de batches para um agente (últimos 30, mais recentes primeiro)
export function useE2eBatchHistory(agentId: string | null) {
  return useQuery<E2eBatchSummary[]>({
    queryKey: ['e2e-batch-history', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('e2e_test_batches')
        .select('id, agent_id, created_at, run_type, total, passed, failed, composite_score, status, prompt_hash, created_by')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as E2eBatchSummary[]
    },
  })
}

// Runs de um batch específico
export function useE2eBatchRuns(batchUuid: string | null) {
  return useQuery<E2eBatchRun[]>({
    queryKey: ['e2e-batch-runs', batchUuid],
    enabled: !!batchUuid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('e2e_test_runs')
        .select('id, scenario_id, scenario_name, category, passed, tools_used, tools_missing, latency_ms, error, results, created_at, approval')
        .eq('batch_uuid', batchUuid!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as E2eBatchRun[]
    },
  })
}

// Hook para criar batch e retornar UUID — usado no início de runAllE2e()
export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentId, runType, createdBy, promptHash }: {
      agentId: string
      runType: 'manual' | 'scheduled' | 'regression'
      createdBy: string
      promptHash: string | null
    }) => {
      const { data, error } = await supabase
        .from('e2e_test_batches')
        .insert({
          agent_id: agentId,
          run_type: runType,
          status: 'running',
          created_by: createdBy,
          prompt_hash: promptHash,
          total: 0,
          passed: 0,
          failed: 0,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string  // UUID
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['e2e-batch-history', variables.agentId] })
    },
  })
}

// Hook para finalizar batch com contagens
export function useCompleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchUuid, total, passed, failed, agentId }: {
      batchUuid: string
      total: number
      passed: number
      failed: number
      agentId: string
    }) => {
      const compositeScore = total > 0 ? Math.round((passed / total) * 100) : 0
      const { error } = await supabase
        .from('e2e_test_batches')
        .update({
          status: 'complete',
          total,
          passed,
          failed,
          composite_score: compositeScore,
        })
        .eq('id', batchUuid)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['e2e-batch-history', variables.agentId] })
    },
  })
}
```

### Arquivo: `src/pages/dashboard/AIAgentPlayground.tsx`

**Mudanças em `saveE2eResult`** — adicionar `batch_uuid` e `prompt_hash`:

```typescript
// Adicionar no topo do arquivo:
import { useCreateBatch, useCompleteBatch } from '@/hooks/useE2eBatchHistory'

// Dentro do componente AIAgentPlayground, adicionar os hooks:
const createBatch = useCreateBatch()
const completeBatch = useCompleteBatch()

// Modificar saveE2eResult — adicionar batch_uuid no insert:
const saveE2eResult = async (result: E2eRunResult, runType: 'single' | 'batch', batchId?: string, batchUuid?: string) => {
  if (!selectedAgentId || !selectedAgent?.instance_id) return
  try {
    // Compute prompt_hash client-side
    const rawPrompt = selectedAgent.system_prompt || selectedAgent.name || ''
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawPrompt))
    const promptHash = [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 12)

    await supabase.from('e2e_test_runs').insert({
      agent_id: selectedAgentId,
      instance_id: selectedAgent.instance_id,
      test_number: e2eNumber,
      scenario_id: result.scenario_id,
      scenario_name: result.scenario_name,
      total_steps: result.steps?.length || 0,
      passed: result.pass,
      results: result.steps || [],
      latency_ms: result.total_latency_ms || 0,
      error: result.error || null,
      run_type: runType,
      batch_id: batchId || null,        // TEXT legado (mantido)
      batch_uuid: batchUuid || null,    // UUID novo (F1)
      category: result.category,
      tools_used: result.tools_used || [],
      tools_missing: result.tools_missing || [],
      approval: result.pass ? 'auto_approved' : null,
      prompt_hash: promptHash,
    })
  } catch { /* silent — DB save is best-effort */ }
}
```

**Modificar `runAllE2e`** — criar batch no início, finalizar no fim:

```typescript
const runAllE2e = async () => {
  if (e2eRunning || batchRunning || !selectedAgentId) return
  const scenarios = filteredScenarios
  if (scenarios.length === 0) return
  setBatchRunning(true)
  batchAbortRef.current = false

  // Legado: batch_id TEXT (mantido para compatibilidade)
  const batchId = `batch_${Date.now()}`
  
  // F1: criar linha em e2e_test_batches e obter UUID
  let batchUuid: string | undefined
  const authUser = (await supabase.auth.getUser()).data.user
  if (authUser) {
    // Compute prompt hash para o batch
    const rawPrompt = selectedAgent?.system_prompt || selectedAgent?.name || ''
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawPrompt))
    const promptHash = [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 12)
    
    try {
      batchUuid = await createBatch.mutateAsync({
        agentId: selectedAgentId,
        runType: 'manual',
        createdBy: authUser.id,
        promptHash,
      })
    } catch { /* batch criado na melhor tentativa — continua sem UUID */ }
  }

  setBatchProgress({ current: 0, total: scenarios.length })
  setE2eResults([])
  let passed = 0
  let failed = 0

  for (let i = 0; i < scenarios.length; i++) {
    if (batchAbortRef.current) break
    setBatchProgress({ current: i + 1, total: scenarios.length })
    await runE2eScenario(scenarios[i], 'batch', batchId, batchUuid)
    if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 2000))
  }

  // Contar a partir do state (usar ref para evitar stale closure)
  // Melhor: contar diretamente pelo e2eResults coletados durante o loop
  // Nota: e2eResults state pode estar stale aqui — usar contador local
  // O loop acima não tem acesso direto ao resultado sem refatoração maior
  // Estratégia: finalizar batch com contagens do DB após breve delay
  if (batchUuid && selectedAgentId) {
    await new Promise(r => setTimeout(r, 1000)) // aguarda últimos saves
    try {
      const { data: runs } = await supabase
        .from('e2e_test_runs')
        .select('passed')
        .eq('batch_uuid', batchUuid)
      const total = runs?.length || 0
      const passedCount = runs?.filter(r => r.passed).length || 0
      const failedCount = total - passedCount
      await completeBatch.mutateAsync({
        batchUuid,
        total,
        passed: passedCount,
        failed: failedCount,
        agentId: selectedAgentId,
      })
    } catch { /* melhor tentativa */ }
  }

  setBatchRunning(false)
  toast.success(`Batch completo: ${passed} passou, ${failed} falhou de ${scenarios.length} cenários`, { duration: 8000 })
}
```

**Atualizar assinatura de `runE2eScenario`** para aceitar `batchUuid`:

```typescript
const runE2eScenario = async (
  scenario: TestScenario,
  runType: 'single' | 'batch' = 'single',
  batchId?: string,
  batchUuid?: string,   // NOVO
) => {
  // ... lógica existente inalterada ...
  await saveE2eResult(runResult, runType, batchId, batchUuid)
  // ... resto inalterado ...
}
```

**Adicionar estado para tab de histórico:**

```typescript
const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e' | 'history'>('manual')
```

### Verificação
Rodar batch completo (ao menos 2 cenários) no Playground.
Após conclusão:
```sql
SELECT id, status, total, passed, failed, created_at FROM e2e_test_batches ORDER BY created_at DESC LIMIT 5;
SELECT batch_uuid, passed, scenario_name FROM e2e_test_runs WHERE batch_uuid IS NOT NULL ORDER BY created_at DESC LIMIT 10;
```
Deve haver 1 linha em `e2e_test_batches` com `status='complete'` e `total = N cenários executados`.
Runs devem ter `batch_uuid` preenchido.

---

## Tarefa 3 — Criar componente `BatchHistoryTab` com lista e detalhe

**Risco: LOW**
**Depende de: Tarefas 1 e 2**

### Arquivo novo: `src/components/admin/ai-agent/playground/BatchHistoryTab.tsx`

Componente com dois estados: lista de batches e detalhe de batch selecionado.

**Props:**
```typescript
interface BatchHistoryTabProps {
  agentId: string | null
}
```

**Layout — Lista de batches:**
- Usa `useE2eBatchHistory(agentId)`
- Loading: `Loader2` spinner centralizado
- Vazio: mensagem "Nenhum batch registrado ainda. Execute E2E Real para criar o primeiro."
- Cada linha de batch: `<button>` clicável com:
  - Data/hora formatada (pt-BR, ex: "3 abr 2026, 14:32")
  - Badge de status: `running`=azul, `complete`=cinza, `approved`=verde, `rejected`=vermelho
  - Badge de run_type: `manual`=cinza, `scheduled`=roxo, `regression`=laranja
  - Barra de progresso inline: `passed/total` com cor verde/vermelha
  - Score: `composite_score%` ou `–` se nulo
  - Contadores: `N passou · M falhou · X total`
  - Ícone de hash se `prompt_hash` não nulo (Tooltip com hash)

**Layout — Detalhe de batch selecionado:**
- Botão "← Voltar" para retornar à lista
- Cabeçalho com data, status, score
- Usa `useE2eBatchRuns(selectedBatchId)`
- Cada run como card colapsável:
  - Header: ícone ✓/✗, nome do cenário, categoria badge, latência, approval badge
  - Expandido: tools_used (verde), tools_missing (vermelho), error (se houver)
  - Runs legados (sem `batch_uuid`) não aparecem aqui — aparecem na tab de histórico E2E

**Dados legados** (runs com `batch_id TEXT` mas sem `batch_uuid`):
- Agrupados separadamente se o usuário quiser acessá-los
- Por ora: nota no rodapé "Batches anteriores a esta versão aparecem em E2E Real > Histórico"
- NÃO criar query especial para legado nesta tarefa

**Implementação completa:**

```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, ArrowLeft, CheckCircle2, XCircle, Hash, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useE2eBatchHistory, useE2eBatchRuns } from '@/hooks/useE2eBatchHistory'
import type { E2eBatchSummary } from '@/types/playground'

export function BatchHistoryTab({ agentId }: { agentId: string | null }) {
  const [selectedBatch, setSelectedBatch] = useState<E2eBatchSummary | null>(null)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())

  const { data: batches, isLoading } = useE2eBatchHistory(agentId)
  const { data: runs, isLoading: runsLoading } = useE2eBatchRuns(selectedBatch?.id ?? null)

  // Toggle expand de run
  const toggleRun = (runId: string) =>
    setExpandedRuns(prev => {
      const next = new Set(prev)
      next.has(runId) ? next.delete(runId) : next.add(runId)
      return next
    })

  // ── DETALHE ──
  if (selectedBatch) {
    const passRate = selectedBatch.total > 0
      ? Math.round((selectedBatch.passed / selectedBatch.total) * 100)
      : 0

    return (
      <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setSelectedBatch(null)}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Button>
          <span className="text-sm font-medium">
            {format(new Date(selectedBatch.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
          </span>
          <StatusBadge status={selectedBatch.status} />
          <span className="ml-auto text-sm font-semibold">
            {selectedBatch.composite_score !== null ? `${selectedBatch.composite_score}%` : '–'}
          </span>
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="text-green-500">{selectedBatch.passed} passou</span>
          <span className="text-red-500">{selectedBatch.failed} falhou</span>
          <span>{selectedBatch.total} total</span>
        </div>

        {runsLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />}

        {!runsLoading && (!runs || runs.length === 0) && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhum run encontrado para este batch.
          </p>
        )}

        {runs?.map(run => {
          const isExpanded = expandedRuns.has(run.id)
          return (
            <div key={run.id} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent/50 transition-colors"
                onClick={() => toggleRun(run.id)}
              >
                {run.passed
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                }
                <span className="text-xs font-medium flex-1 truncate">{run.scenario_name}</span>
                {run.category && (
                  <Badge variant="outline" className="text-[9px] px-1 shrink-0">{run.category}</Badge>
                )}
                {run.latency_ms && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{run.latency_ms}ms</span>
                )}
                {run.approval && (
                  <ApprovalBadge approval={run.approval} />
                )}
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                }
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t bg-muted/20 flex flex-col gap-1.5">
                  {run.tools_used && run.tools_used.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {run.tools_used.map(t => (
                        <Badge key={t} variant="outline" className="text-[9px] px-1.5 border-green-500/40 text-green-600">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {run.tools_missing && run.tools_missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {run.tools_missing.map(t => (
                        <Badge key={t} variant="outline" className="text-[9px] px-1.5 border-red-500/40 text-red-500">
                          faltou: {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {run.error && (
                    <p className="text-[10px] text-red-400 font-mono bg-red-500/5 rounded p-1.5 mt-1">
                      {run.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Batches anteriores a esta versão estão na aba E2E Real
        </p>
      </div>
    )
  }

  // ── LISTA ──
  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto h-full">
      {isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />}

      {!isLoading && (!batches || batches.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhum batch registrado</p>
          <p className="text-xs text-muted-foreground">
            Execute "Rodar Todos" na aba E2E Real para criar o primeiro batch persistente.
          </p>
        </div>
      )}

      {batches?.map(batch => {
        const passRate = batch.total > 0 ? Math.round((batch.passed / batch.total) * 100) : 0
        return (
          <button
            key={batch.id}
            className="w-full border rounded-lg p-3 text-left hover:bg-accent/50 transition-colors flex flex-col gap-2"
            onClick={() => setSelectedBatch(batch)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium flex-1">
                {format(new Date(batch.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
              </span>
              <StatusBadge status={batch.status} />
              <RunTypeBadge runType={batch.run_type} />
              {batch.prompt_hash && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
                      <Hash className="w-2.5 h-2.5" />{batch.prompt_hash}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Hash do prompt neste batch</TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Progress
                value={passRate}
                className="flex-1 h-1.5"
              />
              <span className="text-xs font-semibold w-10 text-right">
                {batch.composite_score !== null ? `${batch.composite_score}%` : `${passRate}%`}
              </span>
            </div>

            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="text-green-500">{batch.passed} passou</span>
              <span className="text-red-500">{batch.failed} falhou</span>
              <span>{batch.total} total</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Sub-componentes internos
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    running:  { label: 'Rodando', className: 'border-blue-500/40 text-blue-500' },
    complete: { label: 'Completo', className: 'border-gray-500/40 text-gray-400' },
    approved: { label: 'Aprovado', className: 'border-green-500/40 text-green-500' },
    rejected: { label: 'Rejeitado', className: 'border-red-500/40 text-red-500' },
  }
  const cfg = map[status] ?? map.complete
  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 ${cfg.className}`}>
      {cfg.label}
    </Badge>
  )
}

function RunTypeBadge({ runType }: { runType: string }) {
  const map: Record<string, { label: string; className: string }> = {
    manual:     { label: 'Manual', className: 'border-gray-500/40 text-gray-400' },
    scheduled:  { label: 'Agendado', className: 'border-purple-500/40 text-purple-500' },
    regression: { label: 'Regressão', className: 'border-orange-500/40 text-orange-500' },
  }
  const cfg = map[runType] ?? map.manual
  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 ${cfg.className}`}>
      {cfg.label}
    </Badge>
  )
}

function ApprovalBadge({ approval }: { approval: string }) {
  const map: Record<string, { label: string; className: string }> = {
    auto_approved:   { label: 'Auto ✓', className: 'border-green-500/30 text-green-500' },
    human_approved:  { label: 'Aprovado', className: 'border-green-500/40 text-green-600' },
    human_rejected:  { label: 'Rejeitado', className: 'border-red-500/40 text-red-500' },
  }
  const cfg = map[approval]
  if (!cfg) return null
  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 shrink-0 ${cfg.className}`}>
      {cfg.label}
    </Badge>
  )
}
```

### Arquivo: `src/pages/dashboard/AIAgentPlayground.tsx`

Adicionar aba "Histórico" no TabsList e montar BatchHistoryTab:

```tsx
// Import novo no topo:
import { BatchHistoryTab } from '@/components/admin/ai-agent/playground/BatchHistoryTab'
import { History } from 'lucide-react'

// TabsList — adicionar após aba E2E:
<TabsTrigger value="history" className="gap-1.5 text-xs">
  <History className="w-3.5 h-3.5" />
  Histórico
</TabsTrigger>

// Após ErrorBoundary de E2E, adicionar:
<ErrorBoundary section="Playground Histórico">
  <BatchHistoryTab agentId={selectedAgentId} />
</ErrorBoundary>
```

Atualizar type do `activeTab`:
```typescript
const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e' | 'history'>('manual')
```

### Verificação
```
npm run build
```
Build sem erros.

Abrir Playground > aba "Histórico":
- Lista aparece (pode estar vazia se nenhum batch foi rodado ainda)
- Executar batch em E2E Real
- Recarregar aba Histórico → batch aparece com status, contagens, score
- Clicar no batch → ver detalhe com runs individuais

---

## Tarefa 4 — Migração de dados legados e validação final

**Risco: LOW**
**Depende de: Tarefas 1, 2, 3**

### O que NÃO fazer
NÃO criar batches retroativos no banco para runs com `batch_id TEXT` antigos.
Razão: runs legados têm `batch_id` como string (`batch_1711234567890`) mas sem FK. Criar batch fake retroativamente polui o histórico e confunde a progressão temporal.

### Estratégia para dados legados
Os runs antigos são visíveis na aba E2E Real (já exibida em memória).
Para o histórico DB:
1. Adicionar nota visual na aba Histórico quando `batches` está vazio: "Batches anteriores a esta versão não são migrados automaticamente. Execute um novo batch para iniciar o rastreamento."
2. NÃO tentar agrupar `batch_id TEXT` como `E2eBatchSummary` — schemas são incompatíveis.

### Verificação da FK `batch_uuid`
Confirmar que runs antigos (sem `batch_uuid`) NÃO aparecem na aba Histórico:
```sql
SELECT COUNT(*) FROM e2e_test_runs WHERE batch_uuid IS NULL;
-- Deve retornar N > 0 (runs legados existentes)

SELECT COUNT(*) FROM e2e_test_runs WHERE batch_uuid IS NOT NULL;
-- Deve retornar 0 antes do primeiro batch F1
-- Após executar batch F1: deve retornar = número de cenários rodados
```

### Arquivo: `supabase/migrations/` (verificação apenas — não criar nova migração)
A migração `20260404000001_create_e2e_test_batches.sql` já tem:
```sql
ALTER TABLE public.e2e_test_runs
  ADD COLUMN IF NOT EXISTS batch_uuid UUID REFERENCES public.e2e_test_batches(id) ON DELETE SET NULL;
```
`ON DELETE SET NULL` é correto — se um batch for deletado, os runs ficam orphaned com `batch_uuid=NULL` em vez de serem deletados.

Confirmar que a migração foi aplicada:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'e2e_test_runs' AND column_name = 'batch_uuid';
-- Deve retornar: batch_uuid | uuid
```

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Schema de `types.ts` diverge da migração real | ALTA | Tarefa 1 obrigatória — regenerar ou corrigir manualmente antes das outras tarefas |
| Stale closure em `runAllE2e` ao contar passed/failed | MÉDIA | Contar via query DB após 1s delay em vez de state local |
| `crypto.subtle.digest` indisponível (HTTP, não HTTPS) | BAIXA | Playground só roda em produção/localhost com HTTPS; fallback: `prompt_hash = null` se erro |
| Batch criado mas não finalizado (abort ou crash) | BAIXA | `status='running'` fica no DB — mostrar na lista com badge "Rodando". F2 (approval flow) poderá marcar stale batches |
| `useCreateBatch` / `useCompleteBatch` falham silenciosamente | BAIXA | Ambos são best-effort — batch creation failure não bloqueia E2E execution |
| Renderização de `results JSON` (E2eResult[]) sem tipagem | BAIXA | `E2eBatchRun.results: unknown` — detalhe de steps não renderizado nesta versão, apenas pass/fail summary |

---

## Ordem de Execução

```
Tarefa 1 (types.ts + tipos TS)
    ↓
Tarefa 2 (hook useE2eBatchHistory + mudanças em AIAgentPlayground)
    ↓
Tarefa 3 (BatchHistoryTab + nova aba)
    ↓
Tarefa 4 (validação legado + verificações SQL)
```

Tarefas 2 e 3 podem ser desenvolvidas em paralelo após Tarefa 1, mas Tarefa 3 depende do hook de Tarefa 2 para renderizar dados.

---

## Critérios de Conclusão da Feature F1

- [ ] `e2e_test_batches` recebe uma linha por batch executado via "Rodar Todos"
- [ ] Cada `e2e_test_runs` inserido durante batch tem `batch_uuid` preenchido
- [ ] Batch finaliza com `status='complete'`, `total/passed/failed` corretos
- [ ] `prompt_hash` (12 chars) preenchido em cada run e no batch
- [ ] Aba "Histórico" aparece no Playground sem quebrar outras abas
- [ ] Lista de batches mostra data, score, pass/fail counts, status badge
- [ ] Clicar em batch mostra runs individuais com tools usadas/faltando
- [ ] Runs legados (batch_id TEXT, sem batch_uuid) não causam erros — apenas não aparecem
- [ ] `npm run build` sem erros de tipo
- [ ] Não há chamadas com `as any` nos novos hooks ou componente
