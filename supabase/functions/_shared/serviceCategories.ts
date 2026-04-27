/**
 * Service Categories v2 — Stages + Score Progressivo (M19-S10 v2).
 *
 * Substitui o schema plano de v1 (qualification_fields[] + ask_pre_search boolean)
 * por stages com score progressivo. Cada categoria tem N stages, cada stage tem
 * fields com score_value, e um exit_action que dispara quando o lead atinge
 * max_score (search_products | enrichment | handoff | continue).
 *
 * Backward compat:
 *   - getCategoriesOrDefault detecta v1 (sem "stages" em categorias) e retorna
 *     DEFAULT_SERVICE_CATEGORIES_V2 — degrade gracefully em vez de crashar.
 *   - getQualificationFields() existe como compat shim para chamadas legadas; usa
 *     stages internamente: askPreSearch=true -> fields do PRIMEIRO stage,
 *     false -> fields dos stages restantes.
 *
 * Usage (em ai-agent/index.ts apos F3 v2):
 *   import {
 *     getCategoriesOrDefault, matchCategory,
 *     getCurrentStage, getNextField, getScoreFromTags, getExitAction,
 *     calculateScoreDelta, formatPhrasing, extractInteresseFromTags,
 *   } from '../_shared/serviceCategories.ts'
 *
 *   const config = getCategoriesOrDefault(agent)
 *   const interesse = extractInteresseFromTags(currentTags)
 *   const cat = matchCategory(interesse, config)
 *   const score = getScoreFromTags(currentTags)
 *   const stage = getCurrentStage(score, cat, config.default)
 *   const next = getNextField(stage, currentTags)
 *   const text = formatPhrasing(stage.phrasing, next!)
 *   // apos handler set_tags adicionar tags:
 *   const delta = calculateScoreDelta(addedTags, cat, config.default)
 *   const action = getExitAction(score + delta, cat, config.default)
 */

// =============================================================================
// Tipos
// =============================================================================

export type ExitAction = 'search_products' | 'enrichment' | 'handoff' | 'continue'

export interface QualificationField {
  key: string
  label: string
  examples: string
  score_value: number
  priority: number
}

export interface Stage {
  id: string
  label: string
  min_score: number
  max_score: number
  exit_action: ExitAction
  fields: QualificationField[]
  /** Template com placeholders {label} e {examples}, usado para formular a pergunta. */
  phrasing: string
}

export interface ServiceCategory {
  id: string
  label: string
  /** Regex string usado contra a tag interesse:VALUE. Validado em runtime com try/catch. */
  interesse_match: string
  stages: Stage[]
}

export interface DefaultCategory {
  stages: Stage[]
}

export interface ServiceCategoriesConfig {
  categories: ServiceCategory[]
  default: DefaultCategory
}

// =============================================================================
// Seed default v2 — IDENTICO ao DEFAULT JSONB da migration v2.
// =============================================================================

export const DEFAULT_SERVICE_CATEGORIES_V2: ServiceCategoriesConfig = {
  categories: [
    {
      id: 'tintas',
      label: 'Tintas e Vernizes',
      interesse_match: 'tinta|esmalte|verniz|impermeabilizante',
      stages: [
        {
          id: 'identificacao',
          label: 'Identificação',
          min_score: 0,
          max_score: 30,
          exit_action: 'search_products',
          fields: [
            { key: 'ambiente', label: 'ambiente', examples: 'interno ou externo', score_value: 15, priority: 1 },
            { key: 'cor',      label: 'cor',      examples: 'branco, cinza, etc.', score_value: 15, priority: 2 },
          ],
          phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
        },
        {
          id: 'detalhamento',
          label: 'Detalhamento',
          min_score: 30,
          max_score: 70,
          exit_action: 'enrichment',
          fields: [
            { key: 'acabamento',      label: 'acabamento',      examples: 'fosco, acetinado, brilho, semibrilho', score_value: 20, priority: 1 },
            { key: 'marca_preferida', label: 'marca preferida', examples: 'Coral, Suvinil',                       score_value: 20, priority: 2 },
          ],
          phrasing: 'Certo! E sobre {label}, prefere {examples}?',
        },
        {
          id: 'fechamento',
          label: 'Pronto para Handoff',
          min_score: 70,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'quantidade', label: 'quantidade',       examples: 'litros ou galões', score_value: 15, priority: 1 },
            { key: 'area',       label: 'metragem da área', examples: 'em m²',            score_value: 15, priority: 2 },
          ],
          phrasing: 'Antes de te conectar com o vendedor, {label}?',
        },
      ],
    },
    {
      id: 'impermeabilizantes',
      label: 'Impermeabilizantes e Mantas',
      interesse_match: 'impermeabilizante|manta',
      stages: [
        {
          id: 'triagem',
          label: 'Triagem',
          min_score: 0,
          max_score: 60,
          exit_action: 'search_products',
          fields: [
            { key: 'area',      label: 'área',              examples: 'tamanho da área',    score_value: 30, priority: 1 },
            { key: 'aplicacao', label: 'tipo de aplicação', examples: 'laje, parede, piso', score_value: 30, priority: 2 },
          ],
          phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
        },
        {
          id: 'fechamento',
          label: 'Pronto para Handoff',
          min_score: 60,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'marca_preferida', label: 'marca preferida', examples: '', score_value: 40, priority: 1 },
          ],
          phrasing: 'Antes de transferir, {label}?',
        },
      ],
    },
  ],
  default: {
    stages: [
      {
        id: 'qualificacao_basica',
        label: 'Qualificação básica',
        min_score: 0,
        max_score: 100,
        exit_action: 'handoff',
        fields: [
          { key: 'especificacao',   label: 'detalhes',              examples: 'qualquer informação relevante', score_value: 25, priority: 1 },
          { key: 'marca_preferida', label: 'marca preferida',       examples: '',                              score_value: 25, priority: 2 },
          { key: 'quantidade',      label: 'quantidade necessária', examples: '',                              score_value: 25, priority: 3 },
        ],
        phrasing: 'Para te ajudar melhor, me conta {label}?',
      },
    ],
  },
}

// =============================================================================
// Validacao de schema
// =============================================================================

const VALID_EXIT_ACTIONS: ReadonlySet<string> = new Set([
  'search_products',
  'enrichment',
  'handoff',
  'continue',
])

function isValidQualificationField(v: unknown): v is QualificationField {
  if (!v || typeof v !== 'object') return false
  const f = v as Record<string, unknown>
  return (
    typeof f.key === 'string' &&
    typeof f.label === 'string' &&
    typeof f.examples === 'string' &&
    typeof f.score_value === 'number' &&
    typeof f.priority === 'number'
  )
}

function isValidStage(v: unknown): v is Stage {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    typeof s.min_score === 'number' &&
    typeof s.max_score === 'number' &&
    typeof s.exit_action === 'string' &&
    VALID_EXIT_ACTIONS.has(s.exit_action) &&
    Array.isArray(s.fields) &&
    s.fields.every(isValidQualificationField) &&
    typeof s.phrasing === 'string'
  )
}

function isValidCategory(v: unknown): v is ServiceCategory {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.interesse_match === 'string' &&
    Array.isArray(c.stages) &&
    c.stages.length > 0 &&
    c.stages.every(isValidStage)
  )
}

function isValidDefault(v: unknown): v is DefaultCategory {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  return (
    Array.isArray(d.stages) &&
    d.stages.length > 0 &&
    d.stages.every(isValidStage)
  )
}

function isValidConfig(v: unknown): v is ServiceCategoriesConfig {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    Array.isArray(c.categories) &&
    c.categories.every(isValidCategory) &&
    isValidDefault(c.default)
  )
}

// =============================================================================
// API publica
// =============================================================================

/**
 * Retorna a config valida do agente, ou DEFAULT_SERVICE_CATEGORIES_V2 caso a
 * coluna esteja null, undefined, malformada, ou no formato v1 (sem "stages").
 *
 * Defesa em profundidade — nunca lanca; sempre retorna config valida v2.
 * Detecta v1 quando categoria tem qualification_fields mas nao tem stages.
 */
export function getCategoriesOrDefault(
  agent: { service_categories?: unknown } | null | undefined,
): ServiceCategoriesConfig {
  if (!agent) return DEFAULT_SERVICE_CATEGORIES_V2
  const raw = agent.service_categories
  if (raw == null) return DEFAULT_SERVICE_CATEGORIES_V2
  if (!isValidConfig(raw)) return DEFAULT_SERVICE_CATEGORIES_V2
  return raw
}

/**
 * Retorna a primeira categoria cujo regex `interesse_match` casa com `interesse`.
 * Se nenhuma categoria casar (ou se interesse for vazio/null), retorna null —
 * caller deve usar config.default como fallback.
 *
 * Regex invalido em uma categoria e logado e ignorado (nao crasha).
 */
export function matchCategory(
  interesse: string | null | undefined,
  config: ServiceCategoriesConfig,
): ServiceCategory | null {
  if (!interesse) return null
  const trimmed = String(interesse).trim()
  if (!trimmed) return null

  for (const cat of config.categories) {
    let re: RegExp
    try {
      re = new RegExp(cat.interesse_match, 'i')
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`[serviceCategories] Regex invalido em categoria "${cat.id}": ${cat.interesse_match}`)
      continue
    }
    if (re.test(trimmed)) return cat
  }
  return null
}

/**
 * Descobre o stage atual com base no score acumulado.
 *
 * - Stages sao ordenados por min_score crescente (input ja deveria estar, mas
 *   ordenamos defensivamente).
 * - O stage retornado e aquele cujo intervalo [min_score, max_score) inclui o
 *   score atual.
 * - Se score >= max_score do ultimo stage (overflow), retorna o ultimo —
 *   significa "passou de tudo" (handoff/exit ja deveria ter disparado).
 * - Se score < min_score do primeiro stage (clamp), retorna o primeiro.
 * - Se a categoria for null/sem stages, usa fallback.default.stages.
 *
 * NUNCA retorna null — sempre ha pelo menos 1 stage no fallback default.
 */
export function getCurrentStage(
  score: number,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): Stage {
  const sourceStages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  // Defesa: se fallback tambem nao tem stages (config quebrada), usa default v2
  const stages = (sourceStages && sourceStages.length > 0)
    ? sourceStages
    : DEFAULT_SERVICE_CATEGORIES_V2.default.stages

  // Ordena defensivamente por min_score crescente
  const sorted = stages.slice().sort((a, b) => a.min_score - b.min_score)

  const safeScore = Number.isFinite(score) ? score : 0

  // Se score < min_score do primeiro, retorna primeiro stage (clamp)
  if (safeScore < sorted[0].min_score) return sorted[0]

  // Procura stage cujo intervalo [min, max) contem o score
  for (const stage of sorted) {
    if (safeScore >= stage.min_score && safeScore < stage.max_score) {
      return stage
    }
  }

  // Overflow: score >= max_score do ultimo stage -> retorna o ultimo
  return sorted[sorted.length - 1]
}

/**
 * Le score acumulado do array de tags procurando "lead_score:N".
 *
 * - Retorna 0 se nao houver tag.
 * - Retorna 0 se valor nao for inteiro valido (ex: "lead_score:abc").
 * - Se houver multiplas tags lead_score:N, retorna a ULTIMA com valor valido
 *   (a mais recente na lista — convencao do AI Agent que append no fim).
 */
export function getScoreFromTags(tags: string[] | null | undefined): number {
  if (!Array.isArray(tags)) return 0

  let lastValid = 0
  let foundAny = false

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    if (!tag.startsWith('lead_score:')) continue

    const rawValue = tag.slice('lead_score:'.length).trim()
    const parsed = Number.parseInt(rawValue, 10)

    if (Number.isFinite(parsed) && /^-?\d+$/.test(rawValue)) {
      lastValid = parsed
      foundAny = true
    }
  }

  return foundAny ? lastValid : 0
}

/**
 * Dado um stage e tags atuais, retorna o proximo field NAO RESPONDIDO,
 * ordenado por priority crescente (tie-breaker: alfabetica por key).
 *
 * Field "respondido" = ja existe tag "key:value" no array (qualquer valor).
 * Ex: stage com fields [ambiente, cor]; tags=['ambiente:externo']
 *      -> retorna field "cor".
 *
 * Retorna null se todos os fields ja foram respondidos.
 */
export function getNextField(
  stage: Stage | null | undefined,
  currentTags: string[] | null | undefined,
): QualificationField | null {
  if (!stage || !Array.isArray(stage.fields) || stage.fields.length === 0) return null

  const tags: string[] = Array.isArray(currentTags) ? currentTags : []
  const answeredKeys = new Set<string>()

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const colonIdx = tag.indexOf(':')
    if (colonIdx <= 0) continue // ignora "interesse" sem valor ou tag sem ":"
    const key = tag.slice(0, colonIdx).trim()
    if (key) answeredKeys.add(key)
  }

  const sorted = stage.fields.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.key.localeCompare(b.key)
  })

  for (const field of sorted) {
    if (!answeredKeys.has(field.key)) return field
  }
  return null
}

/**
 * Dado um conjunto de tags ADICIONADAS pelo handler set_tags do AI Agent,
 * calcula quanto score adicionar olhando os fields de TODOS os stages da
 * categoria atual cuja key corresponde.
 *
 * - Se a tag nao tiver formato "key:value", e ignorada.
 * - Se a key nao existir em nenhum field da categoria atual, soma 0.
 * - Se a categoria for null, usa fallback.default.stages.
 * - Cada tag e contada UMA vez mesmo que apareca duplicada.
 */
export function calculateScoreDelta(
  addedTags: string[] | null | undefined,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): number {
  if (!Array.isArray(addedTags) || addedTags.length === 0) return 0

  const stages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  if (!stages || stages.length === 0) return 0

  // Constroi mapa key -> score_value (primeiro field que matcha vence)
  const scoreMap = new Map<string, number>()
  for (const stage of stages) {
    if (!Array.isArray(stage.fields)) continue
    for (const field of stage.fields) {
      if (!scoreMap.has(field.key)) {
        scoreMap.set(field.key, field.score_value)
      }
    }
  }

  const seenKeys = new Set<string>()
  let delta = 0

  for (const tag of addedTags) {
    if (typeof tag !== 'string') continue
    const colonIdx = tag.indexOf(':')
    if (colonIdx <= 0) continue
    const key = tag.slice(0, colonIdx).trim()
    if (!key || seenKeys.has(key)) continue

    const value = scoreMap.get(key)
    if (typeof value === 'number' && Number.isFinite(value)) {
      delta += value
      seenKeys.add(key)
    }
  }

  return delta
}

/**
 * Retorna o exit_action do stage atual com base no score.
 * Wrapper de conveniencia: equivale a getCurrentStage(...).exit_action.
 */
export function getExitAction(
  score: number,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): ExitAction {
  const stage = getCurrentStage(score, category, fallback)
  return stage.exit_action
}

/**
 * Substitui os placeholders {label} e {examples} no template.
 * Ex: formatPhrasing("Sobre {label}, prefere {examples}?", { label: "cor", examples: "azul", ... })
 *      -> "Sobre cor, prefere azul?"
 */
export function formatPhrasing(template: string, field: QualificationField): string {
  if (!template) return ''
  return template
    .replace(/\{label\}/g, field.label)
    .replace(/\{examples\}/g, field.examples)
}

/**
 * Helper de conveniencia: extrai o valor da tag "interesse:X" de um array de tags.
 * Tags seguem o formato "key:value". Retorna string vazia se nao encontrar.
 *
 * Ex: ["motivo:compra", "interesse:tinta", "cidade:recife"] -> "tinta"
 */
export function extractInteresseFromTags(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags)) return ''
  const found = tags.find(t => typeof t === 'string' && t.startsWith('interesse:'))
  if (!found) return ''
  return found.slice('interesse:'.length).trim()
}

// =============================================================================
// LEGACY v1 — compat shim para chamadas existentes em ai-agent/index.ts
//
// askPreSearch=true  -> retorna fields do PRIMEIRO stage (equivale a "Identificação"
//                       em tintas, "Triagem" em impermeabilizantes, etc.)
// askPreSearch=false -> retorna fields dos stages a partir do segundo (enrichment).
//
// Mantem ordenacao por priority dentro de cada batch. Se a categoria so tem 1
// stage (ex: default), askPreSearch=true retorna [] e askPreSearch=false retorna
// todos os fields desse unico stage.
// =============================================================================

export function getQualificationFields(
  category: ServiceCategory | null,
  fallback: DefaultCategory,
  askPreSearch: boolean,
): QualificationField[] {
  const stages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  if (!stages || stages.length === 0) return []

  // Ordena defensivamente por min_score crescente para definir "primeiro stage"
  const sorted = stages.slice().sort((a, b) => a.min_score - b.min_score)

  let pickedFields: QualificationField[] = []

  if (askPreSearch) {
    // So o primeiro stage. Para default (1 stage so), retorna [] — comportamento
    // identico ao v1 onde category=null com askPreSearch=true retornava [].
    if (sorted.length > 1) {
      pickedFields = sorted[0].fields ?? []
    } else {
      // Categoria com 1 stage so (ex: default) -> nao ha "pre_search" separado
      pickedFields = []
    }
  } else {
    if (sorted.length > 1) {
      // Stages 2+ (enrichment + fechamento + ...)
      for (let i = 1; i < sorted.length; i++) {
        pickedFields = pickedFields.concat(sorted[i].fields ?? [])
      }
    } else {
      // Categoria com 1 stage so (default) -> retorna todos os fields desse stage
      pickedFields = sorted[0].fields ?? []
    }
  }

  return pickedFields
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.key.localeCompare(b.key)
    })
}
