// =============================================================================
// Qualification Subagent (S6)
// Coleta respostas a perguntas de qualificação de leads (BANT/custom).
//
// Fluxo por mensagem:
//   1. waiting_for está setado? → extrai resposta → salva ou retry
//   2. max_messages atingido?   → handoff_human
//   3. required_count atingido? → qualification_complete → next_step
//   4. smart_fill: pula perguntas já respondidas na long_memory (< max_age_days)
//   5. Próxima pergunta não respondida → faz a pergunta (waiting_for = key)
//   6. Sem mais perguntas → qualification_complete
//
// Tipos extraídos no MVP (S6):
//   text, boolean, currency_brl, select
//   Demais 12 tipos → fallback text (S8+)
// =============================================================================

import { upsertLongMemory } from '../services/memory.ts'
import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { SubagentInput, SubagentResult, ExitRule } from '../types.ts'

// ── Interfaces de Config ─────────────────────────────────────────────────────

export interface QualificationQuestion {
  key: string
  label: string
  type:
    | 'text'
    | 'boolean'
    | 'currency_brl'
    | 'select'
    | 'email'
    | 'phone'
    | 'cpf'
    | 'cnpj'
    | 'date'
    | 'multi_select'
    | 'scale_1_5'
    | 'scale_1_10'
    | 'nps'
    | 'url'
    | 'address'
    | 'custom'
  required?: boolean
  options?: string[]      // para select / multi_select
  placeholder?: string
}

export interface QualificationConfig {
  questions?: QualificationQuestion[]
  max_questions?: number            // default: 10
  required_count?: number           // quantas required precisam ser respondidas
  mode?: 'fixed' | 'adaptive'      // S6: fixed. adaptive = S7+
  smart_fill?: boolean              // default: true
  smart_fill_max_age_days?: number  // default: 90
  fallback_retries?: number         // default: 2
  post_action?: 'next_step' | 'handoff' | 'tag_and_close'  // default: 'next_step'
}

const supabase = createServiceClient()

// ── Handler principal ─────────────────────────────────────────────────────────

export async function qualificationSubagent(
  input: SubagentInput<QualificationConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { lead, flow_state, exit_rules } = context
  const messageText = context.input.message_text ?? ''

  const questions     = config.questions ?? []
  const maxMessages   = config.max_questions ?? 10      // nome histórico do campo no seed
  const requiredCount = config.required_count ?? 0
  const smartFill     = config.smart_fill !== false
  const maxAgeDays    = config.smart_fill_max_age_days ?? 90
  const maxRetries    = config.fallback_retries ?? 2

  const waitingFor    = flow_state.step_data.waiting_for as string | undefined
  const messageCount  = (flow_state.step_data.message_count as number) ?? 0
  const retryCount    = (flow_state.step_data.retry_count  as number) ?? 0

  // Respostas acumuladas neste step
  const answers = (flow_state.step_data.qualification_answers as Record<string, unknown>) ?? {}

  // Perfil long_memory para smart_fill
  const longMemory    = (lead.long_memory ?? {}) as Record<string, unknown>
  const longProfile   = (longMemory.profile  as Record<string, unknown>) ?? {}

  // ── 1. Estava aguardando resposta → extrai e valida ──────────────────────────
  if (waitingFor) {
    const question = questions.find((q) => q.key === waitingFor)

    if (question) {
      const extracted = extractFieldValue(messageText, question)

      if (extracted === null) {
        // Resposta inválida → retry ou avança sem a resposta
        if (retryCount >= maxRetries) {
          // Expirou retries → pula esta pergunta
          const nextResult = await pickNextQuestion(
            questions, answers, longProfile, smartFill, maxAgeDays,
            lead.lead_id, flow_state.instance_id, requiredCount, exit_rules,
            answers,  // sem salvar nada novo
            lead.custom_fields ?? {},
          )
          return {
            ...nextResult,
            step_data_patch: {
              ...nextResult.step_data_patch,
              retry_count: 0,
              last_subagent: 'qualification',
            },
          }
        }

        // Pede para repetir
        return {
          status: 'continue',
          response_text: buildRetryMessage(question),
          step_data_patch: {
            retry_count: retryCount + 1,
            last_subagent: 'qualification',
          },
        }
      }

      // Resposta válida → salva
      const newAnswers = { ...answers, [question.key]: extracted }

      // Persiste no long_memory.profile
      await upsertLongMemory(lead.lead_id, flow_state.instance_id, {
        profile: { ...longProfile, [question.key]: extracted },
      })

      // Atualiza custom_fields no lead_profiles
      await updateLeadCustomFields(lead.lead_id, { [question.key]: extracted }, lead.custom_fields)

      // Decide próxima ação com as novas respostas
      const nextResult = await pickNextQuestion(
        questions, newAnswers, longProfile, smartFill, maxAgeDays,
        lead.lead_id, flow_state.instance_id, requiredCount, exit_rules,
        newAnswers,
        lead.custom_fields ?? {},
      )

      return {
        ...nextResult,
        step_data_patch: {
          ...nextResult.step_data_patch,
          qualification_answers: newAnswers,
          retry_count: 0,
          last_subagent: 'qualification',
        },
        lead_profile_patch: buildLeadProfilePatch(newAnswers, lead.custom_fields ?? {}),
      }
    }
  }

  // ── 2. Primeira mensagem no step (ou waiting_for não existe) ─────────────────

  // Verifica exit rule max_messages
  const maxMsgRule = findExitRule(exit_rules, 'max_messages')
  if (maxMsgRule && messageCount >= ((maxMsgRule.value as number) ?? maxMessages)) {
    return buildExitResult(maxMsgRule, answers, lead.custom_fields ?? {})
  }

  // Verifica se já completou via long_memory (smart_fill preencheu tudo)
  const requiredAnswered = countRequiredAnswered(questions, answers, longProfile, smartFill, maxAgeDays)
  if (requiredCount > 0 && requiredAnswered >= requiredCount) {
    const completeRule = findExitRule(exit_rules, 'qualification_complete')
    if (completeRule) return buildExitResult(completeRule, answers, lead.custom_fields ?? {})
  }

  // Pega próxima pergunta
  return pickNextQuestion(
    questions, answers, longProfile, smartFill, maxAgeDays,
    lead.lead_id, flow_state.instance_id, requiredCount, exit_rules,
    answers,
    lead.custom_fields ?? {},
  )
}

// ── Escolhe a próxima pergunta ou dispara complete ───────────────────────────

async function pickNextQuestion(
  questions: QualificationQuestion[],
  answers: Record<string, unknown>,
  longProfile: Record<string, unknown>,
  smartFill: boolean,
  maxAgeDays: number,
  _leadId: string,
  _instanceId: string,
  requiredCount: number,
  exitRules: ExitRule[],
  newAnswers: Record<string, unknown>,
  customFields: Record<string, unknown>,
): Promise<SubagentResult> {
  // Filtra perguntas ainda não respondidas (considerando smart_fill)
  const unanswered = questions.filter((q) => !isAnswered(q.key, newAnswers, longProfile, smartFill, maxAgeDays))

  if (unanswered.length === 0) {
    // Todas respondidas → qualification_complete
    const completeRule = findExitRule(exitRules, 'qualification_complete')
    if (completeRule) return buildExitResult(completeRule, newAnswers, customFields)

    // Sem exit rule configurada → avança por padrão
    return {
      status: 'advance',
      exit_rule_triggered: { trigger: 'qualification_complete', action: 'next_step' },
      step_data_patch: {
        qualification_answers: newAnswers,
        waiting_for: undefined,
        last_subagent: 'qualification',
      },
      lead_profile_patch: buildLeadProfilePatch(newAnswers, customFields),
    }
  }

  // Verifica required já atendidos com respostas acumuladas
  if (requiredCount > 0) {
    const answered = countRequiredAnswered(questions, newAnswers, longProfile, smartFill, maxAgeDays)
    if (answered >= requiredCount) {
      const completeRule = findExitRule(exitRules, 'qualification_complete')
      if (completeRule) return buildExitResult(completeRule, newAnswers, customFields)
    }
  }

  // Faz a próxima pergunta
  const next = unanswered[0]
  return {
    status: 'continue',
    response_text: buildQuestionMessage(next),
    step_data_patch: {
      qualification_answers: newAnswers,
      waiting_for: next.key,
      retry_count: 0,
      last_subagent: 'qualification',
    },
  }
}

// ── Conta required já respondidas ────────────────────────────────────────────

function countRequiredAnswered(
  questions: QualificationQuestion[],
  answers: Record<string, unknown>,
  longProfile: Record<string, unknown>,
  smartFill: boolean,
  maxAgeDays: number,
): number {
  return questions
    .filter((q) => q.required && isAnswered(q.key, answers, longProfile, smartFill, maxAgeDays))
    .length
}

// ── Verifica se uma pergunta já foi respondida ────────────────────────────────

function isAnswered(
  key: string,
  answers: Record<string, unknown>,
  longProfile: Record<string, unknown>,
  smartFill: boolean,
  _maxAgeDays: number,
): boolean {
  // Resposta neste step
  if (key in answers && answers[key] !== null && answers[key] !== undefined) return true

  // Smart fill: resposta existente no long_memory.profile (sem checar idade neste MVP)
  if (smartFill && key in longProfile && longProfile[key] !== null && longProfile[key] !== undefined) {
    return true
  }

  return false
}

// ── Extração de valores por tipo ──────────────────────────────────────────────

function extractFieldValue(text: string, question: QualificationQuestion): unknown {
  const t = text.trim()
  if (!t) return null

  switch (question.type) {
    case 'boolean':
      return extractBoolean(t)

    case 'currency_brl':
      return extractCurrencyBRL(t)

    case 'select':
      return extractSelect(t, question.options ?? [])

    case 'text':
    default:
      // text e demais tipos → aceita qualquer resposta não-vazia ≥ 2 chars
      return t.length >= 2 ? t : null
  }
}

// boolean: sim/não/yes/no/s/n + variações BR
function extractBoolean(text: string): boolean | null {
  const t = text.toLowerCase().trim()

  const trueValues  = ['sim', 'yes', 's', 'y', 'claro', 'com certeza', 'com certeza!', 'afirmativo', 'ok', 'ok!', '1', 'verdade', 'verdadeiro', 'correto']
  const falseValues = ['não', 'nao', 'no', 'n', 'negativo', '0', 'falso', 'incorreto', 'jamais', 'nunca']

  if (trueValues.includes(t))  return true
  if (falseValues.includes(t)) return false

  // Variações com pontuação/espaço
  if (/^s(im)?[.!]*$/.test(t)) return true
  if (/^n(ã?o)?[.!]*$/.test(t)) return false

  return null
}

// currency_brl: extrai número de "R$ 5.000", "5000", "5k", "cinco mil" (básico)
function extractCurrencyBRL(text: string): number | null {
  const t = text.toLowerCase().trim()

  // Remove R$, espaços extras, pontos de milhar
  const cleaned = t.replace(/r\$\s*/g, '').replace(/\./g, '').replace(/,/g, '.').trim()

  // Suporte básico a "k" (ex: "5k", "10k")
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/)
  if (kMatch) return parseFloat(kMatch[1]) * 1000

  // Texto por extenso básico BR
  const textMap: Record<string, number> = {
    'zero': 0,
    'mil': 1000,
    'dois mil': 2000,
    'três mil': 3000,
    'cinco mil': 5000,
    'dez mil': 10000,
    'vinte mil': 20000,
    'cinquenta mil': 50000,
    'cem mil': 100000,
  }
  for (const [word, value] of Object.entries(textMap)) {
    if (t.includes(word)) return value
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// select: match fuzzy contra options (normaliza e verifica inclusão)
function extractSelect(text: string, options: string[]): string | null {
  if (options.length === 0) return text.length >= 2 ? text : null

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const normalizedText = normalize(text)

  // Match exato (normalizado)
  for (const opt of options) {
    if (normalize(opt) === normalizedText) return opt
  }

  // Match por inclusão (texto contém a opção ou a opção contém o texto)
  for (const opt of options) {
    const normalizedOpt = normalize(opt)
    if (normalizedText.includes(normalizedOpt) || normalizedOpt.includes(normalizedText)) {
      return opt
    }
  }

  // Match por número (ex: "1", "2" → primeira opção, segunda opção)
  const numMatch = text.match(/^\d+$/)
  if (numMatch) {
    const idx = parseInt(text, 10) - 1
    if (idx >= 0 && idx < options.length) return options[idx]
  }

  return null
}

// ── Monta mensagem de pergunta ────────────────────────────────────────────────

function buildQuestionMessage(question: QualificationQuestion): string {
  let msg = question.label

  if (question.type === 'select' && question.options && question.options.length > 0) {
    const optionList = question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
    msg = `${msg}\n\n${optionList}`
  }

  if (question.type === 'boolean') {
    msg = `${msg} (Sim/Não)`
  }

  return msg
}

// ── Monta mensagem de retry ───────────────────────────────────────────────────

function buildRetryMessage(question: QualificationQuestion): string {
  if (question.type === 'boolean') {
    return `Por favor, responda com *Sim* ou *Não*: ${question.label}`
  }
  if (question.type === 'currency_brl') {
    return `Não consegui entender o valor. Por favor, informe o orçamento em reais (ex: R$ 5.000).`
  }
  if (question.type === 'select' && question.options) {
    const optionList = question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
    return `Por favor, escolha uma das opções:\n\n${optionList}`
  }
  return `Não entendi sua resposta. Poderia tentar novamente? ${question.label}`
}

// ── Monta ExitResult a partir de uma exit_rule ────────────────────────────────

function buildExitResult(rule: ExitRule, answers: Record<string, unknown>, customFields: Record<string, unknown>): SubagentResult {
  const isHandoff = rule.action === 'handoff_human' ||
                    rule.action === 'handoff_department' ||
                    rule.action === 'handoff_manager'

  return {
    status: isHandoff ? 'handoff' : 'advance',
    response_text: rule.message,
    exit_rule_triggered: rule,
    step_data_patch: {
      qualification_answers: answers,
      waiting_for: undefined,
      last_subagent: 'qualification',
    },
    lead_profile_patch: buildLeadProfilePatch(answers, customFields),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findExitRule(exitRules: ExitRule[], trigger: string): ExitRule | undefined {
  return exitRules.find((r) => r.trigger === trigger)
}

function buildLeadProfilePatch(
  answers: Record<string, unknown>,
  existingCustomFields: Record<string, unknown>,
): Record<string, unknown> {
  return {
    custom_fields: { ...existingCustomFields, ...answers },
  }
}

async function updateLeadCustomFields(
  leadId: string,
  newFields: Record<string, unknown>,
  existingCustomFields: Record<string, unknown>,
): Promise<void> {
  const merged = { ...existingCustomFields, ...newFields }
  const { error } = await supabase
    .from('lead_profiles')
    .update({ custom_fields: merged })
    .eq('id', leadId)

  if (error) {
    console.error('[qualification] updateLeadCustomFields error:', error.message)
  }
}
