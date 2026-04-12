// =============================================================================
// Survey Subagent (S9)
// Envia enquetes (polls) via UAZAPI /send/menu e coleta respostas.
//
// Fluxo por mensagem:
//   1. Primeira mensagem no step → envia primeira pergunta como poll
//   2. Mensagens seguintes → match resposta contra opções:
//      - Match exato ou fuzzy → grava resposta, avança para próxima pergunta
//      - Sem match → retry (max_retries), depois pula pergunta
//   3. Todas respondidas → completion_message + advance
//
// NPS: perguntas com is_nps=true geram tag nps_score:X
// =============================================================================

import type { SubagentInput, SubagentResult } from '../types.ts'

// ── Config do subagente Survey ──────────────────────────────────────────────

export interface SurveyQuestion {
  text: string
  options: string[]
  type?: 'poll' | 'text'
  is_nps?: boolean
}

export interface SurveyConfig {
  questions?: SurveyQuestion[]
  // Formato flat (vem do StepConfigForm da UI)
  title?: string
  options?: string[]
  tag_prefix?: string
  // ─────────────────────────────────────────────
  max_retries?: number              // default: 2
  completion_message?: string       // default: "Obrigado pela resposta!"
  post_action?: 'next_step' | 'handoff' | 'tag_and_close'  // default: next_step
}

const DEFAULTS = {
  max_retries: 2,
  completion_message: 'Obrigado pela resposta!',
}

// ── Normaliza config: aceita formato estruturado {questions[]} ou flat {title, options[]} ──
// O StepConfigForm salva formato flat; fluxos programáticos usam questions[].

function normalizeQuestions(config: SurveyConfig): SurveyQuestion[] {
  // Formato estruturado — prioritário
  if (config.questions && config.questions.length > 0) {
    return config.questions
  }

  // Formato flat (StepConfigForm): title + options[]
  const flatOptions = config.options ?? []
  if (flatOptions.length > 0) {
    return [{
      text: config.title ?? 'Qual é a sua resposta?',
      options: flatOptions,
      is_nps: config.tag_prefix === 'nps',
    }]
  }

  return []
}

// ── Handler principal ───────────────────────────────────────────────────────

export async function surveySubagent(
  input: SubagentInput<SurveyConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { flow_state } = context
  const messageText = context.input.message_text ?? ''

  const questions     = normalizeQuestions(config)
  const maxRetries    = config.max_retries ?? DEFAULTS.max_retries
  const completionMsg = config.completion_message ?? DEFAULTS.completion_message

  if (questions.length === 0) {
    return {
      status: 'advance',
      response_text: completionMsg,
      exit_rule_triggered: { trigger: 'survey_complete', action: 'next_step' },
      step_data_patch: { last_subagent: 'survey' },
      tags_to_set: ['survey:complete'],
    }
  }

  const currentIndex = (flow_state.step_data.current_question_index as number) ?? 0
  const retryCount   = (flow_state.step_data.retry_count as number) ?? 0
  const answers      = (flow_state.step_data.survey_answers as Record<string, string>) ?? {}
  const isFirstMsg   = ((flow_state.step_data.message_count as number) ?? 0) === 0

  // ── Case A: Primeira mensagem no step → envia primeira pergunta ──────────
  if (isFirstMsg) {
    return buildQuestionResult(questions[0], 0, answers)
  }

  // ── Case B: Coletando resposta da pergunta atual ─────────────────────────
  const currentQuestion = questions[currentIndex]

  // Seguranca: se currentIndex fora de range, completa
  if (!currentQuestion) {
    return buildCompletionResult(completionMsg, answers, config)
  }

  // Pergunta tipo texto → aceita qualquer resposta nao-vazia
  if (currentQuestion.type === 'text') {
    const trimmed = messageText.trim()
    if (trimmed.length >= 1) {
      return handleValidAnswer(trimmed, currentQuestion, currentIndex, answers, questions, completionMsg, config)
    }
    // Resposta vazia → retry
    return handleRetry(currentQuestion, currentIndex, retryCount, maxRetries, answers, questions, completionMsg, config)
  }

  // Pergunta tipo poll (default) → match contra options
  const matched = matchOption(messageText, currentQuestion.options)

  if (matched !== null) {
    return handleValidAnswer(matched, currentQuestion, currentIndex, answers, questions, completionMsg, config)
  }

  // Sem match → retry ou pula
  return handleRetry(currentQuestion, currentIndex, retryCount, maxRetries, answers, questions, completionMsg, config)
}

// ── Resposta valida → grava e avanca ────────────────────────────────────────

function handleValidAnswer(
  answer: string,
  currentQuestion: SurveyQuestion,
  currentIndex: number,
  answers: Record<string, string>,
  questions: SurveyQuestion[],
  completionMsg: string,
  config: SurveyConfig,
): SubagentResult {
  const questionKey = `q${currentIndex}`
  const newAnswers = { ...answers, [questionKey]: answer }
  const tags: string[] = []

  // NPS tag
  if (currentQuestion.is_nps) {
    const score = extractNpsScore(answer, currentQuestion.options)
    if (score !== null) {
      tags.push(`nps_score:${score}`)
    }
  }

  const nextIndex = currentIndex + 1

  // Ainda tem perguntas → envia proxima
  if (nextIndex < questions.length) {
    const result = buildQuestionResult(questions[nextIndex], nextIndex, newAnswers)
    return {
      ...result,
      step_data_patch: {
        ...result.step_data_patch,
        retry_count: 0,
      },
      tags_to_set: tags.length > 0 ? tags : undefined,
    }
  }

  // Todas respondidas → completa
  const completionResult = buildCompletionResult(completionMsg, newAnswers, config)
  if (tags.length > 0) {
    completionResult.tags_to_set = [...(completionResult.tags_to_set ?? []), ...tags]
  }
  return completionResult
}

// ── Retry ou pula ───────────────────────────────────────────────────────────

function handleRetry(
  currentQuestion: SurveyQuestion,
  currentIndex: number,
  retryCount: number,
  maxRetries: number,
  answers: Record<string, string>,
  questions: SurveyQuestion[],
  completionMsg: string,
  config: SurveyConfig,
): SubagentResult {
  if (retryCount >= maxRetries) {
    // Pula esta pergunta → avanca para proxima
    const nextIndex = currentIndex + 1

    if (nextIndex < questions.length) {
      return {
        ...buildQuestionResult(questions[nextIndex], nextIndex, answers),
        step_data_patch: {
          current_question_index: nextIndex,
          survey_answers: answers,
          retry_count: 0,
          last_subagent: 'survey',
        },
      }
    }

    // Sem mais perguntas → completa
    return buildCompletionResult(completionMsg, answers, config)
  }

  // Pede para tentar novamente
  const optionList = currentQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
  return {
    status: 'continue',
    response_text: `Por favor, escolha uma das opções:\n\n${optionList}`,
    step_data_patch: {
      retry_count: retryCount + 1,
      last_subagent: 'survey',
    },
  }
}

// ── Monta resultado de pergunta (poll) ──────────────────────────────────────

function buildQuestionResult(
  question: SurveyQuestion,
  index: number,
  answers: Record<string, string>,
): SubagentResult {
  // Perguntas tipo texto → envia como texto simples
  if (question.type === 'text') {
    return {
      status: 'continue',
      response_text: question.text,
      step_data_patch: {
        current_question_index: index,
        survey_answers: answers,
        waiting_for: `q${index}`,
        retry_count: 0,
        last_subagent: 'survey',
      },
    }
  }

  // Perguntas tipo poll (default) → envia como media poll
  return {
    status: 'continue',
    media: {
      type: 'poll',
      caption: question.text,
      poll_options: question.options,
    },
    step_data_patch: {
      current_question_index: index,
      survey_answers: answers,
      waiting_for: `q${index}`,
      retry_count: 0,
      last_subagent: 'survey',
    },
  }
}

// ── Monta resultado de conclusao ────────────────────────────────────────────

function buildCompletionResult(
  completionMsg: string,
  answers: Record<string, string>,
  config: SurveyConfig,
): SubagentResult {
  const action = config.post_action ?? 'next_step'
  const isHandoff = action === 'handoff'

  return {
    status: isHandoff ? 'handoff' : 'advance',
    response_text: completionMsg,
    exit_rule_triggered: { trigger: 'survey_complete', action: isHandoff ? 'handoff_human' : 'next_step' },
    step_data_patch: {
      survey_answers: answers,
      current_question_index: (config.questions ?? []).length,
      waiting_for: undefined,
      retry_count: 0,
      last_subagent: 'survey',
    },
    tags_to_set: ['survey:complete'],
  }
}

// ── Match de opcoes (exato + fuzzy normalize + includes) ────────────────────

function matchOption(text: string, options: string[]): string | null {
  if (!text.trim() || options.length === 0) return null

  const normalizedText = normalize(text)

  // Match exato (normalizado)
  for (const opt of options) {
    if (normalize(opt) === normalizedText) return opt
  }

  // Match por inclusao (texto contem a opcao ou vice-versa)
  for (const opt of options) {
    const normalizedOpt = normalize(opt)
    if (normalizedText.includes(normalizedOpt) || normalizedOpt.includes(normalizedText)) {
      return opt
    }
  }

  // Match por numero (ex: "1", "2" → primeira opcao, segunda opcao)
  const numMatch = text.trim().match(/^\d+$/)
  if (numMatch) {
    const idx = parseInt(text.trim(), 10) - 1
    if (idx >= 0 && idx < options.length) return options[idx]
  }

  return null
}

// ── Extrai score NPS da resposta ────────────────────────────────────────────

function extractNpsScore(answer: string, options: string[]): number | null {
  // Se a resposta e um numero direto (0-10)
  const num = parseInt(answer, 10)
  if (!isNaN(num) && num >= 0 && num <= 10) return num

  // Se a resposta matcha uma opcao, usa o indice como score
  const idx = options.indexOf(answer)
  if (idx !== -1) {
    // Tenta extrair numero da opcao
    const optNum = parseInt(options[idx], 10)
    if (!isNaN(optNum) && optNum >= 0 && optNum <= 10) return optNum
    // Senao, usa o indice (0-based)
    return idx
  }

  return null
}

// ── Normalizacao de texto ───────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
