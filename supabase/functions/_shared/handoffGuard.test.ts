import { describe, it, expect } from 'vitest'
import { evaluateHandoffGuard } from './handoffGuard.ts'

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
