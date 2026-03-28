import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Zap, Clock, ArrowRightLeft, Wrench, RefreshCw, Loader2, MessageSquare, Bot, Eye, Tag, Bookmark, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';

interface MetricsConfigProps {
  agentId: string;
}

interface Metrics {
  totalResponses: number;
  totalHandoffs: number;
  totalShadow: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgLatency: number;
  toolUsage: Record<string, number>;
  hourlyDistribution: number[];
  handoffRate: number;
  labelAssignments: number;
  tagUpdates: number;
}

const TOOL_LABELS: Record<string, string> = {
  search_products: 'Buscar Produtos',
  send_carousel: 'Enviar Carrossel',
  send_media: 'Enviar Mídia',
  assign_label: 'Atribuir Label',
  set_tags: 'Definir Tags',
  move_kanban: 'Mover Kanban',
  update_lead_profile: 'Atualizar Lead',
  handoff_to_human: 'Transferir Humano',
};

const TOOL_COLORS: Record<string, string> = {
  search_products: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
  send_carousel: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
  send_media: 'from-pink-500/20 to-pink-500/5 border-pink-500/20',
  assign_label: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  set_tags: 'from-teal-500/20 to-teal-500/5 border-teal-500/20',
  move_kanban: 'from-orange-500/20 to-orange-500/5 border-orange-500/20',
  update_lead_profile: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20',
  handoff_to_human: 'from-red-500/20 to-red-500/5 border-red-500/20',
};

const BAR_COLORS: Record<string, string> = {
  search_products: 'bg-blue-500',
  send_carousel: 'bg-violet-500',
  send_media: 'bg-pink-500',
  assign_label: 'bg-amber-500',
  set_tags: 'bg-teal-500',
  move_kanban: 'bg-orange-500',
  update_lead_profile: 'bg-indigo-500',
  handoff_to_human: 'bg-red-500',
};

export function MetricsConfig({ agentId }: MetricsConfigProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      // Paginated fetch: load in batches of 1000 to avoid memory spikes
      const PAGE_SIZE = 1000;
      let entries: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('ai_agent_logs')
          .select('event, input_tokens, output_tokens, latency_ms, tool_calls, created_at')
          .eq('agent_id', agentId)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        const rows = page || [];
        entries = entries.concat(rows);
        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }
      const responses = entries.filter(l => l.event === 'response_sent');
      const handoffs = entries.filter(l => l.event === 'handoff');
      const shadows = entries.filter(l => l.event === 'shadow_extraction');
      const labels = entries.filter(l => l.event === 'label_assigned');

      const totalTokensIn = entries.reduce((s, l) => s + (l.input_tokens || 0), 0);
      const totalTokensOut = entries.reduce((s, l) => s + (l.output_tokens || 0), 0);

      const latencies = responses.filter(l => l.latency_ms).map(l => l.latency_ms!);
      const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

      const toolUsage: Record<string, number> = {};
      for (const log of responses) {
        const calls = log.tool_calls as any[];
        if (calls?.length) {
          for (const tc of calls) {
            toolUsage[tc.name] = (toolUsage[tc.name] || 0) + 1;
          }
        }
      }

      const hourly = new Array(24).fill(0);
      for (const log of responses) {
        const h = new Date(log.created_at).getHours();
        hourly[h]++;
      }

      setMetrics({
        totalResponses: responses.length,
        totalHandoffs: handoffs.length,
        totalShadow: shadows.length,
        totalTokensIn,
        totalTokensOut,
        avgLatency,
        toolUsage,
        hourlyDistribution: hourly,
        handoffRate: responses.length ? Math.round((handoffs.length / responses.length) * 100) : 0,
        labelAssignments: labels.length,
        tagUpdates: entries.filter(l => {
          const tc = l.tool_calls as any[];
          return tc?.some(t => t.name === 'set_tags');
        }).length,
      });
    } catch (err) {
      handleError(err, 'Erro ao carregar métricas', 'Fetch AI metrics');
    } finally {
      setLoading(false);
    }
  }, [agentId, period]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Loader2 className="w-8 h-8 animate-spin text-primary relative" />
        </div>
        <p className="text-xs text-muted-foreground animate-pulse">Carregando métricas...</p>
      </div>
    );
  }

  if (!metrics) return null;

  const maxHour = Math.max(...metrics.hourlyDistribution, 1);
  const toolEntries = Object.entries(metrics.toolUsage).sort((a, b) => b[1] - a[1]);
  const totalTokens = metrics.totalTokensIn + metrics.totalTokensOut;
  const estimatedCost = (metrics.totalTokensIn * 0.15 + metrics.totalTokensOut * 0.6) / 1_000_000;
  const periodLabel = period === '1' ? '24h' : period === '7' ? '7d' : period === '30' ? '30d' : '90d';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 max-w-full overflow-x-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Performance do Agente</h3>
              <p className="text-[11px] text-muted-foreground">Dados dos últimos {periodLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={fetchMetrics}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Primary KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<MessageSquare className="w-4 h-4" />}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            label="Respostas"
            value={metrics.totalResponses.toLocaleString()}
            sub={`${(metrics.totalResponses / Math.max(parseInt(period), 1)).toFixed(1)}/dia`}
          />
          <KpiCard
            icon={<ArrowRightLeft className="w-4 h-4" />}
            iconColor="text-orange-400"
            iconBg="bg-orange-500/10"
            label="Taxa Handoff"
            value={`${metrics.handoffRate}%`}
            sub={`${metrics.totalHandoffs} transferências`}
            alert={metrics.handoffRate > 30}
          />
          <KpiCard
            icon={<Clock className="w-4 h-4" />}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            label="Latência Média"
            value={metrics.avgLatency < 1000 ? `${metrics.avgLatency}ms` : `${(metrics.avgLatency / 1000).toFixed(1)}s`}
            sub={metrics.avgLatency < 2000 ? 'Rápido' : metrics.avgLatency < 5000 ? 'Normal' : 'Lento'}
            alert={metrics.avgLatency > 5000}
          />
          <KpiCard
            icon={<Zap className="w-4 h-4" />}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
            label="Tokens"
            value={totalTokens > 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(1)}M` : `${(totalTokens / 1000).toFixed(1)}k`}
            sub={`~$${estimatedCost.toFixed(3)}`}
          />
        </div>

        {/* ── Secondary KPIs (compact row) ── */}
        <div className="grid grid-cols-4 gap-2">
          <MiniKpi icon={<Bot className="w-3.5 h-3.5 text-orange-400" />} label="Handoffs" value={metrics.totalHandoffs} />
          <MiniKpi icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />} label="Shadow" value={metrics.totalShadow} />
          <MiniKpi icon={<Bookmark className="w-3.5 h-3.5 text-amber-400" />} label="Labels" value={metrics.labelAssignments} />
          <MiniKpi icon={<Tag className="w-3.5 h-3.5 text-teal-400" />} label="Tags" value={metrics.tagUpdates} />
        </div>

        {/* ── Tool Usage + Hourly side by side on large screens ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Tool Usage */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Wrench className="w-3.5 h-3.5" />
                Uso de Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-1.5">
              {toolEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Nenhum tool utilizado no período</p>
              ) : toolEntries.map(([name, count]) => {
                const maxCount = toolEntries[0][1];
                const pct = Math.round((count / maxCount) * 100);
                const barColor = BAR_COLORS[name] || 'bg-primary';
                const bgGrad = TOOL_COLORS[name] || 'from-primary/20 to-primary/5 border-primary/20';
                return (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div className={`relative flex items-center gap-3 px-3 py-2 rounded-lg border bg-gradient-to-r ${bgGrad} cursor-default transition-all hover:scale-[1.01]`}>
                        <span className="text-[11px] font-medium w-28 truncate">{TOOL_LABELS[name] || name}</span>
                        <div className="flex-1 h-1.5 bg-background/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold tabular-nums min-w-[32px] text-right">{count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      {TOOL_LABELS[name] || name}: {count} chamadas ({pct}% do total)
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Atividade por Horário
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex items-end gap-[3px] h-28">
                {metrics.hourlyDistribution.map((count, hour) => {
                  const intensity = count / maxHour;
                  const isActive = count > 0;
                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger asChild>
                        <div className="flex-1 flex flex-col items-center gap-1 cursor-default group">
                          <div
                            className={`w-full rounded-sm transition-all duration-300 group-hover:opacity-80 ${
                              isActive ? 'bg-primary' : 'bg-muted/40'
                            }`}
                            style={{
                              height: `${Math.max(isActive ? 8 : 2, intensity * 96)}px`,
                              opacity: isActive ? 0.3 + intensity * 0.7 : 0.2,
                            }}
                          />
                          {hour % 4 === 0 && (
                            <span className="text-[8px] text-muted-foreground leading-none">{String(hour).padStart(2, '0')}</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <strong>{String(hour).padStart(2, '0')}h:</strong> {count} {count === 1 ? 'resposta' : 'respostas'}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Token Breakdown ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entrada</p>
              <p className="text-sm font-bold tabular-nums">{(metrics.totalTokensIn / 1000).toFixed(1)}k</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-violet-500/5 to-transparent">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saída</p>
              <p className="text-sm font-bold tabular-nums">{(metrics.totalTokensOut / 1000).toFixed(1)}k</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo Est.</p>
              <p className="text-sm font-bold tabular-nums">${estimatedCost.toFixed(4)}</p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ── Sub-components ── */

function KpiCard({ icon, iconColor, iconBg, label, value, sub, alert }: {
  icon: React.ReactNode; iconColor: string; iconBg: string; label: string; value: string; sub?: string; alert?: boolean;
}) {
  return (
    <Card className={`border-border/50 transition-all hover:border-border ${alert ? 'border-orange-500/30' : ''}`}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0 ${iconColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-1">{label}</p>
          <p className={`text-xl font-bold leading-tight tabular-nums ${alert ? 'text-orange-400' : ''}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-card/50">
      {icon}
      <div className="min-w-0">
        <p className="text-xs font-bold tabular-nums leading-tight">{value}</p>
        <p className="text-[9px] text-muted-foreground leading-none">{label}</p>
      </div>
    </div>
  );
}
