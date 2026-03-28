import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot, Send, User, Loader2, Clock, Zap, RotateCcw,
  Wrench, ShoppingCart, Image, Tag, Bookmark, Columns3, UserCog,
  PhoneForwarded, Mic, Sparkles, Package, MessageSquare, X, FileImage,
  ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, Settings2, Download,
  Copy, Shield, Eye, Timer, Layers, UserCircle, AlertTriangle, Play
} from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════ */
/*  Types                                                      */
/* ═══════════════════════════════════════════════════════════ */

interface AIAgent {
  id: string; name: string; instance_id: string;
  personality: string | null; greeting_message: string | null;
  model: string | null; temperature: number | null; max_tokens: number | null;
  blocked_topics: string[] | null;
}

interface ToolCall {
  name: string; args: Record<string, unknown>; result?: string; duration_ms?: number;
}

interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system';
  content: string; timestamp: Date;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
  media_type?: 'text' | 'image' | 'audio'; media_url?: string;
  rating?: 'approved' | 'disapproved'; note?: string;
}

interface PlaygroundResponse {
  ok: boolean; response: string; error?: string;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
}

interface Overrides {
  temperature: number; maxTokens: number; model: string;
  disabledTools: Set<string>;
}

/* ═══════════════════════════════════════════════════════════ */
/*  Constants                                                  */
/* ═══════════════════════════════════════════════════════════ */

const TOOL_META: Record<string, { icon: typeof Wrench; label: string; color: string }> = {
  search_products: { icon: ShoppingCart, label: 'Buscar Produtos', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  send_carousel: { icon: Package, label: 'Carrossel', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  send_media: { icon: Image, label: 'Mídia', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  assign_label: { icon: Bookmark, label: 'Label', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  set_tags: { icon: Tag, label: 'Tags', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  move_kanban: { icon: Columns3, label: 'Kanban', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  update_lead_profile: { icon: UserCog, label: 'Lead', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  handoff_to_human: { icon: PhoneForwarded, label: 'Handoff', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const ALL_TOOLS = Object.keys(TOOL_META);

const PERSONAS = [
  { name: 'Cliente curioso', msgs: ['Oi, quais produtos voces tem?', 'Tem promoção?'] },
  { name: 'Cliente apressado', msgs: ['Preciso de um orçamento urgente pra 50 sacos de cimento'] },
  { name: 'Pede vendedor', msgs: ['Oi', 'Quero falar com um vendedor humano'] },
  { name: 'Envia áudio', msgs: ['(áudio simulado) Queria saber preço do porcelanato'] },
  { name: 'Multi-mensagem', msgs: ['oi', 'tudo bem?', 'queria ver tintas', 'tem coral?'] },
  { name: 'Frustrado', msgs: ['Ninguem responde nessa loja', 'Ja mandei 3 mensagens'] },
];

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

/* ═══════════════════════════════════════════════════════════ */
/*  Component                                                  */
/* ═══════════════════════════════════════════════════════════ */

const AIAgentPlayground = () => {
  const { isSuperAdmin, userId } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 12));
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // Overrides
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({
    temperature: 0.7, maxTokens: 1024, model: 'gemini-2.5-flash', disabledTools: new Set(),
  });

  // Buffer/Debounce mode
  const [bufferMode, setBufferMode] = useState(false);
  const [bufferSec, setBufferSec] = useState(10);
  const [bufferedMsgs, setBufferedMsgs] = useState<string[]>([]);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bufferCountdown, setBufferCountdown] = useState(0);

  // Prompt viewer
  const [showPrompt, setShowPrompt] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Data fetching ── */
  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_agents')
        .select('id, name, instance_id, personality, greeting_message, model, temperature, max_tokens, blocked_topics')
        .eq('enabled', true).order('name');
      if (error) throw error;
      const list = (data || []) as unknown as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
        if (list[0].temperature) setOverrides(o => ({ ...o, temperature: list[0].temperature || 0.7 }));
        if (list[0].max_tokens) setOverrides(o => ({ ...o, maxTokens: list[0].max_tokens || 1024 }));
        if (list[0].model) setOverrides(o => ({ ...o, model: list[0].model || 'gemini-2.5-flash' }));
      }
    } catch (err) { handleError(err, 'Erro ao carregar agentes', 'Playground'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAgents(); }, []);
  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [messages]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  /* ── Send message ── */
  const sendToAgent = async (userMessages: string[]) => {
    if (!selectedAgentId) return;
    const combined = userMessages.join('\n');
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: combined,
      timestamp: new Date(), media_type: attachedImage ? 'image' : 'text', media_url: attachedImage || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setAttachedImage(null);
    setSending(true);

    try {
      const history = [...messages, userMsg].map(m => ({
        content: m.content, media_type: m.media_type || 'text', media_url: m.media_url || null,
        direction: m.role === 'user' ? 'incoming' : 'outgoing', timestamp: m.timestamp.toISOString(),
      }));

      const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', {
        agent_id: selectedAgentId, messages: history,
        overrides: {
          temperature: overrides.temperature, max_tokens: overrides.maxTokens,
          model: overrides.model, disabled_tools: [...overrides.disabledTools],
        },
      });

      if (result.ok && result.response) {
        if (result.tool_calls?.length) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(), role: 'system', content: '',
            timestamp: new Date(), tool_calls: result.tool_calls,
          }]);
        }
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'assistant', content: result.response,
          timestamp: new Date(), tokens: result.tokens, latency_ms: result.latency_ms,
          tool_calls: result.tool_calls,
        }]);
      } else {
        toast.error(result.error || 'Erro ao processar resposta');
      }
    } catch (err: any) {
      if (err?.status === 404) toast.error('Edge function ai-agent-playground não implantada');
      else handleError(err, 'Erro ao chamar agente', 'Playground');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !attachedImage) || sending) return;
    setInput('');

    if (bufferMode && text) {
      setBufferedMsgs(prev => [...prev, text]);
      setBufferCountdown(bufferSec);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = setTimeout(() => {
        setBufferedMsgs(prev => { if (prev.length > 0) sendToAgent(prev); return []; });
        setBufferCountdown(0);
      }, bufferSec * 1000);
      // Countdown ticker
      const tick = setInterval(() => {
        setBufferCountdown(c => { if (c <= 1) { clearInterval(tick); return 0; } return c - 1; });
      }, 1000);
      return;
    }
    sendToAgent([text]);
  };

  /* ── Rating ── */
  const rateMessage = async (msgId: string, rating: 'approved' | 'disapproved') => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating } : m));
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const prevUserMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === 'user');
    try {
      await supabase.from('playground_evaluations').insert({
        session_id: sessionId, message_index: messages.indexOf(msg),
        agent_id: selectedAgentId, user_message: prevUserMsg?.content || '',
        assistant_message: msg.content, rating,
        tool_calls: msg.tool_calls || [], latency_ms: msg.latency_ms || 0,
        tokens_used: (msg.tokens?.input || 0) + (msg.tokens?.output || 0),
        evaluated_by: userId,
      });
    } catch { /* best effort */ }
  };

  /* ── Export ── */
  const exportConversation = (format: 'json' | 'md') => {
    const data = format === 'json'
      ? JSON.stringify({ session_id: sessionId, agent: selectedAgent?.name, messages, overrides }, null, 2)
      : messages.map(m => {
          if (m.role === 'system') return `---\n**Tools:** ${m.tool_calls?.map(t => t.name).join(', ')}\n---`;
          const label = m.role === 'user' ? 'Lead' : 'Agente IA';
          let line = `**${label}:** ${m.content}`;
          if (m.latency_ms) line += ` _(${m.latency_ms}ms)_`;
          if (m.rating) line += ` [${m.rating === 'approved' ? 'OK' : 'FAIL'}]`;
          return line;
        }).join('\n\n');
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `playground-${sessionId}.${format === 'json' ? 'json' : 'md'}`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Conversa exportada como .${format}`);
  };

  /* ── Copy Full Report ── */
  const copyFullReport = () => {
    const lines: string[] = [];
    lines.push('RELATÓRIO DE SESSÃO — PLAYGROUND IA');
    lines.push('━'.repeat(40));
    lines.push(`Sessão: ${sessionId}`);
    lines.push(`Agente: ${selectedAgent?.name || '?'}`);
    lines.push(`Modelo: ${overrides.model} | Temp: ${overrides.temperature} | MaxTok: ${overrides.maxTokens}`);
    lines.push(`Tools desabilitadas: ${overrides.disabledTools.size > 0 ? [...overrides.disabledTools].join(', ') : 'nenhuma'}`);
    lines.push(`Data: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`Total tokens: ${(totalTokens.input + totalTokens.output).toLocaleString()} (~$${totalCost.toFixed(4)})`);
    lines.push(`Latência média: ${avgLatency}ms`);
    lines.push('━'.repeat(40));
    lines.push('');

    // Detect issues
    const issues: string[] = [];
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    const greetings = assistantMsgs.filter(m => m.content.includes(selectedAgent?.greeting_message || '__NOPE__'));
    if (greetings.length > 1) issues.push(`Saudação repetida ${greetings.length}x (esperado: 1x)`);
    if (assistantMsgs.some(m => (m.latency_ms || 0) > 5000)) issues.push('Latência > 5s detectada em alguma resposta');
    if (assistantMsgs.some(m => m.content.length > 500)) issues.push('Resposta muito longa (>500 chars) — deve ser conciso');
    const toolMsgs = messages.filter(m => m.role === 'system' && m.tool_calls?.length);
    const allToolCalls = toolMsgs.flatMap(m => m.tool_calls || []);
    const toolNames = allToolCalls.map(t => t.name);
    if (toolNames.filter(n => n === 'search_products').length > 3) issues.push('search_products chamado 3+ vezes (loop?)');
    const disapproved = messages.filter(m => m.rating === 'disapproved');
    if (disapproved.length > 0) issues.push(`${disapproved.length} resposta(s) reprovada(s)`);
    // Check if lead gave name but update_lead_profile was never called
    const userTexts = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ');
    if (userTexts.match(/meu nome|me chamo|sou o |sou a /i) && !toolNames.includes('update_lead_profile')) {
      issues.push('Lead informou nome mas update_lead_profile nunca foi chamado');
    }
    if (!toolNames.includes('set_tags') && assistantMsgs.length >= 3) {
      issues.push('set_tags nunca usado após 3+ turnos (deveria classificar motivo)');
    }

    if (issues.length > 0) {
      lines.push('PROBLEMAS DETECTADOS:');
      issues.forEach(i => lines.push(`  ⚠ ${i}`));
      lines.push('');
    }

    // Tool usage summary
    if (allToolCalls.length > 0) {
      lines.push('TOOLS UTILIZADAS:');
      const toolCounts: Record<string, number> = {};
      allToolCalls.forEach(t => toolCounts[t.name] = (toolCounts[t.name] || 0) + 1);
      Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        lines.push(`  ${name}: ${count}x`);
      });
      // Tools never used
      const neverUsed = ALL_TOOLS.filter(t => !toolNames.includes(t) && !overrides.disabledTools.has(t));
      if (neverUsed.length > 0) lines.push(`  Nunca usadas: ${neverUsed.join(', ')}`);
      lines.push('');
    }

    // Conversation
    lines.push('CONVERSA COMPLETA:');
    lines.push('');
    messages.forEach((m, i) => {
      if (m.role === 'system' && m.tool_calls?.length) {
        lines.push(`  [TOOLS] ${m.tool_calls.map(t => `${t.name}(${JSON.stringify(t.args).substring(0, 80)})`).join(' → ')}`);
        m.tool_calls.forEach(t => { if (t.result) lines.push(`    ↳ ${t.result.substring(0, 120)}`); });
        return;
      }
      const label = m.role === 'user' ? `#${i + 1} LEAD` : `#${i + 1} AGENTE`;
      const rating = m.rating === 'approved' ? ' ✅' : m.rating === 'disapproved' ? ' ❌' : '';
      const meta = m.latency_ms ? ` (${m.latency_ms}ms)` : '';
      lines.push(`${label}${rating}${meta}:`);
      lines.push(`  ${m.content}`);
      if (m.note) lines.push(`  📝 Nota: ${m.note}`);
      lines.push('');
    });

    // Insights
    lines.push('━'.repeat(40));
    lines.push('INSIGHTS PARA CORREÇÃO:');
    if (issues.length === 0) {
      lines.push('  ✅ Nenhum problema óbvio detectado');
    } else {
      if (greetings.length > 1) lines.push('  → Verificar system prompt: remover instrução de saudação ou ajustar lógica de first-turn');
      if (disapproved.length > 0) lines.push('  → Revisar respostas reprovadas e ajustar system prompt/rules');
      if (!toolNames.includes('set_tags')) lines.push('  → Adicionar instrução no prompt para usar set_tags logo no primeiro turno');
      if (toolNames.filter(n => n === 'search_products').length > 3) lines.push('  → Possível loop: agente buscando repetidamente sem critério diferente');
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Relatório copiado para a área de transferência');
  };

  /* ── Personas ── */
  const runPersona = async (persona: typeof PERSONAS[0]) => {
    if (sending || !selectedAgentId) return;
    for (const msg of persona.msgs) {
      setInput(msg);
      await new Promise(r => setTimeout(r, 300));
      await sendToAgent([msg]);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  /* ── Replay ── */
  const replayMessage = async (msgIndex: number) => {
    if (sending || !selectedAgentId) return;
    const targetMsg = messages[msgIndex];
    if (targetMsg?.role !== 'user') return;

    // Remove all messages from this point onwards
    const historyBefore = messages.slice(0, msgIndex);
    setMessages(historyBefore);
    await new Promise(r => setTimeout(r, 100));
    await sendToAgent([targetMsg.content]);
  };

  const replaySession = async () => {
    if (sending || !selectedAgentId) return;
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
    if (userMsgs.length === 0) return;
    setMessages([]);
    await new Promise(r => setTimeout(r, 100));
    for (const msg of userMsgs) {
      await sendToAgent([msg]);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  /* ── Guardrail test ── */
  const testGuardrail = (topic: string) => {
    setInput(`O que voce acha sobre ${topic}? Me fala tudo sobre ${topic}`);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    setMessages([]); setBufferedMsgs([]); setAttachedImage(null);
    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    inputRef.current?.focus();
  };

  const totalTokens = messages.reduce(
    (acc, m) => ({ input: acc.input + (m.tokens?.input || 0), output: acc.output + (m.tokens?.output || 0) }),
    { input: 0, output: 0 }
  );
  const totalCost = (totalTokens.input * 0.15 + totalTokens.output * 0.6) / 1_000_000;
  const avgLatency = (() => {
    const lats = messages.filter(m => m.latency_ms).map(m => m.latency_ms!);
    return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
  })();

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agents.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Bot className="w-8 h-8 text-primary" /></div>
      <p className="font-semibold">Nenhum agente ativo</p>
      <p className="text-sm text-muted-foreground">Crie e ative um agente na Configuração</p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-5xl mx-auto animate-fade-in h-[calc(100vh-5rem)] flex flex-col gap-2">

        {/* ══════ Header ══════ */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Playground</h1>
              <p className="text-[11px] text-muted-foreground">8 tools · debug · avaliação · sessão {sessionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {agents.length > 1 && (
              <Select value={selectedAgentId || ''} onValueChange={(v) => { setSelectedAgentId(v); setMessages([]); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showOverrides ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setShowOverrides(!showOverrides)}>
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Configurações</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyFullReport} disabled={!messages.length}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Copiar relatório completo</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => exportConversation('json')} disabled={!messages.length}>
                <Download className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Exportar JSON</TooltipContent></Tooltip>
            {messages.length > 0 && (
              <>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={replaySession} disabled={sending}>
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger><TooltipContent>Replay sessão — reenvia todas as mensagens</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleClear}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger><TooltipContent>Reset</TooltipContent></Tooltip>
              </>
            )}
          </div>
        </div>

        {/* ══════ Simulation Warning ══════ */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[10px] leading-tight">Resultados simulados — tools não executam ações reais (sem WhatsApp, sem DB). Comportamento em produção pode variar.</p>
        </div>

        {/* ══════ Overrides Panel ══════ */}
        {showOverrides && (
          <Card className="flex-shrink-0 border-primary/20 bg-primary/5">
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Modelo</label>
                  <Select value={overrides.model} onValueChange={v => setOverrides(o => ({ ...o, model: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Temperatura: {overrides.temperature.toFixed(1)}</label>
                  <Slider value={[overrides.temperature]} min={0} max={2} step={0.1} onValueChange={([v]) => setOverrides(o => ({ ...o, temperature: v }))} className="mt-2" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Max Tokens: {overrides.maxTokens}</label>
                  <Slider value={[overrides.maxTokens]} min={128} max={8192} step={128} onValueChange={([v]) => setOverrides(o => ({ ...o, maxTokens: v }))} className="mt-2" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Buffer/Debounce</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Switch checked={bufferMode} onCheckedChange={setBufferMode} />
                    <span className="text-xs">{bufferMode ? `${bufferSec}s` : 'Off'}</span>
                    {bufferMode && <Slider value={[bufferSec]} min={3} max={30} step={1} onValueChange={([v]) => setBufferSec(v)} className="w-20" />}
                  </div>
                </div>
              </div>
              {/* Tools toggle */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Tools ativas</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TOOLS.map(name => {
                    const meta = TOOL_META[name];
                    const Icon = meta.icon;
                    const disabled = overrides.disabledTools.has(name);
                    return (
                      <button key={name} onClick={() => setOverrides(o => {
                        const s = new Set(o.disabledTools);
                        disabled ? s.delete(name) : s.add(name);
                        return { ...o, disabledTools: s };
                      })}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-all ${
                          disabled ? 'opacity-30 line-through border-border' : meta.color
                        }`}
                      >
                        <Icon className="w-3 h-3" />{meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Blocked topics guardrail tester */}
              {selectedAgent?.blocked_topics?.length ? (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Testar Guardrails
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.blocked_topics.map(topic => (
                      <button key={topic} onClick={() => testGuardrail(topic)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />{topic}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* System prompt viewer */}
              <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
                <CollapsibleTrigger className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  <Eye className="w-3 h-3" />
                  {showPrompt ? 'Ocultar' : 'Ver'} System Prompt
                  {showPrompt ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="text-[11px] bg-background/80 rounded-lg p-3 max-h-40 overflow-auto border border-border/50 whitespace-pre-wrap">
                    {selectedAgent?.personality || 'Sem system prompt configurado'}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )}

        {/* ══════ Stats bar ══════ */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0 px-1">
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]"><Bot className="w-3 h-3" />{selectedAgent?.name}</Badge>
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Zap className="w-3 h-3" />{overrides.model}</Badge>
          {totalTokens.input + totalTokens.output > 0 && (
            <>
              <Badge variant="outline" className="px-2 py-0.5 text-[11px]">{(totalTokens.input + totalTokens.output).toLocaleString()} tok</Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] text-muted-foreground">~${totalCost.toFixed(4)}</Badge>
              {avgLatency > 0 && <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Clock className="w-3 h-3" />{avgLatency}ms avg</Badge>}
            </>
          )}
          {messages.filter(m => m.rating).length > 0 && (
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]">
              <ThumbsUp className="w-3 h-3 text-emerald-400" />{messages.filter(m => m.rating === 'approved').length}
              <ThumbsDown className="w-3 h-3 text-red-400 ml-1" />{messages.filter(m => m.rating === 'disapproved').length}
            </Badge>
          )}
        </div>

        {/* ══════ Chat ══════ */}
        <div className="flex-1 border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">Envie uma mensagem para testar o agente</p>
                {/* Personas */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-1 max-w-lg">
                  {PERSONAS.map(p => (
                    <button key={p.name} onClick={() => runPersona(p)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border border-border/50 bg-background hover:bg-muted transition-colors"
                    >
                      <UserCircle className="w-3 h-3" />{p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((msg, idx) => {
                  if (msg.role === 'system' && msg.tool_calls?.length) {
                    return (
                      <div key={msg.id} className="flex justify-center py-0.5">
                        <div className="flex flex-wrap gap-1 justify-center max-w-[95%]">
                          {msg.tool_calls.map((tc, i) => {
                            const meta = TOOL_META[tc.name] || { icon: Wrench, label: tc.name, color: 'text-muted-foreground bg-muted border-border' };
                            const Icon = meta.icon;
                            return (
                              <Collapsible key={i}>
                                <CollapsibleTrigger className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium ${meta.color} cursor-pointer hover:opacity-80 transition-all`}>
                                  <Icon className="w-3 h-3" />{meta.label}
                                  <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1">
                                  <div className="text-[10px] bg-background/80 rounded-lg p-2 border border-border/50 max-w-xs">
                                    <p className="font-mono font-semibold mb-0.5">{tc.name}()</p>
                                    {Object.entries(tc.args || {}).map(([k, v]) => (
                                      <p key={k} className="text-muted-foreground"><span className="text-foreground">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>
                                    ))}
                                    {tc.result && <p className="mt-1 text-emerald-400 border-t border-border/30 pt-1">{tc.result}</p>}
                                    {tc.duration_ms != null && <p className="text-muted-foreground">{tc.duration_ms}ms</p>}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex gap-2 justify-end">
                        <div className="max-w-[75%] space-y-0.5">
                          {msg.media_type === 'image' && msg.media_url && (
                            <div className="rounded-xl overflow-hidden border border-primary/20">
                              <img src={msg.media_url} alt="" className="max-h-40 object-cover rounded-xl" loading="lazy" />
                            </div>
                          )}
                          {msg.media_type === 'audio' && (
                            <div className="flex items-center gap-2 bg-primary rounded-2xl rounded-tr-md px-3 py-2">
                              <Mic className="w-3.5 h-3.5 text-primary-foreground/70" />
                              <div className="flex gap-px">{Array.from({ length: 18 }).map((_, i) => (
                                <div key={i} className="w-[2px] rounded-full bg-primary-foreground/50" style={{ height: `${3 + Math.random() * 10}px` }} />
                              ))}</div>
                              <span className="text-[9px] text-primary-foreground/60 ml-0.5">0:03</span>
                            </div>
                          )}
                          {msg.content && msg.media_type !== 'audio' && (
                            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-3.5 py-2">
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 justify-end pr-0.5">
                            <span className="text-[9px] text-muted-foreground">
                              #{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button onClick={() => replayMessage(idx)} disabled={sending}
                              className="p-0.5 rounded text-muted-foreground/30 hover:text-primary transition-colors disabled:opacity-30"
                              title="Replay — reenviar esta mensagem">
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                          <User className="w-3 h-3 text-secondary-foreground" />
                        </div>
                      </div>
                    );
                  }

                  // Assistant
                  return (
                    <div key={msg.id} className="flex gap-2 justify-start">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <div className="max-w-[78%] space-y-0.5">
                        <div className={`bg-muted/80 rounded-2xl rounded-tl-md px-3.5 py-2 border ${
                          msg.rating === 'approved' ? 'border-emerald-500/30' : msg.rating === 'disapproved' ? 'border-red-500/30' : 'border-transparent'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-1.5 pl-0.5">
                          <span className="text-[9px] text-muted-foreground">
                            #{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.latency_ms != null && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2 h-2" />{msg.latency_ms}ms</span>}
                          {msg.tokens && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap className="w-2 h-2" />{msg.tokens.input + msg.tokens.output}</span>}
                          <span className="mx-0.5" />
                          <button onClick={() => rateMessage(msg.id, 'approved')}
                            className={`p-0.5 rounded transition-colors ${msg.rating === 'approved' ? 'text-emerald-400' : 'text-muted-foreground/30 hover:text-emerald-400'}`}>
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => rateMessage(msg.id, 'disapproved')}
                            className={`p-0.5 rounded transition-colors ${msg.rating === 'disapproved' ? 'text-red-400' : 'text-muted-foreground/30 hover:text-red-400'}`}>
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copiado'); }}
                            className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-primary animate-pulse" />
                    </div>
                    <div className="bg-muted/80 rounded-2xl rounded-tl-md px-4 py-3">
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" /></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Buffer indicator */}
          {bufferMode && bufferedMsgs.length > 0 && (
            <div className="px-4 pb-1 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[11px]">{bufferedMsgs.length} mensagem(ns) no buffer</span>
                {bufferCountdown > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400"><Timer className="w-2.5 h-2.5 mr-0.5" />{bufferCountdown}s</Badge>
                )}
                <div className="flex-1" />
                <div className="flex gap-1">{bufferedMsgs.map((m, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 rounded-full max-w-[80px] truncate">{m}</span>
                ))}</div>
              </div>
            </div>
          )}

          {/* Attached image preview */}
          {attachedImage && (
            <div className="px-4 pb-1 flex-shrink-0">
              <div className="relative inline-block">
                <img src={attachedImage} alt="" className="h-16 rounded-lg border border-border/50" />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className={`border-t p-2.5 flex items-end gap-1.5 flex-shrink-0 ${bufferMode ? 'border-amber-500/30' : 'border-border/50'}`}>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              if (!f.type.startsWith('image/')) { toast.error('Apenas imagens'); return; }
              setAttachedImage(URL.createObjectURL(f)); e.target.value = '';
            }} />
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                <FileImage className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Imagem</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" disabled={sending} onClick={() => {
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: 'Enviou um áudio', timestamp: new Date(), media_type: 'audio' }]);
                setTimeout(() => setMessages(prev => [...prev, {
                  id: crypto.randomUUID(), role: 'assistant', content: '[Simulado] Em produção, áudio é transcrito pelo Groq Whisper e enviado ao agente.',
                  timestamp: new Date(),
                }]), 800);
              }}>
                <Mic className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Simular áudio</TooltipContent></Tooltip>

            <Textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={bufferMode ? 'Continue digitando... mensagens serão combinadas' : 'Digite uma mensagem... (Enter envia, Shift+Enter nova linha)'}
              disabled={sending || !selectedAgentId} rows={1}
              className="flex-1 min-h-[36px] max-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm py-2"
            />

            <Button size="icon" className={`h-8 w-8 shrink-0 rounded-xl ${bufferMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
              onClick={handleSend} disabled={(!input.trim() && !attachedImage) || sending || !selectedAgentId}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : bufferMode ? <Layers className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AIAgentPlayground;
