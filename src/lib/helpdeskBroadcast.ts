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

/** Assign agent to conversation with DB update + broadcast */
export async function assignAgent(conversationId: string, agentId: string | null) {
  await supabase.from('conversations').update({ assigned_to: agentId }).eq('id', conversationId);
  await broadcastAssignedAgent(conversationId, agentId);
}

/** Broadcast typing indicator (fire-and-forget, single channel) */
export function broadcastTyping(conversationId: string, agentId: string, agentName: string) {
  supabase.channel('helpdesk-realtime').send({
    type: 'broadcast', event: 'agent-typing',
    payload: { conversation_id: conversationId, agent_id: agentId, agent_name: agentName },
  }).catch(() => {});
}
