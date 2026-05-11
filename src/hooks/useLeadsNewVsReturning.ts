// Dashboard do Gestor — leads novos vs recorrentes por dia
// Novo = primeira conversa do contato no período. Recorrente = já existia antes.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatBR } from '@/lib/dateUtils';
import { subDays, startOfDay } from 'date-fns';

export interface LeadsNewVsReturningDay {
  day: string; // yyyy-MM-dd
  label: string; // ex: "seg"
  novos: number;
  recorrentes: number;
}

export interface LeadsNewVsReturningResult {
  series: LeadsNewVsReturningDay[];
  totals: { novos: number; recorrentes: number; total: number };
}

export function useLeadsNewVsReturning(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['leads-new-vs-returning', instanceId, periodDays],
    enabled: !!instanceId,
    staleTime: 60_000,
    queryFn: async (): Promise<LeadsNewVsReturningResult> => {
      if (!instanceId) throw new Error('instanceId required');

      const now = new Date();
      const start = startOfDay(subDays(now, periodDays - 1)).toISOString();
      const end = new Date(now.getTime() + 1000).toISOString();

      const { data, error } = await supabase.rpc('get_leads_new_vs_returning', {
        p_instance_id: instanceId,
        p_start: start,
        p_end: end,
      });
      if (error) throw error;

      const byDay = new Map<string, { novos: number; recorrentes: number }>();
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = subDays(now, i);
        byDay.set(formatBR(d, 'yyyy-MM-dd'), { novos: 0, recorrentes: 0 });
      }
      (data || []).forEach((row) => {
        const key = formatBR(row.day, 'yyyy-MM-dd');
        if (byDay.has(key)) {
          byDay.set(key, { novos: Number(row.novos) || 0, recorrentes: Number(row.recorrentes) || 0 });
        }
      });

      const series: LeadsNewVsReturningDay[] = Array.from(byDay.entries()).map(([day, v]) => ({
        day,
        label: formatBR(day, periodDays <= 7 ? 'EEE' : 'dd/MM'),
        novos: v.novos,
        recorrentes: v.recorrentes,
      }));

      const totals = series.reduce(
        (acc, d) => ({
          novos: acc.novos + d.novos,
          recorrentes: acc.recorrentes + d.recorrentes,
          total: acc.total + d.novos + d.recorrentes,
        }),
        { novos: 0, recorrentes: 0, total: 0 },
      );

      return { series, totals };
    },
  });
}
