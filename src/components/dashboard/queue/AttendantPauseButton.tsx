/**
 * Botão de pausar/reativar um atendente na aba "Atendentes" do /dashboard/fila.
 *
 * Espelha o toggle pessoal do helpdesk (QueuePauseToggle), mas é o GESTOR agindo
 * sobre outro atendente — via RPC role-gated e escopada por instância
 * (useSetAttendantPaused). Usa estado otimista: o rótulo/ícone vira na hora do
 * clique e reverte se a RPC falhar (sem flicker esperando o refetch).
 */
import { useEffect, useState } from 'react';
import { Pause, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSetAttendantPaused, type AttendantStat } from '@/hooks/useQueueDashboard';
import { toast } from 'sonner';

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object' && e && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (m) return String(m);
  }
  return 'Não consegui atualizar o status';
}

export default function AttendantPauseButton({
  stat,
  instanceId,
}: {
  stat: AttendantStat;
  instanceId: string | null;
}) {
  const setPaused = useSetAttendantPaused();
  // Estado otimista: enquanto a fonte (stat.queue_paused) não alcança, mostramos o
  // alvo do clique. Quando o refetch confirma (fonte == otimista), limpamos.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const paused = optimistic ?? stat.queue_paused;
  const firstName = stat.full_name.split(' ')[0] || 'Atendente';

  useEffect(() => {
    if (optimistic !== null && stat.queue_paused === optimistic) setOptimistic(null);
  }, [stat.queue_paused, optimistic]);

  const handleToggle = () => {
    if (!instanceId || setPaused.isPending) return;
    const next = !paused;
    setOptimistic(next);
    setPaused.mutate(
      { userId: stat.user_id, instanceId, paused: next },
      {
        onSuccess: () => toast.success(
          next
            ? `${firstName} foi pausado — a fila vai pular`
            : `${firstName} voltou para a fila`,
        ),
        onError: (e) => {
          setOptimistic(null); // reverte pro estado real
          toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={paused ? 'default' : 'outline'}
      className="ml-auto h-7 shrink-0 gap-1.5 px-2.5 text-xs"
      disabled={setPaused.isPending || !instanceId}
      onClick={handleToggle}
      aria-label={paused ? `Reativar ${firstName} na fila` : `Pausar ${firstName} na fila`}
      title={paused
        ? 'Reativar: a fila volta a atribuir handoffs a este atendente'
        : 'Pausar: a fila para de atribuir novos handoffs a este atendente'}
    >
      {setPaused.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      {paused ? 'Reativar' : 'Pausar'}
    </Button>
  );
}
