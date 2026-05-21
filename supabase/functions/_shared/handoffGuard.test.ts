import { describe, it, expect } from 'vitest'
import {
  evaluateHandoffGuard,
  mentionsPaymentTopic,
  shouldBlockHandoffForPayment,
} from './handoffGuard.ts'

describe('evaluateHandoffGuard', () => {
  it('libera handoff quando lead não tem contexto de produto', () => {
    const r = evaluateHandoffGuard({ tags: ['ia:ligada', 'lead_score:5'], toolNamesThisRound: [] })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('no_product_context')
  })

  it('libera handoff quando search_products foi chamado na mesma rodada', () => {
    const r = evaluateHandoffGuard({
      tags: ['produto:arandela', 'interesse:iluminacao'],
      toolNamesThisRound: ['search_products', 'set_tags'],
    })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('searched_this_round')
  })

  it('R124: libera handoff quando search prévia falhou (tag search_fail:N)', () => {
    const r = evaluateHandoffGuard({
      tags: ['produto:arandela', 'interesse:iluminacao', 'search_fail:1'],
      toolNamesThisRound: ['set_tags'],
    })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('searched_before')
  })

  it('R124: libera handoff em múltiplas falhas (search_fail:2)', () => {
    const r = evaluateHandoffGuard({
      tags: ['produto:porcelanato', 'search_fail:2', 'motivo:compra'],
      toolNamesThisRound: [],
    })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('searched_before')
  })

  it('bloqueia handoff quando há produto mas nunca buscou', () => {
    const r = evaluateHandoffGuard({
      tags: ['produto:arandela', 'interesse:iluminacao'],
      toolNamesThisRound: ['set_tags'],
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('blocked_search_required')
  })

  it('bloqueia handoff com tag interesse: sozinha (sem busca)', () => {
    const r = evaluateHandoffGuard({
      tags: ['interesse:iluminacao'],
      toolNamesThisRound: [],
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('blocked_search_required')
  })

  it('bloqueia handoff com tag marca_preferida: sozinha (sem busca)', () => {
    const r = evaluateHandoffGuard({
      tags: ['marca_preferida:eletropiso'],
      toolNamesThisRound: [],
    })
    expect(r.allowed).toBe(false)
  })

  it('repro Bug Carla 2026-05-20: search_fail:1 + produto:arandela → handoff PERMITIDO', () => {
    // Cenário exato dos logs: turn 4 do ai-agent, toolCallsLog reseta a cada invocação,
    // mas search_fail:1 persiste na tag do DB.
    const r = evaluateHandoffGuard({
      tags: ['search_fail:1', 'motivo:compra', 'produto:arandela', 'ia:ligada'],
      toolNamesThisRound: ['set_tags', 'handoff_to_human'],
    })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('searched_before')
  })
})

describe('mentionsPaymentTopic', () => {
  it('match desconto', () => {
    const r = mentionsPaymentTopic('Tem desconto pra mim?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('desconto')
  })

  it('match pix', () => {
    const r = mentionsPaymentTopic('Aceita pix?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('pix')
  })

  it('match parcela', () => {
    const r = mentionsPaymentTopic('Parcela em quantas vezes?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('parcela')
  })

  it('no match em saudação', () => {
    const r = mentionsPaymentTopic('Bom dia')
    expect(r.match).toBe(false)
    expect(r.terms).toEqual([])
  })

  it('no match em intenção genérica', () => {
    const r = mentionsPaymentTopic('Quero comprar')
    expect(r.match).toBe(false)
  })

  it('match boleto', () => {
    const r = mentionsPaymentTopic('Boleto bancario funciona?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('boleto')
  })

  it('match em 2 termos: a vista + desconto', () => {
    const r = mentionsPaymentTopic('À vista tem desconto?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('a vista')
    expect(r.terms).toContain('desconto')
  })

  it('match case-insensitive (DESCONTO maiúsculo)', () => {
    const r = mentionsPaymentTopic('DESCONTO disponivel?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('desconto')
  })

  it('match sem acento: cartao', () => {
    const r = mentionsPaymentTopic('aceita cartao?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('cartao')
  })

  it('match com acento: cartão', () => {
    const r = mentionsPaymentTopic('aceita cartão?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('cartao')
  })

  it('match forma de pagamento (multi-palavra)', () => {
    const r = mentionsPaymentTopic('qual forma de pagamento voces aceitam?')
    expect(r.match).toBe(true)
    expect(r.terms).toContain('forma de pagamento')
  })
})

describe('shouldBlockHandoffForPayment', () => {
  it('bloqueia quando handoffReason cita desconto', () => {
    const r = shouldBlockHandoffForPayment({
      handoffReason: 'Lead perguntou desconto',
      leadText: '',
    })
    expect(r.block).toBe(true)
    expect(r.matchedTerms).toContain('desconto')
    expect(r.message).toMatch(/business_info/)
  })

  it('libera quando handoffReason é frustração/pedido de vendedor', () => {
    const r = shouldBlockHandoffForPayment({
      handoffReason: 'Lead frustrado, quer vendedor',
      leadText: '',
    })
    expect(r.block).toBe(false)
    expect(r.matchedTerms).toEqual([])
    expect(r.message).toBe('')
  })

  it('bloqueia quando leadText cita pix mesmo com reason neutra', () => {
    const r = shouldBlockHandoffForPayment({
      handoffReason: 'Cliente VIP',
      leadText: 'Aceita pix?',
    })
    expect(r.block).toBe(true)
    expect(r.matchedTerms).toContain('pix')
  })

  it('lida com leadText undefined sem crashar', () => {
    const r = shouldBlockHandoffForPayment({
      handoffReason: 'tem boleto?',
    })
    expect(r.block).toBe(true)
    expect(r.matchedTerms).toContain('boleto')
  })
})
