import {
  type TestScenario, type AIAgent, type E2eLiveStep, type E2eRunResult, type ScenarioCategory,
  CATEGORY_META, DIFFICULTY_COLORS, TEST_SCENARIOS,
} from '@/types/playground';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Bot, Loader2, Zap, PlayCircle, StopCircle, Clock, Search, RefreshCw } from 'lucide-react';
import { ApprovalQueue } from './ApprovalQueue';
import { E2eSchedulePanel } from './E2eSchedulePanel';
import { BatchHistoryPanel } from './BatchHistoryPanel';

export interface PlaygroundE2eTabProps {
  e2eNumber: string;
  e2eRunning: boolean;
  e2eResults: E2eRunResult[];
  e2eCurrentScenario: string | null;
  e2eLiveSteps: E2eLiveStep[];
  e2eSelectedScenario: TestScenario | null;
  filteredScenarios: TestScenario[];
  selectedAgent: AIAgent | undefined;
  batchRunning: boolean;
  batchProgress: { current: number; total: number };
  onNumberChange: (v: string) => void;
  onRunE2e: (scenario: TestScenario) => void;
  onRunAll: () => void;
  onStopBatch: () => void;
  onSelectE2eScenario: (scenario: TestScenario) => void;
  onClearResults: () => void;
  pendingCount: number;
  showApprovalQueue: boolean;
  onToggleApprovalQueue: () => void;
  agentId: string | null;
  userId: string | undefined;
  onRetestBatch: (batchUuid: string, batchIdText: string) => void;
  selectedAgentId: string | null;
}

export const PlaygroundE2eTab = ({
  e2eNumber, e2eRunning, e2eResults, e2eCurrentScenario, e2eLiveSteps,
  e2eSelectedScenario, filteredScenarios, selectedAgent,
  onNumberChange, onRunE2e, onRunAll, onStopBatch, onSelectE2eScenario, onClearResults,
  batchRunning, batchProgress,
  pendingCount, showApprovalQueue, onToggleApprovalQueue, agentId, userId,
  onRetestBatch, selectedAgentId,
}: PlaygroundE2eTabProps) => {
  const [e2eSubTab, setE2eSubTab] = useState<'run' | 'history'>('run');
  const [searchE2e, setSearchE2e] = useState('');
  const [categoryE2e, setCategoryE2e] = useState<ScenarioCategory | 'all'>('all');

  const batchPct = batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0;
  const passCount = e2eResults.filter(r => r.pass).length;
  const failCount = e2eResults.filter(r => !r.pass).length;

  // F5-A: local filter sobre TEST_SCENARIOS
  const displayScenarios = TEST_SCENARIOS.filter(s => {
    const q = searchE2e.toLowerCase();
    const matchSearch = q === '' || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    const matchCategory = categoryE2e === 'all' || s.category === categoryE2e;
    return matchSearch && matchCategory;
  });

  const presentCategories = (Object.keys(CATEGORY_META) as ScenarioCategory[]).filter(cat =>
    TEST_SCENARIOS.some(s => s.category === cat),
  );

  // F5-C: score por categoria
  const resultsByCategory = (Object.keys(CATEGORY_META) as ScenarioCategory[]).reduce<Record<string, { pass: number; total: number }>>((acc, cat) => {
    const catResults = e2eResults.filter(r => TEST_SCENARIOS.find(s => s.id === r.scenario_id)?.category === cat);
    if (catResults.length > 0) acc[cat] = { pass: catResults.filter(r => r.pass).length, total: catResults.length };
    return acc;
  }, {});
  return (
    <TabsContent value="e2e" className="flex-1 min-h-0">
      <div className="relative flex flex-col h-full">
        {/* Overlay de aprovação */}
        {showApprovalQueue && agentId && userId && (
          <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm rounded-lg">
            <ApprovalQueue
              agentId={agentId}
              userId={userId}
              onClose={onToggleApprovalQueue}
            />
          </div>
        )}
        {/* Schedule panel — sempre visível */}
        <E2eSchedulePanel />
        {/* Navegação sub-tabs */}
        <div className="flex gap-1 mb-2">
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${e2eSubTab === 'run' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setE2eSubTab('run')}
          >
            Executar
          </button>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${e2eSubTab === 'history' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setE2eSubTab('history')}
          >
            Histórico
          </button>
        </div>
        {/* Histórico de batches */}
        {e2eSubTab === 'history' && (
          <BatchHistoryPanel agentId={selectedAgentId} onRetestBatch={onRetestBatch} />
        )}
        {e2eSubTab === 'run' && (
          <>
            {/* Config bar */}
            <div className="flex items-center gap-3 flex-wrap mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Numero:</span>
              <Input value={e2eNumber} onChange={e => onNumberChange(e.target.value)} className="w-[170px] h-8 text-sm font-mono" placeholder="5581999999999" />
            </div>
            <Badge variant="outline" className="text-xs gap-1"><Bot className="w-3 h-3" />{selectedAgent?.name}</Badge>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[11px]">Mensagens REAIS via WhatsApp + Gemini</span>
            </div>
            <div className="flex-1" />
            {pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={onToggleApprovalQueue}
              >
                <Clock className="w-3.5 h-3.5" />
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </Button>
            )}
            {batchRunning ? (
              <Button size="sm" variant="destructive" className="text-xs h-7 gap-1.5" onClick={onStopBatch}>
                <StopCircle className="w-3.5 h-3.5" />Parar Batch
              </Button>
            ) : (
              <Button size="sm" variant="default" className="text-xs h-7 gap-1.5" onClick={onRunAll} disabled={e2eRunning}>
                <PlayCircle className="w-3.5 h-3.5" />Rodar Todos ({displayScenarios.length})
              </Button>
            )}
            {e2eResults.length > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">{e2eResults.length} runs</Badge>
                <Badge variant="outline" className="text-xs text-emerald-400">{passCount} pass</Badge>
                <Badge variant="outline" className="text-xs text-red-400">{failCount} fail</Badge>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={onClearResults}>Limpar</Button>
              </>
            )}
          </div>

          {/* Batch progress bar */}
          {batchRunning && (
            <div className="mb-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Batch: {batchProgress.current}/{batchProgress.total} cenarios</span>
                <span className="font-mono">{batchPct}%</span>
              </div>
              <Progress value={batchPct} className="h-2" />
            </div>
          )}

          {/* F5-C: scorecard por categoria */}
          {e2eResults.length > 0 && Object.keys(resultsByCategory).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {(Object.entries(resultsByCategory) as [ScenarioCategory, { pass: number; total: number }][]).map(([cat, { pass, total }]) => {
                const meta = CATEGORY_META[cat];
                const pct = Math.round((pass / total) * 100);
                return (
                  <div key={cat} title={`${meta.label}: ${pass}/${total}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border cursor-default select-none ${pct >= 80 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : pct >= 60 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                    <span>{meta.emoji}</span><span>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2-column layout: scenarios (left) + live execution (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-3 flex-1 min-h-0">

            {/* Left: Scenario gallery */}
            <div className="border border-border/50 rounded-xl bg-card/50 overflow-hidden flex flex-col min-h-0">
              {/* F5-A: filter bar */}
              <div className="p-2 border-b border-border/30 flex flex-col gap-1.5 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input value={searchE2e} onChange={e => setSearchE2e(e.target.value)} className="pl-6 h-7 text-xs" placeholder="Buscar cenário..." />
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setCategoryE2e('all')} className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${categoryE2e === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/40 hover:bg-accent/50'}`}>Todos ({TEST_SCENARIOS.length})</button>
                  {presentCategories.map(cat => (
                    <button key={cat} onClick={() => setCategoryE2e(cat)} className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${categoryE2e === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border/40 hover:bg-accent/50'}`}>
                      {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                    </button>
                  ))}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                  {displayScenarios.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhum cenário encontrado.</p>
                  )}
                  {(Object.entries(CATEGORY_META) as [ScenarioCategory, typeof CATEGORY_META[ScenarioCategory]][]).map(([catKey, catMeta]) => {
                    const catScenarios = displayScenarios.filter(s => s.category === catKey);
                    if (catScenarios.length === 0) return null;
                    return (
                      <div key={catKey}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{catMeta.emoji}</span>
                          <span className="text-sm font-semibold">{catMeta.label}</span>
                          <Badge variant="outline" className="text-[9px]">{catScenarios.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {catScenarios.map(scenario => {
                            const isRunning = e2eCurrentScenario === scenario.id;
                            const result = e2eResults.find(r => r.scenario_id === scenario.id);
                            return (
                              <button key={scenario.id} onClick={() => { onSelectE2eScenario(scenario); }}
                                className={`w-full text-left p-2.5 rounded-lg border transition-all ${isRunning ? 'border-amber-500/50 bg-amber-500/5 animate-pulse' : e2eSelectedScenario?.id === scenario.id ? 'border-primary/40 bg-primary/5' : result ? (result.pass ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5') : 'border-border/30 hover:bg-accent/50'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium flex-1 truncate">{scenario.name}</span>
                                  {result && <Badge className={`text-[8px] px-1 ${result.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{result.pass ? 'PASS' : 'FAIL'}</Badge>}
                                  {result && (
                                    <button
                                      onClick={e => { e.stopPropagation(); onRunE2e(scenario); }}
                                      disabled={e2eRunning}
                                      title="Re-executar"
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </button>
                                  )}
                                  <Badge className={`text-[8px] px-1 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{scenario.difficulty}</Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{scenario.steps.length} steps · {scenario.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right: Live execution panel */}
            <div className="border border-border/50 rounded-xl bg-card/50 overflow-hidden flex flex-col min-h-0">
              {e2eSelectedScenario ? (
                <>
                  {/* Scenario header */}
                  <div className={`p-3 border-b border-border/50 flex-shrink-0 bg-gradient-to-r ${CATEGORY_META[e2eSelectedScenario.category].gradient}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{CATEGORY_META[e2eSelectedScenario.category].emoji}</span>
                      <span className="text-sm font-bold flex-1">{e2eSelectedScenario.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{e2eSelectedScenario.description}</p>
                    <Button size="sm" className="gap-1.5 w-full" disabled={e2eRunning} onClick={() => onRunE2e(e2eSelectedScenario)}>
                      {e2eRunning && e2eCurrentScenario === e2eSelectedScenario.id
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Executando...</>
                        : e2eLiveSteps.length > 0
                          ? <><RefreshCw className="w-3.5 h-3.5" />Re-executar</>
                          : <><Zap className="w-3.5 h-3.5" />Executar E2E Real</>}
                    </Button>
                  </div>

                  {/* Live steps */}
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {e2eLiveSteps.length > 0 ? e2eLiveSteps.map((step, i) => (
                        <div key={i} className={`p-3 rounded-lg border transition-all ${step.status === 'sending' ? 'border-amber-500/40 bg-amber-500/5 animate-pulse' : step.status === 'done' ? 'border-border/30 bg-card' : step.status === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-border/20 bg-muted/20 opacity-50'}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : step.status === 'sending' ? 'bg-amber-500/20 text-amber-400' : step.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                              {step.status === 'done' ? '✓' : step.status === 'sending' ? '⋯' : step.status === 'error' ? '✗' : i + 1}
                            </div>
                            <span className="text-xs font-medium">Step {step.step || i + 1}</span>
                            {step.latency_ms > 0 && <span className="text-[10px] text-muted-foreground">{step.latency_ms}ms</span>}
                            {step.tools_used?.length > 0 && step.tools_used.map((t: string) => <Badge key={t} variant="outline" className="text-[8px] px-1">{t}</Badge>)}
                          </div>
                          <div className="space-y-1 text-[13px]">
                            <p><span className="text-emerald-400 font-medium">Lead:</span> {step.input}</p>
                            {step.agent_response && <p><span className="text-primary font-medium">Agente:</span> {step.agent_response}</p>}
                            {step.status === 'sending' && <p className="text-amber-400 text-xs animate-pulse">Enviando via WhatsApp...</p>}
                          </div>
                          {step.tags?.length > 0 && <div className="flex gap-1 mt-1.5 flex-wrap">{step.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}</div>}
                        </div>
                      )) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">Steps do cenario:</p>
                          {e2eSelectedScenario.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-border/20 bg-muted/10">
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</div>
                              <div>
                                <p className="text-sm">{step.content}</p>
                                {step.media_type === 'audio' && <Badge variant="outline" className="text-[8px] mt-0.5">audio</Badge>}
                              </div>
                            </div>
                          ))}
                          <div className="mt-2 text-xs text-muted-foreground">
                            <p>Tools esperadas: {e2eSelectedScenario.expected.tools_must_use.join(', ') || 'nenhuma'}</p>
                            {e2eSelectedScenario.expected.should_handoff && <p className="text-pink-400">Handoff esperado</p>}
                            {e2eSelectedScenario.expected.should_block && <p className="text-red-400">Bloqueio esperado (guardrail)</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-amber-400/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Selecione um cenario</p>
                  <p className="text-xs text-center">Clique em um cenario na galeria para ver os steps e executar o teste E2E real</p>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </TabsContent>
  );
};
