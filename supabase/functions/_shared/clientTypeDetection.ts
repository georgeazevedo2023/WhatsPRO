/**
 * Detect client/profession type from lead message text using deterministic regex.
 *
 * Captures phrases like "sou pintor", "trabalho como eletricista", "tô de
 * arquiteto", "tenho uma empresa de pintura". Sets tag `tipo_cliente:PROFISSAO`
 * synchronously — feature was previously LLM-only via set_tags but capture
 * rate was near-zero in production (R114 lesson).
 *
 * Returns the canonical profession key or null when no pattern matches.
 */
export type ClientType =
  | 'pintor'
  | 'eletricista'
  | 'pedreiro'
  | 'arquiteto'
  | 'engenheiro'
  | 'marceneiro'
  | 'decorador'
  | 'encanador'
  | 'gesseiro'
  | 'empreiteiro'
  | 'projetista'
  | 'designer'
  | 'construtor'
  | 'mestre_de_obras'
  | 'serralheiro'
  | 'vidraceiro'

// Map of canonical → lexical variants present in PT-BR speech.
// Order matters: more specific (multi-word) patterns first to win over single-word ones.
const CLIENT_PATTERNS: Array<[ClientType, RegExp[]]> = [
  ['mestre_de_obras', [
    /\bmestre\s+de\s+obras?\b/,
  ]],
  ['empreiteiro', [
    /\bempreiteir(o|a)\b/,
  ]],
  ['construtor', [
    /\bconstrutor(a|es)?\b/,
  ]],
  ['projetista', [
    /\bprojetist(a|as)\b/,
  ]],
  ['arquiteto', [
    /\barquitet(o|a|os|as)\b/,
  ]],
  ['engenheiro', [
    /\bengenheir(o|a|os|as)\s*(civil|el(é|e)trico|el(é|e)trica|hidr(á|a)ulico)?\b/,
  ]],
  ['designer', [
    /\bdesigner\s+(de\s+)?interiores?\b/,
    /\b(d|D)esigner\s+ambient/,
  ]],
  ['decorador', [
    /\bdecorador(a|es|as)?\b/,
  ]],
  ['marceneiro', [
    /\bmarceneir(o|a|os|as)\b/,
  ]],
  ['gesseiro', [
    /\bgesseir(o|a|os|as)\b/,
  ]],
  ['encanador', [
    /\bencanador(a|es|as)?\b/,
    /\b(boy|profissional)\s+da\s+hidr(á|a)ulica\b/,
  ]],
  ['serralheiro', [
    /\bserralheir(o|a|os|as)\b/,
  ]],
  ['vidraceiro', [
    /\bvidraceir(o|a|os|as)\b/,
  ]],
  ['pedreiro', [
    /\bpedreir(o|a|os|as)\b/,
  ]],
  ['eletricista', [
    /\beletricist(a|as)\b/,
  ]],
  ['pintor', [
    /\bpintor(a|es|as)?\b/,
  ]],
]

// Identifier prefixes that confirm "I am [profession]" (vs "preciso de um pintor").
// Acts as confidence booster — without context the lead might just be talking ABOUT
// professionals, not identifying as one.
const SELF_IDENTIFICATION = [
  /\bsou\s+/,
  /\b(t(ô|o)|estou)\s+/,
  /\btrabalho\s+(como|de|na\s+(á|a)rea\s+de)\s+/,
  /\bme\s+chamo\s+\w+\s+e\s+sou\s+/,
  /\bsou\s+um[ao]?\s+/,
  /\btenho\s+(uma\s+)?(empresa|loja)\s+de\s+/,
  /\bfa(ç|c)o\s+(servi(ç|c)o\s+de\s+)?/,
]

/**
 * Returns canonical ClientType when:
 * 1. A profession lexeme is present, AND
 * 2. Either (a) the message has a self-identification prefix, OR
 *    (b) the profession lexeme stands alone as a short reply (single-word answer
 *        to "qual sua profissao?").
 *
 * If profession is mentioned without identifier ("preciso de um pintor"),
 * returns null to avoid false positives.
 */
export function detectClientType(text: string): ClientType | null {
  if (!text) return null
  const lower = text.toLowerCase()
  const trimmed = lower.trim()

  // Find any profession match
  let matched: ClientType | null = null
  for (const [type, patterns] of CLIENT_PATTERNS) {
    if (patterns.some(p => p.test(lower))) { matched = type; break }
  }
  if (!matched) return null

  // Confidence check: require self-identification OR short standalone reply
  const hasSelfId = SELF_IDENTIFICATION.some(p => p.test(lower))
  // A "short standalone reply" = the message is essentially just the profession word
  // (≤3 words after trim). Handles "Pintor" / "Sou pintor" / "Pintor mesmo"
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  const isShortReply = wordCount <= 3

  if (hasSelfId || isShortReply) return matched
  return null
}
