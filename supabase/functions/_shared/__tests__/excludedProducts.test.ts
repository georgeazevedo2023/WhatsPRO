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

// Espelha o item de prod "eletrodomesticos" com a lista de exceções aprovada
// (D-mangueira 2026-06-25): keyword "maquina de lavar" exclui o APARELHO, mas
// except_keywords libera acessórios hidráulicos que a loja VENDE.
const SAMPLE_WITH_EXCEPT = [
  {
    id: 'eletrodomesticos',
    keywords: ['geladeira', 'maquina de lavar', 'máquina de lavar', 'fogao', 'fogão', 'lavadora'],
    message: '',
    except_keywords: [
      'mangueira', 'engate', 'cano', 'registro', 'valvula', 'torneira',
      'sifao', 'adaptador', 'abracadeira', 'niple', 'ralo',
      'saida de agua', 'saida da agua',
    ],
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
    expect(r?.message).toBe('Esse não é o nosso forte aqui, mas trabalhamos com outros materiais relacionados. Quer dar uma olhada em algo nessa linha?')
  })

  it('usa fallback quando message vazia', () => {
    const r = matchExcludedProduct('preciso de planejado', SAMPLE_NO_MESSAGE)
    expect(r?.product.id).toBe('mobilia')
    expect(r?.matchedKeyword).toBe('planejado')
    expect(r?.message).toBe('Esse não é o nosso forte aqui, mas trabalhamos com outros materiais relacionados. Quer dar uma olhada em algo nessa linha?')
  })

  it('matchedKeyword preserva case/acento do admin (mesmo com fallback humanizado)', () => {
    const items = [{ id: 'x', keywords: ['Mármore Carrara'], message: '' }]
    const r = matchExcludedProduct('vocês têm marmore carrara?', items)
    expect(r?.matchedKeyword).toBe('Mármore Carrara')
    // sem suggested_categories → fallback genérico humanizado (v7.57.3); a keyword vai pra tag/log, não pro lead
    expect(r?.message).toBe('Esse não é o nosso forte aqui, mas trabalhamos com outros materiais relacionados. Quer dar uma olhada em algo nessa linha?')
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

describe('matchExcludedProduct — except_keywords (suprime recusa de acessório que vendemos)', () => {
  it('CASO REAL DO DONO (com typo "MAGUEIRA"): libera via "saida da agua" → null (não recusa)', () => {
    // texto exato do screenshot, com o typo do lead (MAGUEIRA, sem o "n")
    const r = matchExcludedProduct('MAGUEIRA DE SAIDA DA AGUA DA MAQUINA DE LAVAR', SAMPLE_WITH_EXCEPT)
    expect(r).toBeNull()
  })

  it('libera "mangueira de saída de água da máquina de lavar" (grafia correta) → null', () => {
    const r = matchExcludedProduct('quero uma mangueira de saída de água da máquina de lavar', SAMPLE_WITH_EXCEPT)
    expect(r).toBeNull()
  })

  it('aparelho cru "quero uma máquina de lavar" AINDA recusa (exceção não casa)', () => {
    const r = matchExcludedProduct('quero uma máquina de lavar', SAMPLE_WITH_EXCEPT)
    expect(r?.product.id).toBe('eletrodomesticos')
    // retorna a 1ª keyword da lista que casa (texto normalizado "maquina de lavar")
    expect(r?.matchedKeyword).toBe('maquina de lavar')
  })

  it('aparelho cru "vocês vendem geladeira?" AINDA recusa', () => {
    const r = matchExcludedProduct('vocês vendem geladeira?', SAMPLE_WITH_EXCEPT)
    expect(r?.product.id).toBe('eletrodomesticos')
    expect(r?.matchedKeyword).toBe('geladeira')
  })

  it('exceção é whole-word: "canoa" NÃO dispara a exceção "cano" → geladeira recusa', () => {
    const r = matchExcludedProduct('vendem geladeira? to indo de canoa', SAMPLE_WITH_EXCEPT)
    expect(r?.product.id).toBe('eletrodomesticos')
    expect(r?.matchedKeyword).toBe('geladeira')
  })

  it('exceção é accent-insensitive: "válvula" casa exceção "valvula" → suprime', () => {
    const r = matchExcludedProduct('preciso trocar a válvula que vai no fogão', SAMPLE_WITH_EXCEPT)
    expect(r).toBeNull()
  })

  it('engate da máquina de lavar → null (libera o acessório)', () => {
    const r = matchExcludedProduct('tem engate pra máquina de lavar?', SAMPLE_WITH_EXCEPT)
    expect(r).toBeNull()
  })

  it('backward-compat: item SEM except_keywords se comporta igual ao anterior', () => {
    // SAMPLE não tem except_keywords — match normal preservado
    const r = matchExcludedProduct('tem caixa de correio?', SAMPLE)
    expect(r?.product.id).toBe('caixa_correio')
  })

  it('except_keywords vazio = sem efeito (recusa normal)', () => {
    const items = [{ id: 'a', keywords: ['geladeira'], message: 'm', except_keywords: [] }]
    const r = matchExcludedProduct('quero geladeira', items)
    expect(r?.product.id).toBe('a')
  })
})

describe('buildFallbackMessage', () => {
  it('sem suggested_categories → "outros materiais relacionados" (tom humanizado v7.57.3)', () => {
    expect(buildFallbackMessage('caixa de correio')).toBe(
      'Esse não é o nosso forte aqui, mas trabalhamos com outros materiais relacionados. Quer dar uma olhada em algo nessa linha?',
    )
  })

  it('com suggested_categories → lista as alternativas', () => {
    expect(buildFallbackMessage('climatizador', undefined, ['cabos', 'disjuntores'])).toBe(
      'Esse não é o nosso forte aqui, mas trabalhamos com cabos e disjuntores. Quer dar uma olhada em algo nessa linha?',
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

  it('aceita except_keywords como array de strings', () => {
    expect(
      validateExcludedProducts([
        { id: 'a', keywords: ['x'], except_keywords: ['mangueira', 'cano'] },
      ]),
    ).toEqual([])
  })

  it('aceita schema completo (eletrodomesticos com exceções)', () => {
    expect(validateExcludedProducts(SAMPLE_WITH_EXCEPT)).toEqual([])
  })

  it('rejeita except_keywords não-array', () => {
    const errors = validateExcludedProducts([
      { id: 'a', keywords: ['x'], except_keywords: 'mangueira' },
    ])
    expect(errors.some((e) => e.includes('except_keywords deve ser array'))).toBe(true)
  })

  it('rejeita except_keyword vazia', () => {
    const errors = validateExcludedProducts([
      { id: 'a', keywords: ['x'], except_keywords: ['mangueira', ''] },
    ])
    expect(errors.some((e) => e.includes('except_keywords devem ser strings não-vazias'))).toBe(true)
  })
})
