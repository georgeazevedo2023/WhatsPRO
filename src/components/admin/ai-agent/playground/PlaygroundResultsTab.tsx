import { type ScenarioRun, CATEGORY_META, TOOL_META } from '@/types/playground';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, ChevronDown } from 'lucide-react';

export interface PlaygroundResultsTabProps {
  runHistory: ScenarioRun[];
  onClearHistory: () => void;
}

export const PlaygroundResultsTab = ({ runHistory, onClearHistory }: PlaygroundResultsTabProps) => {
  return (
    <TabsContent value="results" className="flex-1 min-h-0">
      <div className="border border-border/50 rounded-xl bg-card/50 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Summary stats */}
        {runHistory.length > 0 && (
          <div className="p-3 border-b border-border/50 flex items-center gap-4 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">{runHistory.length} runs</Badge>
            <Badge variant="outline" className="text-xs text-emerald-400">{runHistory.filter(r => r.results?.pass).length} passed</Badge>
            <Badge variant="outline" className="text-xs text-red-400">{runHistory.filter(r => r.results && !r.results.pass).length} failed</Badge>
            <div className="flex-1" />
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onClearHistory}>Limpar</Button>
          </div>
        )}
        <ScrollArea className="flex-1">
          {runHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-blue-400/40" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">Nenhum teste executado ainda</p>
                <p className="text-sm">Execute cenarios na aba "Cenarios" para ver resultados aqui</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {runHistory.map(run => {
                const catMeta = CATEGORY_META[run.category];
                const CatIcon = catMeta.icon;
                return (
                  <Collapsible key={run.id}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
                        <Badge className={`text-[9px] px-1.5 ${run.results?.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {run.results?.pass ? 'PASS' : 'FAIL'}
                        </Badge>
                        <CatIcon className={`w-3.5 h-3.5 ${catMeta.color.split(' ')[0]}`} />
                        <span className="text-xs font-medium flex-1 truncate">{run.scenario_name}</span>
                        <span className="text-[10px] text-muted-foreground">{run.results?.total_tokens ? `${run.results.total_tokens.input + run.results.total_tokens.output} tok` : ''}</span>
                        <span className="text-[10px] text-muted-foreground">{run.results?.total_latency_ms ? `${run.results.total_latency_ms}ms` : ''}</span>
                        <span className="text-[10px] text-muted-foreground">{run.started_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-1 p-3 rounded-lg border border-border/30 bg-muted/30 space-y-2 text-[11px]">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-muted-foreground">Tools usadas:</span> {run.results?.tools_used.join(', ') || 'nenhuma'}</div>
                          <div><span className="text-muted-foreground">Tools esperadas:</span> {run.results?.tools_expected.join(', ') || 'nenhuma'}</div>
                          {run.results?.tools_missing.length ? <div className="text-red-400">Faltaram: {run.results.tools_missing.join(', ')}</div> : null}
                          {run.results?.tools_unexpected.length ? <div className="text-amber-400">Inesperadas: {run.results.tools_unexpected.join(', ')}</div> : null}
                        </div>
                        <div className="text-muted-foreground">Handoff: {run.results?.handoff_occurred ? 'Sim' : 'Nao'} | Bloqueio: {run.results?.blocked_occurred ? 'Sim' : 'Nao'}</div>
                        <div className="text-muted-foreground">{run.messages.length} mensagens | {run.total_steps} steps</div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </TabsContent>
  );
};
