// Sprint C7 (2026-05-24) — Dashboard admin "Roteamento".
// Telemetria do router + specialists lida de ai_agent_runs via RPC SECURITY DEFINER
// get_router_dashboard (guardada por is_super_admin). Mostra distribuição de intents,
// latência P50/P95 por specialist, uso/custo por modelo, hop loops e volume diário.
import { useEffect, useState, useCallback } from 'react';
import { Network, RefreshCw, AlertTriangle, Activity, DollarSign, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { handleError } from '@/lib/errorUtils';

interface IntentSlice { intent: string; count: number }
interface SpecialistLatency { specialist: string; runs: number; p50_ms: number; p95_ms: number; avg_input_tokens: number; avg_output_tokens: number }
interface ModelUsage { model: string; runs: number; input_tokens: number; output_tokens: number; est_cost_usd: number }
interface RouterDashboard {
  period_days: number;
  overview: {
    total_runs: number; total_turns: number; total_conversations: number;
    hop_loops: number; avg_confidence: number | null; avg_latency_ms: number | null; est_cost_usd: number;
  };
  intent_distribution: IntentSlice[];
  specialist_latency: SpecialistLatency[];
  model_usage: ModelUsage[];
  daily_volume: { day: string; runs: number }[];
}

const INTENT_COLORS = [
  'hsl(142 70% 45%)', 'hsl(199 89% 48%)', 'hsl(38 92% 50%)', 'hsl(280 65% 60%)',
  'hsl(0 72% 51%)', 'hsl(172 50% 38%)', 'hsl(220 16% 50%)',
];
const PERIODS = [7, 14, 30] as const;

const AdminRouting = () => {
  const { isSuperAdmin } = useAuth();
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<RouterDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true);
    // RPC ainda não está nos tipos gerados; cast defensivo (padrão AdminRetention).
    const { data: res, error } = await supabase.rpc('get_router_dashboard' as never, { _days: d } as never);
    if (error) handleError(error, 'Erro ao carregar métricas de roteamento');
    else setData(res as unknown as RouterDashboard);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchData(days);
  }, [fetchData, isSuperAdmin, days]);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const ov = data?.overview;
  const intentData = (data?.intent_distribution || []).map((s, i) => ({
    name: s.intent, value: s.count, fill: INTENT_COLORS[i % INTENT_COLORS.length],
  }));
  const hasIntents = intentData.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Roteamento</h1>
          <span className="text-sm text-muted-foreground">router + specialists (ai_agent_runs)</span>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={days === p ? 'default' : 'outline'} onClick={() => setDays(p)}>
              {p}d
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => fetchData(days)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={<Activity className="h-4 w-4" />} label="Turnos roteados" value={ov?.total_turns ?? 0}
              sub={`${ov?.total_runs ?? 0} hops · ${ov?.total_conversations ?? 0} conversas`} />
            <KpiCard icon={<Activity className="h-4 w-4" />} label="Latência média" value={`${ov?.avg_latency_ms ?? 0}ms`}
              sub={`confiança router ${ov?.avg_confidence != null ? Math.round(ov.avg_confidence * 100) + '%' : '—'}`} />
            <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Custo estimado" value={`$${(ov?.est_cost_usd ?? 0).toFixed(4)}`}
              sub={`em ${data?.period_days ?? days} dias`} />
            <KpiCard icon={<GitBranch className="h-4 w-4" />} label="Hop loops"
              value={ov?.hop_loops ?? 0} alert={(ov?.hop_loops ?? 0) > 0}
              sub={(ov?.hop_loops ?? 0) > 0 ? 'fallback monolith disparado' : 'nenhum loop'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pizza de intents */}
            <Card className="glass-card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Distribuição de Intents (router)</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {hasIntents ? (
                  <ChartContainer config={{}} className="h-[260px] w-full">
                    <PieChart>
                      <Pie data={intentData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name">
                        {intentData.map((entry, index) => <Cell key={index} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* Latência por specialist */}
            <Card className="glass-card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Latência por Specialist (P50 / P95)</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {(data?.specialist_latency?.length ?? 0) > 0 ? (
                  <ChartContainer config={{ p50_ms: { label: 'P50', color: 'hsl(142 70% 45%)' }, p95_ms: { label: 'P95', color: 'hsl(38 92% 50%)' } }} className="h-[260px] w-full">
                    <BarChart data={data!.specialist_latency} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="specialist" width={80} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="p50_ms" fill="hsl(142 70% 45%)" radius={3} />
                      <Bar dataKey="p95_ms" fill="hsl(38 92% 50%)" radius={3} />
                    </BarChart>
                  </ChartContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>

          {/* Uso por modelo */}
          <Card className="glass-card-hover">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Uso e custo por modelo</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {(data?.model_usage?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Modelo</th><th className="py-2 pr-4 font-medium">Hops</th>
                      <th className="py-2 pr-4 font-medium">Tokens in</th><th className="py-2 pr-4 font-medium">Tokens out</th>
                      <th className="py-2 font-medium">Custo est.</th>
                    </tr></thead>
                    <tbody>
                      {data!.model_usage.map((m) => (
                        <tr key={m.model} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-mono text-xs">{m.model}</td>
                          <td className="py-2 pr-4">{m.runs}</td>
                          <td className="py-2 pr-4">{m.input_tokens?.toLocaleString('pt-BR')}</td>
                          <td className="py-2 pr-4">{m.output_tokens?.toLocaleString('pt-BR')}</td>
                          <td className="py-2">${m.est_cost_usd?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="py-8 text-center text-muted-foreground text-sm">Sem dados no período</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const KpiCard = ({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; alert?: boolean }) => (
  <Card className={`glass-card-hover ${alert ? 'border-destructive/50' : ''}`}>
    <CardContent className="pt-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {alert ? <AlertTriangle className="h-4 w-4 text-destructive" /> : icon}{label}
      </div>
      <div className={`text-2xl font-semibold ${alert ? 'text-destructive' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent>
  </Card>
);

const EmptyChart = () => (
  <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
);

export default AdminRouting;
