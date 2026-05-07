/**
 * Detect objection type from lead message text using deterministic regex patterns.
 *
 * Used in the AI Agent handoff trigger flow to attach `objecao:TIPO` tags
 * synchronously — so the human seller picking up a handoff sees the reason
 * in the right panel immediately, instead of waiting for the async shadow
 * extraction (extract_shadow_data) which runs after handoff completes.
 *
 * Returns null when no pattern matches. Caller should still let the LLM-driven
 * shadow analysis run for richer dimensions (motivo_perda, sentimento, etc).
 */
export type ObjectionType =
  | 'preco'
  | 'prazo'
  | 'frete'
  | 'concorrencia'
  | 'indecisao'
  | 'qualidade'

// NOTE on \b and non-ASCII: JavaScript's \b is ASCII-only, so it does NOT match
// the boundary before/after chars like é, ç, á. Use (?:^|\W) and (?=\W|$)
// instead for cross-char boundaries, or omit \b near non-ASCII letters.
//
// NOTE on order: the first matching type wins. Frete must be checked BEFORE
// preco (since "frete caro" would otherwise be tagged as preco).
const OBJECTION_PATTERNS: Record<ObjectionType, RegExp[]> = {
  frete: [
    /\bfrete\s+(t(á|a)\s+)?(muito\s+)?(caro|alto|salgado)/,
    /\bentrega\s+(muito\s+)?(cara|caro|salgada)/,
    /\bvalor\s+do\s+frete/,
  ],
  preco: [
    /(?:^|\W)(muito\s+)?caro(?=\W|$)/,
    /(?:^|\W)(preço|preco|valor).{0,20}(alto|salgado|elevado|caro)/,
    /\bachei\s+(muito\s+)?caro/,
    /\bt(á|a)\s+(muito\s+)?caro/,
    /\bficou\s+(muito\s+)?(caro|alto)/,
    /\bn(ã|a)o\s+tenho\s+(como|condi(ç|c)(õ|o)es|grana|dinheiro)\s+(pagar|comprar)/,
    /\b(t(ô|o)|estou)\s+sem\s+(grana|dinheiro)/,
    /\bsai(u)?\s+(muito\s+)?caro/,
  ],
  prazo: [
    /\bmuito\s+(demorado|demorada|tempo)/,
    /\b(prazo|entrega)\s+(é\s+)?(muito\s+)?(longo|longa|demorado|demorada)/,
    /\bdemora\s+(demais|muito)/,
    /\bpreciso\s+(r(á|a)pido|urgente|agora|hoje)/,
    /(?:^|\W)(é|eh)\s+(pra|para)\s+(hoje|ontem)/,
  ],
  concorrencia: [
    /\b(outra|outro)\s+(loja|lugar|empresa)/,
    /\bconcorrente/,
    /\b(mais\s+barato|menor\s+pre(ç|c)o)\s+(em|na|no)/,
    /\b(achei|encontrei|vi)\s+(mais\s+)?barato\s+(em|na|no|por)/,
    /\b(t(ô|o)|estou)\s+vendo\s+em\s+outr/,
  ],
  indecisao: [
    /\bvou\s+pensar/,
    /\b(te|vou)\s+respond(er|o)\s+depois/,
    /\bpreciso\s+(pensar|ver|conversar|consultar)/,
    /\bvou\s+dar\s+uma\s+pensada/,
    /\b(depois\s+)?eu\s+(te\s+)?(falo|aviso|retorno)/,
    /\bdeixa\s+eu\s+(pensar|ver)/,
  ],
  qualidade: [
    /\bqualidade\s+(ruim|baixa|duvidosa)/,
    /(?:^|\W)(n(ã|a)o\s+)?confio/,
    /(?:^|\W)(é|eh)\s+(confi(á|a)vel|original)/,
    /\b(fake|falso|pirata|imita(ç|c)(ã|a)o)\b/,
  ],
}

export function detectObjection(text: string): ObjectionType | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [type, patterns] of Object.entries(OBJECTION_PATTERNS) as [ObjectionType, RegExp[]][]) {
    if (patterns.some(p => p.test(lower))) return type
  }
  return null
}
