// Dashboard do Gestor F3: card genérico de lista de conversas pendentes
// Reaproveitado por "sem resposta há +N h", "sem 1ª resposta ao lead",
// "cotações em andamento". Suporta dispensar item (tag dashboard:dispensed).
// Mostra a última mensagem do lead + o atendente atribuído (busca lazy só da
// página visível) e abre a conversa em MODAL ao clicar. Paginação por "Ver mais".
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { X, MessageSquare, User, type LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConversationModal } from '@/components/leads/ConversationModal';
import { usePendingConversationPreviews } from '@/hooks/usePendingConversationPreviews';
import { useUserProfiles } from '@/hooks/useUserProfiles';

export interface PendingItem {
  conversationId: string;
  contactName: string | null;
  contactPhone: string | null;
  hoursWaiting?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  data: PendingItem[] | undefined;
  isLoading?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  hideWaitingBadge?: boolean;
}

function fmtWait(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function severityTone(hours: number): string {
  if (hours < 4) return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  if (hours < 48) return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
  if (hours < 168) return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
  return 'bg-red-500/10 text-red-500 border-red-500/30';
}

export default function PendingConversationsCard({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'text-amber-500',
  data,
  isLoading,
  pageSize = 8,
  emptyMessage = 'Nada pendente. Bom trabalho.',
  hideWaitingBadge = false,
}: Props) {
  const queryClient = useQueryClient();
  const [shown, setShown] = useState(pageSize);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const all = data ?? [];
  const total = all.length;
  const items = all.slice(0, shown);

  // Preview (msg do lead + atendente) só da página visível → load inicial leve.
  const visibleIds = useMemo(() => items.map((i) => i.conversationId), [items]);
  const { data: previews, isFetching: previewsFetching } = usePendingConversationPreviews(visibleIds);

  // Resolve atendente (assigned_to) → nome (RLS-aware, mesmo padrão do Helpdesk).
  const assignedIds = useMemo(() => {
    if (!previews) return [];
    return Array.from(
      new Set(
        Array.from(previews.values())
          .map((p) => p.assignedTo)
          .filter((id): id is string => !!id),
      ),
    );
  }, [previews]);
  const { namesMap } = useUserProfiles({ userIds: assignedIds, enabled: assignedIds.length > 0 });

  async function handleDispense(item: PendingItem) {
    const display = item.contactName || item.contactPhone || 'conversa';
    const { error } = await supabase.rpc('dispense_conversation_from_dashboard', {
      p_conversation_id: item.conversationId,
    });
    if (error) {
      toast.error(`Não consegui dispensar ${display}. Tenta de novo?`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['manager-advanced'] });
    toast.success(`${display} removida da lista`, {
      action: {
        label: 'Desfazer',
        onClick: async () => {
          const { error: undoErr } = await supabase.rpc('restore_conversation_to_dashboard', {
            p_conversation_id: item.conversationId,
          });
          if (undoErr) {
            toast.error('Não consegui desfazer');
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['manager-advanced'] });
          toast.success(`${display} de volta à lista`);
        },
      },
    });
  }

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className={`w-4 h-4 ${iconClassName}`} />
                {title}
              </CardTitle>
              {subtitle && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            {total > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
                {total} {total === 1 ? 'pendente' : 'pendentes'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-xs text-green-600 text-center py-6">{emptyMessage}</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const preview = previews?.get(item.conversationId);
                const name = item.contactName || item.contactPhone || '(sem nome)';
                // Só afirma "Não atribuído" (alerta) quando a preview REALMENTE veio e
                // assigned_to é null. Enquanto carrega/falha → placeholder neutro (não
                // mentir um estado desconhecido como se fosse fato).
                const attendantUnassigned = !!preview && !preview.assignedTo;
                const attendant = !preview
                  ? (previewsFetching ? 'carregando…' : '—')
                  : preview.assignedTo
                    ? (namesMap[preview.assignedTo] || 'Atendente')
                    : 'Não atribuído';
                return (
                  <li
                    key={item.conversationId}
                    className="flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected({ id: item.conversationId, name })}
                      className="flex flex-col min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      title="Abrir conversa"
                    >
                      <span className="text-xs font-medium truncate">{name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.contactPhone || '—'}
                      </span>
                      {/* Mensagem do lead */}
                      <span className="flex items-center gap-1 text-[11px] text-foreground/80 mt-0.5 min-w-0">
                        <MessageSquare className="w-3 h-3 shrink-0 text-muted-foreground" />
                        <span className="truncate italic">
                          {preview?.leadMessage
                            ? preview.leadMessage
                            : previewsFetching ? 'carregando…' : '(sem mensagem)'}
                        </span>
                      </span>
                      {/* Atendente atribuído */}
                      <span className="flex items-center gap-1 text-[10px] mt-0.5">
                        <User className="w-3 h-3 shrink-0 text-muted-foreground" />
                        <span className={attendantUnassigned ? 'text-rose-500/80' : 'text-muted-foreground'}>
                          {attendant}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!hideWaitingBadge && typeof item.hoursWaiting === 'number' && (
                        <Badge variant="outline" className={`text-[10px] ${severityTone(item.hoursWaiting)}`}>
                          {fmtWait(item.hoursWaiting)}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDispense(item)}
                        className="text-muted-foreground/60 hover:text-rose-500 p-1 rounded-md hover:bg-rose-500/10 transition-colors"
                        aria-label="Remover da lista (spam, teste, já resolvida)"
                        title="Remover da lista (spam, teste, já resolvida)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
              {total > shown && (
                <li className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => setShown((s) => Math.min(total, s + pageSize))}
                    className="w-full text-[11px] text-primary hover:text-primary/80 hover:bg-primary/5 rounded-md py-1.5 transition-colors font-medium"
                  >
                    Ver mais ({total - shown} restantes)
                  </button>
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConversationModal
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        conversationId={selected?.id ?? null}
        contactName={selected?.name ?? ''}
      />
    </>
  );
}
