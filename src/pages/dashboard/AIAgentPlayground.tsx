import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Bot, Send, Trash2, User, Loader2, Clock, Zap, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface AIAgent {
  id: string;
  name: string;
  instance_id: string;
  personality: string | null;
  greeting_message: string | null;
  model: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: { input: number; output: number };
  latency_ms?: number;
}

interface PlaygroundResponse {
  ok: boolean;
  response: string;
  tokens?: { input: number; output: number };
  latency_ms?: number;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
  error?: string;
}

const AIAgentPlayground = () => {
  const { isSuperAdmin } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, instance_id, personality, greeting_message, model')
        .eq('enabled', true)
        .order('name');
      if (error) throw error;
      const list = (data || []) as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
      }
    } catch (err) {
      handleError(err, 'Erro ao carregar agentes', 'Fetch agents for playground');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedAgentId || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      // Build message history for the edge function
      const historyMessages = [...messages, userMsg].map(m => ({
        content: m.content,
        media_type: 'text',
        direction: m.role === 'user' ? 'incoming' : 'outgoing',
        timestamp: m.timestamp.toISOString(),
      }));

      const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', {
        agent_id: selectedAgentId,
        messages: historyMessages,
      });

      if (result.ok && result.response) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          tokens: result.tokens,
          latency_ms: result.latency_ms,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        toast.error(result.error || 'Erro ao processar resposta do agente');
      }
    } catch (err: any) {
      // If the playground edge function doesn't exist, show helpful error
      if (err?.status === 404) {
        toast.error('Edge function ai-agent-playground ainda nao foi implantada. Deploy com: npx supabase functions deploy ai-agent-playground');
      } else {
        handleError(err, 'Erro ao chamar agente', 'Playground send');
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const totalTokens = messages.reduce(
    (acc, m) => ({
      input: acc.input + (m.tokens?.input || 0),
      output: acc.output + (m.tokens?.output || 0),
    }),
    { input: 0, output: 0 }
  );

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold">Nenhum agente ativo</p>
          <p className="text-sm text-muted-foreground">Crie e ative um agente primeiro na pagina de Configuracao</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Playground</h1>
            <p className="text-sm text-muted-foreground">Teste seu agente IA em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {agents.length > 1 && (
            <Select value={selectedAgentId || ''} onValueChange={(v) => { setSelectedAgentId(v); setMessages([]); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {messages.length > 0 && (
            <Button variant="outline" size="icon" onClick={handleClear} title="Limpar conversa">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Agent info bar */}
      {selectedAgent && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Badge variant="secondary" className="gap-1">
            <Bot className="w-3 h-3" />
            {selectedAgent.name}
          </Badge>
          {selectedAgent.model && (
            <Badge variant="outline" className="gap-1">
              <Zap className="w-3 h-3" />
              {selectedAgent.model}
            </Badge>
          )}
          {totalTokens.input + totalTokens.output > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              Tokens: {totalTokens.input + totalTokens.output}
            </Badge>
          )}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 border rounded-xl bg-card overflow-hidden flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
              <Bot className="w-12 h-12 opacity-30" />
              <p className="text-sm">Envie uma mensagem para iniciar a conversa</p>
              {selectedAgent?.greeting_message && (
                <p className="text-xs opacity-60">
                  Saudacao configurada: "{selectedAgent.greeting_message}"
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-muted rounded-tl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={`flex items-center gap-2 mt-1 text-[10px] ${
                      msg.role === 'user' ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'
                    }`}>
                      <span>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.latency_ms != null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {msg.latency_ms}ms
                        </span>
                      )}
                      {msg.tokens && (
                        <span>{msg.tokens.input + msg.tokens.output} tok</span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-3 flex items-center gap-2 flex-shrink-0">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            disabled={sending || !selectedAgentId}
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending || !selectedAgentId}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIAgentPlayground;
