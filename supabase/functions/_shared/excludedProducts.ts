/**
 * Excluded Products Matcher (Opção A — D28, 2026-04-30)
 *
 * Quando lead pergunta sobre produto que a tenant NÃO vende,
 * a IA responde com mensagem polida + sugestões de alternativas,
 * SEM fazer handoff e SEM contar a mensagem no counter (evita
 * auto-handoff por message limit).
 *
 * Schema (ai_agents.excluded_products JSONB):
 *   [
 *     {
 *       "id": "caixa_correio",
 *       "keywords": ["caixa de correio", "correio"],
 *       "message": "Não trabalhamos com caixa de correio. Posso te ajudar com cofres ou fechaduras?",
 *       "suggested_categories": ["fechaduras"]  // opcional, só pra UI
 *     }
 *   ]
 */

export interface ExcludedProduct {
  id: string
  keywords: string[]
  message?: string  // opcional — se vazio, usa fallback "Não trabalhamos com {matched_keyword}, posso te ajudar com outro produto?"
  suggested_categories?: string[]
  /**
   * Exceções ("palavras que liberam o produto", D-mangueira 2026-06-25).
   * Se o texto do lead contém UMA destas palavras (whole-word, accent-insensitive,
   * MESMA normalização das keywords), a exclusão deste item é SUPRIMIDA e a mensagem
   * segue pro fluxo normal (router → qualificar → transbordar), NUNCA recusa.
   *
   * Resolve o falso-positivo de keyword multi-palavra usada como MODIFICADOR:
   * "máquina de lavar" exclui o ELETRODOMÉSTICO, mas except_keywords ["mangueira","engate"]
   * libera "mangueira de saída de água da máquina de lavar" (acessório hidráulico que vendemos).
   *
   * Supressão é a nível de ITEM: se qualquer except_keyword aparece no texto, o item inteiro
   * é pulado naquele turno (mesmo que o texto também cite um aparelho cru). Trade-off aceito —
   * o pior caso é qualificar+transbordar em vez de recusar (nunca dizer não). Ausente/vazio =
   * comportamento idêntico ao anterior (100% backward-compatible).
   */
  except_keywords?: string[]
}

export interface ExcludedProductMatch {
  product: ExcludedProduct
  matchedKeyword: string  // a keyword EXATA que casou (pra usar no fallback)
  message: string         // resolved — message do admin OU fallback gerado
}

/**
 * Gera frase de fallback quando admin deixou message vazio.
 *
 * R112 (rev 2026-05-07): EXCEÇÃO documentada da regra de ouro do AI Agent.
 * A regra "NUNCA dizer 'não trabalhamos com'" vale pro LLM (que não deve inventar
 * essa frase quando search falha). Mas para `excluded_products`, fluxo é separado
 * (vai direto via sendTextMsg, nunca passa pelo prompt), e admin CONFIGUROU
 * intencionalmente que não vendemos esse item — então é honesto e profissional.
 *
 * Template: "Infelizmente não trabalhamos com {keyword}, mas temos {alternatives}.
 *            Posso te ajudar em algo mais? 😊"
 *
 * `alternatives` vem de `item.suggested_categories` (admin preenche). Se vazio,
 * usa fallback genérico "outros materiais relacionados".
 */
export function buildFallbackMessage(
  matchedKeyword: string,
  _businessName?: string,
  suggestedCategories?: string[],
): string {
  const validCats = (suggestedCategories || [])
    .map(c => (c || '').trim())
    .filter(c => c.length > 0)

  let alternatives: string
  if (validCats.length === 0) {
    alternatives = 'outros materiais relacionados'
  } else if (validCats.length === 1) {
    alternatives = validCats[0]
  } else if (validCats.length === 2) {
    alternatives = `${validCats[0]} e ${validCats[1]}`
  } else {
    alternatives = `${validCats.slice(0, -1).join(', ')} e ${validCats[validCats.length - 1]}`
  }

  // (2026-05-28) Tom mais natural: evita "Infelizmente não trabalhamos com" que soa
  // formal-robô. "Esse não é o nosso forte aqui" é o jeito que um vendedor real falaria.
  return `Esse não é o nosso forte aqui, mas trabalhamos com ${alternatives}. Quer dar uma olhada em algo nessa linha?`
}

/**
 * Normaliza texto para matching: lowercase + remove acentos + colapsa espaços.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Teste whole-word (boundary) em texto JÁ normalizado.
 * Mesma semântica usada para keywords E except_keywords: normalize() a frase,
 * escapa specials de regex, casa com \b...\b (case-insensitive).
 * Frase vazia → false (não casa). Reuso, não duplicação — garante que a exceção
 * tem EXATAMENTE a mesma semântica de match das keywords.
 */
function containsWholeWord(normalizedText: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase)
  if (!normalizedPhrase) return false
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  return re.test(normalizedText)
}

/**
 * Retorna match com a keyword exata que casou + message resolvida.
 * Match é por palavra-inteira (boundary): "correio" não casa com "correios" — usa regex \b.
 * Se item.message vazio/ausente, usa fallback "Não trabalhamos com {kw}, posso te ajudar...".
 * Retorna null se nenhum casar.
 */
export function matchExcludedProduct(
  incomingText: string,
  excludedProducts: ExcludedProduct[] | null | undefined,
  businessName?: string,
): ExcludedProductMatch | null {
  if (!excludedProducts || excludedProducts.length === 0) return null
  if (!incomingText || incomingText.trim().length === 0) return null

  const normalizedText = normalize(incomingText)

  for (const item of excludedProducts) {
    if (!item.keywords || item.keywords.length === 0) continue

    // except_keywords ("palavras que liberam o produto"): se o lead citou um acessório
    // que VENDEMOS (ex.: "mangueira" da máquina de lavar), suprime a exclusão deste item
    // inteiro → a mensagem segue pro fluxo normal (qualificar→transbordar), nunca recusa.
    // Ausente/vazio = comportamento idêntico ao anterior.
    if (
      item.except_keywords &&
      item.except_keywords.length > 0 &&
      item.except_keywords.some((ek) => containsWholeWord(normalizedText, ek))
    ) {
      continue
    }

    for (const kw of item.keywords) {
      // Word boundary match (whole-word, accent-insensitive) — ver containsWholeWord
      if (containsWholeWord(normalizedText, kw)) {
        const trimmedAdminMsg = (item.message || '').trim()
        const message = trimmedAdminMsg !== ''
          ? trimmedAdminMsg
          : buildFallbackMessage(kw, businessName, item.suggested_categories)  // R112: fallback dinâmico com alternativas
        return {
          product: item,
          matchedKeyword: kw,
          message,
        }
      }
    }
  }

  return null
}

/**
 * Validação básica do schema. Retorna lista de erros (vazio = válido).
 */
export function validateExcludedProducts(items: unknown): string[] {
  const errors: string[] = []
  if (!Array.isArray(items)) return ['excluded_products deve ser array']

  const seen = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as ExcludedProduct
    if (!it || typeof it !== 'object') {
      errors.push(`item ${i}: deve ser objeto`)
      continue
    }
    if (!it.id || typeof it.id !== 'string') {
      errors.push(`item ${i}: id obrigatório (string)`)
    } else if (seen.has(it.id)) {
      errors.push(`item ${i}: id "${it.id}" duplicado`)
    } else {
      seen.add(it.id)
    }
    if (!Array.isArray(it.keywords) || it.keywords.length === 0) {
      errors.push(`item ${i}: keywords obrigatório (array com pelo menos 1)`)
    } else if (it.keywords.some((k) => typeof k !== 'string' || k.trim() === '')) {
      errors.push(`item ${i}: keywords devem ser strings não-vazias`)
    }
    // message é opcional — se ausente/vazio, runtime usa fallback
    if (it.message !== undefined && typeof it.message !== 'string') {
      errors.push(`item ${i}: message deve ser string (ou omitido)`)
    }
    if (it.suggested_categories !== undefined && !Array.isArray(it.suggested_categories)) {
      errors.push(`item ${i}: suggested_categories deve ser array (ou omitido)`)
    }
    // except_keywords é opcional — se presente, deve ser array de strings não-vazias
    if (it.except_keywords !== undefined) {
      if (!Array.isArray(it.except_keywords)) {
        errors.push(`item ${i}: except_keywords deve ser array (ou omitido)`)
      } else if (it.except_keywords.some((k) => typeof k !== 'string' || k.trim() === '')) {
        errors.push(`item ${i}: except_keywords devem ser strings não-vazias`)
      }
    }
  }
  return errors
}
