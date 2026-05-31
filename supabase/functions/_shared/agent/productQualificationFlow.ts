/**
 * Product qualification flow (Eletropiso premium).
 *
 * Pure decision helper. It does not call LLMs, DB, WhatsApp, or product search.
 * The runtime can use this as the deterministic source for:
 * - which field must be asked next;
 * - when product search is allowed;
 * - when catalog-empty/offline flows must continue qualifying and then handoff;
 * - which safety flags must stay internal.
 */

import {
  extractInteresseFromTags,
  getCategoriesOrDefault,
  getScoreFromTags,
  matchCategory,
  matchCategoryBySearchText,
  type QualificationField,
  type ServiceCategory,
  type ServiceCategoriesConfig,
  type Stage,
} from '../serviceCategories.ts'

export type CatalogResult = 'unknown' | 'found' | 'empty'
export type PremiumFlowMode = 'no_category' | 'qualify' | 'search' | 'qualify_then_handoff' | 'handoff'

export interface ProductQualificationFlowInput {
  tags?: string[] | null
  agent?: { service_categories?: unknown } | null
  incomingText?: string | null
  /**
   * Internal product-search result. This value is never meant to be shown to the lead.
   * empty means: keep qualifying briefly, then handoff to validate physical stock.
   */
  catalogResult?: CatalogResult
  /** Maximum useful product questions after an empty catalog result. Default: 2. */
  maxQuestionsAfterEmpty?: number
}

export interface ProductQualificationFlowVerdict {
  category: ServiceCategory | null
  categoryId: string | null
  categoryLabel: string | null
  catalogStatus: 'digital' | 'offline' | 'none'
  catalogResult: CatalogResult
  flowMode: PremiumFlowMode
  qualificationScore: number
  answeredFieldKeys: string[]
  missingFieldKeys: string[]
  nextRequiredField: QualificationField | null
  readyToSearch: boolean
  readyToHandoff: boolean
  searchEnabled: boolean
  showCarousel: boolean
  physicalStockRequired: boolean
  neutralStockLanguage: boolean
  questionsAfterEmpty: number
  reason: string
}

const META_KEYS = new Set([
  'motivo',
  'interesse',
  'pedido_original',
  'lead_score',
  'ia',
  'ia_cleared',
  'enrich_count',
  'search_fail',
  'catalog_result',
  'catalog_status',
  'flow_mode',
  'handoff_created',
  'agent_status',
  'human_assigned',
  'seller_notified',
  'followups_paused',
  'produto',
  'selected_product',
  'aguardando_upsell',
])

export function resolveProductCategory(
  tags: string[] | null | undefined,
  agent: ProductQualificationFlowInput['agent'],
  incomingText?: string | null,
): { config: ServiceCategoriesConfig; category: ServiceCategory | null } {
  const config = getCategoriesOrDefault(agent)
  const interesse = extractInteresseFromTags(tags)
  const category = matchCategory(interesse, config) ||
    (incomingText ? matchCategoryBySearchText(incomingText, config) : null)
  return { config, category }
}

export function extractCollectedFields(tags: string[] | null | undefined): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(tags)) return out

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const idx = tag.indexOf(':')
    if (idx <= 0) continue
    const key = tag.slice(0, idx).trim()
    const value = tag.slice(idx + 1).trim()
    if (!key || !value || META_KEYS.has(key)) continue
    out.add(key)
  }

  return out
}

/**
 * Base name de um field key suffixado por categoria: `ambiente_torneira` → `ambiente`,
 * `tipo_portao` → `tipo`, `material_porta` → `material`. Sem `_` → o próprio key.
 * Usado pra casar tags GENÉRICAS que o LLM specialist grava (`ambiente:cozinha`) com os
 * field keys ESPECÍFICOS da categoria (`ambiente_torneira`). Era o "mismatch de chave"
 * que travava o handoff do fluxo de catálogo-vazio (cenário 21.37 torneira gourmet).
 */
export function fieldBaseName(key: string): string {
  const idx = key.lastIndexOf('_')
  return idx > 0 ? key.slice(0, idx) : key
}

/** Campo respondido se a tag tem o key EXATO ou a base genérica dele. */
export function isFieldAnswered(fieldKey: string, answered: Set<string>): boolean {
  if (answered.has(fieldKey)) return true
  const base = fieldBaseName(fieldKey)
  return base !== fieldKey && answered.has(base)
}

export function getNextRequiredField(
  stages: Stage[] | null | undefined,
  answeredFieldKeys: Set<string>,
): QualificationField | null {
  const fields = flattenStageFields(stages)
  for (const field of fields) {
    if (!isFieldAnswered(field.key, answeredFieldKeys)) return field
  }
  return null
}

export function evaluateProductQualificationFlow(
  input: ProductQualificationFlowInput,
): ProductQualificationFlowVerdict {
  const tags = Array.isArray(input.tags) ? input.tags : []
  const catalogResult: CatalogResult = input.catalogResult || inferCatalogResult(tags)
  const maxQuestionsAfterEmpty = Number.isFinite(input.maxQuestionsAfterEmpty)
    ? Math.max(0, Number(input.maxQuestionsAfterEmpty))
    : 2

  try {
    const { config, category } = resolveProductCategory(tags, input.agent, input.incomingText)
    const answered = extractCollectedFields(tags)

    if (!category) {
      return {
        category: null,
        categoryId: null,
        categoryLabel: null,
        catalogStatus: 'digital',
        catalogResult,
        flowMode: 'no_category',
        qualificationScore: getScoreFromTags(tags),
        answeredFieldKeys: [...answered],
        missingFieldKeys: [],
        nextRequiredField: null,
        readyToSearch: false,
        readyToHandoff: false,
        searchEnabled: false,
        showCarousel: false,
        physicalStockRequired: false,
        neutralStockLanguage: true,
        questionsAfterEmpty: getQuestionsAfterEmpty(tags),
        reason: 'no product category resolved',
      }
    }

    const catalogStatus = (category.catalog_status as 'digital' | 'offline' | 'none' | undefined) || 'digital'
    const stages = category.stages && category.stages.length > 0 ? category.stages : config.default.stages
    const allFields = flattenStageFields(stages)
    const searchFields = getFieldsUntilSearchStage(stages)
    const missing = allFields.filter((field) => !isFieldAnswered(field.key, answered))
    const missingSearchFields = searchFields.filter((field) => !isFieldAnswered(field.key, answered))
    const score = Math.max(getScoreFromTags(tags), calculateAnsweredScore(stages, answered))
    const questionsAfterEmpty = getQuestionsAfterEmpty(tags)
    const emptyOrOffline = catalogResult === 'empty' || catalogStatus !== 'digital'

    if (emptyOrOffline) {
      const nextRequiredField = missing[0] || null
      const canAskMoreAfterEmpty = questionsAfterEmpty < maxQuestionsAfterEmpty
      // Converge SEMPRE: handoff quando todos os campos foram coletados OU quando o cap
      // de perguntas pós-vazio foi atingido. Antes, categorias "premium full" exigiam
      // TODOS os field keys — e como o LLM grava tags genéricas (não os keys suffixados),
      // os campos nunca "fechavam" e a IA reperguntava pra sempre sem transbordar (21.37).
      const readyToHandoff = !nextRequiredField || !canAskMoreAfterEmpty

      return {
        category,
        categoryId: category.id,
        categoryLabel: category.label,
        catalogStatus,
        catalogResult,
        flowMode: readyToHandoff ? 'handoff' : 'qualify_then_handoff',
        qualificationScore: score,
        answeredFieldKeys: [...answered],
        missingFieldKeys: missing.map((field) => field.key),
        nextRequiredField: readyToHandoff ? null : nextRequiredField,
        readyToSearch: false,
        readyToHandoff,
        searchEnabled: false,
        showCarousel: false,
        physicalStockRequired: true,
        neutralStockLanguage: true,
        questionsAfterEmpty,
        reason: readyToHandoff
          ? 'catalog empty/offline qualification limit reached; handoff with structured context'
          : 'catalog empty/offline; continue qualifying before handoff',
      }
    }

    const searchReadyScore = getSearchReadyScore(stages)
    const hasSearchStage = searchReadyScore !== null
    const readyToSearch = hasSearchStage && score >= searchReadyScore && missingSearchFields.length === 0
    const nextRequiredField = readyToSearch ? null : (missingSearchFields[0] || missing[0] || null)

    if (readyToSearch) {
      return {
        category,
        categoryId: category.id,
        categoryLabel: category.label,
        catalogStatus,
        catalogResult,
        flowMode: 'search',
        qualificationScore: score,
        answeredFieldKeys: [...answered],
        missingFieldKeys: missing.map((field) => field.key),
        nextRequiredField: null,
        readyToSearch: true,
        readyToHandoff: false,
        searchEnabled: true,
        showCarousel: catalogResult === 'found',
        physicalStockRequired: false,
        neutralStockLanguage: true,
        questionsAfterEmpty,
        reason: 'minimum search qualification reached',
      }
    }

    const readyToHandoff = !hasSearchStage && !nextRequiredField
    return {
      category,
      categoryId: category.id,
      categoryLabel: category.label,
      catalogStatus,
      catalogResult,
      flowMode: readyToHandoff ? 'handoff' : 'qualify',
      qualificationScore: score,
      answeredFieldKeys: [...answered],
      missingFieldKeys: missing.map((field) => field.key),
      nextRequiredField,
      readyToSearch: false,
      readyToHandoff,
      searchEnabled: false,
      showCarousel: false,
      physicalStockRequired: false,
      neutralStockLanguage: true,
      questionsAfterEmpty,
      reason: readyToHandoff
        ? 'category has no search stage and all fields are collected'
        : 'qualification required before search',
    }
  } catch {
    return {
      category: null,
      categoryId: null,
      categoryLabel: null,
      catalogStatus: 'digital',
      catalogResult,
      flowMode: 'no_category',
      qualificationScore: getScoreFromTags(tags),
      answeredFieldKeys: [],
      missingFieldKeys: [],
      nextRequiredField: null,
      readyToSearch: false,
      readyToHandoff: false,
      searchEnabled: false,
      showCarousel: false,
      physicalStockRequired: false,
      neutralStockLanguage: true,
      questionsAfterEmpty: getQuestionsAfterEmpty(tags),
      reason: 'product qualification flow fallback after error',
    }
  }
}

function flattenStageFields(stages: Stage[] | null | undefined): QualificationField[] {
  if (!Array.isArray(stages)) return []
  const out: QualificationField[] = []
  const seen = new Set<string>()

  const sortedStages = stages.slice().sort((a, b) => a.min_score - b.min_score)
  for (const stage of sortedStages) {
    const sortedFields = (stage.fields || []).slice().sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.key.localeCompare(b.key)
    })
    for (const field of sortedFields) {
      if (seen.has(field.key)) continue
      seen.add(field.key)
      out.push(field)
    }
  }

  return out
}

function getFieldsUntilSearchStage(stages: Stage[] | null | undefined): QualificationField[] {
  if (!Array.isArray(stages)) return []
  const sortedStages = stages.slice().sort((a, b) => a.min_score - b.min_score)
  const out: Stage[] = []

  for (const stage of sortedStages) {
    out.push(stage)
    if (stage.exit_action === 'search_products') break
  }

  return flattenStageFields(out)
}

function getSearchReadyScore(stages: Stage[] | null | undefined): number | null {
  if (!Array.isArray(stages)) return null
  const sortedStages = stages.slice().sort((a, b) => a.min_score - b.min_score)
  const searchStage = sortedStages.find((stage) => stage.exit_action === 'search_products')
  return searchStage ? searchStage.max_score : null
}

function calculateAnsweredScore(stages: Stage[] | null | undefined, answered: Set<string>): number {
  let score = 0
  for (const field of flattenStageFields(stages)) {
    if (isFieldAnswered(field.key, answered)) score += field.score_value
  }
  return score
}

function inferCatalogResult(tags: string[]): CatalogResult {
  const tag = tags.find((item) => typeof item === 'string' && item.startsWith('catalog_result:'))
  const value = tag ? tag.slice('catalog_result:'.length).trim() : ''
  if (value === 'empty' || value === 'found') return value
  return 'unknown'
}

function getQuestionsAfterEmpty(tags: string[]): number {
  let last = 0
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    if (!tag.startsWith('questions_after_empty:')) continue
    const raw = tag.slice('questions_after_empty:'.length).trim()
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 0) last = parsed
  }
  return last
}
