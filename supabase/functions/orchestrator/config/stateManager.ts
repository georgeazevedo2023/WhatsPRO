// =============================================================================
// State Manager (S4)
// CRUD para flow_states e flow_events.
//
// S4 — createFlowState atômica:
//   INSERT ... ON CONFLICT ON CONSTRAINT uq_flow_states_active_lead_flow DO NOTHING RETURNING
//   → se RETURNING vazio (race condition ganhou outra req): SELECT estado existente
//   → resultado: sempre retorna o estado ativo, nunca duplica
//
// Constraint no banco: uq_flow_states_active_lead_flow
//   UNIQUE (lead_id, flow_id) WHERE status = 'active'
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { ActiveFlowState, StepData, SubagentResult, TimerBreakdown, CostBreakdown } from '../types.ts'

const supabase = createServiceClient()

// ── Cria novo flow_state — atômico via ON CONFLICT ────────────────────────────

export async function createFlowState(
  leadId: string,
  flowId: string,
  instanceId: string,
  flowVersion: number,
  firstStepId: string | null,
  conversationId?: string,
): Promise<ActiveFlowState | null> {
  // Tenta inserir — ON CONFLICT faz nada se já existe estado ativo para (lead, flow)
  const { data, error } = await supabase
    .from('flow_states')
    .insert({
      lead_id: leadId,
      flow_id: flowId,
      instance_id: instanceId,
      flow_version: flowVersion,
      flow_step_id: firstStepId,
      status: 'active',
      // Não passa step_data: deixa o DEFAULT do banco aplicar
      // { message_count:0, total_message_count:0, ... } — evita undefined em checks
      ...(conversationId ? { conversation_id: conversationId } : {}),
    })
    .select('*')
    .maybeSingle()

  // Se insert retornou data = novo estado criado com sucesso
  if (data) return data as ActiveFlowState

  // Se houve conflito (unique constraint) OU erro de insert → busca estado existente
  if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
    // Erro real que não é conflito — loga e retorna null
    console.error('[stateManager] createFlowState unexpected error:', error.message)
    return null
  }

  // Race condition: outro processo criou o estado primeiro → retorna o existente
  const existing = await getActiveFlowState(leadId, flowId)
  if (existing) return existing

  console.error('[stateManager] createFlowState: could not create or find state')
  return null
}

// ── Busca estado ativo do lead para um flow específico ────────────────────────

export async function getActiveFlowState(
  leadId: string,
  flowId?: string,
): Promise<ActiveFlowState | null> {
  let query = supabase
    .from('flow_states')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'active')

  if (flowId) query = query.eq('flow_id', flowId)

  const { data } = await query
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as ActiveFlowState | null
}

// ── Atualiza step_data e/ou flow_step_id (patch parcial) ─────────────────────

export async function updateFlowState(
  stateId: string,
  patch: {
    flow_step_id?: string | null
    status?: ActiveFlowState['status']
    step_data_patch?: Partial<StepData>
    completed_steps_append?: string   // step_id a adicionar em completed_steps
    increment_message_count?: boolean // incrementa message_count + total_message_count
  },
): Promise<boolean> {
  // Busca state atual para merge
  const { data: current, error: fetchError } = await supabase
    .from('flow_states')
    .select('step_data, completed_steps')
    .eq('id', stateId)
    .maybeSingle()

  if (fetchError) {
    console.error('[stateManager] updateFlowState fetch error:', fetchError.message)
    return false
  }

  // Merge step_data
  const currentStepData = (current?.step_data ?? {}) as Record<string, unknown>
  let mergedStepData: Record<string, unknown> = { ...currentStepData, ...(patch.step_data_patch ?? {}) }

  // Incrementa contadores se solicitado
  if (patch.increment_message_count) {
    const mc = typeof mergedStepData.message_count === 'number' ? mergedStepData.message_count : 0
    const tmc = typeof mergedStepData.total_message_count === 'number' ? mergedStepData.total_message_count : 0
    mergedStepData = { ...mergedStepData, message_count: mc + 1, total_message_count: tmc + 1 }
  }

  // Atualiza completed_steps via array append (Postgres)
  const update: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    step_data: mergedStepData,
  }
  if (patch.flow_step_id !== undefined) update.flow_step_id = patch.flow_step_id
  if (patch.status !== undefined) update.status = patch.status

  // completed_steps: append sem duplicatas
  if (patch.completed_steps_append) {
    const currentCompleted = (current?.completed_steps ?? []) as string[]
    if (!currentCompleted.includes(patch.completed_steps_append)) {
      update.completed_steps = [...currentCompleted, patch.completed_steps_append]
    }
  }

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

// ── Reseta message_count ao entrar em novo step (step_data merge) ─────────────

export async function resetStepMessageCount(stateId: string): Promise<boolean> {
  return updateFlowState(stateId, {
    step_data_patch: { message_count: 0 },
  })
}

// ── Finaliza flow_state ───────────────────────────────────────────────────────

export async function finalizeFlowState(
  stateId: string,
  status: 'completed' | 'handoff' | 'abandoned',
): Promise<boolean> {
  const { error } = await supabase
    .from('flow_states')
    .update({
      status,
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', stateId)

  if (error) {
    console.error('[stateManager] finalizeFlowState error:', error.message)
    return false
  }
  return true
}

// ── Registra evento no flow_events ───────────────────────────────────────────
// Válidos: flow_started | step_entered | step_exited | intent_detected |
//          handoff_triggered | tool_called | validator_flagged |
//          flow_completed | flow_abandoned | error

export async function logFlowEvent(
  flowStateId: string,
  flowId: string,
  instanceId: string,
  leadId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
  stepId?: string | null,
  timingBreakdown?: TimerBreakdown | null,
  costBreakdown?: CostBreakdown | null,
): Promise<void> {
  const { error } = await supabase.from('flow_events').insert({
    flow_state_id: flowStateId,
    flow_id: flowId,
    instance_id: instanceId,
    lead_id: leadId,
    event_type: eventType,
    input: Object.keys(eventData).length > 0 ? eventData : null,
    ...(stepId ? { step_id: stepId } : {}),
    ...(timingBreakdown ? { timing_breakdown: timingBreakdown } : {}),
    ...(costBreakdown ? { cost_breakdown: costBreakdown } : {}),
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
    increment_message_count: true,  // S4: incrementa a cada mensagem processada
  })
}
