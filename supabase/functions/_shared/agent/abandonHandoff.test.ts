import { describe, it, expect } from 'vitest'
import {
  decideAbandonStage,
  parseNudgedAtMs,
  parsePendingTrigger,
  personalizeNudge,
  DEFAULT_NUDGE_MESSAGE,
} from './abandonHandoff'

const NOW = new Date('2026-05-26T12:00:00Z').getTime()
const minsAgo = (n: number) => new Date(NOW - n * 60_000).toISOString()
const minsAgoMs = (n: number) => NOW - n * 60_000

describe('decideAbandonStage', () => {
  const base = {
    nudgeAfterMin: 5,
    handoffAfterMin: 10,
    lastBotMessageAt: minsAgo(6),
    nudgedAtMs: null as number | null,
    leadRepliedSinceBot: false,
    now: NOW,
  }

  it('lead respondeu → none (timeline abortada)', () => {
    expect(decideAbandonStage({ ...base, leadRepliedSinceBot: true })).toBe('none')
  })

  it('estágio 1: bot falou há menos do nudge → none', () => {
    expect(decideAbandonStage({ ...base, lastBotMessageAt: minsAgo(3) })).toBe('none')
  })

  it('estágio 1: bot falou há >= nudge e ainda não cutucou → nudge', () => {
    expect(decideAbandonStage({ ...base, lastBotMessageAt: minsAgo(6) })).toBe('nudge')
  })

  it('estágio 1: exatamente no limiar → nudge', () => {
    expect(decideAbandonStage({ ...base, lastBotMessageAt: minsAgo(5) })).toBe('nudge')
  })

  it('estágio 2: já cutucou mas faz menos que handoffAfter → none', () => {
    expect(decideAbandonStage({ ...base, nudgedAtMs: minsAgoMs(4) })).toBe('none')
  })

  it('estágio 2: já cutucou e passou handoffAfter → handoff', () => {
    expect(decideAbandonStage({ ...base, nudgedAtMs: minsAgoMs(11) })).toBe('handoff')
  })

  it('estágio 2: lead respondeu depois da cutucada → none', () => {
    expect(decideAbandonStage({ ...base, nudgedAtMs: minsAgoMs(11), leadRepliedSinceBot: true })).toBe('none')
  })

  it('config zerada desliga o estágio (defensivo)', () => {
    expect(decideAbandonStage({ ...base, nudgeAfterMin: 0 })).toBe('none')
    expect(decideAbandonStage({ ...base, nudgedAtMs: minsAgoMs(99), handoffAfterMin: 0 })).toBe('none')
  })

  it('timestamps inválidos → none', () => {
    expect(decideAbandonStage({ ...base, lastBotMessageAt: 'lixo' })).toBe('none')
    expect(decideAbandonStage({ ...base, lastBotMessageAt: null })).toBe('none')
    expect(decideAbandonStage({ ...base, nudgedAtMs: NaN })).toBe('none')
  })
})

describe('parseNudgedAtMs', () => {
  it('extrai o epoch da tag', () => {
    expect(parseNudgedAtMs(['x', `abandon_nudged:${NOW}`, 'y'])).toBe(NOW)
  })
  it('ausente → null', () => {
    expect(parseNudgedAtMs(['seller_handoff_pending:tinta'])).toBeNull()
    expect(parseNudgedAtMs(null)).toBeNull()
  })
  it('valor inválido → null', () => {
    expect(parseNudgedAtMs(['abandon_nudged:abc'])).toBeNull()
    expect(parseNudgedAtMs(['abandon_nudged:0'])).toBeNull()
  })
})

describe('parsePendingTrigger', () => {
  it('extrai a categoria legível (underscore → espaço)', () => {
    expect(parsePendingTrigger(['seller_handoff_pending:porta_sanfonada_80cm'])).toBe('porta sanfonada 80cm')
  })
  it('sem tag → fallback', () => {
    expect(parsePendingTrigger(['ia:ligada'])).toBe('consulta de produto')
    expect(parsePendingTrigger(null)).toBe('consulta de produto')
  })
  it('tag vazia → fallback', () => {
    expect(parsePendingTrigger(['seller_handoff_pending:'])).toBe('consulta de produto')
  })
})

describe('personalizeNudge', () => {
  it('prefixa o primeiro nome e baixa a inicial', () => {
    expect(personalizeNudge('Ainda tá por aí?', 'Eduarda Silva')).toBe('Eduarda, ainda tá por aí?')
  })
  it('sem nome → mensagem intacta', () => {
    expect(personalizeNudge('Ainda tá por aí?', null)).toBe('Ainda tá por aí?')
    expect(personalizeNudge('Ainda tá por aí?', '   ')).toBe('Ainda tá por aí?')
  })
  it('não duplica se já começa com o nome', () => {
    expect(personalizeNudge('Eduarda, ainda tá por aí?', 'Eduarda')).toBe('Eduarda, ainda tá por aí?')
  })
  it('default tem texto', () => {
    expect(DEFAULT_NUDGE_MESSAGE).toContain('vendedor')
  })
})
