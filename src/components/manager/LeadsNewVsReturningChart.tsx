// Dashboard do Gestor: leads novos vs recorrentes — área empilhada
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users } from 'lucide-react';
import type { LeadsNewVsReturningResult } from '@/hooks/useLeadsNewVsReturning';

interface Props {
  data: LeadsNewVsReturningResult | undefined;
  isLoading?: boolean;
}

const COLOR_NEW = 'hsl(142 70% 45%)';
const COLOR_RETURNING = 'hsl(262 83% 58%)';

export default function LeadsNewVsReturningChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const totals = data?.totals ?? { novos: 0, recorrentes: 0, total: 0 };
  const series = data?.series ?? [];
  const hasData = totals.total > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Leads Novos vs Recorrentes
          </CardTitle>
          <div className="flex items-center gap-1.5 text-[10px]">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-medium">
              {totals.novos} novos
            </Badge>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 font-medium">
              {totals.recorrentes} recorrentes
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground font-medium">{totals.total} total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-10">Sem leads no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="gradNovos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_NEW} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={COLOR_NEW} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_RETURNING} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={COLOR_RETURNING} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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
              <Area
                type="monotone"
                stackId="1"
                dataKey="novos"
                name="Novos"
                stroke={COLOR_NEW}
                fill="url(#gradNovos)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                stackId="1"
                dataKey="recorrentes"
                name="Recorrentes"
                stroke={COLOR_RETURNING}
                fill="url(#gradRec)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
