/**
 * D30 Sprint F — Toggle pessoal "Disponível ↔ Pausado" no header do Helpdesk.
 *
 * Comportamento global por user: clica → seta `queue_paused` em TODOS os
 * `department_members` rows do user (atendente pode estar em vários deptos,
 * mas a decisão "estou disponível" é uma só — almoço, reunião, etc).
 *
 * Estado lido como "Disponível" se ALGUM row está com `queue_paused=false`.
 * "Pausado" só quando TODOS estão pausados.
 *
 * Não mostra nada se o user não pertence a nenhum departamento (ex.: super_admin
 * sem caixa atribuída) — nesse caso a fila não se aplica.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type State = 'unknown' | 'available' | 'paused';

const QueuePauseToggle = () => {
  const { user } = useAuth();
  const [state, setState] = useState<State>('unknown');
  const [memberCount, setMemberCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchState = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('department_members')
      .select('queue_paused')
      .eq('user_id', user.id);
    if (!data) return;
    setMemberCount(data.length);
    if (data.length === 0) {
      setState('unknown');
      return;
    }
    const anyAvailable = data.some(d => !d.queue_paused);
    setState(anyAvailable ? 'available' : 'paused');
  }, [user?.id]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const handleToggle = useCallback(async () => {
    if (!user?.id || state === 'unknown') return;
    const nextPaused = state === 'available';
    setSaving(true);
    try {
      const { error } = await supabase
        .from('department_members')
        .update({
          queue_paused: nextPaused,
          queue_paused_reason: nextPaused ? 'Pausado pelo atendente no helpdesk' : null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      setState(nextPaused ? 'paused' : 'available');
      toast.success(nextPaused
        ? 'Você está pausado — a fila vai te pular'
        : 'Você está disponível para receber novos atendimentos',
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  }, [state, user?.id]);

  // Não pertence a nenhum dept — não mostra controle
  if (state === 'unknown' || memberCount === 0) return null;

  const isPaused = state === 'paused';

  return (
    <Button
      variant={isPaused ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={saving}
      className="gap-2 h-9"
      aria-label={isPaused ? 'Despausar e voltar para a fila' : 'Pausar e sair da fila'}
      title={isPaused
        ? 'Você está pausado — a fila não vai te atribuir novos handoffs'
        : 'Você está disponível — a fila pode te atribuir handoffs'}
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isPaused ? (
        <Play className="w-4 h-4" />
      ) : (
        <Pause className="w-4 h-4" />
      )}
      <span className="text-xs font-medium">{isPaused ? 'Pausado' : 'Disponível'}</span>
    </Button>
  );
};

export default QueuePauseToggle;
