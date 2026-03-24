import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Clock, Pause, Play, Timer, StopCircle } from 'lucide-react';

export interface SendProgress {
  currentGroup: number;
  totalGroups: number;
  currentMember: number;
  totalMembers: number;
  groupName: string;
  status: 'idle' | 'sending' | 'paused' | 'success' | 'error' | 'cancelled';
  results: { groupName: string; success: boolean; error?: string }[];
  startedAt: number | null;
}

interface BroadcastProgressModalProps {
  progress: SendProgress;
  elapsedTime: number;
  remainingTime: number | null;
  excludeAdmins: boolean;
  activeTab: string;
  formatDuration: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const BroadcastProgressModal = ({
  progress,
  elapsedTime,
  remainingTime,
  excludeAdmins,
  activeTab,
  formatDuration,
  onPause,
  onResume,
  onCancel,
  onClose,
}: BroadcastProgressModalProps) => {
  if (progress.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {progress.status === 'sending' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {activeTab === 'media' ? 'Enviando mídia...' : 'Enviando mensagens...'}
              </>
            )}
            {progress.status === 'paused' && (
              <>
                <Pause className="w-5 h-5 text-warning" />
                Envio pausado
              </>
            )}
            {progress.status === 'success' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-success" />
                Envio concluído
              </>
            )}
            {progress.status === 'error' && (
              <>
                <XCircle className="w-5 h-5 text-destructive" />
                Erro no envio
              </>
            )}
            {progress.status === 'cancelled' && (
              <>
                <StopCircle className="w-5 h-5 text-muted-foreground" />
                Envio cancelado
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(progress.status === 'sending' || progress.status === 'paused') && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Grupo {progress.currentGroup} de {progress.totalGroups}</span>
                  <span className="text-muted-foreground truncate ml-2">{progress.groupName}</span>
                </div>
                <Progress value={(progress.currentGroup / progress.totalGroups) * 100} />
              </div>

              {excludeAdmins && progress.totalMembers > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Membros</span>
                    <span>{progress.currentMember} / {progress.totalMembers}</span>
                  </div>
                  <Progress 
                    value={(progress.currentMember / progress.totalMembers) * 100} 
                    className="h-1"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-sm border-t pt-3 mt-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>Decorrido: {formatDuration(elapsedTime)}</span>
                </div>
                {remainingTime !== null && remainingTime > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Restante: ~{formatDuration(remainingTime)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {progress.status === 'sending' ? (
                  <Button onClick={onPause} variant="outline" className="flex-1">
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar
                  </Button>
                ) : (
                  <Button onClick={onResume} className="flex-1">
                    <Play className="w-4 h-4 mr-2" />
                    Retomar
                  </Button>
                )}
                <Button onClick={onCancel} variant="destructive" className="flex-1">
                  <StopCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </>
          )}

          {!['sending', 'paused'].includes(progress.status) && progress.results.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {progress.results.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className="truncate">{result.groupName}</span>
                </div>
              ))}
            </div>
          )}

          {!['sending', 'paused'].includes(progress.status) && (
            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BroadcastProgressModal;
