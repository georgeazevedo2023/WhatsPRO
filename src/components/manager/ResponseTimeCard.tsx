// Dashboard do Gestor F2: tempo de 1ª resposta (P50 + P95)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Timer } from 'lucide-react';
import type { ResponseTimePercentiles } from '@/hooks/useManagerAdvancedMetrics';

interface Props {
  data: ResponseTimePercentiles | undefined;
  isLoading?: boolean;
}

function fmt(seconds: number): string {
  if (!seconds || seconds < 1) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function tone(seconds: number): string {
  if (!seconds) return 'text-muted-foreground';
  if (seconds < 60) return 'text-green-600';
  if (seconds < 5 * 60) return 'text-emerald-500';
  if (seconds < 30 * 60) return 'text-amber-500';
  return 'text-red-500';
}

export default function ResponseTimeCard({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

  const p50 = data?.p50Seconds ?? 0;
  const p95 = data?.p95Seconds ?? 0;
  const n = data?.sampleSize ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          Tempo de 1ª resposta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {n === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Sem dados no período</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mediana (P50)</p>
              <p className={`text-2xl font-bold ${tone(p50)}`}>{fmt(p50)}</p>
              <p className="text-[10px] text-muted-foreground">metade respondida dentro disso</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">P95</p>
              <p className={`text-2xl font-bold ${tone(p95)}`}>{fmt(p95)}</p>
              <p className="text-[10px] text-muted-foreground">95% respondida dentro disso</p>
            </div>
            <div className="col-span-2 pt-1 border-t">
              <p className="text-[10px] text-muted-foreground">
                Amostra: <span className="font-medium text-foreground">{n} conversas</span> com 1ª msg do lead seguida de resposta
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
