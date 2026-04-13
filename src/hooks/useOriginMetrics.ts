// M19 S4 P5: Hook de métricas de origem
// Consulta v_lead_metrics (as any) + utm_campaigns + utm_visits via Promise.all
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OriginChannel {
  origin: string;          // 'bio' | 'campanha' | 'formulario' | 'direto' | etc.
  totalLeads: number;
  qualifiedLeads: number;  // current_score >= 70
  avgTicket: number | null;
  avgScore: number;
  conversionRate: number;  // qualified / total * 100
}

export interface UTMBreakdownRow {
  utmSource: string;
  utmMedium: string;
  campaignName: string;
  visits: number;
  matchedLeads: number;    // contact_id NOT NULL
  conversionPct: number;
}

export interface OriginMetricsData {
  channels: OriginChannel[];
  utmBreakdown: UTMBreakdownRow[];
  totalLeads: number;
}

export function useOriginMetrics(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['origin-metrics', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<OriginMetricsData> => {
      if (!instanceId) throw new Error('instanceId required');

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();

      // ── Query 1: leads por origem via v_lead_metrics ──
      // v_lead_metrics não está nos tipos — usar as any com comentário
      const [leadMetricsRes, utmCampaignsRes] = await Promise.all([
        supabase
          .from('v_lead_metrics' as any)
          .select('lead_id, origin, current_score, avg_ticket, lead_created_at')
          .eq('instance_id', instanceId)
          .gte('lead_created_at', since),

        supabase
          .from('utm_campaigns')
          .select('id, name, utm_source, utm_medium')
          .eq('instance_id', instanceId),
      ]);

      // ── Processar Channels ──
      const leadRows = (leadMetricsRes.data || []) as any[];

      // Agrupar por origem
      const originMap: Record<string, {
        leads: any[];
        scores: number[];
        tickets: number[];
      }> = {};

      for (const r of leadRows) {
        const origin = (r.origin as string) || 'direto';
        if (!originMap[origin]) {
          originMap[origin] = { leads: [], scores: [], tickets: [] };
        }
        originMap[origin].leads.push(r);
        originMap[origin].scores.push(r.current_score ?? 50);
        if (r.avg_ticket && Number(r.avg_ticket) > 0) {
          originMap[origin].tickets.push(Number(r.avg_ticket));
        }
      }

      const channels: OriginChannel[] = Object.entries(originMap)
        .map(([origin, data]) => {
          const totalLeads = data.leads.length;
          const qualifiedLeads = data.leads.filter((l: any) => (l.current_score ?? 0) >= 70).length;
          const avgScore = totalLeads > 0
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : 0;
          // avgTicket só exibido se >= 3 leads com ticket
          const avgTicket = data.tickets.length >= 3
            ? Math.round(data.tickets.reduce((a, b) => a + b, 0) / data.tickets.length)
            : null;
          const conversionRate = totalLeads > 0
            ? Math.round((qualifiedLeads / totalLeads) * 100)
            : 0;
          return { origin, totalLeads, qualifiedLeads, avgTicket, avgScore, conversionRate };
        })
        .sort((a, b) => b.totalLeads - a.totalLeads);

      // ── Processar UTM Breakdown ──
      let utmBreakdown: UTMBreakdownRow[] = [];

      const campaigns = (utmCampaignsRes.data || []) as {
        id: string;
        name: string;
        utm_source: string;
        utm_medium: string;
      }[];

      if (campaigns.length > 0) {
        const campaignIds = campaigns.map((c) => c.id);

        const { data: visitsData } = await supabase
          .from('utm_visits')
          .select('campaign_id, contact_id, visited_at')
          .in('campaign_id', campaignIds)
          .gte('visited_at', since);

        const visitRows = (visitsData || []) as {
          campaign_id: string;
          contact_id: string | null;
          visited_at: string;
        }[];

        // Agrupar visitas por campaign_id
        const visitMap: Record<string, { visits: number; matched: number }> = {};
        for (const v of visitRows) {
          if (!visitMap[v.campaign_id]) {
            visitMap[v.campaign_id] = { visits: 0, matched: 0 };
          }
          visitMap[v.campaign_id].visits++;
          if (v.contact_id) visitMap[v.campaign_id].matched++;
        }

        utmBreakdown = campaigns
          .filter((c) => visitMap[c.id]?.visits > 0)
          .map((c) => {
            const stats = visitMap[c.id] || { visits: 0, matched: 0 };
            return {
              utmSource: c.utm_source,
              utmMedium: c.utm_medium,
              campaignName: c.name,
              visits: stats.visits,
              matchedLeads: stats.matched,
              conversionPct: stats.visits > 0
                ? Math.round((stats.matched / stats.visits) * 100)
                : 0,
            };
          })
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 20);
      }

      return {
        channels,
        utmBreakdown,
        totalLeads: leadRows.length,
      };
    },
    staleTime: 60_000,
  });
}
