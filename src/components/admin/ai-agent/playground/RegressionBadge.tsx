import { AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

// Definição inline para evitar dependência circular
interface RegressionContext {
  delta: number
  current_score: number
  previous_score: number
  consecutive_below_threshold: number
  failed_scenarios: Array<{ id: string; name: string; reason: string }>
}

interface BatchWithRegression {
  is_regression: boolean
  regression_context: RegressionContext | null
}

interface Props {
  batch: BatchWithRegression
}

export const RegressionBadge = ({ batch }: Props) => {
  if (!batch.is_regression) return null
  const ctx = batch.regression_context

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="destructive" className="text-[10px] px-1.5 gap-0.5 cursor-help">
          <AlertTriangle className="w-2.5 h-2.5" />
          REGRESSÃO {ctx ? `${ctx.delta > 0 ? '+' : ''}${ctx.delta.toFixed(0)}pts` : ''}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs space-y-1">
        {ctx && (
          <>
            <p className="font-medium">Score: {ctx.current_score} (era {ctx.previous_score})</p>
            {ctx.failed_scenarios?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {ctx.failed_scenarios.map((s) => (
                  <li key={s.id} className="text-red-400">❌ {s.name}: {s.reason}</li>
                ))}
              </ul>
            )}
            {ctx.consecutive_below_threshold >= 2 && (
              <p className="text-amber-400">{ctx.consecutive_below_threshold} batches consecutivos abaixo do threshold</p>
            )}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
