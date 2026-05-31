/**
 * Hooks do Dashboard de Fila do Gestor (v7.57.x, 2026-05-28).
 *
 * Consome 3 RPCs:
 *  - get_queue_live_status     → header: na fila + disponíveis + pausados + tempo médio
 *  - get_queue_attendant_stats → cards por atendente no período
 *  - get_queue_lost_leads      → drill-down de leads perdidos por atendente
 *
 * Realtime: useQueueLive escuta o broadcast `queue-update` (D30 Sprint F) pra atualizar
 * o header em tempo real. Stats do período usam polling (refetchInterval 30s) — mudança
 * lenta o suficiente, e refresh agressivo confunde gestor com números mexendo direto.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { broadcastAssignedAgent, broadcastQueueUpdate } from '@/lib/helpdeskBroadcast';

export type QueuePeriod = 'today' | 'yesterday' | 'last7' | 'last15' | 'last30';

export interface QueuePeriodRange {
  from: Date;
  to: Date;
  label: string;
}

/**
 * Converte o chip de período num range (from→to). Hoje = das 00:00 ao agora.
 */
export function resolveQueuePeriod(period: QueuePeriod): QueuePeriodRange {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const labels: Record<QueuePeriod, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    last7: '7 dias',
    last15: '15 dias',
    last30: '30 dias',
  };
  switch (period) {
    case 'today':
      return { from: startOfToday, to: now, label: labels.today };
    case 'yesterday': {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      return { from: startOfYesterday, to: startOfToday, label: labels.yesterday };
    }
    case 'last7': {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 7);
      return { from, to: now, label: labels.last7 };
    }
    case 'last15': {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 15);
      return { from, to: now, label: labels.last15 };
    }
    case 'last30': {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 30);
      return { from, to: now, label: labels.last30 };
    }
  }
}

export interface QueueLiveStatus {
  active_count: number;
  available_count: number;
  paused_count: number;
  avg_wait_seconds: number;
}

export interface AttendantStat {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  queue_paused: boolean;
  queue_position: number;
  received: number;
  responded: number;
  timed_out: number;
  manual_override: number;
  cancelled: number;
  active: number;
  avg_response_seconds: number;
}

export interface LostLead {
  conversation_id: string;
  contact_name: string;
  contact_phone: string | null;
  status: string;
  lost_reason: string;
  next_assignee_name: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface UnattendedLead {
  conversation_id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_avatar_url: string | null;
  inbox_id: string;
  department_id: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_avatar_url: string | null;
  assigned_at: string;
  last_message: string | null;
  last_message_at: string | null;
  seconds_waiting: number;
  queue_event_active: boolean;
}

/** Janela de recência do "sem atendimento" (limita a leads acionáveis). */
export type UnattendedWindow = 24 | 72 | 168 | 0; // 24h, 3d, 7d, tudo

/**
 * Header live (na fila / disponíveis / pausados / tempo de espera).
 * Realtime broadcast queue-update + polling 10s de fallback.
 */
export function useQueueLive(instanceId: string | null) {
  const query = useQuery({
    queryKey: ['queue-live', instanceId],
    enabled: !!instanceId,
    refetchInterval: 10000, // fallback caso realtime caia
    queryFn: async (): Promise<QueueLiveStatus> => {
      if (!instanceId) throw new Error('instanceId required');
      const { data, error } = await supabase.rpc('get_queue_live_status', { p_instance_id: instanceId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        active_count: Number(row?.active_count || 0),
        available_count: Number(row?.available_count || 0),
        paused_count: Number(row?.paused_count || 0),
        avg_wait_seconds: Number(row?.avg_wait_seconds || 0),
      };
    },
  });

  // Realtime: re-fetch quando o backend manda queue-update (D30 Sprint F).
  useEffect(() => {
    if (!instanceId) return;
    const channel = supabase
      .channel(`queue-live-${instanceId}`)
      .on('broadcast', { event: 'queue-update' }, () => query.refetch())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [instanceId, query]);

  return query;
}

/**
 * Stats por atendente no período. Polling 30s (mudança lenta).
 */
export function useQueueStats(instanceId: string | null, period: QueuePeriod) {
  const range = resolveQueuePeriod(period);
  return useQuery({
    queryKey: ['queue-stats', instanceId, period],
    enabled: !!instanceId,
    refetchInterval: 30000,
    queryFn: async (): Promise<AttendantStat[]> => {
      if (!instanceId) throw new Error('instanceId required');
      const { data, error } = await supabase.rpc('get_queue_attendant_stats', {
        p_instance_id: instanceId,
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
      });
      if (error) throw error;
      return (data || []) as AttendantStat[];
    },
  });
}

/**
 * Drill-down: leads que o atendente perdeu no período. Carregado on-demand quando o
 * gestor abre o drawer de um card específico.
 */
export function useQueueLostLeads(
  instanceId: string | null,
  userId: string | null,
  period: QueuePeriod,
  enabled: boolean,
) {
  const range = resolveQueuePeriod(period);
  return useQuery({
    queryKey: ['queue-lost-leads', instanceId, userId, period],
    enabled: enabled && !!instanceId && !!userId,
    queryFn: async (): Promise<LostLead[]> => {
      if (!instanceId || !userId) throw new Error('instanceId+userId required');
      const { data, error } = await supabase.rpc('get_queue_lost_leads', {
        p_instance_id: instanceId,
        p_user_id: userId,
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
      });
      if (error) throw error;
      return (data || []) as LostLead[];
    },
  });
}

/**
 * Leads que a IA transbordou (status_ia='shadow') e o atendente atribuído ainda
 * NÃO respondeu. `maxAgeHours` limita a recência (0 = tudo). Realtime: refetch em
 * queue-update (cron/reassign) + new-message/assigned-agent (helpdesk) + poll 15s.
 */
export function useUnattendedLeads(
  instanceId: string | null,
  maxAgeHours: UnattendedWindow = 72,
  minMinutesWaiting = 3,
) {
  const query = useQuery({
    queryKey: ['unattended-leads', instanceId, maxAgeHours, minMinutesWaiting],
    enabled: !!instanceId,
    refetchInterval: 15000,
    queryFn: async (): Promise<UnattendedLead[]> => {
      if (!instanceId) throw new Error('instanceId required');
      const { data, error } = await supabase.rpc(
        'get_unattended_handoff_leads' as never,
        {
          p_instance_id: instanceId,
          p_min_minutes_waiting: minMinutesWaiting,
          p_max_age_hours: maxAgeHours,
        } as never,
      );
      if (error) throw error;
      return (data || []) as UnattendedLead[];
    },
  });

  useEffect(() => {
    if (!instanceId) return;
    const live = supabase
      .channel(`queue-live-${instanceId}`)
      .on('broadcast', { event: 'queue-update' }, () => query.refetch())
      .subscribe();
    const helpdesk = supabase
      .channel('helpdesk-conversations')
      .on('broadcast', { event: 'new-message' }, () => query.refetch())
      .on('broadcast', { event: 'assigned-agent' }, () => query.refetch())
      .subscribe();
    return () => {
      void supabase.removeChannel(live);
      void supabase.removeChannel(helpdesk);
    };
  }, [instanceId, query]);

  return query;
}

/**
 * Reatribui uma conversa a outro atendente via RPC role-gated (super_admin||gerente),
 * mantendo a fila coerente (evento ativo → manual_override). Espelha o assignAgent do
 * helpdesk, mas server-side. Após sucesso, sincroniza helpdesk (assigned-agent +
 * queue-update) e invalida as queries do dashboard.
 */
export function useReassignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      assigneeId,
    }: {
      conversationId: string;
      assigneeId: string;
    }): Promise<{ assigneeName: string }> => {
      const { data, error } = await supabase.rpc(
        'manager_reassign_conversation' as never,
        { p_conversation_id: conversationId, p_assignee_id: assigneeId } as never,
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const assigneeName = (row as { assignee_name?: string } | null)?.assignee_name ?? 'atendente';
      await broadcastAssignedAgent(conversationId, assigneeId);
      await broadcastQueueUpdate(conversationId);
      return { assigneeName };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unattended-leads'] });
      void qc.invalidateQueries({ queryKey: ['queue-stats'] });
      void qc.invalidateQueries({ queryKey: ['queue-live'] });
    },
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

/**
 * Tempo de espera (card "esperando há"). A partir de 24h acrescenta o equivalente em
 * dias pro gestor sacar de cara a gravidade — ex.: "31h 59m · 1 dia", "55h · 2 dias".
 */
export function formatWaiting(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const base = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  if (h < 24) return base;
  const days = Math.floor(h / 24);
  return `${base} · ${days} dia${days > 1 ? 's' : ''}`;
}
