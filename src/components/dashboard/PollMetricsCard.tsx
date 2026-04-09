// M17 F5: Poll + NPS Metrics Card
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Vote, Percent, Star } from 'lucide-react';
import { usePollMetrics } from '@/hooks/usePollMetrics';
import { Skeleton } from '@/components/ui/skeleton';

interface PollMetricsCardProps {
  instanceId: string | undefined;
  periodDays?: number;
}

export default function PollMetricsCard({ instanceId, periodDays = 30 }: PollMetricsCardProps) {
  const { data: metrics, isLoading } = usePollMetrics(instanceId, periodDays);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Enquetes
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  if (!metrics || (metrics.totalPolls === 0 && metrics.npsAvg === 0)) return null;

  const npsColor = metrics.npsAvg >= 4 ? 'text-emerald-600' : metrics.npsAvg >= 3 ? 'text-amber-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Enquetes & NPS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Vote className="w-3 h-3" /> Enquetes</p>
            <p className="text-xl font-semibold">{metrics.totalPolls}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Votos</p>
            <p className="text-xl font-semibold">{metrics.totalVotes}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> Taxa</p>
            <p className="text-xl font-semibold">{metrics.responseRate}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> NPS</p>
            <p className={`text-xl font-semibold ${npsColor}`}>{metrics.npsAvg || '—'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
