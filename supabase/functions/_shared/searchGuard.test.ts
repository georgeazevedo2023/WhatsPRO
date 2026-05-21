import { describe, it, expect } from 'vitest'
import { evaluateSearchGuard, detectIncomingSearchSignal } from './searchGuard.ts'

describe('evaluateSearchGuard', () => {
  it('permite query vazia (broad listing)', () => {
    const r = evaluateSearchGuard({ query: '', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(true)
    if (r.allowed) expect(r.reason).toBe('no_query')
  })

  it('permite query vazia mesmo com categoria offline', () => {
    const r = evaluateSearchGuard({ query: '   ', expectedCategoryId: 'portas', expectedCategoryStatus: 'offline' })
    expect(r.allowed).toBe(true)
  })

  it('permite query específica com categoria digital', () => {
    const r = evaluateSearchGuard({ query: 'tinta acrílica branca', expectedCategoryId: 'tintas', expectedCategoryStatus: 'digital' })
    expect(r.allowed).toBe(true)
    if (r.allowed) expect(r.reason).toBe('category_digital')
  })

  it('permite query específica mesmo sem categoria derivável (ex: nome próprio)', () => {
    const r = evaluateSearchGuard({ query: 'suvinil branco neve', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(true)
    if (r.allowed) expect(r.reason).toBe('specific_query')
  })

  it('R126 — RECUSA query genérica "material" sem categoria', () => {
    const r = evaluateSearchGuard({ query: 'material', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(false)
    if (!r.allowed) {
      expect(r.reason).toBe('generic_query_without_category')
      expect(r.message).toContain('semanticamente vazia')
    }
  })

  it('R126 — RECUSA query "produto" sem categoria', () => {
    const r = evaluateSearchGuard({ query: 'produto', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('generic_query_without_category')
  })

  it('R126 — RECUSA "preço" / "valor" (típico de lead pedindo preço sem dizer de quê)', () => {
    for (const q of ['preço', 'preco', 'valor', 'valores']) {
      const r = evaluateSearchGuard({ query: q, expectedCategoryId: null, expectedCategoryStatus: undefined })
      expect(r.allowed, `query "${q}"`).toBe(false)
    }
  })

  it('R126 — RECUSA combinação de genéricos: "material produto"', () => {
    const r = evaluateSearchGuard({ query: 'material produto', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(false)
  })

  it('R126 — PERMITE genérico quando expectedCategory foi derivada (ex: tag interesse:tintas já existe)', () => {
    const r = evaluateSearchGuard({ query: 'material', expectedCategoryId: 'tintas', expectedCategoryStatus: 'digital' })
    expect(r.allowed).toBe(true)
  })

  it('R126 — PERMITE "material elétrico" (composto, não 100% genérico)', () => {
    const r = evaluateSearchGuard({ query: 'material elétrico', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(true)
    if (r.allowed) expect(r.reason).toBe('specific_query')
  })

  it('R126 — RECUSA categoria offline mesmo com query específica', () => {
    const r = evaluateSearchGuard({ query: 'porta alumínio branca', expectedCategoryId: 'portas', expectedCategoryStatus: 'offline' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) {
      expect(r.reason).toBe('category_offline')
      if (r.reason === 'category_offline') {
        expect(r.categoryId).toBe('portas')
        expect(r.message).toContain('catalog_status=offline')
        expect(r.message).toContain('handoff_to_human')
      }
    }
  })

  it('R126 — PERMITE categoria digital com query específica', () => {
    const r = evaluateSearchGuard({ query: 'tinta acrílica', expectedCategoryId: 'tintas', expectedCategoryStatus: 'digital' })
    expect(r.allowed).toBe(true)
  })

  it('R126 — categoria SEM catalog_status (legacy) trata como digital', () => {
    const r = evaluateSearchGuard({ query: 'tinta acrílica', expectedCategoryId: 'tintas', expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(true)
  })

  it('R126 — case insensitive + accent-insensitive', () => {
    const r1 = evaluateSearchGuard({ query: 'MATERIAL', expectedCategoryId: null, expectedCategoryStatus: undefined })
    const r2 = evaluateSearchGuard({ query: 'preço', expectedCategoryId: null, expectedCategoryStatus: undefined })
    const r3 = evaluateSearchGuard({ query: 'PREÇO', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r1.allowed).toBe(false)
    expect(r2.allowed).toBe(false)
    expect(r3.allowed).toBe(false)
  })

  it('repro EXATO Guttemberg 2026-05-20: query="material" + sem tags + EletropisoV2 → RECUSA', () => {
    // Cenário do log ai_agent_logs: incoming_text="Olá gostaria...material",
    // search_products({query:"material"}), tags=[] (sem interesse:).
    // ExpectedCategory chain: args.category=null, tag null, matchCategoryBySearchText("material")=null.
    const r = evaluateSearchGuard({ query: 'material', expectedCategoryId: null, expectedCategoryStatus: undefined })
    expect(r.allowed).toBe(false)
    if (!r.allowed) {
      expect(r.reason).toBe('generic_query_without_category')
      expect(r.message).toContain('Pergunte ao lead')
    }
  })
})

describe('detectIncomingSearchSignal — Sprint B (R121 + brand→search)', () => {
  it('R121: "Tem tinta?" → force, query "tinta"', () => {
    const r = detectIncomingSearchSignal({ text: 'Tem tinta?', knownBrands: [] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toBe('tinta')
  })

  it('R121: "Vcs tem tinta acrílica?" → force, query "tinta acrilica"', () => {
    const r = detectIncomingSearchSignal({ text: 'Vcs tem tinta acrílica?', knownBrands: [] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toBe('tinta acrilica')
  })

  it('R121: "Vendem porta de alumínio?" → force, query inclui "porta"', () => {
    const r = detectIncomingSearchSignal({ text: 'Vendem porta de alumínio?', knownBrands: [] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toContain('porta')
    expect(r.query).toContain('aluminio')
  })

  it('R121: "Trabalham com Coral?" → force, query "coral"', () => {
    const r = detectIncomingSearchSignal({ text: 'Trabalham com Coral?', knownBrands: [] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toBe('coral')
  })

  it('R121 OR brand: "Preciso de tinta Suvinil" → force=true', () => {
    const r = detectIncomingSearchSignal({ text: 'Preciso de tinta Suvinil', knownBrands: ['suvinil'] })
    expect(r.force).toBe(true)
    expect(['r121_direct_question', 'brand_mentioned']).toContain(r.reason)
    expect(r.query).toBeTruthy()
  })

  it('no_signal: "Bom dia" → force=false', () => {
    const r = detectIncomingSearchSignal({ text: 'Bom dia', knownBrands: ['coral', 'suvinil'] })
    expect(r.force).toBe(false)
    expect(r.reason).toBe('no_signal')
    expect(r.query).toBeNull()
  })

  it('no_signal: "Quanto custa?" sem produto → force=false', () => {
    const r = detectIncomingSearchSignal({ text: 'Quanto custa?', knownBrands: ['coral'] })
    expect(r.force).toBe(false)
    expect(r.reason).toBe('no_signal')
  })

  it('brand: "Quero Coral" + knownBrands=["coral"] → force', () => {
    // "Quero X" cai em R121 (preciso/quero/gostaria) — vale como force=true
    const r = detectIncomingSearchSignal({ text: 'Quero Coral', knownBrands: ['coral'] })
    expect(r.force).toBe(true)
    expect(['r121_direct_question', 'brand_mentioned']).toContain(r.reason)
    expect(r.query).toContain('coral')
  })

  it('brand: "Tinta suvinil 18L" → brand_mentioned, query inclui suvinil', () => {
    const r = detectIncomingSearchSignal({ text: 'Tinta suvinil 18L', knownBrands: ['coral', 'suvinil'] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('brand_mentioned')
    expect(r.query).toContain('suvinil')
  })

  it('R121 case-insensitive: "Tem CORAL aí?" → force', () => {
    const r = detectIncomingSearchSignal({ text: 'Tem CORAL aí?', knownBrands: ['coral'] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toContain('coral')
  })

  it('no_signal: "Acrílica fosco" sem brand sem pergunta direta → force=false', () => {
    const r = detectIncomingSearchSignal({ text: 'Acrílica fosco', knownBrands: ['coral'] })
    expect(r.force).toBe(false)
    expect(r.reason).toBe('no_signal')
  })

  it('prioridade R121 sobre brand: "Tem tinta da coral?" → r121, query inclui coral', () => {
    const r = detectIncomingSearchSignal({ text: 'Tem tinta da coral?', knownBrands: ['coral'] })
    expect(r.force).toBe(true)
    expect(r.reason).toBe('r121_direct_question')
    expect(r.query).toContain('coral')
  })

  it('texto vazio → no_signal', () => {
    const r = detectIncomingSearchSignal({ text: '', knownBrands: ['coral'] })
    expect(r.force).toBe(false)
    expect(r.reason).toBe('no_signal')
    expect(r.query).toBeNull()
  })
})
