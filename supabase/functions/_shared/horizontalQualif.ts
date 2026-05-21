// Helper de qualificação horizontal (Sprint B1.5 — R136 Paloma 2026-05-21).
// Quando o detector de multi-item acha uma lista mista (≥1 categoria cadastrada + ≥1 orphan),
// a IA NÃO deve qualificar item por item (vertical) — isso ignora os orphans e gera repetição.
// Faz UMA pergunta horizontal abrangente (ambiente + marca/tipo/qualidade) e na resposta
// dispara handoff_to_human com motivo rico pro vendedor humano fechar o orçamento.

import type { MultiItemDetectorResult } from './multiItemDetector.ts'

export const HORIZONTAL_QUALIF_PENDING_TAG = 'qualif_horizontal:pending'

export interface HorizontalQualifContext {
  detector: MultiItemDetectorResult
  leadName: string | null
  originalText: string
}

export interface HorizontalQualifQuestion {
  text: string
  pendingTag: string
}

export interface HorizontalHandoffReason {
  reason: string
}

const MAX_QUESTION_CHARS = 250
const MAX_BLOCK_CHARS = 200

// Categorias que disparam template específico. Match por substring no id (normalizado).
const TINT_CATEGORY_HINTS = ['tinta', 'pintura', 'verniz', 'esmalte']
const PORTA_CATEGORY_HINTS = ['porta', 'janela', 'fechadura', 'esquadria']

function normalizeId(id: string): string {
  return id.toLowerCase().trim()
}

function hasCategoryHint(categoryIds: string[], hints: string[]): boolean {
  return categoryIds.some((id) => {
    const n = normalizeId(id)
    return hints.some((h) => n.includes(h))
  })
}

function sanitizeText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 3).trimEnd() + '...'
}

function firstName(leadName: string | null): string | null {
  if (!leadName) return null
  const f = leadName.trim().split(/\s+/)[0]
  return f && f.length > 0 ? f : null
}

/**
 * Gera a pergunta horizontal a fazer pro lead.
 */
export function buildHorizontalQuestion(ctx: HorizontalQualifContext): HorizontalQualifQuestion {
  const matchedCategoryIds = ctx.detector.items
    .map((i) => i.matchedCategoryId)
    .filter((c): c is string => typeof c === 'string' && c.length > 0)

  const hasTint = hasCategoryHint(matchedCategoryIds, TINT_CATEGORY_HINTS)
  const hasPorta = hasCategoryHint(matchedCategoryIds, PORTA_CATEGORY_HINTS)
  const onlyOrphans = matchedCategoryIds.length === 0

  let dynamic: string
  if (hasTint) {
    dynamic = 'pra qual ambiente (interno/externo)? Tem preferência de marca, tipo de tinta ou qualidade?'
  } else if (hasPorta) {
    dynamic = 'pra qual ambiente (interno/externo)? Tem preferência de material (madeira, alumínio, PVC) ou tamanho?'
  } else if (onlyOrphans) {
    dynamic = 'pra qual ambiente vai usar? (interno/externo) Tem preferência de marca, tipo ou qualidade?'
  } else {
    dynamic = 'pra qual ambiente (interno/externo)? Tem preferência de marca, tipo ou qualidade?'
  }

  const fn = firstName(ctx.leadName)
  const prefix = fn ? `${fn}, anotei aqui.` : 'Anotei aqui.'
  const raw = `${prefix} Pra eu te ajudar melhor: ${dynamic}`
  const text = truncate(raw, MAX_QUESTION_CHARS)

  return { text, pendingTag: HORIZONTAL_QUALIF_PENDING_TAG }
}

function describeItem(item: MultiItemDetectorResult['items'][number]): string {
  const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
  const label = (item.productHint || item.raw || '').trim() || '(item)'
  const catSuffix = item.matchedCategoryId
    ? `(categoria: ${item.matchedCategoryId})`
    : '(sem categoria cadastrada)'
  return `• ${qty}× ${truncate(label, 120)} ${catSuffix}`
}

/**
 * Constrói reason rico pro handoff a partir da resposta do lead + contexto inicial.
 */
export function buildHorizontalHandoffReason(opts: {
  detector: MultiItemDetectorResult
  leadName: string | null
  originalText: string
  leadAnswerToHorizontal: string
}): HorizontalHandoffReason {
  const fn = firstName(opts.leadName) ?? 'Lead'
  const itemsBlock = opts.detector.items.map(describeItem).join('\n')

  const sanitizedAnswer = sanitizeText(opts.leadAnswerToHorizontal || '')
  const sanitizedOriginal = sanitizeText(opts.originalText || '')

  const parts: string[] = []
  parts.push(`${fn} solicitou orçamento multi-item:`)
  parts.push(itemsBlock)
  if (sanitizedAnswer.length > 0) {
    parts.push('')
    parts.push('Contexto coletado:')
    parts.push(truncate(sanitizedAnswer, MAX_BLOCK_CHARS))
  }
  if (sanitizedOriginal.length > 0) {
    parts.push('')
    parts.push('Mensagem original:')
    parts.push(truncate(sanitizedOriginal, MAX_BLOCK_CHARS))
  }

  return { reason: parts.join('\n') }
}
