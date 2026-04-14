// M19 S5: Página dedicada do assistente IA — versão full-screen
import { useState, useEffect, useRef } from 'react';
import { Sparkles, Plus, MessageSquare } from 'lucide-react';
import { useManagerInstances } from '@/hooks/useManagerInstances';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssistantMessageBubble from '@/components/assistant/AssistantMessageBubble';
import AssistantInput from '@/components/assistant/AssistantInput';
import AssistantSuggestions from '@/components/assistant/AssistantSuggestions';

export default function AssistantPage() {
  const { data: instances } = useManagerInstances();
  const [selectedInstance, setSelectedInstance] = useState<string | null>(
    () => localStorage.getItem('wp-gestao-instance')
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-selecionar instância da gestão ou primeira disponível
  useEffect(() => {
    if (!selectedInstance && instances?.length) {
      const saved = localStorage.getItem('wp-gestao-instance');
      const valid = saved && instances.some(i => i.id === saved);
      setSelectedInstance(valid ? saved : instances[0].id);
    }
  }, [instances, selectedInstance]);

  const {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    conversations,
    loadConversation,
    currentConversationId,
    getSuggestions,
  } = useAssistantChat(selectedInstance);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestions = messages.length === 0 ? getSuggestions() : (
    messages[messages.length - 1]?.suggestions ?? []
  );

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Sidebar — histórico de conversas */}
      <div className="w-60 shrink-0 flex flex-col rounded-xl border border-primary/10 bg-card overflow-hidden">
        <div className="p-3 border-b border-primary/10">
          <button
            onClick={clearChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 text-sm hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem conversas anteriores</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{conv.title || 'Sem título'}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                  {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col rounded-xl border border-primary/10 bg-card overflow-hidden">
        {/* Header com filtros */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Assistente IA</h1>
          </div>
          <Select
            value={selectedInstance ?? '__none__'}
            onValueChange={(val) => setSelectedInstance(val === '__none__' ? null : val)}
          >
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              {(instances || []).map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-medium mb-2">Pergunte sobre seus dados</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Faça perguntas em linguagem natural sobre leads, vendedores, NPS, custos da IA,
                conversões e mais. O assistente consulta suas métricas em tempo real.
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <AssistantMessageBubble key={msg.id} message={msg} />
            ))
          )}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex gap-1.5">
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
          disabled={isLoading || !selectedInstance}
          placeholder={!selectedInstance ? 'Selecione uma instância' : 'Pergunte algo sobre seus dados...'}
        />
      </div>
    </div>
  );
}
