import { useState } from 'react'
import { Loader2, History, ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { type E2eBatchSummary, type E2eBatchRun } from '@/types/playground'
import { useE2eBatchHistory, useE2eBatchRuns } from '@/hooks/useE2eBatchHistory'

interface BatchHistoryTabProps {
  agentId: string | null
}

function StatusBadge({ status }: { status: E2eBatchSummary['status'] }) {
  const map: Record<E2eBatchSummary['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    running:  { label: 'Rodando',  variant: 'default' },
    complete: { label: 'Completo', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Rejeitado', variant: 'destructive' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'outline' }
  return (
    <Badge
      variant={variant}
      className={
        status === 'approved'
          ? 'bg-green-600 hover:bg-green-700'
          : status === 'running'
          ? 'bg-blue-600 hover:bg-blue-700'
          : ''
      }
    >
      {label}
    </Badge>
  )
}

function RunTypeBadge({ runType }: { runType: E2eBatchSummary['run_type'] }) {
  const map: Record<string, string> = {
    manual:     'Manual',
    scheduled:  'Agendado',
    regression: 'Regressao',
  }
  return <span className="text-xs text-muted-foreground">{map[runType] ?? runType}</span>
}

function ScoreBar({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {passed}/{total}
      </span>
    </div>
  )
}

function BatchDetail({ batchId }: { batchId: string }) {
  const { data: runs, isLoading } = useE2eBatchRuns(batchId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Nenhum run neste batch.
      </p>
    )
  }

  return (
    <div className="space-y-1 mt-2">
      {runs.map((run: E2eBatchRun) => (
        <div
          key={run.id}
          className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/40 text-sm"
        >
          {run.passed
            ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {run.scenario_name ?? run.scenario_id ?? '—'}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              {run.category && (
                <span className="text-xs text-muted-foreground">{run.category}</span>
              )}
              {run.latency_ms != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {(run.latency_ms / 1000).toFixed(1)}s
                </span>
              )}
              {run.tools_used && run.tools_used.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ferramentas: {run.tools_used.join(', ')}
                </span>
              )}
            </div>
            {run.error && (
              <p className="text-xs text-red-400 mt-0.5 truncate">{run.error}</p>
            )}
          </div>
          {run.approval === 'auto_approved' ? (
            <ThumbsUp className="h-3 w-3 text-green-400 mt-1 shrink-0" />
          ) : run.approval === 'rejected' ? (
            <ThumbsDown className="h-3 w-3 text-red-400 mt-1 shrink-0" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function BatchHistoryTab({ agentId }: BatchHistoryTabProps) {
  const { data: batches, isLoading } = useE2eBatchHistory(agentId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <History className="h-8 w-8 opacity-40" />
        <p className="text-sm">Selecione um agente para ver o historico.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <History className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum batch registrado ainda.</p>
        <p className="text-xs">Execute E2E Real para criar o primeiro historico.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-muted-foreground mb-3">
        {batches.length} batch{batches.length !== 1 ? 'es' : ''} registrado{batches.length !== 1 ? 's' : ''}
      </p>
      {batches.map((batch: E2eBatchSummary) => {
        const isExpanded = expandedId === batch.id
        const date = new Date(batch.created_at).toLocaleString('pt-BR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={batch.id} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              onClick={() => setExpandedId(isExpanded ? null : batch.id)}
            >
              {isExpanded
                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{date}</span>
                  <RunTypeBadge runType={batch.run_type} />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <ScoreBar passed={batch.passed} total={batch.total} />
                  <StatusBadge status={batch.status} />
                  {batch.prompt_hash && (
                    <span className="text-xs text-muted-foreground font-mono">
                      #{batch.prompt_hash}
                    </span>
                  )}
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3 border-t bg-muted/20">
                <BatchDetail batchId={batch.id} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
