import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifySuperAdmin, verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createServiceClient()

const log = createLogger('e2e-test')

/**
 * E2E Test Runner — sends REAL messages via UAZAPI + calls REAL ai-agent.
 *
 * Flow per step:
 * 1. Send user message via UAZAPI (simulates lead sending WhatsApp msg)
 * 2. Call ai-agent directly (bypasses debounce for speed)
 * 3. Collect response + tool calls
 * 4. Return results for validation
 *
 * Requires super_admin auth.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Allow super_admin (manual from Playground) OR service_role (automated from e2e-scheduled)
  const auth = await verifySuperAdmin(req)
  if (!auth && !verifyCronOrService(req)) return unauthorizedResponse(corsHeaders)

  try {
    const body = await req.json()
    const { agent_id, instance_id, test_number, steps } = body

    if (!agent_id || !instance_id || !test_number || !steps?.length) {
      return errorResponse(corsHeaders, 'agent_id, instance_id, test_number, steps[] required', 400)
    }

    // Load agent + instance
    const [{ data: agent }, { data: instance }] = await Promise.all([
      supabase.from('ai_agents').select('id, enabled, debounce_seconds').eq('id', agent_id).single(),
      supabase.from('instances').select('id, token').eq('id', instance_id).maybeSingle(),
    ])

    if (!agent?.enabled) {
      return errorResponse(corsHeaders, 'Agent not found or disabled', 404)
    }
    if (!instance?.token) {
      return errorResponse(corsHeaders, 'Instance token not found', 500)
    }

    const testJid = test_number.includes('@') ? test_number : `${test_number.replace(/\D/g, '')}@s.whatsapp.net`

    // Find or create conversation for this test contact
    let { data: contact } = await supabase.from('contacts').select('id, jid').eq('jid', testJid).maybeSingle()
    if (!contact) {
      const { data: newContact } = await supabase.from('contacts').insert({ jid: testJid, phone: test_number, name: 'E2E Test' }).select('id, jid').single()
      contact = newContact
    }
    if (!contact) {
      return errorResponse(corsHeaders, 'Could not find/create test contact', 500)
    }

    const { data: inbox } = await supabase.from('inboxes').select('id').eq('instance_id', instance_id).maybeSingle()
    if (!inbox) {
      return errorResponse(corsHeaders, 'No inbox for this instance', 404)
    }

    // Find or create conversation
    let { data: conversation } = await supabase.from('conversations')
      .select('id').eq('contact_id', contact.id).eq('inbox_id', inbox.id).maybeSingle()
    if (!conversation) {
      const { data: newConv } = await supabase.from('conversations').insert({
        contact_id: contact.id, inbox_id: inbox.id, status: 'aberta', status_ia: 'ligada',
      }).select('id').single()
      conversation = newConv
    }
    if (!conversation) {
      return errorResponse(corsHeaders, 'Could not find/create conversation', 500)
    }

    // Reset conversation state for clean test
    await supabase.from('conversations').update({ status_ia: 'ligada', tags: [] }).eq('id', conversation.id)
    // Delete previous test messages and logs
    await Promise.all([
      supabase.from('conversation_messages').delete().eq('conversation_id', conversation.id),
      supabase.from('ai_agent_logs').delete().eq('conversation_id', conversation.id),
      supabase.from('ai_debounce_queue').delete().eq('conversation_id', conversation.id),
    ])

    // Execute test steps
    const results: any[] = []
    const startTime = Date.now()

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepStart = Date.now()

      // Timestamp BEFORE this step (to detect new outgoing msgs after)
      const stepTimestamp = new Date().toISOString()

      // 1. Save incoming message to DB (simulates webhook)
      await supabase.from('conversation_messages').insert({
        conversation_id: conversation.id, direction: 'incoming',
        content: step.content, media_type: step.media_type || 'text',
      })

      // 2. Call ai-agent directly and WAIT for response
      let agentResult: any = null
      try {
        const agentResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            conversation_id: conversation.id,
            instance_id,
            agent_id,
            messages: [{ content: step.content, media_type: step.media_type || 'text', media_url: null, direction: 'incoming', timestamp: new Date().toISOString() }],
          }),
        }, 45000) // 45s timeout for LLM + UAZAPI
        agentResult = await agentResp.json()
      } catch (e) {
        agentResult = { error: e instanceof Error ? e.message : 'timeout' }
      }

      // 3. Wait a bit for DB writes to settle, then read agent's NEW response
      await new Promise(r => setTimeout(r, 1000))

      // Get only NEW outgoing messages (created after this step started)
      const { data: newMsgs } = await supabase.from('conversation_messages')
        .select('content, media_type, direction, created_at')
        .eq('conversation_id', conversation.id)
        .eq('direction', 'outgoing')
        .gte('created_at', stepTimestamp)
        .order('created_at', { ascending: false })
        .limit(5)

      const agentResponse = newMsgs?.[0]?.content || agentResult?.greeting || agentResult?.response || null

      // 4. Read tags and logs for THIS step
      const [{ data: convState }, { data: logs }] = await Promise.all([
        supabase.from('conversations').select('tags, status_ia, assigned_to').eq('id', conversation.id).single(),
        supabase.from('ai_agent_logs').select('event, tool_calls, latency_ms, input_tokens, output_tokens')
          .eq('conversation_id', conversation.id).eq('agent_id', agent_id).order('created_at', { ascending: false }).limit(3),
      ])

      const toolCalls = (logs || []).filter(l => l.tool_calls?.length).flatMap(l => l.tool_calls as any[])

      results.push({
        step: i + 1,
        input: step.content,
        media_type: step.media_type || 'text',
        agent_response: agentResponse,
        agent_raw: agentResult,
        tools_used: [...new Set(toolCalls.map((tc: any) => tc.name))],
        tags: convState?.tags || [],
        status_ia: convState?.status_ia,
        latency_ms: Date.now() - stepStart,
        tokens: {
          input: (logs || []).reduce((s, l) => s + (l.input_tokens || 0), 0),
          output: (logs || []).reduce((s, l) => s + (l.output_tokens || 0), 0),
        },
      })

      // Wait between steps to let UAZAPI deliver
      if (i < steps.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    log.info('E2E test complete', { agent_id, steps: steps.length, total_latency_ms: Date.now() - startTime })

    return successResponse(corsHeaders, {
      test_number,
      conversation_id: conversation.id,
      total_steps: steps.length,
      total_latency_ms: Date.now() - startTime,
      results,
    })

  } catch (err) {
    log.error('Error', { error: (err as Error).message })
    return errorResponse(corsHeaders, err instanceof Error ? err.message : 'Unknown error', 500)
  }
})
