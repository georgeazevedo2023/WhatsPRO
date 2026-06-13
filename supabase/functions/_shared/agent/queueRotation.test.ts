import { describe, it, expect } from 'vitest'
import { decideOutOfHoursSend, MAX_FULL_LOOPS, shouldStopRotation } from './queueRotation.ts'

describe('queueRotation', () => {
  // ─── shouldStopRotation ──────────────────────────────────────────────────────

  it('shouldStopRotation: não para antes de completar as voltas', () => {
    expect(shouldStopRotation({ rotationNumber: 0, eligibleCount: 16 })).toEqual(false)
    expect(shouldStopRotation({ rotationNumber: 16, eligibleCount: 16 })).toEqual(false) // 1 volta
    expect(shouldStopRotation({ rotationNumber: 31, eligibleCount: 16 })).toEqual(false) // < 2 voltas
  })

  it('shouldStopRotation: para ao atingir MAX_FULL_LOOPS voltas', () => {
    expect(shouldStopRotation({ rotationNumber: 32, eligibleCount: 16 })).toEqual(true) // == 2 voltas
    expect(shouldStopRotation({ rotationNumber: 293, eligibleCount: 16 })).toEqual(true) // runaway real
  })

  it('shouldStopRotation: dept de 1 atendente para em MAX_FULL_LOOPS', () => {
    expect(shouldStopRotation({ rotationNumber: MAX_FULL_LOOPS - 1, eligibleCount: 1 })).toEqual(false)
    expect(shouldStopRotation({ rotationNumber: MAX_FULL_LOOPS, eligibleCount: 1 })).toEqual(true)
  })

  it('shouldStopRotation: sem elegíveis → false (outro caminho cuida)', () => {
    expect(shouldStopRotation({ rotationNumber: 999, eligibleCount: 0 })).toEqual(false)
    expect(shouldStopRotation({ rotationNumber: 999, eligibleCount: -1 })).toEqual(false)
  })

  it('shouldStopRotation: valores inválidos não quebram', () => {
    expect(shouldStopRotation({ rotationNumber: NaN, eligibleCount: 16 })).toEqual(false)
    expect(shouldStopRotation({ rotationNumber: 50, eligibleCount: NaN })).toEqual(false)
  })

  // ─── decideOutOfHoursSend ────────────────────────────────────────────────────

  it('decideOutOfHoursSend: nunca avisado → envia', () => {
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: null })).toEqual(true)
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: 1000 })).toEqual(true)
  })

  it('decideOutOfHoursSend: já avisado e lead sumiu → NÃO repete (o bug)', () => {
    // caso real: OOF enviada, lead não voltou a falar → cron NÃO deve re-spammar
    expect(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: null })).toEqual(false)
    expect(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 4000 })).toEqual(false) // incoming ANTES
    expect(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 5000 })).toEqual(false) // empate
  })

  it('decideOutOfHoursSend: lead voltou a falar após a OOF → pode reenviar', () => {
    expect(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 6000 })).toEqual(true)
  })

  // ─── decideOutOfHoursSend: Bug 5a (idle na fila não recebe OOF) ──────────────

  it('Bug5a: idle na fila (nunca falou após entrar) → NÃO envia OOF', () => {
    // lead entrou na fila em t=1000, nunca mandou msg depois (lastIn null ou <= entered)
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: null, queueEnteredAtMs: 1000 })).toEqual(false)
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: 900, queueEnteredAtMs: 1000 })).toEqual(false)
  })

  it('Bug5a: lead falou DEPOIS de entrar na fila → ENVIA (1ª vez)', () => {
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: 2000, queueEnteredAtMs: 1000 })).toEqual(true)
  })

  it('Bug5a: lead insistiu após OOF → reenvia; sem msg nova → não repete', () => {
    // entrou 1000, falou 2000 (>entrada), OOF 2500, falou de novo 3000 → reenvia
    expect(decideOutOfHoursSend({ lastOofAtMs: 2500, lastIncomingAtMs: 3000, queueEnteredAtMs: 1000 })).toEqual(true)
    // entrou 1000, falou 2000, OOF 2500, sem msg nova → não repete
    expect(decideOutOfHoursSend({ lastOofAtMs: 2500, lastIncomingAtMs: 2000, queueEnteredAtMs: 1000 })).toEqual(false)
  })

  it('Bug5a: sem queueEnteredAtMs → comportamento antigo preservado (dedup)', () => {
    expect(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: null })).toEqual(true)
    expect(decideOutOfHoursSend({ lastOofAtMs: 100, lastIncomingAtMs: null })).toEqual(false)
    expect(decideOutOfHoursSend({ lastOofAtMs: 100, lastIncomingAtMs: 200 })).toEqual(true)
  })
})
