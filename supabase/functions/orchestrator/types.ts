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
  flow_step_id: string | null
  status: 'active' | 'completed' | 'handoff' | 'abandoned'
  step_data: StepData
  lead_id: string
  instance_id: string
  conversation_id: string | null
  completed_steps: string[]      // uuid[] — steps já concluídos neste flow
  started_at: string
  completed_at: string | null
  last_activity_at: string
}

export interface StepData {
  // Progresso e rastreamento (default do banco)
  message_count: number          // msgs neste step
  total_message_count: number    // msgs no fluxo inteiro
  last_subagent: string | null
  intent_history: DetectedIntent[]
  products_shown: string[]
  context_vars: Record<string, unknown>
  // Dados de qualificação
  qualification_answers: Record<string, unknown>
  // Controle de fluxo
  waiting_for?: string           // ex: 'name', 'answer', 'selection'
  retry_count?: number
  session_summary?: string
  [key: string]: unknown
}

// ── Contexto do Lead ─────────────────────────────────────────────────────────

export interface LeadContext {
  lead_id: string
  lead_name: string | null
  lead_phone: string
  lead_jid: string        // WhatsApp JID (ex: 5511999999999@s.whatsapp.net) — preenchido em S5
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
  agent_config?: AgentConfig
}

// ── Intent Detection (S7) ───────────────────────────────────────────────────

export interface DetectedIntent {
  intent: string          // 'produto', 'cancelamento', etc.
  confidence: number      // 0-100
  layer: 1 | 2 | 3       // qual camada resolveu
  matched_tokens: string[] // tokens que ativaram (debug)
}

export interface IntentDetectorResult {
  intents: DetectedIntent[]      // ordenados por confidence DESC
  primary: DetectedIntent | null // maior confidence
  bypass?: 'cancelamento' | 'pessoa' | 'reclamacao' | 'produto'
  normalized_text: string        // texto após L1
  processing_time_ms: number
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
  /** URL direta da imagem (type=image) */
  url?: string
  /** Texto/caption da mensagem */
  caption?: string
  /** Cards do carousel (type=carousel) */
  cards?: CarouselCardPayload[]
  /** Opções de poll (type=poll) */
  poll_options?: string[]
}

export interface CarouselCardPayload {
  body: string
  imageUrl?: string
  buttons?: { type: string; displayText: string; url?: string }[]
}

// ── Agent Config (carregado pelo contextBuilder via ai_agents) ──────────────

export interface AgentConfig {
  agent_id: string
  system_prompt: string
  personality?: string
  carousel_button_1?: string
  carousel_button_2?: string
  max_discount_percent?: number
}

// ── Sales Config (step_config do subagente sales) ───────────────────────────

export interface SalesConfig {
  recommendation_mode?: 'exact' | 'smart' | 'upsell'
  max_products_per_search?: number       // default: 5
  max_search_failures?: number           // default: 3 → handoff
  enable_follow_up_llm?: boolean         // default: true
  carousel_button_1?: string             // override do agent config
  carousel_button_2?: string
  auto_tag_interest?: boolean            // default: true
  post_action?: 'next_step' | 'handoff' | 'tag_and_close'
}

// ── Support Config (step_config do subagente support) ───────────────────────

export interface SupportConfig {
  confidence_high?: number               // default: 0.80
  confidence_medium?: number             // default: 0.50
  max_unanswered?: number                // default: 2 → handoff
  enable_llm_formulation?: boolean       // default: true
  post_action?: 'next_step' | 'handoff' | 'tag_and_close'
}

// ── Contrato de cada Subagente ───────────────────────────────────────────────

export interface SubagentInput<TConfig = Record<string, unknown>> {
  context: FlowContext
  config: TConfig
}

export type SubagentHandler<TConfig = Record<string, unknown>> = (
  input: SubagentInput<TConfig>
) => Promise<SubagentResult>
