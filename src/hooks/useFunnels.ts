import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Funnel, FunnelWithMetrics, CreateFunnelInput } from '@/types/funnels';
import { useToast } from '@/hooks/use-toast';

// ── List funnels with metrics ───────────────────────────────────────
export function useFunnelsList(instanceId?: string) {
  return useQuery({
    queryKey: ['funnels', instanceId],
    queryFn: async (): Promise<FunnelWithMetrics[]> => {
      let query = supabase
        .from('funnels')
        .select('*, utm_campaigns(name), bio_pages(title), whatsapp_forms(name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }

      const { data: funnels, error } = await query;
      if (error) throw error;
      if (!funnels || funnels.length === 0) return [];

      // Count leads per funnel via funnel tag on conversations
      const slugs = funnels.map(f => f.slug);
      const leadCounts = new Map<string, number>();

      for (const slug of slugs) {
        const { count } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .contains('tags', [`funil:${slug}`]);
        leadCounts.set(slug, count || 0);
      }

      return funnels.map((f) => ({
        ...f,
        lead_count: leadCounts.get(f.slug) || 0,
        conversion_rate: 0, // calculated in detail view
        campaign_name: (f.utm_campaigns as { name: string } | null)?.name,
        bio_page_title: (f.bio_pages as { title: string } | null)?.title,
        form_name: (f.whatsapp_forms as { name: string } | null)?.name,
      }));
    },
  });
}

// ── Get single funnel ───────────────────────────────────────────────
export function useFunnel(id: string | undefined) {
  return useQuery({
    queryKey: ['funnel', id],
    enabled: !!id,
    queryFn: async (): Promise<Funnel | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ── Create funnel ───────────────────────────────────────────────────
export function useCreateFunnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateFunnelInput) => {
      const { data, error } = await supabase
        .from('funnels')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast({ title: 'Funil criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar funil', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Update funnel ───────────────────────────────────────────────────
export function useUpdateFunnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Funnel> & { id: string }) => {
      const { data, error } = await supabase
        .from('funnels')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnel', data.id] });
      toast({ title: 'Funil atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar funil', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Delete funnel ───────────────────────────────────────────────────
export function useDeleteFunnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast({ title: 'Funil excluido' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir funil', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Get funnel stats (leads, visits, conversions) ───────────────────
export function useFunnelStats(funnelSlug: string | undefined) {
  return useQuery({
    queryKey: ['funnel-stats', funnelSlug],
    enabled: !!funnelSlug,
    queryFn: async () => {
      if (!funnelSlug) return { leads: 0, conversations: 0 };

      const tag = `funil:${funnelSlug}`;

      // Count conversations with this funnel tag
      const { count: conversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .contains('tags', [tag]);

      // Count distinct contacts (leads)
      const { data: contactRows } = await supabase
        .from('conversations')
        .select('contact_id')
        .contains('tags', [tag])
        .not('contact_id', 'is', null);

      const uniqueContacts = new Set((contactRows || []).map(r => r.contact_id));

      return {
        leads: uniqueContacts.size,
        conversations: conversations || 0,
      };
    },
  });
}

// ── Global funnel KPIs (for dashboard) ──────────────────────────────
export function useFunnelKPIs() {
  return useQuery({
    queryKey: ['funnel-kpis'],
    queryFn: async () => {
      const { count: activeFunnels } = await supabase
        .from('funnels')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: totalFunnels } = await supabase
        .from('funnels')
        .select('*', { count: 'exact', head: true });

      return {
        activeFunnels: activeFunnels || 0,
        totalFunnels: totalFunnels || 0,
      };
    },
  });
}
