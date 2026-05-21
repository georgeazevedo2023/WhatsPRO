/**
 * Detect "sale closed" intent from lead message text using deterministic regex.
 *
 * Triggers when lead signals the sale is going through (asks for pix link,
 * confirms payment, says "fechei/combinado", sends comprovante, etc).
 *
 * Used in the AI Agent to tag conversation with `venda:fechada` synchronously,
 * so dashboard metrics and the human seller see the sale closure tag without
 * waiting for the async shadow extraction.
 *
 * Returns the closure type or null when no pattern matches.
 */
export type SaleClosedType =
  | 'pix_solicitado'   // "pode mandar o pix", "me passa o pix"
  | 'pago'             // "paguei", "fiz o pix", "transferi"
  | 'comprovante'      // "segue o comprovante", "anexei comprovante"
  | 'fechado'          // "fechei", "combinado", "fechado"

const SALE_CLOSED_PATTERNS: Record<SaleClosedType, RegExp[]> = {
  comprovante: [
    /\b(segue|anexo|enviei|mandei|anexei)\s+(o\s+)?comprovante\b/,
    /\bcomprovante\s+(de\s+)?(pagamento|do\s+pix|abaixo|anexo)\b/,
    /\bcomprovante\s+anexo\b/,
  ],
  pago: [
    /\b(j(á|a)\s+)?(paguei|fiz\s+o\s+pix|transferi)\b/,
    /\bpagamento\s+(efetuado|realizado|feito|concluído|concluido)\b/,
    /\befetuei\s+o\s+(pagamento|pix)\b/,
  ],
  pix_solicitado: [
    /\b(pode\s+)?mandar?\s+o\s+pix\b/,
    /\bme\s+(passa|envia|manda)\s+o\s+pix\b/,
    /\b(qual|quero)\s+(a\s+)?chave\s+(do\s+)?pix\b/,
    /\bpassa\s+o\s+pix\b/,
  ],
  fechado: [
    /\b(fechei|fechado|fechou)\b/,
    /\bcombinado\b/,
    /\b(t(á|a)\s+)?(fechado|finalizado|certo)(\s+pra\s+(mim|n(ó|o)s))?\b/,
    /\bbora\s+fechar\b/,
    // R128 (2026-05-21): removido `\bquero\s+(comprar|levar|fechar)\b` — false
    // positive crítico no INÍCIO da conversa. "Quero comprar um material" /
    // "quero levar uma porta" são INTENÇÕES de compra, não venda fechada.
    // Sale closure real exige sinal explícito de fechamento (pix, comprovante,
    // "fechei", "combinado") OU contexto de qualif avançada. "Bora comprar"
    // também removido pelo mesmo motivo. "Bora fechar" mantido (esse é
    // discriminativo: ninguém diz "bora fechar" no início).
  ],
}

export function detectSaleClosed(text: string): SaleClosedType | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [type, patterns] of Object.entries(SALE_CLOSED_PATTERNS) as [SaleClosedType, RegExp[]][]) {
    if (patterns.some(p => p.test(lower))) return type
  }
  return null
}
