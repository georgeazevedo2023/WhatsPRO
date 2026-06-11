/**
 * funnelStages — deriva as etapas do funil de conversão DETERMINISTICAMENTE
 * das tags duráveis da conversa (+ carrinho + atribuição).
 *
 * Decisão do dono (2026-06-11, opção C): funil de 5 etapas
 *   contact → qualification → intention → handoff → conversion
 * onde conversion = venda marcada: venda:fechada (saleClosedDetection, determinístico,
 * lead confirmou o pedido na conversa) OU resultado:venda (humano, TicketResolutionDrawer).
 * venda_status:fechando é "em fechamento" → conta como intention, não conversion.
 *
 * Por que tags duráveis e não shadow: o extract_shadow_data emite JSON livre
 * (sem array tags), o que deixou o funil zerado por 2 meses. As tags de
 * conversations.tags são escritas por código determinístico (lead_score:NN via
 * preLLMAutoExtract; handoff_created/human_assigned via step 22) e pelo
 * set_tags com taxonomia fixa — fonte auditável que já existe.
 */

export type FunnelStage = 'contact' | 'qualification' | 'intention' | 'handoff' | 'conversion'

export interface FunnelSignals {
  tags: string[] | null | undefined
  /** conversations.cart_items (jsonb) — array de itens ou null */
  cartItems: unknown
  /** conversations.assigned_to */
  assignedTo: string | null | undefined
}

/** Normaliza tag pra matching: trim, minúsculas, remove espaço após ':' ("intencao: compra" existe em prod). */
function norm(tag: string): string {
  return tag.toLowerCase().trim().replace(/:\s+/g, ':')
}

const INTENTION_EXACT = new Set(['intencao:compra', 'intencao:orcamento'])

export function deriveFunnelStages(input: FunnelSignals): FunnelStage[] {
  const tags = (input.tags ?? []).filter((t) => typeof t === 'string').map(norm)
  const hasCart = Array.isArray(input.cartItems) && input.cartItems.length > 0

  const stages: FunnelStage[] = ['contact']

  const qualification = tags.some((t) => t.startsWith('interesse:') || t.startsWith('lead_score:'))
  if (qualification) stages.push('qualification')

  const intention =
    hasCart ||
    tags.some(
      (t) =>
        INTENTION_EXACT.has(t) ||
        t === 'venda_status:negociando' ||
        t === 'venda_status:fechando',
    )
  if (intention) stages.push('intention')

  const handoff =
    !!input.assignedTo ||
    tags.some((t) => t.startsWith('handoff_created:') || t.startsWith('human_assigned:'))
  if (handoff) stages.push('handoff')

  const conversion = tags.some((t) => t === 'resultado:venda' || t === 'venda:fechada')
  if (conversion) stages.push('conversion')

  return stages
}
