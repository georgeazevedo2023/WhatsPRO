import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId } from '@/hooks/useAuthSession';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { useContactProfilePic } from '@/hooks/useContactProfilePic';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ConversationStatusSelect } from './ConversationStatusSelect';
import { ContactAvatar } from './ContactAvatar';
import { Badge } from '@/components/ui/badge';
import { nowBRISO, formatBR, BRAZIL_TZ } from '@/lib/dateUtils';
import { toZonedTime } from 'date-fns-tz';
import { NotesPanel } from './NotesPanel';
import { TicketResolutionDrawer } from './TicketResolutionDrawer';
import { STATUS_IA } from '@/constants/statusIa';

import { Button } from '@/components/ui/button';
import { MessageSquare, ArrowLeft, User, PanelRightOpen, PanelRightClose, PanelLeftOpen, PanelLeftClose, Bot, StickyNote, RefreshCw, WifiOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation, Message, Label } from '@/types';

interface ChatPanelProps {
  conversation: Conversation | null;
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
  onBack?: () => void;
  onShowInfo?: () => void;
  onToggleInfo?: () => void;
  showingInfo?: boolean;
  onToggleList?: () => void;
  showingList?: boolean;
  inboxLabels?: Label[];
  assignedLabelIds?: string[];
  onLabelsChanged?: () => void;
  agentNamesMap?: Record<string, string>;
  onAgentAssigned?: (conversationId: string, agentId: string) => void;
}

// Date divider helper
const getDateLabel = (dateStr: string) => {
  const zoned = toZonedTime(new Date(dateStr), BRAZIL_TZ);
  const nowZoned = toZonedTime(new Date(), BRAZIL_TZ);
  const today = new Date(nowZoned.getFullYear(), nowZoned.getMonth(), nowZoned.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Hoje';
  if (msgDate.getTime() === yesterday.getTime()) return 'Ontem';
  return formatBR(dateStr, zoned.getFullYear() !== nowZoned.getFullYear() ? "dd 'de' MMM yyyy" : "dd 'de' MMM");
};

const MESSAGES_PAGE_SIZE = 50;

export const ChatPanel = ({ conversation, onUpdateConversation, onBack, onShowInfo, onToggleInfo, showingInfo, onToggleList, showingList, inboxLabels, assignedLabelIds, onLabelsChanged, agentNamesMap, onAgentAssigned }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [channelStatus, setChannelStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [iaAtivada, setIaAtivada] = useState(false);
  const [ativandoIa, setAtivandoIa] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const prevMsgCountRef = useRef(0);
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const notes = messages.filter(m => m.direction === 'private_note');
  const chatMessages = messages.filter(m => m.direction !== 'private_note');

  const agentName = conversation?.assigned_to
    ? (agentNamesMap?.[conversation.assigned_to] || conversation.assigned_to.slice(0, 8))
    : null;

  // Load IA state
  useEffect(() => {
    setAtivandoIa(false);
    if (!conversation?.id) { setIaAtivada(false); return; }
    supabase.from('conversations').select('status_ia').eq('id', conversation.id).maybeSingle()
      .then(({ data }) => setIaAtivada(data?.status_ia === STATUS_IA.LIGADA));
  }, [conversation?.id]);

  const fetchIdRef = useRef(0);

  // Fetch latest N messages (paginated — descending then reversed for display)
  const fetchMessages = useCallback(async () => {
    if (!conversation) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setFetchError(false);
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);
      if (error) throw error;
      if (id === fetchIdRef.current) {
        const msgs = ((data as Message[]) || []).reverse();
        setMessages(msgs);
        setHasOlderMessages(msgs.length === MESSAGES_PAGE_SIZE);
      }
    } catch (err) {
      if (id === fetchIdRef.current) { setFetchError(true); handleError(err, 'Erro ao carregar mensagens', 'Fetch messages'); }
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [conversation]);

  // Load older messages (prepend to existing)
  const loadOlderMessages = useCallback(async () => {
    if (!conversation || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const oldestMsg = messages[0];
    const scrollEl = scrollContainerRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight || 0;
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .lt('created_at', oldestMsg.created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);
      if (error) throw error;
      const older = ((data as Message[]) || []).reverse();
      setMessages(prev => [...older, ...prev]);
      setHasOlderMessages(older.length === MESSAGES_PAGE_SIZE);
      // Preserve scroll position after prepending
      requestAnimationFrame(() => {
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight;
      });
    } catch (err) {
      handleError(err, 'Erro ao carregar mensagens anteriores', 'Load older');
    } finally {
      setLoadingOlder(false);
    }
  }, [conversation, loadingOlder, messages]);

  useEffect(() => { fetchMessages(); setReplyTo(null); }, [fetchMessages]);

  // Realtime — listen on the SAME channel the webhook broadcasts to
  useEffect(() => {
    setTypingAgent(null); // Reset typing indicator on conversation switch
    if (!conversation) return;
    const channel = supabase.channel('helpdesk-realtime')
      .on('broadcast', { event: 'new-message' }, (payload) => {
        if (payload.payload?.conversation_id === conversation.id) {
          // Fetch latest message and append (not full refetch)
          supabase.from('conversation_messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setMessages(prev => {
                  if (prev.some(m => m.id === data.id)) return prev;
                  return [...prev, data as Message];
                });
              }
            })
            .catch(() => {}); // Non-critical — next message will trigger refresh
          if (payload.payload?.status_ia) {
            setIaAtivada(payload.payload.status_ia === STATUS_IA.LIGADA);
          }
        }
      })
      .on('broadcast', { event: 'agent-typing' }, (payload) => {
        const currentUserId = getSessionUserId();
        if (payload.payload?.conversation_id === conversation.id && payload.payload?.agent_id !== currentUserId) {
          setTypingAgent(payload.payload.agent_name as string);
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTypingAgent(null), 4000);
        }
      })
      .subscribe((status) => {
        setChannelStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CLOSED' ? 'disconnected' : 'connecting');
      });
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); clearTimeout(typingTimerRef.current); };
  }, [conversation?.id]);

  // Sound notification
  useEffect(() => {
    const incomingCount = chatMessages.filter(m => m.direction === 'incoming').length;
    if (prevMsgCountRef.current > 0 && incomingCount > prevMsgCountRef.current && !document.hasFocus()) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRlYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YTIAAABkZGRkAACAgP//ZGT//wAA//8AAICAR0eAgEdH//9HR///R0f//0dHAABHR0dHAABHRw==');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
    prevMsgCountRef.current = incomingCount;
  }, [chatMessages]);

  // Smart auto-scroll: only scroll to bottom if user is already near the bottom
  // This prevents snapping away when user is reading older messages
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 150; // px from bottom
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (loading || !isNearBottomRef.current) return;
    const timer = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 150);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  const handleToggleIA = async () => {
    if (!conversation || ativandoIa) return;
    setAtivandoIa(true);
    const newStatus = iaAtivada ? STATUS_IA.DESLIGADA : STATUS_IA.LIGADA;
    try {
      // Update status_ia directly in database
      await supabase.from('conversations').update({ status_ia: newStatus }).eq('id', conversation.id);
      setIaAtivada(newStatus === STATUS_IA.LIGADA);
      toast.success(newStatus === STATUS_IA.LIGADA ? 'IA ativada' : 'IA desativada');
    } catch (err) { handleError(err, 'Erro ao alterar IA', 'Toggle IA'); }
    finally { setAtivandoIa(false); }
  };

  const contact = conversation?.contact;
  const headerPic = useContactProfilePic(contact?.id, contact?.jid, conversation?.inbox?.instance_id, contact?.profile_pic_url);

  // Compute date dividers for messages
  const messagesWithDividers = useMemo(() => {
    const result: Array<{ type: 'divider'; label: string } | { type: 'message'; message: Message; showUnread: boolean }> = [];
    let lastDate = '';

    chatMessages.forEach((msg, idx) => {
      const msgDate = getDateLabel(msg.created_at);
      if (msgDate !== lastDate) {
        result.push({ type: 'divider', label: msgDate });
        lastDate = msgDate;
      }
      const showUnread = !conversation!.is_read && msg.direction === 'incoming' && idx > 0 && chatMessages[idx - 1]?.direction !== 'incoming';
      result.push({ type: 'message', message: msg, showUnread });
    });
    return result;
  }, [chatMessages, conversation?.is_read]);

  // These callbacks MUST be before the early return to maintain consistent hook count
  const handleMessageSent = useCallback(() => { fetchMessages(); setIaAtivada(false); }, [fetchMessages]);
  const handleStatusChange = useCallback((status: string) => {
    if (conversation) onUpdateConversation(conversation.id, { status });
  }, [conversation?.id, onUpdateConversation]);
  const handleClearReply = useCallback(() => setReplyTo(null), []);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 opacity-30" />
        </div>
        <p className="text-sm font-medium">Selecione uma conversa</p>
        <p className="text-xs text-muted-foreground mt-1">Escolha uma conversa na lista para começar</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header (2 rows) ── */}
      <div className="shrink-0 z-10 bg-card shadow-[0_1px_3px_0_rgb(0_0_0/0.05)]">
        {/* Row 1: Avatar + Name + Nav */}
        <div className="flex items-center gap-2 px-3 py-2">
          {onBack && (
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          )}
          {onToggleList && (
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onToggleList}>
              {showingList ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
          )}

          <ContactAvatar src={headerPic} name={contact?.name} size={36} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{contact?.name || contact?.phone || 'Desconhecido'}</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {contact?.phone && <span>{contact.phone}</span>}
              {agentName && <><span className="text-muted-foreground/40">·</span><span className="text-primary/70 font-medium">{agentName}</span></>}
            </div>
          </div>

          {/* Connection dot */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${channelStatus === 'connected' ? 'bg-primary' : channelStatus === 'disconnected' ? 'bg-destructive animate-pulse' : 'bg-warning animate-pulse'}`}
            title={channelStatus === 'connected' ? 'Conectado' : channelStatus === 'disconnected' ? 'Desconectado' : 'Conectando...'} />

          {onShowInfo && <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onShowInfo}><User className="w-4 h-4" /></Button>}
          {onToggleInfo && <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onToggleInfo}>{showingInfo ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}</Button>}
        </div>

        {/* Row 2: Status + IA + Notes pills */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <ConversationStatusSelect value={conversation.status} onChange={(status) => onUpdateConversation(conversation.id, { status })} />

          <Button
            variant={iaAtivada ? 'default' : 'outline'}
            size="sm"
            className={`h-6 text-[10px] gap-1 rounded-full px-2.5 ${iaAtivada ? 'bg-primary/15 text-primary border-primary/30 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30' : ''}`}
            onClick={handleToggleIA}
            disabled={ativandoIa}
          >
            <Bot className="w-3 h-3" />
            {ativandoIa ? '...' : iaAtivada ? 'IA Ativa' : 'Ativar IA'}
          </Button>

          {notes.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 rounded-full px-2" onClick={() => setNotesOpen(true)}>
              <StickyNote className="w-3 h-3 text-warning" />
              <span className="text-warning font-medium">{notes.length}</span>
            </Button>
          )}

          <div className="ml-auto">
            <TicketResolutionDrawer
              conversation={conversation}
              onResolved={(id, status) => onUpdateConversation(id, { status })}
              trigger={
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 rounded-full px-2.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                  <CheckCircle2 className="w-3 h-3" />
                  Finalizar
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto px-3 md:px-4 py-3 relative ${isDragOver ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) window.dispatchEvent(new CustomEvent('helpdesk-file-drop', { detail: { file } })); }}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-20 pointer-events-none rounded-lg">
            <div className="bg-card border-2 border-dashed border-primary rounded-xl px-8 py-6 text-center shadow-lg animate-scale-in">
              <p className="text-sm font-semibold text-primary">Solte o arquivo aqui</p>
              <p className="text-xs text-muted-foreground mt-1">Imagem ou documento</p>
            </div>
          </div>
        )}

        {loading ? (
          /* Skeleton loading */
          <div className="space-y-4 py-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`rounded-2xl ${i % 2 === 0 ? 'bg-muted' : 'bg-primary/20'}`} style={{ width: `${40 + Math.random() * 30}%`, height: `${28 + Math.random() * 24}px` }} />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground animate-scale-in">
            <WifiOff className="w-10 h-10 opacity-40" />
            <p>Falha ao carregar mensagens</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchMessages}><RefreshCw className="w-3.5 h-3.5" />Tentar novamente</Button>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center"><MessageSquare className="w-6 h-6 opacity-30" /></div>
            <p className="text-sm font-medium">Nenhuma mensagem</p>
            <p className="text-xs">Envie uma mensagem para iniciar</p>
          </div>
        ) : (
          <div className="space-y-1">
            {hasOlderMessages && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={loadOlderMessages} disabled={loadingOlder}>
                  {loadingOlder ? <><RefreshCw className="w-3 h-3 animate-spin" />Carregando...</> : 'Carregar mensagens anteriores'}
                </Button>
              </div>
            )}
            {messagesWithDividers.map((item, idx) => {
              if (item.type === 'divider') {
                return (
                  <div key={`div-${idx}`} className="flex items-center justify-center gap-3 py-3">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[10px] text-muted-foreground bg-background px-3 py-0.5 rounded-full border border-border/40 font-medium">
                      {item.label}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                );
              }
              return (
                <div key={item.message.id}>
                  {item.showUnread && (
                    <div className="flex items-center gap-2 py-2 my-1">
                      <div className="h-px flex-1 bg-primary/40" />
                      <span className="text-[10px] text-primary font-semibold px-2">Novas mensagens</span>
                      <div className="h-px flex-1 bg-primary/40" />
                    </div>
                  )}
                  <MessageBubble message={item.message} instanceId={conversation.inbox?.instance_id} agentNamesMap={agentNamesMap} onReply={setReplyTo} />
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingAgent && (
        <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
          {typingAgent} está digitando...
        </div>
      )}

      {/* Input */}
      <ChatInput conversation={conversation} onMessageSent={handleMessageSent} onAgentAssigned={onAgentAssigned} inboxLabels={inboxLabels} assignedLabelIds={assignedLabelIds} onLabelsChanged={onLabelsChanged} onStatusChange={handleStatusChange} replyTo={replyTo} onClearReply={handleClearReply} />

      <NotesPanel open={notesOpen} onOpenChange={setNotesOpen} notes={notes} onNoteDeleted={(noteId) => setMessages(prev => prev.filter(m => m.id !== noteId))} agentNamesMap={agentNamesMap} />
    </>
  );
};
