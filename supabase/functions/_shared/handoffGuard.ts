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
