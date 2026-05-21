// Guard que decide se o LLM pode chamar handoff_to_human.
// Regra: se o lead tem contexto de produto (tags `produto:`, `interesse:`, `marca_preferida:`),
// uma busca PRECISA ter sido feita antes — senão o agente pula a etapa de SDR.
//
// R124 (2026-05-20): tags `search_fail:N` contam como busca prévia. Antes do fix, o guard só
// olhava `toolCallsLog` da rodada atual; quando a busca falhava num turno e o lead voltava no
// turno seguinte, o `toolCallsLog` zerava e o handoff ficava bloqueado pra sempre — IA entrava
// em loop, conversa não era atribuída ao default_assignee, mensagem de transbordo não saía.

export interface HandoffGuardInput {
  /** Tags atuais da conversa (do DB). */
  tags: string[]
  /** Nome dos tools chamados nesta rodada (ex: ['search_products', 'set_tags']). */
  toolNamesThisRound: string[]
}

export interface HandoffGuardResult {
  allowed: boolean
  reason: 'no_product_context' | 'searched_this_round' | 'searched_before' | 'blocked_search_required'
}

export function evaluateHandoffGuard(input: HandoffGuardInput): HandoffGuardResult {
  const productTags = input.tags.filter(
    (t) => t.startsWith('produto:') || t.startsWith('interesse:') || t.startsWith('marca_preferida:')
  )
  if (productTags.length === 0) {
    return { allowed: true, reason: 'no_product_context' }
  }

  if (input.toolNamesThisRound.includes('search_products')) {
    return { allowed: true, reason: 'searched_this_round' }
  }

  if (input.tags.some((t) => t.startsWith('search_fail:'))) {
    return { allowed: true, reason: 'searched_before' }
  }

  return { allowed: false, reason: 'blocked_search_required' }
}

export const HANDOFF_GUARD_BLOCKED_MSG =
  '[INTERNO] REGRA BUSCA OBRIGATÓRIA: você DEVE chamar search_products antes de handoff_to_human. O lead tem interesse em produto — busque primeiro. Se não encontrar, aí sim faça handoff.'

// ---------------------------------------------------------------------------
// Payment block (Sprint A — auditoria 2026-05-21)
// Substitui 1 regra de `hardcodedRules` (pagamento != handoff) pré-Sprint B.
// Pergunta sobre desconto/PIX/parcelamento/boleto/cartao NAO eh motivo de
// handoff — IA deve responder com business_info. Helper exportado pra futuro
// uso na regra "INFORMACOES NAO CADASTRADAS = HANDOFF" (matching com info disponivel).
// ---------------------------------------------------------------------------

export interface PaymentDetectionInput {
  /** Razão que o LLM passou pro handoff_to_human (args.reason). */
  handoffReason: string
  /** Última msg incoming do lead (ou agregação curta). Usado pra contextualizar — não obrigatório match. */
  leadText?: string
}

export interface PaymentBlockVerdict {
  block: boolean
  /** Mensagem pro LLM quando block=true, instruindo a responder com business_info. */
  message: string
  /** Quais keywords ativaram o block (debug/log). */
  matchedTerms: string[]
}

// Termos canonicos (ja sem acento, lowercase). Match feito com \bTERMO\b
// sobre texto normalizado. Multi-palavra ("a vista", "forma de pagamento")
// usa \b nas pontas — espaco simples no meio bate normal.
const PAYMENT_TERMS: readonly string[] = [
  'desconto',
  'descontos',
  'pix',
  'parcelamento',
  'parcelar',
  'parcela',
  'parcelas',
  'boleto',
  'cartao',
  'debito',
  'a vista',
  'forma de pagamento',
  'formas de pagamento',
  'pagamento',
]

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalize(s: string): string {
  return stripAccents(String(s ?? '')).toLowerCase()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detecta se a string contem mencao a pagamento (export utilitario).
 * Match case-insensitive, sem acento, com fronteira de palavra.
 */
export function mentionsPaymentTopic(text: string): { match: boolean; terms: string[] } {
  const norm = normalize(text)
  if (!norm) return { match: false, terms: [] }
  const hits: string[] = []
  for (const term of PAYMENT_TERMS) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i')
    if (re.test(norm)) hits.push(term)
  }
  return { match: hits.length > 0, terms: hits }
}

/**
 * Decide se handoff_to_human deve ser BLOQUEADO porque o lead esta perguntando
 * sobre pagamento. Pagamento != handoff: IA responde com business_info.
 */
export function shouldBlockHandoffForPayment(input: PaymentDetectionInput): PaymentBlockVerdict {
  const combined = `${input.handoffReason ?? ''} ${input.leadText ?? ''}`
  const { match, terms } = mentionsPaymentTopic(combined)
  if (!match) {
    return { block: false, message: '', matchedTerms: [] }
  }
  const message = `Pergunta sobre pagamento (${terms.join(', ')}) NÃO é motivo de handoff. Responda usando business_info disponível (PIX, parcelamento, descontos). Handoff só após qualificação completa OU pedido explícito do lead pra falar com vendedor.`
  return { block: true, message, matchedTerms: terms }
}
