// M17 F5: Poll + NPS metrics hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PollMetrics {
  totalPolls: number;
  totalVotes: number;
  responseRate: number;
  npsAvg: number;
  npsDistribution: Record<string, number>;
  topOptions: Array<{ option: string; count: number }>;
}

export function usePollMetrics(instanceId: string | undefined, periodDays = 30) {
  return useQuery({
    queryKey: ['poll_metrics', instanceId, periodDays],
    enabled: !!instanceId,
    queryFn: async (): Promise<PollMetrics> => {
      if (!instanceId) return { totalPolls: 0, totalVotes: 0, responseRate: 0, npsAvg: 0, npsDistribution: {}, topOptions: [] };

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
        .select('id, is_nps, options')
        .eq('instance_id', instanceId)
        .gte('created_at', since);

      const pollIds = (polls || []).map((p: any) => p.id);
      let totalVotes = 0;
      let npsDistribution: Record<string, number> = {};
      const optionCounts: Record<string, number> = {};

      if (pollIds.length > 0) {
        const { data: responses } = await supabase
          .from('poll_responses' as any)
          .select('poll_message_id, selected_options')
          .in('poll_message_id', pollIds);

        totalVotes = (responses || []).length;

        // Count options
        for (const resp of (responses || []) as any[]) {
          const poll = (polls || []).find((p: any) => p.id === resp.poll_message_id);
          for (const opt of (resp.selected_options || [])) {
            optionCounts[opt] = (optionCounts[opt] || 0) + 1;
            // NPS distribution
            if (poll?.is_nps) {
              npsDistribution[opt] = (npsDistribution[opt] || 0) + 1;
            }
          }
        }
      }

      // NPS avg (Excelente=5, Bom=4, Regular=3, Ruim=2, Pessimo=1)
      const NPS_SCORES: Record<string, number> = {
        'Excelente': 5, 'Bom': 4, 'Regular': 3, 'Ruim': 2, 'Pessimo': 1,
      };
      let npsTotal = 0;
      let npsCount = 0;
      for (const [opt, count] of Object.entries(npsDistribution)) {
        const score = NPS_SCORES[opt];
        if (score) { npsTotal += score * count; npsCount += count; }
      }

      const topOptions = Object.entries(optionCounts)
        .map(([option, count]) => ({ option, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalPolls: totalPolls || 0,
        totalVotes,
        responseRate: (totalPolls || 0) > 0 ? Math.round((totalVotes / (totalPolls || 1)) * 100) : 0,
        npsAvg: npsCount > 0 ? Math.round((npsTotal / npsCount) * 10) / 10 : 0,
        npsDistribution,
        topOptions,
      };
    },
    staleTime: 60_000,
  });
}
