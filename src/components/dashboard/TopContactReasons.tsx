import { memo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, TrendingUp, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TopReasonsChartProps {
  instanceId?: string | null;
  inboxId?: string | null;
  periodDays?: number;
}

interface ReasonItem {
  reason: string;
  count: number;
}

interface GroupedReason {
  category: string;
  count: number;
  original_reasons?: string[];
}

interface InboxReasons {
  inboxId: string;
  inboxName: string;
  reasons: ReasonItem[];
  grouped?: GroupedReason[];
  total: number;
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

async function groupReasonsWithAI(reasons: ReasonItem[]): Promise<GroupedReason[]> {
  try {
    const { data, error } = await supabase.functions.invoke('group-reasons', {
      body: { reasons },
    });
    if (error) throw error;
    return data?.grouped || reasons.map(r => ({ category: r.reason, count: r.count }));
  } catch (err) {
    console.error('Error grouping reasons with AI:', err);
    return reasons.map(r => ({ category: r.reason, count: r.count }));
  }
}

const TopContactReasons = ({ instanceId, inboxId, periodDays = 30 }: TopReasonsChartProps) => {
  const [loading, setLoading] = useState(true);
  const [grouping, setGrouping] = useState(false);
  const [inboxReasons, setInboxReasons] = useState<InboxReasons[]>([]);
  const [globalGrouped, setGlobalGrouped] = useState<GroupedReason[] | null>(null);
  const [useAIGrouping, setUseAIGrouping] = useState(true);

  useEffect(() => {
    const fetchReasons = async () => {
      setLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - periodDays);

        let query = supabase
          .from('conversations')
          .select('ai_summary, inbox_id, inboxes(name, instance_id)')
          .not('ai_summary', 'is', null)
          .gte('created_at', since.toISOString())
          .limit(500);

        if (inboxId) {
          query = query.eq('inbox_id', inboxId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
          setInboxReasons([]);
          setLoading(false);
          return;
        }

        let filtered = data;
        if (instanceId) {
          filtered = data.filter((c) => c.inboxes?.instance_id === instanceId);
        }

        // Group reasons by inbox
        const inboxMap = new Map<string, { name: string; reasons: Map<string, number>; total: number }>();

        filtered.forEach((conv) => {
          const summary = conv.ai_summary as { reason?: string } | null;
          const reason = summary?.reason;
          if (!reason || typeof reason !== 'string') return;

          const ibId = conv.inbox_id;
          const ibName = conv.inboxes?.name || 'Sem caixa';

          if (!inboxMap.has(ibId)) {
            inboxMap.set(ibId, { name: ibName, reasons: new Map(), total: 0 });
          }

          const entry = inboxMap.get(ibId)!;
          const normalized = normalizeReason(reason);
          entry.reasons.set(normalized, (entry.reasons.get(normalized) || 0) + 1);
          entry.total++;
        });

        const result: InboxReasons[] = Array.from(inboxMap.entries())
          .map(([id, val]) => ({
            inboxId: id,
            inboxName: val.name,
            total: val.total,
            reasons: Array.from(val.reasons.entries())
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10),
          }))
          .sort((a, b) => b.total - a.total);

        setInboxReasons(result);
        setGlobalGrouped(null);

        // AI grouping (cross-inbox)
        if (useAIGrouping) {
          setGrouping(true);
          const allReasons = result.flatMap(ir => ir.reasons);
          const merged = new Map<string, number>();
          allReasons.forEach(r => merged.set(r.reason, (merged.get(r.reason) || 0) + r.count));
          const mergedArr = Array.from(merged.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);

          if (mergedArr.length > 3) {
            const grouped = await groupReasonsWithAI(mergedArr);
            setGlobalGrouped(grouped);
          }
          setGrouping(false);
        }
      } catch (err) {
        console.error('Error fetching contact reasons:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReasons();
  }, [instanceId, inboxId, periodDays, useAIGrouping]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-[240px] rounded-xl" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
    );
  }

  if (inboxReasons.length === 0) {
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

  // Use AI-grouped data if available
  const grouped = globalGrouped;
  const displayData: { label: string; count: number; details?: string[] }[] = grouped
    ? grouped.map(g => ({
        label: g.category,
        count: g.count,
        details: g.original_reasons,
      }))
    : inboxReasons
        .flatMap(ir => ir.reasons)
        .reduce((acc, r) => {
          const existing = acc.find(a => a.label === r.reason);
          if (existing) existing.count += r.count;
          else acc.push({ label: r.reason, count: r.count });
          return acc;
        }, [] as { label: string; count: number; details?: string[] }[])
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

  const maxCount = displayData[0]?.count || 1;

  return (
    <Card className="glass-card-hover">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Principais Motivos de Contato
            {grouped && (
              <Badge variant="secondary" className="text-[9px] gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Agrupado por IA
              </Badge>
            )}
          </CardTitle>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Últimos {periodDays} dias · Baseado em resumos IA
          {grouping && ' · Agrupando...'}
        </p>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-2.5">
        <TooltipProvider>
          {displayData.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs truncate max-w-[75%] capitalize cursor-default">
                      {item.label}
                    </span>
                  </TooltipTrigger>
                  {item.details && item.details.length > 0 && (
                    <TooltipContent side="right" className="max-w-[280px]">
                      <p className="text-[10px] font-medium mb-1">Motivos agrupados:</p>
                      <ul className="text-[10px] space-y-0.5">
                        {item.details.slice(0, 5).map((d, i) => (
                          <li key={i} className="capitalize">• {d}</li>
                        ))}
                        {item.details.length > 5 && (
                          <li className="text-muted-foreground">+ {item.details.length - 5} mais</li>
                        )}
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
