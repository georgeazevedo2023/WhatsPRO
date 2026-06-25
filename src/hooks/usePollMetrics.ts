// M17 F5: Poll + NPS metrics hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PollMetrics {
  totalPolls: number;
  totalVotes: number;
  responseRate: number;
  npsAvg: number;
  /** 'numeric_0_10' → npsAvg está em 0-10; 'categorical' → 1-5; 'none' → sem votos NPS. */
  npsScaleMode: 'numeric_0_10' | 'categorical' | 'none';
  /** Votos NPS com nota < 5 (escala numérica). */
  npsLowCount: number;
  npsDistribution: Record<string, number>;
  topOptions: Array<{ option: string; count: number }>;
}

export function usePollMetrics(instanceId: string | undefined, periodDays = 30) {
  return useQuery({
    queryKey: ['poll_metrics', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<PollMetrics> => {
      if (!instanceId) return { totalPolls: 0, totalVotes: 0, responseRate: 0, npsAvg: 0, npsScaleMode: 'none', npsLowCount: 0, npsDistribution: {}, topOptions: [] };

      const since = new Date(Date.now() - periodDays * 86400000).toISOString();

      // Total polls
      const { count: totalPolls } = await supabase
        .from('poll_messages' as any)
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
        .gte('created_at', since);

      // Total votes
      const { data: polls } = await supabase
        .from('poll_messages' as any)
        .select('id, is_nps, options, nps_scale')
        .eq('instance_id', instanceId)
        .gte('created_at', since);

      const pollIds = (polls || []).map((p: any) => p.id);
      let totalVotes = 0;
      const catDistribution: Record<string, number> = {};   // votos NPS categóricos
      const numDistribution: Record<string, number> = {};   // votos NPS numéricos 0-10
      const optionCounts: Record<string, number> = {};
      let numTotal = 0, numCount = 0, numLow = 0;

      if (pollIds.length > 0) {
        const { data: responses } = await supabase
          .from('poll_responses' as any)
          .select('poll_message_id, selected_options, numeric_score')
          .in('poll_message_id', pollIds);

        totalVotes = (responses || []).length;

        for (const resp of (responses || []) as any[]) {
          const poll = (polls || []).find((p: any) => p.id === resp.poll_message_id);
          for (const opt of (resp.selected_options || [])) {
            optionCounts[opt] = (optionCounts[opt] || 0) + 1;
          }
          if (!poll?.is_nps) continue;
          if (poll.nps_scale === 'numeric_0_10' && typeof resp.numeric_score === 'number') {
            numTotal += resp.numeric_score; numCount++;
            if (resp.numeric_score < 5) numLow++;
            const key = String(resp.numeric_score);
            numDistribution[key] = (numDistribution[key] || 0) + 1;
          } else {
            for (const opt of (resp.selected_options || [])) {
              catDistribution[opt] = (catDistribution[opt] || 0) + 1;
            }
          }
        }
      }

      // NPS categórico (Excelente=5 .. Pessimo=1)
      const NPS_SCORES: Record<string, number> = {
        'Excelente': 5, 'Bom': 4, 'Regular': 3, 'Ruim': 2, 'Pessimo': 1,
      };
      let catTotal = 0, catCount = 0;
      for (const [opt, count] of Object.entries(catDistribution)) {
        const score = NPS_SCORES[opt];
        if (score) { catTotal += score * count; catCount += count; }
      }

      // Numérico domina quando há votos 0-10; senão cai no categórico legado.
      const npsScaleMode: PollMetrics['npsScaleMode'] = numCount > 0 ? 'numeric_0_10' : (catCount > 0 ? 'categorical' : 'none');
      const npsAvg = numCount > 0
        ? Math.round((numTotal / numCount) * 10) / 10
        : (catCount > 0 ? Math.round((catTotal / catCount) * 10) / 10 : 0);
      const npsDistribution = numCount > 0 ? numDistribution : catDistribution;

      const topOptions = Object.entries(optionCounts)
        .map(([option, count]) => ({ option, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalPolls: totalPolls || 0,
        totalVotes,
        responseRate: (totalPolls || 0) > 0 ? Math.round((totalVotes / (totalPolls || 1)) * 100) : 0,
        npsAvg,
        npsScaleMode,
        npsLowCount: numLow,
        npsDistribution,
        topOptions,
      };
    },
    staleTime: 60_000,
  });
}
