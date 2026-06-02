/**
 * handoffCaps.ts — decisões PURAS de transbordo automático por "cap" (teto).
 *
 * Auditoria de paridade Agente IA ↔ Painel Admin (2026-06-02): dois controles
 * existiam na UI (RulesConfig) mas eram TOGGLES MORTOS — o backend NUNCA lia o
 * flag, então mexer neles não fazia nada:
 *
 *   • Gap #3 — `handoff_max_conversation_minutes`: cap de DURAÇÃO da conversa
 *     com a IA. Ao passar de N minutos desde o início da sessão, transborda.
 *   • Gap #2 — `handoff_negative_sentiment`: handoff por sentimento negativo
 *     PERSISTENTE (≥2 sinais negativos na sessão). 1 reclamação pontual NÃO
 *     transborda — a IA ainda tenta resolver.
 *
 * Estas funções são puras/testáveis (sem I/O): o index.ts lê do banco e chama
 * elas, espelhando o padrão de abandonHandoff.ts. Rollout seguro: ambos os
 * flags nascem OFF (a migration zera os defaults antigos 15/true e reseta os
 * rows existentes) e são ligados explicitamente por agente (EletropisoV2).
 */

/**
 * Palavras que sinalizam frustração/insatisfação. É a MESMA lista usada inline
 * no fluxo de empatia-antes-do-handoff do index.ts (negativeWords), centralizada
 * aqui para reuso determinístico. Tudo em minúsculas; o caller normaliza o texto.
 */
export const NEGATIVE_SENTIMENT_WORDS: readonly string[] = [
  'absurdo', 'demora', 'demorado', 'pessimo', 'péssimo', 'ridiculo', 'ridículo',
  'descaso', 'falta de respeito', 'irritado', 'irritada', 'frustrado', 'frustrada',
  'reclamar', 'reclamacao', 'reclamação', 'horrivel', 'horrível', 'pessima', 'péssima',
  'insatisfeito', 'insatisfeita', 'decepcionado', 'decepcionada', 'enganaram',
]

/** True se o texto contém algum sinal de sentimento negativo. */
export function hasNegativeWord(text: string | null | undefined): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return NEGATIVE_SENTIMENT_WORDS.some((w) => t.includes(w))
}

export interface MinutesCapParams {
  /** Valor de `agent.handoff_max_conversation_minutes`. 0/null/ausente = desligado. */
  maxMinutes: number | null | undefined
  /** Início da sessão (ISO) — `conversation.created_at` ou a última tag `ia_cleared:`. */
  sessionStartIso: string | null | undefined
  /** Agora, em ms (Date.now()). */
  nowMs: number
  /** `conversation.status_ia` atual. */
  statusIa: string | null | undefined
  /** Constante de shadow (STATUS_IA.SHADOW) — não transborda se já em shadow. */
  shadowStatus: string
}

/**
 * Gap #3: transborda se a conversa com a IA já dura ≥ maxMinutes.
 * Não dispara quando desligado (0/null), sem início válido, ou já em shadow.
 */
export function shouldHandoffByConversationMinutes(p: MinutesCapParams): boolean {
  const max = Number(p.maxMinutes ?? 0)
  if (!Number.isFinite(max) || max <= 0) return false
  if (p.statusIa === p.shadowStatus) return false
  if (!p.sessionStartIso) return false
  const startMs = Date.parse(p.sessionStartIso)
  if (!Number.isFinite(startMs)) return false
  const elapsedMin = (p.nowMs - startMs) / 60_000
  return elapsedMin >= max
}

export interface NegativeSentimentParams {
  /** Valor de `agent.handoff_negative_sentiment`. */
  enabled: boolean | null | undefined
  statusIa: string | null | undefined
  shadowStatus: string
  /** Textos das mensagens INCOMING da sessão (qualquer ordem; serão normalizados). */
  sessionIncomingTexts: string[]
  /** Mensagem atual do lead (pode já estar em sessionIncomingTexts — é dedupada). */
  currentText: string | null | undefined
  /** Tags da conversa — procura `sentimento:negativo` de turno anterior do LLM. */
  conversationTags: string[]
  /** Quantos sinais negativos = "persistente". Default 2. */
  threshold?: number
}

/**
 * Gap #2: transborda por sentimento negativo PERSISTENTE.
 *
 * Persistência (default threshold=2) é satisfeita por QUALQUER um:
 *   (a) ≥ threshold mensagens incoming da sessão contêm palavra negativa; OU
 *   (b) já existe a tag `sentimento:negativo` (turno anterior avaliado pelo LLM)
 *       E a mensagem ATUAL também é negativa — ou seja, negatividade em 2 turnos.
 *
 * Uma única reclamação pontual (1 sinal, sem tag prévia) NÃO transborda.
 */
export function shouldHandoffByNegativeSentiment(p: NegativeSentimentParams): boolean {
  if (!p.enabled) return false
  if (p.statusIa === p.shadowStatus) return false
  const threshold = p.threshold ?? 2

  // Junta a mensagem atual à janela, dedupando se ela já estiver lá.
  const texts = (p.sessionIncomingTexts || []).map((t) => (t || '').toLowerCase())
  const cur = (p.currentText || '').toLowerCase()
  if (cur && texts[0] !== cur) texts.unshift(cur)

  // (a) contagem de mensagens negativas na sessão.
  const negTextCount = texts.filter((t) => hasNegativeWord(t)).length
  if (negTextCount >= threshold) return true

  // (b) tag negativa de turno anterior + negatividade no turno atual.
  const hasNegTag = (p.conversationTags || []).some((t) => t.startsWith('sentimento:negativo'))
  if (hasNegTag && hasNegativeWord(cur)) return true

  return false
}
