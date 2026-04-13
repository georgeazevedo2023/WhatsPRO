// M19 S4-P4: Hook de métricas de transbordo
// Consulta v_handoff_details (view não tipada — usa `as any`) e agrega no JS
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HandoffKPIs {
  totalHandoffs: number;
  evitavelCount: number;
  evitavelPct: number;
  necessarioCount: number;
  converteuCount: number;
  converteuPct: number;           // converteu / total * 100
  avgMinutesBeforeHandoff: number;
  avgMinutesToResolve: number;    // apenas resolvidos
}

export interface HandoffByMotivo {
  reason: string;
  count: number;
  pct: number;
}

export interface HandoffByTrigger {
  trigger: string;
  count: number;
  evitavelCount: number;
}

export interface HandoffRow {
  conversationId: string;
  sellerId: string | null;
  handoffAt: string;
  reason: string | null;
  trigger: string | null;
  evitavel: boolean;
  converteu: boolean;
  minutesBeforeHandoff: number | null;
  minutesToResolve: number | null;
  status: string;
}

export interface HandoffMetrics {
  kpis: HandoffKPIs;
  byMotivo: HandoffByMotivo[];
  byTrigger: HandoffByTrigger[];
  recentRows: HandoffRow[];
}

export function useHandoffMetrics(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['handoff-metrics', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<HandoffMetrics> => {
      if (!instanceId) throw new Error('instanceId required');

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();

      // v_handoff_details não está nos tipos gerados — usa `as any`
      const { data, error } = await supabase
        .from('v_handoff_details' as any)
        .select(
          'conversation_id, seller_id, handoff_at, handoff_reason, handoff_trigger, evitavel, converteu, minutes_before_handoff, minutes_to_resolve_after_handoff, status'
        )
        .eq('instance_id', instanceId)
        .gte('handoff_at', since)
        .order('handoff_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as any[];

      // ── KPIs ──
      const totalHandoffs = rows.length;
      const evitavelCount = rows.filter((r: any) => r.evitavel === true).length;
      const evitavelPct = totalHandoffs > 0
        ? Math.round((evitavelCount / totalHandoffs) * 100)
        : 0;
      const necessarioCount = totalHandoffs - evitavelCount;
      const converteuCount = rows.filter((r: any) => r.converteu === true).length;
      const converteuPct = totalHandoffs > 0
        ? Math.round((converteuCount / totalHandoffs) * 100)
        : 0;

      const mbhRows = rows.filter((r: any) => r.minutes_before_handoff != null);
      const avgMinutesBeforeHandoff = mbhRows.length > 0
        ? Math.round(mbhRows.reduce((s: number, r: any) => s + (Number(r.minutes_before_handoff) || 0), 0) / mbhRows.length)
        : 0;

      const mtrRows = rows.filter((r: any) => r.minutes_to_resolve_after_handoff != null);
      const avgMinutesToResolve = mtrRows.length > 0
        ? Math.round(mtrRows.reduce((s: number, r: any) => s + (Number(r.minutes_to_resolve_after_handoff) || 0), 0) / mtrRows.length)
        : 0;

      const kpis: HandoffKPIs = {
        totalHandoffs,
        evitavelCount,
        evitavelPct,
        necessarioCount,
        converteuCount,
        converteuPct,
        avgMinutesBeforeHandoff,
        avgMinutesToResolve,
      };

      // ── Por motivo ──
      const motivoCounts: Record<string, number> = {};
      for (const r of rows) {
        const reason = (r.handoff_reason as string) || 'sem motivo';
        motivoCounts[reason] = (motivoCounts[reason] || 0) + 1;
      }
      const byMotivo: HandoffByMotivo[] = Object.entries(motivoCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([reason, count]) => ({
          reason,
          count,
          pct: totalHandoffs > 0 ? Math.round((count / totalHandoffs) * 100) : 0,
        }));

      // ── Por trigger ──
      const triggerMap: Record<string, { count: number; evitavelCount: number }> = {};
      for (const r of rows) {
        const trigger = (r.handoff_trigger as string) || 'desconhecido';
        triggerMap[trigger] = triggerMap[trigger] || { count: 0, evitavelCount: 0 };
        triggerMap[trigger].count++;
        if (r.evitavel === true) triggerMap[trigger].evitavelCount++;
      }
      const byTrigger: HandoffByTrigger[] = Object.entries(triggerMap)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([trigger, data]) => ({ trigger, count: data.count, evitavelCount: data.evitavelCount }));

      // ── Últimos 20 handoffs ──
      const recentRows: HandoffRow[] = rows.slice(0, 20).map((r: any) => ({
        conversationId: r.conversation_id as string,
        sellerId: (r.seller_id as string | null) ?? null,
        handoffAt: r.handoff_at as string,
        reason: (r.handoff_reason as string | null) ?? null,
        trigger: (r.handoff_trigger as string | null) ?? null,
        evitavel: r.evitavel === true,
        converteu: r.converteu === true,
        minutesBeforeHandoff: r.minutes_before_handoff != null ? Number(r.minutes_before_handoff) : null,
        minutesToResolve: r.minutes_to_resolve_after_handoff != null ? Number(r.minutes_to_resolve_after_handoff) : null,
        status: (r.status as string) || '',
      }));

      return { kpis, byMotivo, byTrigger, recentRows };
    },
    staleTime: 60_000,
  });
}
