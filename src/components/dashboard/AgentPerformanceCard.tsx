import { useEffect, useState, memo } from 'react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';

interface AgentMetric {
  agentId: string;
  name: string;
  conversationsHandled: number;
  resolved: number;
  resolutionRate: number;
  messagesSent: number;
  avgResponseMin: number;
}

const formatMinutes = (minutes: number) => {
  if (minutes === 0) return '-';
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const AgentPerformanceCard = ({ periodDays = 30 }: { periodDays?: number }) => {
  const [metrics, setMetrics] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const { namesMap } = useUserProfiles({ userIds: agentIds, enabled: agentIds.length > 0 });

  useEffect(() => {
    fetchAgentMetrics();
  }, [periodDays]);

  // Re-derive names when namesMap resolves
  useEffect(() => {
    if (Object.keys(namesMap).length === 0) return;
    setMetrics(prev => prev.map(m => ({ ...m, name: namesMap[m.agentId] || 'Desconhecido' })));
  }, [namesMap]);

  const fetchAgentMetrics = async () => {
    setLoading(true);
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - periodDays);
      const sinceISO = sinceDate.toISOString();

      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          id, status, assigned_to,
          conversation_messages(direction, created_at)
        `)
        .not('assigned_to', 'is', null)
        .gte('created_at', sinceISO)
        .limit(1000);

      if (!conversations?.length) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      const ids = [...new Set(conversations.map(c => c.assigned_to).filter(Boolean))] as string[];
      setAgentIds(ids);

      const agentMap = new Map<string, {
        total: number;
        resolved: number;
        msgsSent: number;
        responseTimes: number[];
      }>();

      for (const conv of conversations) {
        const agentId = conv.assigned_to;
        if (!agentId) continue;

        const entry = agentMap.get(agentId) || { total: 0, resolved: 0, msgsSent: 0, responseTimes: [] };
        entry.total++;
        if (conv.status === 'resolvida') entry.resolved++;

        const msgs = (conv.conversation_messages || []) as { direction: string; created_at: string }[];
        entry.msgsSent += msgs.filter(m => m.direction === 'outgoing').length;

        // Calculate first response time
        const sorted = [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const firstIn = sorted.find(m => m.direction === 'incoming');
        const firstOut = sorted.find(m => m.direction === 'outgoing');
        if (firstIn && firstOut) {
          const diffMin = (new Date(firstOut.created_at).getTime() - new Date(firstIn.created_at).getTime()) / 60000;
          if (diffMin > 0 && diffMin < 1440) entry.responseTimes.push(diffMin);
        }

        agentMap.set(agentId, entry);
      }

      const result: AgentMetric[] = Array.from(agentMap.entries()).map(([agentId, data]) => ({
        agentId,
        name: agentId.slice(0, 8), // Placeholder — resolved by namesMap effect
        conversationsHandled: data.total,
        resolved: data.resolved,
        resolutionRate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
        messagesSent: data.msgsSent,
        avgResponseMin: data.responseTimes.length > 0
          ? Math.round((data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length) * 10) / 10
          : 0,
      }));

      result.sort((a, b) => b.conversationsHandled - a.conversationsHandled);
      setMetrics(result);
    } catch (err) {
      handleError(err, 'Erro ao carregar métricas de agentes', 'Agent Performance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton className="h-[300px]" />;
  if (metrics.length === 0) return null;

  const topAgent = metrics[0];

  return (
    <Card className="glass-card-hover">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Performance dos Agentes
          <Badge variant="outline" className="text-[10px] ml-auto">{periodDays}d</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{metrics.length}</p>
            <p className="text-[10px] text-muted-foreground">Agentes ativos</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{metrics.reduce((s, m) => s + m.conversationsHandled, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Conversas total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">
              {(() => {
                const totalConv = metrics.reduce((s, m) => s + m.conversationsHandled, 0);
                const totalRes = metrics.reduce((s, m) => s + m.resolved, 0);
                return totalConv > 0 ? Math.round((totalRes / totalConv) * 100) : 0;
              })()}%
            </p>
            <p className="text-[10px] text-muted-foreground">Resolução média</p>
          </div>
        </div>

        {/* Agent Table */}
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {metrics.map((agent, idx) => (
            <div
              key={agent.agentId}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${idx === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {agent.name}
                  {idx === 0 && <TrendingUp className="w-3 h-3 text-primary inline ml-1" />}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <MessageSquare className="w-2.5 h-2.5" />{agent.conversationsHandled} conv
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" />{agent.resolutionRate}% resolv
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{formatMinutes(agent.avgResponseMin)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{agent.messagesSent}</p>
                <p className="text-[10px] text-muted-foreground">msgs</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(AgentPerformanceCard);
