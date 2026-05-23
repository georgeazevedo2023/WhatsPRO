import { describe, it, expect, vi } from 'vitest'
import { detectProductChoice, buildProductChoiceHint } from './productChoiceDetector.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

const CATALOG = [
  { title: 'Tinta Esmalte Acetinada Dialine Branco Neve 750ml - Iquine', price: 51.9 },
  { title: 'Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva - Coral', price: 792 },
  { title: 'Manta Líquida Branca 18 Kg - Quartzolit', price: 289 },
]

describe('detectProductChoice', () => {
  it('exact match: lead clicou "Eu quero!" e UAZAPI mandou título exato', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Esmalte Acetinada Dialine Branco Neve 750ml - Iquine',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).not.toBeNull()
    expect(r!.productTitle).toContain('Dialine')
    expect(r!.price).toBe('R$ 51,90')
    expect(r!.reason).toBe('exact_title')
  })

  it('match com sufixo "(id)" do webhook tryButtonReply', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Esmalte Acetinada Dialine Branco Neve 750ml - Iquine (btn_id_xyz)',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).not.toBeNull()
    expect(r!.productTitle).toContain('Dialine')
  })

  it('fuzzy match: 80% das palavras do incoming presentes no título do catálogo', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Dialine Iquine 750ml', // 4 palavras todas no catálogo
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).not.toBeNull()
    expect(r!.reason).toBe('fuzzy_title')
  })

  it('NÃO faz fuzzy match se última outgoing NÃO foi mídia (evita falso positivo)', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Dialine Iquine 750ml',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'text',
      log: makeLog() as any,
    })
    expect(r).toBeNull()
  })

  it('preço fallback "sob consulta" quando catálogo sem preço', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Sem Preço',
      catalogProducts: [{ title: 'Tinta Sem Preço', price: null }],
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r!.price).toBe('preço sob consulta')
  })

  it('match case-insensitive + acento-insensitive', () => {
    const r = detectProductChoice({
      incomingText: 'MANTA liquida branca 18 kg - quartzolit',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).not.toBeNull()
    expect(r!.productTitle).toContain('Manta')
  })

  it('null quando texto muito curto', () => {
    const r = detectProductChoice({
      incomingText: 'oi',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).toBeNull()
  })

  it('null quando catálogo vazio', () => {
    const r = detectProductChoice({
      incomingText: 'Tinta Dialine Iquine',
      catalogProducts: [],
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).toBeNull()
  })

  it('null quando texto é uma pergunta normal (não clique)', () => {
    const r = detectProductChoice({
      incomingText: 'é para o quarto da minha filha',
      catalogProducts: CATALOG,
      lastOutgoingMediaType: 'carousel',
      log: makeLog() as any,
    })
    expect(r).toBeNull() // só 1 palavra >=3 chars que casa (com nenhum produto)
  })
})

describe('buildProductChoiceHint', () => {
  it('inclui produto + preço + instruções de venda consultiva', () => {
    const hint = buildProductChoiceHint({
      productTitle: 'Tinta Dialine 750ml',
      price: 'R$ 51,90',
      reason: 'exact_title',
    })
    expect(hint).toContain('CONTEXTO INTERNO')
    expect(hint).toContain('Tinta Dialine 750ml')
    expect(hint).toContain('R$ 51,90')
    expect(hint).toContain('Ótima escolha')
    expect(hint).toContain('handoff_to_human')
    expect(hint).toContain('NÃO pergunte ambiente')
  })

  it('hint instrui o LLM a NÃO repetir o contexto interno ao lead', () => {
    const hint = buildProductChoiceHint({
      productTitle: 'X',
      price: 'Y',
      reason: 'exact_title',
    })
    expect(hint).toContain('não repita ao lead')
  })
})
