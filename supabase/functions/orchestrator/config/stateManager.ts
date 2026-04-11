// =============================================================================
// State Manager (S2 — skeleton)
// CRUD para flow_states e flow_events.
// S2: operações diretas via supabase-js (sem RPC).
// S4: operações atômicas via RPC upsert_flow_state(p_lead_id, p_flow_id, p_step_id, p_patch)
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState, StepData, SubagentResult } from '../types.ts'

const supabase = createServiceClient()

// ── Cria novo flow_state para um lead ────────────────────────────────────────

export async function createFlowState(
  leadId: string,
  flowId: string,
  instanceId: string,
  flowVersion: number,
  firstStepId: string | null,
  conversationId?: string,
): Promise<ActiveFlowState | null> {
  const { data, error } = await supabase
    .from('flow_states')
    .insert({
      lead_id: leadId,
      flow_id: flowId,
      instance_id: instanceId,          // Fix: NOT NULL sem default
      flow_version: flowVersion,
      flow_step_id: firstStepId,        // Fix: era current_step_id
      status: 'active',
      step_data: {},
      ...(conversationId ? { conversation_id: conversationId } : {}),
    })
    .select('*')
    .maybeSingle()                       // Fix: era .single() → crash se insert falha

  if (error) {
    console.error('[stateManager] createFlowState error:', error.message)
    return null
  }
  return data as ActiveFlowState | null
}

// ── Atualiza step_data e/ou flow_step_id (patch parcial) ─────────────────────

export async function updateFlowState(
  stateId: string,
  patch: {
    flow_step_id?: string | null        // Fix: era current_step_id
    status?: ActiveFlowState['status']
    step_data_patch?: Partial<StepData>
  },
): Promise<boolean> {
  // Busca step_data atual para merge
  const { data: current, error: fetchError } = await supabase
    .from('flow_states')
    .select('step_data')
    .eq('id', stateId)
    .maybeSingle()                       // Fix: era .single() → crash se row não existe

  if (fetchError) {
    console.error('[stateManager] updateFlowState fetch error:', fetchError.message)
    return false
  }

  const mergedStepData = {
    ...(current?.step_data ?? {}),
    ...(patch.step_data_patch ?? {}),
  }

  const update: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  }
  if (patch.flow_step_id !== undefined) update.flow_step_id = patch.flow_step_id  // Fix
  if (patch.status !== undefined) update.status = patch.status
  if (patch.step_data_patch) update.step_data = mergedStepData

  const { error } = await supabase
    .from('flow_states')
    .update(update)
    .eq('id', stateId)

  if (error) {
    console.error('[stateManager] updateFlowState error:', error.message)
    return false
  }
  return true
}

// ── Finaliza flow_state (status = completed | handoff | abandoned) ────────────

export async function finalizeFlowState(
  stateId: string,
  status: 'completed' | 'handoff' | 'abandoned',
): Promise<boolean> {
  return updateFlowState(stateId, { status })
}

// ── Registra evento no flow_events ───────────────────────────────────────────
// Válidos: flow_started | step_entered | step_exited | intent_detected |
//          handoff_triggered | tool_called | validator_flagged |
//          flow_completed | flow_abandoned | error

export async function logFlowEvent(
  flowStateId: string,
  flowId: string,                        // Fix: obrigatório (NOT NULL FK)
  instanceId: string,                    // Fix: obrigatório (NOT NULL FK)
  leadId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
  stepId?: string | null,
): Promise<void> {
  const { error } = await supabase.from('flow_events').insert({
    flow_state_id: flowStateId,
    flow_id: flowId,                     // Fix: campo obrigatório
    instance_id: instanceId,             // Fix: campo obrigatório
    lead_id: leadId,
    event_type: eventType,
    input: Object.keys(eventData).length > 0 ? eventData : null,  // Fix: era event_data (não existe)
    ...(stepId ? { step_id: stepId } : {}),
  })

  if (error) {
    // Não propagar — evento é best-effort
    console.error('[stateManager] logFlowEvent error:', error.message)
  }
}

// ── Aplica resultado do subagente no state ────────────────────────────────────

export async function applySubagentResult(
  state: ActiveFlowState,
  result: SubagentResult,
): Promise<boolean> {
  return updateFlowState(state.id, {
    step_data_patch: result.step_data_patch ?? {},
  })
}
