import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, X } from 'lucide-react';
import { useE2eApproval, type PendingRun } from '@/hooks/useE2eApproval';
import { ReviewDrawer } from './ReviewDrawer';

interface ApprovalQueueProps {
  agentId: string;
  userId: string;
  onClose: () => void;
}

export function ApprovalQueue({ agentId, userId, onClose }: ApprovalQueueProps) {
  const { pending, pendingCount, isLoading, approve, reject, isApproving, isRejecting } = useE2eApproval(agentId, userId);
  const [selectedRun, setSelectedRun] = useState<PendingRun | null>(null);

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Fila de Aprovação</h2>
          {pendingCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <p className="text-sm font-medium">Nenhum run pendente</p>
          <p className="text-xs text-muted-foreground">Todos os runs foram revisados</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {pending.map(run => (
              <Card key={run.id} className="border-border/50">
                <CardContent className="p-3">
                  {/* Row 1: name + category */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium flex-1 truncate">{run.scenario_name}</span>
                    {run.category && (
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {run.category}
                      </Badge>
                    )}
                  </div>

                  {/* Row 2: tools */}
                  {((run.tools_missing && run.tools_missing.length > 0) || (run.tools_used && run.tools_used.length > 0)) && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {run.tools_used?.map(t => (
                        <Badge key={t} variant="outline" className="text-[8px] px-1 border-emerald-500/40 text-emerald-400">
                          {t}
                        </Badge>
                      ))}
                      {run.tools_missing?.map(t => (
                        <Badge key={t} variant="destructive" className="text-[8px] px-1 opacity-80">
                          -{t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Row 3: date + latency + action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(run.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      {run.latency_ms && <span>{run.latency_ms}ms</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2"
                      onClick={() => setSelectedRun(run)}
                    >
                      Revisar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Review Drawer */}
      <ReviewDrawer
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
        onApprove={approve}
        onReject={reject}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    </div>
  );
}
