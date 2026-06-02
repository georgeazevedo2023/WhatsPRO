import { describe, it, expect } from 'vitest'
import {
  decideAbandonStage,
  looksLikeConversationClosed,
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

describe('decideAbandonStage — T2 inatividade genérica 2 estágios (v7.65.1)', () => {
  // base SEM tag pendente: T1 não dispara; só T2 manda. Cutucada 3min, handoff +3.
  const t2 = {
    nudgeAfterMin: 5,
    handoffAfterMin: 10,
    lastBotMessageAt: minsAgo(4),
    nudgedAtMs: null as number | null,
    leadRepliedSinceBot: false,
    now: NOW,
    pendingEnabled: false,
    hasPendingTag: false,
    inactivityEnabled: true,
    inactivityNudgeAfterMin: 3,
    inactivityHandoffAfterMin: 3,
    leadEverReplied: true,
    conversationClosed: false,
  }

  it('estágio 1: interagiu, silêncio >= 3min, não encerrou, não cutucado → nudge', () => {
    expect(decideAbandonStage(t2)).toBe('nudge')
  })

  it('estágio 1: exatamente no limiar (3min) → nudge', () => {
    expect(decideAbandonStage({ ...t2, lastBotMessageAt: minsAgo(3) })).toBe('nudge')
  })

  it('estágio 1: silêncio < 3min → none', () => {
    expect(decideAbandonStage({ ...t2, lastBotMessageAt: minsAgo(2) })).toBe('none')
  })

  it('estágio 2: cutucado há >= 3min → handoff (total 6min)', () => {
    expect(decideAbandonStage({ ...t2, nudgedAtMs: minsAgoMs(3) })).toBe('handoff')
  })

  it('estágio 2: cutucado há < 3min → none', () => {
    expect(decideAbandonStage({ ...t2, nudgedAtMs: minsAgoMs(2) })).toBe('none')
  })

  it('lead nunca respondeu (não interagiu) → none', () => {
    expect(decideAbandonStage({ ...t2, leadEverReplied: false })).toBe('none')
  })

  it('conversa encerrada (despedida) → none', () => {
    expect(decideAbandonStage({ ...t2, conversationClosed: true })).toBe('none')
  })

  it('flag de inatividade desligada → none', () => {
    expect(decideAbandonStage({ ...t2, inactivityEnabled: false })).toBe('none')
  })

  it('lead respondeu após o bot → none (timeline abortada)', () => {
    expect(decideAbandonStage({ ...t2, leadRepliedSinceBot: true })).toBe('none')
  })

  it('inactivityNudgeAfterMin = 0 (defensivo) → none', () => {
    expect(decideAbandonStage({ ...t2, inactivityNudgeAfterMin: 0 })).toBe('none')
  })

  it('precedência: lead PENDENTE com ambas flags usa os limiares do T2 (cutuca aos 3, não aos 5)', () => {
    expect(decideAbandonStage({
      ...t2,
      pendingEnabled: true,
      hasPendingTag: true,
      lastBotMessageAt: minsAgo(3),
    })).toBe('nudge')
  })

  it('só pendente (inatividade OFF) mantém o nudge de 5min', () => {
    expect(decideAbandonStage({
      ...t2,
      inactivityEnabled: false,
      pendingEnabled: true,
      hasPendingTag: true,
      lastBotMessageAt: minsAgo(6),
    })).toBe('nudge')
  })
})

describe('looksLikeConversationClosed', () => {
  it('despedidas claras → true', () => {
    expect(looksLikeConversationClosed('obrigado!')).toBe(true)
    expect(looksLikeConversationClosed('valeu, tchau')).toBe(true)
    expect(looksLikeConversationClosed('vou pensar e te falo depois')).toBe(true)
    expect(looksLikeConversationClosed('blz 👍')).toBe(true)
    expect(looksLikeConversationClosed('ok')).toBe(true)
  })

  it('pergunta/pedido → false (ainda engajado)', () => {
    expect(looksLikeConversationClosed('obrigado, e vc tem na cor branca?')).toBe(false)
    expect(looksLikeConversationClosed('valeu! qual o preço?')).toBe(false)
  })

  it('mensagem longa com conteúdo → false', () => {
    expect(looksLikeConversationClosed(
      'obrigado pela ajuda mas ainda preciso de um orçamento detalhado com prazo de entrega',
    )).toBe(false)
  })

  it('vazio/nulo → false', () => {
    expect(looksLikeConversationClosed('')).toBe(false)
    expect(looksLikeConversationClosed(null)).toBe(false)
    expect(looksLikeConversationClosed(undefined)).toBe(false)
  })

  it('pedido real não é encerramento', () => {
    expect(looksLikeConversationClosed('quero a porta sanfonada de 80cm')).toBe(false)
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
