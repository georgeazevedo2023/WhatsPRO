import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'
import {
  buildLegacyQueueUpdate,
  createQueuedMessage,
  type QueuedMessage,
} from '../_shared/aiRuntime.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const supabase = createServiceClient()

interface DebounceQueueRow {
  id: string
  messages: QueuedMessage[] | null
  process_after: string
  processed: boolean
}

/**
 * Legacy fallback: reads existing queue, appends in memory, writes back.
 * Uses buildLegacyQueueUpdate to properly merge messages instead of replacing.
 */
async function legacyQueueMessage(
  conversationId: string,
  instanceId: string,
  messageEntry: QueuedMessage,
  processAfter: string,
): Promise<DebounceQueueRow> {
  // Try to read existing queue first
  const { data: existing } = await supabase
    .from('ai_debounce_queue')
    .select('messages, processed, first_message_at')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  const merged = existing
    ? buildLegacyQueueUpdate(existing as LegacyQueueState, messageEntry)
    : { messages: [messageEntry], firstMessageAt: messageEntry.timestamp }

  const { data, error } = await supabase
    .from('ai_debounce_queue')
    .upsert({
      conversation_id: conversationId,
      instance_id: instanceId,
      messages: merged.messages,
      first_message_at: merged.firstMessageAt,
      process_after: processAfter,
      processed: false,
    }, { onConflict: 'conversation_id' })
    .select('id, messages, process_after, processed')
    .single()

  if (error || !data) {
    throw error || new Error('legacy_queue_upsert_failed')
  }

  const legacyLog = createLogger('ai-agent-debounce')
  legacyLog.warn('Used legacy fallback with merge — RPC preferred')
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
    const request_id = crypto.randomUUID()
    const log = createLogger('ai-agent-debounce', request_id)

    if (!conversation_id || !instance_id) {
      return errorResponse(corsHeaders, 'conversation_id and instance_id required', 400)
    }

    // Get agent config for debounce_seconds
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, debounce_seconds, enabled')
      .eq('instance_id', instance_id)
      .eq('enabled', true)
      .maybeSingle()

    if (!agent) {
      return successResponse(corsHeaders, { skipped: true, reason: 'no_active_agent' })
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
      log.warn('append_ai_debounce_message unavailable, falling back to legacy queue flow', { error: queueError.message })
      queued = await legacyQueueMessage(conversation_id, instance_id, messageEntry, processAfter)
    }

    const queuedCount = queued?.messages?.length || 0
    log.info('Queue updated', { queue_id: queued?.id || conversation_id, msg_count: queuedCount, debounce_seconds: agent.debounce_seconds })

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
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
          log.info('Timer fired but queue already processed', { conversation_id })
          return
        }

        const claimedMessages = (claimed.messages as QueuedMessage[] | null) || []
        const msgCount = claimedMessages.length || 0
        log.info('Debounce expired, calling ai-agent', { conversation_id, msg_count: msgCount })

        const agentResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            conversation_id, instance_id,
            messages: claimedMessages,
            agent_id: agent.id,
            request_id,  // NEW: correlation ID for end-to-end tracing
          }),
        })

        // Retry once on 5xx (ai-agent might be cold-starting)
        if (agentResp.status >= 500 && agentResp.status < 600) {
          log.warn('ai-agent returned error, retrying', { status: agentResp.status })
          await new Promise(r => setTimeout(r, 2000))
          const retryResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
            body: JSON.stringify({
              conversation_id, instance_id,
              messages: claimedMessages,
              agent_id: agent.id,
              request_id,  // Same correlation ID on retry
            }),
          })
          const retryResult = await retryResp.json()
          log.info('ai-agent retry response', { status: retryResp.status, result_summary: JSON.stringify(retryResult).substring(0, 200) })
          return
        }

        const result = await agentResp.json()
        log.info('ai-agent response', { status: agentResp.status, result_summary: JSON.stringify(result).substring(0, 200) })
      } catch (err) {
        log.error('Error calling ai-agent', { error: (err as Error).message })
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

    // Fire the delayed processing — use waitUntil to keep isolate alive until promise resolves
    // Without this, the promise can be garbage-collected before the debounce timer fires
    const delayPromise = processAfterDelay()
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
      ;(globalThis as any).EdgeRuntime.waitUntil(delayPromise)
    }

    return successResponse(corsHeaders, { debounce_seconds: agent.debounce_seconds })

  } catch (err) {
    const errLog = createLogger('ai-agent-debounce')
    errLog.error('Error', { error: (err as Error).message })
    return errorResponse(corsHeaders, 'Internal error', 500)
  }
})
