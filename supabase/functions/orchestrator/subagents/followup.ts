// =============================================================================
// Followup Subagent (S10)
// Agenda follow-up para entrega futura via tabela flow_followups.
//
// Fluxo:
//   1. Calcula delay_hours (default 24h) a partir de config ou escalation_delays
//   2. Resolve message_template com {name} do lead
//   3. Insere registro em flow_followups (status='pending')
//   4. Retorna status='complete' com tag followup:scheduled
//
// Regras:
//   - Usa createServiceClient para INSERT direto
//   - NUNCA envia o follow-up imediatamente — apenas agenda
//   - Track followup_id + scheduled_for no step_data
//   - Respeita max_escalations para evitar spam
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { SubagentInput, SubagentResult } from '../types.ts'

// ── Config do subagente Followup ────────────────────────────────────────────

export interface FollowupConfig {
  delay_hours?: number            // default: 24 (envia follow-up após 24h)
  message_template?: string       // "Oi {name}, tudo bem? Voltando sobre..."
  max_escalations?: number        // default: 3 (desiste após 3 tentativas)
  escalation_delays?: number[]    // [24, 48, 168] horas entre tentativas
  post_action?: 'complete' | 'tag_and_close'  // default: 'complete'
}

const DEFAULTS = {
  delay_hours: 24,
  max_escalations: 3,
  escalation_delays: [24, 48, 168],
  message_template: 'Oi {name}, tudo bem? Estou passando para saber se posso ajudar com mais alguma coisa!',
  farewell: 'Qualquer duvida, e so chamar!',
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function followupSubagent(
  input: SubagentInput<FollowupConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { lead, flow_state } = context

  const delayHours       = config.delay_hours ?? DEFAULTS.delay_hours
  const maxEscalations   = config.max_escalations ?? DEFAULTS.max_escalations
  const escalationDelays = config.escalation_delays ?? DEFAULTS.escalation_delays
  const messageTemplate  = config.message_template ?? DEFAULTS.message_template
  const postAction       = config.post_action ?? 'complete'

  // ── Verifica escalation level atual ────────────────────────────────────────
  const currentLevel = (flow_state.step_data.escalation_level as number) ?? 0

  if (currentLevel >= maxEscalations) {
    console.log(`[followup] max_escalations (${maxEscalations}) atingido para lead ${lead.lead_id}`)
    return {
      status: 'complete',
      response_text: DEFAULTS.farewell,
      step_data_patch: { last_subagent: 'followup' },
      tags_to_set: ['followup:max_reached'],
    }
  }

  // ── Calcula delay baseado no nivel de escalation ───────────────────────────
  const effectiveDelay = currentLevel < escalationDelays.length
    ? escalationDelays[currentLevel]
    : delayHours

  // ── Resolve template com dados do lead ─────────────────────────────────────
  const leadName = lead.lead_name ?? ''
  const suggestedMessage = personalize(messageTemplate, leadName)

  // ── Calcula data agendada ──────────────────────────────────────────────────
  const scheduledFor = new Date(Date.now() + effectiveDelay * 60 * 60 * 1000).toISOString()

  // ── Insere na flow_followups ───────────────────────────────────────────────
  const supabase = createServiceClient()

  const { data: followup, error } = await supabase
    .from('flow_followups')
    .insert({
      instance_id: flow_state.instance_id,
      conversation_id: context.input.conversation_id,
      lead_id: lead.lead_id,
      detection_type: 'flow_followup',
      suggested_date: scheduledFor,
      suggested_message: suggestedMessage,
      status: 'pending',
      escalation_level: currentLevel,
      score_decay_rate: 2,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[followup] insert error:', error.message)
    return {
      status: 'error',
      error: `followup_insert_failed: ${error.message}`,
      step_data_patch: { last_subagent: 'followup' },
    }
  }

  const followupId = followup?.id ?? null

  console.log(
    `[followup] scheduled: id=${followupId}, lead=${lead.lead_id}, delay=${effectiveDelay}h, level=${currentLevel}`,
  )

  // ── Monta resultado ────────────────────────────────────────────────────────
  const status = postAction === 'tag_and_close' ? 'complete' : 'complete'

  const tags: string[] = ['followup:scheduled']
  if (postAction === 'tag_and_close') {
    tags.push('followup:closed')
  }

  return {
    status,
    response_text: DEFAULTS.farewell,
    step_data_patch: {
      followup_id: followupId,
      scheduled_for: scheduledFor,
      escalation_level: currentLevel + 1,
      last_subagent: 'followup',
    },
    tags_to_set: tags,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function personalize(template: string, name: string): string {
  return template.replace(/\{name\}/g, name).trim()
}
