// NPS-on-finalize (2026-06-25): breakdown do NPS 0-10 por atendente (quem finalizou).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NpsByAttendant {
  attendant_id: string | null;
  attendant_name: string | null;
  votes: number;
  avg_score: number | null;
  promoters: number;
  detractors: number;
  low_count: number;
}

export function useNpsByAttendant(instanceId: string | undefined, periodDays = 30) {
  return useQuery({
    queryKey: ['nps_by_attendant', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<NpsByAttendant[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase.rpc('get_nps_by_attendant' as any, {
        p_instance_id: instanceId,
        p_period_days: periodDays,
      });
      if (error) throw error;
      return (data || []) as NpsByAttendant[];
    },
    staleTime: 60_000,
  });
}
