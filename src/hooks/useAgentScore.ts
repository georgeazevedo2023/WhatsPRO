import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  computeCompositeScore, computeDailyScores, getScoreTier, getScoreTrend,
  type ScoreBreakdown, type DailyScore, type ScoreTier,
} from '@/lib/agentScoring';

export interface AgentScoreResult {
  breakdown: ScoreBreakdown;
  tier: ScoreTier;
  dailyScores: DailyScore[];
  trend: 'up' | 'down' | 'stable';
  hasData: boolean;
  isLoading: boolean;
}

export function useAgentScore(agentId: string | null, days = 7): AgentScoreResult {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const { data: e2eRuns = [], isLoading: loadingE2e } = useQuery({
    queryKey: ['agent-score-e2e', agentId, days],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('e2e_test_runs')
        .select('passed, tools_used, tools_missing, latency_ms, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: validations = [], isLoading: loadingValidations } = useQuery({
    queryKey: ['agent-score-validations', agentId, days],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('ai_agent_validations')
        .select('score, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const breakdown = useMemo(
    () => computeCompositeScore(e2eRuns, validations),
    [e2eRuns, validations]
  );

  const dailyScores = useMemo(
    () => computeDailyScores(e2eRuns, validations, days),
    [e2eRuns, validations, days]
  );

  const hasData = e2eRuns.length > 0 || validations.length > 0;
  const tier = getScoreTier(breakdown.composite, hasData);
  const trend = getScoreTrend(dailyScores);
  const isLoading = loadingE2e || loadingValidations;

  return { breakdown, tier, dailyScores, trend, hasData, isLoading };
}
