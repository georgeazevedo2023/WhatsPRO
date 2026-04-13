import { STATUS_IA } from './constants.ts'

export interface QueuedMessage {
  content: string
  media_type: string
  media_url: string | null
  direction: string
  timestamp: string
}

export interface LegacyQueueState {
  messages: QueuedMessage[] | null
  processed: boolean
  first_message_at?: string | null
}

export interface FollowUpRule {
  days: number
  message: string
}

export interface FollowUpDecisionInput {
  rules: FollowUpRule[]
  daysSince: number
  lastStep: number
  lastStatus?: string | null
}

export interface FollowUpDecision {
  nextStepIndex: number
  rule: FollowUpRule
}

export interface WebhookAiTriggerInput {
  direction: string
  fromMe: boolean
  mediaType: string
  statusIa?: string | null
}

export function createQueuedMessage(
  message: {
    content?: string | null
    text?: string | null
    media_type?: string | null
    media_url?: string | null
    direction?: string | null
  } | null | undefined,
  timestamp: string,
): QueuedMessage {
  return {
    content: message?.content || message?.text || '',
    media_type: message?.media_type || 'text',
    media_url: message?.media_url || null,
    direction: message?.direction || 'incoming',
    timestamp,
  }
}

export function buildLegacyQueueUpdate(
  current: LegacyQueueState,
  messageEntry: QueuedMessage,
): { messages: QueuedMessage[]; firstMessageAt: string } {
  const existingMessages = current.processed ? [] : (current.messages || [])

  return {
    messages: [...existingMessages, messageEntry],
    firstMessageAt: current.processed
      ? messageEntry.timestamp
      : (current.first_message_at || messageEntry.timestamp),
  }
}

export function resolveNextFollowUpStep(input: FollowUpDecisionInput): FollowUpDecision | null {
  const { rules, daysSince, lastStep, lastStatus } = input

  if (lastStatus === 'replied') return null
  if (lastStep >= rules.length) return null

  const nextStepIndex = lastStep
  const rule = rules[nextStepIndex]

  if (!rule) return null
  if (daysSince < rule.days) return null

  return {
    nextStepIndex,
    rule,
  }
}

export function extractInterestFromTags(tags: string[] | null | undefined): string {
  const interesse = (tags || []).find((tag) => tag.startsWith('interesse:'))?.split(':')[1] || ''
  return interesse.replace(/_/g, ' ')
}

export function formatFollowUpMessage(params: {
  template: string
  nome: string
  produto: string
  daysSince: number
  loja: string
}): string {
  const { template, nome, produto, daysSince, loja } = params

  return template
    .replace(/\{nome\}/gi, nome)
    .replace(/\{produto\}/gi, produto)
    .replace(/\{dias_sem_contato\}/gi, String(daysSince))
    .replace(/\{loja\}/gi, loja)
}

export function shouldTriggerAiAgentFromWebhook(input: WebhookAiTriggerInput): boolean {
  const { direction, fromMe, mediaType, statusIa } = input

  if (direction !== 'incoming') return false
  if (fromMe) return false
  if (mediaType === 'audio') return false

  return statusIa !== STATUS_IA.DESLIGADA
}

export interface WebhookShadowTriggerInput {
  fromMe: boolean
  mediaType: string
  statusIa?: string | null
  content?: string
}

/**
 * Determines if a vendor message (fromMe:true) in shadow mode should trigger
 * silent extraction. Called by whatsapp-webhook for outgoing messages.
 * n8n already filters wasSentByApi, so only human vendor messages reach here.
 */
export function shouldTriggerShadowFromWebhook(input: WebhookShadowTriggerInput): boolean {
  const { fromMe, mediaType, statusIa, content } = input
  if (!fromMe) return false
  if (mediaType === 'audio') return false
  if (statusIa !== STATUS_IA.SHADOW) return false
  if (!content || content.trim().length < 5) return false
  return true
}

/**
 * Returns true if the message is too trivial to warrant an LLM extraction call.
 * Used as pre-filter in shadow mode to save tokens.
 */
export function isTrivialMessage(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 5) return true
  // Only emojis/whitespace
  if (/^[\p{Emoji}\s]+$/u.test(trimmed)) return true
  const normalized = trimmed.toLowerCase().replace(/[.,!?]+$/, '').trim()
  const trivialSet = new Set(['ok', 'sim', 'blz', 'certo', 'entendido', 'obrigado', 'obg', 'tá', 'ta', 'não', 'nao', 'oi', 'ok entendi'])
  return trivialSet.has(normalized)
}
