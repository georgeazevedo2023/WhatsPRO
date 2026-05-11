// Dashboard do Gestor F2: conversas sem resposta há > N horas
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlarmClock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AbandonedConversation } from '@/hooks/useManagerAdvancedMetrics';

interface Props {
  data: AbandonedConversation[] | undefined;
  isLoading?: boolean;
  thresholdHours: number;
  topN?: number;
}

function fmtWait(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function severityTone(hours: number): string {
  if (hours < 48) return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  if (hours < 168) return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
  return 'bg-red-500/10 text-red-500 border-red-500/30';
}

export default function AbandonedConversationsList({
  data,
  isLoading,
  thresholdHours,
  topN = 8,
}: Props) {
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const items = (data ?? []).slice(0, topN);
  const total = data?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-amber-500" />
            Conversas sem resposta há +{thresholdHours}h
          </CardTitle>
          {total > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
              {total} {total === 1 ? 'pendente' : 'pendentes'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-green-600 text-center py-6">
            Nenhuma conversa em aberto há mais de {thresholdHours}h. Equipe em dia.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.conversationId}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate">
                    {item.contactName || item.contactPhone || '(sem nome)'}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {item.contactPhone || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${severityTone(item.hoursWaiting)}`}>
                    {fmtWait(item.hoursWaiting)}
                  </Badge>
                  <Link
                    to={`/dashboard/helpdesk?conversation=${item.conversationId}`}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Abrir conversa"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </li>
            ))}
            {total > items.length && (
              <li className="text-[10px] text-muted-foreground text-center pt-1">
                + {total - items.length} mais
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
