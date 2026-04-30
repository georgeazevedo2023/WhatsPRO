import { describe, it, expect } from 'vitest'
import {
  matchExcludedProduct,
  validateExcludedProducts,
  buildFallbackMessage,
} from '../excludedProducts.ts'

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

const SAMPLE_NO_MESSAGE = [
  {
    id: 'jardinagem',
    keywords: ['jardinagem', 'planta', 'vaso de planta'],
    // sem message — usa fallback
  },
  {
    id: 'mobilia',
    keywords: ['móveis planejados', 'planejado'],
    message: '', // vazio — usa fallback
  },
]

describe('matchExcludedProduct', () => {
  it('match exato em palavra-inteira retorna product+keyword+message', () => {
    const r = matchExcludedProduct('Boa tarde, tem caixa de correio?', SAMPLE)
    expect(r?.product.id).toBe('caixa_correio')
    expect(r?.matchedKeyword).toBe('caixa de correio')
    expect(r?.message).toBe('Não trabalhamos com caixa de correio.')
  })

  it('match case-insensitive', () => {
    const r = matchExcludedProduct('CORREIO?', SAMPLE)
    expect(r?.product.id).toBe('caixa_correio')
    expect(r?.matchedKeyword).toBe('correio')
  })

  it('match com acentos diferentes', () => {
    const r = matchExcludedProduct('vocês têm ar-condicionado?', SAMPLE)
    expect(r?.product.id).toBe('ar_condicionado')
  })

  it('match com sinônimo da lista', () => {
    const r = matchExcludedProduct('precisava de climatizador', SAMPLE)
    expect(r?.product.id).toBe('ar_condicionado')
    expect(r?.matchedKeyword).toBe('climatizador')
  })

  it('NÃO casa palavra parcial (correios ≠ correio)', () => {
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
    expect(r?.product.id).toBe('a')
  })

  it('ignora item com keywords vazias', () => {
    const items = [
      { id: 'a', keywords: [], message: 'A' },
      { id: 'b', keywords: ['correio'], message: 'B' },
    ]
    const r = matchExcludedProduct('caixa de correio', items)
    expect(r?.product.id).toBe('b')
  })

  it('usa fallback quando message ausente', () => {
    const r = matchExcludedProduct('quero jardinagem', SAMPLE_NO_MESSAGE)
    expect(r?.product.id).toBe('jardinagem')
    expect(r?.matchedKeyword).toBe('jardinagem')
    expect(r?.message).toBe('Não trabalhamos com jardinagem, posso te ajudar com outro produto?')
  })

  it('usa fallback quando message vazia', () => {
    const r = matchExcludedProduct('preciso de planejado', SAMPLE_NO_MESSAGE)
    expect(r?.product.id).toBe('mobilia')
    expect(r?.matchedKeyword).toBe('planejado')
    expect(r?.message).toBe('Não trabalhamos com planejado, posso te ajudar com outro produto?')
  })

  it('fallback usa keyword ORIGINAL (com case/acento do admin)', () => {
    const items = [{ id: 'x', keywords: ['Mármore Carrara'], message: '' }]
    const r = matchExcludedProduct('vocês têm marmore carrara?', items)
    expect(r?.matchedKeyword).toBe('Mármore Carrara')
    expect(r?.message).toBe('Não trabalhamos com Mármore Carrara, posso te ajudar com outro produto?')
  })

  it('respeita message customizada quando preenchida', () => {
    const items = [
      {
        id: 'x',
        keywords: ['planejado'],
        message: 'Não fazemos planejados, mas temos materiais (parafuso, dobradiça).',
      },
    ]
    const r = matchExcludedProduct('preciso de planejado', items)
    expect(r?.message).toBe('Não fazemos planejados, mas temos materiais (parafuso, dobradiça).')
  })
})

describe('buildFallbackMessage', () => {
  it('formata frase padrão com a keyword', () => {
    expect(buildFallbackMessage('caixa de correio')).toBe(
      'Não trabalhamos com caixa de correio, posso te ajudar com outro produto?',
    )
  })
})

describe('validateExcludedProducts', () => {
  it('valida schema correto', () => {
    expect(validateExcludedProducts(SAMPLE)).toEqual([])
  })

  it('aceita schema sem message (usa fallback runtime)', () => {
    expect(validateExcludedProducts(SAMPLE_NO_MESSAGE)).toEqual([])
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

  it('aceita message vazia (fallback runtime)', () => {
    expect(validateExcludedProducts([{ id: 'a', keywords: ['x'], message: '' }])).toEqual([])
  })

  it('aceita message ausente (fallback runtime)', () => {
    expect(validateExcludedProducts([{ id: 'a', keywords: ['x'] }])).toEqual([])
  })

  it('rejeita message não-string', () => {
    const errors = validateExcludedProducts([{ id: 'a', keywords: ['x'], message: 123 }])
    expect(errors.some((e) => e.includes('message deve ser string'))).toBe(true)
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
