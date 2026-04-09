// M17 F5: NPS Distribution Chart
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { usePollMetrics } from '@/hooks/usePollMetrics';
import { Skeleton } from '@/components/ui/skeleton';

interface PollNpsChartProps {
  instanceId: string | undefined;
  periodDays?: number;
}

const NPS_COLORS: Record<string, string> = {
  Excelente: 'bg-emerald-500',
  Bom: 'bg-emerald-300',
  Regular: 'bg-amber-400',
  Ruim: 'bg-orange-500',
  Pessimo: 'bg-red-500',
};

const NPS_ORDER = ['Excelente', 'Bom', 'Regular', 'Ruim', 'Pessimo'];

export default function PollNpsChart({ instanceId, periodDays = 30 }: PollNpsChartProps) {
  const { data: metrics, isLoading } = usePollMetrics(instanceId, periodDays);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Distribuicao NPS
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  const dist = metrics?.npsDistribution || {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Distribuicao NPS ({total} respostas)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {NPS_ORDER.map((label) => {
          const count = dist[label] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs w-20 text-right text-muted-foreground">{label}</span>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${NPS_COLORS[label] || 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs w-12 text-muted-foreground">{count} ({pct}%)</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
