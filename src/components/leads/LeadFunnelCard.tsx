/**
 * M16: Card que mostra o funil ativo do lead — nome, tipo, etapa atual no kanban
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FUNNEL_TYPE_CONFIGS } from '@/types/funnels';
import type { FunnelType } from '@/types/funnels';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, ExternalLink } from 'lucide-react';

interface LeadFunnelCardProps {
  contactId: string;
  tags: string[];
}

export function LeadFunnelCard({ contactId, tags }: LeadFunnelCardProps) {
  const navigate = useNavigate();
  const funnelTag = tags.find(t => t.startsWith('funil:'));
  const funnelSlug = funnelTag?.split(':').slice(1).join(':');

  const { data } = useQuery({
    queryKey: ['lead-funnel', contactId, funnelSlug],
    enabled: !!funnelSlug,
    queryFn: async () => {
      if (!funnelSlug) return null;

      // Load funnel
      const { data: funnel } = await supabase
        .from('funnels')
        .select('id, name, type, icon, kanban_board_id')
        .eq('slug', funnelSlug)
        .maybeSingle();

      if (!funnel) return null;

      // Load kanban position if board exists
      let kanbanColumn: string | null = null;
      let kanbanDays: number | null = null;

      if (funnel.kanban_board_id) {
        const { data: card } = await supabase
          .from('kanban_cards')
          .select('updated_at, kanban_columns(name)')
          .eq('board_id', funnel.kanban_board_id)
          .eq('contact_id', contactId)
          .maybeSingle();

        if (card) {
          kanbanColumn = (card as { kanban_columns: { name: string } | null }).kanban_columns?.name || null;
          if (card.updated_at) {
            const days = Math.floor((Date.now() - new Date(card.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            kanbanDays = days;
          }
        }
      }

      return { funnel, kanbanColumn, kanbanDays };
    },
    staleTime: 30_000,
  });

  if (!funnelSlug || !data?.funnel) return null;

  const config = FUNNEL_TYPE_CONFIGS[data.funnel.type as FunnelType];

  return (
    <Card className="border-orange-500/20 bg-orange-500/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <span className="text-xl">{data.funnel.icon || config?.icon || '🎯'}</span>
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-orange-500" />
                {data.funnel.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-600 border-orange-500/20">
                  {config?.label || data.funnel.type}
                </Badge>
                {data.kanbanColumn && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    Etapa: {data.kanbanColumn}
                    {data.kanbanDays !== null && data.kanbanDays > 0 && (
                      <span className="ml-1 text-muted-foreground">({data.kanbanDays}d)</span>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate(`/dashboard/funnels/${data.funnel.id}`)}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Ver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
