import { memo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RegressionBadge } from './RegressionBadge'
import { useE2eBatchHistory } from '@/hooks/useE2eBatchHistory'

// Interface local para este componente (campos que usamos)
interface BatchItem {
  id: string
  batch_id_text: string | null
  run_type: string
  created_at: string
  total: number
  passed: number
  failed: number
  composite_score: number | null
  is_regression: boolean
  regression_context: {
    delta: number
    current_score: number
    previous_score: number
    consecutive_below_threshold: number
    failed_scenarios: Array<{ id: string; name: string; reason: string }>
  } | null
  status: string
}

interface Props {
  agentId: string | null
  onRetestBatch?: (batchUuid: string, batchIdText: string) => void
}

function ScoreDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null
  const delta = current - previous
  if (Math.abs(delta) < 1) return <Minus className="w-3 h-3 text-muted-foreground" />
  const isUp = delta > 0
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{delta.toFixed(0)}pts
    </span>
  )
}

export const BatchHistoryPanel = memo(({ agentId, onRetestBatch }: Props) => {
  const { data: batches, isLoading } = useE2eBatchHistory(agentId ?? '')

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      Carregando histórico...
    </div>
  )

  if (!batches?.length) return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      Nenhum batch registrado ainda.
    </div>
  )

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1.5 p-1">
        {(batches as unknown as BatchItem[]).map((batch, idx) => {
          const prev = (batches as unknown as BatchItem[])[idx + 1] ?? null
          const passRate = batch.total > 0 ? Math.round((batch.passed / batch.total) * 100) : null
          const hasFailed = batch.failed > 0

          return (
            <div
              key={batch.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                batch.is_regression
                  ? 'border-red-500/30 bg-red-500/5'
                  : hasFailed
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-border/50 bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(batch.created_at), { locale: ptBR, addSuffix: true })}</span>
              </div>

              <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                {batch.run_type === 'scheduled' ? 'auto' : 'manual'}
              </Badge>

              <div className="flex items-center gap-1.5">
                <span className={`font-mono font-bold ${
                  passRate !== null && passRate >= 80 ? 'text-emerald-400' :
                  passRate !== null && passRate >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {passRate !== null ? `${passRate}%` : '—'}
                </span>
                <ScoreDelta
                  current={batch.composite_score}
                  previous={prev?.composite_score ?? null}
                />
              </div>

              <span className="text-muted-foreground">
                {batch.passed}/{batch.total} pass
              </span>

              <RegressionBadge batch={batch} />

              <div className="flex-1" />

              {hasFailed && onRetestBatch && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => onRetestBatch(batch.id, batch.batch_id_text || batch.id)}
                >
                  <Play className="w-2.5 h-2.5" />Re-testar
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
})
BatchHistoryPanel.displayName = 'BatchHistoryPanel'
