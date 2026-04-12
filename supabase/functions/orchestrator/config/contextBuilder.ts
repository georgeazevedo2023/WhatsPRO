// =============================================================================
// Context Builder (S5)
// Monta FlowContext a partir do lead, flow_state, step_config, exit_rules
// e memória curta/longa (Memory Service real — S5).
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState, FlowContext, LeadContext, ExitRule, OrchestratorInput, IntentDetectorResult, DetectedIntent, AgentConfig } from '../types.ts'
import { loadMemory } from '../services/memory.ts'

const supabase = createServiceClient()

// ── Monta contexto completo para o subagente ─────────────────────────────────

export async function buildContext(
  input: OrchestratorInput,
  state: ActiveFlowState,
  intents?: IntentDetectorResult,
): Promise<FlowContext | null> {
  const [lead, stepConfig, exitRules, memory, agentConfig] = await Promise.all([
    fetchLeadContext(state.lead_id),
    fetchStepConfig(state.flow_step_id),
    fetchExitRules(state.flow_step_id),
    loadMemory(state.lead_id, state.instance_id),   // S5: Memory Service real
    fetchAgentConfig(state.instance_id),             // S8: agent_id + config para sales/support
  ])

  if (!lead) {
    console.error('[contextBuilder] Lead not found:', state.lead_id)
    return null
  }

  // S5: injeta memória no contexto do lead
  lead.short_memory = memory.short_memory
  lead.long_memory  = memory.long_memory

  // S7: injeta intents detectados no intent_history (append)
  if (intents?.intents?.length) {
    const currentHistory: DetectedIntent[] = (state.step_data?.intent_history as DetectedIntent[]) ?? []
    state.step_data = {
      ...state.step_data,
      intent_history: [...currentHistory, ...intents.intents],
    }
  }

  return {
    input,
    flow_state: state,
    lead,
    step_config: stepConfig,
    exit_rules: exitRules,
    agent_config: agentConfig ?? undefined,
  }
}

// ── Busca dados do lead ───────────────────────────────────────────────────────
// Schema real:
//   lead_profiles.id = leadId (flow_states.lead_id)
//   lead_profiles.contact_id → contacts.id (tem phone, name)
//   lead_profiles: full_name, custom_fields (jsonb), tags (jsonb), origin

async function fetchLeadContext(leadId: string): Promise<LeadContext | null> {
  const { data: profile } = await supabase
    .from('lead_profiles')
    .select('id, full_name, contact_id, custom_fields, tags, origin, contacts(phone, name, jid)')
    .eq('id', leadId)
    .maybeSingle()

  if (!profile) return null

  const contact = Array.isArray(profile.contacts)
    ? profile.contacts[0]
    : profile.contacts as { phone?: string; name?: string; jid?: string } | null

  return {
    lead_id: profile.id,
    lead_name: profile.full_name ?? contact?.name ?? null,
    lead_phone: contact?.phone ?? '',
    lead_jid: contact?.jid ?? '',   // S5: usado pelo sendToLead em UAZAPI
    custom_fields: (profile.custom_fields as Record<string, unknown>) ?? {},
    tags: Array.isArray(profile.tags)
      ? (profile.tags as string[])
      : Object.keys((profile.tags as Record<string, unknown>) ?? {}),
    origin: profile.origin ?? null,
    // short_memory / long_memory: injetados após esta chamada em buildContext
  }
}

// ── Busca configuração do step atual ─────────────────────────────────────────

async function fetchStepConfig(stepId: string | null): Promise<Record<string, unknown>> {
  if (!stepId) return {}

  const { data: step } = await supabase
    .from('flow_steps')
    .select('subagent_type, step_config, exit_rules')
    .eq('id', stepId)
    .maybeSingle()

  if (!step) return {}

  // Injeta subagent_type no step_config para que getStepType() possa lê-lo
  // (subagent_type é coluna separada — não fica dentro do JSONB step_config)
  return {
    subagent_type: step.subagent_type ?? null,
    ...((step.step_config as Record<string, unknown>) ?? {}),
  }
}

// ── Busca exit_rules do step atual ───────────────────────────────────────────

async function fetchExitRules(stepId: string | null): Promise<ExitRule[]> {
  if (!stepId) return []

  const { data: step } = await supabase
    .from('flow_steps')
    .select('exit_rules')
    .eq('id', stepId)
    .maybeSingle()

  if (!step?.exit_rules) return []
  return step.exit_rules as ExitRule[]
}

// ── Busca config do agente IA pela instance_id ──────────────────────────────
// S8: sales precisa de agent_id (para search_products_fuzzy) e carousel_button_*
//      support precisa de agent_id (para ai_agent_knowledge)

async function fetchAgentConfig(instanceId: string): Promise<AgentConfig | null> {
  const { data: agent } = await supabase
    .from('ai_agents')
    .select('id, system_prompt, personality, carousel_button_1, carousel_button_2, max_discount_percent')
    .eq('instance_id', instanceId)
    .eq('enabled', true)
    .limit(1)
    .maybeSingle()

  if (!agent) return null

  return {
    agent_id: agent.id,
    system_prompt: agent.system_prompt ?? '',
    personality: agent.personality ?? undefined,
    carousel_button_1: agent.carousel_button_1 ?? undefined,
    carousel_button_2: agent.carousel_button_2 ?? undefined,
    max_discount_percent: agent.max_discount_percent ?? undefined,
  }
}

// ── Busca o primeiro step de um fluxo ────────────────────────────────────────

export async function fetchFirstStep(
  flowId: string,
): Promise<{ id: string; subagent_type: string } | null> {
  const { data: step } = await supabase
    .from('flow_steps')
    .select('id, subagent_type')   // Fix: era step_type (coluna não existe em flow_steps)
    .eq('flow_id', flowId)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  return step ?? null
}
