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
