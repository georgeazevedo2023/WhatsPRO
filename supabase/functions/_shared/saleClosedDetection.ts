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
    /\b(t(á|a)\s+)?(finalizado|certo)\s+pra\s+(mim|n(ó|o)s)\b/,
    /\bbora\s+fechar\b/,
    // R128 (2026-05-21): removido `\bquero\s+(comprar|levar|fechar)\b` — false
    // positive crítico no INÍCIO da conversa. "Quero comprar um material" /
    // "quero levar uma porta" são INTENÇÕES de compra, não venda fechada.
    // Sale closure real exige sinal explícito de fechamento (pix, comprovante,
    // "fechei", "combinado") OU contexto de qualif avançada. "Bora comprar"
    // também removido pelo mesmo motivo. "Bora fechar" mantido (esse é
    // discriminativo: ninguém diz "bora fechar" no início).
    //
    // Melhoria #1 (v7.84.0): "certo"/"finalizado" SOLTOS removidos — o grupo
    // `(\s+pra\s+(mim|n(ó|o)s))?` era OPCIONAL, então `\bcerto\b` casava sozinho.
    // Medido em prod (30d): 97/99 sale_closed_detected eram "Tá certo"/"Certo,
    // obrigada!" — confirmação conversacional banal, não venda. Inflava o funil
    // E disparava handoff prematuro (Bug 18 path) em modo normal. Agora o
    // complemento "pra mim/nós" é OBRIGATÓRIO pra essas duas palavras; venda
    // verbalizada de forma vaga fica a cargo do shadow LLM (venda_status:fechada
    // → promoção) e do summarizer (sale_closed), ambos com guard de veredito.
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

/**
 * Melhoria #1 (v7.84.0) — closure signals from the SELLER side (shadow bilateral).
 *
 * The lead-centric patterns above miss how a human seller closes ("segue a chave
 * pix", "pedido faturado", "entrega agendada"). These run on `vendor_message`
 * (phone takeover, shadow_only=true) and fall back to the lead patterns, which
 * already caught vendor "fechado"/"combinado" before this change.
 *
 * False-positive guards (same spirit as R128):
 * - "aceita pix?" / "parcela no cartão?" are negotiation, not closure — patterns
 *   require the key being SENT or the payment/order being CONFIRMED.
 * - "obrigado pela preferência" excluded on purpose — sellers say it after LOST
 *   negotiations too. Only "obrigado pela compra" counts.
 * - "pedido anotado/registrado" excluded — that's note-taking, not a sale.
 */
export type VendorSaleClosedType =
  | 'pix_enviado'           // vendor sent the pix key
  | 'pagamento_confirmado'  // vendor confirmed payment landed
  | 'pedido_confirmado'     // order confirmed/invoiced/issued
  | 'entrega_agendada'      // delivery scheduled (post-sale)
  | 'agradecimento_compra'  // "obrigado pela compra"

const VENDOR_SALE_CLOSED_PATTERNS: Record<VendorSaleClosedType, RegExp[]> = {
  pagamento_confirmado: [
    /\bcomprovante\s+recebido\b/,
    /\b(recebi|recebemos)\s+(o\s+)?(comprovante|pagamento|pix)\b/,
    /\bpagamento\s+(confirmado|recebido|caiu)\b/,
    /\b(pix|pagamento)\s+caiu\s*(aqui|na\s+conta)?\b/,
  ],
  pix_enviado: [
    /\b(segue|mando|enviando|anota)\s+(a\s+|o\s+)?(chave\s+)?(do\s+|de\s+)?pix\b/,
    /\b(te\s+passo|vou\s+te\s+passar|passando)\s+(a\s+|o\s+)?(chave\s+)?(do\s+)?pix\b/,
    /\bchave\s+pix\s*[:\-]/,
    /\b(segue|essa\s+(é|e)|anota)\s+(a\s+)?chave\b/,
  ],
  pedido_confirmado: [
    /\bpedido\s+(confirmado|fechado|faturado|emitido|gerado)\b/,
    /\bneg(ó|o)cio\s+fechado\b/,
    /\b(emiti|emitindo|vou\s+emitir)\s+(a\s+)?nota\b/,
    /\bnota\s+(fiscal\s+)?emitida\b/,
  ],
  entrega_agendada: [
    /\bentrega\s+(agendada|marcada|confirmada)\b/,
    /\bsaiu\s+pra?\s+entrega\b/,
  ],
  agradecimento_compra: [
    /\bobrigad[oa]\s+pela\s+compra\b/,
  ],
}

export function detectVendorSaleClosed(text: string): VendorSaleClosedType | SaleClosedType | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [type, patterns] of Object.entries(VENDOR_SALE_CLOSED_PATTERNS) as [VendorSaleClosedType, RegExp[]][]) {
    if (patterns.some(p => p.test(lower))) return type
  }
  // Vendor "fechado!"/"combinado" matched the lead patterns before this detector
  // existed — keep that behaviour as fallback.
  return detectSaleClosed(text)
}

/**
 * A sale verdict already exists when the AI tagged `venda:*` (deterministic) or
 * a human tagged `resultado:*` (resolution drawer, e.g. resultado:perdido).
 * LLM-derived detections (shadow vendor, summarizer) must NEVER override these.
 */
export function hasSaleVerdict(tags: string[] | null | undefined): boolean {
  return (tags || []).some(t => t.startsWith('venda:') || t.startsWith('resultado:'))
}

/**
 * Deterministic promotion: shadow vendor LLM tagged `venda_status:fechada` →
 * promote to the funnel tag `venda:fechada`, unless a verdict already exists.
 */
export function shouldPromoteVendorStatusToSale(newTags: string[], existingTags: string[]): boolean {
  const normalized = (newTags || []).map(t => t.toLowerCase().trim().replace(/:\s+/g, ':'))
  if (!normalized.includes('venda_status:fechada')) return false
  return !hasSaleVerdict(existingTags)
}
