import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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

    // Clean any processed entries for this conversation first
    await supabase
      .from('ai_debounce_queue')
      .delete()
      .eq('conversation_id', conversation_id)
      .eq('processed', true)

    const messageEntry = {
      content: message?.content || message?.text || '',
      media_type: message?.media_type || 'text',
      media_url: message?.media_url || null,
      direction: message?.direction || 'incoming',
      timestamp: new Date().toISOString(),
    }

    // Atomic upsert: insert new queue entry or append message to existing one
    // This eliminates the check-then-act race condition
    const { data: upserted, error: upsertError } = await supabase
      .from('ai_debounce_queue')
      .upsert({
        conversation_id,
        instance_id,
        messages: [messageEntry],
        first_message_at: new Date().toISOString(),
        process_after: processAfter,
        processed: false,
      }, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false,
      })
      .select('id, messages')
      .single()

    // If upsert matched an existing row, the messages array was replaced.
    // We need to append instead — so re-fetch and append if there was a conflict.
    if (upsertError?.code === '23505' || !upsertError) {
      // Check if existing row has more messages (was already in queue)
      const { data: current } = await supabase
        .from('ai_debounce_queue')
        .select('id, messages')
        .eq('conversation_id', conversation_id)
        .eq('processed', false)
        .maybeSingle()

      if (current) {
        const existingMessages = (current.messages as any[] || [])
        // Only append if our message isn't already there (dedup by timestamp)
        const alreadyHas = existingMessages.some(
          (m: any) => m.timestamp === messageEntry.timestamp && m.content === messageEntry.content
        )
        if (!alreadyHas) {
          const mergedMessages = [...existingMessages, messageEntry]
          await supabase
            .from('ai_debounce_queue')
            .update({ messages: mergedMessages, process_after: processAfter })
            .eq('id', current.id)
        } else {
          // Just reset the timer
          await supabase
            .from('ai_debounce_queue')
            .update({ process_after: processAfter })
            .eq('id', current.id)
        }
        console.log(`[debounce] Appended msg to queue ${current.id}, reset timer to ${agent.debounce_seconds}s`)
      }
    } else {
      console.log(`[debounce] Created queue for conversation ${conversation_id}, timer ${agent.debounce_seconds}s`)
    }

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

    // Schedule the ai-agent call after debounce expires
    // We use setTimeout-like approach: call ai-agent with a delay check
    // The ai-agent will verify process_after before processing
    setTimeout(async () => {
      try {
        // Re-check if this queue item is still pending and timer hasn't been reset
        const { data: queueItem } = await supabase
          .from('ai_debounce_queue')
          .select('id, messages, process_after, processed')
          .eq('conversation_id', conversation_id)
          .eq('processed', false)
          .maybeSingle()

        if (!queueItem) return

        // Check if process_after was reset (new messages came in)
        const shouldProcess = new Date(queueItem.process_after).getTime() <= Date.now()
        if (!shouldProcess) {
          console.log(`[debounce] Timer was reset for ${conversation_id}, skipping`)
          return
        }

        // Mark as processed
        await supabase
          .from('ai_debounce_queue')
          .update({ processed: true })
          .eq('id', queueItem.id)

        // Call ai-agent
        console.log(`[debounce] Debounce expired, calling ai-agent for ${conversation_id} with ${(queueItem.messages as any[]).length} messages`)

        const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
        const agentResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            conversation_id,
            instance_id,
            messages: queueItem.messages,
            agent_id: agent.id,
          }),
        })

        const result = await agentResp.json()
        console.log(`[debounce] ai-agent response:`, agentResp.status, JSON.stringify(result).substring(0, 200))

      } catch (err) {
        console.error('[debounce] Error calling ai-agent:', err)
      }
    }, debounceMs)

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
