// =============================================================================
// Context Builder (S2 — skeleton)
// Monta FlowContext a partir do lead, flow_state, step_config e exit_rules.
// S2: busca dados básicos do lead e do step (sem memória).
// S5: Memory Service injeta short_memory + long_memory aqui.
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState, FlowContext, LeadContext, ExitRule, OrchestratorInput } from '../types.ts'

const supabase = createServiceClient()

// ── Monta contexto completo para o subagente ─────────────────────────────────

export async function buildContext(
  input: OrchestratorInput,
  state: ActiveFlowState,
): Promise<FlowContext | null> {
  const [lead, stepConfig, exitRules] = await Promise.all([
    fetchLeadContext(state.lead_id),
    fetchStepConfig(state.flow_step_id),
    fetchExitRules(state.flow_step_id),
  ])

  if (!lead) {
    console.error('[contextBuilder] Lead not found:', state.lead_id)
    return null
  }

  return {
    input,
    flow_state: state,
    lead,
    step_config: stepConfig,
    exit_rules: exitRules,
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
    .select('id, full_name, contact_id, custom_fields, tags, origin, contacts(phone, name)')
    .eq('id', leadId)
    .maybeSingle()

  if (!profile) return null

  const contact = Array.isArray(profile.contacts)
    ? profile.contacts[0]
    : profile.contacts as { phone?: string; name?: string } | null

  return {
    lead_id: profile.id,
    lead_name: profile.full_name ?? contact?.name ?? null,
    lead_phone: contact?.phone ?? '',
    custom_fields: (profile.custom_fields as Record<string, unknown>) ?? {},
    tags: Array.isArray(profile.tags)
      ? (profile.tags as string[])
      : Object.keys((profile.tags as Record<string, unknown>) ?? {}),
    origin: profile.origin ?? null,
    // short_memory / long_memory: injetados pelo Memory Service (S5)
  }
}

// ── Busca configuração do step atual ─────────────────────────────────────────

async function fetchStepConfig(stepId: string | null): Promise<Record<string, unknown>> {
  if (!stepId) return {}

  const { data: step } = await supabase
    .from('flow_steps')
    .select('subagent_type, step_config, exit_rules')   // Fix: era step_type (não existe)
    .eq('id', stepId)
    .maybeSingle()

  if (!step) return {}
  return (step.step_config as Record<string, unknown>) ?? {}
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
