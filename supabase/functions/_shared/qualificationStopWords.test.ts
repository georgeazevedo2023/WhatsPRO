import { describe, it, expect } from 'vitest'
import { filterSearchIntentTerms, filterNonBrandTerms } from './qualificationStopWords.ts'

describe('filterSearchIntentTerms (2026-05-26) — AND-fallback tolerante a ruído', () => {
  it('dropa verbo de desejo "quero" mantendo os termos do produto', () => {
    // Caso real: "quero a cuba de apoio quadrada" (após split len>2).
    expect(filterSearchIntentTerms(['quero', 'cuba', 'apoio', 'quadrada'])).toEqual([
      'cuba', 'apoio', 'quadrada',
    ])
  })

  it('dropa família de desejo/pergunta/preço', () => {
    expect(filterSearchIntentTerms(['queria', 'preciso', 'gostaria', 'tem', 'preco', 'valor', 'saber']))
      .toEqual([])
  })

  it('dropa pronomes/artigos/interrogativos (com acento normalizado)', () => {
    expect(filterSearchIntentTerms(['você', 'vocês', 'uma', 'qual', 'onde', 'manta']))
      .toEqual(['manta'])
  })

  it('PRESERVA termos de produto (cor/material/tipo NÃO são intenção)', () => {
    // Diferente de QUALIFICATION_STOP_WORDS — aqui cor/material seguem como termo de busca.
    expect(filterSearchIntentTerms(['tinta', 'acrilica', 'branca', 'fosca', 'verniz', 'manta', 'liquida']))
      .toEqual(['tinta', 'acrilica', 'branca', 'fosca', 'verniz', 'manta', 'liquida'])
  })

  it('filterNonBrandTerms (legado) continua dropando cor/ambiente — escopos distintos', () => {
    // Garante que os dois filtros têm propósitos diferentes e não foram fundidos.
    expect(filterNonBrandTerms(['branca', 'parede'])).toEqual([])
    expect(filterSearchIntentTerms(['branca', 'parede'])).toEqual(['branca', 'parede'])
  })
})
