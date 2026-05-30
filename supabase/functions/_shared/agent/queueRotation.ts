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
 * A OOF ("estamos fora de horário, já te encaminho…") só deve ir se o lead mandou
 * mensagem DEPOIS da última OOF — ou se nunca recebeu nenhuma. Impede o reenvio
 * diário pra quem não voltou a falar (o motor da rotação criava evento novo, com
 * a flag `out_of_hours_msg_sent` zerada, e re-spammava o mesmo lead todo dia).
 *
 * Timestamps em ms desde epoch; null = ausente.
 *   - lastOofAtMs null            → nunca avisado → ENVIA.
 *   - lastOofAtMs set, sem incoming→ já avisado, lead nunca falou depois → NÃO repete.
 *   - incoming > última OOF       → lead voltou a falar após o aviso → pode reenviar.
 */
export function decideOutOfHoursSend(opts: {
  lastOofAtMs: number | null
  lastIncomingAtMs: number | null
}): boolean {
  const lastOof = opts.lastOofAtMs
  if (lastOof == null) return true
  const lastIn = opts.lastIncomingAtMs
  if (lastIn == null) return false
  return lastIn > lastOof
}
