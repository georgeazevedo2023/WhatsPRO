/**
 * qualificationGate (2026-05-24) — FONTE ÚNICA "buscar vs qualificar".
 *
 * Motivação (auditoria profunda 2026-05-24): a decisão de "o lead está pronto pra
 * buscar produto, ou ainda preciso qualificar?" estava espalhada em 4 decisores
 * rivais sem fonte de verdade — stage engine (qualify-first), detectIncomingSearchSignal
 * /R121 (force-search em "tem X?" vago), deriveProductSearchParams, e o LLM do
 * product_specialist. Na migração monolito→router, o stage engine ficou no pré-LLM
 * mas o router+product_specialist criou um caminho de busca paralelo que NÃO consultava
 * o estado de qualificação → inter-agent misalignment (MAST). Resultado: lead que
 * abria com "tem porcelanato?" caía direto em busca/qualif confusa, sem o fluxo
 * consultivo (qualifica até o score liberar → ENTÃO busca).
 *
 * Este gate centraliza a regra num único lugar determinístico, lendo o MESMO stage
 * engine (serviceCategories) que já governa o score. Todo decisor de busca passa a
 * consultá-lo:
 *   - dispatch do router (index.ts): intent='produto' + gate não-pronto → redireciona
 *     pro qualification_specialist (pergunta o próximo campo, acumula score) e suprime
 *     a pré-busca. Quando o score atinge o threshold, libera o product_specialist.
 *   - deriveProductSearchParams (productSpecialist.ts): defesa — devolve null se não-pronto.
 *
 * Semântica de "pronto pra buscar" (readyToSearch):
 *   - SEM categoria resolvível → ready=true (não há o que qualificar; mantém o
 *     comportamento anterior, deixa o LLM/search decidir).
 *   - Categoria OFFLINE/none → ready=false, mode='qualify_then_handoff' (nunca busca;
 *     o product_specialist qualifica brevemente + handoff com contexto rico).
 *   - Categoria DIGITAL → existe um stage com exit_action='search_products' cujo
 *     max_score é o "limiar de busca". ready = score >= esse limiar.
 *       score >= limiar → ready=true, mode='search'
 *       score <  limiar → ready=false, mode='qualify' (pergunta o próximo campo)
 *   - Categoria DIGITAL sem nenhum stage com exit_action='search_products' (raro) →
 *     ready=false, mode='qualify_then_handoff' (qualifica até o handoff).
 */

import {
  getCategoriesOrDefault,
  matchCategory,
  matchCategoryBySearchText,
  getScoreFromTags,
  extractInteresseFromTags,
  type ServiceCategory,
} from '../serviceCategories.ts'

export type QualificationGateMode = 'search' | 'qualify' | 'qualify_then_handoff' | 'no_category'

export interface QualificationGateInput {
  /** Tags atuais da conversa (interesse:, lead_score:, campos qualif). */
  tags: string[] | null | undefined
  /** Agent com service_categories (config do stage engine). */
  agent: { service_categories?: unknown } | null | undefined
  /** Texto incoming — usado pra resolver categoria quando ainda não há tag interesse:. */
  incomingText?: string | null
}

export interface QualificationGateVerdict {
  /** TRUE = pode buscar produto agora. FALSE = qualificar primeiro. */
  readyToSearch: boolean
  /** Como tratar este turno. Ver semântica no topo do arquivo. */
  mode: QualificationGateMode
  /** Explicação curta (telemetria/debug). */
  reason: string
  /** Categoria resolvida (null se nenhuma casou). */
  category: ServiceCategory | null
  /** id da categoria (conveniência). */
  categoryId: string | null
  /** Score acumulado lido das tags. */
  score: number
  /** Limiar de score que libera busca (max_score do 1º stage search_products). null se a categoria nunca busca. */
  searchReadyScore: number | null
  /** Status do catálogo da categoria. */
  catalogStatus: 'digital' | 'offline' | 'none'
}

/**
 * Decide, de forma determinística e única, se o lead está pronto pra buscar produto
 * ou ainda precisa qualificar. NUNCA lança — em qualquer dúvida devolve ready=true
 * (degrade gracioso: não trava o lead num loop de qualificação).
 */
export function evaluateQualificationGate(
  input: QualificationGateInput,
): QualificationGateVerdict {
  const tags = Array.isArray(input.tags) ? input.tags : []

  try {
    const cfg = getCategoriesOrDefault(input.agent)
    const interesse = extractInteresseFromTags(tags)
    const category =
      matchCategory(interesse, cfg) ||
      (input.incomingText ? matchCategoryBySearchText(input.incomingText, cfg) : null)

    if (!category) {
      return {
        readyToSearch: true,
        mode: 'no_category',
        reason: 'nenhuma categoria resolvida — sem qualificação aplicável',
        category: null,
        categoryId: null,
        score: getScoreFromTags(tags),
        searchReadyScore: null,
        catalogStatus: 'digital',
      }
    }

    const catalogStatus = (category.catalog_status as 'digital' | 'offline' | 'none' | undefined) || 'digital'
    const score = getScoreFromTags(tags)

    // Categoria offline/none → loja vende mas o catálogo digital não tem inventory.
    // Nunca busca; qualifica brevemente + handoff com contexto rico pro vendedor.
    if (catalogStatus !== 'digital') {
      return {
        readyToSearch: false,
        mode: 'qualify_then_handoff',
        reason: `categoria ${category.id} é ${catalogStatus} — qualifica + handoff, nunca busca`,
        category,
        categoryId: category.id,
        score,
        searchReadyScore: null,
        catalogStatus,
      }
    }

    // Categoria digital: o limiar de busca é o max_score do PRIMEIRO stage cujo
    // exit_action='search_products'. Ordena defensivamente por min_score.
    const sortedStages = (category.stages || []).slice().sort((a, b) => a.min_score - b.min_score)
    const searchStage = sortedStages.find((s) => s.exit_action === 'search_products')

    if (!searchStage) {
      // Digital mas nenhum stage busca (config incomum) → qualifica até o handoff.
      return {
        readyToSearch: false,
        mode: 'qualify_then_handoff',
        reason: `categoria ${category.id} digital sem stage search_products — qualifica até handoff`,
        category,
        categoryId: category.id,
        score,
        searchReadyScore: null,
        catalogStatus,
      }
    }

    const searchReadyScore = searchStage.max_score
    if (score >= searchReadyScore) {
      return {
        readyToSearch: true,
        mode: 'search',
        reason: `score ${score} >= limiar ${searchReadyScore} (${category.id}) — pronto pra buscar`,
        category,
        categoryId: category.id,
        score,
        searchReadyScore,
        catalogStatus,
      }
    }

    return {
      readyToSearch: false,
      mode: 'qualify',
      reason: `score ${score} < limiar ${searchReadyScore} (${category.id}) — qualifica primeiro`,
      category,
      categoryId: category.id,
      score,
      searchReadyScore,
      catalogStatus,
    }
  } catch {
    // Degrade gracioso: em erro, não trava o lead — libera busca.
    return {
      readyToSearch: true,
      mode: 'no_category',
      reason: 'erro na avaliação do gate — fallback ready',
      category: null,
      categoryId: null,
      score: getScoreFromTags(tags),
      searchReadyScore: null,
      catalogStatus: 'digital',
    }
  }
}
