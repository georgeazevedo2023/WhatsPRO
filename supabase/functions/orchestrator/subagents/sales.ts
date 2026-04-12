// =============================================================================
// Sales Subagent (S8)
// Busca catálogo, envia carousel/media, track products_shown, follow-up LLM.
//
// Pipeline de busca (mesmo padrão do ai-agent):
//   ILIKE → word-by-word AND → fuzzy (search_products_fuzzy RPC) → post-filter
//
// Regras obrigatórias:
//   - 1 produto + 1 foto → send/media
//   - 1 produto + 2+ fotos → send/carousel (multi-photo)
//   - 2+ produtos → send/carousel (multi-product, max 10 cards)
//   - broadcastEvent() após todo INSERT de media/carousel
//   - products_shown[] no step_data — não repetir
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import { generateCarouselCopies, cleanProductTitle } from '../../_shared/carousel.ts'
import { callLLM } from '../../_shared/llmProvider.ts'
import type {
  SubagentResult,
  SubagentInput,
  SalesConfig,
  CarouselCardPayload,
} from '../types.ts'

const supabase = createServiceClient()

// ── Tipos internos ──────────────────────────────────────────────────────────

interface Product {
  id: string
  title: string
  category: string | null
  subcategory: string | null
  description: string | null
  price: number | null
  images: string[] | null
  in_stock: boolean
  sim?: number  // fuzzy similarity score
}

// ── Handler principal ───────────────────────────────────────────────────────

export async function salesSubagent(
  input: SubagentInput<SalesConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { flow_state, agent_config } = context
  const messageText = context.input.message_text ?? ''
  const stepData = flow_state.step_data

  const agentId = agent_config?.agent_id
  if (!agentId) {
    console.error('[sales] agent_id not found — cannot search products')
    return { status: 'error', error: 'agent_id_not_found' }
  }

  const maxProducts = config.max_products_per_search ?? 5
  const maxSearchFails = config.max_search_failures ?? 3
  const autoTag = config.auto_tag_interest !== false
  const enableLLM = config.enable_follow_up_llm !== false

  // Track de produtos já mostrados nesta sessão
  const productsShown: string[] = (stepData.products_shown as string[]) ?? []
  const searchFailCount = (stepData.search_fail_count as number) ?? 0

  // ── Check exit rules: max_messages ──────────────────────────────────────
  const msgCount = (stepData.message_count ?? 0) + 1
  for (const rule of context.exit_rules) {
    if (rule.trigger === 'max_messages' && typeof rule.value === 'number' && msgCount >= rule.value) {
      return {
        status: rule.action === 'next_step' ? 'advance' : 'handoff',
        response_text: rule.message ?? undefined,
        exit_rule_triggered: rule,
        step_data_patch: { last_subagent: 'sales' },
      }
    }
  }

  // ── Detecta se é follow-up sobre produto mostrado (não nova busca) ─────
  const isFollowUp = productsShown.length > 0 && isFollowUpMessage(messageText)

  if (isFollowUp && enableLLM) {
    return await handleFollowUp(context, productsShown, agentId, messageText)
  }

  // ── Busca de produtos ──────────────────────────────────────────────────
  const searchText = messageText.trim()
  if (!searchText) {
    return {
      status: 'continue',
      step_data_patch: { last_subagent: 'sales' },
    }
  }

  const products = await searchProducts(agentId, searchText, maxProducts, productsShown)

  // Nenhum produto encontrado
  if (products.length === 0) {
    const newFailCount = searchFailCount + 1
    const tags: string[] = [`search_fail:${newFailCount}`]

    // Check exit rule: search_fail >= max
    if (newFailCount >= maxSearchFails) {
      const failRule = context.exit_rules.find(r => r.trigger === 'search_fail')
      return {
        status: 'handoff',
        response_text: failRule?.message ?? 'Vou transferir para um atendente que pode ajudar melhor.',
        exit_rule_triggered: failRule ?? { trigger: 'search_fail', action: 'handoff_human' },
        step_data_patch: { last_subagent: 'sales', search_fail_count: newFailCount },
        tags_to_set: tags,
      }
    }

    return {
      status: 'continue',
      response_text: 'Não encontrei esse produto no momento. Poderia descrever de outra forma?',
      step_data_patch: { last_subagent: 'sales', search_fail_count: newFailCount },
      tags_to_set: tags,
    }
  }

  // ── Monta media result ─────────────────────────────────────────────────
  const newProductIds = products.map(p => p.id)
  const allShown = [...productsShown, ...newProductIds]

  // Tags de interesse
  const tags: string[] = []
  if (autoTag && products[0].category) {
    tags.push(`interesse:${products[0].category.toLowerCase()}`)
  }
  if (autoTag) {
    tags.push(`produto:${searchText.substring(0, 50)}`)
  }

  // Botões do carousel
  const btn1Text = config.carousel_button_1 ?? agent_config?.carousel_button_1 ?? 'Eu quero!'
  const btn2Text = config.carousel_button_2 ?? agent_config?.carousel_button_2

  if (products.length === 1) {
    const p = products[0]
    const images = (p.images ?? []).filter(Boolean)
    const priceText = p.price ? `R$ ${p.price.toFixed(2)}` : 'Sob consulta'
    const stockText = p.in_stock === false ? ' (sob encomenda)' : ''

    if (images.length >= 2) {
      // 1 produto + 2+ fotos → carousel multi-foto
      const photos = images.slice(0, 5)
      const copies = await generateCarouselCopies(p, photos.length)
      const cards: CarouselCardPayload[] = photos.map((img, i) => ({
        body: copies[i] ?? `${cleanProductTitle(p.title)}\n${priceText}`,
        imageUrl: img,
        buttons: [{ type: 'url', displayText: btn1Text }],
      }))

      return {
        status: 'continue',
        media: { type: 'carousel', caption: `${cleanProductTitle(p.title)} - ${priceText}${stockText}`, cards },
        step_data_patch: { last_subagent: 'sales', products_shown: allShown, search_fail_count: 0 },
        tags_to_set: tags.length ? tags : undefined,
      }
    } else if (images.length === 1) {
      // 1 produto + 1 foto → send/media
      const caption = `${cleanProductTitle(p.title)}\n${priceText}${stockText}`
      return {
        status: 'continue',
        media: { type: 'image', url: images[0], caption },
        step_data_patch: { last_subagent: 'sales', products_shown: allShown, search_fail_count: 0 },
        tags_to_set: tags.length ? tags : undefined,
      }
    } else {
      // 1 produto sem foto → texto
      return {
        status: 'continue',
        response_text: `${cleanProductTitle(p.title)} — ${priceText}${stockText}${p.description ? '\n' + p.description.substring(0, 200) : ''}`,
        step_data_patch: { last_subagent: 'sales', products_shown: allShown, search_fail_count: 0 },
        tags_to_set: tags.length ? tags : undefined,
      }
    }
  }

  // 2+ produtos → carousel multi-produto (max 10 cards)
  const carouselProducts = products.slice(0, 10).filter(p => (p.images ?? []).length > 0)

  if (carouselProducts.length > 0) {
    const cards: CarouselCardPayload[] = carouselProducts.map(p => {
      const priceText = p.price ? `R$ ${p.price.toFixed(2)}` : 'Sob consulta'
      const stockText = p.in_stock === false ? ' (sob encomenda)' : ''
      return {
        body: `${cleanProductTitle(p.title)}\n${priceText}${stockText}`,
        imageUrl: (p.images ?? [])[0],
        buttons: [
          { type: 'url', displayText: btn1Text },
          ...(btn2Text ? [{ type: 'url', displayText: btn2Text }] : []),
        ],
      }
    })

    return {
      status: 'continue',
      media: { type: 'carousel', caption: `Encontrei ${products.length} opções:`, cards },
      step_data_patch: { last_subagent: 'sales', products_shown: allShown, search_fail_count: 0 },
      tags_to_set: tags.length ? tags : undefined,
    }
  }

  // Produtos sem imagem → texto
  const textList = products.slice(0, 5).map(p => {
    const priceText = p.price ? `R$ ${p.price.toFixed(2)}` : 'Sob consulta'
    return `• ${cleanProductTitle(p.title)} — ${priceText}`
  }).join('\n')

  return {
    status: 'continue',
    response_text: `Encontrei ${products.length} opções:\n\n${textList}`,
    step_data_patch: { last_subagent: 'sales', products_shown: allShown, search_fail_count: 0 },
    tags_to_set: tags.length ? tags : undefined,
  }
}

// ── Busca de produtos (3 camadas) ────────────────────────────────────────────

async function searchProducts(
  agentId: string,
  searchText: string,
  limit: number,
  alreadyShown: string[],
): Promise<Product[]> {
  const safeTerm = escapeLike(searchText)

  // Camada 1: ILIKE exato
  const { data: ilike } = await supabase
    .from('ai_agent_products')
    .select('id, title, category, subcategory, description, price, images, in_stock')
    .eq('agent_id', agentId)
    .eq('enabled', true)
    .or(`title.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%,subcategory.ilike.%${safeTerm}%`)
    .limit(limit)

  let results: Product[] = (ilike ?? []) as Product[]

  // Camada 2: word-by-word AND (se ILIKE retornou vazio e query tem múltiplas palavras)
  if (results.length === 0) {
    const words = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (words.length >= 2) {
      const { data: broad } = await supabase
        .from('ai_agent_products')
        .select('id, title, category, subcategory, description, price, images, in_stock')
        .eq('agent_id', agentId)
        .eq('enabled', true)
        .limit(50)

      if (broad?.length) {
        results = (broad as Product[]).filter(p => {
          const haystack = `${p.title} ${p.category ?? ''} ${p.subcategory ?? ''} ${p.description ?? ''}`.toLowerCase()
          return words.every(w => haystack.includes(w))
        }).slice(0, limit)
      }
    }
  }

  // Camada 3: fuzzy via pg_trgm RPC
  if (results.length === 0) {
    const { data: fuzzy } = await supabase.rpc('search_products_fuzzy', {
      _agent_id: agentId,
      _query: searchText,
      _threshold: 0.3,
      _limit: limit,
    })
    results = (fuzzy ?? []) as Product[]
  }

  // Post-filter: remove produtos já mostrados nesta sessão
  if (alreadyShown.length > 0) {
    const shownSet = new Set(alreadyShown)
    results = results.filter(p => !shownSet.has(p.id))
  }

  return results
}

// ── Follow-up LLM (responde sobre produtos já mostrados) ────────────────────

async function handleFollowUp(
  context: import('../types.ts').FlowContext,
  productsShown: string[],
  agentId: string,
  messageText: string,
): Promise<SubagentResult> {
  // Carrega os últimos 5 produtos mostrados para dar contexto ao LLM
  const { data: products } = await supabase
    .from('ai_agent_products')
    .select('title, price, description, category')
    .eq('agent_id', agentId)
    .in('id', productsShown.slice(-5))

  const productContext = (products ?? []).map(p => {
    const price = p.price ? `R$ ${(p.price as number).toFixed(2)}` : 'Sob consulta'
    return `- ${p.title}: ${price}. ${(p.description ?? '').substring(0, 100)}`
  }).join('\n')

  const personality = context.agent_config?.personality ?? 'amigável e prestativo'
  const maxDiscount = context.agent_config?.max_discount_percent ?? 0

  try {
    const llmResult = await callLLM({
      systemPrompt: [
        `Você é um assistente de vendas ${personality}.`,
        `Produtos já mostrados ao cliente:\n${productContext}`,
        maxDiscount > 0 ? `Desconto máximo permitido: ${maxDiscount}%` : 'Sem desconto disponível.',
        'Responda em português BR, máx 300 chars. Seja direto e útil.',
        'NUNCA invente preços ou produtos. Só use dados acima.',
        'Se não souber, diga "vou verificar" e NÃO invente.',
      ].join('\n'),
      messages: [{ role: 'user', content: messageText }],
      tools: [],
      temperature: 0.5,
      maxTokens: 200,
    })

    return {
      status: 'continue',
      response_text: llmResult.text || undefined,
      step_data_patch: { last_subagent: 'sales' },
    }
  } catch (err) {
    console.error('[sales] follow-up LLM error:', err)
    return {
      status: 'continue',
      response_text: 'Vou verificar essa informação. Um momento!',
      step_data_patch: { last_subagent: 'sales' },
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isFollowUpMessage(text: string): boolean {
  const lower = text.toLowerCase().trim()
  const followUpPatterns = [
    /^quanto/,           // "quanto custa", "quanto é"
    /^qual o (pre[cç]o|valor)/,
    /^tem (desconto|promo)/,
    /^esse|^essa|^este|^esta/,
    /^quero/,            // "quero esse"
    /^pode (fazer|dar)/,
    /^aceita/,
    /^parcel/,           // "parcela em quantas vezes?"
    /^frete/,
    /^entrega/,
    /^estoque/,
    /^disponivel|^disponível/,
  ]
  return followUpPatterns.some(p => p.test(lower))
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}
