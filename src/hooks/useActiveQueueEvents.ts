/**
 * D30 Sprint F — Hook que mantém em memória todos os `handoff_queue_events`
 * com `status='active'` para alimentar a badge "Em fila — Lucas (3:42)" no
 * helpdesk.
 *
 * Revalidação em 3 camadas (defense in depth — broadcast HTTP do cron é
 * fire-and-forget e falhava silenciosamente, deixando UI stale após rotação):
 *   1. postgres_changes em handoff_queue_events — entrega direta via WebSocket
 *      sob RLS. Catch-all para INSERT/UPDATE/DELETE (cron, assign-handoff, UI).
 *   2. Broadcast queue-update (legacy) — best-effort, mantido para resposta
 *      imediata quando o broadcast chega antes do replication slot.
 *   3. Poll de segurança — quando algum evento ativo passou de `expires_at`,
 *      agenda refetch em 3s até estabilizar. Bounded: zero polling em estado
 *      saudável.
 *
 * Tick interno de 1s só para o countdown visual. Quando `paused_at` está setado
 * (horário fechado), countdown some — exibe nome + ícone de pausa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QueueEventInfo {
  event_id: string;
  conversation_id: string;
  assigned_user_id: string | null;
  /** Primeiro nome (ou prefixo do user_id) para badge compacta. */
  assignee_name: string | null;
  expires_at: string;
  paused_at: string | null;
  status: string;
  rotation_number: number;
}

interface QueueEventRow {
  id: string;
  conversation_id: string;
  assigned_user_id: string | null;
  expires_at: string;
  paused_at: string | null;
  status: string;
  rotation_number: number;
}

const firstName = (full: string | null | undefined, fallback: string) => {
  const trimmed = (full || '').trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0];
};

export function useActiveQueueEvents() {
  const [events, setEvents] = useState<Map<string, QueueEventInfo>>(() => new Map());
  const [now, setNow] = useState(() => Date.now());
  const isMountedRef = useRef(true);

  // Tick para countdown (1s)
  useEffect(() => {
    const t = setInterval(() => {
      if (isMountedRef.current) setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('handoff_queue_events')
        .select('id, conversation_id, assigned_user_id, expires_at, paused_at, status, rotation_number')
        .eq('status', 'active');
      if (!isMountedRef.current) return;
      const events = (rows || []) as QueueEventRow[];
      if (events.length === 0) {
        setEvents(new Map());
        return;
      }
      const userIds = Array.from(
        new Set(events.map(e => e.assigned_user_id).filter((id): id is string => !!id)),
      );
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);
        nameMap = new Map(
          (profiles || []).map(p => [p.id, firstName(p.full_name, p.id.slice(0, 8))]),
        );
      }
      if (!isMountedRef.current) return;
      const map = new Map<string, QueueEventInfo>();
      for (const ev of events) {
        map.set(ev.conversation_id, {
          event_id: ev.id,
          conversation_id: ev.conversation_id,
          assigned_user_id: ev.assigned_user_id,
          assignee_name: ev.assigned_user_id ? nameMap.get(ev.assigned_user_id) ?? null : null,
          expires_at: ev.expires_at,
          paused_at: ev.paused_at,
          status: ev.status,
          rotation_number: ev.rotation_number,
        });
      }
      setEvents(map);
    } catch {
      /* fila é decoração — falha silente */
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchAll();
    return () => { isMountedRef.current = false; };
  }, [fetchAll]);

  // Camadas 1 e 2: postgres_changes (canônico) + broadcast queue-update (legacy).
  useEffect(() => {
    const channel = supabase
      .channel('queue-events-watch')
      .on('broadcast', { event: 'queue-update' }, () => { fetchAll(); })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handoff_queue_events' },
        () => { fetchAll(); },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // Camada 3: poll de segurança quando algum evento ativo passou de expires_at.
  // O cron roda a cada 1min — sem isso, UI fica até 60s exibindo "0:00" do
  // assignee anterior antes do postgres_changes da rotação chegar.
  useEffect(() => {
    let anyExpired = false;
    for (const ev of events.values()) {
      if (ev.paused_at) continue;
      if (new Date(ev.expires_at).getTime() <= now) { anyExpired = true; break; }
    }
    if (!anyExpired) return;
    const t = setTimeout(() => {
      if (isMountedRef.current) fetchAll();
    }, 3000);
    return () => clearTimeout(t);
  }, [events, now, fetchAll]);

  /**
   * Segundos restantes até `expires_at`. Retorna `null` quando:
   *   - não há evento ativo para essa conversa;
   *   - o evento está pausado (horário não-comercial — o relógio congela).
   */
  const secondsRemaining = useCallback((conversationId: string): number | null => {
    const ev = events.get(conversationId);
    if (!ev) return null;
    if (ev.paused_at) return null;
    const expiresMs = new Date(ev.expires_at).getTime();
    return Math.max(0, Math.floor((expiresMs - now) / 1000));
  }, [events, now]);

  return { events, secondsRemaining, refetch: fetchAll };
}

/** Formata segundos como m:ss para a badge (3 → "0:03", 245 → "4:05"). */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
