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
      // R93: UPDATE direto era bloqueado pela RLS de department_members
      // (só super_admin pode UPDATE). Usamos RPC SECURITY DEFINER com escopo
      // limitado a queue_paused + queue_paused_reason.
      const { data, error } = await supabase.rpc('set_my_queue_paused', {
        _paused: nextPaused,
        _reason: nextPaused ? 'Pausado pelo atendente no helpdesk' : null,
      });
      if (error) throw error;
      const result = data as { rows_affected?: number; error?: string } | null;
      if (result?.error) throw new Error(result.error);
      if (!result?.rows_affected || result.rows_affected === 0) {
        throw new Error('Nenhum departamento atualizado — você ainda pertence a algum?');
      }
      setState(nextPaused ? 'paused' : 'available');
      toast.success(nextPaused
        ? 'Você está pausado — a fila vai te pular'
        : 'Você está disponível para receber novos atendimentos',
      );
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : (typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Erro ao atualizar status');
      toast.error(msg);
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
      <span className="text-xs font-medium">{isPaused ? 'Pausado' : 'Pausar'}</span>
    </Button>
  );
};

export default QueuePauseToggle;
