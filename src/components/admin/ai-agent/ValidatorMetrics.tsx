import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ShieldCheck, RefreshCw, Loader2, CheckCircle2, Pencil, Ban,
  AlertTriangle, TrendingUp, Lightbulb, Clock,
} from 'lucide-react';
import { handleError } from '@/lib/errorUtils';

interface ValidatorMetricsProps {
  agentId: string;
}

interface ViolationStat {
  rule: string;
  severity: string;
  count: number;
}

interface ValidatorStats {
  total: number;
  avgScore: number;
  distribution: Record<string, number>; // "10": 45, "8-9": 22, etc
  passCount: number;
  rewriteCount: number;
  blockCount: number;
  avgLatency: number;
  topViolations: ViolationStat[];
  suggestions: string[];
}

export function ValidatorMetrics({ agentId }: ValidatorMetricsProps) {
  const [stats, setStats] = useState<ValidatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      const { data: rows, error } = await supabase
        .from('ai_agent_validations')
        .select('score, verdict, violations, suggestion, latency_ms, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      if (!rows || rows.length === 0) {
        setStats(null);
        return;
      }

      const total = rows.length;
      const avgScore = Math.round((rows.reduce((s, r) => s + r.score, 0) / total) * 10) / 10;
      const passCount = rows.filter(r => r.verdict === 'PASS').length;
      const rewriteCount = rows.filter(r => r.verdict === 'REWRITE').length;
      const blockCount = rows.filter(r => r.verdict === 'BLOCK').length;
      const latencies = rows.filter(r => r.latency_ms).map(r => r.latency_ms!);
      const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

      // Distribution
      const distribution: Record<string, number> = { '10': 0, '8-9': 0, '5-7': 0, '1-4': 0, '0': 0 };
      for (const r of rows) {
        if (r.score === 10) distribution['10']++;
        else if (r.score >= 8) distribution['8-9']++;
        else if (r.score >= 5) distribution['5-7']++;
        else if (r.score >= 1) distribution['1-4']++;
        else distribution['0']++;
      }

      // Top violations
      const violationMap = new Map<string, ViolationStat>();
      for (const r of rows) {
        const violations = (r.violations as any[]) || [];
        for (const v of violations) {
          const key = v.rule || 'unknown';
          const existing = violationMap.get(key) || { rule: key, severity: v.severity || 'leve', count: 0 };
          existing.count++;
          violationMap.set(key, existing);
        }
      }
      const topViolations = Array.from(violationMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Unique suggestions (last 10)
      const suggestions = rows
        .filter(r => r.suggestion)
        .map(r => r.suggestion as string)
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .slice(0, 5);

      setStats({ total, avgScore, distribution, passCount, rewriteCount, blockCount, avgLatency, topViolations, suggestions });
    } catch (err) {
      handleError(err, 'Erro ao carregar metricas do validador', 'Fetch validator metrics');
    } finally {
      setLoading(false);
    }
  }, [agentId, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando metricas do validador...</span>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-medium mb-1">Nenhuma validacao registrada</h3>
          <p className="text-xs text-muted-foreground">O Validator Agent registrara metricas conforme o agente responder leads.</p>
        </CardContent>
      </Card>
    );
  }

  const passRate = Math.round((stats.passCount / stats.total) * 100);
  const rewriteRate = Math.round((stats.rewriteCount / stats.total) * 100);
  const blockRate = Math.round((stats.blockCount / stats.total) * 100);

  const scoreColor = stats.avgScore >= 9 ? 'text-emerald-400' : stats.avgScore >= 7 ? 'text-yellow-400' : 'text-red-400';
  const scoreBarColor = stats.avgScore >= 9 ? 'bg-emerald-500' : stats.avgScore >= 7 ? 'bg-yellow-500' : 'bg-red-500';

  const severityColor = (s: string) => {
    if (s === 'critico') return 'text-red-500 bg-red-500/10';
    if (s === 'grave') return 'text-orange-500 bg-orange-500/10';
    if (s === 'moderado') return 'text-yellow-500 bg-yellow-500/10';
    return 'text-blue-500 bg-blue-500/10';
  };

  const distBars = [
    { label: 'Score 10', key: '10', count: stats.distribution['10'], color: 'bg-emerald-500' },
    { label: 'Score 8-9', key: '8-9', count: stats.distribution['8-9'], color: 'bg-green-500' },
    { label: 'Score 5-7', key: '5-7', count: stats.distribution['5-7'], color: 'bg-yellow-500' },
    { label: 'Score 1-4', key: '1-4', count: stats.distribution['1-4'], color: 'bg-orange-500' },
    { label: 'Score 0', key: '0', count: stats.distribution['0'], color: 'bg-red-500' },
  ];
  const maxDist = Math.max(...distBars.map(d => d.count), 1);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Qualidade do Agente (Validator)</h3>
              <p className="text-[10px] text-muted-foreground">{stats.total} validacoes no periodo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24h</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={fetchStats}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Score + Verdicts */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Score Medio</p>
              <p className={`text-3xl font-bold ${scoreColor}`}>{stats.avgScore}</p>
              <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarColor}`} style={{ width: `${stats.avgScore * 10}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-lg font-bold">{passRate}%</p>
                <p className="text-[9px] text-muted-foreground">PASS ({stats.passCount})</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-yellow-500 shrink-0" />
              <div>
                <p className="text-lg font-bold">{rewriteRate}%</p>
                <p className="text-[9px] text-muted-foreground">REWRITE ({stats.rewriteCount})</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500 shrink-0" />
              <div>
                <p className="text-lg font-bold">{blockRate}%</p>
                <p className="text-[9px] text-muted-foreground">BLOCK ({stats.blockCount})</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution + Violations side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground">Distribuicao de Scores</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {distBars.map(bar => (
                <div key={bar.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">{bar.label}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar.color} transition-all`} style={{ width: `${(bar.count / maxDist) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-medium w-8 text-right">
                    {stats.total > 0 ? `${Math.round((bar.count / stats.total) * 100)}%` : '0%'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Violations */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Top Violacoes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {stats.topViolations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma violacao no periodo</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.topViolations.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${severityColor(v.severity)}`}>
                        {v.severity}
                      </Badge>
                      <span className="flex-1 truncate">{v.rule.replace(/_/g, ' ')}</span>
                      <span className="font-bold tabular-nums">{v.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suggestions */}
        {stats.suggestions.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[11px] uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" />
                Sugestoes de Melhoria
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <ul className="space-y-1.5">
                {stats.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Latency */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Latencia media do validador: {stats.avgLatency}ms</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
