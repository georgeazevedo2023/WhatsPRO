import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PendingRun {
  id: string;
  scenario_id: string;
  scenario_name: string;
  category: string | null;
  created_at: string;
  passed: boolean;
  tools_missing: string[] | null;
  tools_used: string[] | null;
  error: string | null;
  results: unknown;
  batch_id: string | null;
  latency_ms: number | null;
  total_steps: number;
}

export interface UseE2eApprovalReturn {
  pending: PendingRun[];
  pendingCount: number;
  isLoading: boolean;
  approve: (runId: string, notes: string) => Promise<void>;
  reject: (runId: string, notes: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
}

export function useE2eApproval(agentId: string | null, userId: string | undefined): UseE2eApprovalReturn {
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['e2e-pending', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('e2e_test_runs')
        .select('id, scenario_id, scenario_name, category, created_at, passed, tools_missing, tools_used, error, results, batch_id, latency_ms, total_steps')
        .eq('agent_id', agentId)
        .is('approval', null)
        .eq('passed', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PendingRun[];
    },
    enabled: !!agentId,
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ runId, notes }: { runId: string; notes: string }) => {
      const { error } = await supabase
        .from('e2e_test_runs')
        .update({
          approval: 'human_approved',
          approved_by: userId ?? null,
          approved_at: new Date().toISOString(),
          reviewer_notes: notes || null,
        })
        .eq('id', runId);
      if (error) throw error;
    },
    onMutate: async ({ runId }) => {
      await queryClient.cancelQueries({ queryKey: ['e2e-pending', agentId] });
      const previous = queryClient.getQueryData<PendingRun[]>(['e2e-pending', agentId]);
      queryClient.setQueryData<PendingRun[]>(['e2e-pending', agentId], (old = []) =>
        old.filter(r => r.id !== runId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['e2e-pending', agentId], context?.previous);
      toast.error('Erro ao aprovar — tente novamente');
    },
    onSuccess: () => {
      toast.success('Run aprovado');
      queryClient.invalidateQueries({ queryKey: ['e2e-pending', agentId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ runId, notes }: { runId: string; notes: string }) => {
      const { error } = await supabase
        .from('e2e_test_runs')
        .update({
          approval: 'human_rejected',
          approved_by: userId ?? null,
          approved_at: new Date().toISOString(),
          reviewer_notes: notes || null,
        })
        .eq('id', runId);
      if (error) throw error;
    },
    onMutate: async ({ runId }) => {
      await queryClient.cancelQueries({ queryKey: ['e2e-pending', agentId] });
      const previous = queryClient.getQueryData<PendingRun[]>(['e2e-pending', agentId]);
      queryClient.setQueryData<PendingRun[]>(['e2e-pending', agentId], (old = []) =>
        old.filter(r => r.id !== runId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['e2e-pending', agentId], context?.previous);
      toast.error('Erro ao rejeitar — tente novamente');
    },
    onSuccess: () => {
      toast.success('Run rejeitado — marcar para correção');
      queryClient.invalidateQueries({ queryKey: ['e2e-pending', agentId] });
    },
  });

  const approve = async (runId: string, notes: string) => {
    await approveMutation.mutateAsync({ runId, notes });
  };

  const reject = async (runId: string, notes: string) => {
    await rejectMutation.mutateAsync({ runId, notes });
  };

  return {
    pending,
    pendingCount: pending.length,
    isLoading,
    approve,
    reject,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
