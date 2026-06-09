/**
 * D34: Decisao de reabertura de conv resolvida dentro de janela 60d.
 *
 * Quando lead volta a falar e nao ha conv `aberta`/`pendente`, mas existe
 * uma conv `resolvida` recente do mesmo contato, o webhook deve REABRIR
 * essa conv (mesma row) em vez de criar nova. Preserva tags, limpa
 * assigned_to, volta status_ia=ligada, adiciona tag `reaberta:YYYY-MM-DD`.
 *
 * Exclui spam: leads tageados como `resultado:spam` NUNCA reabrem.
 */

export interface ReopenCandidate {
  id: string
  tags: string[] | null
  resolved_at: string | null
}

export interface ReopenDecision {
  reopen: boolean
  reason: 'no_candidate' | 'outside_window' | 'spam' | 'no_resolved_at' | 'reopen'
  mergedTags?: string[]
  reopenTag?: string
}

export const REOPEN_WINDOW_DAYS_DEFAULT = 60

/**
 * Tags de CONTROLE (handoff/atendimento-humano + loop sem-resultado) que devem ser
 * REMOVIDAS ao reabrir uma conversa, pra a IA voltar a atender o lead que retornou.
 * Mantemos as tags de NEGÓCIO (interesse/motivo/resultado/valor/cidade/...).
 */
export const CONTROL_TAG_KEYS = new Set<string>([
  'handoff_created', 'human_assigned', 'seller_notified', 'followups_paused',
  'agent_status', 'handoff_at', 'enriching', 'enrich_count', 'questions_after_empty',
  'catalog_result', 'physical_stock_required', 'flow_mode', 'search_fail',
  'seller_handoff_pending',
])

export function shouldReopenConversation(
  candidate: ReopenCandidate | null,
  now: Date,
  options: { windowDays?: number } = {},
): ReopenDecision {
  if (!candidate) {
    return { reopen: false, reason: 'no_candidate' }
  }
  if (!candidate.resolved_at) {
    return { reopen: false, reason: 'no_resolved_at' }
  }

  const windowDays = options.windowDays ?? REOPEN_WINDOW_DAYS_DEFAULT
  const ageMs = now.getTime() - new Date(candidate.resolved_at).getTime()
  const ageDays = ageMs / 86400000
  if (ageDays > windowDays) {
    return { reopen: false, reason: 'outside_window' }
  }

  const existingTags = candidate.tags || []
  if (existingTags.includes('resultado:spam')) {
    return { reopen: false, reason: 'spam' }
  }

  // (2026-06-09) Reabrir = conversa NOVA pro lead que voltou. Limpa o estado DURÁVEL
  // de handoff/controle-humano e do loop sem-resultado. Sem isso, o gate de silêncio
  // no ai-agent (coage status_ia→shadow enquanto houver handoff_created/human_assigned)
  // manteria a IA muda numa conversa reaberta, e as tags do loop re-disparariam o
  // transbordo — foi exatamente o 3º handoff idêntico do incidente Guedes, logo após a
  // reabertura. Tags de NEGÓCIO (interesse/motivo/resultado/valor/cidade...) são mantidas.
  const cleanedTags = existingTags.filter(
    (t) => typeof t === 'string' && !CONTROL_TAG_KEYS.has(t.split(':')[0]),
  )

  const today = now.toISOString().slice(0, 10)
  const reopenTag = `reaberta:${today}`
  const mergedTags = cleanedTags.includes(reopenTag)
    ? cleanedTags
    : [...cleanedTags, reopenTag]

  return { reopen: true, reason: 'reopen', mergedTags, reopenTag }
}
