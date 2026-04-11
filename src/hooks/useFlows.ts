import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { Flow, FlowInsert, FlowUpdate, FlowWithCounts } from '@/types/flows'

// ── List flows with counts ──────────────────────────────────────────────────

export function useFlowsList(instanceId?: string) {
  return useQuery({
    queryKey: ['flows', instanceId],
    queryFn: async (): Promise<FlowWithCounts[]> => {
      let query = supabase
        .from('flows')
        .select('*, flow_triggers(id), flow_steps(id)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (instanceId) {
        query = query.eq('instance_id', instanceId)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data) return []

      return data.map((f) => ({
        ...f,
        trigger_count: Array.isArray(f.flow_triggers) ? f.flow_triggers.length : 0,
        step_count: Array.isArray(f.flow_steps) ? f.flow_steps.length : 0,
        flow_triggers: undefined,
        flow_steps: undefined,
      })) as FlowWithCounts[]
    },
  })
}

// ── Get single flow ─────────────────────────────────────────────────────────

export function useFlow(id: string | undefined) {
  return useQuery({
    queryKey: ['flow', id],
    enabled: !!id,
    queryFn: async (): Promise<Flow | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// ── Create flow ─────────────────────────────────────────────────────────────

export function useCreateFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (input: FlowInsert): Promise<Flow> => {
      const { data, error } = await supabase
        .from('flows')
        .insert(input)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Fluxo criado!', description: data.name })
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar fluxo', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Update flow ─────────────────────────────────────────────────────────────

export function useUpdateFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...updates }: FlowUpdate & { id: string }): Promise<Flow> => {
      const { data, error } = await supabase
        .from('flows')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      queryClient.invalidateQueries({ queryKey: ['flow', data.id] })
      toast({ title: 'Fluxo atualizado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Publish flow ────────────────────────────────────────────────────────────

export function usePublishFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string): Promise<Flow> => {
      const { data, error } = await supabase
        .from('flows')
        .update({ published_at: new Date().toISOString(), status: 'active' })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      queryClient.invalidateQueries({ queryKey: ['flow', data.id] })
      toast({ title: 'Fluxo publicado!', description: `"${data.name}" está ativo` })
    },
    onError: (err) => {
      toast({ title: 'Erro ao publicar', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Pause flow ──────────────────────────────────────────────────────────────

export function usePauseFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string): Promise<Flow> => {
      const { data, error } = await supabase
        .from('flows')
        .update({ status: 'paused' })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      queryClient.invalidateQueries({ queryKey: ['flow', data.id] })
      toast({ title: 'Fluxo pausado', description: data.name })
    },
    onError: (err) => {
      toast({ title: 'Erro ao pausar', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Archive flow ────────────────────────────────────────────────────────────

export function useArchiveFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('flows')
        .update({ status: 'archived' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Fluxo arquivado' })
    },
    onError: (err) => {
      toast({ title: 'Erro ao arquivar', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Duplicate flow ──────────────────────────────────────────────────────────

export function useDuplicateFlow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string): Promise<Flow> => {
      const { data: original, error: fetchErr } = await supabase
        .from('flows')
        .select('*')
        .eq('id', id)
        .single()
      if (fetchErr || !original) throw fetchErr ?? new Error('Flow not found')

      const newSlug = `${original.slug}-copy-${Date.now().toString(36)}`
      const { data, error } = await supabase
        .from('flows')
        .insert({
          name: `${original.name} (cópia)`,
          slug: newSlug,
          instance_id: original.instance_id,
          description: original.description,
          mode: original.mode,
          config: original.config,
          status: 'active',       // cópia começa sem publicação
          published_at: null,
        })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast({ title: 'Fluxo duplicado', description: data.name })
    },
    onError: (err) => {
      toast({ title: 'Erro ao duplicar', description: String(err), variant: 'destructive' })
    },
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Gera slug kebab-case a partir de um nome */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}
