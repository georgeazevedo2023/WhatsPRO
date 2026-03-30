import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { STATUS_IA } from '../_shared/constants.ts'
import {
  extractInterestFromTags,
  formatFollowUpMessage,
  resolveNextFollowUpStep,
  type FollowUpRule,
} from '../_shared/aiRuntime.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const UAZAPI_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

const supabase = createServiceClient()
const log = createLogger('process-follow-ups')

/**
 * Process Follow-Up Cadences
 *
 * Runs on a cron schedule (every 1h). Finds conversations where:
 * - AI agent has follow_up_enabled = true
 * - Conversation is in 'shadow' mode (post-handoff)
 * - Lead hasn't sent a message in X days (per cadence rules)
 * - Follow-up step hasn't been sent yet
 *
 * Sends personalized follow-up message and reactivates IA.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!verifyCronOrService(req)) {
    return errorResponse(corsHeaders, 'Unauthorized', 401)
  }

  const startTime = Date.now()
  let processed = 0
  let sent = 0
  let errors = 0

  try {
    const { data: agents } = await supabase
      .from('ai_agents')
      .select('id, instance_id, name, follow_up_rules, follow_up_enabled, business_hours')
      .eq('follow_up_enabled', true)
      .eq('enabled', true)

    if (!agents || agents.length === 0) {
      return successResponse(corsHeaders, { message: 'No agents with follow-up enabled' })
    }

    log.info('Found agents with follow-up enabled', { count: agents.length })

    for (const agent of agents) {
      const rules: FollowUpRule[] = agent.follow_up_rules || []
      if (rules.length === 0) continue

      rules.sort((a, b) => a.days - b.days)

      if (agent.business_hours?.start && agent.business_hours?.end) {
        const now = new Date()
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        if (currentTime < agent.business_hours.start || currentTime > agent.business_hours.end) {
          log.info('Agent outside business hours, skipping', { agent: agent.name, hours: `${agent.business_hours.start}-${agent.business_hours.end}` })
          continue
        }
      }

      const { data: instance } = await supabase
        .from('instances')
        .select('token')
        .eq('id', agent.instance_id)
        .single()

      if (!instance?.token) {
        log.warn('Agent has no instance token', { agent: agent.name })
        continue
      }

      const { data: inboxes } = await supabase
        .from('inboxes')
        .select('id')
        .eq('instance_id', agent.instance_id)

      const inboxIds = (inboxes || []).map((inbox) => inbox.id)
      if (inboxIds.length === 0) continue

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, contact_id, last_message_at, tags')
        .in('inbox_id', inboxIds)
        .eq('status_ia', STATUS_IA.SHADOW)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: true })
        .limit(50)

      if (!conversations || conversations.length === 0) continue

      log.info('Shadow conversations to check', { agent: agent.name, count: conversations.length })

      for (const conv of conversations) {
        processed++

        const lastMsg = new Date(conv.last_message_at)
        const daysSince = Math.floor((Date.now() - lastMsg.getTime()) / (1000 * 60 * 60 * 24))

        const { data: existingFollowUps } = await supabase
          .from('follow_up_executions')
          .select('step, status')
          .eq('conversation_id', conv.id)
          .eq('agent_id', agent.id)
          .order('step', { ascending: false })
          .limit(1)

        const lastStep = existingFollowUps?.[0]?.step || 0
        const lastStatus = existingFollowUps?.[0]?.status
        const decision = resolveNextFollowUpStep({
          rules,
          daysSince,
          lastStep,
          lastStatus,
        })

        if (!decision) continue

        const { nextStepIndex, rule } = decision

        const { data: contact } = await supabase
          .from('contacts')
          .select('jid, name, phone')
          .eq('id', conv.contact_id)
          .single()

        if (!contact?.jid) continue

        const { data: profile } = await supabase
          .from('lead_profiles')
          .select('full_name')
          .eq('contact_id', conv.contact_id)
          .maybeSingle()

        const nome = profile?.full_name || contact.name || 'cliente'
        const produto = extractInterestFromTags(conv.tags || [])
        const message = formatFollowUpMessage({
          template: rule.message,
          nome,
          produto,
          daysSince,
          loja: agent.name || 'nossa loja',
        })

        try {
          const sendRes = await fetchWithTimeout(`${UAZAPI_URL}/send/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: instance.token },
            body: JSON.stringify({
              number: contact.jid,
              text: message,
              delay: Math.min(5000, Math.max(1000, message.length * 40)),
            }),
          })

          const sendOk = sendRes.ok

          await supabase.from('follow_up_executions').insert({
            conversation_id: conv.id,
            contact_id: conv.contact_id,
            instance_id: agent.instance_id,
            agent_id: agent.id,
            step: nextStepIndex + 1,
            message_sent: message,
            status: sendOk ? 'sent' : 'failed',
            error: sendOk ? null : `UAZAPI ${sendRes.status}`,
          })

          if (sendOk) {
            await supabase.from('conversation_messages').insert({
              conversation_id: conv.id,
              direction: 'outgoing',
              content: message,
              media_type: 'text',
              external_id: `follow_up_${conv.id}_${nextStepIndex + 1}`,
            })

            await supabase.from('conversations').update({
              status_ia: STATUS_IA.LIGADA,
              last_message_at: new Date().toISOString(),
              last_message: message.substring(0, 200),
            }).eq('id', conv.id)

            sent++
            log.info('Sent follow-up step', { step: nextStepIndex + 1, total: rules.length, phone: contact.phone, days: daysSince, preview: message.substring(0, 60) })
          } else {
            errors++
            log.error('Failed to send follow-up', { phone: contact.phone, status: sendRes.status })
          }
        } catch (err) {
          errors++
          log.error('Error sending follow-up', { phone: contact.phone, error: err instanceof Error ? err.message : String(err) })

          await supabase.from('follow_up_executions').insert({
            conversation_id: conv.id,
            contact_id: conv.contact_id,
            instance_id: agent.instance_id,
            agent_id: agent.id,
            step: nextStepIndex + 1,
            message_sent: message,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const duration = Date.now() - startTime
    log.info('Done', { processed, sent, errors, duration_ms: duration })

    return successResponse(corsHeaders, {
      processed,
      sent,
      errors,
      duration_ms: duration,
    })
  } catch (err) {
    log.error('Fatal error', { error: err instanceof Error ? err.message : String(err) })
    return errorResponse(corsHeaders, 'Internal server error')
  }
})
