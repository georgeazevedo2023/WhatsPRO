import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface InstanceStats {
  instanceId: string;
  instanceName: string;
  groupsCount: number;
  participantsCount: number;
  status: string;
}

interface DashboardChartsProps {
  instanceStats: InstanceStats[];
  connectedCount: number;
  disconnectedCount: number;
  loading: boolean;
  helpdeskLeadsDailyData?: { day: string; label: string; leads: number }[];
  helpdeskChartTitle?: string;
}

const CHART_COLORS = {
  online: 'hsl(142 70% 45%)',
  offline: 'hsl(220 16% 36%)',
  bars: [
    'hsl(142 70% 45%)',
    'hsl(152 60% 40%)',
    'hsl(162 55% 35%)',
    'hsl(172 50% 38%)',
    'hsl(182 45% 42%)',
    'hsl(192 50% 40%)',
  ],
};

const statusChartConfig = {
  online: { label: 'Online', color: CHART_COLORS.online },
  offline: { label: 'Offline', color: CHART_COLORS.offline },
};

const DashboardCharts = ({ instanceStats, connectedCount, disconnectedCount, loading, helpdeskLeadsDailyData, helpdeskChartTitle }: DashboardChartsProps) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 animate-fade-in" style={{ animationDelay: '175ms' }}>
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px] md:col-span-2" />
      </div>
    );
  }

  // Memoized data for status pie chart
  const statusData = useMemo(() => 
    [
      { name: 'Online', value: connectedCount, fill: CHART_COLORS.online },
      { name: 'Offline', value: disconnectedCount, fill: CHART_COLORS.offline },
    ].filter(item => item.value > 0),
    [connectedCount, disconnectedCount]
  );

  // Memoized data for groups bar chart (sorted by groups count)
  const groupsData = useMemo(() => 
    [...instanceStats]
      .sort((a, b) => b.groupsCount - a.groupsCount)
      .slice(0, 6)
      .map((stat, index) => ({
        name: stat.instanceName.length > 12 ? stat.instanceName.slice(0, 12) + '...' : stat.instanceName,
        fullName: stat.instanceName,
        grupos: stat.groupsCount,
        fill: CHART_COLORS.bars[index % CHART_COLORS.bars.length],
      })),
    [instanceStats]
  );

  // Memoized data for participants horizontal bar chart (sorted by participants count)
  const participantsData = useMemo(() => 
    [...instanceStats]
      .sort((a, b) => b.participantsCount - a.participantsCount)
      .slice(0, 6)
      .map((stat, index) => ({
        name: stat.instanceName.length > 15 ? stat.instanceName.slice(0, 15) + '...' : stat.instanceName,
        fullName: stat.instanceName,
        participantes: stat.participantsCount,
        fill: CHART_COLORS.bars[index % CHART_COLORS.bars.length],
      })),
    [instanceStats]
  );

  const hasData = instanceStats.length > 0;
  const hasStatusData = statusData.length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 animate-fade-in" style={{ animationDelay: '175ms' }}>
      {/* Pie Chart - Status Distribution */}
      <Card className="glass-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição de Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasStatusData ? (
            <ChartContainer config={statusChartConfig} className="h-[220px] w-full">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="font-medium">{value} {name === 'Online' ? 'online' : 'offline'}</span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma instância encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart - Groups per Instance */}
      <Card className="glass-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Grupos por Instância</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasData && groupsData.some(d => d.grupos > 0) ? (
            <ChartContainer config={{ grupos: { label: 'Grupos', color: CHART_COLORS.online } }} className="h-[220px] w-full">
              <BarChart data={groupsData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={80} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      formatter={(value) => <span className="font-medium">{value} grupos</span>}
                    />
                  }
                />
                <Bar 
                  dataKey="grupos" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                >
                  {groupsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum grupo encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Horizontal Bar Chart - Participants per Instance */}
      <Card className="glass-card-hover md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Participantes por Instância</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasData && participantsData.some(d => d.participantes > 0) ? (
            <ChartContainer config={{ participantes: { label: 'Participantes', color: CHART_COLORS.online } }} className="h-[220px] w-full">
              <BarChart data={participantsData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={100} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      formatter={(value) => <span className="font-medium">{Number(value).toLocaleString('pt-BR')} participantes</span>}
                    />
                  }
                />
                <Bar 
                  dataKey="participantes" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  label={{ 
                    position: 'right', 
                    fontSize: 11,
                    formatter: (value: number) => value.toLocaleString('pt-BR'),
                    fill: 'hsl(var(--muted-foreground))'
                  }}
                >
                  {participantsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum participante encontrado
            </div>
          )}
        </CardContent>
      </Card>
      {/* Area Chart - Helpdesk Leads (últimos 7 dias) */}
      {helpdeskLeadsDailyData && helpdeskLeadsDailyData.length > 0 && (
        <Card className="glass-card-hover md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{helpdeskChartTitle || 'Leads Helpdesk — Últimos 7 dias'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={{ leads: { label: 'Leads', color: 'hsl(262 80% 55%)' } }} className="h-[220px] w-full">
              <AreaChart data={helpdeskLeadsDailyData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262 80% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(262 80% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.day || ''}
                      formatter={(value) => <span className="font-medium">{value} leads</span>}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="hsl(262 80% 55%)"
                  strokeWidth={2}
                  fill="url(#leadsGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default memo(DashboardCharts);
