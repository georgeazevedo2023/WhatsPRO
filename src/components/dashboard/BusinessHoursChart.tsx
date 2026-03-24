import { memo, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, PieChart, Pie } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Sun, Moon, Calendar, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HourData {
  hour: number;
  label: string;
  count: number;
  type: 'comercial' | 'noite' | 'fds';
}

interface SummaryData {
  comercial: number;
  noite: number;
  fds: number;
  total: number;
}

interface BusinessHoursChartProps {
  inboxId?: string | null;
  periodDays?: number;
}

const COLORS = {
  comercial: 'hsl(142 70% 45%)',
  noite: 'hsl(262 60% 50%)',
  fds: 'hsl(25 90% 55%)',
};

const chartConfig = {
  comercial: { label: 'Horário Comercial', color: COLORS.comercial },
  noite: { label: 'Fora do Expediente', color: COLORS.noite },
  fds: { label: 'Fim de Semana', color: COLORS.fds },
};

function classifyMessage(dateStr: string): 'comercial' | 'noite' | 'fds' {
  const d = new Date(dateStr);
  const spDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfWeek = spDate.getDay();
  const hour = spDate.getHours();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'fds';
  if (hour >= 8 && hour < 18) return 'comercial';
  return 'noite';
}

function getSpHour(dateStr: string): number {
  const d = new Date(dateStr);
  const spDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return spDate.getHours();
}

const BusinessHoursChart = ({ inboxId, periodDays = 30 }: BusinessHoursChartProps) => {
  const [messages, setMessages] = useState<{ created_at: string; inbox_id?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - periodDays);

        // Single query with join to get inbox_id directly
        const { data, error } = await supabase
          .from('conversation_messages')
          .select('created_at, conversations(inbox_id)')
          .eq('direction', 'incoming')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true })
          .limit(2000);

        if (error) throw error;
        setMessages((data || []).map((m: any) => ({
          created_at: m.created_at,
          inbox_id: m.conversations?.inbox_id,
        })));
      } catch (err) {
        console.error('Error fetching business hours data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [periodDays, inboxId]);

  const filteredMessages = useMemo(() => {
    if (!inboxId) return messages;
    return messages.filter(m => m.inbox_id === inboxId);
  }, [messages, inboxId]);

  const { hourlyData, summary } = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    const sum: SummaryData = { comercial: 0, noite: 0, fds: 0, total: 0 };

    filteredMessages.forEach((msg) => {
      const type = classifyMessage(msg.created_at);
      const hour = getSpHour(msg.created_at);
      hourCounts[hour]++;
      sum[type]++;
      sum.total++;
    });

    const hourlyData: HourData[] = hourCounts.map((count, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      count,
      type: (hour >= 8 && hour < 18) ? 'comercial' as const : 'noite' as const,
    }));

    return { hourlyData, summary: sum };
  }, [filteredMessages]);

  const pieData = useMemo(() => [
    { name: 'Horário Comercial', value: summary.comercial, fill: COLORS.comercial },
    { name: 'Fora do Expediente', value: summary.noite, fill: COLORS.noite },
    { name: 'Fim de Semana', value: summary.fds, fill: COLORS.fds },
  ].filter(d => d.value > 0), [summary]);

  const pct = (val: number) => summary.total > 0 ? Math.round((val / summary.total) * 100) : 0;

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-[320px] md:col-span-2 rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {/* Bar Chart - Hourly Distribution */}
      <Card className="glass-card-hover md:col-span-2">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium">
              Horário das Conversas
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {summary.total.toLocaleString('pt-BR')} msgs
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Total de mensagens recebidas no período</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Últimos {periodDays} dias · Distribuição por hora (Brasília)
          </p>
        </CardHeader>
        <CardContent className="pt-0 px-2 pb-3">
          {summary.total > 0 ? (
            <>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={hourlyData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval={2} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} allowDecimals={false} width={28} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _, item) => {
                          const type = item?.payload?.type;
                          const label = type === 'comercial' ? 'Comercial' : 'Fora';
                          return <span className="font-medium">{value} msgs — {label}</span>;
                        }}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={16}>
                    {hourlyData.map((entry, index) => (
                      <Cell key={index} fill={entry.type === 'comercial' ? COLORS.comercial : COLORS.noite} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="flex items-center justify-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: COLORS.comercial }} />
                  <span>08h–18h</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: COLORS.noite }} />
                  <span>18h–08h</span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma mensagem no período</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="glass-card-hover">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-medium">Resumo por Período</CardTitle>
          <p className="text-[11px] text-muted-foreground">Classificação das mensagens</p>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          {summary.total > 0 ? (
            <>
              <ChartContainer config={chartConfig} className="h-[100px] w-full">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={42} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => <span className="font-medium">{value} msgs</span>} />}
                  />
                </PieChart>
              </ChartContainer>

              {[
                { icon: Sun, label: 'Comercial', value: summary.comercial, color: COLORS.comercial },
                { icon: Moon, label: 'Noite/Madrugada', value: summary.noite, color: COLORS.noite },
                { icon: Calendar, label: 'Fim de Semana', value: summary.fds, color: COLORS.fds },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-xs">{label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold">{pct(value)}%</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({value})</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-1 mt-1">
                    <div className="h-1 rounded-full transition-all" style={{ width: `${pct(value)}%`, background: color }} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="h-[160px] flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="w-7 h-7 mb-2 opacity-40" />
              <p className="text-xs">Sem dados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default memo(BusinessHoursChart);
