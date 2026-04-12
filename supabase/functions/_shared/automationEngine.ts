/**
 * automationEngine.ts — Motor de Automação M17 F1
 *
 * Executa regras de automação em formato Gatilho > Condição > Ação.
 * Chamado por: whatsapp-webhook, form-bot, bio-public, kanban card move handlers.
 *
 * Trigger types: card_moved | poll_answered | form_completed | lead_created |
 *                conversation_resolved | tag_added | label_applied
 * Condition types: always | tag_contains | funnel_is | business_hours
 * Action types: send_message | move_card | add_tag | activate_ai | handoff | send_poll (placeholder F4)
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from './logger.ts'

const log = createLogger('automationEngine', 'engine')

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'card_moved'
  | 'poll_answered'
  | 'form_completed'
  | 'lead_created'
  | 'conversation_resolved'
  | 'tag_added'
  | 'label_applied'

export type ConditionType = 'always' | 'tag_contains' | 'funnel_is' | 'business_hours'

export type ActionType =
  | 'send_message'
  | 'move_card'
  | 'add_tag'
  | 'activate_ai'
  | 'handoff'
  | 'send_poll'

export interface TriggerData {
  /** Target column ID (card_moved) */
  column_id?: string
  /** Tag that was added (tag_added) */
  tag?: string
  /** Label that was applied (label_applied) */
  label?: string
  /** Poll ID (poll_answered) */
  poll_id?: string
  /** Poll options selected (poll_answered) */
  options?: string[]
  /** Form slug (form_completed) */
  form_slug?: string
  /** Any additional context data */
  [key: string]: unknown
}

export interface AutomationExecutionLog {
  rule_id: string
  rule_name: string
  /** True if the trigger type matched and config check passed */
  triggered: boolean
  /** True if the condition evaluation returned true */
  condition_passed: boolean
  /** True if the action was executed without error */
  action_executed: boolean
  /** Short description of what the action did */
  action_result?: string
  /** Error message if something went wrong */
  error?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Execute all enabled automation rules for a funnel that match the given trigger.
 *
 * @param funnelId        - UUID of the funnel owning the rules
 * @param triggerType     - Which event fired (e.g. 'card_moved')
 * @param triggerData     - Event-specific payload (e.g. { column_id: 'abc' })
 * @param conversationId  - Active conversation ID (may be null for non-chat triggers)
 * @param supabase        - Supabase client (service-role recommended for mutations)
 * @returns               - Array of execution logs, one per rule evaluated
 */
export async function executeAutomationRules(
  funnelId: string,
  triggerType: TriggerType,
  triggerData: TriggerData,
  conversationId: string | null,
  supabase: SupabaseClient,
): Promise<AutomationExecutionLog[]> {
  const logs: AutomationExecutionLog[] = []

  try {
    // 1. Load enabled rules for this funnel that match the trigger type
    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('funnel_id', funnelId)
      .eq('enabled', true)
      .eq('trigger_type', triggerType)
      .order('position', { ascending: true })

    if (error) {
      log.error('Failed to load automation rules', { funnelId, triggerType, error: error.message })
      return logs
    }

    if (!rules || rules.length === 0) return logs

    log.info('Executing automation rules', { funnelId, triggerType, ruleCount: rules.length })

    for (const rule of rules) {
      const entry: AutomationExecutionLog = {
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: false,
        condition_passed: false,
        action_executed: false,
      }

      try {
        // 2. Check trigger config (e.g. card_moved to a specific column)
        const triggerMatches = matchesTriggerConfig(
          triggerType,
          triggerData,
          (rule.trigger_config as Record<string, unknown>) ?? {},
        )

        if (!triggerMatches) {
          logs.push(entry)
          continue
        }

        entry.triggered = true

        // 3. Evaluate condition
        const condPassed = await evaluateCondition(
          (rule.condition_type ?? 'always') as ConditionType,
          (rule.condition_config as Record<string, unknown>) ?? {},
          conversationId,
          funnelId,
          supabase,
        )

        entry.condition_passed = condPassed

        if (!condPassed) {
          logs.push(entry)
          continue
        }

        // 4. Execute action
        const result = await executeAction(
          rule.action_type as ActionType,
          (rule.action_config as Record<string, unknown>) ?? {},
          conversationId,
          supabase,
        )

        entry.action_executed = true
        entry.action_result = result

        log.info('Rule executed', {
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action_type,
          result,
        })
      } catch (err) {
        entry.error = err instanceof Error ? err.message : String(err)
        log.error('Rule execution error', {
          rule_id: rule.id,
          rule_name: rule.name,
          error: entry.error,
        })
      }

      logs.push(entry)
    }
  } catch (err) {
    log.error('executeAutomationRules top-level error', {
      funnelId,
      triggerType,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return logs
}

// ────────────────────────────────────────────────────────────────────────────
// Trigger config matching
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that the trigger event data matches the rule's trigger_config constraints.
 * An empty config always matches (no constraints).
 */
function matchesTriggerConfig(
  triggerType: TriggerType,
  data: TriggerData,
  config: Record<string, unknown>,
): boolean {
  // No constraints → always match
  if (!config || Object.keys(config).length === 0) return true

  switch (triggerType) {
    case 'card_moved':
      // config.column_id: only fire when card moved TO this specific column
      if (config.column_id && data.column_id !== config.column_id) return false
      // config.from_column_id: only fire when coming FROM this column
      if (config.from_column_id && data.from_column_id !== config.from_column_id) return false
      return true

    case 'tag_added':
      // config.tag: only fire when this exact tag was added
      if (config.tag && data.tag !== config.tag) return false
      // config.tag_prefix: only fire when tag starts with this prefix
      if (config.tag_prefix && !(data.tag ?? '').startsWith(config.tag_prefix as string)) return false
      return true

    case 'label_applied':
      if (config.label && data.label !== config.label) return false
      return true

    case 'poll_answered':
      // config.poll_id: only fire for specific poll
      if (config.poll_id && data.poll_id !== config.poll_id) return false
      // config.option: only fire when lead chose this option
      if (config.option) {
        const chosen = (data.options ?? []) as string[]
        if (!chosen.includes(config.option as string)) return false
      }
      return true

    case 'form_completed':
      if (config.form_slug && data.form_slug !== config.form_slug) return false
      return true

    // lead_created, conversation_resolved have no sub-filters by default
    default:
      return true
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Condition evaluation
// ────────────────────────────────────────────────────────────────────────────

async function evaluateCondition(
  conditionType: ConditionType,
  config: Record<string, unknown>,
  conversationId: string | null,
  funnelId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  switch (conditionType) {
    case 'always':
      return true

    case 'tag_contains': {
      if (!conversationId) return true
      const tag = config.tag as string | undefined
      if (!tag) return true

      const { data: conv } = await supabase
        .from('conversations')
        .select('tags')
        .eq('id', conversationId)
        .single()

      if (!conv?.tags) return false
      const tags: string[] = Array.isArray(conv.tags) ? conv.tags : []
      // Support partial match (e.g. config.tag = 'motivo:' matches 'motivo:compra')
      return tags.some((t) => t === tag || t.startsWith(tag))
    }

    case 'funnel_is': {
      // True when the conversation's active funnel matches config.funnel_id
      const configFunnelId = config.funnel_id as string | undefined
      if (!configFunnelId) return true
      return funnelId === configFunnelId
    }

    case 'business_hours': {
      // Simplified check: weekdays 08:00-18:00 (America/Sao_Paulo)
      // config.inside: true (default) → pass when INSIDE hours
      //                false          → pass when OUTSIDE hours
      const nowBR = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
      const brDate = new Date(nowBR)
      const hour = brDate.getHours()
      const day = brDate.getDay() // 0=sun, 1=mon...6=sat

      // Support custom hours from config
      const startHour = typeof config.start_hour === 'number' ? config.start_hour : 8
      const endHour = typeof config.end_hour === 'number' ? config.end_hour : 18
      const workDays: number[] = Array.isArray(config.work_days)
        ? (config.work_days as number[])
        : [1, 2, 3, 4, 5] // Mon-Fri

      const isBusinessDay = workDays.includes(day)
      const isBusinessHour = hour >= startHour && hour < endHour
      const isInsideHours = isBusinessDay && isBusinessHour

      // config.inside defaults to true (check we're inside hours)
      const checkInside = config.inside !== false
      return checkInside ? isInsideHours : !isInsideHours
    }

    default:
      log.warn('Unknown condition type — defaulting to true', { conditionType })
      return true
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Action execution
// ────────────────────────────────────────────────────────────────────────────

async function executeAction(
  actionType: ActionType,
  config: Record<string, unknown>,
  conversationId: string | null,
  supabase: SupabaseClient,
): Promise<string> {
  switch (actionType) {

    // ── send_message ─────────────────────────────────────────────────────────
    case 'send_message': {
      if (!conversationId) return 'skip: no conversation_id'
      const message = config.message as string | undefined
      if (!message?.trim()) return 'skip: no message configured'

      // Load conversation + instance token
      const { data: conv } = await supabase
        .from('conversations')
        .select('contact_id, instance_id, contacts(jid, phone)')
        .eq('id', conversationId)
        .single()

      if (!conv) return 'skip: conversation not found'

      const { data: inst } = await supabase
        .from('instances')
        .select('token')
        .eq('id', conv.instance_id)
        .maybeSingle()

      if (!inst?.token) return 'skip: instance token not found'

      const contact = (conv as any).contacts
      const jid = contact?.jid || contact?.phone

      if (!jid) return 'skip: contact jid not found'

      const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

      try {
        const res = await fetch(`${uazapiUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': inst.token },
          body: JSON.stringify({ number: jid, text: message, delay: 1500 }),
        })

        if (res.ok) {
          // Persist to DB
          await supabase.from('conversation_messages').insert({
            conversation_id: conversationId,
            direction: 'outgoing',
            content: message,
            media_type: 'text',
            external_id: `auto_${Date.now()}`,
          })
          return `sent_message: "${message.substring(0, 60)}"`
        }

        const errBody = await res.text()
        log.warn('send_message action: UAZAPI returned error', { status: res.status, body: errBody.substring(0, 100) })
        return `send_failed: status ${res.status}`
      } catch (err) {
        log.error('send_message action: network error', { error: (err as Error).message })
        return `send_error: ${(err as Error).message}`
      }
    }

    // ── move_card ─────────────────────────────────────────────────────────────
    case 'move_card': {
      if (!conversationId) return 'skip: no conversation_id'
      const columnId = config.column_id as string | undefined
      if (!columnId) return 'skip: no column_id configured'

      // Get contact_id from conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .single()

      if (!conv?.contact_id) return 'skip: conversation has no contact_id'

      const { error } = await supabase
        .from('kanban_cards')
        .update({ column_id: columnId, updated_at: new Date().toISOString() })
        .eq('contact_id', conv.contact_id)

      if (error) {
        log.warn('move_card action: update failed', { error: error.message })
        return `move_failed: ${error.message}`
      }

      return `moved_card_to_column: ${columnId}`
    }

    // ── add_tag ───────────────────────────────────────────────────────────────
    case 'add_tag': {
      if (!conversationId) return 'skip: no conversation_id'
      const newTag = config.tag as string | undefined
      if (!newTag?.trim()) return 'skip: no tag configured'

      const { data: conv } = await supabase
        .from('conversations')
        .select('tags')
        .eq('id', conversationId)
        .single()

      const existingTags: string[] = Array.isArray(conv?.tags) ? conv.tags : []

      // Avoid duplicate tags (key:value → replace if same key)
      const newKey = newTag.split(':')[0]
      const filtered = existingTags.filter((t) => t.split(':')[0] !== newKey)
      const updatedTags = [...filtered, newTag]

      await supabase
        .from('conversations')
        .update({ tags: updatedTags })
        .eq('id', conversationId)

      return `added_tag: ${newTag}`
    }

    // ── activate_ai ───────────────────────────────────────────────────────────
    case 'activate_ai': {
      if (!conversationId) return 'skip: no conversation_id'

      await supabase
        .from('conversations')
        .update({ status_ia: 'ligada' })
        .eq('id', conversationId)

      return 'ai_activated: status_ia=ligada'
    }

    // ── handoff ───────────────────────────────────────────────────────────────
    case 'handoff': {
      if (!conversationId) return 'skip: no conversation_id'

      const updates: Record<string, unknown> = { status_ia: 'shadow' }
      if (config.department_id) updates.department_id = config.department_id
      if (config.assigned_to) updates.assigned_to = config.assigned_to

      await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)

      return `handoff_executed: shadow mode${config.department_id ? ` → dept ${config.department_id}` : ''}`
    }

    // ── send_poll (M17 F4: Enquetes/Polls via UAZAPI /send/menu type=poll) ──────────────
    case 'send_poll': {
      if (!conversationId) return 'skip: no conversation_id'
      const question = config.question as string | undefined
      const options = config.options as string[] | undefined
      if (!question?.trim() || !options || options.length < 2) return 'skip: invalid poll config'

      const { data: conv } = await supabase
        .from('conversations')
        .select('contact_id, instance_id, contacts(jid, phone)')
        .eq('id', conversationId)
        .single()

      if (!conv) return 'skip: conversation not found'

      const { data: inst } = await supabase
        .from('instances')
        .select('token')
        .eq('id', conv.instance_id)
        .maybeSingle()

      if (!inst?.token) return 'skip: instance token not found'

      const contact = (conv as any).contacts
      const jid = contact?.jid || contact?.phone
      if (!jid) return 'skip: contact jid not found'

      const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
      const sc = (config.selectable_count as number) ?? 1

      try {
        // D1: Image before poll if configured
        if (config.image_url) {
          await fetch(`${uazapiUrl}/send/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': inst.token },
            body: JSON.stringify({ number: jid, type: 'image', file: config.image_url, text: '', delay: 1500 }),
          })
          await new Promise(r => setTimeout(r, 1500))
        }

        const res = await fetch(`${uazapiUrl}/send/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': inst.token },
          body: JSON.stringify({ number: jid, type: 'poll', text: question, choices: options, selectableCount: sc }),
        })

        if (res.ok) {
          let msgId: string | null = null
          try { const j = await res.json(); msgId = j.messageId || j.MessageId || null } catch {}

          // Save poll
          await supabase.from('poll_messages').insert({
            conversation_id: conversationId,
            instance_id: conv.instance_id,
            message_id: msgId,
            question,
            options,
            selectable_count: sc,
            auto_tags: (config.auto_tags as Record<string, string>) || {},
            image_url: (config.image_url as string) || null,
            funnel_id: funnelId,
          })

          // Persist to helpdesk
          await supabase.from('conversation_messages').insert({
            conversation_id: conversationId,
            direction: 'outgoing',
            content: question,
            media_type: 'poll',
            media_url: JSON.stringify({ question, options, selectable_count: sc }),
            external_id: `auto_poll_${Date.now()}`,
          })

          return `sent_poll: "${question.substring(0, 60)}" (${options.length} options)`
        }
        return `send_poll_failed: ${res.status}`
      } catch (err) {
        log.error('send_poll action error', { error: (err as Error).message })
        return `send_poll_error: ${(err as Error).message}`
      }
    }

    default: {
      log.warn('Unknown action type', { actionType })
      return `unknown_action: ${actionType}`
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// M17 F5: NPS Auto-trigger — called when conversation is resolved
// ═══════════════════════════════════════════════════════════════════════════
export async function triggerNpsIfEnabled(
  conversationId: string,
  instanceId: string,
  supabase: SupabaseClient,
): Promise<string> {
  try {
    // Load agent NPS config
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('poll_nps_enabled, poll_nps_delay_minutes, poll_nps_question, poll_nps_options, poll_nps_notify_on_bad')
      .eq('instance_id', instanceId)
      .maybeSingle()

    if (!agent?.poll_nps_enabled) return 'skip: nps_disabled'

    // D6: Don't send if conversation had frustration handoff
    const { data: conv } = await supabase
      .from('conversations')
      .select('tags, contact_id, contacts(jid, phone)')
      .eq('id', conversationId)
      .single()

    if (!conv) return 'skip: conversation_not_found'

    const tags: string[] = conv.tags || []
    if (tags.some(t => t.includes('sentimento:negativo'))) {
      log.info('NPS skipped: negative sentiment', { conversationId })
      return 'skip: negative_sentiment'
    }

    const contact = (conv as any).contacts
    const jid = contact?.jid || contact?.phone
    if (!jid) return 'skip: no_contact_jid'

    // Load instance token
    const { data: inst } = await supabase
      .from('instances')
      .select('token')
      .eq('id', instanceId)
      .maybeSingle()

    if (!inst?.token) return 'skip: no_instance_token'

    const delayMs = ((agent.poll_nps_delay_minutes as number) || 5) * 60 * 1000
    const question = (agent.poll_nps_question as string) || 'Como voce avalia nosso atendimento?'
    const options: string[] = (agent.poll_nps_options as string[]) || ['Excelente', 'Bom', 'Regular', 'Ruim', 'Pessimo']
    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

    // Schedule with delay (setTimeout for Deno edge function — fire and forget)
    setTimeout(async () => {
      try {
        const res = await fetch(`${uazapiUrl}/send/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': inst.token },
          body: JSON.stringify({ number: jid, type: 'poll', text: question, choices: options, selectableCount: 1 }),
        })

        if (res.ok) {
          let msgId: string | null = null
          try { const j = await res.json(); msgId = j.messageId || j.MessageId || null } catch {}

          await supabase.from('poll_messages').insert({
            conversation_id: conversationId,
            instance_id: instanceId,
            message_id: msgId,
            question,
            options,
            selectable_count: 1,
            is_nps: true,
          })

          await supabase.from('conversation_messages').insert({
            conversation_id: conversationId,
            direction: 'outgoing',
            content: question,
            media_type: 'poll',
            media_url: JSON.stringify({ question, options, selectable_count: 1 }),
            external_id: `nps_${Date.now()}`,
          })

          log.info('NPS poll sent', { conversationId, delay: delayMs })
        }
      } catch (err) {
        log.error('NPS send error', { error: (err as Error).message, conversationId })
      }
    }, delayMs)

    return `nps_scheduled: ${delayMs}ms delay`
  } catch (err) {
    log.error('triggerNpsIfEnabled error', { error: (err as Error).message })
    return `nps_error: ${(err as Error).message}`
  }
}
