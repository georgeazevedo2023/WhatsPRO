/**
 * Sprint E.2 — Handoff por ABANDONO: decisão PURA. Sem I/O — recebe os
 * timestamps já lidos e devolve o que fazer. Testável.
 *
 * Dois caminhos independentes (ligados por flags distintas no agente):
 *
 *  T1 — fluxo PENDENTE (`abandon_handoff_enabled`):
 *    A conversa carrega a tag `seller_handoff_pending:{categoria}` (a IA fez a
 *    pergunta da marca e está esperando o lead). Se o lead some:
 *      • estágio 1 (nudge):   após `nudgeAfterMin` sem resposta → cutucar.
 *      • estágio 2 (handoff): após `handoffAfterMin` da cutucada → transbordar.
 *
 *  T2 — INATIVIDADE genérica (`inactivity_handoff_enabled`, v7.65.0):
 *    QUALQUER lead silencioso (independe de tag pendente), em 2 estágios como
 *    o pendente: cutucada após `inactivityNudgeAfterMin` (default 3) →
 *    transbordo após `inactivityHandoffAfterMin` da cutucada (default +3, total
 *    6min). Guarda-corpos: só vale se o lead já interagiu ao menos 1x
 *    (`leadEverReplied`) E a conversa não terminou em despedida
 *    (`conversationClosed`), pra não inundar o vendedor com lead frio ou
 *    conversa concluída.
 *
 * Precedência: quando o lead é elegível ao T2 (inatividade ON + interagiu +
 * não-encerrou), os limiares do T2 governam — mesmo que ele tenha tag pendente.
 * T1 só vale quando o T2 não se aplica (inatividade OFF, ou guarda bloqueou).
 *
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

  // ── T1 (fluxo pendente) — default true p/ retrocompat dos testes/chamadas antigas
  /** ai_agents.abandon_handoff_enabled */
  pendingEnabled?: boolean
  /** conversa tem tag seller_handoff_pending:* */
  hasPendingTag?: boolean

  // ── T2 (inatividade genérica, v7.65.0)
  /** ai_agents.inactivity_handoff_enabled */
  inactivityEnabled?: boolean
  /** ai_agents.inactivity_nudge_after_min — min sem resposta antes da cutucada (default 3) */
  inactivityNudgeAfterMin?: number
  /** ai_agents.inactivity_handoff_after_min — min APÓS a cutucada antes do transbordo (default 3) */
  inactivityHandoffAfterMin?: number
  /** lead mandou ao menos uma mensagem na conversa (interagiu) */
  leadEverReplied?: boolean
  /** última mensagem do lead parece encerramento/despedida */
  conversationClosed?: boolean
}

const MIN_MS = 60_000

/**
 * Decide o estágio (cutucada → transbordo), 2 estágios pros dois fluxos.
 * Escolhe os limiares: T2 (inatividade) governa se o lead é elegível; senão T1.
 */
export function decideAbandonStage(input: AbandonDecisionInput): AbandonStage {
  if (input.leadRepliedSinceBot) return 'none'
  const now = input.now ?? Date.now()

  const lastBotMs = input.lastBotMessageAt ? new Date(input.lastBotMessageAt).getTime() : NaN
  const haveBot = !Number.isNaN(lastBotMs)
  const minsSinceBot = haveBot ? (now - lastBotMs) / MIN_MS : -1

  // Qual fluxo governa este lead? Inatividade (T2) tem precedência de limiares.
  const genericApplies =
    (input.inactivityEnabled ?? false) &&
    (input.leadEverReplied ?? true) &&
    !(input.conversationClosed ?? false)
  const pendingApplies = (input.pendingEnabled ?? true) && (input.hasPendingTag ?? true)

  let nudgeAfter: number
  let handoffAfter: number
  if (genericApplies) {
    nudgeAfter = input.inactivityNudgeAfterMin ?? 0
    handoffAfter = input.inactivityHandoffAfterMin ?? 0
  } else if (pendingApplies) {
    nudgeAfter = input.nudgeAfterMin
    handoffAfter = input.handoffAfterMin
  } else {
    return 'none'
  }

  // Estágio 2: já cutucamos antes → mede da cutucada
  if (input.nudgedAtMs != null) {
    if (!Number.isFinite(input.nudgedAtMs)) return 'none'
    if (!(handoffAfter > 0)) return 'none'
    const minsSinceNudge = (now - input.nudgedAtMs) / MIN_MS
    return minsSinceNudge >= handoffAfter ? 'handoff' : 'none'
  }

  // Estágio 1: ainda não cutucamos → mede da última msg do bot
  if (!(nudgeAfter > 0)) return 'none'
  if (!haveBot) return 'none'
  return minsSinceBot >= nudgeAfter ? 'nudge' : 'none'
}

/**
 * Heurística PURA: a última mensagem do lead parece encerramento/despedida?
 * Conservadora — só marca "encerrada" em casos CLAROS (despedida ou ack curto),
 * pra não bloquear transbordo de quem ainda está engajado. Se o lead fez uma
 * pergunta (tem "?") nunca é encerramento. Mensagens longas (>8 palavras) têm
 * conteúdo demais pra serem mero "tchau" → não consideradas encerramento.
 */
const CLOSER_PATTERNS: RegExp[] = [
  /\bobrigad[oa]s?\b/i, /\bobg\b/i, /\bvaleu\b/i, /\bvlw\b/i, /\bgrat[oa]\b/i,
  /\btchau\b/i, /\bat[ée] (mais|logo|breve|a próxima|a proxima)\b/i, /\bfalou\b/i, /\bflw\b/i,
  /\bvou pensar\b/i, /\bvou (ver|analisar|avaliar|decidir)\b/i,
  /\bdepois (eu |te |volto|vejo|falo|retorno|decido|penso)/i,
  /\bmais tarde\b/i, /\boutra hora\b/i, /\bqualquer coisa (eu |te )?(falo|chamo|aviso|retorno)/i,
]
const ACK_ONLY = /^(ok+|okay|blz|beleza|show|perfeito|certo|isso|combinado|t[áa] bom|t[áa] ótimo|t[áa] otimo|👍|🙏|👌|✅|valeu)[\s!.,👍🙏👌✅😊🙂]*$/i

export function looksLikeConversationClosed(message: string | null | undefined): boolean {
  const text = (message || '').trim()
  if (!text) return false
  if (text.includes('?')) return false // pediu/perguntou algo → não encerrou
  if (ACK_ONLY.test(text)) return true // "ok", "valeu 👍", etc.
  if (text.split(/\s+/).length > 8) return false // conteúdo demais p/ ser só despedida
  return CLOSER_PATTERNS.some((re) => re.test(text))
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
