/**
 * Sprint B5 (split orchestrator) — types compartilhados pelas fases.
 *
 * Iniciado em Onda 0/1 (2026-05-21). Cresce gradualmente conforme blocos do
 * `ai-agent/index.ts` são extraídos em `_shared/agent/*.ts`.
 *
 * Princípio: estado mutável carregado em `AgentContext`, IO/persistência em
 * helpers separados. Cada onda adiciona campos novos sem quebrar callers.
 */

export type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void
  warn: (msg: string, meta?: Record<string, unknown>) => void
  error?: (msg: string, meta?: Record<string, unknown>) => void
}

export type FunnelData = {
  name: string
  type: string
  ai_template?: string | null
  ai_custom_text?: string | null
  funnel_prompt?: string | null
  handoff_rule?: string | null
  handoff_message?: string | null
  handoff_message_outside_hours?: string | null
  max_messages_before_handoff?: number | null
  handoff_department_id?: string | null
  handoff_max_messages?: number | null
  profile_id?: string | null
}

export type ProfileData = {
  id: string
  prompt: string
  handoff_rule: string | null
  handoff_max_messages: number | null
  handoff_department_id: string | null
  handoff_message: string | null
}

export type ConversationTagsCarrier = {
  tags?: string[] | null
}
