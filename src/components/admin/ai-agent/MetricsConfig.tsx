import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Zap, Clock, ArrowRightLeft, Wrench, RefreshCw, Loader2, MessageSquare, Bot } from 'lucide-react';
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

export function MetricsConfig({ agentId }: MetricsConfigProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      const { data: logs, error } = await supabase
        .from('ai_agent_logs')
        .select('event, input_tokens, output_tokens, latency_ms, tool_calls, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      const entries = logs || [];
      const responses = entries.filter(l => l.event === 'response_sent');
      const handoffs = entries.filter(l => l.event === 'handoff');
      const shadows = entries.filter(l => l.event === 'shadow_extraction');
      const labels = entries.filter(l => l.event === 'label_assigned');

      // Token totals
      const totalTokensIn = entries.reduce((s, l) => s + (l.input_tokens || 0), 0);
      const totalTokensOut = entries.reduce((s, l) => s + (l.output_tokens || 0), 0);

      // Average latency
      const latencies = responses.filter(l => l.latency_ms).map(l => l.latency_ms!);
      const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

      // Tool usage
      const toolUsage: Record<string, number> = {};
      for (const log of responses) {
        const calls = log.tool_calls as any[];
        if (calls?.length) {
          for (const tc of calls) {
            toolUsage[tc.name] = (toolUsage[tc.name] || 0) + 1;
          }
        }
      }

      // Hourly distribution (0-23)
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) return null;

  const maxHour = Math.max(...metrics.hourlyDistribution, 1);
  const toolEntries = Object.entries(metrics.toolUsage).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Métricas do Agente</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchMetrics}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{metrics.totalResponses}</p>
            <p className="text-[10px] text-muted-foreground">Respostas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowRightLeft className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{metrics.handoffRate}%</p>
            <p className="text-[10px] text-muted-foreground">Taxa Handoff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{metrics.avgLatency < 1000 ? `${metrics.avgLatency}ms` : `${(metrics.avgLatency / 1000).toFixed(1)}s`}</p>
            <p className="text-[10px] text-muted-foreground">Latência Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{((metrics.totalTokensIn + metrics.totalTokensOut) / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground">Tokens Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">{metrics.totalHandoffs}</p>
            <p className="text-[10px] text-muted-foreground">Handoffs</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
          <span className="text-muted-foreground text-xs">👁</span>
          <div>
            <p className="text-sm font-semibold">{metrics.totalShadow}</p>
            <p className="text-[10px] text-muted-foreground">Shadow</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
          <span className="text-muted-foreground text-xs">🏷</span>
          <div>
            <p className="text-sm font-semibold">{metrics.labelAssignments}</p>
            <p className="text-[10px] text-muted-foreground">Labels</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
          <span className="text-muted-foreground text-xs">#</span>
          <div>
            <p className="text-sm font-semibold">{metrics.tagUpdates}</p>
            <p className="text-[10px] text-muted-foreground">Tags</p>
          </div>
        </div>
      </div>

      {/* Tool Usage */}
      {toolEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              Uso de Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {toolEntries.map(([name, count]) => {
              const maxCount = toolEntries[0][1];
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-36 truncate">{name}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="text-[10px] min-w-[40px] justify-center">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Hourly Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Distribuição por Horário
          </CardTitle>
          <CardDescription className="text-xs">Respostas do agente por hora do dia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-24">
            {metrics.hourlyDistribution.map((count, hour) => (
              <div key={hour} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${(count / maxHour) * 80}px`,
                    minHeight: count > 0 ? '4px' : '1px',
                    backgroundColor: count === 0
                      ? 'hsl(var(--muted))'
                      : `hsl(var(--primary) / ${0.3 + (count / maxHour) * 0.7})`,
                  }}
                  title={`${hour}h: ${count} respostas`}
                />
                {hour % 3 === 0 && (
                  <span className="text-[8px] text-muted-foreground">{hour}h</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Token breakdown */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground p-3 rounded-lg border">
        <span>Tokens entrada: <strong className="text-foreground">{metrics.totalTokensIn.toLocaleString()}</strong></span>
        <span>Tokens saída: <strong className="text-foreground">{metrics.totalTokensOut.toLocaleString()}</strong></span>
        <span>Custo estimado: <strong className="text-foreground">~${((metrics.totalTokensIn * 0.15 + metrics.totalTokensOut * 0.6) / 1_000_000).toFixed(4)}</strong></span>
      </div>
    </div>
  );
}
