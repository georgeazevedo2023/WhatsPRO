import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { E2eBatchSummary, E2eBatchRun } from '@/types/playground'

export function useE2eBatchHistory(agentId: string | null) {
  return useQuery<E2eBatchSummary[]>({
    queryKey: ['e2e-batch-history', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('e2e_test_batches')
        .select('id, agent_id, created_at, run_type, total, passed, failed, composite_score, status, prompt_hash, created_by')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as E2eBatchSummary[]
    },
  })
}

export function useE2eBatchRuns(batchUuid: string | null) {
  return useQuery<E2eBatchRun[]>({
    queryKey: ['e2e-batch-runs', batchUuid],
    enabled: !!batchUuid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('e2e_test_runs')
        .select('id, scenario_id, scenario_name, category, passed, tools_used, tools_missing, latency_ms, error, results, created_at, approval')
        .eq('batch_uuid', batchUuid!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as E2eBatchRun[]
    },
  })
}

export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentId, runType, createdBy, promptHash }: {
      agentId: string
      runType: 'manual' | 'scheduled' | 'regression'
      createdBy: string
      promptHash: string | null
    }) => {
      const { data, error } = await supabase
        .from('e2e_test_batches')
        .insert({
          agent_id: agentId,
          run_type: runType,
          status: 'running',
          created_by: createdBy,
          prompt_hash: promptHash,
          total: 0,
          passed: 0,
          failed: 0,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['e2e-batch-history', variables.agentId] })
    },
  })
}

export function useCompleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchUuid, total, passed, failed, agentId }: {
      batchUuid: string
      total: number
      passed: number
      failed: number
      agentId: string
    }) => {
      const compositeScore = total > 0 ? Math.round((passed / total) * 100) : 0
      const { error } = await supabase
        .from('e2e_test_batches')
        .update({
          status: 'complete',
          total,
          passed,
          failed,
          composite_score: compositeScore,
        })
        .eq('id', batchUuid)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['e2e-batch-history', variables.agentId] })
    },
  })
}
