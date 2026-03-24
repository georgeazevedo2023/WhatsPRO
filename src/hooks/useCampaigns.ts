import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UtmCampaign, UtmCampaignWithMetrics } from '@/types';
import { useToast } from '@/hooks/use-toast';

// ── List campaigns with metrics ─────────────────────────────────────
export function useCampaignsList() {
  return useQuery({
    queryKey: ['utm-campaigns'],
    queryFn: async (): Promise<UtmCampaignWithMetrics[]> => {
      // Fetch campaigns
      const { data: campaigns, error } = await (supabase as any)
        .from('utm_campaigns')
        .select('*, instances(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch visit counts per campaign
      const campaignIds = (campaigns || []).map((c: any) => c.id);
      if (campaignIds.length === 0) return [];

      const { data: visits } = await (supabase as any)
        .from('utm_visits')
        .select('campaign_id, status')
        .in('campaign_id', campaignIds);

      // Aggregate metrics
      const metricsMap = new Map<string, { total: number; matched: number }>();
      for (const v of visits || []) {
        const m = metricsMap.get(v.campaign_id) || { total: 0, matched: 0 };
        m.total++;
        if (v.status === 'matched') m.matched++;
        metricsMap.set(v.campaign_id, m);
      }

      return (campaigns || []).map((c: any) => {
        const m = metricsMap.get(c.id) || { total: 0, matched: 0 };
        return {
          ...c,
          instance_name: c.instances?.name,
          total_visits: m.total,
          total_conversions: m.matched,
          conversion_rate: m.total > 0 ? Math.round((m.matched / m.total) * 100) : 0,
        };
      });
    },
  });
}

// ── Get single campaign ─────────────────────────────────────────────
export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['utm-campaign', id],
    enabled: !!id,
    queryFn: async (): Promise<UtmCampaign | null> => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('utm_campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ── Campaign visits ─────────────────────────────────────────────────
export function useCampaignVisits(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['utm-visits', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await (supabase as any)
        .from('utm_visits')
        .select('*, contacts(name, phone, profile_pic_url)')
        .eq('campaign_id', campaignId)
        .order('visited_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Campaign metrics (aggregated) ───────────────────────────────────
export function useCampaignMetrics(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['utm-campaign-metrics', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return null;
      const { data: visits, error } = await (supabase as any)
        .from('utm_visits')
        .select('status, visited_at, matched_at')
        .eq('campaign_id', campaignId);
      if (error) throw error;

      const all = visits || [];
      const total = all.length;
      const matched = all.filter((v: any) => v.status === 'matched').length;
      const expired = all.filter((v: any) => v.status === 'expired').length;

      // Visits per day (last 30 days)
      const dailyMap = new Map<string, { visits: number; conversions: number }>();
      for (const v of all) {
        const day = v.visited_at?.substring(0, 10);
        if (!day) continue;
        const d = dailyMap.get(day) || { visits: 0, conversions: 0 };
        d.visits++;
        if (v.status === 'matched') d.conversions++;
        dailyMap.set(day, d);
      }
      const daily = Array.from(dailyMap.entries())
        .map(([date, d]) => ({ date, ...d }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        total_visits: total,
        total_conversions: matched,
        total_expired: expired,
        conversion_rate: total > 0 ? Math.round((matched / total) * 100) : 0,
        daily,
      };
    },
  });
}

// ── Create campaign ─────────────────────────────────────────────────
export function useCreateCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaign: Omit<UtmCampaign, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from('utm_campaigns')
        .insert(campaign)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utm-campaigns'] });
      toast({ title: 'Campanha criada com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar campanha', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Update campaign ─────────────────────────────────────────────────
export function useUpdateCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UtmCampaign> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('utm_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['utm-campaigns'] });
      qc.invalidateQueries({ queryKey: ['utm-campaign', vars.id] });
      toast({ title: 'Campanha atualizada' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Delete campaign ─────────────────────────────────────────────────
export function useDeleteCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('utm_campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utm-campaigns'] });
      toast({ title: 'Campanha excluida' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

export function buildTrackingUrl(slug: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://euljumeflwtljegknawy.supabase.co';
  return `${supabaseUrl}/functions/v1/go?c=${slug}`;
}
