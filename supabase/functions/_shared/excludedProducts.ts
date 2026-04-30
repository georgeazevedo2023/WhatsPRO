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
  message: string
  suggested_categories?: string[]
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
 * Retorna o primeiro `ExcludedProduct` cuja keyword aparece no texto do lead.
 * Match é por palavra-inteira (boundary): "correio" não casa com "correios" — usa regex \b.
 * Retorna null se nenhum casar.
 */
export function matchExcludedProduct(
  incomingText: string,
  excludedProducts: ExcludedProduct[] | null | undefined,
): ExcludedProduct | null {
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
        return item
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
    if (!it.message || typeof it.message !== 'string' || it.message.trim() === '') {
      errors.push(`item ${i}: message obrigatório`)
    }
    if (it.suggested_categories !== undefined && !Array.isArray(it.suggested_categories)) {
      errors.push(`item ${i}: suggested_categories deve ser array (ou omitido)`)
    }
  }
  return errors
}
