// M19 S4: Hook de métricas individuais do agente IA
// Consulta v_agent_performance + follow_up_executions em paralelo
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentKPIs {
  totalResponses: number;
  totalHandoffs: number;
  coveragePct: number;          // responses / (responses + handoffs) * 100
  avgLatencyMs: number;
  totalCostUsd: number;
  costPerConversation: number;  // totalCost / (responses + handoffs)
  totalErrors: number;
  shadowEvents: number;
  followUpsSent: number;
  followUpRepliedPct: number;   // replied / sent * 100
}

export interface AgentTrendDay {
  date: string;
  responses: number;
  handoffs: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AgentDetail {
  kpis: AgentKPIs;
  trend: AgentTrendDay[];
}

export function useAgentDetail(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['agent-detail', instanceId, periodDays],
    enabled: !!instanceId,
    staleTime: 60_000,
    queryFn: async (): Promise<AgentDetail> => {
      if (!instanceId) throw new Error('instanceId obrigatório');

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      // Query 1 — Performance diária do agente (view not in generated types)
      const agentPerfPromise = supabase
        .from('v_agent_performance' as any) // view not in generated types
        .select('activity_date, responses_sent, handoffs, errors, shadow_events, cost_usd_approx, avg_response_latency_ms')
        .eq('instance_id', instanceId)
        .gte('activity_date', sinceDate);

      // Query 2 — Follow-up executions (table not in generated types)
      const followUpPromise = supabase
        .from('follow_up_executions' as any) // table not in generated types
        .select('id, status, sent_at')
        .eq('instance_id', instanceId)
        .gte('sent_at', since)
        .in('status', ['sent', 'replied']);

      const [agentPerfRes, followUpRes] = await Promise.all([
        agentPerfPromise,
        followUpPromise,
      ]);

      // ── Agrega métricas de performance ──
      const perfRows = (agentPerfRes.data || []) as any[];

      const totalResponses = perfRows.reduce((s: number, r: any) => s + (r.responses_sent || 0), 0);
      const totalHandoffs = perfRows.reduce((s: number, r: any) => s + (r.handoffs || 0), 0);
      const totalErrors = perfRows.reduce((s: number, r: any) => s + (r.errors || 0), 0);
      const shadowEvents = perfRows.reduce((s: number, r: any) => s + (r.shadow_events || 0), 0);
      const totalCostUsd = perfRows.reduce((s: number, r: any) => s + (Number(r.cost_usd_approx) || 0), 0);

      const totalInteractions = totalResponses + totalHandoffs;
      const coveragePct = totalInteractions > 0
        ? Math.round((totalResponses / totalInteractions) * 100)
        : 0;
      const costPerConversation = totalInteractions > 0
        ? Math.round((totalCostUsd / totalInteractions) * 10000) / 10000
        : 0;

      // Latência média ponderada por dia
      const latencyRows = perfRows.filter((r: any) => r.avg_response_latency_ms);
      const avgLatencyMs = latencyRows.length > 0
        ? Math.round(
            latencyRows.reduce((s: number, r: any) => s + (r.avg_response_latency_ms || 0), 0) / latencyRows.length
          )
        : 0;

      // ── Tendência diária ──
      const trendMap: Record<string, { responses: number; handoffs: number; costUsd: number; latencies: number[] }> = {};
      for (const r of perfRows) {
        const date = (r.activity_date as string) || '';
        if (!date) continue;
        trendMap[date] = trendMap[date] || { responses: 0, handoffs: 0, costUsd: 0, latencies: [] };
        trendMap[date].responses += r.responses_sent || 0;
        trendMap[date].handoffs += r.handoffs || 0;
        trendMap[date].costUsd += Number(r.cost_usd_approx) || 0;
        if (r.avg_response_latency_ms) {
          trendMap[date].latencies.push(Number(r.avg_response_latency_ms));
        }
      }

      const trend: AgentTrendDay[] = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          responses: vals.responses,
          handoffs: vals.handoffs,
          costUsd: Math.round(vals.costUsd * 1000000) / 1000000,
          avgLatencyMs: vals.latencies.length > 0
            ? Math.round(vals.latencies.reduce((a, b) => a + b, 0) / vals.latencies.length)
            : 0,
        }));

      // ── Follow-ups ──
      const followUpRows = (followUpRes.data || []) as any[];
      const followUpsSent = followUpRows.length;
      const followUpReplied = followUpRows.filter((r: any) => r.status === 'replied').length;
      const followUpRepliedPct = followUpsSent > 0
        ? Math.round((followUpReplied / followUpsSent) * 100)
        : 0;

      const kpis: AgentKPIs = {
        totalResponses,
        totalHandoffs,
        coveragePct,
        avgLatencyMs,
        totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
        costPerConversation,
        totalErrors,
        shadowEvents,
        followUpsSent,
        followUpRepliedPct,
      };

      return { kpis, trend };
    },
  });
}
