// M19 S4: Gráfico de evolução diária do vendedor
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VendorTrendDay } from '@/hooks/useVendorDetail';

interface Props {
  data: VendorTrendDay[];
}

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM', { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatMinutes = (value: number) => {
  if (!value) return '—';
  if (value < 60) return `${value}min`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

export default function VendorTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Evolução Diária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum dado ainda</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    Conversas: d.conversations,
    Resolvidas: d.resolved,
    avgResolutionMin: d.avgResolutionMin,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evolução Diária
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
              }}
              formatter={(value: number, name: string) => {
                if (name === 'avgResolutionMin') return [formatMinutes(value), 'Tempo Médio'];
                return [value, name];
              }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="Conversas"
              stroke="hsl(217 91% 60%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Resolvidas"
              stroke="hsl(142 70% 45%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
