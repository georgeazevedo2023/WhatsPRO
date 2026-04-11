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
    fetchStepConfig(state.current_step_id),
    fetchExitRules(state.current_step_id),
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

async function fetchLeadContext(leadId: string): Promise<LeadContext | null> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, custom_fields, tags, origin')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) return null

  return {
    lead_id: lead.id,
    lead_name: lead.name ?? null,
    lead_phone: lead.phone,
    custom_fields: (lead.custom_fields as Record<string, unknown>) ?? {},
    tags: (lead.tags as string[]) ?? [],
    origin: lead.origin ?? null,
    // short_memory / long_memory: injetados pelo Memory Service (S5)
  }
}

// ── Busca configuração do step atual ─────────────────────────────────────────

async function fetchStepConfig(stepId: string | null): Promise<Record<string, unknown>> {
  if (!stepId) return {}

  const { data: step } = await supabase
    .from('flow_steps')
    .select('step_type, step_config, exit_rules')
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
): Promise<{ id: string; step_type: string } | null> {
  const { data: step } = await supabase
    .from('flow_steps')
    .select('id, step_type')
    .eq('flow_id', flowId)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  return step ?? null
}
