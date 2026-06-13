// Verificação do roteamento da nova categoria "motores" (2026-05-30).
// Usa as funções REAIS (buildInteresseRegex + matchCategoryBySearchText) com um
// recorte do config real das instâncias Eletropiso. Prova: motor → motores,
// sem colisão com portas/tintas/fechaduras.
import { describe, it, expect } from 'vitest'
import { matchCategoryBySearchText } from './serviceCategories.ts'

// Ordem espelha o array real (tintas antes de portas; motores no fim).
const cfg = {
  categories: [
    { id: 'tintas', interesse_match: 'tinta|esmalte|verniz', stages: [] },
    { id: 'portas', interesse_match: 'porta|portas', stages: [] },
    { id: 'fechaduras', interesse_match: 'fechadura|fechaduras|trinco|trincos|cadeado|cadeados', stages: [] },
    { id: 'motores', interesse_match: 'motor|motorizado|automatizador|automatizadores|automatizar', stages: [] },
    // deno-lint-ignore no-explicit-any
  ] as any,
}
// deno-lint-ignore no-explicit-any
const cat = (t: string) => matchCategoryBySearchText(t, cfg as any)?.id ?? null

describe('serviceCategories', () => {
  it('motor → motores (caso Cleber)', () => {
    expect(cat('motor para portão')).toEqual('motores')
    expect(cat('motor de portão')).toEqual('motores')
    expect(cat('vocês tem motor de portao?')).toEqual('motores')
    expect(cat('quero automatizar meu portão')).toEqual('motores')
    expect(cat('preciso de um automatizador')).toEqual('motores')
  })

  it('motor NÃO rouba porta de alumínio (porta ≠ portão)', () => {
    expect(cat('tem porta de alumínio?')).toEqual('portas')
  })

  it('motor não cria falso-positivo (motorista/motora)', () => {
    // "motor" é palavra inteira; não casa dentro de "motorista"
    expect(cat('sou motorista, queria uma porta')).toEqual('portas')
  })

  it('tinta para porta segue indo pra tintas (ordem preservada)', () => {
    expect(cat('tinta para porta')).toEqual('tintas')
    expect(cat('verniz para porta')).toEqual('tintas')
  })
})
