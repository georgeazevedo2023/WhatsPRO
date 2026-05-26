/**
 * Sprint C4 (2026-05-23) — product_specialist
 *
 * Primeiro specialist do orquestrador. Roda quando router classifica intent='produto'.
 *
 * Pipeline:
 *   1. Monta prompt enxuto (~3 KB): persona + task + rules + tools strict + catálogo + facts
 *   2. Filtra toolDefs pra apenas as 5 tools de produto (strict mode)
 *   3. Delega pra `runLlmCallLoop` (compartilhado com monolith) — função-calling com retry/backoff/handoff guard
 *   4. Delega pra `dispatchResponse` (compartilhado) — envia msg + insert + broadcast + lead_profile + Response 200
 *   5. Insere row em `ai_agent_runs` com specialist='product', hop_n=1, intent='produto'
 *
 * Reusa 100% da infra extraída em Sprint B5. O ganho real é o PROMPT — sai de 45 KB
 * (monolito) pra ~3 KB compacto focado em produto.
 *
 * Tools permitidas (strict): search_products, send_carousel, send_media,
 * set_tags, update_lead_profile.
 *
 * NUNCA chama handoff_to_human diretamente — escala via router/monolith se necessário.
 */

import { runSpecialist, type SpecialistCtx, type SpecialistDef } from './specialistBase.ts'
import { updateLeadProfileToolDef, setCartToolDef } from './specialistTools.ts'
import { cleanSearchQuery } from './tools/searchProducts.ts'
import { getCategoriesOrDefault, matchCategory, matchCategoryBySearchText } from '../serviceCategories.ts'
import type { LLMToolDef } from '../llmProvider.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

/** @deprecated use SpecialistCtx — mantido só pra compat de assinatura no index.ts */
export interface ProductSpecialistCtx extends SpecialistCtx {
  /** Modelo do specialist (default: gpt-4.1 — bench Sprint C). Override p/ debug. */
  specialistModel?: string
}

export interface ProductSpecialistResult {
  /** Response 200 pronta pro caller propagar. NULL em shadow mode. */
  response: Response | null
  /** Inputs/outputs reais (debug/dashboard C7) */
  inputTokens: number
  outputTokens: number
  promptChars: number
  /**
   * Bug 4 fix (2026-05-23 v7.43.2): quando LLM loop falha 3× (errorResponse 502),
   * propaga aqui pro caller decidir se faz fallback pro monolith (recomendado)
   * ou retorna 502 ao webhook. NULL = sucesso.
   */
  errorResponse: Response | null
  /** Mensagem de erro do LLM (debug) quando errorResponse não é null */
  errorMessage?: string
}

// =============================================================================
// Prompt builder — compacto (~3 KB target)
// =============================================================================

/**
 * Monta system prompt do product_specialist. Alvo: <3.5 KB ao final.
 *
 * Componentes:
 *   - persona + task
 *   - 7 rules essenciais (search_products primeiro, categoria offline = handoff, etc.)
 *   - tools list nominal
 *   - catalog summary: lista compacta de categorias com flag digital/offline
 *   - facts collected: tags humanizadas (ambiente, cor, voltagem, etc.)
 */
export function buildProductSpecialistPrompt(args: {
  agentName: string
  serviceCategories: any[]
  collectedTags: string[]
  businessInfo?: any
}): string {
  const { agentName, serviceCategories, collectedTags, businessInfo } = args

  const categorySummary = (serviceCategories || [])
    .slice(0, 30)
    .map((c: any) => {
      const status = c.catalog_status === 'offline' ? ' [OFFLINE]' : c.catalog_status === 'none' ? ' [SEM CAT]' : ''
      return `- ${c.id || c.name || 'unknown'}${status}`
    })
    .join('\n') || '(sem categorias configuradas)'

  // Tags humanizadas: tira tags internas (ia:*, lead_score:*, multi_interesse_pending) e formata por tipo
  const internalKeys = new Set(['ia', 'lead_score', 'multi_interesse_pending', 'qualif_horizontal', 'search_fail', 'ia_cleared'])
  const factsCollected = (collectedTags || [])
    .filter((t) => {
      const [key] = t.split(':')
      return !internalKeys.has(key)
    })
    .slice(0, 20)
    .join(', ') || '(nenhum fato coletado ainda)'

  const businessLine = businessInfo
    ? typeof businessInfo === 'string'
      ? businessInfo.substring(0, 300)
      : JSON.stringify(businessInfo).substring(0, 300)
    : '(não cadastrado)'

  // Prompt v5 (v7.43.11) — bench 50/50 (v3) + refinamento de upsell/pedido completo.
  // v7.43.8: removido priorToolsCalled (era remendo). Fix de raiz: R121 inline
  // desabilitado quando routing_mode=router. Specialist é único caminho de search.
  // v7.43.11 (Bug 9 UX): regra 3 (offline) refinada — qualifica brevemente + pergunta
  // "mais algum item?" ANTES de encaminhar. Nova regra 8: monte PEDIDO COMPLETO antes
  // do handoff (não escale item a item — junte tudo num pedido só pro vendedor).
  return `Você é ${agentName || 'consultor de vendas'}, especialista em produto. Atende leads via WhatsApp em português brasileiro.

OBJETIVO: ajudar o lead a montar um PEDIDO COMPLETO (um ou vários itens) e só então passar pro vendedor com tudo detalhado. Texto curto e direto (1-2 frases, tom WhatsApp).

REGRA UNIVERSAL: toda chamada de tool vem acompanhada de uma frase de texto pro lead no MESMO turno. NUNCA chame tool sem texto. NUNCA repita a mesma tool 2 vezes em turnos consecutivos.

FLUXO POR SITUAÇÃO:

1. Marca específica do catálogo mencionada → chame search_products com a marca + "Vou ver as opções..."

2. Pergunta vaga sem marca em categoria ONLINE → chame search_products com categoria + "Vou buscar pra você..."

3. Categoria [OFFLINE] no catálogo → NÃO busque. Antes de escalar, COLETE info útil pro vendedor: faça 1 pergunta de qualificação rápida do item (tamanho/tipo/modelo/material conforme o item — ex.: trena "de quantos metros?", fechadura "interna ou externa?"). Registre com set_tags. NÃO encaminhe ainda — siga pra regra 8.

4. Marca FORA do catálogo → NÃO busque. set_tags(["interesse:CATEGORIA"]) + "Não trabalhamos com [marca]. Temos [marcas do catálogo] com qualidade equivalente. Qual prefere?"

5. Lead pediu múltiplos produtos → search_products do PRIMEIRO + "Encontrei essas opções de [primeiro]. Depois te mostro [segundo]."

6. Search retornou produtos (carrossel JÁ ENVIADO) → próximo turno: APENAS texto convidando a clicar "Eu quero!". NÃO chame tool.

6b. MAIS OPÇÕES / lead REJEITOU o lote ("nenhuma dessas", "tem outras?", "quero ver mais", "não gostei", "ainda em dúvida") → chame search_products de NOVO com a MESMA categoria/termo + "Claro! Vou te mostrar mais algumas opções 😊". O sistema EXCLUI automaticamente os produtos já mostrados e envia um lote NOVO — você não precisa lembrar quais já mostrou. Se o resultado disser "[INTERNO] já mostrou todas", NÃO invente: diga que essas eram todas as opções da linha e ofereça refinar (cor/tipo/marca), ver outra categoria, ou falar com um consultor.

7. Search 0 resultados → APENAS texto oferecendo alternativa. NÃO repita o search.

8. MONTAR O PEDIDO: lead confirma o que quer ("quero/adiciona/inclui {item}", qtd) → set_cart com o pedido COMPLETO atual (TODOS os itens; name/qty + product_id/unit_price se souber). set_cart SUBSTITUI o pedido (idempotente): adicionar=incluir na lista, mudar qtd=ajustar número, remover=omitir, cancelar=vazia — sempre mande a lista inteira, nunca só o delta. Item já decidido vai direto no set_cart (sem search_products). Confirme e pergunte "mais algum item ou já passo pro vendedor?". Mantenha aberto até concluir.

9. FECHAMENTO: lead confirmou ("é só isso", "pode finalizar") OU pediu vendedor → handoff_to_human. O resumo itemizado (itens+qtd+total) é anexado AUTOMÁTICO ao transbordo; no reason ponha só as qualificações/observações pro vendedor. Escreva 1 frase curta confirmando ao lead.

9b. CROSS-SELL (opcional, 1x no fechamento): se houver complemento ÓBVIO do catálogo (tinta→rolo/fita; impermeabilizante→trincha), ofereça UM item sem insistir e SEM inventar. Aceitou → set_cart com o item incluído.

10. OBJEÇÃO DE PREÇO ("achei caro", "tá caro", "no concorrente é mais barato") → NÃO responda com pergunta de qualificação. Primeiro EMPATIA breve + defenda o VALOR do item cotado (qualidade, durabilidade, garantia, cobertura/rendimento). Se fizer sentido, lembre as formas de pagamento. NUNCA ofereça desconto por conta própria. Mantenha o pedido aberto e pergunte se quer seguir.

REGRA DE CONTEXTO: leia o histórico. Se o lead JÁ escolheu produto(s), novos itens são ADIÇÕES ao mesmo pedido — trate como upsell, mantenha o pedido aberto até o lead dizer que terminou.

NUNCA diga "não temos" sem oferecer alternativa.
NUNCA encaminhe pro vendedor item a item — junte tudo num pedido só. handoff_to_human só quando lead confirmar pedido completo OU pedir explicitamente vendedor.

CATÁLOGO:
${categorySummary}

FATOS JÁ COLETADOS: ${factsCollected}

NEGÓCIO: ${businessLine}`
}

// =============================================================================
// Tool definitions — strict mode (5 tools apenas)
// =============================================================================

export function getProductSpecialistToolDefs(): LLMToolDef[] {
  return [
    {
      name: 'search_products',
      description: 'Busca produtos no catálogo do agente. Use SEMPRE primeiro antes de descrever produto.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca (marca, tipo, palavras-chave)' },
          category: { type: ['string', 'null'], description: 'Categoria esperada (id da service_categories)' },
        },
        required: ['query', 'category'],
      },
    },
    {
      name: 'send_carousel',
      description: 'Envia 2+ produtos como carrossel com fotos e botões.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          product_ids: { type: 'array', items: { type: 'string' }, description: 'Lista de títulos exatos (max 10)' },
        },
        required: ['product_ids'],
      },
    },
    {
      name: 'send_media',
      description: 'Envia 1 produto como foto+legenda.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          media_url: { type: 'string', description: 'URL da imagem do produto' },
          caption: { type: 'string', description: 'Legenda com nome + preço + descrição curta' },
        },
        required: ['media_url', 'caption'],
      },
    },
    {
      // Bug 4 real fix (v7.43.3): schema alinhado com monolith (index.ts:1741).
      // Antes usava map object com `additionalProperties: { type: 'string' }`, que
      // viola OpenAI strict mode (precisa ser `false`) E divergia do handler real
      // (que espera string[] formato "chave:valor", não map). Causava OpenAI 400 →
      // fallback Gemini → Gemini 400 → errorResponse 502 (observado prod 14:59 + 15:18).
      name: 'set_tags',
      description: 'Adiciona tags à conversa para rastrear interesses e fatos qualificados. Tags são cumulativas. Formato: "chave:valor" (ex: "interesse:tintas", "ambiente:interno", "cor:branco").',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            description: 'Tags no formato "chave:valor"',
            items: { type: 'string' },
          },
        },
        required: ['tags'],
      },
    },
    // Fix #3/P5 (2026-05-24): usa a tool COMPARTILHADA (specialistTools) em vez de
    // uma cópia inline desatualizada. A antiga só tinha name/objections/notes (sem
    // `city` e usando `name` em vez de `full_name`), então o product specialist nunca
    // conseguia salvar nome/cidade ditos junto com o produto. A compartilhada tem
    // full_name + city + interesses + reason + ticket — alinhada ao handler (crmTools).
    updateLeadProfileToolDef,
    // Premium #2 Cart Engine (2026-05-25): set_cart define o pedido completo
    // (substitui, idempotente — evita double-count); estado em
    // conversations.cart_items; resumo itemizado vai automaticamente pro reason
    // do handoff (setTagsAndHandoff).
    setCartToolDef,
    {
      // Bug 11 fix (v7.43.13): specialist é dono do fluxo de venda completo, incluindo
      // o fechamento. handoff_to_human escala pro vendedor humano com o pedido montado.
      // O executeToolSafe (index.ts) já processa esta tool (fila/departamento/fora-horário).
      // Antes era removida (escala via monolith) — mas isso gerava "Em que posso ajudar?"
      // genérico quando o lead confirmava o pedido. Agora o specialist fecha o ciclo.
      name: 'handoff_to_human',
      description: 'Encaminha o lead pro vendedor humano. Use quando: (1) lead confirmou que o pedido está completo, (2) lead pediu explicitamente um vendedor, ou (3) item sob consulta exige especialista. SEMPRE inclua no reason um resumo do pedido (todos os itens + qualificações).',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo + resumo completo do pedido (itens escolhidos, quantidades, qualificações coletadas)' },
        },
        required: ['reason'],
      },
    },
  ]
}

// =============================================================================
// API pública
// =============================================================================

/**
 * SpecialistDef do product_specialist. Sprint D: o pipeline (LLM loop → log →
 * dispatch) agora vive em specialistBase.runSpecialist. Aqui ficam só as 3 coisas
 * que distinguem este specialist: modelo, tools (strict) e o prompt builder.
 */
export function buildProductSpecialistDef(model: string): SpecialistDef {
  return {
    name: 'product',
    intent: 'produto',
    model,
    toolDefs: getProductSpecialistToolDefs(),
    buildPrompt: (ctx) =>
      buildProductSpecialistPrompt({
        agentName: (ctx.agent.name as string) || 'consultor',
        serviceCategories: ctx.serviceCategories,
        collectedTags: (ctx.conversation.tags as string[]) || [],
        businessInfo: ctx.agent.business_info,
      }),
    // Bug 12 (v7.43.13): specialist controla fechamento via prompt regra 9.
    // handoffGuard era proteção do monolith e bloqueava handoff multi-turn legítimo.
    disableHandoffGuard: true,
  }
}

/**
 * Latência (2026-05-24) — Pré-busca determinística do product specialist.
 *
 * PROBLEMA: turnos de produto com search_products gastavam 2 rounds de LLM
 * (round 1 só pra "decidir" chamar a tool, round 2 pra compor a resposta com o
 * resultado). Medido em prod: ~8-10s vs ~2.5s dos turnos sem busca. O monolith
 * era rápido porque buscava ANTES do LLM (R121/R137 inline) — mas isso foi
 * desligado sob router (skipR121) por causa de carrossel duplicado.
 *
 * FIX DE RAIZ: derivar a busca pré-LLM também pro product specialist. O caller
 * roda `runInlineSearchProducts` com este resultado, injeta o `[INTERNO]` como
 * `preSearchContext`, e o specialist compõe em 1 round. Duplo carrossel é
 * impossível: a flag carouselSentInThisCall (compartilhada via executeToolSafe)
 * faz o search_products retornar "JÁ FOI ENVIADO" se o LLM tentar de novo.
 *
 * Cobertura (mais ampla que pendingExitActionSearch, que exigia marca/verbo):
 *   - usa pendingExitActionSearch se o pré-LLM já decidiu (R121/R137/C2);
 *   - senão deriva categoria (interesse: tag → matchCategoryBySearchText) e só
 *     pré-busca se for catalog_status='digital' (offline → specialist qualifica,
 *     e nem é o caso lento, pois não há carrossel a enviar);
 *   - NUNCA pré-busca se o lead já recebeu produtos (produto:/aguardando_upsell)
 *     — evita re-enviar carrossel quando ele está refinando a escolha.
 *
 * @returns {query, category} pronto pro runInlineSearchProducts, ou null (sem
 *   pré-busca → specialist decide normalmente, comportamento anterior).
 */
/**
 * Limpa a query da pré-busca pro nível do que o LLM produziria. O texto cru do
 * lead ("bom dia! vocês têm tinta acrílica fosca?") tem saudação + verbo
 * interrogativo que viram RUÍDO no ILIKE/fuzzy → 0 resultados → escalada espúria
 * pra handoff. (Descoberto no E2E 2026-05-24: "vocês têm tinta acrílica fosca?"
 * com ruído achou 0 produtos e caiu em handoff fora-de-horário.) Mesma família do
 * stripLeadNameSuffix (R137/R138). Conservador: só remove no INÍCIO.
 */
export function cleanProductQuery(s: string): string {
  if (!s) return ''
  const stripped = s
    // saudação no início ("bom dia!", "olá,", "oi")
    .replace(/^\s*(?:oi+|ol[áa]+|e?\s*a[íi]|bom\s+dia|boa\s+tarde|boa\s+noite)[\s,!.]*/i, '')
    // verbo de produto no início — interrogativo ("vocês têm", "tem", "vendem",
    // "trabalham com") OU de desejo ("quero", "queria", "gostaria", "preciso",
    // "procuro"). + "ver" opcional ("quero ver") + artigo opcional ("quero A cuba").
    // 2026-05-26: a família de desejo faltava — "quero a cuba…" mantinha "quero" e
    // zerava a busca no AND-fallback (words.every).
    .replace(
      /^\s*(?:vcs?|voc[êe]s?)?\s*(?:tem|t[êe]m|vende[mn]?|fazem|trabalham?\s+com|tem\s+dispon[ií]ve(?:l|is)|quero|queria|quer|gostaria|gostav[ao]|preciso|precisa(?:va|ndo)?|procuro|procura(?:ndo|va)?|(?:me\s+)?manda(?:r)?|(?:me\s+)?mostra(?:r)?)(?:\s+ver)?\s+(?:(?:de|do|da|dos|das|um|uma|uns|umas|o|a|os|as)\s+)?/i,
      '',
    )
  return cleanSearchQuery(stripped)
}

export function deriveProductSearchParams(opts: {
  incomingText: string
  tags: string[]
  agent: Record<string, any>
  pendingSearch?: { query: string; category: string } | null
}): { query: string; category: string } | null {
  // 1. Pré-LLM já decidiu (marca/verbo/score-max) → confia, mas LIMPA a query
  //    (R121 buildSearchQuery cai pro texto cru quando não há tags ainda).
  if (opts.pendingSearch?.query) {
    const cleaned = cleanProductQuery(opts.pendingSearch.query)
    return { query: cleaned.length >= 2 ? cleaned : opts.pendingSearch.query, category: opts.pendingSearch.category }
  }

  const tags = Array.isArray(opts.tags) ? opts.tags : []

  // 2. Lead já recebeu produtos → não re-buscar (está escolhendo entre os enviados).
  const alreadyReceived = tags.some(
    (t) => typeof t === 'string' && (t.startsWith('produto:') || t === 'aguardando_upsell'),
  )
  if (alreadyReceived) return null

  // 3. Deriva categoria (interesse: tag tem prioridade; senão pelo texto).
  const cfg = getCategoriesOrDefault(opts.agent)
  const interesseTag = tags.find((t) => typeof t === 'string' && t.startsWith('interesse:'))
  const interesseValue = interesseTag ? interesseTag.split(':')[1] || '' : ''
  const category =
    matchCategory(interesseValue, cfg) || matchCategoryBySearchText(opts.incomingText || '', cfg)
  if (!category) return null

  // 4. Só pré-busca catálogo DIGITAL (offline → qualif, sem carrossel = já rápido).
  const catalogStatus = (category as any).catalog_status || 'digital'
  if (catalogStatus !== 'digital') return null

  // 5. Monta query: texto do lead LIMPO (sem saudação/verbo) + interesse. cleanProductQuery
  //    evita 0-resultados por ruído ("vocês têm"). Interesse vem depois como reforço.
  const cleanedIncoming = cleanProductQuery(opts.incomingText || '')
  const rawQuery = [interesseValue, cleanedIncoming].filter(Boolean).join(' ')
  const query = cleanSearchQuery(rawQuery) || cleanedIncoming
  if (!query || query.length < 2) return null

  return { query, category: interesseValue || (category as any).id || '' }
}

/**
 * Roda o pipeline do product_specialist. Wrapper fino sobre runSpecialist
 * (mantido pra compat de assinatura no index.ts).
 */
export async function runProductSpecialist(ctx: ProductSpecialistCtx): Promise<ProductSpecialistResult> {
  // Modelo gpt-4.1 (full, non-reasoning) escolhido em bench Sprint C (v7.43.6):
  // 10/10 técnico + 10/10 redação WhatsApp, lat 2.1s. Override via ctx.specialistModel.
  const def = buildProductSpecialistDef(ctx.specialistModel || 'gpt-4.1')
  const result = await runSpecialist(ctx, def)
  return {
    response: result.response,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    promptChars: result.promptChars,
    errorResponse: result.errorResponse,
    errorMessage: result.errorMessage,
  }
}
