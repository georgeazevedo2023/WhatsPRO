import { describe, it, expect } from 'vitest'
import { validateSetTagsInput, validateInteresseCategory } from './setTagsValidator.ts'

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

/* ──────────────────────────────────────────────────────────
 * I2 (Sprint A 2026-05-21, Bug 12 fix) — validateInteresseCategory
 * ────────────────────────────────────────────────────────── */

describe('validateInteresseCategory', () => {
  const VALID = ['tintas', 'portas', 'janelas', 'chuveiros', 'vasos_sanitarios']

  it('aceita interesse: dentro da lista (caso comum)', () => {
    const r = validateInteresseCategory(['interesse:portas'], VALID)
    expect(r.ok).toBe(true)
    expect(r.message).toBe('')
  })

  it('aceita case-insensitive (LLM escreve em maiúsculo)', () => {
    const r = validateInteresseCategory(['interesse:PORTAS'], VALID)
    expect(r.ok).toBe(true)
  })

  it('Bug 12 — REJEITA interesse:hidraulica em agente sem essa categoria', () => {
    const r = validateInteresseCategory(['interesse:hidraulica'], VALID)
    expect(r.ok).toBe(false)
    expect(r.invalidTag).toBe('interesse:hidraulica')
    expect(r.message).toContain('hidraulica')
    expect(r.message).toContain('tintas, portas, janelas, chuveiros, vasos_sanitarios')
  })

  it('aceita quando tags não contém interesse:', () => {
    const r = validateInteresseCategory(['material_porta:alumínio', 'lead_score:20'], VALID)
    expect(r.ok).toBe(true)
  })

  it('rejeita primeira inválida quando há múltiplas tags', () => {
    const r = validateInteresseCategory(
      ['material_porta:alumínio', 'interesse:eletrica', 'lead_score:20'],
      VALID,
    )
    expect(r.ok).toBe(false)
    expect(r.invalidTag).toBe('interesse:eletrica')
  })

  it('compat: validCategoryIds vazio sempre passa (agente sem categories)', () => {
    const r = validateInteresseCategory(['interesse:qualquer_coisa'], [])
    expect(r.ok).toBe(true)
  })

  it('input inválido (não-array) passa por default', () => {
    // deno-lint-ignore no-explicit-any
    const r = validateInteresseCategory(null as any, VALID)
    expect(r.ok).toBe(true)
  })

  it('ignora interesse com value vazio', () => {
    const r = validateInteresseCategory(['interesse:', 'interesse:portas'], VALID)
    expect(r.ok).toBe(true)
  })

  it('ignora tags que não são strings', () => {
    // deno-lint-ignore no-explicit-any
    const r = validateInteresseCategory(['interesse:portas', 42 as any, null as any], VALID)
    expect(r.ok).toBe(true)
  })
})

/* ──────────────────────────────────────────────────────────
 * R144 (2026-05-22) — auto-correct fuzzy singular↔plural/regex/levenshtein
 * Caso Jessica: LLM tentou interesse:porta 4× → I2 bloqueava → loop
 * ────────────────────────────────────────────────────────── */

describe('R144 auto-correct fuzzy', () => {
  const VALID = ['tintas', 'portas', 'janelas', 'chuveiros', 'vasos_sanitarios']
  const CATEGORIES = [
    { id: 'tintas', interesse_match: 'tinta|esmalte|verniz' },
    { id: 'portas', interesse_match: 'porta|portas' },
    { id: 'janelas', interesse_match: 'janela|janelas' },
    { id: 'chuveiros', interesse_match: 'chuveiro|chuveiros' },
    { id: 'vasos_sanitarios', interesse_match: 'vaso|vaso sanit|vaso_sanitario' },
  ]

  it('caso Jessica: interesse:porta → auto-corrige pra interesse:portas (plural)', () => {
    const r = validateInteresseCategory(['interesse:porta'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected).toHaveLength(1)
    expect(r.autoCorrected![0]).toEqual({
      original: 'interesse:porta',
      fixed: 'interesse:portas',
      matchedVia: 'plural',
    })
    expect(r.correctedTags).toEqual(['interesse:portas'])
  })

  it('interesse:tinta → interesse:tintas (plural)', () => {
    const r = validateInteresseCategory(['interesse:tinta'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:tintas')
    expect(r.autoCorrected![0].matchedVia).toBe('plural')
  })

  it('interesse:janela → interesse:janelas (plural)', () => {
    const r = validateInteresseCategory(['interesse:janela'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:janelas')
  })

  it('regex_match: interesse:esmalte → interesse:tintas (via regex)', () => {
    const r = validateInteresseCategory(['interesse:esmalte'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:tintas')
    expect(r.autoCorrected![0].matchedVia).toBe('regex_match')
  })

  it('regex_match: interesse:vaso → interesse:vasos_sanitarios', () => {
    const r = validateInteresseCategory(['interesse:vaso'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:vasos_sanitarios')
  })

  it('levenshtein_1: interesse:xintas (typo char inicial) → interesse:tintas', () => {
    // "xintas" não contém substring "tinta" — regex_match falha — cai em Levenshtein
    const r = validateInteresseCategory(['interesse:xintas'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:tintas')
    expect(r.autoCorrected![0].matchedVia).toBe('levenshtein_1')
  })

  it('sem auto-correct possível → bloqueia (Bug 12 original)', () => {
    const r = validateInteresseCategory(['interesse:hidraulica'], VALID, CATEGORIES)
    expect(r.ok).toBe(false)
    expect(r.invalidTag).toBe('interesse:hidraulica')
  })

  it('preserva outras tags durante auto-correct', () => {
    const r = validateInteresseCategory(
      ['motivo:compra', 'interesse:porta', 'material_porta:madeira'],
      VALID,
      CATEGORIES,
    )
    expect(r.ok).toBe(true)
    expect(r.correctedTags).toEqual([
      'motivo:compra',
      'interesse:portas',
      'material_porta:madeira',
    ])
  })

  it('sem categories[] mas com plural disponível → ainda corrige', () => {
    const r = validateInteresseCategory(['interesse:porta'], VALID)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected![0].fixed).toBe('interesse:portas')
  })

  it('valid value (já no validSet) → não dispara auto-correct', () => {
    const r = validateInteresseCategory(['interesse:portas'], VALID, CATEGORIES)
    expect(r.ok).toBe(true)
    expect(r.autoCorrected).toBeUndefined()
    expect(r.correctedTags).toBeUndefined()
  })
})
