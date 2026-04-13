import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Globe } from 'lucide-react';
import type { LeadsByOrigin } from '@/hooks/useManagerMetrics';

const ORIGIN_LABELS: Record<string, string> = {
  bio: 'Bio Link',
  campanha: 'Campanha',
  formulario: 'Formulário',
  direto: 'Direto',
  funil: 'Funil',
};

const COLORS = [
  'hsl(142 70% 45%)',
  'hsl(217 91% 60%)',
  'hsl(262 83% 58%)',
  'hsl(43 96% 56%)',
  'hsl(354 70% 54%)',
  'hsl(180 60% 45%)',
];

interface Props {
  data: LeadsByOrigin[];
}

export default function LeadsByOriginChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum dado ainda</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: ORIGIN_LABELS[d.origin] || d.origin,
    value: d.count,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Leads por Origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
              }}
              formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Leads']}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
