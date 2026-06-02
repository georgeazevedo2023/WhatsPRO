import { describe, it, expect } from 'vitest'
import {
  hasNegativeWord,
  shouldHandoffByConversationMinutes,
  shouldHandoffByNegativeSentiment,
} from './handoffCaps'

const NOW = new Date('2026-06-02T12:00:00Z').getTime()
const minsAgoIso = (n: number) => new Date(NOW - n * 60_000).toISOString()
const SHADOW = 'shadow'

describe('hasNegativeWord', () => {
  it('null/vazio → false', () => {
    expect(hasNegativeWord(null)).toBe(false)
    expect(hasNegativeWord('')).toBe(false)
  })
  it('texto neutro → false', () => {
    expect(hasNegativeWord('tudo certo, obrigado!')).toBe(false)
  })
  it('palavra negativa (case-insensitive) → true', () => {
    expect(hasNegativeWord('que ABSURDO isso')).toBe(true)
    expect(hasNegativeWord('péssimo atendimento')).toBe(true)
  })
})

describe('shouldHandoffByConversationMinutes', () => {
  const base = {
    maxMinutes: 15,
    sessionStartIso: minsAgoIso(20),
    nowMs: NOW,
    statusIa: 'ligada' as string | null,
    shadowStatus: SHADOW,
  }

  it('desligado (0/null) → false', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, maxMinutes: 0 })).toBe(false)
    expect(shouldHandoffByConversationMinutes({ ...base, maxMinutes: null })).toBe(false)
    expect(shouldHandoffByConversationMinutes({ ...base, maxMinutes: undefined })).toBe(false)
  })
  it('já em shadow → false', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, statusIa: SHADOW })).toBe(false)
  })
  it('sem início de sessão → false', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, sessionStartIso: null })).toBe(false)
  })
  it('data inválida → false', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, sessionStartIso: 'xx' })).toBe(false)
  })
  it('duração abaixo do cap → false', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, sessionStartIso: minsAgoIso(10) })).toBe(false)
  })
  it('exatamente no limiar → true', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, sessionStartIso: minsAgoIso(15) })).toBe(true)
  })
  it('acima do cap → true', () => {
    expect(shouldHandoffByConversationMinutes({ ...base, sessionStartIso: minsAgoIso(31) })).toBe(true)
  })
})

describe('shouldHandoffByNegativeSentiment', () => {
  const base = {
    enabled: true,
    statusIa: 'ligada' as string | null,
    shadowStatus: SHADOW,
    sessionIncomingTexts: [] as string[],
    currentText: '',
    conversationTags: [] as string[],
  }

  it('flag desligado → false', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, enabled: false, currentText: 'absurdo isso', sessionIncomingTexts: ['péssimo'],
    })).toBe(false)
  })
  it('já em shadow → false', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, statusIa: SHADOW, currentText: 'absurdo', sessionIncomingTexts: ['péssimo'],
    })).toBe(false)
  })
  it('nenhum sinal negativo → false', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'quero comprar tinta', sessionIncomingTexts: ['oi', 'tudo bem?'],
    })).toBe(false)
  })
  it('1 sinal pontual (sem tag prévia) → false', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'que demora hein', sessionIncomingTexts: ['oi'],
    })).toBe(false)
  })
  it('2 mensagens negativas na sessão → true', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'isso é um absurdo', sessionIncomingTexts: ['péssimo atendimento', 'oi'],
    })).toBe(true)
  })
  it('tag sentimento:negativo prévia + atual negativa → true', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'continua a demora', conversationTags: ['sentimento:negativo', 'interesse:tintas'],
    })).toBe(true)
  })
  it('tag negativa prévia mas atual NÃO negativa → false (pode ter acalmado)', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'ok, obrigado', conversationTags: ['sentimento:negativo'],
    })).toBe(false)
  })
  it('dedupe: msg atual já na lista, 1 negativa só → false', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, currentText: 'que absurdo', sessionIncomingTexts: ['que absurdo', 'oi'],
    })).toBe(false)
  })
  it('threshold custom 1 + 1 sinal → true', () => {
    expect(shouldHandoffByNegativeSentiment({
      ...base, threshold: 1, currentText: 'péssimo', sessionIncomingTexts: [],
    })).toBe(true)
  })
})
