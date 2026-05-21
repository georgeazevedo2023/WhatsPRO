import { describe, it, expect } from 'vitest'
import { validateSetTagsInput } from './setTagsValidator.ts'

describe('validateSetTagsInput', () => {
  it('permite array vazio', () => {
    const r = validateSetTagsInput([])
    expect(r.hasDuplicateKeys).toBe(false)
    expect(r.cleanedTags).toEqual([])
  })

  it('permite tag única bem formatada', () => {
    const r = validateSetTagsInput(['interesse:portas'])
    expect(r.hasDuplicateKeys).toBe(false)
    expect(r.cleanedTags).toEqual(['interesse:portas'])
  })

  it('permite múltiplas tags de keys diferentes', () => {
    const r = validateSetTagsInput(['interesse:portas', 'material_porta:alumínio', 'lead_score:20'])
    expect(r.hasDuplicateKeys).toBe(false)
    expect(r.cleanedTags).toEqual(['interesse:portas', 'material_porta:alumínio', 'lead_score:20'])
  })

  it('permite tag duplicada com MESMO valor (idempotente)', () => {
    const r = validateSetTagsInput(['interesse:portas', 'interesse:portas'])
    expect(r.hasDuplicateKeys).toBe(false)
  })

  it('R127 — REJEITA interesse:portas + interesse:janelas (multi-categoria)', () => {
    const r = validateSetTagsInput(['interesse:portas', 'interesse:janelas'])
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.cleanedTags).toEqual([])
    expect(r.message).toContain('porta e janela')
    expect(r.message).toContain('Qual você prefere ver primeiro')
    expect(r.duplicates).toHaveLength(1)
    expect(r.duplicates[0].key).toBe('interesse')
    expect(r.duplicates[0].values.sort()).toEqual(['janelas', 'portas'])
  })

  it('R127 — REJEITA interesse:portas + interesse:janelas + outras tags juntas', () => {
    const r = validateSetTagsInput([
      'interesse:portas',
      'interesse:janelas',
      'material_porta:alumínio',
    ])
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.cleanedTags).toEqual([]) // interesse conflict descarta TUDO
    expect(r.message).toContain('porta e janela')
  })

  it('R127 — repro EXATO Wsmart 2026-05-20: interesse:portas + interesse:janela (singular)', () => {
    // No log do bug, LLM passou ["interesse:portas", "interesse:janela"] (singular).
    // R117 normaliza pra slug canônico, mas validator roda ANTES da normalização.
    // Aqui o conflict é detectado pelos valores brutos: 'portas' vs 'janela'.
    const r = validateSetTagsInput(['interesse:portas', 'interesse:janela'])
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.cleanedTags).toEqual([])
  })

  it('R127 — interesse com 3 valores', () => {
    const r = validateSetTagsInput(['interesse:portas', 'interesse:janelas', 'interesse:tintas'])
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.duplicates[0].values).toHaveLength(3)
    expect(r.message).toContain('3 categorias')
  })

  it('REJEITA duplicate em outras keys (não interesse) — mantém tags válidas', () => {
    const r = validateSetTagsInput([
      'material_porta:alumínio',
      'material_porta:madeira',
      'interesse:portas',
    ])
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.cleanedTags).toEqual(['interesse:portas'])
    expect(r.duplicates[0].key).toBe('material_porta')
    expect(r.message).toContain('material_porta')
    expect(r.message).toContain('REJEITADAS')
  })

  it('ignora tags mal formatadas (sem :)', () => {
    const r = validateSetTagsInput(['interesse:portas', 'invalid-tag-no-colon'])
    expect(r.hasDuplicateKeys).toBe(false)
    expect(r.cleanedTags).toContain('interesse:portas')
  })

  it('ignora tags com value vazio', () => {
    const r = validateSetTagsInput(['interesse:portas', 'material_porta:'])
    expect(r.hasDuplicateKeys).toBe(false)
  })

  it('combina conflitos em keys diferentes (interesse + outra)', () => {
    const r = validateSetTagsInput([
      'interesse:portas',
      'interesse:janelas',
      'material_porta:alumínio',
      'material_porta:madeira',
    ])
    // Quando há conflito em interesse, ele dita o comportamento (caso especial)
    expect(r.hasDuplicateKeys).toBe(true)
    expect(r.cleanedTags).toEqual([])
    expect(r.message).toContain('porta e janela')
    expect(r.duplicates.length).toBeGreaterThanOrEqual(1)
  })

  it('case-sensitive em values (alumínio ≠ ALUMÍNIO conta como conflict)', () => {
    const r = validateSetTagsInput(['material_porta:alumínio', 'material_porta:ALUMÍNIO'])
    expect(r.hasDuplicateKeys).toBe(true) // strict: values diferentes literalmente
  })

  it('preserva ordem em cleanedTags quando não há conflict', () => {
    const r = validateSetTagsInput(['lead_score:20', 'interesse:portas', 'material_porta:alumínio'])
    expect(r.cleanedTags).toEqual(['lead_score:20', 'interesse:portas', 'material_porta:alumínio'])
  })
})
