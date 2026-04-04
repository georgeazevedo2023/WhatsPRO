import {
  type AIAgent, type ChatMessage, type PlaygroundResponse,
  type Overrides, type ScenarioCategory, type TestScenario, type ScenarioRun, type WatchSpeed,
  type E2eResult, type E2eLiveStep, type E2eRunResult,
  TEST_SCENARIOS, computeResults,
} from '@/types/playground';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Bot, Loader2, Zap, RotateCcw, Sparkles, MessageSquare, Layers, BarChart3, Settings2, Download, Play, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PlaygroundManualTab } from '@/components/admin/ai-agent/playground/PlaygroundManualTab';
import { PlaygroundScenariosTab } from '@/components/admin/ai-agent/playground/PlaygroundScenariosTab';
import { PlaygroundResultsTab } from '@/components/admin/ai-agent/playground/PlaygroundResultsTab';
import { PlaygroundE2eTab } from '@/components/admin/ai-agent/playground/PlaygroundE2eTab';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCreateBatch, useCompleteBatch } from '@/hooks/useE2eBatchHistory'
import { BatchHistoryTab } from '@/components/admin/ai-agent/playground/BatchHistoryTab'

const AIAgentPlayground = () => {
  const { isSuperAdmin } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 12));
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({ temperature: 0.7, maxTokens: 1024, model: 'gpt-4.1-mini', disabledTools: new Set() });
  const [bufferMode, setBufferMode] = useState(false);
  const [bufferSec, setBufferSec] = useState(10);
  const [_bufferedMsgs, setBufferedMsgs] = useState<string[]>([]);  // eslint-disable-line
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bufferCountdown, setBufferCountdown] = useState(0);  // eslint-disable-line
  const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e' | 'history'>('manual');
  const [e2eNumber, setE2eNumber] = useState('5581985749970');
  const [e2eRunning, setE2eRunning] = useState(false);
  const [e2eResults, setE2eResults] = useState<E2eRunResult[]>([]);
  const [e2eCurrentScenario, setE2eCurrentScenario] = useState<string | null>(null);
  const [e2eLiveSteps, setE2eLiveSteps] = useState<E2eLiveStep[]>([]);
  const [e2eSelectedScenario, setE2eSelectedScenario] = useState<TestScenario | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);
  const [watchSpeed, setWatchSpeed] = useState<WatchSpeed>(1);
  const watchSpeedRef = useRef<WatchSpeed>(1); watchSpeedRef.current = watchSpeed;
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const [runHistory, setRunHistory] = useState<ScenarioRun[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]); messagesRef.current = messages;
  const overridesRef = useRef(overrides); overridesRef.current = overrides;
  const createBatch = useCreateBatch()
  const completeBatch = useCompleteBatch()

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('ai_agents')
        .select('id, name, instance_id, personality, greeting_message, model, temperature, max_tokens, blocked_topics')
        .eq('enabled', true).order('name');
      if (error) throw error;
      const list = (data || []) as unknown as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
        if (list[0].temperature) setOverrides(o => ({ ...o, temperature: list[0].temperature || 0.7 }));
        if (list[0].max_tokens) setOverrides(o => ({ ...o, maxTokens: list[0].max_tokens || 1024 }));
        if (list[0].model) setOverrides(o => ({ ...o, model: list[0].model || 'gpt-4.1-mini' }));
      }
    } catch (err) { handleError(err, 'Erro ao carregar agentes', 'Playground'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAgents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const ov = overridesRef.current;

  const sendToAgent = async (userMessages: string[]) => {
    if (!selectedAgentId) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userMessages.join('\n'), timestamp: new Date(), media_type: attachedImage ? 'image' : 'text', media_url: attachedImage || undefined };
    setMessages(prev => [...prev, userMsg]); setAttachedImage(null); setSending(true);
    try {
      const history = [...messagesRef.current].map(m => ({ content: m.content, media_type: m.media_type || 'text', media_url: m.media_url || null, direction: m.role === 'user' ? 'incoming' : 'outgoing', timestamp: m.timestamp.toISOString() }));
      const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', { agent_id: selectedAgentId, messages: history, overrides: { temperature: ov.temperature, max_tokens: ov.maxTokens, model: ov.model, disabled_tools: [...ov.disabledTools] } });
      if (result.ok && result.response) {
        if (result.tool_calls?.length) setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: '', timestamp: new Date(), tool_calls: result.tool_calls }]);
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.response, timestamp: new Date(), tokens: result.tokens, latency_ms: result.latency_ms, tool_calls: result.tool_calls }]);
      } else { toast.error(result.error || 'Erro ao processar resposta'); }
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as Error & { status: number }).status === 404) toast.error('Edge function ai-agent-playground nao implantada');
      else handleError(err, 'Erro ao chamar agente', 'Playground');
    } finally { setSending(false); }
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !attachedImage) || sending) return;
    setInput('');
    if (bufferMode && text) {
      setBufferedMsgs(prev => [...prev, text]); setBufferCountdown(bufferSec);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = setTimeout(() => { setBufferedMsgs(prev => { if (prev.length > 0) sendToAgent(prev); return []; }); setBufferCountdown(0); }, bufferSec * 1000);
      const tick = setInterval(() => { setBufferCountdown(c => { if (c <= 1) { clearInterval(tick); return 0; } return c - 1; }); }, 1000);
      return;
    }
    sendToAgent([text]);
  };

  const rateMessage = (msgId: string, rating: 'approved' | 'disapproved') => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating } : m));
  const handleClear = () => { setMessages([]); setBufferedMsgs([]); setAttachedImage(null); if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const replayMessage = async (msgIndex: number) => {
    if (sending || !selectedAgentId) return;
    const targetMsg = messages[msgIndex];
    if (targetMsg?.role !== 'user') return;
    setMessages(messages.slice(0, msgIndex));
    await new Promise(r => setTimeout(r, 100));
    await sendToAgent([targetMsg.content]);
  };

  const replaySession = async () => {
    if (sending || !selectedAgentId) return;
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
    if (!userMsgs.length) return;
    setMessages([]);
    await new Promise(r => setTimeout(r, 100));
    for (const msg of userMsgs) { await sendToAgent([msg]); await new Promise(r => setTimeout(r, 300)); }
  };

  const runPersona = async (persona: { name: string; msgs: string[] }) => {
    if (sending || !selectedAgentId) return;
    for (const msg of persona.msgs) { setInput(msg); await new Promise(r => setTimeout(r, 300)); await sendToAgent([msg]); await new Promise(r => setTimeout(r, 500)); }
  };

  // Save E2E result to database for persistence + approval workflow
  const saveE2eResult = async (result: E2eRunResult, runType: 'single' | 'batch', batchId?: string, batchUuid?: string) => {
    if (!selectedAgentId || !selectedAgent?.instance_id) return;
    try {
      await supabase.from('e2e_test_runs').insert({
        agent_id: selectedAgentId,
        instance_id: selectedAgent.instance_id,
        test_number: e2eNumber,
        scenario_id: result.scenario_id,
        scenario_name: result.scenario_name,
        total_steps: result.steps?.length || 0,
        passed: result.pass,
        results: result.steps || [],
        latency_ms: result.total_latency_ms || 0,
        error: result.error || null,
        run_type: runType,
        batch_id: batchId || null,
        batch_uuid: batchUuid || null,
        category: result.category,
        tools_used: result.tools_used || [],
        tools_missing: result.tools_missing || [],
        approval: result.pass ? 'auto_approved' : null,
      });
    } catch { /* silent — DB save is best-effort */ }
  };

  const runE2eScenario = async (scenario: TestScenario, runType: 'single' | 'batch' = 'single', batchId?: string, batchUuid?: string) => {
    if (e2eRunning || !selectedAgentId || !selectedAgent?.instance_id) return;
    setE2eRunning(true); setE2eCurrentScenario(scenario.id); setE2eSelectedScenario(scenario);
    setE2eLiveSteps(scenario.steps.map((s, i): E2eLiveStep => ({ step: i + 1, input: s.content, media_type: s.media_type || 'text', status: 'sending', agent_response: null, agent_raw: null, tools_used: [], tags: [], status_ia: undefined, latency_ms: 0, tokens: { input: 0, output: 0 } })));
    try {
      const { data, error } = await supabase.functions.invoke('e2e-test', { body: { agent_id: selectedAgentId, instance_id: selectedAgent.instance_id, test_number: e2eNumber, steps: scenario.steps.map(s => ({ content: s.content, media_type: s.media_type || 'text' })) } });
      if (error) throw error;
      type E2eTestData = { results?: E2eResult[]; total_latency_ms?: number; conversation_id?: string | null };
      const d = (data as E2eTestData | null) ?? {};
      const results = (d.results || []) as E2eResult[];
      setE2eLiveSteps(results.map((r): E2eLiveStep => ({ ...r, status: 'done' })));
      const uniqueTools: string[] = [...new Set(results.flatMap(r => r.tools_used || []))];
      const { tools_must_use, tools_must_not_use, should_handoff } = scenario.expected;
      const tools_missing = tools_must_use.filter(t => !uniqueTools.includes(t));
      const tools_unexpected = tools_must_not_use.filter(t => uniqueTools.includes(t));
      const handoff = uniqueTools.includes('handoff_to_human');
      const pass = !tools_missing.length && !tools_unexpected.length && (should_handoff ? handoff : true);
      const runResult: E2eRunResult = { id: crypto.randomUUID().substring(0, 8), scenario_id: scenario.id, scenario_name: scenario.name, category: scenario.category, timestamp: new Date(), pass, tools_used: uniqueTools, tools_missing, tools_unexpected, handoff, steps: results, total_latency_ms: d.total_latency_ms || 0, conversation_id: d.conversation_id };
      setE2eResults(prev => [runResult, ...prev]);
      await saveE2eResult(runResult, runType, batchId, batchUuid);
      if (runType === 'single') toast.success(pass ? `E2E PASSOU: ${scenario.name}` : `E2E FALHOU: ${scenario.name}`, { duration: 5000 });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'falha na execucao';
      if (runType === 'single') toast.error(`E2E erro: ${errMsg}`);
      setE2eLiveSteps(prev => prev.map(s => ({ ...s, status: 'error' as const })));
      const failResult: E2eRunResult = { id: crypto.randomUUID().substring(0, 8), scenario_id: scenario.id, scenario_name: scenario.name, category: scenario.category, timestamp: new Date(), pass: false, error: errMsg, steps: [], total_latency_ms: 0 };
      setE2eResults(prev => [failResult, ...prev]);
      await saveE2eResult(failResult, runType, batchId, batchUuid);
    } finally { setE2eRunning(false); setE2eCurrentScenario(null); }
  };

  // Batch: run ALL scenarios sequentially
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchAbortRef = useRef(false);

  const runAllE2e = async () => {
    if (e2eRunning || batchRunning || !selectedAgentId) return;
    const scenarios = filteredScenarios;
    if (scenarios.length === 0) return;
    setBatchRunning(true);
    batchAbortRef.current = false;
    const batchId = `batch_${Date.now()}`;
    // F1: create row in e2e_test_batches
    let batchUuid: string | undefined
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && selectedAgentId) {
        const rawPrompt = selectedAgent?.name || ''
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawPrompt))
        const promptHash = [...new Uint8Array(hashBuffer)]
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .substring(0, 12)
        batchUuid = await createBatch.mutateAsync({
          agentId: selectedAgentId,
          runType: 'manual',
          createdBy: user.id,
          promptHash,
        })
      }
    } catch { /* best-effort — continues without UUID */ }
    setBatchProgress({ current: 0, total: scenarios.length });
    setE2eResults([]);
    let passed = 0; let failed = 0;
    for (let i = 0; i < scenarios.length; i++) {
      if (batchAbortRef.current) break;
      setBatchProgress({ current: i + 1, total: scenarios.length });
      await runE2eScenario(scenarios[i], 'batch', batchId, batchUuid);
      // Check last result
      const lastResult = e2eResults[0]; // will be stale, check via state update
      if (lastResult?.pass) passed++; else failed++;
      // Small delay between scenarios to avoid rate limiting
      if (i < scenarios.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    // F1: finalize batch with counts from DB
    if (batchUuid && selectedAgentId) {
      try {
        await new Promise(r => setTimeout(r, 800))
        const { data: runs } = await supabase
          .from('e2e_test_runs')
          .select('passed')
          .eq('batch_uuid', batchUuid)
        const total = runs?.length ?? 0
        const passedCount = runs?.filter(r => r.passed).length ?? 0
        await completeBatch.mutateAsync({
          batchUuid,
          total,
          passed: passedCount,
          failed: total - passedCount,
          agentId: selectedAgentId,
        })
      } catch { /* best-effort */ }
    }
    setBatchRunning(false);
    toast.success(`Batch completo: ${passed} passou, ${failed} falhou de ${scenarios.length} cenários`, { duration: 8000 });
  };

  const stopBatch = () => { batchAbortRef.current = true; };

  const runScenario = async (scenario: TestScenario) => {
    if (sending || !selectedAgentId) return;
    isPausedRef.current = false; isStoppedRef.current = false;
    const run: ScenarioRun = { id: crypto.randomUUID().substring(0, 12), scenario_id: scenario.id, scenario_name: scenario.name, category: scenario.category, started_at: new Date(), status: 'running', current_step: 0, total_steps: scenario.steps.length, messages: [], results: null };
    setScenarioRun(run); setMessages([]);
    for (let i = 0; i < scenario.steps.length; i++) {
      while (isPausedRef.current && !isStoppedRef.current) { await new Promise(r => setTimeout(r, 200)); }
      if (isStoppedRef.current) break;
      setScenarioRun(prev => prev ? { ...prev, current_step: i, status: isPausedRef.current ? 'paused' : 'running' } : null);
      const step = scenario.steps[i]; const speed = watchSpeedRef.current;
      await new Promise(r => setTimeout(r, (step.delay_ms || 1500) / speed));
      if (isStoppedRef.current) break;
      if (step.media_type === 'audio') {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: step.content, timestamp: new Date(), media_type: 'audio' }]);
        setSending(true);
        try {
          const history = [...messagesRef.current].map(m => ({ content: m.content, media_type: m.media_type || 'text', media_url: null as string | null, direction: m.role === 'user' ? 'incoming' : 'outgoing', timestamp: m.timestamp.toISOString() }));
          const cur = overridesRef.current;
          const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', { agent_id: selectedAgentId!, messages: history, overrides: { temperature: cur.temperature, max_tokens: cur.maxTokens, model: cur.model, disabled_tools: [...cur.disabledTools] } });
          if (result.ok && result.response) {
            if (result.tool_calls?.length) setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: '', timestamp: new Date(), tool_calls: result.tool_calls }]);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.response, timestamp: new Date(), tokens: result.tokens, latency_ms: result.latency_ms, tool_calls: result.tool_calls }]);
          }
        } catch { /* scenario continues */ } finally { setSending(false); }
      } else { await sendToAgent([step.content]); }
      await new Promise(r => setTimeout(r, 800 / speed));
    }
    const finalMsgs = messagesRef.current;
    const results = computeResults(scenario, finalMsgs);
    const finishedRun: ScenarioRun = { ...run, status: isStoppedRef.current ? 'error' : 'done', finished_at: new Date(), current_step: scenario.steps.length, messages: finalMsgs, results };
    setScenarioRun(finishedRun); setRunHistory(prev => [finishedRun, ...prev]);
    toast.success(results.pass ? 'Cenario PASSOU!' : 'Cenario FALHOU', { description: scenario.name });
  };

  const pauseScenario = () => { isPausedRef.current = true; setScenarioRun(prev => prev ? { ...prev, status: 'paused' } : null); };
  const resumeScenario = () => { isPausedRef.current = false; setScenarioRun(prev => prev ? { ...prev, status: 'running' } : null); };
  const stopScenario = () => { isStoppedRef.current = true; isPausedRef.current = false; };

  const filteredScenarios = useMemo(() => {
    let list = TEST_SCENARIOS;
    if (selectedCategory !== 'all') list = list.filter(s => s.category === selectedCategory);
    if (scenarioSearch) { const q = scenarioSearch.toLowerCase(); list = list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)); }
    return list;
  }, [selectedCategory, scenarioSearch]);

  const totalTokens = messages.reduce((acc, m) => ({ input: acc.input + (m.tokens?.input || 0), output: acc.output + (m.tokens?.output || 0) }), { input: 0, output: 0 });
  const avgLatency = (() => { const lats = messages.filter(m => m.latency_ms).map(m => m.latency_ms!); return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0; })();

  const exportConversation = (format: 'json' | 'md') => {
    const data = format === 'json' ? JSON.stringify({ session_id: sessionId, agent: selectedAgent?.name, messages, overrides }, null, 2)
      : messages.map(m => { if (m.role === 'system') return `---\n**Tools:** ${m.tool_calls?.map(t => t.name).join(', ')}\n---`; const label = m.role === 'user' ? 'Lead' : 'Agente IA'; return `**${label}:** ${m.content}${m.latency_ms ? ` _(${m.latency_ms}ms)_` : ''}`; }).join('\n\n');
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `playground-${sessionId}.${format}`; a.click(); URL.revokeObjectURL(url);
    toast.success(`Exportado como .${format}`);
  };

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agents.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Bot className="w-12 h-12 text-primary opacity-30" />
      <p className="font-semibold">Nenhum agente ativo</p>
      <p className="text-sm text-muted-foreground">Crie e ative um agente na Configuracao</p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-[1400px] mx-auto animate-fade-in h-[calc(100vh-5rem)] flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
            <div><h1 className="text-xl font-bold">Playground IA</h1><p className="text-xs text-muted-foreground">8 tools · debug · cenarios · sessao {sessionId}</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            {agents.length > 1 && (
              <Select value={selectedAgentId || ''} onValueChange={(v) => { setSelectedAgentId(v); setMessages([]); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Tooltip><TooltipTrigger asChild><Button variant={showOverrides ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setShowOverrides(!showOverrides)}><Settings2 className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Configuracoes</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => exportConversation('json')} disabled={!messages.length}><Download className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Exportar JSON</TooltipContent></Tooltip>
            {messages.length > 0 && (<>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={replaySession} disabled={sending}><Play className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Replay sessao</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={handleClear}><RotateCcw className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Reset</TooltipContent></Tooltip>
            </>)}
          </div>
        </div>
        {/* Warning */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[10px] leading-tight">Playground de testes do Agente IA — Chat Manual e Cenarios usam LLM simulado. Aba E2E Real envia mensagens reais via WhatsApp.</p>
        </div>
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start flex-shrink-0">
            <TabsTrigger value="manual" className="gap-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5" />Chat Manual</TabsTrigger>
            <TabsTrigger value="scenarios" className="gap-1.5 text-xs"><Layers className="w-3.5 h-3.5" />Cenarios<Badge variant="secondary" className="ml-1 text-[9px] px-1">{TEST_SCENARIOS.length}</Badge></TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" />Resultados{runHistory.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1">{runHistory.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="e2e" className="gap-1.5 text-xs"><Zap className="w-3.5 h-3.5 text-amber-400" />E2E Real{e2eResults.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1">{e2eResults.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <ErrorBoundary section="Playground Manual">
            <PlaygroundManualTab messages={messages} sending={sending} input={input} attachedImage={attachedImage} bufferMode={bufferMode} bufferSec={bufferSec} bufferCountdown={bufferCountdown} showOverrides={showOverrides} overrides={overrides} selectedAgent={selectedAgent} totalTokens={totalTokens} avgLatency={avgLatency} onInputChange={setInput} onSend={handleSend} onClear={handleClear} onAttachImage={setAttachedImage} onBufferModeChange={setBufferMode} onBufferSecChange={setBufferSec} onOverridesChange={setOverrides} onShowOverridesToggle={() => setShowOverrides(!showOverrides)} onRateMessage={rateMessage} onReplayMessage={replayMessage} onRunPersona={runPersona} onKeyDown={handleKeyDown} onExportConversation={exportConversation} />
          </ErrorBoundary>
          <ErrorBoundary section="Playground Cenarios">
            <PlaygroundScenariosTab filteredScenarios={filteredScenarios} selectedCategory={selectedCategory} scenarioSearch={scenarioSearch} selectedScenario={selectedScenario} scenarioRun={scenarioRun} watchSpeed={watchSpeed} messages={messages} sending={sending} onCategoryChange={setSelectedCategory} onSearchChange={setScenarioSearch} onSelectScenario={(s) => { setSelectedScenario(s); setMessages([]); setScenarioRun(null); }} onRunScenario={runScenario} onPause={pauseScenario} onResume={resumeScenario} onStop={stopScenario} onWatchSpeedChange={(v) => { setWatchSpeed(v); watchSpeedRef.current = v; }} onClearMessages={handleClear} />
          </ErrorBoundary>
          <PlaygroundResultsTab runHistory={runHistory} onClearHistory={() => setRunHistory([])} />
          <ErrorBoundary section="Playground E2E">
            <PlaygroundE2eTab e2eNumber={e2eNumber} e2eRunning={e2eRunning} e2eResults={e2eResults} e2eCurrentScenario={e2eCurrentScenario} e2eLiveSteps={e2eLiveSteps} e2eSelectedScenario={e2eSelectedScenario} filteredScenarios={filteredScenarios} selectedAgent={selectedAgent} batchRunning={batchRunning} batchProgress={batchProgress} onNumberChange={setE2eNumber} onRunE2e={runE2eScenario} onRunAll={runAllE2e} onStopBatch={stopBatch} onSelectE2eScenario={(s) => { setE2eSelectedScenario(s); if (!e2eRunning) setE2eLiveSteps([]); }} onClearResults={() => setE2eResults([])} />
          </ErrorBoundary>
          <TabsContent value="history">
            <BatchHistoryTab agentId={selectedAgentId ?? null} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default AIAgentPlayground;
