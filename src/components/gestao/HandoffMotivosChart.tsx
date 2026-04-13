// M19 S4-P4: BarChart horizontal dos motivos de transbordo
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ArrowRightLeft } from 'lucide-react';
import type { HandoffByMotivo } from '@/hooks/useHandoffMetrics';

interface Props {
  data: HandoffByMotivo[];
}

function truncate(text: string, max = 20): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export default function HandoffMotivosChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Motivos de Transbordo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">
            Nenhum transbordo no período
          </p>
        </CardContent>
      </Card>
    );
  }

  // top 10 já vêm do hook, mas garantir ordenação DESC
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

  const chartData = sorted.map((d) => ({
    reason: d.reason,
    label: truncate(d.reason, 20),
    count: d.count,
    pct: d.pct,
  }));

  const height = Math.max(160, chartData.length * 34);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          Motivos de Transbordo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11 }}
                width={130}
                tickFormatter={(val) => val}
              />
              <RechartsTooltip
                contentStyle={{
                  fontSize: 12,
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
                formatter={(value: number, _name: string, props: any) => [
                  `${value} (${props.payload?.pct ?? 0}%)`,
                  props.payload?.reason ?? 'Motivo',
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill="hsl(var(--primary))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
