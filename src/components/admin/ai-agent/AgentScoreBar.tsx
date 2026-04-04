import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAgentScore } from '@/hooks/useAgentScore';
import {
  getScoreColor, getScoreBarColor, type ScoreTier, type ScoreBreakdown,
} from '@/lib/agentScoring';

interface AgentScoreBarProps {
  agentId: string | null;
  compact?: boolean;
}

function ScoreRow({
  label, value, weight, count,
}: { label: string; value: number; weight: string; count?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label} ({weight})</span>
      <Progress value={value} className="h-1 flex-1" />
      <span className="text-[10px] font-mono w-8 text-right">{Math.round(value)}</span>
      {count && <span className="text-[10px] text-muted-foreground">{count}</span>}
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function BreakdownTooltip({
  hasData, breakdown, tier,
}: { hasData: boolean; breakdown: ScoreBreakdown; tier: ScoreTier }) {
  if (!hasData) {
    return <p className="text-xs text-muted-foreground">Sem dados nos últimos 7 dias</p>;
  }
  return (
    <div className="space-y-2 w-[240px]">
      <p className="text-xs font-semibold mb-2">Score Composto — últimos 7 dias</p>
      <div className="space-y-1.5">
        <ScoreRow
          label="E2E Pass Rate"
          value={breakdown.e2ePassRate}
          weight="40%"
          count={`${breakdown.e2eRunCount} runs`}
        />
        <ScoreRow
          label="Validator Avg"
          value={breakdown.validatorAvg}
          weight="30%"
          count={`${breakdown.validationCount} msgs`}
        />
        <ScoreRow label="Tool Accuracy" value={breakdown.toolAccuracy} weight="20%" />
        <ScoreRow label="Latência" value={breakdown.latencyScore} weight="10%" />
      </div>
      <Separator className="my-2" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Score Final</span>
        <span className={cn('text-sm font-bold', getScoreColor(tier))}>
          {breakdown.composite}/100
        </span>
      </div>
    </div>
  );
}

export function AgentScoreBar({ agentId, compact = true }: AgentScoreBarProps) {
  const { breakdown, tier, dailyScores, trend, hasData, isLoading } = useAgentScore(agentId);

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              {/* Score number */}
              <span className={cn('text-sm font-bold tabular-nums', getScoreColor(tier))}>
                {hasData ? `${breakdown.composite}` : '—'}
              </span>
              {/* Progress bar */}
              <div className="w-20">
                <Progress
                  value={hasData ? breakdown.composite : 0}
                  className={cn('h-1.5', getScoreBarColor(tier))}
                />
              </div>
              {/* Trend */}
              {hasData && <TrendIcon trend={trend} />}
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-3">
            <BreakdownTooltip hasData={hasData} breakdown={breakdown} tier={tier} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Expanded chart — mode non-compact */}
      {!compact && hasData && dailyScores.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-2">Evolução — 7 dias</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={dailyScores} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <RechartsTooltip
                formatter={(value: number) => [`${value}`, 'Score']}
                contentStyle={{ fontSize: 11 }}
              />
              <ReferenceLine y={70} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
