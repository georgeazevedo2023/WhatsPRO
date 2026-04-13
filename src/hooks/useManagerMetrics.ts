// M19 S3: Hook central de métricas do gestor
// Consulta as 6 views SQL do S2 via Promise.all
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ManagerKPIs {
  newLeads: number;
  conversionRate: number;
  handoffRate: number;
  npsAvg: number;
  iaCostUsd: number;
  avgLeadScore: number;
}

export interface LeadsByOrigin {
  origin: string;
  count: number;
}

export interface TrendDay {
  date: string;
  leads: number;
  conversions: number;
}

export interface SellerRankData {
  sellerId: string;
  sellerName: string;
  conversations: number;
  resolved: number;
  resolutionRate: number;
  avgResolutionMin: number;
}

export interface FunnelStageData {
  stage: string;
  uniqueLeads: number;
  pct: number;
}

export interface IAvsVendorData {
  iaResponses: number;
  iaHandoffs: number;
  iaCoveragePct: number;
  iaAvgLatencyMs: number;
  iaCostUsd: number;
  vendorConversations: number;
  vendorResolved: number;
  vendorAvgResolutionMin: number;
  vendorActiveSellers: number;
}

export interface ManagerMetrics {
  kpis: ManagerKPIs;
  leadsByOrigin: LeadsByOrigin[];
  trend: TrendDay[];
  sellers: SellerRankData[];
  funnel: FunnelStageData[];
  iaVsVendor: IAvsVendorData;
}

const FUNNEL_ORDER = ['contact', 'qualification', 'intention', 'conversion'];

export function useManagerMetrics(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['manager-metrics', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<ManagerMetrics> => {
      if (!instanceId) throw new Error('instanceId required');

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      const [
        leadMetricsRes,
        agentPerfRes,
        funnelRes,
        iaVendorRes,
        vendorActivityRes,
        pollRes,
      ] = await Promise.all([
        supabase
          .from('v_lead_metrics' as any)
          .select('lead_id, origin, current_score, lead_created_at')
          .eq('instance_id', instanceId)
          .gte('lead_created_at', since),

        supabase
          .from('v_agent_performance' as any)
          .select('activity_date, responses_sent, handoffs, cost_usd_approx')
          .eq('instance_id', instanceId)
          .gte('activity_date', sinceDate),

        supabase
          .from('v_conversion_funnel' as any)
          .select('stage, unique_leads, event_date')
          .eq('instance_id', instanceId)
          .gte('event_date', sinceDate),

        supabase
          .from('v_ia_vs_vendor' as any)
          .select('ia_responses, ia_handoffs, ia_coverage_pct, ia_avg_latency_ms, ia_cost_usd, vendor_conversations, vendor_resolved, vendor_avg_resolution_minutes, vendor_active_sellers')
          .eq('instance_id', instanceId)
          .gte('activity_date', sinceDate),

        supabase
          .from('v_vendor_activity' as any)
          .select('seller_id, conversations_handled, resolved_count, avg_resolution_minutes')
          .eq('instance_id', instanceId)
          .gte('activity_date', sinceDate),

        supabase
          .from('poll_messages' as any)
          .select('id')
          .eq('instance_id', instanceId)
          .eq('is_nps', true)
          .gte('created_at', since),
      ]);

      // ── KPIs ──
      const leadRows = (leadMetricsRes.data || []) as any[];
      const newLeads = leadRows.length;
      const avgLeadScore = newLeads > 0
        ? Math.round(leadRows.reduce((s: number, r: any) => s + (r.current_score ?? 50), 0) / newLeads)
        : 50;

      const agentRows = (agentPerfRes.data || []) as any[];
      const iaCostUsd = agentRows.reduce((s: number, r: any) => s + (Number(r.cost_usd_approx) || 0), 0);
      const totalResponses = agentRows.reduce((s: number, r: any) => s + (r.responses_sent || 0), 0);
      const totalHandoffs = agentRows.reduce((s: number, r: any) => s + (r.handoffs || 0), 0);
      const handoffRate = (totalResponses + totalHandoffs) > 0
        ? Math.round((totalHandoffs / (totalResponses + totalHandoffs)) * 100)
        : 0;

      const funnelRows = (funnelRes.data || []) as any[];
      const conversionLeads = funnelRows
        .filter((r: any) => r.stage === 'conversion')
        .reduce((s: number, r: any) => s + (r.unique_leads || 0), 0);
      const conversionRate = newLeads > 0 ? Math.round((conversionLeads / newLeads) * 100) : 0;

      // NPS avg — query poll_responses somente se há polls
      let npsAvg = 0;
      const pollIds = ((pollRes.data || []) as any[]).map((p: any) => p.id);
      if (pollIds.length > 0) {
        const { data: pollResponses } = await supabase
          .from('poll_responses' as any)
          .select('selected_options')
          .in('poll_message_id', pollIds);
        const NPS_SCORES: Record<string, number> = { Excelente: 5, Bom: 4, Regular: 3, Ruim: 2, Pessimo: 1 };
        let npsTotal = 0;
        let npsCount = 0;
        for (const resp of (pollResponses || []) as any[]) {
          for (const opt of (resp.selected_options || [])) {
            const score = NPS_SCORES[opt];
            if (score) { npsTotal += score; npsCount++; }
          }
        }
        npsAvg = npsCount > 0 ? Math.round((npsTotal / npsCount) * 10) / 10 : 0;
      }

      // ── Leads por origem ──
      const originCounts: Record<string, number> = {};
      for (const r of leadRows) {
        const orig = (r.origin as string) || 'direto';
        originCounts[orig] = (originCounts[orig] || 0) + 1;
      }
      const leadsByOrigin: LeadsByOrigin[] = Object.entries(originCounts)
        .map(([origin, count]) => ({ origin, count }))
        .sort((a, b) => b.count - a.count);

      // ── Tendência diária ──
      const trendMap: Record<string, { leads: number; conversions: number }> = {};
      for (const r of leadRows) {
        const date = ((r.lead_created_at as string) || '').slice(0, 10);
        if (!date) continue;
        trendMap[date] = trendMap[date] || { leads: 0, conversions: 0 };
        trendMap[date].leads++;
      }
      for (const r of funnelRows) {
        if (r.stage === 'conversion') {
          const date = (r.event_date as string) || '';
          if (!date) continue;
          trendMap[date] = trendMap[date] || { leads: 0, conversions: 0 };
          trendMap[date].conversions += r.unique_leads || 0;
        }
      }
      const trend: TrendDay[] = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, leads: vals.leads, conversions: vals.conversions }));

      // ── Ranking vendedores ──
      const sellerMap: Record<string, { conversations: number; resolved: number; resolutionMins: number[] }> = {};
      for (const r of (vendorActivityRes.data || []) as any[]) {
        const sid = r.seller_id as string;
        if (!sid) continue;
        sellerMap[sid] = sellerMap[sid] || { conversations: 0, resolved: 0, resolutionMins: [] };
        sellerMap[sid].conversations += r.conversations_handled || 0;
        sellerMap[sid].resolved += r.resolved_count || 0;
        if (r.avg_resolution_minutes) {
          sellerMap[sid].resolutionMins.push(Number(r.avg_resolution_minutes));
        }
      }
      const sellers: SellerRankData[] = Object.entries(sellerMap)
        .map(([sellerId, data]) => ({
          sellerId,
          sellerName: sellerId.slice(0, 8),
          conversations: data.conversations,
          resolved: data.resolved,
          resolutionRate: data.conversations > 0
            ? Math.round((data.resolved / data.conversations) * 100)
            : 0,
          avgResolutionMin: data.resolutionMins.length > 0
            ? Math.round(data.resolutionMins.reduce((a, b) => a + b, 0) / data.resolutionMins.length)
            : 0,
        }))
        .sort((a, b) => b.conversations - a.conversations)
        .slice(0, 10);

      // ── Funil por etapa ──
      const stageTotals: Record<string, number> = {};
      for (const r of funnelRows) {
        stageTotals[r.stage as string] = (stageTotals[r.stage as string] || 0) + (r.unique_leads || 0);
      }
      const topStageValue = Math.max(...Object.values(stageTotals), 1);
      const funnel: FunnelStageData[] = FUNNEL_ORDER
        .filter(s => stageTotals[s] !== undefined)
        .map(s => ({
          stage: s,
          uniqueLeads: stageTotals[s] || 0,
          pct: Math.round(((stageTotals[s] || 0) / topStageValue) * 100),
        }));

      // ── IA vs Vendedor ──
      const ivRows = (iaVendorRes.data || []) as any[];
      const iaVsVendor: IAvsVendorData = {
        iaResponses: ivRows.reduce((s: number, r: any) => s + (r.ia_responses || 0), 0),
        iaHandoffs: ivRows.reduce((s: number, r: any) => s + (r.ia_handoffs || 0), 0),
        iaCoveragePct: ivRows.length > 0
          ? Math.round(ivRows.reduce((s: number, r: any) => s + (Number(r.ia_coverage_pct) || 0), 0) / ivRows.length)
          : 0,
        iaAvgLatencyMs: ivRows.length > 0
          ? Math.round(ivRows.reduce((s: number, r: any) => s + (r.ia_avg_latency_ms || 0), 0) / ivRows.length)
          : 0,
        iaCostUsd,
        vendorConversations: ivRows.reduce((s: number, r: any) => s + (r.vendor_conversations || 0), 0),
        vendorResolved: ivRows.reduce((s: number, r: any) => s + (r.vendor_resolved || 0), 0),
        vendorAvgResolutionMin: ivRows.length > 0
          ? Math.round(ivRows.reduce((s: number, r: any) => s + (Number(r.vendor_avg_resolution_minutes) || 0), 0) / ivRows.length)
          : 0,
        vendorActiveSellers: ivRows.length > 0
          ? Math.max(...ivRows.map((r: any) => r.vendor_active_sellers || 0))
          : 0,
      };

      return { kpis: { newLeads, conversionRate, handoffRate, npsAvg, iaCostUsd, avgLeadScore }, leadsByOrigin, trend, sellers, funnel, iaVsVendor };
    },
    staleTime: 60_000,
  });
}
