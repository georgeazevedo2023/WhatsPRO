import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, User, Headphones, ExternalLink } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';

interface Message {
  id: string;
  direction: string;
  content: string | null;
  media_type: string;
  media_url: string | null;
  transcription: string | null;
  sender_id: string | null;
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

/** Info de exibição por mensagem. Outgoing distingue IA (sender_id NULL) de Atendente humano. */
function msgInfo(msg: Message) {
  if (msg.direction === 'incoming') {
    return { label: 'Lead', icon: User, color: 'bg-muted', align: 'justify-start', outgoing: false };
  }
  if (msg.direction === 'private_note') {
    return { label: 'Nota', icon: Headphones, color: 'bg-yellow-500/10', align: 'justify-start', outgoing: false };
  }
  // outgoing
  if (msg.sender_id) {
    return { label: 'Atendente', icon: Headphones, color: 'bg-emerald-600 text-white', align: 'justify-end', outgoing: true };
  }
  return { label: 'IA', icon: Bot, color: 'bg-primary text-primary-foreground', align: 'justify-end', outgoing: true };
}

export function ConversationModal({ open, onOpenChange, conversationId, contactName, inboxId }: ConversationModalProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !conversationId) return;
    setLoading(true);
    supabase
      .from('conversation_messages')
      .select('id, direction, content, media_type, media_url, transcription, sender_id, created_at')
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
                        {info.label} · {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
