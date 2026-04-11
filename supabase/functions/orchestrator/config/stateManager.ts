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
  flowVersion: number,
  firstStepId: string | null,
): Promise<ActiveFlowState | null> {
  const { data, error } = await supabase
    .from('flow_states')
    .insert({
      lead_id: leadId,
      flow_id: flowId,
      flow_version: flowVersion,
      current_step_id: firstStepId,
      status: 'active',
      step_data: {},
    })
    .select('*')
    .single()

  if (error) {
    console.error('[stateManager] createFlowState error:', error.message)
    return null
  }
  return data as ActiveFlowState
}

// ── Atualiza step_data e/ou current_step_id (patch parcial) ─────────────────

export async function updateFlowState(
  stateId: string,
  patch: {
    current_step_id?: string | null
    status?: ActiveFlowState['status']
    step_data_patch?: Partial<StepData>
  },
): Promise<boolean> {
  // Busca step_data atual para merge
  const { data: current } = await supabase
    .from('flow_states')
    .select('step_data')
    .eq('id', stateId)
    .single()

  const mergedStepData = {
    ...(current?.step_data ?? {}),
    ...(patch.step_data_patch ?? {}),
  }

  const update: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  }
  if (patch.current_step_id !== undefined) update.current_step_id = patch.current_step_id
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

export async function logFlowEvent(
  flowStateId: string,
  leadId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from('flow_events').insert({
    flow_state_id: flowStateId,
    lead_id: leadId,
    event_type: eventType,
    event_data: eventData,
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
