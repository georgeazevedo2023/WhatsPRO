/**
 * Compatibility bridge for the premium product qualification flow.
 *
 * This module translates the current tag-based runtime state into the explicit
 * premium contract without changing the runtime yet. It is pure and safe to test.
 */

import type {
  CatalogResult,
  PremiumFlowMode,
  ProductQualificationFlowVerdict,
} from './productQualificationFlow.ts'

export interface ProductQualificationState {
  catalogResult: CatalogResult
  questionsAfterEmpty: number
  flowMode: PremiumFlowMode | null
  physicalStockRequired: boolean
  searchEnabled: boolean | null
  showCarousel: boolean | null
  readyToHandoff: boolean
  handoffCreated: boolean
  agentInactive: boolean
  humanAssigned: boolean
  sellerNotified: boolean
  followupsPaused: boolean
}

const STATE_KEYS = new Set([
  'catalog_result',
  'questions_after_empty',
  'flow_mode',
  'physical_stock_required',
  'search_enabled',
  'show_carousel',
  'ready_to_handoff',
  'handoff_created',
  'agent_status',
  'human_assigned',
  'seller_notified',
  'followups_paused',
])

export function readProductQualificationState(tags: string[] | null | undefined): ProductQualificationState {
  const safeTags = Array.isArray(tags) ? tags : []
  const catalogResult = readCatalogResult(safeTags)
  const flowMode = readFlowMode(safeTags)

  return {
    catalogResult,
    questionsAfterEmpty: readNumberTag(safeTags, 'questions_after_empty')
      ?? readNumberTag(safeTags, 'enrich_count')
      ?? 0,
    flowMode,
    physicalStockRequired: readBoolTag(safeTags, 'physical_stock_required') ?? catalogResult === 'empty',
    searchEnabled: readBoolTag(safeTags, 'search_enabled'),
    showCarousel: readBoolTag(safeTags, 'show_carousel'),
    readyToHandoff: readBoolTag(safeTags, 'ready_to_handoff') ?? flowMode === 'handoff',
    handoffCreated: readBoolTag(safeTags, 'handoff_created') ?? false,
    agentInactive: latestTagValue(safeTags, 'agent_status') === 'inactive',
    humanAssigned: readBoolTag(safeTags, 'human_assigned') ?? false,
    sellerNotified: readBoolTag(safeTags, 'seller_notified') ?? false,
    followupsPaused: readBoolTag(safeTags, 'followups_paused') ?? false,
  }
}

export function buildProductQualificationStateTags(
  verdict: ProductQualificationFlowVerdict,
): string[] {
  const tags = [
    `catalog_result:${verdict.catalogResult}`,
    `questions_after_empty:${verdict.questionsAfterEmpty}`,
    `flow_mode:${verdict.flowMode}`,
    `physical_stock_required:${String(verdict.physicalStockRequired)}`,
    `search_enabled:${String(verdict.searchEnabled)}`,
    `show_carousel:${String(verdict.showCarousel)}`,
    `ready_to_handoff:${String(verdict.readyToHandoff)}`,
  ]

  if (verdict.readyToHandoff) {
    tags.push('followups_paused:true')
  }

  return tags
}

export function buildHandoffStateTags(): string[] {
  return [
    'handoff_created:true',
    'agent_status:inactive',
    'human_assigned:true',
    'seller_notified:true',
    'followups_paused:true',
  ]
}

export function inferProductQualificationAnswerTag(
  fieldKey: string | null | undefined,
  text: string | null | undefined,
): Record<string, string> | null {
  const key = (fieldKey || '').trim()
  const normalized = normalizeAnswer(text)
  if (!key || !normalized) return null

  const pick = (...items: Array<[RegExp, string]>): string | null => {
    for (const [pattern, value] of items) {
      if (pattern.test(normalized)) return value
    }
    return null
  }

  const value = (() => {
    switch (key) {
      case 'ambiente_torneira':
        return pick([/\bcozinha\b/, 'cozinha'], [/\barea gourmet\b/, 'area gourmet'])
      case 'tipo_torneira':
        return pick([/\bbancada\b/, 'bancada'], [/\bparede\b/, 'parede'])
      case 'modelo_torneira':
        return pick(
          [/\bducha\b|\bflexivel\b/, 'ducha flexivel'],
          [/\bbica alta\b|\bbica\b/, 'bica alta'],
        )
      case 'acabamento_torneira':
        return pick(
          [/\bpreto fosco\b|\bfosco\b/, 'preto fosco'],
          [/\bcromad[oa]\b/, 'cromado'],
          [/\bdourad[oa]\b/, 'dourado'],
          [/\bescovad[oa]\b/, 'escovado'],
        )
      case 'tipo_cuba':
        return pick([/\bdupla\b/, 'dupla'], [/\bsimples\b/, 'simples'])
      case 'perfil':
        return pick(
          [/\bpremium\b|\bsofisticad[oa]\b|\bmelhor\b|\btop\b|\balto padrao\b/, 'premium'],
          [/\bcusto beneficio\b|\beconomic[oa]\b|\bbarat[oa]\b|\bintermediari[oa]\b/, 'custo-beneficio'],
        )
      case 'objetivo':
        return pick(
          [/\breforma\b|\breformar\b/, 'reforma'],
          [/\bobra nova\b|\bconstrucao\b|\bconstruindo\b/, 'obra nova'],
        )
      case 'aplicacao_revestimento':
      case 'aplicacao':
        return pick(
          [/\bpiso\b/, 'piso'],
          [/\bparede\b|\bparedes\b/, 'parede'],
          [/\bteto\b/, 'teto'],
          [/\bporta\b|\bportas\b/, 'porta'],
          [/\bmovel\b|\bmoveis\b|\bmóveis\b/, 'moveis'],
        )
      case 'ambiente_revestimento':
      case 'ambiente':
        return pick(
          [/\binterno\b|\binterna\b|\bdentro\b/, 'interno'],
          [/\bexterno\b|\bexterna\b|\bfora\b/, 'externo'],
          [/\bresidencial\b|\bcasa\b|\bminha casa\b/, 'residencial'],
          [/\bcomercial\b|\bloja\b|\bempresa\b/, 'comercial'],
        )
      case 'tipo_tinta':
        return pick(
          [/\bacrilic[ao]\b|\bacrilica\b|\bacrílica\b/, 'acrilica'],
          [/\besmalte\b/, 'esmalte'],
          [/\bepoxi\b|\bepóxi\b/, 'epoxi'],
        )
      case 'formato': {
        const match = normalized.match(/\b(\d{2,3})\s*x\s*(\d{2,3})\b/)
        return match ? `${match[1]}x${match[2]}` : null
      }
      case 'acabamento':
        return pick(
          [/\bbrilhante\b|\bpolid[oa]\b/, 'brilhante'],
          [/\bacetinad[oa]\b/, 'acetinado'],
          [/\bfosco\b/, 'fosco'],
        )
      case 'cor':
        return pick(
          [/\bbege claro\b/, 'bege claro'],
          [/\bbege\b/, 'bege'],
          [/\bcinza\b/, 'cinza'],
          [/\bbranc[oa]\b|\boff white\b/, 'branco'],
          [/\bclar[ao]\b/, 'claro'],
        )
      case 'local_aplicacao':
        return pick(
          [/\bsala\b.*\bcozinha\b|\bcozinha\b.*\bsala\b/, 'sala e cozinha integradas'],
          [/\bsala\b/, 'sala'],
          [/\bcozinha\b/, 'cozinha'],
          [/\bquarto\b/, 'quarto'],
          [/\bbanheiro\b/, 'banheiro'],
          [/\barea integrada\b/, 'area integrada'],
        )
      case 'area': {
        const match = normalized.match(/\b(\d{1,4})\s*(m2|metros|metro|m)\b/) || normalized.match(/\b(\d{2,4})\b/)
        return match ? `${match[1]}m2` : null
      }
      default:
        return null
    }
  })()

  return value ? { [key]: value } : null
}

export function mergeProductQualificationStateTags(
  existingTags: string[] | null | undefined,
  stateTags: string[],
): string[] {
  const retained = (Array.isArray(existingTags) ? existingTags : [])
    .filter((tag) => {
      if (typeof tag !== 'string') return false
      const idx = tag.indexOf(':')
      if (idx <= 0) return true
      return !STATE_KEYS.has(tag.slice(0, idx))
    })

  const merged = [...retained, ...dedupeByKeyKeepingLast(stateTags)]
  return merged.length > 0 ? merged : [`ia_cleared:${new Date().toISOString()}`]
}

export function latestTagValue(tags: string[] | null | undefined, key: string): string | null {
  if (!Array.isArray(tags) || !key) return null
  let value: string | null = null

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    if (!tag.startsWith(`${key}:`)) continue
    value = tag.slice(key.length + 1).trim()
  }

  return value
}

function normalizeAnswer(text: string | null | undefined): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readCatalogResult(tags: string[]): CatalogResult {
  const explicit = latestTagValue(tags, 'catalog_result')
  if (explicit === 'found' || explicit === 'empty') return explicit
  if (tags.some((tag) => typeof tag === 'string' && tag.startsWith('search_fail'))) return 'empty'
  return 'unknown'
}

function readFlowMode(tags: string[]): PremiumFlowMode | null {
  const value = latestTagValue(tags, 'flow_mode')
  if (
    value === 'no_category' ||
    value === 'qualify' ||
    value === 'search' ||
    value === 'qualify_then_handoff' ||
    value === 'handoff'
  ) {
    return value
  }
  return null
}

function readBoolTag(tags: string[], key: string): boolean | null {
  const value = latestTagValue(tags, key)
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function readNumberTag(tags: string[], key: string): number | null {
  const value = latestTagValue(tags, key)
  if (value === null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function dedupeByKeyKeepingLast(tags: string[]): string[] {
  const out: string[] = []
  const indexByKey = new Map<string, number>()

  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag.trim()) continue
    const idx = tag.indexOf(':')
    const key = idx > 0 ? tag.slice(0, idx) : tag
    const previousIndex = indexByKey.get(key)

    if (previousIndex !== undefined) {
      out[previousIndex] = tag
    } else {
      indexByKey.set(key, out.length)
      out.push(tag)
    }
  }

  return out
}
