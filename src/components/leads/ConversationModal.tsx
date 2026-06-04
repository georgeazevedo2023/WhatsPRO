import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, User, Headphones, ExternalLink } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';
import { useUserProfiles } from '@/hooks/useUserProfiles';

interface Message {
  id: string;
  direction: string;
  content: string | null;
  media_type: string;
  media_url: string | null;
  transcription: string | null;
  sender_id: string | null;
  external_id: string | null;
  created_at: string;
}

interface ConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  contactName: string;
  /** Opcional: habilita o botão "Abrir no Helpdesk" (deep-link confiável precisa do inbox). */
  inboxId?: string | null;
}

/** Prefixos de external_id usados por mensagens enviadas pela IA/automação.
 *  Mensagens digitadas pelo atendente no celular (takeover) chegam pelo webhook com
 *  external_id = id cru do WhatsApp (hex, sem prefixo) e sem sender_id. */
const AI_EXTERNAL_ID_PREFIX = /^(ai_|abandon_|follow_up_|auto_|nps_|queue_oof_|poll_vote_)/;

/** Outgoing sem sender_id: IA (external_id NULL ou prefixo de automação) vs atendente
 *  que respondeu pelo celular (external_id hex, sem prefixo). */
function isAiSent(externalId: string | null): boolean {
  return !externalId || AI_EXTERNAL_ID_PREFIX.test(externalId);
}

/** Info de exibição por mensagem. Distingue lead, nota, atendente (app, com nome),
 *  atendente pelo celular (takeover, sem nome) e IA. */
function msgInfo(msg: Message) {
  if (msg.direction === 'incoming') {
    return { kind: 'lead' as const, icon: User, color: 'bg-muted', align: 'justify-start', outgoing: false };
  }
  if (msg.direction === 'private_note') {
    return { kind: 'note' as const, icon: Headphones, color: 'bg-yellow-500/10', align: 'justify-start', outgoing: false };
  }
  // outgoing enviado pelo app (Helpdesk): tem sender_id → resolve nome do atendente
  if (msg.sender_id) {
    return { kind: 'agent' as const, icon: Headphones, color: 'bg-emerald-600 text-white', align: 'justify-end', outgoing: true };
  }
  // outgoing sem sender_id: IA ou atendente pelo celular (takeover)
  if (isAiSent(msg.external_id)) {
    return { kind: 'ia' as const, icon: Bot, color: 'bg-primary text-primary-foreground', align: 'justify-end', outgoing: true };
  }
  return { kind: 'agentPhone' as const, icon: Headphones, color: 'bg-emerald-600 text-white', align: 'justify-end', outgoing: true };
}

export function ConversationModal({ open, onOpenChange, conversationId, contactName, inboxId }: ConversationModalProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve sender_id → nome do atendente (mesmo padrão do Helpdesk: useUserProfiles).
  // Inclui o `assigned_to` da conversa: msgs do atendente enviadas pelo CELULAR (takeover)
  // não têm sender_id, então atribuímos ao atendente responsável pela conversa.
  // RLS garante que gestor/admin/co-membro da inbox vê o full_name (senão cai no fallback).
  const senderIds = useMemo(() => {
    const ids = new Set(messages.map((m) => m.sender_id).filter((id): id is string => !!id));
    if (assignedTo) ids.add(assignedTo);
    return Array.from(ids);
  }, [messages, assignedTo]);
  const { namesMap: agentNamesMap } = useUserProfiles({ userIds: senderIds, enabled: senderIds.length > 0 });

  useEffect(() => {
    if (!open || !conversationId) return;
    setLoading(true);
    // Atendente responsável pela conversa — nomeia as msgs enviadas pelo celular (sem sender_id).
    supabase
      .from('conversations')
      .select('assigned_to')
      .eq('id', conversationId)
      .maybeSingle()
      .then(({ data }) => setAssignedTo((data?.assigned_to as string | null) ?? null));
    supabase
      .from('conversation_messages')
      .select('id, direction, content, media_type, media_url, transcription, sender_id, external_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) handleError(error, 'Erro ao carregar mensagens', 'ConversationModal');
        setMessages((data || []) as Message[]);
        setLoading(false);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      });
  }, [open, conversationId]);

  const openInHelpdesk = () => {
    if (!conversationId) return;
    const qs = inboxId ? `inbox=${inboxId}&conv=${conversationId}` : `conv=${conversationId}`;
    navigate(`/dashboard/helpdesk?${qs}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="text-base">Conversa com {contactName}</DialogTitle>
          <Button variant="outline" size="sm" className="mr-8 h-8 shrink-0" onClick={openInHelpdesk}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir no Helpdesk
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Nenhuma mensagem encontrada
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((msg) => {
                const info = msgInfo(msg);
                const Icon = info.icon;
                const text = msg.content || msg.transcription || (msg.media_type !== 'text' ? `[${msg.media_type}]` : '');
                // Quem enviou: nome do lead (incoming), nome real do atendente (app via sender_id),
                // nome do atendente atribuído (takeover pelo celular, sem sender_id) ou "IA".
                const agentPhoneName = (assignedTo && agentNamesMap[assignedTo]) || 'Atendente';
                const senderLabel =
                  info.kind === 'lead' ? (contactName?.trim() || 'Lead')
                  : info.kind === 'note' ? 'Nota interna'
                  : info.kind === 'agent' ? (agentNamesMap[msg.sender_id!] || agentPhoneName)
                  : info.kind === 'agentPhone' ? agentPhoneName
                  : 'IA';

                return (
                  <div key={msg.id} className={`flex gap-2 ${info.align}`}>
                    {!info.outgoing && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${info.color} ${
                      info.outgoing ? 'rounded-tr-md' : 'rounded-tl-md'
                    } ${msg.direction === 'private_note' ? 'border border-yellow-500/30 italic' : ''}`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
                      {msg.media_url && msg.media_type === 'image' && (
                        <img src={msg.media_url} alt="" className="rounded-lg max-w-full mt-1 max-h-48 object-cover" />
                      )}
                      <p className={`text-[10px] mt-1 ${info.outgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {senderLabel} · {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {info.outgoing && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
