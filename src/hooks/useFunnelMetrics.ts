/**
 * M16: Hook de metricas agregadas do funil
 * Combina dados de utm_visits, bio_lead_captures, form_submissions e conversations
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Funnel } from '@/types/funnels';

export interface FunnelMetrics {
  // Campaign metrics
  campaignVisits: number;
  campaignConversions: number;
  campaignConversionRate: number;
  // Bio metrics
  bioViews: number;
  bioClicks: number;
  bioLeads: number;
  bioCTR: number;
  // Form metrics
  formSubmissions: number;
  formSubmissionsToday: number;
  // Funnel aggregate
  totalLeads: number;
  totalConversations: number;
  // Kanban distribution
  kanbanStages: { column: string; count: number; color: string }[];
}

export function useFunnelMetrics(funnel: Funnel | null | undefined) {
  return useQuery({
    queryKey: ['funnel-metrics', funnel?.id],
    enabled: !!funnel,
    queryFn: async (): Promise<FunnelMetrics> => {
      if (!funnel) throw new Error('No funnel');

      const metrics: FunnelMetrics = {
        campaignVisits: 0,
        campaignConversions: 0,
        campaignConversionRate: 0,
        bioViews: 0,
        bioClicks: 0,
        bioLeads: 0,
        bioCTR: 0,
        formSubmissions: 0,
        formSubmissionsToday: 0,
        totalLeads: 0,
        totalConversations: 0,
        kanbanStages: [],
      };

      // Parallel queries
      const promises: Promise<void>[] = [];

      // 1. Campaign metrics
      if (funnel.campaign_id) {
        promises.push((async () => {
          const { data: visits } = await supabase
            .from('utm_visits')
            .select('status')
            .eq('campaign_id', funnel.campaign_id!);

          const total = visits?.length || 0;
          const matched = (visits || []).filter(v => v.status === 'matched').length;
          metrics.campaignVisits = total;
          metrics.campaignConversions = matched;
          metrics.campaignConversionRate = total > 0 ? Math.round((matched / total) * 100) : 0;
        })());
      }

      // 2. Bio metrics
      if (funnel.bio_page_id) {
        promises.push((async () => {
          const { data: page } = await supabase
            .from('bio_pages')
            .select('view_count')
            .eq('id', funnel.bio_page_id!)
            .maybeSingle();
          metrics.bioViews = page?.view_count || 0;

          const { data: buttons } = await supabase
            .from('bio_buttons')
            .select('click_count')
            .eq('bio_page_id', funnel.bio_page_id!);
          metrics.bioClicks = (buttons || []).reduce((sum, b) => sum + (b.click_count || 0), 0);

          const { count } = await supabase
            .from('bio_lead_captures')
            .select('*', { count: 'exact', head: true })
            .eq('bio_page_id', funnel.bio_page_id!);
          metrics.bioLeads = count || 0;

          metrics.bioCTR = metrics.bioViews > 0
            ? Math.round((metrics.bioClicks / metrics.bioViews) * 100)
            : 0;
        })());
      }

      // 3. Form metrics
      if (funnel.form_id) {
        promises.push((async () => {
          const { count: total } = await supabase
            .from('form_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('form_id', funnel.form_id!);
          metrics.formSubmissions = total || 0;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count: todayCount } = await supabase
            .from('form_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('form_id', funnel.form_id!)
            .gte('submitted_at', today.toISOString());
          metrics.formSubmissionsToday = todayCount || 0;
        })());
      }

      // 4. Funnel conversations (via tag funil:SLUG)
      promises.push((async () => {
        const tag = `funil:${funnel.slug}`;
        const { data: convs } = await supabase
          .from('conversations')
          .select('contact_id')
          .contains('tags', [tag])
          .not('contact_id', 'is', null);

        const uniqueContacts = new Set((convs || []).map(c => c.contact_id));
        metrics.totalLeads = uniqueContacts.size;
        metrics.totalConversations = convs?.length || 0;
      })());

      // 5. Kanban distribution
      if (funnel.kanban_board_id) {
        promises.push((async () => {
          const { data: columns } = await supabase
            .from('kanban_columns')
            .select('id, name, color')
            .eq('board_id', funnel.kanban_board_id!)
            .order('position');

          if (columns && columns.length > 0) {
            const { data: cards } = await supabase
              .from('kanban_cards')
              .select('column_id')
              .eq('board_id', funnel.kanban_board_id!);

            const countMap = new Map<string, number>();
            for (const card of cards || []) {
              countMap.set(card.column_id, (countMap.get(card.column_id) || 0) + 1);
            }

            metrics.kanbanStages = columns.map(col => ({
              column: col.name,
              count: countMap.get(col.id) || 0,
              color: col.color,
            }));
          }
        })());
      }

      await Promise.all(promises);
      return metrics;
    },
    staleTime: 30_000, // 30s cache
  });
}
