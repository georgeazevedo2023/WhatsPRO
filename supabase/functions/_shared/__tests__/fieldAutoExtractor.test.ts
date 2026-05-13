import { describe, it, expect } from 'vitest'
import { autoExtractFields, parseExamples, flattenCategoryFields } from '../fieldAutoExtractor.ts'
import type { QualificationField } from '../serviceCategories.ts'

const TINTAS_FIELDS: QualificationField[] = [
  { key: 'ambiente', label: 'ambiente', examples: 'interno ou externo', priority: 1, score_value: 15 },
  { key: 'tipo_tinta', label: 'tipo de tinta', examples: 'acrílica, esmalte sintético, epóxi', priority: 2, score_value: 10 },
  { key: 'cor', label: 'cor', examples: 'branco, cinza, etc.', priority: 3, score_value: 15 },
  { key: 'acabamento', label: 'acabamento', examples: 'fosco, acetinado, brilho, semibrilho', priority: 4, score_value: 20 },
  { key: 'marca_preferida', label: 'marca preferida', examples: 'Coral, Suvinil', priority: 5, score_value: 20 },
  { key: 'quantidade', label: 'quantidade', examples: 'litros ou galões', priority: 6, score_value: 15 },
]

describe('parseExamples', () => {
  it('splita por vírgula', () => {
    expect(parseExamples('acrílica, esmalte sintético, epóxi')).toEqual([
      'acrílica',
      'esmalte sintético',
      'epóxi',
    ])
  })

  it('trata "ou" como separador', () => {
    expect(parseExamples('interno ou externo')).toEqual(['interno', 'externo'])
  })

  it('remove etc. final', () => {
    expect(parseExamples('branco, cinza, etc.')).toEqual(['branco', 'cinza'])
  })

  it('remove conteúdo entre parênteses', () => {
    expect(parseExamples('instalação predial (tomada, lâmpada) ou força')).toEqual([
      'instalação predial',
      'força',
    ])
  })

  it('descarta tokens < 3 chars', () => {
    expect(parseExamples('a, bc, def, ghij')).toEqual(['def', 'ghij'])
  })

  it('retorna array vazio para null/undefined/vazio', () => {
    expect(parseExamples(null)).toEqual([])
    expect(parseExamples(undefined)).toEqual([])
    expect(parseExamples('')).toEqual([])
  })
})

describe('autoExtractFields — casos positivos', () => {
  it('detecta tipo + acabamento na 1ª msg ("Tem tinta acrílica fosco?")', () => {
    const r = autoExtractFields('Tem tinta acrílica fosco?', TINTAS_FIELDS)
    const keys = r.map((x) => x.key).sort()
    expect(keys).toContain('tipo_tinta')
    expect(keys).toContain('acabamento')
  })

  it('detecta ambiente', () => {
    const r = autoExtractFields('Preciso de tinta para ambiente externo', TINTAS_FIELDS)
    const amb = r.find((x) => x.key === 'ambiente')
    expect(amb).toBeDefined()
    expect(amb!.value).toBe('externo')
  })

  it('detecta marca Coral case-insensitive', () => {
    const r = autoExtractFields('quero coral fosco', TINTAS_FIELDS)
    const marca = r.find((x) => x.key === 'marca_preferida')
    expect(marca).toBeDefined()
    expect(marca!.value.toLowerCase()).toBe('coral')
  })

  it('detecta com acento normalizado ("acrilica" sem acento bate em "acrílica")', () => {
    const r = autoExtractFields('Tem tinta acrilica?', TINTAS_FIELDS)
    expect(r.find((x) => x.key === 'tipo_tinta')).toBeDefined()
  })
})

describe('autoExtractFields — defesas', () => {
  it('detecta negação simples ("não quero acrílica")', () => {
    const r = autoExtractFields('não quero acrílica', TINTAS_FIELDS)
    expect(r.find((x) => x.key === 'tipo_tinta')).toBeUndefined()
  })

  it('detecta "sem preferência" como negação de marca', () => {
    const r = autoExtractFields('sem preferência de Coral', TINTAS_FIELDS)
    // "sem preferência" antes de Coral deve invalidar
    expect(r.find((x) => x.key === 'marca_preferida')).toBeUndefined()
  })

  it('word boundary impede substring (não casa "branco" em "abrancado")', () => {
    const r = autoExtractFields('quero algo abrancado', TINTAS_FIELDS)
    expect(r.find((x) => x.key === 'cor')).toBeUndefined()
  })

  it('pula fields numéricos (quantidade não é extraído)', () => {
    const r = autoExtractFields('quero 10 litros', TINTAS_FIELDS)
    expect(r.find((x) => x.key === 'quantidade')).toBeUndefined()
  })

  it('não re-extrai chaves já presentes em alreadySetKeys', () => {
    const r = autoExtractFields(
      'Tem tinta acrílica fosco?',
      TINTAS_FIELDS,
      new Set(['tipo_tinta']),
    )
    expect(r.find((x) => x.key === 'tipo_tinta')).toBeUndefined()
    expect(r.find((x) => x.key === 'acabamento')).toBeDefined()
  })

  it('retorna array vazio para texto sem matches', () => {
    expect(autoExtractFields('preciso de ajuda', TINTAS_FIELDS)).toEqual([])
  })

  it('retorna array vazio para fields vazio', () => {
    expect(autoExtractFields('acrílica fosco', [])).toEqual([])
  })

  it('retorna array vazio para texto vazio', () => {
    expect(autoExtractFields('', TINTAS_FIELDS)).toEqual([])
  })
})

describe('flattenCategoryFields', () => {
  it('achata stages preservando ordem e deduplicando keys', () => {
    const stages = [
      { fields: [{ key: 'a', label: '', examples: '', priority: 1, score_value: 0 }] },
      { fields: [
        { key: 'b', label: '', examples: '', priority: 1, score_value: 0 },
        { key: 'a', label: '', examples: '', priority: 2, score_value: 0 }, // dup
      ] },
    ]
    const out = flattenCategoryFields(stages)
    expect(out.map((f) => f.key)).toEqual(['a', 'b'])
  })

  it('retorna [] para input inválido', () => {
    expect(flattenCategoryFields(null)).toEqual([])
    expect(flattenCategoryFields(undefined)).toEqual([])
  })
})
