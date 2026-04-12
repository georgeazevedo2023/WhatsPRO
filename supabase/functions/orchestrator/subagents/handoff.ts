// =============================================================================
// Handoff Subagent (S10)
// Transfere lead para atendente humano com briefing contextual.
//
// Fluxo:
//   1. Gera briefing a partir do contexto (minimal/standard/full)
//   2. Envia mensagem de handoff ao lead
//   3. Retorna status='handoff' com briefing no step_data_patch
//   4. Tags: handoff:human ou handoff:department:X
//
// Pure logic — sem acesso a DB ou serviços externos.
// O orchestrator cuida de envio de mensagem e atribuição ao departamento.
// =============================================================================

import type { SubagentInput, SubagentResult } from '../types.ts'

// ── Config do subagente Handoff ─────────────────────────────────────────────

export interface HandoffConfig {
  message?: string                    // ex: "Vou transferir você para um atendente"
  briefing_depth?: 'minimal' | 'standard' | 'full'  // default: 'standard'
  department_id?: string              // opcional: atribuir a departamento específico
  assign_to?: string                  // opcional: user_id específico
  post_action?: 'handoff_human' | 'handoff_department' | 'handoff_manager'  // default: handoff_human
}

const DEFAULTS = {
  message: 'Vou transferir você para um atendente. Um momento, por favor!',
  briefing_depth: 'standard' as const,
  post_action: 'handoff_human' as const,
}

// ── Handler principal ───────────────────────────────────────────────────────

export async function handoffSubagent(
  input: SubagentInput<HandoffConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { lead, flow_state } = context

  const handoffMessage = config.message ?? DEFAULTS.message
  const briefingDepth  = config.briefing_depth ?? DEFAULTS.briefing_depth
  const postAction     = config.post_action ?? DEFAULTS.post_action
  const departmentId   = config.department_id
  const assignTo       = config.assign_to

  // ── Gera briefing ──────────────────────────────────────────────────────
  const briefing = generateBriefing(context, briefingDepth)

  // ── Tags ───────────────────────────────────────────────────────────────
  const tags: string[] = []

  if (postAction === 'handoff_department' && departmentId) {
    tags.push(`handoff:department:${departmentId}`)
  } else if (postAction === 'handoff_manager') {
    tags.push('handoff:manager')
  } else {
    tags.push('handoff:human')
  }

  // ── Resultado ──────────────────────────────────────────────────────────
  return {
    status: 'handoff',
    response_text: handoffMessage,
    exit_rule_triggered: {
      trigger: 'handoff_requested',
      action: postAction,
      params: {
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(assignTo ? { assign_to: assignTo } : {}),
      },
    },
    step_data_patch: {
      last_subagent: 'handoff',
      handoff_briefing: briefing,
      handoff_at: new Date().toISOString(),
      ...(departmentId ? { handoff_department_id: departmentId } : {}),
      ...(assignTo ? { handoff_assign_to: assignTo } : {}),
    },
    tags_to_set: tags,
    lead_profile_patch: {
      last_handoff_at: new Date().toISOString(),
      last_handoff_reason: postAction,
    },
  }
}

// ── Gerador de briefing ─────────────────────────────────────────────────────

function generateBriefing(
  context: import('../types.ts').FlowContext,
  depth: 'minimal' | 'standard' | 'full',
): string {
  const { lead, flow_state } = context
  const stepData = flow_state.step_data
  const sections: string[] = []

  // ── Minimal: nome + ultimo intent ──────────────────────────────────────
  const leadName = lead.lead_name ?? 'Lead sem nome'
  const leadPhone = lead.lead_phone ?? ''
  sections.push(`Lead: ${leadName}${leadPhone ? ` (${leadPhone})` : ''}`)

  const intentHistory = (stepData.intent_history ?? []) as Array<{ intent: string; confidence: number }>
  const lastIntent = intentHistory.length > 0
    ? intentHistory[intentHistory.length - 1]
    : null

  if (lastIntent) {
    sections.push(`Ultimo intent: ${lastIntent.intent} (${lastIntent.confidence}%)`)
  }

  if (depth === 'minimal') {
    return sections.join('\n')
  }

  // ── Standard: + intents + respostas de qualificacao + produtos mostrados ─
  if (intentHistory.length > 1) {
    const intentList = intentHistory
      .map(i => `${i.intent} (${i.confidence}%)`)
      .join(', ')
    sections.push(`Intents detectados: ${intentList}`)
  }

  const qualAnswers = (stepData.qualification_answers ?? {}) as Record<string, unknown>
  if (Object.keys(qualAnswers).length > 0) {
    const answerLines = Object.entries(qualAnswers)
      .map(([key, val]) => `  - ${key}: ${String(val)}`)
      .join('\n')
    sections.push(`Respostas de qualificacao:\n${answerLines}`)
  }

  const productsShown = (stepData.products_shown ?? []) as string[]
  if (productsShown.length > 0) {
    sections.push(`Produtos mostrados: ${productsShown.length} item(s)`)
  }

  // Tags do lead
  if (lead.tags.length > 0) {
    sections.push(`Tags: ${lead.tags.join(', ')}`)
  }

  // Mensagens trocadas
  const msgCount = (stepData.message_count as number) ?? 0
  const totalMsgCount = (stepData.total_message_count as number) ?? 0
  if (totalMsgCount > 0) {
    sections.push(`Mensagens: ${msgCount} neste step, ${totalMsgCount} no fluxo`)
  }

  if (depth === 'standard') {
    return sections.join('\n')
  }

  // ── Full: + resumo da conversa do short_memory ────────────────────────
  const shortMemory = (lead.short_memory ?? {}) as Record<string, unknown>

  if (shortMemory.summary && typeof shortMemory.summary === 'string') {
    sections.push(`Resumo da conversa: ${shortMemory.summary}`)
  }

  if (shortMemory.last_messages && Array.isArray(shortMemory.last_messages)) {
    const lastMsgs = (shortMemory.last_messages as string[]).slice(-5)
    if (lastMsgs.length > 0) {
      sections.push(`Ultimas mensagens:\n${lastMsgs.map(m => `  > ${m}`).join('\n')}`)
    }
  }

  // Survey answers (se existirem)
  const surveyAnswers = (stepData.survey_answers ?? {}) as Record<string, unknown>
  if (Object.keys(surveyAnswers).length > 0) {
    const surveyLines = Object.entries(surveyAnswers)
      .map(([key, val]) => `  - ${key}: ${String(val)}`)
      .join('\n')
    sections.push(`Respostas de enquete:\n${surveyLines}`)
  }

  // Context vars
  const contextVars = (stepData.context_vars ?? {}) as Record<string, unknown>
  if (Object.keys(contextVars).length > 0) {
    const varLines = Object.entries(contextVars)
      .slice(0, 10)  // limita a 10 para nao poluir o briefing
      .map(([key, val]) => `  - ${key}: ${String(val)}`)
      .join('\n')
    sections.push(`Variaveis de contexto:\n${varLines}`)
  }

  return sections.join('\n')
}
