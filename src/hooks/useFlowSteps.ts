import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { FlowStep, FlowStepInsert, FlowStepUpdate } from '@/types/flows'

const QK = (flowId: string) => ['flow-steps', flowId]

// Busca todos os steps de um flow ordenados por position
export function useFlowSteps(flowId: string | undefined) {
  return useQuery({
    queryKey: QK(flowId ?? ''),
    enabled: !!flowId,
    queryFn: async (): Promise<FlowStep[]> => {
      if (!flowId) return []
      const { data, error } = await supabase
        .from('flow_steps')
        .select('*')
        .eq('flow_id', flowId)
        .eq('is_active', true)
        .order('position', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

// Criar step
export function useCreateFlowStep() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (step: FlowStepInsert): Promise<FlowStep> => {
      const { data, error } = await supabase
        .from('flow_steps')
        .insert(step)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QK(data.flow_id) })
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Step adicionado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar step', description: String(err), variant: 'destructive' })
    },
  })
}

// Atualizar step (name, step_config, exit_rules)
export function useUpdateFlowStep() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      id,
      flowId,
      ...update
    }: FlowStepUpdate & { id: string; flowId: string }): Promise<FlowStep> => {
      const { data, error } = await supabase
        .from('flow_steps')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QK(vars.flowId) })
      toast({ title: 'Step atualizado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar step', description: String(err), variant: 'destructive' })
    },
  })
}

// Deletar step (soft delete: is_active = false)
export function useDeleteFlowStep() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id }: { id: string; flowId: string }): Promise<void> => {
      const { error } = await supabase
        .from('flow_steps')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QK(vars.flowId) })
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Step removido' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao remover step', description: String(err), variant: 'destructive' })
    },
  })
}

// Reordenar steps: recebe array com nova ordem e atualiza position de cada um
export function useReorderFlowSteps() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      flowId,
      order,
    }: {
      flowId: string
      order: Array<{ id: string; position: number }>
    }): Promise<void> => {
      // UPDATE sequencial (não paralelo) para evitar conflito
      for (const item of order) {
        const { error } = await supabase
          .from('flow_steps')
          .update({ position: item.position })
          .eq('id', item.id)
        if (error) throw error
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QK(vars.flowId) })
    },
    onError: (err) => {
      toast({ title: 'Erro ao reordenar steps', description: String(err), variant: 'destructive' })
    },
  })
}
