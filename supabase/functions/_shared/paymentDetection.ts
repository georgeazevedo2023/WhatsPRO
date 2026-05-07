/**
 * Detect payment intent from lead message text using deterministic regex patterns.
 *
 * Distinguishes INTENT ("vou pagar com pix", "manda o pix") from QUERY ("aceita pix?",
 * "qual forma de pagamento"). Only intent gets tagged — queries pollute analytics.
 *
 * Used in the AI Agent to tag conversation with `pagamento:METODO` synchronously,
 * so the manager dashboard can rank preferred payment methods.
 *
 * Returns the payment method or null when no pattern matches.
 */
export type PaymentMethod =
  | 'pix'
  | 'cartao'        // crédito ou débito não-parcelado
  | 'parcelado'     // 2x+ no cartão
  | 'boleto'
  | 'dinheiro'      // à vista em espécie

// Query indicators — frases que indicam CONSULTA, não intenção. Filtramos antes do match.
// Se o texto contém uma destas, ignoramos os patterns (evita "aceita pix?" virar pagamento:pix).
const QUERY_INDICATORS = [
  /\b(aceita|aceitam)\s+(pix|cart(ã|a)o|boleto|dinheiro)/,
  /\bqual\s+(a\s+)?forma\s+de\s+pagamento/,
  /\bquais\s+(as\s+)?formas/,
  /\bvoc(ê|e)s\s+aceitam/,
  /\bt(ê|e)m\s+(pix|cart(ã|a)o|boleto)\??$/,
  /\bcomo\s+(eu\s+)?pago/,
]

const PAYMENT_PATTERNS: Record<PaymentMethod, RegExp[]> = {
  // Parcelado tem prioridade sobre cartao (12x cartão = parcelado, não cartao puro)
  parcelado: [
    /\b(\d{1,2})x\b/,
    /\bparcel(ar|ado|ada|amento)/,
    /\b(em|de)\s+\d{1,2}\s+(vezes|parcelas)/,
    /\bdivid(ir|ido)/,
  ],
  pix: [
    /\b(pode\s+)?mandar?\s+o\s+pix\b/,
    /\bme\s+(passa|envia|manda)\s+o\s+pix\b/,
    /\bpassa\s+o\s+pix\b/,
    /\b(vou|prefiro)\s+(pagar\s+)?(de|com|no)\s+pix\b/,
    /\b(qual|quero)\s+(a\s+)?chave\s+(do\s+)?pix\b/,
    /\bpix\s+ent(ã|a)o/,
    /\bser(á|a)\s+(no\s+|de\s+|com\s+)?pix\b/,
  ],
  cartao: [
    /\b(vou|prefiro)\s+(pagar\s+)?(de|com|no)\s+cart(ã|a)o\b/,
    /\bcart(ã|a)o\s+de\s+cr(é|e)dito\b/,
    /\bcart(ã|a)o\s+de\s+d(é|e)bito\b/,
    /\bd(é|e)bito\s+ent(ã|a)o/,
    /\bvai\s+(ser\s+)?(no\s+|de\s+)?cart(ã|a)o\b/,
  ],
  boleto: [
    /\b(vou|prefiro)\s+(pagar\s+)?(de|com|no)\s+boleto\b/,
    /\bme\s+(passa|envia|manda)\s+o\s+boleto\b/,
    /\bgera\s+o\s+boleto\b/,
    /\bboleto\s+(ent(ã|a)o|por\s+favor|mesmo)/,
  ],
  dinheiro: [
    /(?:^|\W)(vou|prefiro)\s+pagar\s+(à|a)\s+vista(?=\W|$)/,
    /(?:^|\W)(à|a)\s+vista\s+em\s+(esp(é|e)cie|dinheiro)/,
    /\b(vou|prefiro)\s+(pagar\s+)?em\s+dinheiro\b/,
    /\bdinheiro\s+vivo\b/,
  ],
}

export function detectPayment(text: string): PaymentMethod | null {
  if (!text) return null
  const lower = text.toLowerCase()
  // Skip queries — only intent is tagged
  if (QUERY_INDICATORS.some(p => p.test(lower))) return null
  for (const [method, patterns] of Object.entries(PAYMENT_PATTERNS) as [PaymentMethod, RegExp[]][]) {
    if (patterns.some(p => p.test(lower))) return method
  }
  return null
}
