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

  const today = now.toISOString().slice(0, 10)
  const reopenTag = `reaberta:${today}`
  const mergedTags = existingTags.includes(reopenTag)
    ? existingTags
    : [...existingTags, reopenTag]

  return { reopen: true, reason: 'reopen', mergedTags, reopenTag }
}
