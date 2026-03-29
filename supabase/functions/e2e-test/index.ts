import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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

  const auth = await verifySuperAdmin(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  try {
    const body = await req.json()
    const { agent_id, instance_id, test_number, steps } = body

    if (!agent_id || !instance_id || !test_number || !steps?.length) {
      return new Response(JSON.stringify({ ok: false, error: 'agent_id, instance_id, test_number, steps[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load agent + instance
    const [{ data: agent }, { data: instance }] = await Promise.all([
      supabase.from('ai_agents').select('id, enabled, debounce_seconds').eq('id', agent_id).single(),
      supabase.from('instances').select('id, token').eq('id', instance_id).maybeSingle(),
    ])

    if (!agent?.enabled) {
      return new Response(JSON.stringify({ ok: false, error: 'Agent not found or disabled' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!instance?.token) {
      return new Response(JSON.stringify({ ok: false, error: 'Instance token not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
    const testJid = test_number.includes('@') ? test_number : `${test_number.replace(/\D/g, '')}@s.whatsapp.net`

    // Find or create conversation for this test contact
    let { data: contact } = await supabase.from('contacts').select('id, jid').eq('jid', testJid).maybeSingle()
    if (!contact) {
      const { data: newContact } = await supabase.from('contacts').insert({ jid: testJid, phone: test_number, name: 'E2E Test' }).select('id, jid').single()
      contact = newContact
    }
    if (!contact) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not find/create test contact' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inbox } = await supabase.from('inboxes').select('id').eq('instance_id', instance_id).maybeSingle()
    if (!inbox) {
      return new Response(JSON.stringify({ ok: false, error: 'No inbox for this instance' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find or create conversation
    let { data: conversation } = await supabase.from('conversations')
      .select('id').eq('contact_id', contact.id).eq('inbox_id', inbox.id).maybeSingle()
    if (!conversation) {
      const { data: newConv } = await supabase.from('conversations').insert({
        contact_id: contact.id, inbox_id: inbox.id, instance_id, status: 'open', status_ia: 'ligada',
      }).select('id').single()
      conversation = newConv
    }
    if (!conversation) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not find/create conversation' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

      // 1. Save incoming message to DB (simulates webhook)
      await supabase.from('conversation_messages').insert({
        conversation_id: conversation.id, direction: 'incoming',
        content: step.content, media_type: step.media_type || 'text',
      })

      // 2. Send "typing" via UAZAPI (optional, for realism)
      try {
        await fetchWithTimeout(`${uazapiUrl}/chat/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.token },
          body: JSON.stringify({ id: testJid, presence: 'composing' }),
        }, 3000)
      } catch { /* non-critical */ }

      // 3. Call ai-agent directly (bypasses debounce for test speed)
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
        }, 30000) // 30s timeout for LLM
        agentResult = await agentResp.json()
      } catch (e) {
        agentResult = { error: e instanceof Error ? e.message : 'timeout' }
      }

      // 4. Read agent's response from DB (what was actually sent)
      const { data: agentMsgs } = await supabase.from('conversation_messages')
        .select('content, media_type, direction, created_at')
        .eq('conversation_id', conversation.id)
        .eq('direction', 'outgoing')
        .order('created_at', { ascending: false })
        .limit(3)

      // 5. Read tags and logs
      const [{ data: convState }, { data: logs }] = await Promise.all([
        supabase.from('conversations').select('tags, status_ia, assigned_to').eq('id', conversation.id).single(),
        supabase.from('ai_agent_logs').select('event, tool_calls, latency_ms, input_tokens, output_tokens')
          .eq('conversation_id', conversation.id).eq('agent_id', agent_id).order('created_at', { ascending: false }).limit(5),
      ])

      const toolCalls = (logs || []).filter(l => l.tool_calls?.length).flatMap(l => l.tool_calls as any[])

      results.push({
        step: i + 1,
        input: step.content,
        media_type: step.media_type || 'text',
        agent_response: agentMsgs?.[0]?.content || agentResult?.greeting || null,
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

    return new Response(JSON.stringify({
      ok: true,
      test_number,
      conversation_id: conversation.id,
      total_steps: steps.length,
      total_latency_ms: Date.now() - startTime,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[e2e-test] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
