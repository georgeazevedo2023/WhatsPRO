// Dashboard do Gestor F2: conversão por origem (leads × venda:fechada)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target } from 'lucide-react';
import type { ConversionByOrigin } from '@/hooks/useManagerAdvancedMetrics';

interface Props {
  data: ConversionByOrigin[] | undefined;
  isLoading?: boolean;
}

function tone(pct: number): string {
  if (pct >= 30) return 'text-green-600';
  if (pct >= 10) return 'text-emerald-500';
  if (pct > 0) return 'text-amber-500';
  return 'text-muted-foreground';
}

export default function ConversionByOriginCard({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const items = data ?? [];
  const total = items.reduce((s, r) => s + r.totalLeads, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Conversão por origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">Sem leads no período</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground border-b">
                <th className="text-left py-1.5 font-medium">Origem</th>
                <th className="text-right py-1.5 font-medium">Leads</th>
                <th className="text-right py-1.5 font-medium">Fechadas</th>
                <th className="text-right py-1.5 font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.origin} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 capitalize">{row.origin}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.totalLeads}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.fechadas}</td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${tone(row.conversionPct)}`}>
                    {row.conversionPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
