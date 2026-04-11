import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { FlowTrigger, FlowTriggerInsert, FlowTriggerUpdate } from '@/types/flows'

// ── List triggers for a flow ────────────────────────────────────────────────

export function useFlowTriggers(flowId: string | undefined) {
  return useQuery({
    queryKey: ['flow-triggers', flowId],
    enabled: !!flowId,
    queryFn: async (): Promise<FlowTrigger[]> => {
      if (!flowId) return []
      const { data, error } = await supabase
        .from('flow_triggers')
        .select('*')
        .eq('flow_id', flowId)
        .order('priority', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

// ── Create trigger ──────────────────────────────────────────────────────────

export function useCreateFlowTrigger() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (input: FlowTriggerInsert): Promise<FlowTrigger> => {
      const { data, error } = await supabase
        .from('flow_triggers')
        .insert(input)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flow-triggers', data.flow_id] })
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Gatilho adicionado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar gatilho', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Update trigger ──────────────────────────────────────────────────────────

export function useUpdateFlowTrigger() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...updates }: FlowTriggerUpdate & { id: string }): Promise<FlowTrigger> => {
      const { data, error } = await supabase
        .from('flow_triggers')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flow-triggers', data.flow_id] })
      toast({ title: 'Gatilho atualizado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar gatilho', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Delete trigger ──────────────────────────────────────────────────────────

export function useDeleteFlowTrigger() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, flowId }: { id: string; flowId: string }): Promise<void> => {
      const { error } = await supabase
        .from('flow_triggers')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { flowId }) => {
      queryClient.invalidateQueries({ queryKey: ['flow-triggers', flowId] })
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Gatilho removido' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao remover gatilho', description: String(err), variant: 'destructive' })
    },
  })
}
