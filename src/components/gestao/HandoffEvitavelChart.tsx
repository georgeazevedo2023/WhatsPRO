// M19 S4-P4: PieChart Evitável vs Necessário
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface Props {
  evitavelCount: number;
  necessarioCount: number;
}

const COLORS = {
  evitavel: '#ef4444',
  necessario: '#22c55e',
};

export default function HandoffEvitavelChart({ evitavelCount, necessarioCount }: Props) {
  const total = evitavelCount + necessarioCount;

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" />
            Evitável vs Necessário
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

  const chartData = [
    { name: 'Evitável', value: evitavelCount },
    { name: 'Necessário', value: necessarioCount },
  ].filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          Evitável vs Necessário
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ cx, cy }) => (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-foreground" style={{ fontSize: 14, fontWeight: 700 }}>
                  {total}
                </text>
              )}
              labelLine={false}
            >
              <Cell fill={COLORS.evitavel} />
              <Cell fill={COLORS.necessario} />
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
              }}
              formatter={(value: number, name: string) => [
                `${value} (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
