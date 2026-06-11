import { memo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, TrendingUp, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TopReasonsChartProps {
  instanceId?: string | null;
  inboxId?: string | null;
  periodDays?: number;
}

// Taxonomia fixa — espelha SUMMARY_CATEGORIES de supabase/functions/_shared/summaryPrompt.ts.
// Regra de negócio: pedido de info/preço sobre produto = interesse de compra.
const CATEGORY_LABELS: Record<string, string> = {
  interesse_compra: 'Interesse de compra',
  duvida_tecnica: 'Dúvida técnica',
  troca_devolucao: 'Troca / Devolução',
  status_entrega: 'Status de entrega',
  reclamacao: 'Reclamação',
  vaga_emprego: 'Vaga de emprego',
  fornecedor: 'Fornecedor',
  outro: 'Outro',
};

interface CategoryRow {
  category: string;
  label: string;
  count: number;
  /** Subinteresses: motivos específicos dentro da categoria, ex. "telha de PVC (3x)" */
  reasons: string[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(262 80% 55%)',
  'hsl(38 92% 50%)',
  'hsl(0 72% 51%)',
  'hsl(186 64% 42%)',
  'hsl(330 70% 50%)',
  'hsl(160 60% 40%)',
];

function normalizeReason(reason: string): string {
  return reason.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
}

const TopContactReasons = ({ instanceId, inboxId, periodDays = 30 }: TopReasonsChartProps) => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const fetchReasons = async () => {
      setLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - periodDays);

        // Filtro de instância server-side (!inner) — filtrar no client depois do
        // limit(500) deixava conversas de outras instâncias consumirem o limite
        let query = supabase
          .from('conversations')
          .select('ai_summary, inbox_id, inboxes!inner(instance_id)')
          .not('ai_summary', 'is', null)
          .gte('created_at', since.toISOString())
          .limit(500);

        if (inboxId) {
          query = query.eq('inbox_id', inboxId);
        }
        if (instanceId) {
          query = query.eq('inboxes.instance_id', instanceId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const catMap = new Map<string, { count: number; reasons: Map<string, number> }>();

        (data || []).forEach((conv) => {
          const summary = conv.ai_summary as { reason?: string; category?: string } | null;
          if (!summary) return;
          const reason = typeof summary.reason === 'string' ? summary.reason : '';
          const rawCat = typeof summary.category === 'string' ? summary.category : '';
          const category = CATEGORY_LABELS[rawCat] ? rawCat : 'outro';
          if (!reason && !CATEGORY_LABELS[rawCat]) return; // resumo legado sem nada útil

          if (!catMap.has(category)) {
            catMap.set(category, { count: 0, reasons: new Map() });
          }
          const entry = catMap.get(category)!;
          entry.count++;
          if (reason) {
            const norm = normalizeReason(reason);
            entry.reasons.set(norm, (entry.reasons.get(norm) || 0) + 1);
          }
        });

        const rows: CategoryRow[] = Array.from(catMap.entries())
          .map(([category, val]) => ({
            category,
            label: CATEGORY_LABELS[category],
            count: val.count,
            reasons: Array.from(val.reasons.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([r, c]) => (c > 1 ? `${r} (${c}x)` : r)),
          }))
          .sort((a, b) => b.count - a.count);

        setCategories(rows);
      } catch (err) {
        console.error('Error fetching contact reasons:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReasons();
  }, [instanceId, inboxId, periodDays]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-[240px] rounded-xl" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum motivo de contato identificado</p>
          <p className="text-xs mt-1">Conversas precisam de resumo IA para gerar motivos</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = categories[0]?.count || 1;

  return (
    <Card className="glass-card-hover">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Principais Motivos de Contato
            <Badge variant="secondary" className="text-[9px] gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Classificado por IA
            </Badge>
          </CardTitle>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Últimos {periodDays} dias · Baseado em resumos IA · Passe o mouse para ver os itens
        </p>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-2.5">
        <TooltipProvider>
          {categories.map((item, idx) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs truncate max-w-[75%] cursor-default">
                      {item.label}
                    </span>
                  </TooltipTrigger>
                  {item.reasons.length > 0 && (
                    <TooltipContent side="right" className="max-w-[280px]">
                      <p className="text-[10px] font-medium mb-1">Itens nesta categoria:</p>
                      <ul className="text-[10px] space-y-0.5">
                        {item.reasons.map((r, i) => (
                          <li key={i} className="capitalize">• {r}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
                <Badge variant="outline" className="text-[10px] shrink-0">{item.count}x</Badge>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((item.count / maxCount) * 100, 100)}%`,
                    backgroundColor: COLORS[idx % COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default memo(TopContactReasons);
