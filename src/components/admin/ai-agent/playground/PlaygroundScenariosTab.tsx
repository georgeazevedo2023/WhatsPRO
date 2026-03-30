import { useRef, useEffect } from 'react';
import {
  type ChatMessage, type TestScenario, type ScenarioRun, type ScenarioCategory, type WatchSpeed,
  CATEGORY_META, DIFFICULTY_COLORS, TOOL_META, TEST_SCENARIOS,
} from '@/types/playground';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Wrench, Layers, Eye, Shield, PhoneForwarded, Search,
  Play, Pause, Square, Check, X, CircleDot, ListChecks, Bot,
  MessageSquare, Mic, ChevronDown, User, Clock, Zap,
} from 'lucide-react';

export interface PlaygroundScenariosTabProps {
  filteredScenarios: TestScenario[];
  selectedCategory: ScenarioCategory | 'all';
  scenarioSearch: string;
  selectedScenario: TestScenario | null;
  scenarioRun: ScenarioRun | null;
  watchSpeed: WatchSpeed;
  messages: ChatMessage[];
  sending: boolean;
  onCategoryChange: (v: ScenarioCategory | 'all') => void;
  onSearchChange: (v: string) => void;
  onSelectScenario: (s: TestScenario) => void;
  onRunScenario: (s: TestScenario) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onWatchSpeedChange: (v: WatchSpeed) => void;
  onClearMessages: () => void;
}

export const PlaygroundScenariosTab = ({
  filteredScenarios, selectedCategory, scenarioSearch, selectedScenario, scenarioRun,
  watchSpeed, messages, sending,
  onCategoryChange, onSearchChange, onSelectScenario, onRunScenario,
  onPause, onResume, onStop, onWatchSpeedChange,
}: PlaygroundScenariosTabProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <TabsContent value="scenarios" className="flex-1 min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-3 flex-1 min-h-0">

        {/* Left: Gallery */}
        <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/50 space-y-2">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input value={scenarioSearch} onChange={e => onSearchChange(e.target.value)} placeholder="Buscar cenario..." className="h-8 text-xs pl-8" /></div>
            <Select value={selectedCategory} onValueChange={v => onCategoryChange(v as ScenarioCategory | 'all')}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {(Object.entries(CATEGORY_META) as [ScenarioCategory, typeof CATEGORY_META[ScenarioCategory]][]).map(([key, meta]) => {
                  const count = TEST_SCENARIOS.filter(s => s.category === key).length;
                  if (count === 0) return null;
                  const Icon = meta.icon;
                  return <SelectItem key={key} value={key}><span className="flex items-center gap-1.5"><Icon className="w-3 h-3" />{meta.label} ({count})</span></SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredScenarios.map(scenario => {
                const catMeta = CATEGORY_META[scenario.category];
                const isSelected = selectedScenario?.id === scenario.id;
                return (
                  <button key={scenario.id} onClick={() => onSelectScenario(scenario)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-primary/40 bg-primary/5 shadow-md' : 'border-border/30 hover:bg-accent/50 hover:border-border/60'}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl leading-none mt-0.5">{catMeta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-semibold truncate flex-1">{scenario.name}</span>
                          <Badge className={`text-[9px] px-1.5 py-0.5 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{scenario.difficulty}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{scenario.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{scenario.steps.length} steps</span>
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{scenario.expected.tools_must_use.length} tools</span>
                          {scenario.expected.should_handoff && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-red-500/20 text-red-400">handoff</Badge>}
                          {scenario.expected.should_block && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/20 text-amber-400">guardrail</Badge>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredScenarios.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum cenario encontrado</p>}
            </div>
          </ScrollArea>
        </div>

        {/* Center: Chat + Watch Controls */}
        <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden min-h-0">
          {/* Progress bar */}
          {scenarioRun && scenarioRun.status !== 'idle' && (
            <div className="px-3 pt-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground">Step {Math.min(scenarioRun.current_step + 1, scenarioRun.total_steps)}/{scenarioRun.total_steps}</span>
                <div className="flex-1"><Progress value={(scenarioRun.current_step / scenarioRun.total_steps) * 100} className="h-1.5" /></div>
                <Badge variant={scenarioRun.status === 'done' ? (scenarioRun.results?.pass ? 'default' : 'destructive') : 'secondary'} className="text-[9px] px-1.5">
                  {scenarioRun.status === 'done' ? (scenarioRun.results?.pass ? 'PASS' : 'FAIL') : scenarioRun.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}

          {!selectedScenario ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/10 flex items-center justify-center">
                <Layers className="w-10 h-10 text-violet-400/40" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">Selecione um cenario</p>
                <p className="text-sm">Escolha um cenario na galeria para executar o teste automatizado</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat area (read-only, no input bar) */}
              <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 opacity-20" />
                    <p className="text-sm">Execute o cenario para ver a conversa</p>
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
                                      <Icon className="w-3 h-3" />{meta.label}<ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-1">
                                      <div className="text-[10px] bg-background/80 rounded-lg p-2 border border-border/50 max-w-xs">
                                        <p className="font-mono font-semibold mb-0.5">{tc.name}()</p>
                                        {Object.entries(tc.args || {}).map(([k, v]) => (<p key={k} className="text-muted-foreground"><span className="text-foreground">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>))}
                                        {tc.result && <p className="mt-1 text-emerald-400 border-t border-border/30 pt-1">{tc.result}</p>}
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
                              {msg.media_type === 'audio' && (<div className="flex items-center gap-2 bg-primary rounded-2xl rounded-tr-md px-3 py-2"><Mic className="w-3.5 h-3.5 text-primary-foreground/70" /><span className="text-xs text-primary-foreground/80">Audio</span></div>)}
                              {msg.content && msg.media_type !== 'audio' && (<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-3.5 py-2"><p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p></div>)}
                              <div className="flex items-center gap-1.5 justify-end pr-0.5">
                                <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1"><User className="w-3 h-3 text-secondary-foreground" /></div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className="flex gap-2 justify-start">
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary" /></div>
                          <div className="max-w-[78%] space-y-0.5">
                            <div className="bg-muted/80 rounded-2xl rounded-tl-md px-3.5 py-2 border border-transparent">
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            <div className="flex items-center gap-1.5 pl-0.5">
                              <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.latency_ms != null && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2 h-2" />{msg.latency_ms}ms</span>}
                              {msg.tokens && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap className="w-2 h-2" />{msg.tokens.input + msg.tokens.output}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {sending && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary animate-pulse" /></div>
                        <div className="bg-muted/80 rounded-2xl rounded-tl-md px-4 py-3"><div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" /></div></div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              {/* Watch controls */}
              <div className="border-t border-border/50 p-2 flex items-center gap-2 flex-shrink-0">
                {!scenarioRun || scenarioRun.status === 'done' || scenarioRun.status === 'error' ? (
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => onRunScenario(selectedScenario)} disabled={sending}>
                    <Play className="w-3.5 h-3.5" /> Executar
                  </Button>
                ) : scenarioRun.status === 'paused' ? (
                  <>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onResume}><Play className="w-3.5 h-3.5" /> Continuar</Button>
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={onStop}><Square className="w-3.5 h-3.5" /> Parar</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onPause}><Pause className="w-3.5 h-3.5" /> Pausar</Button>
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={onStop}><Square className="w-3.5 h-3.5" /> Parar</Button>
                  </>
                )}
                <div className="flex-1" />
                <span className="text-[10px] text-muted-foreground">Velocidade:</span>
                <Select value={String(watchSpeed)} onValueChange={v => onWatchSpeedChange(Number(v) as WatchSpeed)}>
                  <SelectTrigger className="w-[70px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0.5, 1, 1.5, 2, 3].map(s => <SelectItem key={s} value={String(s)}>{s}x</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Right: Execution Panel */}
        <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {selectedScenario ? (
                <>
                  {/* Scenario info */}
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${CATEGORY_META[selectedScenario.category].gradient} border border-border/30`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-3xl">{CATEGORY_META[selectedScenario.category].emoji}</span>
                      <div className="flex-1">
                        <span className="text-sm font-bold block">{selectedScenario.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedScenario.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] px-2 py-0.5 ${DIFFICULTY_COLORS[selectedScenario.difficulty]}`}>{selectedScenario.difficulty}</Badge>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">{selectedScenario.steps.length} steps</Badge>
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><ListChecks className="w-3 h-3" />Steps</p>
                    <div className="space-y-1">
                      {selectedScenario.steps.map((step, i) => {
                        const isDone = scenarioRun && i < scenarioRun.current_step;
                        const isActive = scenarioRun && i === scenarioRun.current_step && scenarioRun.status === 'running';
                        return (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] border transition-all ${isActive ? 'border-primary/40 bg-primary/5 animate-pulse' : isDone ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-transparent'}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {isDone ? <Check className="w-2.5 h-2.5" /> : <span className="text-[8px]">{i + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{step.content}</p>
                              {step.media_type === 'audio' && <Badge variant="outline" className="text-[8px] px-1 mt-0.5">audio</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expected outcomes */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Eye className="w-3 h-3" />Esperado</p>
                    <div className="space-y-1 text-[11px]">
                      {selectedScenario.expected.tools_must_use.map(tool => {
                        const used = scenarioRun?.results?.tools_used.includes(tool);
                        const meta = TOOL_META[tool];
                        const Icon = meta?.icon || Wrench;
                        return (
                          <div key={tool} className="flex items-center gap-1.5">
                            {scenarioRun?.results ? (used ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                            <Icon className="w-3 h-3" /><span>{meta?.label || tool}</span>
                          </div>
                        );
                      })}
                      {selectedScenario.expected.should_handoff && (
                        <div className="flex items-center gap-1.5">
                          {scenarioRun?.results ? (scenarioRun.results.handoff_occurred ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                          <PhoneForwarded className="w-3 h-3" /><span>Handoff</span>
                        </div>
                      )}
                      {selectedScenario.expected.should_block && (
                        <div className="flex items-center gap-1.5">
                          {scenarioRun?.results ? (scenarioRun.results.blocked_occurred ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                          <Shield className="w-3 h-3" /><span>Bloqueio (guardrail)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {scenarioRun?.results && (
                    <div className="border-t border-border/50 pt-3">
                      <div className={`p-3 rounded-lg border ${scenarioRun.results.pass ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <p className={`text-sm font-bold ${scenarioRun.results.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scenarioRun.results.pass ? 'PASSOU' : 'FALHOU'}
                        </p>
                        <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                          <p>Tools usadas: {scenarioRun.results.tools_used.join(', ') || 'nenhuma'}</p>
                          {scenarioRun.results.tools_missing.length > 0 && <p className="text-red-400">Faltaram: {scenarioRun.results.tools_missing.join(', ')}</p>}
                          {scenarioRun.results.tools_unexpected.length > 0 && <p className="text-amber-400">Inesperadas: {scenarioRun.results.tools_unexpected.join(', ')}</p>}
                          <p>Tokens: {scenarioRun.results.total_tokens.input + scenarioRun.results.total_tokens.output}</p>
                          <p>Latencia: {scenarioRun.results.total_latency_ms}ms</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-8 h-8 text-primary/30" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Detalhes do cenario</p>
                  <p className="text-xs">Selecione um cenario na galeria</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </TabsContent>
  );
};
