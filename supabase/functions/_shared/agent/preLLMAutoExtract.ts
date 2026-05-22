/**
 * Sprint B5 Onda 2c-ii — Auto-extração pré-LLM + setup de exit actions.
 *
 * Antes do LLM rodar, este módulo:
 *   1. Resolve a categoria do lead (via tag interesse: ou matchByText).
 *   2. R121 "tem X?" trigger — se a msg parece "vcs têm X?" e a categoria
 *      tem catalog_status=digital, marca pendingExitActionSearch pra forçar
 *      search_products inline (módulo B).
 *   3. Auto-extrai fields da categoria (acabamento, cor, marca, ambiente, ...)
 *      direto da msg do lead — evita LLM perguntar de novo o que já está claro.
 *   4. Calcula score progressivo. Se atingir max_score do stage com:
 *        - exit_action=handoff → pendingExitActionHandoff (dispatcher módulo B)
 *        - exit_action=search_products + catalog digital → pendingExitActionSearch
 *   5. Persiste tags (interesse + fields + lead_score) no DB + log auto_field_extracted.
 *
 * Não faz IO de mensagem (sem sendTextMsg/broadcast). Só DB updates de tags +
 * 1 log estruturado.
 *
 * Caller deve depois despachar pendingExitAction* via `_shared/agent/exitActionDispatcher.ts`.
 */

import {
  getCategoriesOrDefault,
  matchCategory,
  matchCategoryBySearchText,
  getCurrentStage,
  getScoreFromTags,
  calculateScoreDelta,
} from '../serviceCategories.ts'
import { autoExtractFields, flattenCategoryFields } from '../fieldAutoExtractor.ts'
import { STATUS_IA } from '../constants.ts'
import { detectIncomingSearchSignal } from '../searchGuard.ts'
import { DEFAULT_BRANDS } from '../brandDetection.ts'
import { cleanSearchQuery } from './tools/searchProducts.ts'
import type { Logger } from './context.ts'

/**
 * R137 + R138 (2026-05-22) — strip "lead name" patterns do final da query.
 * O texto bruto do lead pode terminar com "com X" / "meu nome é X" / "sou X"
 * que NÃO descreve produto. Sem strip, vira ruído na busca + risco de match
 * em "George" cross-category. Patterns conservadores: só removem 1-2 palavras
 * no FINAL da string pra não corromper queries legítimas tipo "tinta com brilho".
 */
function stripLeadNameSuffix(s: string): string {
  if (!s) return ''
  return s
    .replace(/\b(?:com|meu\s+nome\s+(?:e|é)|sou|me\s+chamo)\s+\w{2,30}\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// Tipos públicos
// =============================================================================

export interface PendingExitActionHandoff {
  reason: string
  queueMotivo: string
}

export interface PendingExitActionSearch {
  query: string
  category: string
}

export interface PreLLMAutoExtractCtx {
  supabase: any
  conversation: {
    id?: string
    tags?: string[] | null
    status_ia?: string | null
  } & Record<string, any>
  conversation_id: string
  agent_id: string
  agent: any
  incomingText: string
  /** Sinaliza que R129 multi-categoria detectou + bloqueou o auto-extract. */
  suppressAutoExtractForMulti: boolean
}

export interface PreLLMAutoExtractResult {
  pendingExitActionHandoff: PendingExitActionHandoff | null
  pendingExitActionSearch: PendingExitActionSearch | null
  tagsMutated: boolean
}

// =============================================================================
// Helpers internos
// =============================================================================

/**
 * META_KEYS removidos da query do search_products inline — tags meta não são
 * descritores do produto (motivo:, interesse:, lead_score:, ia:, etc).
 */
const META_KEYS = new Set([
  'motivo',
  'interesse',
  'lead_score',
  'ia',
  'ia_cleared',
  'enrich_count',
  'search_fail',
  'produto',
  'aguardando_upsell',
  'venda',
  'tipo_cliente',
  'marca_citada',
  'objecao',
  'pagamento',
])

const DIRECT_PRODUCT_QUESTION_RE =
  /(?:^|\s)(?:vcs?|voc[êe]s?)?\s*(?:tem|t[êe]m|vende[mn]?|fazem|trabalham\s+com|trabalha\s+com|tem\s+dispon[ií]vel)\s+/i

/** Monta query do search_products a partir do interesse + tags atuais (+ novas). */
function buildSearchQuery(
  interesseValue: string,
  tags: string[],
  newTags: string[] = [],
  fallbackText = '',
): string {
  const parts: string[] = []
  if (interesseValue) parts.push(interesseValue)
  for (const t of [...tags, ...newTags]) {
    if (typeof t !== 'string') continue
    const idx = t.indexOf(':')
    if (idx < 0) continue
    const k = t.slice(0, idx)
    const v = t.slice(idx + 1)
    if (META_KEYS.has(k)) continue
    if (v && !parts.some((p) => p.toLowerCase().includes(v.toLowerCase()))) {
      parts.push(v)
    }
  }
  const q = parts.join(' ').trim()
  return q.length > 0 ? q : fallbackText.trim()
}

// =============================================================================
// API pública
// =============================================================================

export async function runPreLLMAutoExtract(
  ctx: PreLLMAutoExtractCtx,
  log: Logger,
): Promise<PreLLMAutoExtractResult> {
  let pendingExitActionHandoff: PendingExitActionHandoff | null = null
  let pendingExitActionSearch: PendingExitActionSearch | null = null
  let tagsMutated = false

  if (!ctx.incomingText || !ctx.incomingText.trim()) {
    return { pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }
  }

  const cfgPre = getCategoriesOrDefault(ctx.agent)
  const tagsNow = ctx.conversation.tags || []
  const interesseTagPre = tagsNow.find(
    (t: string) => typeof t === 'string' && t.startsWith('interesse:'),
  )
  const interesseValue = interesseTagPre ? interesseTagPre.split(':')[1] || '' : ''

  const categoryPre = ctx.suppressAutoExtractForMulti
    ? null
    : matchCategory(interesseValue, cfgPre) ||
      matchCategoryBySearchText(ctx.incomingText, cfgPre)

  if (!categoryPre) {
    return { pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }
  }

  const catalogStatusPreCat = (categoryPre as any).catalog_status || 'digital'

  // ── R121 pre-LLM "tem X?" trigger ───────────────────────────────────
  // Lead pergunta direto e nenhum field foi extraido (auto-extract pode dar 0).
  // Roda ANTES do auto-extract pra forçar search inline mesmo sem score acumulado.
  const isDirectProductQuestion = DIRECT_PRODUCT_QUESTION_RE.test(ctx.incomingText)
  const leadHasReceivedProducts = tagsNow.some(
    (t: string) => typeof t === 'string' && (t.startsWith('produto:') || t === 'aguardando_upsell'),
  )
  if (
    isDirectProductQuestion &&
    !leadHasReceivedProducts &&
    ctx.conversation.status_ia !== STATUS_IA.SHADOW
  ) {
    if (catalogStatusPreCat === 'digital') {
      const queryR121 = buildSearchQuery(interesseValue, tagsNow, [], ctx.incomingText)
      pendingExitActionSearch = {
        query: queryR121,
        category: interesseValue || categoryPre.id || '',
      }
      log.info('R121: pre-LLM "tem X?" trigger (categoria digital)', {
        query: queryR121,
        category: categoryPre.id,
        incoming_preview: ctx.incomingText.substring(0, 80),
      })
    } else {
      log.info('R121: "tem X?" detectado em categoria offline — fluxo natural qualif+handoff', {
        category: categoryPre.id,
        incoming_preview: ctx.incomingText.substring(0, 80),
      })
    }
  }

  // ── R137 searchGuard wire (v7.41.6 2026-05-22, com sanitização R138) ──
  // Cobre o gap deixado pelo DIRECT_PRODUCT_QUESTION_RE acima:
  //   - "Por quanto está a tinta Iquine?" (marca isolada sem verbo R121)
  //   - "Preciso de tinta acrílica" / "Quero coral fosca"
  //
  // Histórico: 1ª versão (v7.41.4) shippada sem sanitização → query bruta com
  // vírgulas/"?" quebrou PostgREST .or() → crash em prod (caso Sandrielly).
  // v7.41.6 sanitiza signal.query DUAS vezes:
  //   1. stripLeadNameSuffix — remove "com X" / "meu nome é X" do fim
  //   2. cleanSearchQuery — strip vírgulas, "?", parênteses, etc.
  if (
    !pendingExitActionSearch &&
    !leadHasReceivedProducts &&
    catalogStatusPreCat === 'digital' &&
    ctx.conversation.status_ia !== STATUS_IA.SHADOW
  ) {
    const signal = detectIncomingSearchSignal({
      text: ctx.incomingText,
      knownBrands: DEFAULT_BRANDS,
    })
    if (signal.force && signal.query) {
      const stripped = stripLeadNameSuffix(signal.query)
      const cleaned = cleanSearchQuery(stripped)
      // Combina com tags existentes (interesseValue + tags), depois sanitiza
      // de novo pra garantir que buildSearchQuery não reintroduza ruído.
      const combinedQuery = cleanSearchQuery(
        buildSearchQuery(interesseValue, tagsNow, [], cleaned),
      )
      if (combinedQuery.length >= 2) {
        pendingExitActionSearch = {
          query: combinedQuery,
          category: interesseValue || categoryPre.id || '',
        }
        log.info('R137: searchGuard wire forçando search_products inline', {
          reason: signal.reason,
          detector_query: signal.query,
          stripped_query: stripped,
          final_query: combinedQuery,
          category: categoryPre.id,
          incoming_preview: ctx.incomingText.substring(0, 80),
        })
      }
    }
  }

  // ── Auto-extract de fields ─────────────────────────────────────────
  const allFields = flattenCategoryFields(categoryPre.stages)
  const existingKeys = new Set<string>()
  for (const t of tagsNow) {
    if (typeof t !== 'string') continue
    const idx = t.indexOf(':')
    if (idx > 0) existingKeys.add(t.slice(0, idx))
  }
  const extracted = autoExtractFields(ctx.incomingText, allFields, existingKeys)

  if (extracted.length === 0) {
    return { pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }
  }

  const newTags = extracted.map((ef) => `${ef.key}:${ef.value}`)
  const seedTags: string[] = []
  if (!interesseTagPre) {
    seedTags.push(`interesse:${categoryPre.id}`)
  }

  // Bug 24: score progressivo (mirror set_tags handler).
  const scoreDelta = calculateScoreDelta(newTags, categoryPre, cfgPre.default)
  const scoreTags: string[] = []
  if (scoreDelta > 0) {
    const currentScore = getScoreFromTags(tagsNow)
    const newScore = Math.min(100, currentScore + scoreDelta)
    scoreTags.push(`lead_score:${newScore}`)
    const stageAfter = getCurrentStage(newScore, categoryPre, cfgPre.default)

    // exit_action=handoff: completou qualif → dispara handoff (módulo B).
    if (
      newScore >= stageAfter.max_score &&
      stageAfter.exit_action === 'handoff' &&
      ctx.conversation.status_ia !== STATUS_IA.SHADOW
    ) {
      const qualSummary = newTags
        .filter(
          (t) =>
            !t.startsWith('lead_score:') && !t.startsWith('motivo:') && !t.startsWith('interesse:'),
        )
        .map((t) => t.replace(/_/g, ' '))
        .join(', ')
      pendingExitActionHandoff = {
        reason: `${interesseValue || categoryPre.id} > ${qualSummary}`,
        queueMotivo: `${categoryPre.label} — ${qualSummary}`,
      }
      log.info('Bug 24: exit_action=handoff disparado via auto-extract', {
        stage: stageAfter.label,
        newScore,
        max_score: stageAfter.max_score,
      })
    }

    // C2 fallback: "tem X?" não bateu mas score atingiu max_score com search_products.
    if (
      !pendingExitActionSearch &&
      newScore >= stageAfter.max_score &&
      stageAfter.exit_action === 'search_products' &&
      catalogStatusPreCat === 'digital' &&
      ctx.conversation.status_ia !== STATUS_IA.SHADOW
    ) {
      const query = buildSearchQuery(interesseValue, tagsNow, newTags, '')
      pendingExitActionSearch = {
        query,
        category: interesseValue || categoryPre.id || '',
      }
      log.info('R121: exit_action=search_products disparado via auto-extract', {
        stage: stageAfter.label,
        newScore,
        max_score: stageAfter.max_score,
        query,
      })
    }
  }

  // Persiste tags + log.
  const mergedTags = [...tagsNow, ...seedTags, ...newTags, ...scoreTags]
  ctx.conversation.tags = mergedTags
  tagsMutated = true
  await ctx.supabase.from('conversations').update({ tags: mergedTags }).eq('id', ctx.conversation_id)
  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'auto_field_extracted',
    latency_ms: 0,
    metadata: {
      extracted,
      new_tags: newTags,
      seed_tags: seedTags,
      score_delta: scoreDelta,
      category_id: categoryPre.id,
      resolved_via: interesseTagPre ? 'interesse_tag' : 'search_text',
      incoming_preview: ctx.incomingText.substring(0, 120),
      pending_exit_handoff: !!pendingExitActionHandoff,
    },
  })
  log.info('Auto-extracted fields from incoming text', {
    extracted,
    newTags,
    seedTags,
    scoreDelta,
    categoryId: categoryPre.id,
    pendingExitActionHandoff: !!pendingExitActionHandoff,
  })

  return { pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }
}
