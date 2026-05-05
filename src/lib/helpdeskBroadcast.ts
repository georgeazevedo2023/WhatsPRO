import { supabase } from '@/integrations/supabase/client';

const CHANNELS = ['helpdesk-realtime', 'helpdesk-conversations'] as const;

async function broadcast(event: string, payload: Record<string, unknown>, channels = CHANNELS) {
  await Promise.all(
    channels.map(topic =>
      supabase.channel(topic).send({ type: 'broadcast', event, payload }).catch(() => {})
    )
  );
}

/** Broadcast a new message to all helpdesk channels */
export async function broadcastNewMessage(payload: {
  conversation_id: string;
  inbox_id?: string;
  message_id?: string;
  direction: string;
  content?: string | null;
  media_type?: string;
  media_url?: string | null;
  created_at?: string;
  status_ia?: string;
}) {
  await broadcast('new-message', payload);
}

/** Broadcast agent assignment change */
export async function broadcastAssignedAgent(conversationId: string, assignedTo: string | null) {
  await broadcast('assigned-agent', {
    conversation_id: conversationId,
    assigned_to: assignedTo,
  });
}

/** Broadcast conversation status change */
export async function broadcastStatusChanged(conversationId: string, status: string) {
  await broadcast('status-changed', {
    conversation_id: conversationId,
    status,
  });
}

/** Update conversation in DB + broadcast to channels */
export async function updateConversationAndBroadcast(
  conversationId: string,
  updates: Record<string, unknown>,
  broadcastEvent?: { event: string; payload: Record<string, unknown> },
) {
  const { error } = await supabase.from('conversations').update(updates).eq('id', conversationId);
  if (error) throw error;

  if (broadcastEvent) {
    await broadcast(broadcastEvent.event, broadcastEvent.payload);
  }
}

/**
 * Assign agent to conversation with DB update + broadcast in both helpdesk channels.
 * Throws on DB error so callers can show toast / rollback. Caminho ÚNICO de atribuição
 * — não duplicar UPDATE em outros lugares.
 *
 * D30 Sprint F: reatribuição manual cancela `handoff_queue_events` ativos da
 * conversa marcando-os como `manual_override` — caso contrário o cron
 * `requeue-conversations` continuaria gerenciando timeouts em paralelo.
 */
export async function assignAgent(conversationId: string, agentId: string | null) {
  const { error } = await supabase.from('conversations').update({ assigned_to: agentId }).eq('id', conversationId);
  if (error) throw error;
  // D30: marca eventos de fila ativos como manual_override (não-bloqueante)
  try {
    await supabase
      .from('handoff_queue_events')
      .update({
        status: 'manual_override',
        resolved_at: new Date().toISOString(),
        resolved_reason: 'manual_reassign_via_helpdesk',
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'active');
    await broadcast('queue-update', { conversation_id: conversationId, kind: 'manual_override' });
  } catch { /* fila é decoração — falha silente */ }
  await broadcastAssignedAgent(conversationId, agentId);
}

/** Broadcast typing indicator (fire-and-forget, single channel) */
export function broadcastTyping(conversationId: string, agentId: string, agentName: string) {
  supabase.channel('helpdesk-realtime').send({
    type: 'broadcast', event: 'agent-typing',
    payload: { conversation_id: conversationId, agent_id: agentId, agent_name: agentName },
  }).catch(() => {});
}
