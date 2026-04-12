// =============================================================================
// Flow Resolver (S4)
// Determina qual fluxo ativar para uma mensagem recebida.
//
// 5 fases:
//   1. Busca triggers por priority DESC (index: idx_flow_triggers_priority)
//   2. Lead em fluxo ativo? Retorna o estado atual (curto-circuito)
//   3. matchTrigger() por tipo — MVP S4: keyword | message_received | lead_created
//   4. checkCooldown() — consulta flow_events para janela de cooldown real
//   5. Fallback — fluxo padrão da instância (is_default = true)
//
// S7: adicionar 'intent' ao matchTrigger() quando IntentDetector estiver pronto
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState, IntentDetectorResult } from '../types.ts'

const supabase = createServiceClient()

// ── Resolve o fluxo ativo para uma mensagem ───────────────────────────────────

export async function resolveFlow(
  instanceId: string,
  leadId: string,
  messageText: string,
  isLeadCreated = false,
  intents?: IntentDetectorResult,   // S7: intents detectados
): Promise<{ flowId: string; state: ActiveFlowState | null } | null> {

  // Fase 2: Lead já tem fluxo ativo? Retorna o estado atual
  const existing = await getActiveFlowState(leadId)
  if (existing) {
    return { flowId: existing.flow_id, state: existing }
  }

  // Fase 1: Busca triggers por priority DESC (usa index idx_flow_triggers_priority)
  const { data: triggers } = await supabase
    .from('flow_triggers')
    .select('id, flow_id, trigger_type, priority, cooldown_minutes, activation, trigger_config, is_active')
    .eq('instance_id', instanceId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!triggers || triggers.length === 0) {
    return getDefaultFlow(instanceId)
  }

  // Fase 3 + 4: matchTrigger() + cooldown para cada trigger em ordem de prioridade
  for (const trigger of triggers) {
    // Fase 3: verifica se a mensagem bate com o tipo de gatilho
    if (!matchTrigger(trigger, messageText, isLeadCreated, intents)) continue

    // Fase 4a: verifica janela de ativação (business_hours etc.)
    if (!checkActivation(trigger.activation as string)) continue

    // Fase 4b: verifica cooldown real
    const inCooldown = trigger.cooldown_minutes > 0
      ? await checkCooldown(leadId, trigger.flow_id, trigger.cooldown_minutes as number)
      : false

    if (inCooldown) {
      console.log(
        `[flowResolver] trigger ${trigger.id} em cooldown (${trigger.cooldown_minutes}min) para lead ${leadId}`,
      )
      continue
    }

    return { flowId: trigger.flow_id, state: null }
  }

  // Fase 5: Fallback — fluxo padrão da instância
  return getDefaultFlow(instanceId)
}

// ── Match de gatilho ──────────────────────────────────────────────────────────

function matchTrigger(
  trigger: Record<string, unknown>,
  messageText: string,
  isLeadCreated: boolean,
  intents?: IntentDetectorResult,
): boolean {
  const config = (trigger.trigger_config as Record<string, unknown>) ?? {}

  switch (trigger.trigger_type as string) {
    case 'keyword': {
      const keywords: string[] = (config.keywords as string[]) ?? []
      if (keywords.length === 0) return false
      const normalized = normalizeText(messageText)
      const matchMode = (config.match as string) ?? 'any'

      if (matchMode === 'all') {
        return keywords.every((kw) => normalized.includes(normalizeText(kw)))
      }
      // 'any' (padrão): basta 1 keyword bater
      return keywords.some((kw) => normalized.includes(normalizeText(kw)))
    }

    case 'message_received': {
      return messageText.trim().length > 0
    }

    case 'conversation_started': {
      return messageText.trim().length > 0
    }

    case 'lead_created': {
      return isLeadCreated
    }

    case 'intent': {
      // S7: verifica intents detectados contra trigger_config.intents[]
      if (!intents?.primary) return false
      const requiredIntents: string[] = (config.intents as string[]) ?? []
      if (requiredIntents.length === 0) return false
      const minConfidence = (config.min_confidence as number) ?? 70

      // Keywords como boost: match exato → confidence += 10
      const boostKeywords: string[] = (config.keywords as string[]) ?? []
      let boost = 0
      if (boostKeywords.length > 0) {
        const normalized = normalizeText(messageText)
        const hasKeyword = boostKeywords.some((kw) => normalized.includes(normalizeText(kw)))
        if (hasKeyword) boost = 10
      }

      // Verifica se algum intent detectado está na lista + atinge min_confidence
      return intents.intents.some(
        (di) => requiredIntents.includes(di.intent) && (di.confidence + boost) >= minConfidence,
      )
    }

    default:
      // bio_link, utm_campaign, qr_code, tag_added, poll_answered,
      // funnel_entered, webhook_received, schedule, api → S10+
      return false
  }
}

// ── Verificação de janela de ativação ─────────────────────────────────────────

function checkActivation(activation: string): boolean {
  switch (activation) {
    case 'always':
      return true

    case 'business_hours': {
      // S5: implementar com horário configurado por instância
      // Por ora: retorna true para não bloquear (conservador)
      return true
    }

    case 'outside_hours': {
      // S5: implementar
      return true
    }

    case 'custom':
      // S5: implementar com cron expression
      return true

    default:
      return true
  }
}

// ── Verificação de cooldown real ──────────────────────────────────────────────
// Consulta flow_events para ver se o lead iniciou este flow dentro da janela

async function checkCooldown(
  leadId: string,
  flowId: string,
  cooldownMinutes: number,
): Promise<boolean> {
  if (cooldownMinutes <= 0) return false

  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('flow_events')
    .select('id')
    .eq('lead_id', leadId)
    .eq('flow_id', flowId)
    .eq('event_type', 'flow_started')
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()

  return !!data  // true = dentro do cooldown (bloquear)
}

// ── Normalização de texto para matching de keywords ───────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .trim()
}

// ── Busca fluxo padrão da instância ─────────────────────────────────────────

async function getDefaultFlow(
  instanceId: string,
): Promise<{ flowId: string; state: null } | null> {
  const { data: flow } = await supabase
    .from('flows')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('is_default', true)
    .eq('status', 'active')
    .not('published_at', 'is', null)
    .maybeSingle()

  return flow ? { flowId: flow.id, state: null } : null
}

// ── Busca estado ativo do lead (qualquer flow) ────────────────────────────────

export async function getActiveFlowState(leadId: string): Promise<ActiveFlowState | null> {
  const { data } = await supabase
    .from('flow_states')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as ActiveFlowState | null
}
