// =============================================================================
// Followup Subagent (S10)
// Agenda follow-up futuro via step_data. Envia mensagem de despedida imediata
// e agenda mensagem futura para o cron process-flow-followups.
//
// Fluxo:
//   1. Calcula delay baseado em escalation_level + escalation_delays
//   2. Resolve message_template com {name} do lead
//   3. Armazena followup_scheduled_at + followup_message + followup_sent=false no step_data
//   4. Retorna status='complete' com farewell message + tag followup:scheduled
//
// Estágio 2 (cron process-flow-followups):
//   - Query: flow_states WHERE step_data->>'followup_scheduled_at' <= now()
//            AND (step_data->>'followup_sent')::bool IS DISTINCT FROM true
//   - Envia followup_message via UAZAPI
//   - Marca followup_sent = true, avança step
//
// Regras:
//   - NUNCA insere em flow_followups (tabela exclusiva do Shadow Mode)
//   - SEMPRE armazena schedule em step_data (R36: PostgREST onConflict não funciona por colunas)
//   - Respeita max_escalations para evitar spam
// =============================================================================

import type { SubagentInput, SubagentResult } from '../types.ts'

// ── Config do subagente Followup ────────────────────────────────────────────

export interface FollowupConfig {
  delay_hours?: number            // default: 24 (envia follow-up após 24h)
  message_template?: string       // "Oi {name}, tudo bem? Voltando sobre..."
  max_escalations?: number        // default: 3 (desiste após 3 tentativas sem resposta)
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

  // ── Verifica nível de escalation atual ──────────────────────────────────
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

  // ── Calcula delay baseado no nível de escalation ─────────────────────────
  const effectiveDelay = currentLevel < escalationDelays.length
    ? escalationDelays[currentLevel]
    : delayHours

  // ── Resolve template com dados do lead ───────────────────────────────────
  const leadName = lead.lead_name ?? ''
  const followupMessage = personalize(messageTemplate, leadName)

  // ── Calcula data agendada ─────────────────────────────────────────────────
  const scheduledFor = new Date(Date.now() + effectiveDelay * 60 * 60 * 1000).toISOString()

  console.log(
    `[followup] scheduled: lead=${lead.lead_id}, delay=${effectiveDelay}h, at=${scheduledFor}, level=${currentLevel}`,
  )

  // ── Monta resultado — armazena no step_data, cron envia depois ─────────
  const tags: string[] = ['followup:scheduled']
  if (postAction === 'tag_and_close') {
    tags.push('followup:closed')
  }

  return {
    status: 'continue',
    response_text: DEFAULTS.farewell,
    step_data_patch: {
      followup_scheduled_at: scheduledFor,
      followup_message: followupMessage,
      followup_sent: false,
      escalation_level: currentLevel + 1,
      last_subagent: 'followup',
    },
    tags_to_set: tags,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function personalize(template: string, name: string): string {
  return template.replace(/\{name\}/g, name).trim()
}
