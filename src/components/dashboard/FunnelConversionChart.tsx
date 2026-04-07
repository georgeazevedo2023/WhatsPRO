/**
 * M16 Polish: Grafico horizontal de funil de conversao
 * Mostra: Visitas → Capturas → Leads → Conversoes agregado de todos os funis ativos
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

export default function FunnelConversionChart() {
  const { data: stages, isLoading } = useQuery({
    queryKey: ['funnel-conversion-chart'],
    queryFn: async (): Promise<FunnelStage[]> => {
      // Get active funnels with their linked resources
      const { data: funnels } = await supabase
        .from('funnels')
        .select('campaign_id, bio_page_id, form_id, slug')
        .eq('status', 'active');

      if (!funnels || funnels.length === 0) return [];

      let totalVisits = 0;
      let totalCaptures = 0;
      let totalLeads = 0;
      let totalConversions = 0;

      // Aggregate campaign visits
      const campaignIds = funnels.map(f => f.campaign_id).filter(Boolean) as string[];
      if (campaignIds.length > 0) {
        const { data: visits } = await supabase
          .from('utm_visits')
          .select('status')
          .in('campaign_id', campaignIds);
        totalVisits += visits?.length || 0;
        totalConversions += (visits || []).filter(v => v.status === 'matched').length;
      }

      // Aggregate bio views
      const bioIds = funnels.map(f => f.bio_page_id).filter(Boolean) as string[];
      if (bioIds.length > 0) {
        const { data: pages } = await supabase
          .from('bio_pages')
          .select('view_count')
          .in('id', bioIds);
        totalVisits += (pages || []).reduce((s, p) => s + (p.view_count || 0), 0);

        const { count: bioLeads } = await supabase
          .from('bio_lead_captures')
          .select('*', { count: 'exact', head: true })
          .in('bio_page_id', bioIds);
        totalCaptures += bioLeads || 0;
      }

      // Aggregate form submissions
      const formIds = funnels.map(f => f.form_id).filter(Boolean) as string[];
      if (formIds.length > 0) {
        const { count: formSubs } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .in('form_id', formIds);
        totalCaptures += formSubs || 0;
      }

      // Count unique leads via funil: tags
      const slugs = funnels.map(f => f.slug);
      for (const slug of slugs) {
        const { data: convs } = await supabase
          .from('conversations')
          .select('contact_id')
          .contains('tags', [`funil:${slug}`])
          .not('contact_id', 'is', null);
        const unique = new Set((convs || []).map(c => c.contact_id));
        totalLeads += unique.size;
      }

      return [
        { label: 'Visitas', value: totalVisits, color: '#3b82f6' },
        { label: 'Capturas', value: totalCaptures, color: '#8b5cf6' },
        { label: 'Leads', value: totalLeads, color: '#10b981' },
        { label: 'Conversoes', value: totalConversions, color: '#f59e0b' },
      ];
    },
    staleTime: 60_000,
  });

  if (isLoading || !stages || stages.every(s => s.value === 0)) return null;

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Funil de Conversao (todos os funis ativos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage) => {
            const pct = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
            return (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{stage.label}</span>
                  <span className="font-medium">{stage.value.toLocaleString('pt-BR')}</span>
                </div>
                <div className="h-6 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-500 flex items-center pl-2"
                    style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: stage.color }}
                  >
                    {pct > 15 && (
                      <span className="text-white text-[10px] font-medium">
                        {maxValue > 0 ? Math.round((stage.value / stages[0].value) * 100) : 0}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
