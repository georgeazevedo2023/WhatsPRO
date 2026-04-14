// M19 S5: Widget flutuante do assistente IA conversacional
// Toggle: botão no canto inferior direito ou Ctrl+J
// Só visível para super_admin e gerente

import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Minimize2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerInstances } from '@/hooks/useManagerInstances';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import AssistantMessageBubble from './AssistantMessageBubble';
import AssistantInput from './AssistantInput';
import AssistantSuggestions from './AssistantSuggestions';

export default function AssistantChatWidget() {
  const { isSuperAdmin, isGerente } = useAuth();
  const { data: instances } = useManagerInstances();

  const [open, setOpen] = useState(() => localStorage.getItem('wp-assistant-open') === '1');
  const [instanceId, setInstanceId] = useState<string | null>(
    () => localStorage.getItem('wp-gestao-instance') || instances?.[0]?.id || null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reativo: escuta mudança de instância via custom event (mesma janela)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setInstanceId(detail);
    };
    window.addEventListener('wp-instance-change', handler);
    return () => window.removeEventListener('wp-instance-change', handler);
  }, []);

  // Fallback: usar primeira instância se nenhuma selecionada
  useEffect(() => {
    if (!instanceId && instances?.length) {
      setInstanceId(instances[0].id);
    }
  }, [instanceId, instances]);

  const { messages, isLoading, sendMessage, clearChat, getSuggestions } = useAssistantChat(instanceId);

  // Persistir estado open/closed
  useEffect(() => {
    localStorage.setItem('wp-assistant-open', open ? '1' : '0');
  }, [open]);

  // Ctrl+J toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Só renderiza para gerente/super_admin
  if (!isSuperAdmin && !isGerente) return null;

  // Botão flutuante quando fechado
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center"
        title="Assistente IA (Ctrl+J)"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  const suggestions = messages.length === 0 ? getSuggestions() : (
    messages[messages.length - 1]?.suggestions ?? []
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[500px] flex flex-col rounded-xl border border-primary/20 bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Assistente IA</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Ctrl+J</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1 rounded hover:bg-primary/10 transition-colors text-muted-foreground"
              title="Nova conversa"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-primary/10 transition-colors text-muted-foreground"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">Pergunte sobre seus dados</p>
            <p className="text-xs text-muted-foreground">
              Leads, vendedores, NPS, custos da IA e mais.
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <AssistantMessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <AssistantSuggestions
        suggestions={suggestions}
        onSelect={sendMessage}
        disabled={isLoading}
      />

      {/* Input */}
      <AssistantInput
        onSend={sendMessage}
        disabled={isLoading || !instanceId}
        placeholder={!instanceId ? 'Nenhuma instância disponível' : undefined}
      />
    </div>
  );
}
