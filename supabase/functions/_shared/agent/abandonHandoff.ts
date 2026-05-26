/**
 * Sprint E.2 — Handoff por ABANDONO: decisão PURA dos 2 estágios.
 *
 * Sem I/O — recebe os timestamps já lidos e devolve o que fazer. Testável.
 *
 * Contexto: a conversa carrega a tag `seller_handoff_pending:{categoria}` (a IA
 * fez a pergunta da marca e está esperando o lead). Se o lead some:
 *   • estágio 1 (nudge): após `nudgeAfterMin` sem resposta → cutucar o lead.
 *   • estágio 2 (handoff): após `handoffAfterMin` da cutucada → transbordar.
 * Se o lead respondeu em qualquer ponto, NÃO agimos (o pré-router do ai-agent
 * cuida do handoff na resposta dele).
 */

export type AbandonStage = 'none' | 'nudge' | 'handoff'

export interface AbandonDecisionInput {
  /** ai_agents.abandon_nudge_after_min */
  nudgeAfterMin: number
  /** ai_agents.abandon_handoff_after_min */
  handoffAfterMin: number
  /** ISO da última mensagem do BOT (direction=outgoing, sender_id NULL). */
  lastBotMessageAt: string | null
  /** epoch ms da cutucada já enviada (da tag abandon_nudged:{ms}); null = ainda não cutucou. */
  nudgedAtMs: number | null
  /** true se o lead mandou alguma mensagem (incoming) DEPOIS da última msg do bot. */
  leadRepliedSinceBot: boolean
  /** override de relógio (testes) */
  now?: number
}

const MIN_MS = 60_000

/**
 * Decide o estágio. Regras:
 *   - lead respondeu → 'none' (timeline abortada).
 *   - timestamps inválidos / config <= 0 → 'none' (defensivo).
 *   - já cutucado → mede do nudge: >= handoffAfterMin → 'handoff'.
 *   - ainda não cutucado → mede da última msg do bot: >= nudgeAfterMin → 'nudge'.
 */
export function decideAbandonStage(input: AbandonDecisionInput): AbandonStage {
  if (input.leadRepliedSinceBot) return 'none'
  const now = input.now ?? Date.now()

  // Estágio 2: já cutucamos antes
  if (input.nudgedAtMs != null) {
    if (!Number.isFinite(input.nudgedAtMs)) return 'none'
    if (!(input.handoffAfterMin > 0)) return 'none'
    const minsSinceNudge = (now - input.nudgedAtMs) / MIN_MS
    return minsSinceNudge >= input.handoffAfterMin ? 'handoff' : 'none'
  }

  // Estágio 1: ainda não cutucamos
  if (!(input.nudgeAfterMin > 0)) return 'none'
  if (!input.lastBotMessageAt) return 'none'
  const lastBotMs = new Date(input.lastBotMessageAt).getTime()
  if (Number.isNaN(lastBotMs)) return 'none'
  const minsSinceBot = (now - lastBotMs) / MIN_MS
  return minsSinceBot >= input.nudgeAfterMin ? 'nudge' : 'none'
}

/** Extrai o epoch ms da tag `abandon_nudged:{ms}`. null se ausente/inválida. */
export function parseNudgedAtMs(tags: string[] | null | undefined): number | null {
  const tag = (tags || []).find(
    (t) => typeof t === 'string' && t.startsWith('abandon_nudged:'),
  )
  if (!tag) return null
  const ms = Number(tag.slice('abandon_nudged:'.length))
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

/** Extrai a categoria/motivo da tag `seller_handoff_pending:{categoria}` → texto legível. */
export function parsePendingTrigger(tags: string[] | null | undefined): string {
  const tag = (tags || []).find(
    (t) => typeof t === 'string' && t.startsWith('seller_handoff_pending:'),
  )
  if (!tag) return 'consulta de produto'
  const raw = tag.slice('seller_handoff_pending:'.length).replace(/_/g, ' ').trim()
  return raw || 'consulta de produto'
}

/**
 * Prefixa o primeiro nome do lead na cutucada, sem duplicar se já começa com ele.
 * Cutucada é leve (não usa personalizeHandoffMessage, que é flavor de transbordo).
 */
export function personalizeNudge(message: string, leadName?: string | null): string {
  const name = (leadName || '').trim().split(/\s+/)[0] || ''
  if (!name) return message
  const already = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,!?.\\s]`, 'i')
  if (already.test(message.trimStart())) return message
  return `${name}, ${message.charAt(0).toLowerCase()}${message.slice(1)}`
}

/** Texto default da cutucada quando o agente não configurou um. */
export const DEFAULT_NUDGE_MESSAGE =
  'Ainda tá por aí? 😊 Se quiser, já te conecto com um vendedor pra agilizar seu atendimento.'
