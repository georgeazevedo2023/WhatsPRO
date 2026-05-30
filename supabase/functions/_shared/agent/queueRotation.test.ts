import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { decideOutOfHoursSend, MAX_FULL_LOOPS, shouldStopRotation } from './queueRotation.ts'

// ─── shouldStopRotation ──────────────────────────────────────────────────────

Deno.test('shouldStopRotation: não para antes de completar as voltas', () => {
  assertEquals(shouldStopRotation({ rotationNumber: 0, eligibleCount: 16 }), false)
  assertEquals(shouldStopRotation({ rotationNumber: 16, eligibleCount: 16 }), false) // 1 volta
  assertEquals(shouldStopRotation({ rotationNumber: 31, eligibleCount: 16 }), false) // < 2 voltas
})

Deno.test('shouldStopRotation: para ao atingir MAX_FULL_LOOPS voltas', () => {
  assertEquals(shouldStopRotation({ rotationNumber: 32, eligibleCount: 16 }), true) // == 2 voltas
  assertEquals(shouldStopRotation({ rotationNumber: 293, eligibleCount: 16 }), true) // runaway real
})

Deno.test('shouldStopRotation: dept de 1 atendente para em MAX_FULL_LOOPS', () => {
  assertEquals(shouldStopRotation({ rotationNumber: MAX_FULL_LOOPS - 1, eligibleCount: 1 }), false)
  assertEquals(shouldStopRotation({ rotationNumber: MAX_FULL_LOOPS, eligibleCount: 1 }), true)
})

Deno.test('shouldStopRotation: sem elegíveis → false (outro caminho cuida)', () => {
  assertEquals(shouldStopRotation({ rotationNumber: 999, eligibleCount: 0 }), false)
  assertEquals(shouldStopRotation({ rotationNumber: 999, eligibleCount: -1 }), false)
})

Deno.test('shouldStopRotation: valores inválidos não quebram', () => {
  assertEquals(shouldStopRotation({ rotationNumber: NaN, eligibleCount: 16 }), false)
  assertEquals(shouldStopRotation({ rotationNumber: 50, eligibleCount: NaN }), false)
})

// ─── decideOutOfHoursSend ────────────────────────────────────────────────────

Deno.test('decideOutOfHoursSend: nunca avisado → envia', () => {
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: null }), true)
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: null, lastIncomingAtMs: 1000 }), true)
})

Deno.test('decideOutOfHoursSend: já avisado e lead sumiu → NÃO repete (o bug)', () => {
  // caso real: OOF enviada, lead não voltou a falar → cron NÃO deve re-spammar
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: null }), false)
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 4000 }), false) // incoming ANTES
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 5000 }), false) // empate
})

Deno.test('decideOutOfHoursSend: lead voltou a falar após a OOF → pode reenviar', () => {
  assertEquals(decideOutOfHoursSend({ lastOofAtMs: 5000, lastIncomingAtMs: 6000 }), true)
})
