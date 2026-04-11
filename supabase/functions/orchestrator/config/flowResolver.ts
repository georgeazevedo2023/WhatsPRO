// =============================================================================
// Flow Resolver (S2 — skeleton)
// Determina qual fluxo ativar para uma mensagem recebida.
// 5 fases: triggers por priority → lead em fluxo ativo? → matchTrigger() →
//          checar cooldown → fallback is_default=true
// MVP (S4): keyword | intent | message_received | lead_created
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState } from '../types.ts'

const supabase = createServiceClient()

// ── Fase 1-5: Resolve o fluxo ativo para uma mensagem ───────────────────────

export async function resolveFlow(
  instanceId: string,
  leadId: string,
  messageText: string,
): Promise<{ flowId: string; state: ActiveFlowState | null } | null> {
  // Fase 2: Lead já tem fluxo ativo? Retorna o estado atual
  const existing = await getActiveFlowState(leadId)
  if (existing) {
    return { flowId: existing.flow_id, state: existing }
  }

  // Fase 1: Busca triggers por priority DESC
  const { data: triggers } = await supabase
    .from('flow_triggers')
    .select('id, flow_id, trigger_type, priority, cooldown_minutes, trigger_config, is_active')
    .eq('instance_id', instanceId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!triggers || triggers.length === 0) {
    return await getDefaultFlow(instanceId)
  }

  // Fase 3: matchTrigger() para cada trigger (MVP: keyword e message_received)
  for (const trigger of triggers) {
    if (matchTrigger(trigger, messageText)) {
      // Fase 4: Checar cooldown (stub S2 — sempre passa)
      return { flowId: trigger.flow_id, state: null }
    }
  }

  // Fase 5: Fallback — fluxo padrão da instância
  return await getDefaultFlow(instanceId)
}

// ── Match de gatilho (MVP: keyword + message_received) ───────────────────────

function matchTrigger(trigger: Record<string, unknown>, messageText: string): boolean {
  const config = (trigger.trigger_config as Record<string, unknown>) ?? {}

  switch (trigger.trigger_type) {
    case 'keyword': {
      const keywords: string[] = (config.keywords as string[]) ?? []
      const normalized = messageText.toLowerCase().trim()
      return keywords.some(kw => normalized.includes(kw.toLowerCase()))
    }
    case 'message_received': {
      // Ativa em qualquer mensagem (first_message_only tratado em S5)
      return true
    }
    case 'lead_created': {
      // Tratado no evento de criação do lead, não aqui
      return false
    }
    default:
      // intent, form_completed, etc. — implementar em S7+
      return false
  }
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

// ── Busca estado ativo do lead ───────────────────────────────────────────────

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
