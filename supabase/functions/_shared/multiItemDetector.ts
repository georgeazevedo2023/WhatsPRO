/**
 * Multi-Item Detector — R136 (2026-05-21)
 *
 * Detecta quando o lead manda uma LISTA de produtos numa única mensagem
 * (ex: "1 massa PVA / 1 tinta branca / 15 lixas"). Classifica cada item contra
 * as categorias cadastradas do agente, retornando quem casou (matched) e quem
 * ficou órfão (sem categoria).
 *
 * Bug-trigger: caso Paloma (2026-05-21). Lead mandou 3 itens em UMA msg, só
 * "tinta" tinha categoria cadastrada — sistema afunilou em mono-categoria e
 * ignorou os outros 2. Fluxo correto pós-R136: detectar lista mista, disparar
 * qualificação HORIZONTAL (uma pergunta abrangente cobrindo os 3) e handoff
 * com motivo rico preservando a lista.
 *
 * Heurística em 3 níveis:
 *   1. numbered_list  — 2+ linhas começando com prefixo numérico "1 X / 2 Y"
 *   2. comma_separated — 3+ vírgulas (ou ponto-vírgulas) splittando substrings
 *      curtas-mas-significativas
 *   3. newline_separated — 3+ quebras de linha (sem prefixo numérico nem saudação)
 *
 * NÃO mexer em ai-agent/index.ts aqui — wire vem na Wave 2 (B1.5-c).
 */

// =============================================================================
// Tipos públicos
// =============================================================================

export interface MultiItemDetectorInput {
  /** Texto da última msg do lead (agregação multi-linha já feita upstream). */
  text: string
  /** Config das categorias do agente (`agent.service_categories` ou DEFAULT_SERVICE_CATEGORIES). */
  categoriesConfig: any
}

export interface MultiItemDetectedItem {
  /** Texto bruto do item, ex: "1 massa PVA". */
  raw: string
  /** Quantidade extraída do prefixo numérico, ex: 1, 15. null se não der pra inferir. */
  quantity: number | null
  /** Categoria casada (id) se algum keyword da regex bater. null se não casou. */
  matchedCategoryId: string | null
  /** Label legível da categoria casada (ou texto bruto sem qtde se não casou). */
  productHint: string
}

export type MultiItemReason = 'numbered_list' | 'comma_separated' | 'newline_separated'

export interface MultiItemDetectorResult {
  detected: boolean
  items: MultiItemDetectedItem[]
  /** true se há mistura: ≥1 item com categoria + ≥1 sem categoria. */
  mixed: boolean
  /** Quantos items NÃO casaram categoria cadastrada. */
  orphanCount: number
  /** Como foi detectado (pra debug + logs). */
  reason: MultiItemReason | null
}

// =============================================================================
// Helpers privados
// =============================================================================

const GREETING_PREFIX_RE = /^(oi+|ola|olá|bom dia|boa tarde|boa noite|e ai|eai|hello|hi)\b/i

/** Normaliza texto: lowercase + sem acento. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Tenta extrair quantidade do início do item. Se casar, devolve { qty, rest }
 * com o texto sem o prefixo. Senão devolve { qty: null, rest: raw.trim() }.
 */
function splitQuantity(raw: string): { quantity: number | null; rest: string } {
  const m = raw.match(/^\s*(\d+)\s+(.+)$/)
  if (!m) return { quantity: null, rest: raw.trim() }
  const qty = Number.parseInt(m[1], 10)
  return {
    quantity: Number.isFinite(qty) ? qty : null,
    rest: m[2].trim(),
  }
}

/**
 * Classifica um item bruto contra categories[].interesse_match.
 * Primeira categoria com regex match vence. Sem match = orphan.
 */
function classifyItem(raw: string, categoriesConfig: any): MultiItemDetectedItem {
  const { quantity, rest } = splitQuantity(raw)
  const normalized = normalize(rest)

  let matchedCategoryId: string | null = null
  let matchedLabel: string | null = null

  const categories = Array.isArray(categoriesConfig?.categories)
    ? categoriesConfig.categories
    : []

  for (const cat of categories) {
    if (!cat || typeof cat.id !== 'string' || typeof cat.interesse_match !== 'string') continue
    let re: RegExp
    try {
      re = new RegExp(cat.interesse_match, 'i')
    } catch {
      continue
    }
    if (re.test(normalized)) {
      matchedCategoryId = cat.id
      matchedLabel = typeof cat.label === 'string' ? cat.label : cat.id
      break
    }
  }

  return {
    raw: raw.trim(),
    quantity,
    matchedCategoryId,
    productHint: matchedLabel ?? rest,
  }
}

// =============================================================================
// Detecção — 3 níveis de heurística
// =============================================================================

/** Nível 1: numbered_list. Retorna array de "raw" strings se casar. */
function tryNumberedList(text: string): string[] | null {
  const matches: string[] = []
  // Regex multi-line: linha começa com 1+ dígitos seguido de espaço seguido de 2-80 chars
  const re = /^\s*(\d+)\s+(.{2,80})$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    matches.push(`${m[1]} ${m[2]}`.trim())
  }
  return matches.length >= 2 ? matches : null
}

/** Nível 2: comma_separated. 3+ vírgulas OU 3+ ponto-vírgulas. */
function tryCommaSeparated(text: string): string[] | null {
  const trimmed = text.trim()
  // Conta separadores
  const commaCount = (trimmed.match(/,/g) || []).length
  const semiCount = (trimmed.match(/;/g) || []).length

  let parts: string[] | null = null
  if (semiCount >= 3) {
    parts = trimmed.split(';').map(s => s.trim()).filter(Boolean)
  } else if (commaCount >= 3) {
    parts = trimmed.split(',').map(s => s.trim()).filter(Boolean)
  }

  if (!parts || parts.length < 3) return null

  // Cada parte 3-50 chars, contendo pelo menos uma palavra (≥3 chars alfa)
  for (const p of parts) {
    if (p.length < 3 || p.length > 50) return null
    if (!/[a-zA-ZÀ-ÿ]{3,}/.test(p)) return null
  }

  return parts
}

/** Nível 3: newline_separated. 3+ quebras, sem saudação, sem prefixo numérico. */
function tryNewlineSeparated(text: string): string[] | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 3) return null

  for (const l of lines) {
    if (l.length < 3 || l.length > 60) return null
    if (GREETING_PREFIX_RE.test(l)) return null
  }
  return lines
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Detecta lista multi-item na msg do lead e classifica cada item contra as
 * categorias cadastradas. Retorna detected=false se for msg comum (1 item,
 * saudação, vazio, etc).
 *
 * Caso de uso (R136 Paloma):
 *   detectMultiItem({
 *     text: "1 massa PVA\n1 Latão de tinta branco neve\n15 lixas",
 *     categoriesConfig: eletropisoConfig,
 *   })
 *   -> detected=true, items=3, mixed=true, orphanCount=2, reason='numbered_list'
 *      [tintas matched (1), 2 órfãos: massa PVA + lixas]
 */
export function detectMultiItem(
  input: MultiItemDetectorInput,
): MultiItemDetectorResult {
  const empty: MultiItemDetectorResult = {
    detected: false,
    items: [],
    mixed: false,
    orphanCount: 0,
    reason: null,
  }

  if (!input || typeof input.text !== 'string') return empty
  const text = input.text
  if (!text.trim()) return empty

  let rawItems: string[] | null = null
  let reason: MultiItemReason | null = null

  // Nível 1
  rawItems = tryNumberedList(text)
  if (rawItems) reason = 'numbered_list'

  // Nível 2
  if (!rawItems) {
    rawItems = tryCommaSeparated(text)
    if (rawItems) reason = 'comma_separated'
  }

  // Nível 3
  if (!rawItems) {
    rawItems = tryNewlineSeparated(text)
    if (rawItems) reason = 'newline_separated'
  }

  if (!rawItems || rawItems.length < 2) return empty

  const items = rawItems.map(r => classifyItem(r, input.categoriesConfig))
  const orphans = items.filter(it => it.matchedCategoryId === null)
  const matched = items.filter(it => it.matchedCategoryId !== null)

  return {
    detected: true,
    items,
    mixed: matched.length >= 1 && orphans.length >= 1,
    orphanCount: orphans.length,
    reason,
  }
}
