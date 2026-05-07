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

  return `Infelizmente não trabalhamos com ${matchedKeyword}, mas temos ${alternatives}. Posso te ajudar em algo mais? 😊`
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

    for (const kw of item.keywords) {
      const normalizedKw = normalize(kw)
      if (!normalizedKw) continue

      // Word boundary match — escape regex special chars
      const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      if (re.test(normalizedText)) {
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
  }
  return errors
}
