// M19 S4 P6: Hook de metas configuráveis por instância
// Lê e salva metas na tabela instance_goals (criada na migration do P1)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstanceGoal {
  id: string;
  instanceId: string;
  metricKey: string;
  targetValue: number;
  period: string;
  createdBy: string | null;
}

// Hook de leitura das metas da instância
export function useInstanceGoals(instanceId: string | null) {
  return useQuery({
    queryKey: ['instance-goals', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_goals' as any) // tabela criada na migration M19-S4-P1
        .select('id, instance_id, metric_key, target_value, period, created_by')
        .eq('instance_id', instanceId!);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        instanceId: r.instance_id,
        metricKey: r.metric_key,
        targetValue: Number(r.target_value),
        period: r.period,
        createdBy: r.created_by,
      })) as InstanceGoal[];
    },
    staleTime: 120_000,
  });
}

// Mutation de upsert (select + update/insert para compatibilidade com PostgREST)
export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goal: {
      instanceId: string;
      metricKey: string;
      targetValue: number;
      period: string;
    }) => {
      // Verifica se já existe uma meta para essa combinação
      const { data: existing } = await supabase
        .from('instance_goals' as any)
        .select('id')
        .eq('instance_id', goal.instanceId)
        .eq('metric_key', goal.metricKey)
        .eq('period', goal.period)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('instance_goals' as any)
          .update({
            target_value: goal.targetValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('instance_goals' as any)
          .insert({
            instance_id: goal.instanceId,
            metric_key: goal.metricKey,
            target_value: goal.targetValue,
            period: goal.period,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-goals'] });
    },
  });
}
