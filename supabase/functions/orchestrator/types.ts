// =============================================================================
// Orchestrator — Tipos Centrais (S2)
// Contratos TypeScript entre orchestrator, subagentes e serviços
// =============================================================================

// ── Input do Orchestrator ────────────────────────────────────────────────────

export interface OrchestratorInput {
  conversation_id: string
  instance_id: string
  message_text: string
  message_type?: 'text' | 'audio' | 'image' | 'video' | 'document' | 'poll_response'
  media_url?: string
  timestamp?: string
}

// ── Estado Ativo do Fluxo ────────────────────────────────────────────────────

export interface ActiveFlowState {
  id: string                     // flow_states.id
  flow_id: string
  flow_version: number
  current_step_id: string | null
  status: 'active' | 'completed' | 'handoff' | 'abandoned'
  step_data: StepData
  lead_id: string
  started_at: string
  last_activity_at: string
}

export interface StepData {
  qualification_answers?: Record<string, unknown>
  products_shown?: string[]
  intents_detected?: string[]
  session_summary?: string
  waiting_for?: string           // ex: 'name', 'answer', 'selection'
  retry_count?: number
  [key: string]: unknown
}

// ── Contexto do Lead ─────────────────────────────────────────────────────────

export interface LeadContext {
  lead_id: string
  lead_name: string | null
  lead_phone: string
  custom_fields: Record<string, unknown>
  tags: string[]
  origin: string | null
  // Memória (preenchida em S5 pelo Memory Service)
  short_memory?: Record<string, unknown>
  long_memory?: Record<string, unknown>
}

// ── Contexto completo que chega ao Subagente ─────────────────────────────────

export interface FlowContext {
  input: OrchestratorInput
  flow_state: ActiveFlowState
  lead: LeadContext
  step_config: Record<string, unknown>
  exit_rules: ExitRule[]
}

// ── Exit Rules ───────────────────────────────────────────────────────────────

export type ExitAction =
  | 'next_step'
  | 'handoff_human'
  | 'handoff_department'
  | 'handoff_manager'
  | 'followup'
  | 'another_flow'
  | 'tag_and_close'
  | 'do_nothing'

export interface ExitRule {
  trigger: string                // ex: 'max_messages', 'qualification_complete', 'intent_cancelamento'
  value?: number | string
  message?: string               // mensagem para o lead antes de sair
  action: ExitAction
  params?: Record<string, unknown>
}

// ── Resultado do Subagente ───────────────────────────────────────────────────

export type SubagentStatus =
  | 'continue'                   // lead continua no mesmo step
  | 'advance'                    // exit_rule disparou → próximo step
  | 'handoff'                    // transbordo humano
  | 'complete'                   // fluxo concluído
  | 'error'                      // erro interno

export interface SubagentResult {
  status: SubagentStatus
  response_text?: string         // texto a enviar ao lead (null = não enviar)
  media?: SubagentMedia
  exit_rule_triggered?: ExitRule
  step_data_patch?: Partial<StepData>   // dados a salvar no flow_states.step_data
  tags_to_set?: string[]
  lead_profile_patch?: Record<string, unknown>
  error?: string
}

export interface SubagentMedia {
  type: 'image' | 'carousel' | 'poll'
  url?: string
  products?: unknown[]
  poll_options?: string[]
}

// ── Contrato de cada Subagente ───────────────────────────────────────────────

export interface SubagentInput<TConfig = Record<string, unknown>> {
  context: FlowContext
  config: TConfig
}

export type SubagentHandler<TConfig = Record<string, unknown>> = (
  input: SubagentInput<TConfig>
) => Promise<SubagentResult>
