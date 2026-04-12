import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Share2, TrendingUp, CheckCircle, UserX, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

// ── Tipos internos ────────────────────────────────────────────────────────────

interface FlowState {
  id: string
  flow_id: string
  lead_id: string
  status: 'active' | 'completed' | 'handoff' | 'abandoned'
  started_at: string
  completed_at: string | null
}

interface FlowEvent {
  id: string
  flow_id: string
  event_type: string
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  timing_breakdown: Record<string, unknown> | null
  cost_breakdown: Record<string, unknown> | null
  created_at: string
}

// ── Cores ────────────────────────────────────────────────────────────────────

const FUNNEL_COLORS = {
  iniciadas: '#6366f1',
  ativas: '#f59e0b',
  concluidas: '#22c55e',
  handoffs: '#ef4444',
}

const TIMING_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4']

const TIMING_LABELS: Record<string, string> = {
  intent_ms: 'Intent',
  resolve_ms: 'Resolve',
  context_ms: 'Context',
  subagent_ms: 'Subagent',
  validator_ms: 'Validator',
  send_ms: 'Send',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FlowMetricsPanelProps {
  flowId: string
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FlowMetricsPanel({ flowId }: FlowMetricsPanelProps) {
  const { toast } = useToast()

  // Query 1: flow_states
  const {
    data: states,
    isLoading: statesLoading,
  } = useQuery<FlowState[]>({
    queryKey: ['flow-states', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_states')
        .select('id, flow_id, lead_id, status, started_at, completed_at')
        .eq('flow_id', flowId)
      if (error) throw error
      return (data ?? []) as FlowState[]
    },
    enabled: !!flowId,
  })

  // Query 2: flow_events
  const {
    data: events,
    isLoading: eventsLoading,
  } = useQuery<FlowEvent[]>({
    queryKey: ['flow-events', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_events')
        .select('id, flow_id, event_type, input, output, timing_breakdown, cost_breakdown, created_at')
        .eq('flow_id', flowId)
      if (error) throw error
      return (data ?? []) as FlowEvent[]
    },
    enabled: !!flowId,
  })

  // Mutation: share link
  const shareMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('create_flow_report_share', {
        p_flow_id: flowId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: async (token: string) => {
      const url = `${window.location.origin}/flows/report/${token}`
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // fallback: abrir nova aba com a URL
        window.open(url, '_blank')
      }
      toast({
        title: 'Link copiado! Valido por 30 dias.',
        description: url,
      })
    },
    onError: () => {
      toast({ title: 'Erro ao gerar link de compartilhamento', variant: 'destructive' })
    },
  })

  const isLoading = statesLoading || eventsLoading

  // ── Calculos de metricas ────────────────────────────────────────────────────

  const total = states?.length ?? 0
  const completed = states?.filter((s) => s.status === 'completed').length ?? 0
  const handoffs = states?.filter((s) => s.status === 'handoff').length ?? 0
  const active = states?.filter((s) => s.status === 'active').length ?? 0

  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0'
  const handoffRate = total > 0 ? ((handoffs / total) * 100).toFixed(1) : '0.0'

  // Custo total: soma cost_breakdown.total_cost_usd de todos os eventos
  const totalCost = (events ?? []).reduce((acc, e) => {
    const cost = (e.cost_breakdown as any)?.total_cost_usd
    return acc + (typeof cost === 'number' ? cost : 0)
  }, 0)
  const totalCostFormatted = `$${totalCost.toFixed(4)} USD`

  // Funil de conversao
  const funnelData = [
    { name: 'Iniciadas', value: total, color: FUNNEL_COLORS.iniciadas },
    { name: 'Ativas', value: active, color: FUNNEL_COLORS.ativas },
    { name: 'Concluidas', value: completed, color: FUNNEL_COLORS.concluidas },
    { name: 'Handoffs', value: handoffs, color: FUNNEL_COLORS.handoffs },
  ]

  // Timing medio por camada
  const eventsWithTiming = (events ?? []).filter((e) => e.timing_breakdown != null)
  const timingKeys = ['intent_ms', 'resolve_ms', 'context_ms', 'subagent_ms', 'validator_ms', 'send_ms']
  const timingTotals: Record<string, number> = {}
  const timingCount: Record<string, number> = {}

  for (const e of eventsWithTiming) {
    for (const key of timingKeys) {
      const val = (e.timing_breakdown as any)?.[key]
      if (typeof val === 'number') {
        timingTotals[key] = (timingTotals[key] ?? 0) + val
        timingCount[key] = (timingCount[key] ?? 0) + 1
      }
    }
  }

  const totalTimingMs = timingKeys.reduce((acc, key) => {
    const avg = timingCount[key] > 0 ? timingTotals[key] / timingCount[key] : 0
    return acc + avg
  }, 0)

  const timingPieData = timingKeys
    .map((key, i) => {
      const avg = timingCount[key] > 0 ? Math.round(timingTotals[key] / timingCount[key]) : 0
      const pct = totalTimingMs > 0 ? ((avg / totalTimingMs) * 100).toFixed(1) : '0.0'
      return {
        name: TIMING_LABELS[key] ?? key,
        value: avg,
        pct,
        color: TIMING_COLORS[i % TIMING_COLORS.length],
      }
    })
    .filter((d) => d.value > 0)

  // Top 10 intents
  const intentCounts: Record<string, number> = {}
  for (const e of events ?? []) {
    const intent = (e.input as any)?.intent
    if (intent && typeof intent === 'string') {
      intentCounts[intent] = (intentCounts[intent] ?? 0) + 1
    }
  }
  const topIntents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const maxIntentCount = topIntents[0]?.[1] ?? 1

  // ── Empty state ─────────────────────────────────────────────────────────────

  const hasData = total > 0 || (events?.length ?? 0) > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Metricas do Fluxo</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => shareMutation.mutate()}
          disabled={shareMutation.isPending}
        >
          <Share2 className="h-4 w-4 mr-1.5" />
          {shareMutation.isPending ? 'Gerando...' : 'Compartilhar'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum dado ainda. Execute o fluxo para ver metricas aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Secao 1: KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Sessoes iniciadas"
              value={String(total)}
              color="text-indigo-500"
            />
            <KpiCard
              icon={<CheckCircle className="h-4 w-4" />}
              label="Taxa de conclusao"
              value={`${completionRate}%`}
              color="text-green-500"
            />
            <KpiCard
              icon={<UserX className="h-4 w-4" />}
              label="Taxa de handoff"
              value={`${handoffRate}%`}
              color="text-red-500"
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Custo total"
              value={totalCostFormatted}
              color="text-yellow-500"
            />
          </div>

          {/* Secao 2: Funil de conversao */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-4">Funil de conversao</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 24 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(value: number) => [value, 'Sessoes']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Secao 3: Timing medio por camada */}
          {timingPieData.length > 0 && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-4">Timing medio por camada</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={timingPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, pct }) => `${name}: ${pct}%`}
                    labelLine={false}
                  >
                    {timingPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value}ms (${props.payload.pct}%)`,
                      name,
                    ]}
                  />
                  <Legend
                    formatter={(value, entry: any) =>
                      `${value} — ${entry.payload.value}ms`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Secao 4: Top 10 intents */}
          {topIntents.length > 0 && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-4">Top 10 intents</h3>
              <div className="space-y-2">
                {topIntents.map(([intent, count]) => (
                  <div key={intent} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                        {intent}
                      </span>
                      <span className="text-xs font-medium ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${(count / maxIntentCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-componente KpiCard ────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}

function KpiCard({ icon, label, value, color }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  )
}
