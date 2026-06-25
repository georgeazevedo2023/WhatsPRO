// NPS-on-finalize (2026-06-25): tabela de NPS 0-10 por atendente pro gestor.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNpsByAttendant } from '@/hooks/useNpsByAttendant';

interface Props {
  instanceId: string | undefined;
  periodDays?: number;
}

export default function NpsByAttendantTable({ instanceId, periodDays = 30 }: Props) {
  const { data, isLoading } = useNpsByAttendant(instanceId, periodDays);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> NPS por atendente</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> NPS por atendente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((row) => {
            const avg = row.avg_score ?? 0;
            const color = avg >= 8 ? 'text-emerald-600' : avg >= 6 ? 'text-amber-600' : 'text-red-600';
            return (
              <div key={row.attendant_id || 'none'} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate flex-1">{row.attendant_name || 'Sem atendente'}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{row.votes} voto{row.votes > 1 ? 's' : ''}</span>
                  {row.low_count > 0 && (
                    <span className="text-xs text-red-600">{row.low_count} {'<'}5</span>
                  )}
                  <span className={`font-semibold ${color}`}>{avg ? `${avg}/10` : '—'}</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
