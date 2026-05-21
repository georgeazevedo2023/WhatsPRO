// Guard determinístico para `search_products` no ai-agent.
//
// R126 (2026-05-20): LLM em input ambíguo "chuta" — ex: lead disse "quero
// info sobre um material" e o LLM chamou `search_products({query: "material"})`.
// Sem expectedCategory derivável, ILIKE `%material%` retorna QUALQUER produto
// que tenha a palavra na descrição. Para o agente Eletropiso v2 (1 único produto
// digital: Telha PVC) virou cross-categoria absoluta — lead pediu porta/janela
// alumínio e recebeu carrossel de telha.
//
// Duas regras:
//  1. RECUSA query genérica sem expectedCategory ('material', 'produto', 'item',
//     'coisa', 'preço', 'valor') — devolve ao LLM instrução pra qualificar a
//     categoria antes de buscar.
//  2. BLOQUEIA busca quando expectedCategory tem `catalog_status='offline'` —
//     mesma rota que o auto-extract já segue (qualif + handoff), só que agora
//     enforçada também no caminho LLM-driven.

export type CatalogStatus = 'digital' | 'offline' | 'none' | undefined

export interface SearchGuardInput {
  /** Query enviada pelo LLM (`args.query` do tool call). */
  query: string | null | undefined
  /** Categoria esperada já derivada (args.category → tag interesse: → searchText). null se nenhuma fonte cassou. */
  expectedCategoryId: string | null
  /** catalog_status da expectedCategory ('digital'|'offline'|'none'). undefined se categoria sem o atributo (default = digital). */
  expectedCategoryStatus: CatalogStatus
}

export type SearchGuardVerdict =
  | { allowed: true; reason: 'specific_query' | 'category_digital' | 'no_query' }
  | { allowed: false; reason: 'generic_query_without_category'; message: string }
  | { allowed: false; reason: 'category_offline'; message: string; categoryId: string }

/**
 * Palavras-âncora que indicam query semanticamente vazia. Não confundir com
 * marcas/produtos reais (ex: "material elétrico" é menos genérico mas ainda
 * cai aqui — intencional: forçar LLM a especificar categoria via qualificação).
 *
 * Normalizado: sem acento, lowercase. Match exato (não substring) para evitar
 * falso positivo com "materialteto" ou nomes compostos.
 */
const GENERIC_QUERY_TOKENS: ReadonlySet<string> = new Set([
  'material',
  'materiais',
  'produto',
  'produtos',
  'item',
  'itens',
  'coisa',
  'coisas',
  'algo',
  'opcao',
  'opcoes',
  'preco',
  'precos',
  'valor',
  'valores',
])

function stripAccentsLower(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Decide se o tool call `search_products` deve ser permitido.
 *
 * Ordem das regras:
 *  1. Query vazia/whitespace → permite (handler tratará como broad listing).
 *  2. expectedCategoryStatus === 'offline' → recusa (categoria sem catálogo digital).
 *  3. Query normalizada bate token genérico E expectedCategoryId é null → recusa.
 *  4. Qualquer outro caso → permite.
 */
export function evaluateSearchGuard(input: SearchGuardInput): SearchGuardVerdict {
  const rawQuery = (input.query ?? '').trim()
  if (!rawQuery) {
    return { allowed: true, reason: 'no_query' }
  }

  if (input.expectedCategoryStatus === 'offline' && input.expectedCategoryId) {
    return {
      allowed: false,
      reason: 'category_offline',
      categoryId: input.expectedCategoryId,
      message:
        `[INTERNO — não mostre ao lead] Categoria "${input.expectedCategoryId}" está marcada como ` +
        `catalog_status=offline (vendemos mas sem catálogo digital). NÃO chame search_products. ` +
        `Qualifique os fields restantes da categoria e faça handoff_to_human com o contexto rico. ` +
        `NUNCA diga "não temos" ou "fora de estoque" — apenas qualifique e transfira.`,
    }
  }

  const normalized = stripAccentsLower(rawQuery)
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const isAllGeneric = tokens.length > 0 && tokens.every((t) => GENERIC_QUERY_TOKENS.has(t))

  if (isAllGeneric && !input.expectedCategoryId) {
    return {
      allowed: false,
      reason: 'generic_query_without_category',
      message:
        `[INTERNO — não mostre ao lead] Query "${rawQuery}" é semanticamente vazia e nenhuma ` +
        `categoria foi identificada (sem args.category, sem tag interesse:, sem match no texto). ` +
        `Pergunte ao lead QUAL produto/categoria específica antes de buscar — sem isso a busca ` +
        `vira loteria cross-categoria. Ex: "Sobre qual produto especificamente? (tinta, ` +
        `revestimento, porta, etc.)"`,
    }
  }

  return { allowed: true, reason: input.expectedCategoryId ? 'category_digital' : 'specific_query' }
}

// detectIncomingSearchSignal — Sprint B auditoria 2026-05-21.
//
// Substitui 2 das 23 regras de `hardcodedRules` em ai-agent/index.ts (pré-Sprint B):
//   - R121: pergunta direta "tem X?", "vendem X?", "trabalham com X?" → search_products imediato
//   - brand→search: lead menciona marca conhecida → search_products imediato com brand na query
//
// Roda no caminho INCOMING (msg do lead), antes do LLM decidir tool calls. Quando
// devolve force=true, o orquestrador chama search_products determinístico com a
// query sugerida — eliminando alucinação de "vou enviar o carrossel" sem chamar
// a tool de fato.

export interface IncomingSearchSignal {
  /** Texto da última msg do lead (já agregada / normalizada). */
  text: string
  /** Marcas conhecidas pelo agente (de agent.brands ou DEFAULT_BRANDS). Lowercase comparison. */
  knownBrands: string[]
}

export interface IncomingSearchVerdict {
  force: boolean
  /** Query sugerida pra search_products quando force=true. */
  query: string | null
  reason:
    | 'r121_direct_question'
    | 'brand_mentioned'
    | 'no_signal'
}

const R121_PATTERNS: ReadonlyArray<RegExp> = [
  // "vc tem X?", "vocês vendem X?", "trabalham com X?", "fazem X?", "possui X?"
  /\b(?:voce|vc|vcs|voces)?\s*(?:tem|vendem|vende|trabalham\s+com|trabalha\s+com|fazem|faze|faz|possui|possuem)\s+(.{2,80}?)\s*\??\s*$/,
  // "tem X disponivel"
  /\b(?:tem|tem\s+a|tem\s+o)\s+(.{2,80}?)\s+disponivel\b/,
  // "preciso de X", "estou procurando X", "quero X", "gostaria de X"
  /\b(?:preciso\s+de|estou\s+procurando|procuro|quero|queria|gostaria\s+de|estou\s+atras\s+de)\s+(.{2,80}?)\s*\??\s*$/,
]

function cleanCapture(raw: string): string {
  return raw
    .replace(/^(?:um|uma|uns|umas|o|a|os|as|da|de|do|dos|das)\s+/i, '')
    .replace(/[?.!,;]+$/g, '')
    .replace(/\s+ai$/i, '')
    .trim()
}

export function detectIncomingSearchSignal(input: IncomingSearchSignal): IncomingSearchVerdict {
  const rawText = (input.text ?? '').trim()
  if (!rawText) {
    return { force: false, query: null, reason: 'no_signal' }
  }

  const normalized = stripAccentsLower(rawText)

  // 1. R121 tem prioridade — "tem coral?" vai como direct_question com query="coral"
  for (const pattern of R121_PATTERNS) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const query = cleanCapture(match[1])
      if (query.length >= 2) {
        return { force: true, query, reason: 'r121_direct_question' }
      }
    }
  }

  // 2. Marca mencionada como palavra inteira
  const brands = (input.knownBrands ?? [])
    .map((b) => stripAccentsLower(b))
    .filter((b) => b.length >= 2)

  for (const brand of brands) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const brandRegex = new RegExp(`\\b${escaped}\\b`)
    if (brandRegex.test(normalized)) {
      // Mantém o texto original limpo na query (sem acento, lowercase) — search_products
      // já aplica fuzzy. Concatena brand garantindo que aparece primeiro.
      const rest = normalized.replace(brandRegex, '').replace(/\s+/g, ' ').trim()
      const query = rest ? `${brand} ${rest}` : brand
      return { force: true, query, reason: 'brand_mentioned' }
    }
  }

  return { force: false, query: null, reason: 'no_signal' }
}
