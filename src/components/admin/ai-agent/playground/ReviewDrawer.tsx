import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle } from 'lucide-react';
import { type PendingRun } from '@/hooks/useE2eApproval';

interface E2eStepResult {
  step?: number;
  input: string;
  agent_response?: string;
  tools_used?: string[];
  latency_ms?: number;
  pass?: boolean;
}

interface ReviewDrawerProps {
  run: PendingRun | null;
  onClose: () => void;
  onApprove: (runId: string, notes: string) => Promise<void>;
  onReject: (runId: string, notes: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
}

export function ReviewDrawer({
  run, onClose, onApprove, onReject, isApproving, isRejecting,
}: ReviewDrawerProps) {
  const [notes, setNotes] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    setNotes('');
    setExpandedSteps(new Set());
  }, [run?.id]);

  const steps = Array.isArray(run?.results) ? (run.results as E2eStepResult[]) : [];

  const handleApprove = async () => {
    if (!run) return;
    await onApprove(run.id, notes);
    onClose();
  };

  const handleReject = async () => {
    if (!run) return;
    await onReject(run.id, notes);
    onClose();
  };

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <Sheet open={!!run} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] flex flex-col p-0">
        <SheetHeader className="p-4 pb-0 flex-shrink-0">
          <SheetTitle className="text-base truncate">{run?.scenario_name ?? ''}</SheetTitle>
          <SheetDescription className="text-xs">
            {run?.category} · {run ? new Date(run.created_at).toLocaleDateString('pt-BR') : ''} · batch {run?.batch_id?.substring(0, 8) ?? '—'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">

            {/* Resultado */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Resultado</p>
              <div className="flex items-center gap-3">
                <Badge className={run?.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                  {run?.passed ? 'PASSOU' : 'FALHOU'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {run?.latency_ms ?? 0}ms · {run?.total_steps ?? 0} steps
                </span>
              </div>
            </div>

            <Separator />

            {/* Tools */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tools</p>
              {(run?.tools_used?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Usadas:</span>
                  {run?.tools_used?.map(t => (
                    <Badge key={t} variant="outline" className="text-[8px] px-1 border-blue-500/40 text-blue-400">{t}</Badge>
                  ))}
                </div>
              )}
              {(run?.tools_missing?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground mr-1">Faltando:</span>
                  {run?.tools_missing?.map(t => (
                    <Badge key={t} variant="destructive" className="text-[8px] px-1">{t}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-400">Nenhuma tool faltando</p>
              )}
            </div>

            {/* Erro */}
            {run?.error && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Erro</p>
                  <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-auto whitespace-pre-wrap break-all">
                    {run.error}
                  </pre>
                </div>
              </>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Steps ({steps.length})
                  </p>
                  <div className="space-y-1.5">
                    {steps.map((step, i) => {
                      const expanded = expandedSteps.has(i);
                      const response = step.agent_response ?? '';
                      const truncated = response.length > 200 ? response.substring(0, 200) + '...' : response;
                      return (
                        <div key={i} className="border border-border/40 rounded-lg p-2.5 text-xs">
                          <button
                            className="w-full text-left flex items-center gap-2"
                            onClick={() => toggleStep(i)}
                          >
                            <span className="font-medium text-muted-foreground">Step {step.step ?? i + 1}</span>
                            <span className="flex-1 truncate">{step.input}</span>
                            {step.latency_ms && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{step.latency_ms}ms</span>
                            )}
                          </button>
                          {expanded && (
                            <div className="mt-2 space-y-1.5 border-t border-border/30 pt-2">
                              {response && (
                                <div>
                                  <span className="text-primary font-medium">Agente: </span>
                                  <span className="text-muted-foreground">{expanded ? response : truncated}</span>
                                </div>
                              )}
                              {(step.tools_used?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {step.tools_used?.map(t => (
                                    <Badge key={t} variant="outline" className="text-[8px] px-1">{t}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Notas */}
            <Separator />
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                Notas de revisão
              </label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Descreva o que foi analisado..."
                className="text-xs resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Explique se é falso positivo, bug no cenário, ou regressão real
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-border/50 flex-shrink-0">
          <Button
            variant="destructive"
            className="flex-1 gap-1.5"
            disabled={isRejecting || isApproving}
            onClick={handleReject}
          >
            <XCircle className="w-4 h-4" />
            Rejeitar — Regressão Real
          </Button>
          <Button
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            disabled={isApproving || isRejecting}
            onClick={handleApprove}
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar — Falso Positivo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
