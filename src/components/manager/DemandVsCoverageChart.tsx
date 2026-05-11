// Dashboard do Gestor F2: demanda (incoming) vs cobertura (outgoing) por hora
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock4 } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { HourBucket } from '@/hooks/useManagerAdvancedMetrics';

interface Props {
  data: HourBucket[] | undefined;
  isLoading?: boolean;
}

export default function DemandVsCoverageChart({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const series = data ?? [];
  const total = series.reduce((s, h) => s + h.demand + h.coverage, 0);
  const hasData = total > 0;

  // identifica hora-pico de demanda e cobertura para destacar gap
  const peakDemand = series.reduce<{ h: number; v: number }>(
    (acc, b) => (b.demand > acc.v ? { h: b.hour, v: b.demand } : acc),
    { h: -1, v: 0 },
  );
  const peakCoverage = series.reduce<{ h: number; v: number }>(
    (acc, b) => (b.coverage > acc.v ? { h: b.hour, v: b.coverage } : acc),
    { h: -1, v: 0 },
  );

  const chartData = series.map((b) => ({
    hour: `${String(b.hour).padStart(2, '0')}h`,
    Demanda: b.demand,
    Cobertura: b.coverage,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock4 className="w-4 h-4 text-primary" />
            Demanda vs Cobertura por hora
          </CardTitle>
          {hasData && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30">
                pico lead: {String(peakDemand.h).padStart(2, '0')}h
              </Badge>
              <Badge variant="outline" className="bg-sky-500/10 text-sky-500 border-sky-500/30">
                pico casa: {String(peakCoverage.h).padStart(2, '0')}h
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-10">Sem mensagens no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Demanda" fill="hsl(0 70% 55%)" radius={[2, 2, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Cobertura"
                stroke="hsl(199 89% 48%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
