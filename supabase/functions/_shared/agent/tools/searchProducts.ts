/**
 * Sprint B5 Onda 3c — Tool search_products.
 *
 * Extrai o handler search_products do switch `executeTool` do ai-agent (~650 lin).
 * Este é o módulo mais complexo do switch e VIRA o product_specialist no Sprint C.
 *
 * Pipeline (preservado 1:1 do monolito):
 *   1. Bug 27: seed interesse: tag se LLM esqueceu de tagear
 *   2. R126 searchGuard: bloqueia query genérica sem expectedCategory
 *   3. Primary search (ILIKE OR title/description/category/subcategory)
 *   4. AND fallback word-by-word + brand detection (R104/R108/R110)
 *   5. Bug 8 cross-category filter (pre-fuzzy + post-fuzzy)
 *   6. Fuzzy pg_trgm RPC (R111 filtros JS)
 *   7. Zero-results: R120 outside_hours / PATH A (enrich) / PATH B (handoff) / PATH C (retry)
 *   8. Found-results: auto-tag + auto-send media/carousel
 *   9. Build result text com instruções NÍVEL 2 ao LLM
 *
 * Sem mudança de comportamento — equivalência semântica linha-a-linha.
 */

import { generateCarouselCopies, cleanProductTitle } from '../../carousel.ts'
import { fetchWithTimeout } from '../../fetchWithTimeout.ts'
import { mergeTags, escapeLike } from '../../agentHelpers.ts'
import { evaluateSearchGuard } from '../../searchGuard.ts'
import { isOutsideBusinessHours } from '../../businessHours.ts'
import { filterNonBrandTerms } from '../../qualificationStopWords.ts'
import { autoExtractFields, flattenCategoryFields } from '../../fieldAutoExtractor.ts'
import {
  getCategoriesOrDefault,
  matchCategory,
  matchCategoryBySearchText,
  extractInteresseFromTags,
  getCurrentStage,
  getScoreFromTags,
  formatPhrasing,
  filterProductsByExpectedCategory,
} from '../../serviceCategories.ts'
import type { Logger } from '../context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export type BroadcastEventFn = (evt: Record<string, any>) => void
export type BuildQualificationChainFn = (
  tags: string[],
  pendingTags: Record<string, string>,
  name: string | null,
) => string

export interface SearchProductsCtx {
  supabase: any
  agent: Record<string, any>
  agent_id: string
  conversation: { tags?: string[] | null; inbox_id?: string | null } & Record<string, any>
  conversation_id: string
  contact: { jid: string; name?: string | null } & Record<string, any>
  instance: { token: string } & Record<string, any>
  uazapiUrl: string
  incomingText: string
  leadName: string | null
  /** Mutable ref — função muta `carouselSent=true` quando envia mídia.
   *  Caller usa pra evitar carrossel duplicado em chamadas posteriores no mesmo turn. */
  mediaState: { carouselSent: boolean }
  broadcastEvent: BroadcastEventFn
  /** Callback porque buildQualificationChain ainda mora no index.ts (usado também em
   *  handoff_to_human). Será extraído pra _shared depois (scope creep evitado aqui). */
  buildQualificationChain: BuildQualificationChainFn
}

// =============================================================================
// Helpers privados (cópia idêntica do monolito)
// =============================================================================

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function safeBtnId(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * R138 (2026-05-22) — sanitiza chars que quebram PostgREST `.or()` parsing.
 *
 * O parser de `.or()` no @supabase/supabase-js separa filtros por `,`, e o
 * value passado pra `.ilike.%X%` não é auto-escapado. Query com vírgula,
 * parênteses ou ponto-e-vírgula no value vira filter mal-formado → 400.
 *
 * Bug-trigger: caso Sandrielly (2026-05-22) — query gerada por R137 wire tinha
 * "pintalar da , de 3,6l?" → 2 vírgulas → `.or()` quebrado → search crashou.
 *
 * Strip de: `, ; : " ' ? ! ( ) [ ] { }` → espaço. Colapsa whitespace.
 * Mantém: letras, dígitos, hifens, pontos (pra "3.6L"), acentos, underscore.
 */
export function cleanSearchQuery(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/[,;:"'?!()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildEnrichmentInstructions(
  currentTags: string[],
  step: number,
  maxSteps: number,
  brandNotFound: string | null,
  agentCfg: any,
  searchTextFallback?: string,
): string {
  const has = (key: string) => currentTags.some((t) => t.startsWith(`${key}:`))
  const interesse = extractInteresseFromTags(currentTags)
  const config = getCategoriesOrDefault(agentCfg)

  // Bug 11/12 — se interesse: tag nao casar, tentar derivar via produto: tag e searchText.
  const produtoTag =
    currentTags.find((t) => t.startsWith('produto:'))?.slice('produto:'.length).replace(/_/g, ' ') || ''
  const category =
    matchCategory(interesse, config) ||
    matchCategory(produtoTag, config) ||
    matchCategory(searchTextFallback || '', config)
  const fallback = config.default

  const score = getScoreFromTags(currentTags)
  const currentStage = getCurrentStage(score, category, fallback)

  const stageFields = currentStage.fields
    .filter((f) => !has(f.key))
    .filter((f) => !(f.key === 'marca_preferida' && brandNotFound))
    .slice()
    .sort((a, b) => a.priority - b.priority)

  const suggestions = stageFields.slice(0, 2).map((f) => {
    const ex = f.examples ? ` (${f.examples})` : ''
    return `${f.label}${ex}`
  })

  const suggestionText =
    suggestions.length > 0
      ? `Sugestões de pergunta: ${suggestions.join(' ou ')}.`
      : 'Pergunte algo relevante que ajude o vendedor.'

  const isLast = step >= maxSteps
  const urgency = isLast
    ? ' Esta é a ÚLTIMA pergunta — após a resposta do lead, chame handoff_to_human com motivo detalhado.'
    : ''

  const answeredCountInStage = currentStage.fields.length - stageFields.length
  const exampleSentence =
    stageFields.length > 0
      ? ` Diga algo natural como: "${formatPhrasing(currentStage.phrasing, stageFields[0], answeredCountInStage)}"`
      : ''

  const categoryKeys = category?.stages.flatMap((s: any) => s.fields.map((f: any) => f.key)) || []
  const fallbackKeys = fallback.stages.flatMap((s: any) => s.fields.map((f: any) => f.key))
  const uniqueKeys = category
    ? Array.from(new Set(categoryKeys))
    : Array.from(new Set(fallbackKeys))

  const stageContext = ` Stage atual: "${currentStage.label}" (score ${score}/${currentStage.max_score}, exit_action=${currentStage.exit_action}).`

  const phrasingDiscipline =
    stageFields.length > 0
      ? ` REGRA DE FIDELIDADE: use EXATAMENTE os exemplos cadastrados nos parênteses das sugestões acima — NUNCA invente outros exemplos, NUNCA misture exemplos entre categorias. Se a sugestão acima diz "marca (Lorenzetti, Hydra)", sua frase DEVE conter "(Lorenzetti, Hydra)" literal.`
      : ''

  return `AÇÃO: faça UMA pergunta de enriquecimento para coletar mais dados para o vendedor.${stageContext} ${suggestionText}${urgency} NÃO diga que o produto não foi encontrado.${exampleSentence}${phrasingDiscipline} Salve a resposta do lead com set_tags (chaves PERMITIDAS para esta categoria: ${uniqueKeys.join(', ')}). NÃO use chaves fora desta lista. PROIBIDO: dizer "não temos", "não trabalhamos", "não encontrei".`
}

// =============================================================================
// search_products
// =============================================================================

export async function searchProducts(
  args: Record<string, any>,
  ctx: SearchProductsCtx,
  log: Logger,
): Promise<string> {
  const {
    supabase,
    agent,
    agent_id,
    conversation,
    conversation_id,
    contact,
    instance,
    uazapiUrl,
    incomingText,
    leadName,
    mediaState,
    broadcastEvent,
    buildQualificationChain,
  } = ctx

  // R138 (2026-05-22) — sanitiza args.query + args.category ANTES de qualquer
  // uso. Defesa contra LLM mandando vírgulas/parênteses (raros mas possíveis)
  // e contra callers internos (R137 wire) passando texto bruto com ruído.
  // Pre-existe ao R137 — qualquer query com `,` quebrava PostgREST `.or()`.
  if (typeof args.query === 'string') args.query = cleanSearchQuery(args.query)
  if (typeof args.category === 'string') args.category = cleanSearchQuery(args.category)

  // Bug 27 fix (2026-05-17): se LLM chama search_products SEM ter tagueado interesse:CAT,
  // backend deduz via matchCategoryBySearchText e seta a tag automaticamente.
  const existingInteresseTag27 = (conversation.tags || []).find(
    (t: string) => typeof t === 'string' && t.startsWith('interesse:'),
  )
  if (!existingInteresseTag27) {
    const cfg27 = getCategoriesOrDefault(agent)
    const txtParaMatch = `${args.category || ''} ${args.query || ''} ${incomingText || ''}`.trim()
    const cat27 = matchCategoryBySearchText(txtParaMatch, cfg27)
    if (cat27) {
      const seedTag27 = `interesse:${cat27.id}`
      const newTagsBag27 = [seedTag27]
      try {
        const flat27 = flattenCategoryFields(cat27.stages)
        const existingKeys27 = new Set<string>()
        for (const t of conversation.tags || []) {
          if (typeof t !== 'string') continue
          const idx = t.indexOf(':')
          if (idx > 0) existingKeys27.add(t.slice(0, idx))
        }
        const extracted27 = autoExtractFields(
          `${incomingText || ''} ${args.query || ''}`,
          flat27,
          existingKeys27,
        )
        for (const ef of extracted27) newTagsBag27.push(`${ef.key}:${ef.value}`)
      } catch {
        /* non-fatal */
      }
      const merged27 = [...(conversation.tags || []), ...newTagsBag27]
      conversation.tags = merged27
      await supabase.from('conversations').update({ tags: merged27 }).eq('id', conversation_id)
      await supabase.from('ai_agent_logs').insert({
        agent_id,
        conversation_id,
        event: 'auto_field_extracted',
        metadata: {
          source: 'bug27_search_products_seed',
          new_tags: newTagsBag27,
          category_id: cat27.id,
          query: args.query,
          args_category: args.category,
        },
      })
      log.info('Bug 27: auto-seeded interesse from search_products query', {
        category_id: cat27.id,
        newTagsBag27,
      })
    }
  }

  const baseQuery = () =>
    supabase
      .from('ai_agent_products')
      .select('title, category, subcategory, description, price, images, in_stock')
      .eq('agent_id', agent_id)
      .eq('enabled', true)

  let query = baseQuery()
  if (args.min_price) query = query.gte('price', args.min_price)
  if (args.max_price) query = query.lte('price', args.max_price)

  const searchText = args.query || ''
  const categoryText = args.category || ''

  // Bug 8 — Categoria esperada: deriva da arg category, da tag interesse: ja setada,
  // ou via matchCategory contra o query text.
  const v2ConfigForFilter = getCategoriesOrDefault(agent)
  const expectedCategory =
    matchCategory(categoryText, v2ConfigForFilter) ||
    matchCategory(extractInteresseFromTags(conversation.tags || []), v2ConfigForFilter) ||
    matchCategory(searchText, v2ConfigForFilter)

  // R126 (2026-05-20): guard determinístico ANTES do query DB.
  const searchGuard = evaluateSearchGuard({
    query: searchText,
    expectedCategoryId: expectedCategory?.id ?? null,
    expectedCategoryStatus: expectedCategory?.catalog_status,
  })
  if (!searchGuard.allowed) {
    await supabase.from('ai_agent_logs').insert({
      agent_id,
      conversation_id,
      event: 'search_guard_blocked',
      metadata: {
        reason: searchGuard.reason,
        query: searchText,
        category_id: expectedCategory?.id ?? null,
        catalog_status: expectedCategory?.catalog_status ?? null,
      },
    })
    log.info('R126: search_guard blocked tool call', {
      reason: searchGuard.reason,
      query: searchText,
      category: expectedCategory?.id,
    })
    return searchGuard.message
  }

  if (searchText) {
    const safeSearch = escapeLike(searchText)
    query = query.or(
      `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%,subcategory.ilike.%${safeSearch}%`,
    )
  }
  if (categoryText) {
    const safeCat = escapeLike(categoryText)
    query = query.or(`category.ilike.%${safeCat}%,subcategory.ilike.%${safeCat}%`)
  }

  let { data: products } = await query.limit(10)

  // Fallback: AND word-by-word
  let wordByWordBroadProducts: any[] | null = null
  if ((!products || products.length === 0) && searchText && searchText.includes(' ')) {
    const words = searchText.split(/\s+/).filter((w: string) => w.length > 2)
    if (words.length > 1) {
      const broadTerms = words
        .slice(0, 5)
        .map((w: string) => `title.ilike.%${escapeLike(w)}%,description.ilike.%${escapeLike(w)}%`)
        .join(',')
      let fallback = baseQuery()
      if (args.min_price) fallback = fallback.gte('price', args.min_price)
      if (args.max_price) fallback = fallback.lte('price', args.max_price)
      fallback = fallback.or(broadTerms)
      const { data: broadProducts } = await fallback.limit(50)
      wordByWordBroadProducts = broadProducts || []
      const filtered = wordByWordBroadProducts.filter((p: any) => {
        const haystack = stripAccents(`${p.title} ${p.description || ''} ${p.category || ''}`)
        return words.every((w: string) => haystack.includes(stripAccents(w)))
      })
      if (filtered.length > 0) {
        products = filtered.slice(0, 10)
        log.info('search_products AND-fallback found results', {
          count: products.length,
          words: words.join(', '),
        })
      } else {
        const missingFromCatalog = words.filter(
          (w: string) =>
            !wordByWordBroadProducts!.some((p: any) => {
              const h = stripAccents(`${p.title} ${p.description || ''}`)
              return h.includes(stripAccents(w))
            }),
        )
        if (missingFromCatalog.length > 0) {
          log.info('search_products AND-fallback: term(s) not in catalog at all', {
            missingFromCatalog,
            query: searchText,
          })
        }
      }
    }
  }

  // POST-SEARCH FILTER + brand detection
  let brandNotFound: string | null = null
  if (searchText) {
    const queryWords = stripAccents(searchText).split(/\s+/).filter((w: string) => w.length > 2)
    if (queryWords.length > 0 && products && products.length > 0) {
      const strictFiltered = products.filter((p: any) => {
        const haystack = stripAccents(
          `${p.title} ${p.description || ''} ${p.category || ''} ${p.subcategory || ''}`,
        )
        return queryWords.every((w: string) => haystack.includes(w))
      })
      if (strictFiltered.length > 0) {
        if (strictFiltered.length < products.length) {
          log.info('Post-search AND filter applied', {
            before: products.length,
            after: strictFiltered.length,
            query: searchText,
          })
        }
        products = strictFiltered
      } else {
        const missingTermsRaw = queryWords.filter(
          (w: string) =>
            !products!.some((p: any) => {
              const h = stripAccents(
                `${p.title} ${p.description || ''} ${p.category || ''} ${p.subcategory || ''}`,
              )
              return h.includes(w)
            }),
        )
        const missingTerms = filterNonBrandTerms(missingTermsRaw)
        if (missingTerms.length > 0) {
          if (missingTerms.length <= 2) {
            brandNotFound = missingTerms.join(', ')
          }
          products = []
          log.info('Post-search AND filter: terms not in catalog → zero results, skip fuzzy', {
            missingTermsRaw,
            missingTerms,
            brandNotFound,
            query: searchText,
          })
        }
      }
    } else if (
      queryWords.length > 0 &&
      (!products || products.length === 0) &&
      wordByWordBroadProducts !== null
    ) {
      const missingFromBroadRaw = queryWords.filter(
        (w: string) =>
          !wordByWordBroadProducts!.some((p: any) => {
            const h = stripAccents(`${p.title} ${p.description || ''}`)
            return h.includes(w)
          }),
      )
      const missingFromBroad = filterNonBrandTerms(missingFromBroadRaw)
      if (missingFromBroad.length > 0) {
        if (missingFromBroad.length <= 2) {
          brandNotFound = missingFromBroad.join(', ')
        }
        log.info('Post-search brand detection (from broad results): terms not in catalog', {
          missingFromBroadRaw,
          missingFromBroad,
          brandNotFound,
          query: searchText,
        })
      }
    }
  }

  // Bug 8 — Filter cross-category leak ANTES do fuzzy
  if (expectedCategory && products && products.length > 0) {
    const filtered = filterProductsByExpectedCategory(products, expectedCategory)
    if (filtered.length < products.length) {
      log.info('Bug 8 pre-fuzzy filter: cross-category dropped', {
        expectedCategory: expectedCategory.id,
        before: products.length,
        after: filtered.length,
        droppedSample: products
          .filter((p: any) => !filtered.includes(p))
          .slice(0, 2)
          .map((p: any) => ({ title: p.title, category: p.category })),
      })
    }
    products = filtered
  }

  // #6: Fallback 2 — fuzzy pg_trgm
  if ((!products || products.length === 0) && searchText && !brandNotFound) {
    const { data: fuzzyProducts } = await supabase.rpc('search_products_fuzzy', {
      _agent_id: agent_id,
      _query: searchText,
      _threshold: 0.3,
      _limit: 10,
    })
    if (fuzzyProducts && fuzzyProducts.length > 0) {
      const filteredFuzzy = (fuzzyProducts as any[]).filter((p: any) => {
        if (
          args.min_price &&
          (p.price === null || p.price === undefined || Number(p.price) < args.min_price)
        )
          return false
        if (
          args.max_price &&
          (p.price === null || p.price === undefined || Number(p.price) > args.max_price)
        )
          return false
        if (categoryText) {
          const cat = stripAccents(`${p.category || ''} ${p.subcategory || ''}`)
          if (!cat.includes(stripAccents(categoryText))) return false
        }
        return true
      })
      if (filteredFuzzy.length > 0) {
        products = filteredFuzzy
        log.info('search_products fuzzy fallback found results (filtered)', {
          countRaw: fuzzyProducts.length,
          countFiltered: filteredFuzzy.length,
          query: searchText,
          topSim: fuzzyProducts[0]?.sim,
        })
      } else {
        log.info('search_products fuzzy fallback: results filtered out by price/category', {
          countRaw: fuzzyProducts.length,
          args,
          query: searchText,
        })
      }
    }
  }

  // Bug 8 — Filter cross-category DEPOIS do fuzzy
  if (expectedCategory && products && products.length > 0) {
    const filteredCat = filterProductsByExpectedCategory(products, expectedCategory)
    if (filteredCat.length === 0) {
      log.info('Bug 8 post-fuzzy filter: ALL results in wrong category -> empty', {
        expectedCategory: expectedCategory.id,
        droppedCount: products.length,
        droppedSample: products.slice(0, 2).map((p: any) => ({ title: p.title, category: p.category })),
        query: searchText,
      })
      products = []
    } else if (filteredCat.length < products.length) {
      log.info('Bug 8 post-fuzzy filter: dropped cross-category subset', {
        expectedCategory: expectedCategory.id,
        before: products.length,
        after: filteredCat.length,
      })
      products = filteredCat
    }
  }

  if (!products || products.length === 0) {
    return handleZeroResults({
      ctx,
      log,
      searchText,
      brandNotFound,
    })
  }

  // Products found — reset qualification retry counter
  if ((conversation.tags || []).some((t: string) => t.startsWith('search_fail:'))) {
    await supabase
      .from('conversations')
      .update({ tags: mergeTags(conversation.tags || [], { search_fail: '0' }) })
      .eq('id', conversation_id)
  }

  // #25: Auto-extract category tag from found products (interesse:CATEGORY)
  // Bug 8 fix: NUNCA sobrescreve interesse: ja existente.
  const firstCategory = products[0]?.category
  const existingInteresseTag = (conversation.tags || []).find((t: string) =>
    t.startsWith('interesse:'),
  )
  if (firstCategory && !existingInteresseTag) {
    const catTag = firstCategory.toLowerCase().replace(/\s+/g, '_')
    const autoTags: Record<string, string> = { interesse: catTag }
    if (searchText) autoTags.produto = searchText.toLowerCase().replace(/\s+/g, '_')
    await supabase
      .from('conversations')
      .update({ tags: mergeTags(conversation.tags || [], autoTags) })
      .eq('id', conversation_id)
    log.info('Auto-tagged from search results', {
      interesse: catTag,
      produto: autoTags.produto,
    })
  } else if (firstCategory && existingInteresseTag) {
    if (searchText) {
      await supabase
        .from('conversations')
        .update({
          tags: mergeTags(conversation.tags || [], {
            produto: searchText.toLowerCase().replace(/\s+/g, '_'),
          }),
        })
        .eq('id', conversation_id)
    }
    log.info('Auto-tag interesse: skipped (already set)', {
      existing: existingInteresseTag,
      productCategory: firstCategory,
    })
  }

  // Auto-send media/carousel when products have images
  const withImages = products.filter((p: any) => p.images?.[0])
  let mediaSent = false
  if (mediaState.carouselSent) {
    log.info('Skipping auto-media — already sent in this call')
    mediaSent = true
  }

  if (withImages.length === 1 && (withImages[0].images as string[])?.length >= 2) {
    // Single product with multiple photos → carousel multi-foto
    const p = withImages[0]
    const photos = (p.images as string[]).slice(0, 5)
    const copies = await generateCarouselCopies(p, photos.length)
    const btn1Text = agent.carousel_button_1 || 'Eu quero!'
    const btn2Text = agent.carousel_button_2 || ''
    const carousel = photos.map((img: string, idx: number) => ({
      text:
        copies[idx] ||
        `${cleanProductTitle(p.title)}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}`,
      image: img,
      buttons: [
        { id: safeBtnId(`${p.title}_${idx}`), text: btn1Text, type: 'REPLY' },
        ...(btn2Text
          ? [{ id: safeBtnId(`info_${p.title}_${idx}`), text: btn2Text, type: 'REPLY' }]
          : []),
      ],
    }))
    log.info('Auto-carousel: single product multi-photo', {
      title: p.title,
      photoCount: photos.length,
    })

    const carouselMsg = agent.carousel_text || 'Confira nossas opções:'
    const rawNum1 = contact.jid.split('@')[0]
    const carouselPayloads = [
      { phone: contact.jid, message: carouselMsg, carousel },
      { number: contact.jid, text: carouselMsg, carousel },
      { phone: rawNum1, message: carouselMsg, carousel },
      { number: rawNum1, text: carouselMsg, carousel },
    ]
    for (const payload of carouselPayloads) {
      try {
        const res = await fetchWithTimeout(
          `${uazapiUrl}/send/carousel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: instance.token },
            body: JSON.stringify(payload),
          },
          10000,
        )
        const resBody = await res.text()
        log.info('Auto-carousel attempt', {
          variant: Object.keys(payload)[0],
          status: res.status,
          body: resBody.substring(0, 120),
        })
        if (res.ok && !resBody.toLowerCase().includes('missing')) {
          mediaSent = true
          mediaState.carouselSent = true
          break
        }
      } catch (err) {
        log.error?.('Carousel attempt failed', { error: (err as Error).message })
      }
    }
    if (mediaSent) {
      const carouselMediaUrl1 = JSON.stringify({
        message: agent.carousel_text || 'Confira:',
        cards: carousel,
      })
      await supabase.from('conversation_messages').insert({
        conversation_id,
        direction: 'outgoing',
        content: agent.carousel_text || 'Confira:',
        media_type: 'carousel',
        media_url: carouselMediaUrl1,
        external_id: `ai_carousel_${Date.now()}`,
      })
      broadcastEvent({
        conversation_id,
        inbox_id: conversation.inbox_id,
        direction: 'outgoing',
        content: agent.carousel_text || 'Confira:',
        media_type: 'carousel',
        media_url: carouselMediaUrl1,
      })
    } else {
      // #10: Carousel failed → fallback to individual photos
      log.warn('Auto-carousel (multi-photo) all variants failed — sending individual photos')
      for (const img of photos.slice(0, 3)) {
        try {
          const fbRes = await fetchWithTimeout(
            `${uazapiUrl}/send/media`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: instance.token },
              body: JSON.stringify({
                number: contact.jid,
                type: 'image',
                file: img,
                text: cleanProductTitle(p.title),
              }),
            },
            10000,
          )
          if (fbRes.ok) {
            mediaSent = true
            log.info('Fallback photo sent')
          }
        } catch {
          /* continue */
        }
      }
      if (mediaSent) {
        await supabase.from('conversation_messages').insert({
          conversation_id,
          direction: 'outgoing',
          content: cleanProductTitle(p.title),
          media_type: 'image',
          media_url: photos[0],
          external_id: `ai_fallback_${Date.now()}`,
        })
        broadcastEvent({
          conversation_id,
          inbox_id: conversation.inbox_id,
          direction: 'outgoing',
          content: cleanProductTitle(p.title),
          media_type: 'image',
          media_url: photos[0],
        })
      }
    }
  } else if (withImages.length === 1) {
    // Single product 1 photo → send/media
    const p = withImages[0]
    const title = cleanProductTitle(p.title)
    const price = `R$ ${p.price?.toFixed(2) || 'Sob consulta'}`
    const caption = `${title}\n${price}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`
    try {
      const res = await fetchWithTimeout(
        `${uazapiUrl}/send/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: instance.token },
          body: JSON.stringify({
            number: contact.jid,
            type: 'image',
            file: p.images[0],
            text: caption,
          }),
        },
        10000,
      )
      if (res.ok) {
        mediaSent = true
        mediaState.carouselSent = true
        log.info('Auto-media: single product single photo', { title: p.title })
        await supabase.from('conversation_messages').insert({
          conversation_id,
          direction: 'outgoing',
          content: caption,
          media_type: 'image',
          media_url: p.images[0],
          external_id: `ai_media_${Date.now()}`,
        })
        broadcastEvent({
          conversation_id,
          inbox_id: conversation.inbox_id,
          direction: 'outgoing',
          content: caption,
          media_type: 'image',
          media_url: p.images[0],
        })
      } else {
        const body = await res.text()
        log.error?.('Auto-media send failed', { status: res.status, body: body.substring(0, 120) })
      }
    } catch (err) {
      log.error?.('Auto-media send failed', { error: (err as Error).message })
    }
  } else if (withImages.length > 1) {
    // Multiple products → carousel
    const mpBtn1 = agent.carousel_button_1 || 'Eu quero!'
    const mpBtn2 = agent.carousel_button_2 || ''
    const carousel = withImages.slice(0, 10).map((p: any) => ({
      text: `${cleanProductTitle(p.title)}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`,
      image: p.images[0],
      buttons: [
        { id: safeBtnId(p.title), text: mpBtn1, type: 'REPLY' },
        ...(mpBtn2 ? [{ id: safeBtnId(`info_${p.title}`), text: mpBtn2, type: 'REPLY' }] : []),
      ],
    }))

    const mpMsg = agent.carousel_text || 'Confira nossas opções:'
    const rawNum2 = contact.jid.split('@')[0]
    const carouselPayloads = [
      { phone: contact.jid, message: mpMsg, carousel },
      { number: contact.jid, text: mpMsg, carousel },
      { phone: rawNum2, message: mpMsg, carousel },
      { number: rawNum2, text: mpMsg, carousel },
    ]
    for (const payload of carouselPayloads) {
      try {
        const res = await fetchWithTimeout(
          `${uazapiUrl}/send/carousel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: instance.token },
            body: JSON.stringify(payload),
          },
          10000,
        )
        const resBody = await res.text()
        log.info('Auto-carousel attempt', {
          productCount: withImages.length,
          variant: Object.keys(payload)[0],
          status: res.status,
          body: resBody.substring(0, 120),
        })
        if (res.ok && !resBody.toLowerCase().includes('missing')) {
          mediaSent = true
          mediaState.carouselSent = true
          break
        }
      } catch (err) {
        log.error?.('Carousel attempt failed', { error: (err as Error).message })
      }
    }
    if (!mediaSent) {
      // #10: Carousel failed → fallback to individual photos (max 3)
      log.warn('Auto-carousel (multi-product) all variants failed — sending individual photos', {
        productCount: withImages.length,
      })
      for (const p of withImages.slice(0, 3)) {
        try {
          const caption = `${cleanProductTitle(p.title)}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}`
          const fbRes = await fetchWithTimeout(
            `${uazapiUrl}/send/media`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: instance.token },
              body: JSON.stringify({
                number: contact.jid,
                type: 'image',
                file: p.images[0],
                text: caption,
              }),
            },
            10000,
          )
          if (fbRes.ok) {
            mediaSent = true
            log.info('Fallback photo sent', { title: p.title })
          }
        } catch {
          /* continue */
        }
      }
      if (mediaSent) {
        await supabase.from('conversation_messages').insert({
          conversation_id,
          direction: 'outgoing',
          content: `${withImages
            .slice(0, 3)
            .map((p: any) => cleanProductTitle(p.title))
            .join(', ')}`,
          media_type: 'image',
          media_url: withImages[0].images[0],
          external_id: `ai_fallback_${Date.now()}`,
        })
        broadcastEvent({
          conversation_id,
          inbox_id: conversation.inbox_id,
          direction: 'outgoing',
          content: 'Fotos dos produtos',
          media_type: 'image',
        })
      }
    } else {
      const carouselMediaUrl2 = JSON.stringify({
        message: agent.carousel_text || 'Confira:',
        cards: carousel,
      })
      await supabase.from('conversation_messages').insert({
        conversation_id,
        direction: 'outgoing',
        content: agent.carousel_text || 'Confira:',
        media_type: 'carousel',
        media_url: carouselMediaUrl2,
        external_id: `ai_carousel_${Date.now()}`,
      })
      broadcastEvent({
        conversation_id,
        inbox_id: conversation.inbox_id,
        direction: 'outgoing',
        content: agent.carousel_text || 'Confira:',
        media_type: 'carousel',
        media_url: carouselMediaUrl2,
      })
    }
  }

  const resultText = products
    .map(
      (p: any, i: number) =>
        `${i + 1}. ${p.title} - R$${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (SEM ESTOQUE)' : ''}`,
    )
    .join('\n')

  if (mediaSent) {
    const mediaType =
      withImages.length === 1 && (withImages[0].images as string[])?.length < 2 ? 'foto' : 'carrossel'
    const productNames = withImages.slice(0, 3).map((p: any) => cleanProductTitle(p.title)).join(', ')
    const productCount = withImages.length
    const firstProduct = withImages[0]
    const hasMultiple = productCount > 1

    return `${mediaType === 'foto' ? 'Foto' : 'Carrossel'} com ${productCount} produto(s) JÁ FOI ENVIADO ao lead: ${productNames}.

DADOS DOS PRODUTOS (use para responder perguntas do lead):
${resultText}

INSTRUÇÕES PARA SUA RESPOSTA (NÍVEL 2 — QUALIFICAÇÃO CONTÍNUA):
- O ${mediaType} já foi enviado. NÃO use send_carousel nem send_media novamente.
- OBRIGATÓRIO: SEMPRE inclua o preço (R$XX,XX) do produto na sua PRIMEIRA resposta após o ${mediaType}. O lead quer saber o preço — informe proativamente.
- Se o lead perguntar preço de um produto específico, RESPONDA com o valor EXATO da lista acima.
- NÃO pergunte "qual produto busca?" ou "em que posso ajudar?" — o lead JÁ DISSE o que quer.
- NÃO pergunte "alguma te interessa?" de forma genérica.

SEU OBJETIVO: informar o preço + destacar um benefício + fazer 1 pergunta para fechar a venda.

${
  hasMultiple
    ? `MÚLTIPLOS PRODUTOS (${productCount}): Destaque um diferencial do produto principal e pergunte qual atende melhor.
Exemplo: "A linha Dialine é super versátil e tem ótimo rendimento! Qual dessas opções combina mais com seu projeto?"`
    : `PRODUTO ÚNICO: Destaque um benefício real do produto e faça pergunta de qualificação para fechar.
Produto: ${firstProduct.title} - R$${firstProduct.price?.toFixed(2) || 'sob consulta'}
${firstProduct.description ? `Descrição: ${firstProduct.description.substring(0, 100)}` : ''}

Exemplos de qualificação contínua (use o que fizer sentido):
- Cor: "Essa tinta tem excelente cobertura! Qual a cor de sua preferência?"
- Quantidade: "Rendimento de até 80m² por galão! Quantos m² você precisa pintar?"
- Fechamento: "A Dialine Branco Neve é top pra externo! Posso separar pra você?"
NÃO invente benefícios — use apenas dados do produto acima.`
}

REGRA: se o lead confirmar ("quero", "pode separar", "esse mesmo") → handoff_to_human imediatamente.`
  }
  return resultText
}

// =============================================================================
// Zero-results handler — R120 outside_hours / PATH A enrich / PATH B handoff / PATH C retry
// =============================================================================

async function handleZeroResults(opts: {
  ctx: SearchProductsCtx
  log: Logger
  searchText: string
  brandNotFound: string | null
}): Promise<string> {
  const { ctx, log, searchText, brandNotFound } = opts
  const { supabase, agent, conversation, conversation_id, contact, leadName, buildQualificationChain } = ctx

  const maxRetries = (agent.max_qualification_retries as number) ?? 2
  const maxEnrichment = (agent.max_enrichment_questions as number) ?? 2
  const searchFailTag = (conversation.tags || []).find((t: string) => t.startsWith('search_fail:'))
  const searchFailCount = searchFailTag ? parseInt(searchFailTag.split(':')[1]) || 0 : 0
  const enrichTag = (conversation.tags || []).find((t: string) => t.startsWith('enrich_count:'))
  const enrichCount = enrichTag ? parseInt(enrichTag.split(':')[1]) || 0 : 0

  const queryWords = searchText
    ? searchText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
    : []
  const hasInteresseTag = (conversation.tags || []).some((t: string) => t.startsWith('interesse:'))
  const interesseFromTags = extractInteresseFromTags(conversation.tags || [])
  const v2ConfigForWellQual = getCategoriesOrDefault(agent)
  const detectedCategoryForWellQual = matchCategory(interesseFromTags, v2ConfigForWellQual)
  const isWellQualified =
    queryWords.length >= 3 ||
    (hasInteresseTag && queryWords.length >= 1) ||
    detectedCategoryForWellQual !== null

  const failTags: Record<string, string> = {}
  if (brandNotFound) {
    failTags.marca_indisponivel = brandNotFound.toLowerCase().replace(/\s+/g, '_')
  }
  if (searchText && queryWords.length >= 2) {
    failTags.produto = searchText.toLowerCase().replace(/\s+/g, '_')
  }
  const categoryKeywords: Record<string, string> = {
    tinta: 'tintas',
    verniz: 'seladores_e_vernizes',
    manta: 'impermeabilizantes',
    impermeabilizante: 'impermeabilizantes',
    selador: 'seladores_e_vernizes',
    esmalte: 'tintas',
    acrilica: 'tintas',
    acrilico: 'tintas',
  }
  if (searchText) {
    const queryLower = searchText.toLowerCase()
    for (const [kw, cat] of Object.entries(categoryKeywords)) {
      if (queryLower.includes(kw)) {
        failTags.interesse = cat
        break
      }
    }
  }

  // === R120: outside_hours short-circuit ===
  const outsideHoursSF = isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)
  if (outsideHoursSF) {
    failTags.search_fail = String(searchFailCount + 1)
    failTags.marca_indisponivel_outside_hours = '1'
    await supabase
      .from('conversations')
      .update({ tags: mergeTags(conversation.tags || [], failTags) })
      .eq('id', conversation_id)
    log.info('search_products: 0 results + outside_hours → handoff imediato', { searchText })
    return `[INTERNO — NÃO mostre isso ao lead] Busca "${searchText}" sem resultados E estamos FORA DO HORÁRIO COMERCIAL. AÇÃO: chame handoff_to_human AGORA com motivo="${searchText || 'consulta'}_fora_hora". PROIBIDO: enrichment, perguntas de qualificação, "não trabalhamos". A mensagem outside_hours configurada será enviada automaticamente pelo helper pickHandoffMessage.`
  }

  // === PATH A: Well-qualified + enrichment NOT complete → ask enrichment ===
  if (isWellQualified && maxEnrichment > 0 && enrichCount < maxEnrichment) {
    const newEnrichCount = enrichCount + 1
    failTags.enrich_count = String(newEnrichCount)
    failTags.search_fail = String(searchFailCount + 1)

    await supabase
      .from('conversations')
      .update({ tags: mergeTags(conversation.tags || [], failTags) })
      .eq('id', conversation_id)

    const chainParts: string[] = []
    for (const t of conversation.tags || []) {
      if (t.startsWith('interesse:')) chainParts.push(t.split(':')[1])
      if (t.startsWith('produto:')) chainParts.push(t.split(':')[1].replace(/_/g, ' '))
    }
    const chainStr = chainParts.length > 0 ? ` Qualificação até agora: ${chainParts.join(' > ')}.` : ''
    const instructions = buildEnrichmentInstructions(
      conversation.tags || [],
      newEnrichCount,
      maxEnrichment,
      brandNotFound,
      agent,
      searchText,
    )

    log.info('search_products: enrichment phase', {
      query: searchText,
      enrichStep: newEnrichCount,
      maxEnrichment,
      brandNotFound,
    })

    return `[INTERNO — NÃO mostre isso ao lead] Busca "${searchText}" sem resultados. FASE DE ENRIQUECIMENTO (pergunta ${newEnrichCount}/${maxEnrichment}).${chainStr} ${instructions}`
  }

  // === PATH B: Well-qualified + enrichment COMPLETE → handoff with full chain ===
  if (isWellQualified && enrichCount >= maxEnrichment) {
    failTags.qualificacao_completa = 'true'
    failTags.search_fail = String(searchFailCount + 1)

    await supabase
      .from('conversations')
      .update({ tags: mergeTags(conversation.tags || [], failTags) })
      .eq('id', conversation_id)

    const qualChain = buildQualificationChain(
      mergeTags(conversation.tags || [], failTags),
      {},
      leadName || contact?.name || null,
    )

    log.info('search_products: enrichment complete → handoff', {
      query: searchText,
      qualificationChain: qualChain,
    })

    return `[INTERNO — NÃO mostre isso ao lead] Enriquecimento COMPLETO. Cadeia de qualificação: ${qualChain}. AÇÃO: chame handoff_to_human AGORA com motivo="${qualChain}". Diga algo como "Vou te conectar com nosso consultor que pode te ajudar a encontrar exatamente o que você precisa!" PROIBIDO: dizer "não encontrei", "não temos", "não trabalhamos".`
  }

  // === PATH C: NOT well-qualified → existing search_fail retry logic ===
  const newCount = brandNotFound
    ? Math.max(searchFailCount + 1, maxRetries - 1)
    : searchFailCount + 1
  failTags.search_fail = String(newCount)

  await supabase
    .from('conversations')
    .update({ tags: mergeTags(conversation.tags || [], failTags) })
    .eq('id', conversation_id)

  log.info('search_products: no results (not well qualified)', {
    query: searchText,
    attempt: newCount,
    max: maxRetries,
    brandNotFound,
  })

  if (newCount >= maxRetries) {
    return `[INTERNO — NÃO mostre isso ao lead] Busca "${searchText}" sem resultados após ${newCount} tentativas.${brandNotFound ? ` Termo "${brandNotFound}" não encontrado no catálogo.` : ''} AÇÃO: chame handoff_to_human AGORA com motivo="${searchText}". Diga algo como "Vou te conectar com nosso consultor que pode te ajudar a encontrar exatamente o que você precisa!" PROIBIDO: dizer "não encontrei", "não temos", "não trabalhamos".`
  }

  const brandHint = brandNotFound
    ? ` O termo "${brandNotFound}" não foi encontrado no catálogo. Pergunte se o lead aceita uma opção diferente. Se o lead RECUSAR, chame handoff_to_human. PROIBIDO: dizer "não trabalhamos com", "não temos".`
    : ' AÇÃO: faça UMA pergunta para refinar — cor, acabamento, marca alternativa ou tamanho.'

  return `[INTERNO — NÃO mostre isso ao lead] Busca "${searchText}" retornou 0 produtos (tentativa ${newCount}/${maxRetries}).${brandHint} PROIBIDO: dizer "não encontrei", "não temos", "não trabalhamos". O lead NUNCA deve saber que a busca falhou.`
}

// =============================================================================
// API pública — dispatcher
// =============================================================================

/**
 * Despacha `name === 'search_products'` pro handler. Retorna null se name não é
 * search_products (caller continua com o próximo handler no switch original).
 */
export async function dispatchSearchTool(
  name: string,
  args: Record<string, any>,
  ctx: SearchProductsCtx,
  log: Logger,
): Promise<string | null> {
  if (name !== 'search_products') return null
  return searchProducts(args, ctx, log)
}
