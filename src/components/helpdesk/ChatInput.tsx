import { useState, useEffect, useRef, memo } from 'react';
import { Send, StickyNote, Mic, X, Paperclip, Loader2, Plus, ImageIcon, Smile, Tags, CircleDot, Check, Reply } from 'lucide-react';
import { EmojiPickerContent } from '@/components/ui/emoji-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { STATUS_OPTIONS } from '@/lib/constants';
import { STATUS_IA } from '@/constants/statusIa';
import { nowBRISO } from '@/lib/dateUtils';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSendFile } from '@/hooks/useSendFile';
import type { Conversation, Label, Message } from '@/types';

interface ChatInputProps {
  conversation: Conversation;
  onMessageSent: () => void;
  onAgentAssigned?: (conversationId: string, agentId: string) => void;
  inboxLabels?: Label[];
  assignedLabelIds?: string[];
  onLabelsChanged?: () => void;
  onStatusChange?: (status: string) => void;
  replyTo?: Message | null;
  onClearReply?: () => void;
}

export const ChatInput = memo(function ChatInput({ conversation, onMessageSent, onAgentAssigned, inboxLabels = [], assignedLabelIds = [], onLabelsChanged, onStatusChange, replyTo, onClearReply }: ChatInputProps) {
  const { user } = useAuth();
  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording, formatTime } = useAudioRecorder();
  const { sendingFile, fileInputRef, imageInputRef, handleSendFile } = useSendFile();

  const autoAssignAgent = async () => {
    if (!user || conversation.assigned_to === user.id) return;
    try {
      const { assignAgent } = await import('@/lib/helpdeskBroadcast');
      await assignAgent(conversation.id, user.id);
      onAgentAssigned?.(conversation.id, user.id);
    } catch (err) {
      console.error('Auto-assign error:', err);
      toast.error('Erro ao atribuir agente automaticamente');
    }
  };

  const fireOutgoingWebhook = async (messageData: {
    message_type: string;
    content: string | null;
    media_url: string | null;
  }) => {
    const inbox = conversation.inbox;
    const webhookUrl = inbox?.webhook_outgoing_url;
    if (!webhookUrl || !user) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: instanceInfo } = await supabase
        .from('instances')
        .select('name')
        .eq('id', inbox?.instance_id || '')
        .maybeSingle();

      await supabase.functions.invoke('fire-outgoing-webhook', {
        body: {
          webhook_url: webhookUrl,
          payload: {
            timestamp: nowBRISO(),
            instance_name: instanceInfo?.name || '',
            instance_id: inbox?.instance_id || '',
            inbox_name: inbox?.name || '',
            inbox_id: inbox?.id || conversation.inbox_id,
            contact_name: conversation.contact?.name || '',
            remotejid: conversation.contact?.jid,
            fromMe: true,
            agent_name: profile?.full_name || user.email,
            agent_id: user.id,
            pausar_agente: 'sim',
            status_ia: STATUS_IA.DESLIGADA,
            message_type: messageData.message_type,
            message: messageData.content,
            media_url: messageData.media_url,
          },
        },
      });
    } catch (err) {
      console.error('Outgoing webhook error:', err);
    }
  };

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isNote, setIsNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Draft: load on conversation change
  const draftKey = `helpdesk-draft-${conversation.id}`;
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      setText(saved);
      setIsDraft(true);
    } else {
      setText('');
      setIsDraft(false);
    }
  }, [conversation.id]);

  // Draft: save on text change (debounced)
  useEffect(() => {
    if (!text.trim()) {
      localStorage.removeItem(draftKey);
      setIsDraft(false);
      return;
    }
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, text);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, draftKey]);

  // Typing indicator: broadcast when text changes (throttled 3s)
  const lastTypingRef = useRef(0);
  useEffect(() => {
    if (!text.trim() || !user) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 3000) return;
    lastTypingRef.current = now;
    import('@/lib/helpdeskBroadcast').then(({ broadcastTyping }) =>
      broadcastTyping(conversation.id, user.id, user.user_metadata?.full_name || 'Agente')
    );
  }, [text, conversation.id, user]);
  const [showLabels, setShowLabels] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [togglingLabel, setTogglingLabel] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);

  // Load templates once
  useEffect(() => {
    if (!user) return;
    supabase.from('message_templates').select('id, name, content').eq('user_id', user.id).eq('message_type', 'text').order('name').then(({ data }) => {
      if (data) setTemplates(data.filter(t => t.content));
    });
  }, [user]);

  // Show template dropdown when text starts with "/"
  useEffect(() => {
    if (text.startsWith('/') && templates.length > 0) {
      const filter = text.slice(1).toLowerCase();
      setTemplateFilter(filter);
      setShowTemplates(true);
      setSelectedTemplateIdx(0);
    } else {
      setShowTemplates(false);
    }
  }, [text, templates.length]);

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateFilter) || t.content?.toLowerCase().includes(templateFilter)
  ).slice(0, 8);

  const selectTemplate = (template: { name: string; content: string }) => {
    setText(template.content);
    setShowTemplates(false);
    setIsDraft(false);
  };

  const statusOptions = STATUS_OPTIONS;

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', conversation.id);

    if (!error) {
      onStatusChange?.(newStatus);
      toast.success('Status atualizado');
      setMenuOpen(false);
      setShowStatus(false);
    } else {
      toast.error('Erro ao atualizar status');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendAudio = async () => {
    const blob = await stopRecording();
    if (!blob || !user) return;

    setSending(true);
    try {
      const instanceId = conversation.inbox?.instance_id || '';
      if (!instanceId) { toast.error('Instância não encontrada'); return; }
      const contactJid = conversation.contact?.jid;
      if (!contactJid) { toast.error('Contato sem JID'); return; }

      // Upload audio to storage
      const fileName = `${conversation.id}/${Date.now()}.ogg`;
      const { error: uploadError } = await supabase.storage
        .from('audio-messages')
        .upload(fileName, blob, { contentType: blob.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('audio-messages')
        .getPublicUrl(fileName);
      const audioPublicUrl = publicUrlData.publicUrl;

      const base64Audio = await blobToBase64(blob);

      await uazapiProxy({
        action: 'send-audio',
        instance_id: instanceId,
        jid: contactJid,
        audio: base64Audio,
      });

      const { data: insertedMsg, error } = await supabase.from('conversation_messages').insert({
        conversation_id: conversation.id,
        direction: 'outgoing',
        content: null,
        media_type: 'audio',
        media_url: audioPublicUrl,
        sender_id: user.id,
      }).select().single();
      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString(), last_message: '🎵 Áudio', status_ia: STATUS_IA.DESLIGADA })
        .eq('id', conversation.id);

      await supabase.channel('helpdesk-realtime').send({
        type: 'broadcast',
        event: 'new-message',
        payload: {
          conversation_id: conversation.id,
          message_id: insertedMsg.id,
          direction: 'outgoing',
          media_type: 'audio',
          content: null,
          media_url: audioPublicUrl,
          created_at: insertedMsg.created_at,
          status_ia: STATUS_IA.DESLIGADA,
        },
      });
      await supabase.channel('helpdesk-conversations').send({
        type: 'broadcast',
        event: 'new-message',
        payload: {
          conversation_id: conversation.id,
          inbox_id: conversation.inbox_id,
          content: null,
          media_type: 'audio',
          created_at: insertedMsg.created_at,
        },
      });

      await autoAssignAgent();
      await fireOutgoingWebhook({ message_type: 'audio', content: null, media_url: audioPublicUrl });
      onMessageSent();
    } catch (err) {
      handleError(err, 'Erro ao enviar áudio', 'Send audio error');
    } finally {
      setSending(false);
    }
  };

  const onFileSelected = async (file: File) => {
    const instanceId = conversation.inbox?.instance_id || '';
    const contactJid = conversation.contact?.jid || '';
    const result = await handleSendFile(file, {
      conversationId: conversation.id,
      inboxId: conversation.inbox_id,
      instanceId,
      contactJid,
      userId: user?.id || '',
    });
    if (result.success) {
      await autoAssignAgent();
      await fireOutgoingWebhook({
        message_type: result.mediaType || 'document',
        content: result.mediaType === 'image' ? null : file.name,
        media_url: result.mediaUrl || null,
      });
      onMessageSent();
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    setSending(true);

    // Build final content with quote prefix if replying
    const finalContent = replyTo
      ? `> *Citando:* ${replyTo.content || '[Midia]'}\n\n${text.trim()}`
      : text.trim();

    try {
      if (isNote) {
        const { error } = await supabase.from('conversation_messages').insert({
          conversation_id: conversation.id,
          direction: 'private_note',
          content: finalContent,
          media_type: 'text',
          sender_id: user.id,
        });
        if (error) throw error;
      } else {
        const instanceId = conversation.inbox?.instance_id || '';
        if (!instanceId) { toast.error('Instância não encontrada'); return; }
        const contactJid = conversation.contact?.jid;
        if (!contactJid) { toast.error('Contato sem JID'); return; }

        await uazapiProxy({
          action: 'send-chat',
          instance_id: instanceId,
          jid: contactJid,
          message: finalContent,
        });

        const { data: insertedMsg, error } = await supabase.from('conversation_messages').insert({
          conversation_id: conversation.id,
          direction: 'outgoing',
          content: finalContent,
          media_type: 'text',
          sender_id: user.id,
        }).select().single();
        if (error) throw error;

        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString(), last_message: finalContent, status_ia: STATUS_IA.DESLIGADA })
          .eq('id', conversation.id);

        const { broadcastNewMessage } = await import('@/lib/helpdeskBroadcast');
        await broadcastNewMessage({
          conversation_id: conversation.id,
          inbox_id: conversation.inbox_id,
          message_id: insertedMsg.id,
          direction: 'outgoing',
          content: finalContent,
          media_type: 'text',
          created_at: insertedMsg.created_at,
          status_ia: STATUS_IA.DESLIGADA,
        });
      }

      if (!isNote) {
        await autoAssignAgent();
        await fireOutgoingWebhook({ message_type: 'text', content: finalContent, media_url: null });
      }
      setText('');
      onClearReply?.();
      localStorage.removeItem(`helpdesk-draft-${conversation.id}`);
      onMessageSent();
    } catch (err) {
      handleError(err, 'Erro ao enviar', 'Send error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Template navigation
    if (showTemplates) {
      if (filteredTemplates.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedTemplateIdx(i => Math.min(i + 1, filteredTemplates.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedTemplateIdx(i => Math.max(i - 1, 0)); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectTemplate(filteredTemplates[selectedTemplateIdx]); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowTemplates(false); setText(''); return; }
      // Block Enter when template mode active but no matches (prevents sending "/xyz")
      if (e.key === 'Enter') { e.preventDefault(); setShowTemplates(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file drop from ChatPanel drag-and-drop
  useEffect(() => {
    const handleFileDrop = (e: Event) => {
      const file = (e as CustomEvent).detail?.file;
      if (file && conversation) {
        onFileSelected(file);
      }
    };
    window.addEventListener('helpdesk-file-drop', handleFileDrop);
    return () => window.removeEventListener('helpdesk-file-drop', handleFileDrop);
  }, [conversation]);

  return (
    <div className="p-3 border-t border-border/50 bg-card/50">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md bg-secondary/50 border-l-2 border-primary text-xs">
          <Reply className="w-3 h-3 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-primary font-medium">Respondendo</span>
            <p className="line-clamp-2 text-muted-foreground">{replyTo.content || '[Midia]'}</p>
          </div>
          <button onClick={onClearReply} className="shrink-0 hover:text-foreground text-muted-foreground" aria-label="Cancelar resposta"><X className="w-3 h-3" /></button>
        </div>
      )}
      {isNote && !isRecording && (
        <div className="bg-warning/10 border border-warning/30 rounded-md px-3 py-1 mb-2 text-xs text-warning">
          📝 Escrevendo nota privada — o cliente não verá esta mensagem
        </div>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={cancelRecording} title="Cancelar gravação" aria-label="Cancelar gravação">
            <X className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
            </span>
            <span className="text-sm font-mono text-destructive">{formatTime(recordingTime)}</span>
            <span className="text-xs text-muted-foreground">Gravando...</span>
          </div>
          <Button size="icon" className="shrink-0 h-9 w-9" onClick={handleSendAudio} disabled={sending} aria-label="Enviar áudio">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); }}
          />
          <input
            type="file"
            ref={imageInputRef}
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); }}
          />

          {sendingFile ? (
            <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" disabled>
              <Loader2 className="w-4 h-4 animate-spin" />
            </Button>
          ) : (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" aria-label="Anexos e opções">
                  <Plus className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-48 p-1.5">
                <div className="flex flex-col gap-0.5">
                  <button
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${isNote ? 'bg-warning/20 text-warning' : 'hover:bg-accent text-foreground'}`}
                    onClick={() => { setIsNote(!isNote); setMenuOpen(false); }}
                  >
                    <StickyNote className="w-4 h-4" />
                    {isNote ? 'Desativar nota' : 'Nota privada'}
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground disabled:opacity-50 disabled:pointer-events-none"
                    onClick={() => { imageInputRef.current?.click(); setMenuOpen(false); }}
                    disabled={isNote}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Enviar imagem
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground disabled:opacity-50 disabled:pointer-events-none"
                    onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
                    disabled={isNote}
                  >
                    <Paperclip className="w-4 h-4" />
                    Enviar documento
                  </button>
                  {inboxLabels.length > 0 && (
                    <>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground"
                        onClick={() => setShowLabels(!showLabels)}
                      >
                        <Tags className="w-4 h-4" />
                        Etiquetas
                      </button>
                      {showLabels && (
                        <div className="border-t border-border/50 pt-1 mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                          {inboxLabels.map(label => {
                            const isAssigned = assignedLabelIds.includes(label.id);
                            return (
                              <button
                                key={label.id}
                                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md hover:bg-secondary/50 text-sm disabled:opacity-50"
                                onClick={async () => {
                                  setTogglingLabel(label.id);
                                  try {
                                    if (isAssigned) {
                                      await supabase.from('conversation_labels').delete()
                                        .eq('conversation_id', conversation.id).eq('label_id', label.id);
                                    } else {
                                      await supabase.from('conversation_labels')
                                        .insert({ conversation_id: conversation.id, label_id: label.id });
                                    }
                                    onLabelsChanged?.();
                                  } catch (err) {
                                    handleError(err, 'Erro');
                                  } finally {
                                    setTogglingLabel(null);
                                  }
                                }}
                                disabled={togglingLabel === label.id}
                              >
                                <Checkbox checked={isAssigned} className="pointer-events-none" />
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                                <span className="truncate">{label.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground"
                    onClick={() => setShowStatus(!showStatus)}
                  >
                    <CircleDot className="w-4 h-4" />
                    Status
                  </button>
                  {showStatus && (
                    <div className="border-t border-border/50 pt-1 mt-1 space-y-0.5">
                      {statusOptions.map(opt => {
                        const isActive = conversation.status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-accent font-medium' : 'hover:bg-secondary/50'}`}
                            onClick={() => handleStatusChange(opt.value)}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.color}`} />
                            <span className="flex-1 text-left">{opt.label}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground" disabled={sending}>
                        <Smile className="w-4 h-4" />
                        Enviar Emojis
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-[320px] p-0 z-[100]">
                      <EmojiPickerContent onEmojiSelect={(emoji) => setText(prev => prev + emoji)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="flex-1 relative">
            {isDraft && (
              <span className="absolute -top-4 left-1 text-[10px] text-muted-foreground italic">Rascunho restaurado</span>
            )}
            {/* Quick reply templates dropdown */}
            {showTemplates && filteredTemplates.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] text-muted-foreground border-b border-border/50">
                  Respostas rápidas — ↑↓ navegar · Enter selecionar · Esc fechar
                </div>
                {filteredTemplates.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${idx === selectedTemplateIdx ? 'bg-accent' : ''}`}
                    onClick={() => selectTemplate(t)}
                    onMouseEnter={() => setSelectedTemplateIdx(idx)}
                  >
                    <span className="font-medium text-primary">/{t.name}</span>
                    <span className="ml-2 text-muted-foreground truncate">{t.content?.substring(0, 60)}</span>
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={text}
              onChange={e => { setText(e.target.value); setIsDraft(false); }}
              onKeyDown={handleKeyDown}
              placeholder={isNote ? 'Escrever nota privada...' : 'Escrever mensagem...'}
              aria-label={isNote ? 'Escrever nota privada' : 'Escrever mensagem'}
              className="min-h-[40px] max-h-32 resize-none text-sm md:text-sm text-base"
              rows={1}
            />
          </div>
          <Button size="icon" className="shrink-0 h-9 w-9" onClick={handleSend} disabled={!text.trim() || sending} aria-label="Enviar mensagem">
            <Send className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={startRecording} disabled={isNote} title="Gravar áudio" aria-label="Gravar áudio">
            <Mic className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
