import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'
import {
  buildLegacyQueueUpdate,
  createQueuedMessage,
  type QueuedMessage,
} from '../_shared/aiRuntime.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface DebounceQueueRow {
  id: string
  messages: QueuedMessage[] | null
  process_after: string
  processed: boolean
}

/**
 * Legacy fallback: uses upsert with ON CONFLICT to avoid read-then-update race condition.
 * Note: this fallback does NOT atomically append — it replaces messages with [messageEntry].
 * The RPC append_ai_debounce_message is the preferred path.
 */
async function legacyQueueMessage(
  conversationId: string,
  instanceId: string,
  messageEntry: QueuedMessage,
  processAfter: string,
): Promise<DebounceQueueRow> {
  // Atomic upsert: insert or update in a single operation (no read-then-write race)
  const { data, error } = await supabase
    .from('ai_debounce_queue')
    .upsert({
      conversation_id: conversationId,
      instance_id: instanceId,
      messages: [messageEntry],
      first_message_at: messageEntry.timestamp,
      process_after: processAfter,
      processed: false,
    }, { onConflict: 'conversation_id' })
    .select('id, messages, process_after, processed')
    .single()

  if (error || !data) {
    throw error || new Error('legacy_queue_upsert_failed')
  }

  console.warn('[debounce] Used legacy upsert fallback — messages may not be fully appended')
  return data as DebounceQueueRow
}

/**
 * AI Agent Debounce Handler
 *
 * Called by whatsapp-webhook when a message arrives for a conversation with AI enabled.
 * Groups messages within debounce window (default 10s) before calling ai-agent.
 *
 * Flow:
 * 1. Receive message data
 * 2. Upsert into ai_debounce_queue (append message, reset timer)
 * 3. Send "typing..." indicator via UAZAPI
 * 4. Schedule ai-agent call after debounce expires
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { conversation_id, instance_id, message, contact_jid } = body

    if (!conversation_id || !instance_id) {
      return new Response(JSON.stringify({ error: 'conversation_id and instance_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get agent config for debounce_seconds
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, debounce_seconds, enabled')
      .eq('instance_id', instance_id)
      .eq('enabled', true)
      .maybeSingle()

    if (!agent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_active_agent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const debounceMs = (agent.debounce_seconds || 10) * 1000
    const processAfter = new Date(Date.now() + debounceMs).toISOString()

    const messageEntry = createQueuedMessage(message, new Date().toISOString())

    // Atomic append/reset in Postgres. This preserves the queued array even when
    // multiple requests land close together, instead of replacing it with the latest message.
    const { data: queueData, error: queueError } = await supabase
      .rpc('append_ai_debounce_message', {
        p_conversation_id: conversation_id,
        p_instance_id: instance_id,
        p_message: messageEntry,
        p_process_after: processAfter,
        p_first_message_at: messageEntry.timestamp,
      })
      .single()

    let queued = queueData as DebounceQueueRow | null
    if (queueError) {
      console.warn('[debounce] append_ai_debounce_message unavailable, falling back to legacy queue flow:', queueError.message)
      queued = await legacyQueueMessage(conversation_id, instance_id, messageEntry, processAfter)
    }

    const queuedCount = queued?.messages?.length || 0
    console.log(`[debounce] Queue ${queued?.id || conversation_id} now has ${queuedCount} msg(s), timer ${agent.debounce_seconds}s`)

    // Send "typing..." indicator via UAZAPI
    if (contact_jid) {
      const { data: instance } = await supabase
        .from('instances')
        .select('token')
        .eq('id', instance_id)
        .maybeSingle()

      if (instance?.token) {
        const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
        fetchFireAndForget(`${uazapiUrl}/chat/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.token },
          body: JSON.stringify({ id: contact_jid, presence: 'composing' }),
        })
      }
    }

    // Schedule ai-agent call after debounce expires.
    // Uses a promise-based delay instead of bare setTimeout to avoid orphaned closures.
    // ATOMIC processing: UPDATE ... WHERE processed=false AND process_after <= now()
    // Only ONE timer callback will succeed — others get 0 rows and skip.
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const processAfterDelay = async () => {
      await new Promise(r => setTimeout(r, debounceMs))

      try {
        // Atomic claim: mark as processed ONLY IF timer hasn't been reset and not yet processed
        const { data: claimed } = await supabase
          .from('ai_debounce_queue')
          .update({ processed: true })
          .eq('conversation_id', conversation_id)
          .eq('processed', false)
          .lte('process_after', new Date().toISOString())
          .select('id, messages')
          .maybeSingle()

        if (!claimed) {
          console.log(`[debounce] Timer fired but queue already processed or reset for ${conversation_id}`)
          return
        }

        const claimedMessages = (claimed.messages as QueuedMessage[] | null) || []
        const msgCount = claimedMessages.length || 0
        console.log(`[debounce] Debounce expired, calling ai-agent for ${conversation_id} with ${msgCount} messages`)

        const agentResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            conversation_id, instance_id,
            messages: claimedMessages,
            agent_id: agent.id,
          }),
        })

        // Retry once on 5xx (ai-agent might be cold-starting)
        if (agentResp.status >= 500 && agentResp.status < 600) {
          console.warn(`[debounce] ai-agent returned ${agentResp.status}, retrying in 2s...`)
          await new Promise(r => setTimeout(r, 2000))
          const retryResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
            body: JSON.stringify({
              conversation_id, instance_id,
              messages: claimedMessages,
              agent_id: agent.id,
            }),
          })
          const retryResult = await retryResp.json()
          console.log(`[debounce] ai-agent retry:`, retryResp.status, JSON.stringify(retryResult).substring(0, 200))
          return
        }

        const result = await agentResp.json()
        console.log(`[debounce] ai-agent response:`, agentResp.status, JSON.stringify(result).substring(0, 200))
      } catch (err) {
        console.error('[debounce] Error calling ai-agent:', err)
        // Mark as unprocessed so it can be retried by a cleanup job (best effort)
        try {
          await supabase
            .from('ai_debounce_queue')
            .update({ processed: false })
            .eq('conversation_id', conversation_id)
            .eq('processed', true)
        } catch { /* best effort */ }
      }
    }

    // Fire the delayed processing — EdgeRuntime keeps the isolate alive until this resolves
    processAfterDelay()

    return new Response(JSON.stringify({ ok: true, debounce_seconds: agent.debounce_seconds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[debounce] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
