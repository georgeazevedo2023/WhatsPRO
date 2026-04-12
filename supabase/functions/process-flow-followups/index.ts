// =============================================================================
// process-flow-followups — Cron Edge Function (S10)
// Roda a cada hora. Busca flow_states com followup agendado para agora e envia.
//
// Critério de disparo:
//   - flow_states.status = 'active'
//   - flow_steps.subagent_type = 'followup'
//   - step_data->>'followup_scheduled_at' <= now()
//   - step_data->>'followup_sent' IS DISTINCT FROM 'true'
//
// Para cada registro:
//   1. Busca jid do lead via lead_profiles → contacts
//   2. Busca token da instância
//   3. Envia followup_message via UAZAPI /send/text
//   4. Marca step_data.followup_sent = true
//   5. Executa post_action: next_step | complete | handoff
// =============================================================================

import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'

// verify_jwt = false — chamado por pg_cron, sem JWT
// @ts-ignore -- Deno serve config
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createServiceClient()
  const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'

  let processed = 0
  let sent = 0
  let errors = 0

  try {
    // ── Busca flow_states com followup pendente ─────────────────────────────
    const { data: states, error: queryErr } = await supabase
      .from('flow_states')
      .select(`
        id,
        flow_id,
        lead_id,
        conversation_id,
        instance_id,
        flow_step_id,
        step_data,
        flow_steps!flow_step_id (
          subagent_type,
          step_config,
          position,
          flow_id
        )
      `)
      .eq('status', 'active')
      .lte('step_data->>followup_scheduled_at', new Date().toISOString())
      .not('step_data->>followup_sent', 'eq', 'true')
      .limit(50)

    if (queryErr) {
      console.error('[process-flow-followups] query error:', queryErr.message)
      return errorJson(corsHeaders, queryErr.message, 500)
    }

    // Filtra apenas steps de subagent_type = 'followup'
    const followupStates = (states ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.flow_steps?.subagent_type === 'followup',
    )

    console.log(`[process-flow-followups] found ${followupStates.length} pending followups`)

    for (const state of followupStates) {
      processed++
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stepData = (state.step_data ?? {}) as Record<string, any>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stepConfig = (state.flow_steps?.step_config ?? {}) as Record<string, any>
        const followupMessage = String(stepData.followup_message ?? '')
        const postAction = String(stepConfig.post_action ?? 'next_step')
        const currentPosition = state.flow_steps?.position ?? 0

        if (!followupMessage) {
          console.warn(`[process-flow-followups] state ${state.id} has no followup_message`)
          continue
        }

        // ── Busca JID do lead ─────────────────────────────────────────────
        const { data: leadRow } = await supabase
          .from('lead_profiles')
          .select('contact_id')
          .eq('id', state.lead_id)
          .maybeSingle()

        if (!leadRow?.contact_id) {
          console.warn(`[process-flow-followups] no contact for lead ${state.lead_id}`)
          errors++
          continue
        }

        const { data: contactRow } = await supabase
          .from('contacts')
          .select('jid')
          .eq('id', leadRow.contact_id)
          .maybeSingle()

        if (!contactRow?.jid) {
          console.warn(`[process-flow-followups] no jid for contact ${leadRow.contact_id}`)
          errors++
          continue
        }

        // ── Busca token da instância ──────────────────────────────────────
        const { data: instanceRow } = await supabase
          .from('instances')
          .select('token')
          .eq('id', state.instance_id)
          .maybeSingle()

        if (!instanceRow?.token) {
          console.warn(`[process-flow-followups] no token for instance ${state.instance_id}`)
          errors++
          continue
        }

        // ── Envia mensagem via UAZAPI /send/text ──────────────────────────
        const res = await fetchWithTimeout(`${uazapiUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: instanceRow.token },
          body: JSON.stringify({ number: contactRow.jid, text: followupMessage }),
        }, 10000)

        if (!res.ok) {
          const body = await res.text()
          console.error(`[process-flow-followups] send failed: ${res.status} ${body}`)
          errors++
          continue
        }

        // ── Marca followup_sent = true ────────────────────────────────────
        await supabase
          .from('flow_states')
          .update({
            step_data: {
              ...stepData,
              followup_sent: true,
              followup_sent_at: new Date().toISOString(),
            },
          })
          .eq('id', state.id)

        // ── Executa post_action ───────────────────────────────────────────
        if (postAction === 'complete') {
          await supabase
            .from('flow_states')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', state.id)
        } else if (postAction === 'handoff') {
          await supabase
            .from('flow_states')
            .update({ status: 'handoff', completed_at: new Date().toISOString() })
            .eq('id', state.id)
        } else {
          // next_step (default): avança para o próximo step
          const { data: nextStep } = await supabase
            .from('flow_steps')
            .select('id')
            .eq('flow_id', state.flow_id)
            .eq('position', currentPosition + 1)
            .eq('is_active', true)
            .maybeSingle()

          if (nextStep) {
            await supabase
              .from('flow_states')
              .update({ flow_step_id: nextStep.id })
              .eq('id', state.id)
          } else {
            // Não tem próximo step → completa
            await supabase
              .from('flow_states')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', state.id)
          }
        }

        sent++
        console.log(`[process-flow-followups] sent to ${contactRow.jid}, action=${postAction}`)
      } catch (err) {
        console.error(`[process-flow-followups] error on state ${state.id}:`, err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, sent, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[process-flow-followups] fatal error:', err)
    return errorJson(corsHeaders, String(err), 500)
  }
})

function errorJson(corsHeaders: Record<string, string>, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
