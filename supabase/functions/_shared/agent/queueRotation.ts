// =============================================================================
// queueRotation — guardas determinísticas da fila de transbordo (requeue-conversations)
//
// Nascido do incidente 2026-05-30: 114 conversas presas em rotação INFINITA
// (rotation_number até 293, ~4.7k eventos/24h) porque o Case E do requeue
// alertava o gestor mas "SEGUIA atribuindo" pra sempre. Sintoma visível: a
// mensagem `handoff_message_outside_hours` reenviada TODO dia (1 por evento novo,
// e a rotação criava um evento novo a cada ~10min).
//
// Duas decisões PURAS (sem I/O) — fáceis de testar e reaproveitar:
//   1. shouldStopRotation  — quando parar de rotacionar (parquear a conversa).
//   2. decideOutOfHoursSend — quando (não) reenviar a OOF pro lead.
// =============================================================================

/**
 * Quantas VOLTAS completas pela lista de elegíveis a fila tenta antes de parquear.
 * 2 voltas: deu o benefício da dúvida (todo mundo, duas vezes) e ninguém pegou →
 * claramente abandonado. Com 16 elegíveis = parar em rotação 32 (~5h a 10min/rot).
 */
export const MAX_FULL_LOOPS = 2

/**
 * Para a rotação quando a conversa já passou MAX_FULL_LOOPS vezes por TODOS os
 * atendentes elegíveis sem ninguém responder. Evita o runaway (293 rotações reais).
 *
 * Parquear NÃO perde a conversa: ela continua atribuída ao último atendente e
 * visível no helpdesk; a PRÓXIMA mensagem do lead reacende o handoff via
 * pré-router do ai-agent. Só interrompe o cron de re-criar eventos pra sempre.
 *
 * eligibleCount <= 0 → false: aí o caminho `no_eligible` (sino "fila esgotada")
 * já cuida; não é trabalho desta guarda.
 */
export function shouldStopRotation(opts: { rotationNumber: number; eligibleCount: number }): boolean {
  const rot = Number(opts.rotationNumber) || 0
  const elig = Number(opts.eligibleCount) || 0
  if (elig <= 0) return false
  return rot >= elig * MAX_FULL_LOOPS
}

/**
 * A OOF ("estamos fora de horário, já te encaminho…") só deve ir se o lead está
 * ESPERANDO uma resposta fora do horário — não se está apenas IDLE na fila.
 *
 * Bug 5a (2026-06-01, decisão do dono): "atende normal, não avisa fora-horário". Um
 * lead que entrou na fila DENTRO do horário e não mandou mais nada quando o expediente
 * fechou NÃO deve receber "estamos fora do horário" não-solicitado — ele não está
 * esperando resposta agora; só pausamos o cursor. A OOF vai apenas pra quem mandou
 * mensagem nova DEPOIS de entrar na fila (aí sim está aguardando e o aviso é apropriado).
 *
 * Também mantém a dedup do incidente 2026-05-30: não re-spammar quem já foi avisado.
 *
 * Timestamps em ms desde epoch; null = ausente.
 *   - lead nunca falou após entrar na fila (lastIn <= queueEnteredAt) → IDLE → NÃO envia.
 *   - lastOofAtMs null + lead falou após entrar → ENVIA (1ª vez, está esperando).
 *   - lastOofAtMs set + incoming > última OOF → lead insistiu → pode reenviar.
 *   - lastOofAtMs set + sem incoming novo → já avisado, NÃO repete.
 */
export function decideOutOfHoursSend(opts: {
  lastOofAtMs: number | null
  lastIncomingAtMs: number | null
  /** quando o lead entrou na fila de transbordo (handoff_queue_events.created_at) */
  queueEnteredAtMs?: number | null
}): boolean {
  const lastIn = opts.lastIncomingAtMs
  const enteredAt = opts.queueEnteredAtMs
  // Idle na fila: nunca falou depois de entrar → não avisa (Bug 5a).
  if (enteredAt != null) {
    if (lastIn == null || lastIn <= enteredAt) return false
  }
  const lastOof = opts.lastOofAtMs
  if (lastOof == null) return true
  if (lastIn == null) return false
  return lastIn > lastOof
}
