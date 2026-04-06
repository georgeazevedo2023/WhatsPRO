import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type {
  BioPage,
  BioButton,
  BioCatalogProduct,
  CreateBioPageInput,
  CreateBioButtonInput,
} from '@/types/bio'

// ─── URL helper ───────────────────────────────────────────────────────────────

function bioPublicUrl(slug: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL || 'https://euljumeflwtljegknawy.supabase.co'
  return `${base}/functions/v1/bio-public?slug=${encodeURIComponent(slug)}`
}

export function buildBioPageUrl(slug: string): string {
  return `${window.location.origin}/bio/${slug}`
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function useBioPagesList(instanceId: string | null) {
  return useQuery({
    queryKey: ['bio-pages', instanceId],
    queryFn: async (): Promise<BioPage[]> => {
      if (!instanceId) return []
      const { data, error } = await supabase
        .from('bio_pages')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as BioPage[]
    },
    enabled: !!instanceId,
    staleTime: 30_000,
  })
}

// ─── Single page with buttons ─────────────────────────────────────────────────

export function useBioPageWithButtons(pageId: string | null) {
  return useQuery({
    queryKey: ['bio-page', pageId],
    queryFn: async (): Promise<{ page: BioPage; buttons: BioButton[] } | null> => {
      if (!pageId) return null
      const [pageRes, buttonsRes] = await Promise.all([
        supabase.from('bio_pages').select('*').eq('id', pageId).single(),
        supabase
          .from('bio_buttons')
          .select('*')
          .eq('bio_page_id', pageId)
          .order('position', { ascending: true }),
      ])
      if (pageRes.error) throw pageRes.error
      if (buttonsRes.error) throw buttonsRes.error
      return {
        page: pageRes.data as BioPage,
        buttons: (buttonsRes.data ?? []) as BioButton[],
      }
    },
    enabled: !!pageId,
    staleTime: 10_000,
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateBioPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateBioPageInput): Promise<BioPage> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('bio_pages')
        .insert({ ...input, created_by: user.id })
        .select()
        .single()
      if (error) throw error
      return data as BioPage
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages', data.instance_id] })
    },
  })
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateBioPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<BioPage> & { id: string }): Promise<BioPage> => {
      const { data, error } = await supabase
        .from('bio_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BioPage
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages', data.instance_id] })
      queryClient.invalidateQueries({ queryKey: ['bio-page', data.id] })
    },
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteBioPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, instanceId }: { id: string; instanceId: string }) => {
      const { error } = await supabase.from('bio_pages').delete().eq('id', id)
      if (error) throw error
      return { id, instanceId }
    },
    onSuccess: ({ instanceId }) => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages', instanceId] })
    },
  })
}

// ─── Buttons CRUD ─────────────────────────────────────────────────────────────

export function useCreateBioButton() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateBioButtonInput): Promise<BioButton> => {
      const { data, error } = await supabase
        .from('bio_buttons')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as BioButton
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bio-page', data.bio_page_id] })
    },
  })
}

export function useUpdateBioButton() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<BioButton> & { id: string }): Promise<BioButton> => {
      const { data, error } = await supabase
        .from('bio_buttons')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BioButton
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bio-page', data.bio_page_id] })
    },
  })
}

export function useDeleteBioButton() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pageId }: { id: string; pageId: string }) => {
      const { error } = await supabase.from('bio_buttons').delete().eq('id', id)
      if (error) throw error
      return { id, pageId }
    },
    onSuccess: ({ pageId }) => {
      queryClient.invalidateQueries({ queryKey: ['bio-page', pageId] })
    },
  })
}

// Reorder buttons: update positions in batch
export function useReorderBioButtons() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pageId,
      orderedIds,
    }: {
      pageId: string
      orderedIds: string[]
    }) => {
      const updates = orderedIds.map((id, index) => ({ id, position: index }))
      for (const { id, position } of updates) {
        const { error } = await supabase
          .from('bio_buttons')
          .update({ position })
          .eq('id', id)
        if (error) throw error
      }
      return pageId
    },
    onSuccess: (pageId) => {
      queryClient.invalidateQueries({ queryKey: ['bio-page', pageId] })
    },
  })
}

// ─── Catalog products for Bio button editor ───────────────────────────────────

export function useCatalogProductsForBio(instanceId: string | null) {
  return useQuery({
    queryKey: ['bio-catalog-products', instanceId],
    queryFn: async (): Promise<BioCatalogProduct[]> => {
      if (!instanceId) return []
      // Busca o agente ativo da instância
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('enabled', true)
        .limit(1)
      const agentId = agents?.[0]?.id
      if (!agentId) return []
      // Busca produtos do agente
      const { data, error } = await supabase
        .from('ai_agent_products')
        .select('id, title, price, currency, images')
        .eq('agent_id', agentId)
        .eq('enabled', true)
        .order('position', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        price: p.price as number | null,
        currency: p.currency as string | null,
        image_url: ((p.images as string[]) ?? [])[0] ?? null,
      }))
    },
    enabled: !!instanceId,
    staleTime: 60_000,
  })
}

export { bioPublicUrl }
