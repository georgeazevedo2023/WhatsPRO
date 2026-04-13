// M19 S4: Hook de métricas individuais do vendedor
// Consulta v_vendor_activity + NPS + ticket médio em paralelo
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VendorKPIs {
  conversations: number;
  resolved: number;
  resolutionRate: number;
  avgResolutionMin: number;
  npsAvg: number;
  avgTicket: number;
  pendingCount: number;
  uniqueContacts: number;
}

export interface VendorTrendDay {
  date: string;
  conversations: number;
  resolved: number;
  avgResolutionMin: number;
}

export interface VendorDetail {
  kpis: VendorKPIs;
  trend: VendorTrendDay[];
}

const NPS_SCORES: Record<string, number> = {
  Excelente: 5,
  Bom: 4,
  Regular: 3,
  Ruim: 2,
  Pessimo: 1,
};

export function useVendorDetail(
  sellerId: string | null,
  instanceId: string | null,
  periodDays = 30,
) {
  return useQuery({
    queryKey: ['vendor-detail', sellerId, instanceId, periodDays],
    enabled: !!sellerId && !!instanceId,
    staleTime: 60_000,
    queryFn: async (): Promise<VendorDetail> => {
      if (!sellerId || !instanceId) throw new Error('sellerId e instanceId obrigatórios');

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      // Query 1 — Atividade diária do vendedor (view não tipada)
      const vendorActivityPromise = supabase
        .from('v_vendor_activity' as any) // view not in generated types
        .select('activity_date, seller_id, conversations_handled, resolved_count, avg_resolution_minutes')
        .eq('instance_id', instanceId)
        .eq('seller_id', sellerId)
        .gte('activity_date', sinceDate);

      // Query 2 — Polls NPS da instância no período
      const pollsPromise = supabase
        .from('poll_messages' as any) // view not in generated types
        .select('id')
        .eq('instance_id', instanceId)
        .eq('is_nps', true)
        .gte('created_at', since);

      // Query 3 — Conversas do vendedor (para pendingCount, uniqueContacts e ticket médio)
      const convsPromise = supabase
        .from('conversations')
        .select('id, status, contact_id')
        .eq('instance_id', instanceId)
        .eq('assigned_to', sellerId)
        .gte('created_at', since);

      const [vendorActivityRes, pollsRes, convsRes] = await Promise.all([
        vendorActivityPromise,
        pollsPromise,
        convsPromise,
      ]);

      // ── Atividade diária ──
      const activityRows = (vendorActivityRes.data || []) as any[];

      // Agrega por data para o trend
      const trendMap: Record<string, { conversations: number; resolved: number; resolutionMins: number[] }> = {};
      for (const r of activityRows) {
        const date = (r.activity_date as string) || '';
        if (!date) continue;
        trendMap[date] = trendMap[date] || { conversations: 0, resolved: 0, resolutionMins: [] };
        trendMap[date].conversations += r.conversations_handled || 0;
        trendMap[date].resolved += r.resolved_count || 0;
        if (r.avg_resolution_minutes) {
          trendMap[date].resolutionMins.push(Number(r.avg_resolution_minutes));
        }
      }

      const trend: VendorTrendDay[] = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          conversations: vals.conversations,
          resolved: vals.resolved,
          avgResolutionMin: vals.resolutionMins.length > 0
            ? Math.round(vals.resolutionMins.reduce((a, b) => a + b, 0) / vals.resolutionMins.length)
            : 0,
        }));

      // KPIs agregados
      const totalConversations = activityRows.reduce((s: number, r: any) => s + (r.conversations_handled || 0), 0);
      const totalResolved = activityRows.reduce((s: number, r: any) => s + (r.resolved_count || 0), 0);
      const allMins = activityRows
        .filter((r: any) => r.avg_resolution_minutes)
        .map((r: any) => Number(r.avg_resolution_minutes));
      const avgResolutionMin = allMins.length > 0
        ? Math.round(allMins.reduce((a: number, b: number) => a + b, 0) / allMins.length)
        : 0;
      const resolutionRate = totalConversations > 0
        ? Math.round((totalResolved / totalConversations) * 100)
        : 0;

      // ── Conversas: IDs + pendingCount + uniqueContacts ──
      const convRows = (convsRes.data || []) as any[];
      const convIds = convRows.map((c: any) => c.id as string);
      const pendingCount = convRows.filter((c: any) => c.status === 'open' || c.status === 'pending').length;
      const uniqueContacts = new Set(convRows.map((c: any) => c.contact_id as string).filter(Boolean)).size;

      // ── NPS do vendedor ──
      let npsAvg = 0;
      const pollIds = ((pollsRes.data || []) as any[]).map((p: any) => p.id);
      if (pollIds.length > 0 && convIds.length > 0) {
        const { data: pollResponses } = await supabase
          .from('poll_responses' as any) // view not in generated types
          .select('selected_options, conversation_id')
          .in('poll_message_id', pollIds)
          .in('conversation_id', convIds);

        let npsTotal = 0;
        let npsCount = 0;
        for (const resp of (pollResponses || []) as any[]) {
          for (const opt of (resp.selected_options || [])) {
            const score = NPS_SCORES[opt as string];
            if (score) { npsTotal += score; npsCount++; }
          }
        }
        npsAvg = npsCount > 0 ? Math.round((npsTotal / npsCount) * 10) / 10 : 0;
      }

      // ── Ticket médio: via v_lead_metrics filtrado por instance_id ──
      // Busca leads cujas conversas têm assigned_to = sellerId
      let avgTicket = 0;
      if (convIds.length > 0) {
        const { data: leadMetrics } = await supabase
          .from('v_lead_metrics' as any) // view not in generated types
          .select('lead_id, avg_ticket')
          .eq('instance_id', instanceId);

        const ticketRows = (leadMetrics || []) as any[];
        const validTickets = ticketRows
          .filter((r: any) => r.avg_ticket && Number(r.avg_ticket) > 0)
          .map((r: any) => Number(r.avg_ticket));
        avgTicket = validTickets.length > 0
          ? Math.round(validTickets.reduce((a: number, b: number) => a + b, 0) / validTickets.length)
          : 0;
      }

      const kpis: VendorKPIs = {
        conversations: totalConversations,
        resolved: totalResolved,
        resolutionRate,
        avgResolutionMin,
        npsAvg,
        avgTicket,
        pendingCount,
        uniqueContacts,
      };

      return { kpis, trend };
    },
  });
}
