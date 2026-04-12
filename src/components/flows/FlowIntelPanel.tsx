import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Brain, MessageSquare, UserX, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FlowIntelPanelProps {
  flowId: string
}

// Row type inline — campos reais de flow_events
interface FlowEvent {
  id: string
  flow_id: string
  flow_state_id: string
  instance_id: string
  lead_id: string
  step_id: string | null
  subagent_type: string | null
  event_type: string
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  cost_breakdown: { total_cost_usd?: number } | null
  timing_breakdown: Record<string, unknown> | null
  error: string | null
  created_at: string
}

// Hook interno para buscar eventos do flow
function useFlowEvents(flowId: string) {
  return useQuery({
    queryKey: ['flow-events', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_events')
        .select('*')
        .eq('flow_id', flowId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as FlowEvent[]
    },
  })
}

// KPI card simples
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function FlowIntelPanel({ flowId }: FlowIntelPanelProps) {
  const { data: events = [], isLoading } = useFlowEvents(flowId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const total = events.length

  // Handoffs: event_type contendo 'handoff'
  const handoffCount = events.filter((e) => e.event_type.includes('handoff')).length
  const handoffRate = total > 0 ? Math.round((handoffCount / total) * 100) : 0

  // Custo total estimado via cost_breakdown.total_cost_usd
  const totalCost = events.reduce((sum, e) => {
    return sum + (e.cost_breakdown?.total_cost_usd ?? 0)
  }, 0)

  // Top intents — event_type === 'intent_detected', lê input.intent
  const intentCounts: Record<string, number> = {}
  events.forEach((e) => {
    if (e.event_type === 'intent_detected') {
      const intent = (e.input as { intent?: string } | null)?.intent
      if (intent) intentCounts[intent] = (intentCounts[intent] ?? 0) + 1
    }
  })
  const topIntents = Object.entries(intentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Validator stats (últimas 24h)
  const cutoff24h = new Date(Date.now() - 86_400_000)
  const recent = events.filter((e) => new Date(e.created_at) > cutoff24h)
  const validatorCorrections = recent.filter(
    (e) => e.event_type === 'validator_corrected'
  ).length
  const validatorBlocks = recent.filter(
    (e) => e.event_type === 'validator_blocked'
  ).length

  // 10 eventos mais recentes
  const recentEvents = events.slice(0, 10)

  const EVENT_TYPE_LABELS: Record<string, string> = {
    message_processed: 'Mensagem processada',
    intent_detected: 'Intent detectado',
    handoff_triggered: 'Handoff iniciado',
    flow_completed: 'Fluxo concluído',
    validator_corrected: 'Resposta corrigida',
    validator_blocked: 'Resposta bloqueada',
    followup_sent: 'Follow-up enviado',
    step_advanced: 'Step avançado',
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={MessageSquare} label="Total de eventos" value={total} />
        <KpiCard
          icon={UserX}
          label="Handoffs"
          value={handoffCount}
          sub={`${handoffRate}% do total`}
        />
        <KpiCard
          icon={DollarSign}
          label="Custo estimado"
          value={`$${totalCost.toFixed(4)}`}
          sub="USD (tokens LLM)"
        />
        <KpiCard
          icon={Brain}
          label="Intents únicos"
          value={Object.keys(intentCounts).length}
          sub={`${topIntents[0]?.[0] ?? '—'} mais frequente`}
        />
      </div>

      {/* Top Intents */}
      {topIntents.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Top Intents detectados</h3>
          <div className="space-y-2">
            {topIntents.map(([intent, count]) => (
              <div key={intent} className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {intent}
                </Badge>
                <span className="text-sm font-mono">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validator Stats (últimas 24h) */}
      {(validatorCorrections > 0 || validatorBlocks > 0) && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Validator (últimas 24h)</h3>
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-bold text-yellow-600">{validatorCorrections}</p>
              <p className="text-xs text-muted-foreground">Correções</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{validatorBlocks}</p>
              <p className="text-xs text-muted-foreground">Bloqueios</p>
            </div>
          </div>
        </div>
      )}

      {/* Últimos eventos */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">Últimos eventos</h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum evento registrado ainda. Execute o fluxo para ver dados aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Badge variant="outline" className="text-xs shrink-0">
                  {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(e.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
