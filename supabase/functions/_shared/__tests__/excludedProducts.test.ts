import { describe, it, expect } from 'vitest'
import { matchExcludedProduct, validateExcludedProducts } from '../excludedProducts.ts'

const SAMPLE = [
  {
    id: 'caixa_correio',
    keywords: ['caixa de correio', 'correio'],
    message: 'Não trabalhamos com caixa de correio.',
  },
  {
    id: 'ar_condicionado',
    keywords: ['ar condicionado', 'ar-condicionado', 'climatizador'],
    message: 'Não fazemos climatização.',
    suggested_categories: ['cabos', 'disjuntores'],
  },
]

describe('matchExcludedProduct', () => {
  it('match exato em palavra-inteira', () => {
    const r = matchExcludedProduct('Boa tarde, tem caixa de correio?', SAMPLE)
    expect(r?.id).toBe('caixa_correio')
  })

  it('match case-insensitive', () => {
    const r = matchExcludedProduct('CORREIO?', SAMPLE)
    expect(r?.id).toBe('caixa_correio')
  })

  it('match com acentos diferentes', () => {
    const r = matchExcludedProduct('vocês têm ar-condicionado?', SAMPLE)
    expect(r?.id).toBe('ar_condicionado')
  })

  it('match com sinônimo da lista', () => {
    const r = matchExcludedProduct('precisava de climatizador', SAMPLE)
    expect(r?.id).toBe('ar_condicionado')
  })

  it('NÃO casa palavra parcial (correios ≠ correio se boundary)', () => {
    // "correios" tem boundary diferente — passa porque \bcorreios\b match \bcorreio\b? Não, regex \b requer fim de palavra
    // Note: \bcorreio\b matches "correio" mas NÃO "correios" (pois s vem depois sem boundary)
    const r = matchExcludedProduct('vou aos correios pegar uma encomenda', SAMPLE)
    expect(r).toBeNull()
  })

  it('retorna null em texto sem match', () => {
    const r = matchExcludedProduct('quero comprar tinta branca', SAMPLE)
    expect(r).toBeNull()
  })

  it('retorna null com lista vazia', () => {
    expect(matchExcludedProduct('caixa de correio', [])).toBeNull()
    expect(matchExcludedProduct('caixa de correio', null)).toBeNull()
    expect(matchExcludedProduct('caixa de correio', undefined)).toBeNull()
  })

  it('retorna null em texto vazio', () => {
    expect(matchExcludedProduct('', SAMPLE)).toBeNull()
    expect(matchExcludedProduct('   ', SAMPLE)).toBeNull()
  })

  it('retorna primeiro match (ordem da lista)', () => {
    const items = [
      { id: 'a', keywords: ['xyz'], message: 'A' },
      { id: 'b', keywords: ['abc'], message: 'B' },
    ]
    const r = matchExcludedProduct('quero xyz e abc', items)
    expect(r?.id).toBe('a')
  })

  it('ignora item com keywords vazias', () => {
    const items = [
      { id: 'a', keywords: [], message: 'A' },
      { id: 'b', keywords: ['correio'], message: 'B' },
    ]
    const r = matchExcludedProduct('caixa de correio', items)
    expect(r?.id).toBe('b')
  })
})

describe('validateExcludedProducts', () => {
  it('valida schema correto', () => {
    expect(validateExcludedProducts(SAMPLE)).toEqual([])
  })

  it('rejeita não-array', () => {
    expect(validateExcludedProducts({ foo: 1 })).toContain('excluded_products deve ser array')
  })

  it('rejeita item sem id', () => {
    const errors = validateExcludedProducts([{ keywords: ['x'], message: 'm' }])
    expect(errors.some((e) => e.includes('id obrigatório'))).toBe(true)
  })

  it('rejeita id duplicado', () => {
    const errors = validateExcludedProducts([
      { id: 'a', keywords: ['x'], message: 'm' },
      { id: 'a', keywords: ['y'], message: 'n' },
    ])
    expect(errors.some((e) => e.includes('duplicado'))).toBe(true)
  })

  it('rejeita keywords vazio', () => {
    const errors = validateExcludedProducts([{ id: 'a', keywords: [], message: 'm' }])
    expect(errors.some((e) => e.includes('keywords obrigatório'))).toBe(true)
  })

  it('rejeita message vazia', () => {
    const errors = validateExcludedProducts([{ id: 'a', keywords: ['x'], message: '' }])
    expect(errors.some((e) => e.includes('message obrigatório'))).toBe(true)
  })

  it('rejeita keyword não-string', () => {
    const errors = validateExcludedProducts([{ id: 'a', keywords: [123], message: 'm' }])
    expect(errors.some((e) => e.includes('keywords devem ser strings'))).toBe(true)
  })

  it('aceita suggested_categories como array', () => {
    expect(
      validateExcludedProducts([
        { id: 'a', keywords: ['x'], message: 'm', suggested_categories: ['cat1'] },
      ]),
    ).toEqual([])
  })

  it('rejeita suggested_categories não-array', () => {
    const errors = validateExcludedProducts([
      { id: 'a', keywords: ['x'], message: 'm', suggested_categories: 'cat1' },
    ])
    expect(errors.some((e) => e.includes('suggested_categories deve ser array'))).toBe(true)
  })
})
