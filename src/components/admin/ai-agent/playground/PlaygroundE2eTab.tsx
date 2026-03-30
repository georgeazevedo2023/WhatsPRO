import {
  type TestScenario, type AIAgent,
  CATEGORY_META, DIFFICULTY_COLORS, TEST_SCENARIOS,
} from '@/types/playground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { Bot, Loader2, Zap } from 'lucide-react';

export interface PlaygroundE2eTabProps {
  e2eNumber: string;
  e2eRunning: boolean;
  e2eResults: any[];
  e2eCurrentScenario: string | null;
  e2eLiveSteps: any[];
  e2eSelectedScenario: TestScenario | null;
  filteredScenarios: TestScenario[];
  selectedAgent: AIAgent | undefined;
  onNumberChange: (v: string) => void;
  onRunE2e: (scenario: TestScenario) => void;
  onSelectE2eScenario: (scenario: TestScenario) => void;
  onClearResults: () => void;
}

export const PlaygroundE2eTab = ({
  e2eNumber, e2eRunning, e2eResults, e2eCurrentScenario, e2eLiveSteps,
  e2eSelectedScenario, selectedAgent,
  onNumberChange, onRunE2e, onSelectE2eScenario, onClearResults,
}: PlaygroundE2eTabProps) => {
  return (
    <TabsContent value="e2e" className="flex-1 min-h-0">
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
        {e2eResults.length > 0 && (
          <>
            <div className="flex-1" />
            <Badge variant="secondary" className="text-xs">{e2eResults.length} runs</Badge>
            <Badge variant="outline" className="text-xs text-emerald-400">{e2eResults.filter(r => r.pass).length} pass</Badge>
            <Badge variant="outline" className="text-xs text-red-400">{e2eResults.filter(r => !r.pass).length} fail</Badge>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onClearResults}>Limpar</Button>
          </>
        )}
      </div>

      {/* 2-column layout: scenarios (left) + live execution (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-3 flex-1 min-h-0">

        {/* Left: Scenario gallery */}
        <div className="border border-border/50 rounded-xl bg-card/50 overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {(Object.entries(CATEGORY_META) as [any, typeof CATEGORY_META[keyof typeof CATEGORY_META]][]).map(([catKey, catMeta]) => {
                const catScenarios = TEST_SCENARIOS.filter(s => s.category === catKey);
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
                  {e2eRunning && e2eCurrentScenario === e2eSelectedScenario.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Executando...</> : <><Zap className="w-3.5 h-3.5" />Executar E2E Real</>}
                </Button>
              </div>

              {/* Live steps */}
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {e2eLiveSteps.length > 0 ? e2eLiveSteps.map((step: any, i: number) => (
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
    </TabsContent>
  );
};
