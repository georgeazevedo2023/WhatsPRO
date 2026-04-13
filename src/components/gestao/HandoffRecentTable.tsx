// M19 S4-P4: Tabela dos últimos 20 handoffs
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRightLeft } from 'lucide-react';
import type { HandoffRow } from '@/hooks/useHandoffMetrics';

interface Props {
  rows: HandoffRow[];
}

function formatDateBR(isoString: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function truncate(text: string, max = 30): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export default function HandoffRecentTable({ rows }: Props) {
  // Resolve seller IDs para nomes via user_profiles
  const sellerIds = [...new Set(rows.map((r) => r.sellerId).filter(Boolean) as string[])];

  const { data: profiles } = useQuery({
    queryKey: ['handoff-seller-profiles', sellerIds],
    enabled: sellerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', sellerIds);
      return (data || []) as { id: string; full_name: string }[];
    },
    staleTime: 300_000,
  });

  const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name]));

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Handoffs Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">
            Nenhum transbordo no período
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          Handoffs Recentes
          <span className="text-muted-foreground font-normal text-xs">
            (últimos {rows.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">Data/Hora</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Motivo</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Trigger</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">Evitável</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Converteu</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">Tempo antes</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sellerName = row.sellerId
                    ? (nameMap[row.sellerId] ?? row.sellerId.slice(0, 8))
                    : '—';
                  const reasonFull = row.reason ?? '—';
                  const reasonTrunc = truncate(reasonFull, 30);
                  const needsTooltip = reasonFull.length > 30;

                  return (
                    <tr key={row.conversationId} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateBR(row.handoffAt)}
                      </td>
                      <td className="px-4 py-2 max-w-[180px]">
                        {needsTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate block">{reasonTrunc}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="max-w-xs text-xs">{reasonFull}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>{reasonTrunc}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {row.trigger ?? '—'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.evitavel ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] px-1.5 py-0">
                            Evitável
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0">
                            Necessário
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.converteu ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0">
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">
                            Não
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {formatMinutes(row.minutesBeforeHandoff)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {sellerName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
