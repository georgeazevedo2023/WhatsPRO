import { describe, it, expect } from 'vitest'
import { stripLeakedToolCalls } from './dispatchResponse.ts'

describe('stripLeakedToolCalls', () => {
  it('remove vazamento functions.handoff_to_human({...}) mantendo o texto', () => {
    const leaked = 'Já estou passando seu pedido pro vendedor, Carlos!\nfunctions.handoff_to_human({reason: "Lead quer tinta Coral fosca 16L, ambiente interno"})'
    const out = stripLeakedToolCalls(leaked)
    expect(out).toContain('Já estou passando seu pedido pro vendedor, Carlos!')
    expect(out).not.toContain('functions.')
    expect(out).not.toContain('handoff_to_human(')
  })

  it('remove forma sem prefixo functions.', () => {
    const out = stripLeakedToolCalls('Vou buscar pra você! search_products({query: "tinta", category: "tintas"})')
    expect(out).toBe('Vou buscar pra você!')
  })

  it('não toca em texto legítimo com parênteses', () => {
    const legit = 'Temos tinta acrílica (interno) e esmalte (externo). Qual prefere?'
    expect(stripLeakedToolCalls(legit)).toBe(legit)
  })

  it('texto vazio/undefined não quebra', () => {
    expect(stripLeakedToolCalls('')).toBe('')
  })

  it('múltiplos vazamentos', () => {
    const out = stripLeakedToolCalls('Ok! set_tags({tags:["cor:branco"]}) send_carousel({product_ids:["a"]}) pronto')
    expect(out).not.toContain('set_tags(')
    expect(out).not.toContain('send_carousel(')
    expect(out).toContain('Ok!')
    expect(out).toContain('pronto')
  })
})
