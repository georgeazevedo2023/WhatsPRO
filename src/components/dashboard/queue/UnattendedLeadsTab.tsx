/**
 * Aba "Sem atendimento" do Dashboard de Fila (v7.63.0, 2026-05-31).
 *
 * Lista leads que a IA transbordou (status_ia='shadow') e o atendente atribuído
 * ainda NÃO respondeu — o buraco operacional que o gestor precisa enxergar.
 * Ações por lead: 👁 Ver (modal read-only) e ↪ Reatribuir (RPC role-gated).
 *
 * Os dados (leads/loading/janela) são gerenciados pelo pai (QueueDashboard) para
 * manter o badge de contagem da aba em sincronia.
 */
import { useState } from 'react';
import {
  useReassignConversation,
  formatWaiting,
  type UnattendedWindow,
  type UnattendedLead,
  type AttendantStat,
} from '@/hooks/useQueueDashboard';
import { ConversationModal } from '@/components/leads/ConversationModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Eye, ArrowRightLeft, Clock, UserCheck, CheckCircle2, Loader2, Pause } from 'lucide-react';
import { toast } from 'sonner';

const WINDOWS: { value: UnattendedWindow; label: string }[] = [
  { value: 24, label: '24h' },
  { value: 72, label: '3 dias' },
  { value: 168, label: '7 dias' },
  { value: 0, label: 'Tudo' },
];

function initials(name: string | null): string {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function ReassignDrawer({
  lead,
  attendants,
  open,
  onClose,
}: {
  lead: UnattendedLead | null;
  attendants: AttendantStat[];
  open: boolean;
  onClose: () => void;
}) {
  const reassign = useReassignConversation();
  const candidates = attendants.filter((a) => a.user_id !== lead?.assigned_to);

  const handlePick = (a: AttendantStat) => {
    if (!lead) return;
    reassign.mutate(
      { conversationId: lead.conversation_id, assigneeId: a.user_id },
      {
        onSuccess: ({ assigneeName }) => {
          toast.success(`Reatribuído a ${assigneeName}`);
          onClose();
        },
        onError: (e) => toast.error(`Não consegui reatribuir: ${(e as Error).message}`),
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Reatribuir atendimento</DrawerTitle>
          <DrawerDescription>
            {lead?.contact_name}
            {lead?.assignee_name ? ` · hoje com ${lead.assignee_name}` : ''}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {candidates.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem outros atendentes na fila desta instância.
            </p>
          )}
          <ul className="space-y-2">
            {candidates.map((a) => (
              <li key={a.user_id}>
                <button
                  type="button"
                  disabled={reassign.isPending}
                  onClick={() => handlePick(a)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {a.avatar_url ? <AvatarImage src={a.avatar_url} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary">{initials(a.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.full_name}</span>
                  {a.queue_paused ? (
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-700">
                      <Pause className="mr-1 h-3 w-3" />Pausado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-emerald-500 text-emerald-700">
                      <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />Disponível
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {reassign.isPending && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reatribuindo…
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function UnattendedLeadsTab({
  leads,
  isLoading,
  win,
  onWinChange,
  attendants,
}: {
  leads: UnattendedLead[];
  isLoading: boolean;
  win: UnattendedWindow;
  onWinChange: (w: UnattendedWindow) => void;
  attendants: AttendantStat[];
}) {
  const [preview, setPreview] = useState<{ id: string; name: string; inboxId: string } | null>(null);
  const [reassignLead, setReassignLead] = useState<UnattendedLead | null>(null);

  return (
    <div className="space-y-3">
      {/* Seletor de recência */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-muted-foreground">Transbordados nas últimas</span>
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => onWinChange(w.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              win === w.value
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

      {!isLoading && leads.length === 0 && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500/60" />
          <p className="text-sm text-muted-foreground">Nenhum lead esperando atendimento 🎉</p>
        </Card>
      )}

      {!isLoading && leads.length > 0 && (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.conversation_id}>
              <Card className="overflow-hidden p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    {lead.contact_avatar_url ? <AvatarImage src={lead.contact_avatar_url} /> : null}
                    <AvatarFallback className="bg-muted">{initials(lead.contact_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <strong className="truncate text-sm">{lead.contact_name}</strong>
                      {lead.contact_phone && (
                        <span className="text-xs text-muted-foreground">{lead.contact_phone}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <Clock className="h-3.5 w-3.5" /> esperando há {formatWaiting(lead.seconds_waiting)}
                      </span>
                      {lead.assignee_name && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <UserCheck className="h-3.5 w-3.5" /> {lead.assignee_name}
                        </span>
                      )}
                      {lead.queue_event_active && (
                        <Badge variant="outline" className="border-orange-400 text-orange-600">na fila</Badge>
                      )}
                    </div>
                    {lead.last_message && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{lead.last_message}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        onClick={() => setPreview({ id: lead.conversation_id, name: lead.contact_name, inboxId: lead.inbox_id })}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 flex-1"
                        onClick={() => setReassignLead(lead)}
                      >
                        <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Reatribuir
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConversationModal
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
        conversationId={preview?.id ?? null}
        contactName={preview?.name ?? ''}
        inboxId={preview?.inboxId ?? null}
      />

      <ReassignDrawer
        lead={reassignLead}
        attendants={attendants}
        open={!!reassignLead}
        onClose={() => setReassignLead(null)}
      />
    </div>
  );
}
