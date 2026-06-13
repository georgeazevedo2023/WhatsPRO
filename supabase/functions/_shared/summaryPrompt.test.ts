import { describe, it, expect } from 'vitest'
import { normalizeSummaryCategory, normalizeSaleClosed, SUMMARY_SYSTEM_PROMPT } from './summaryPrompt.ts'

describe('summaryPrompt', () => {
  it('normalizeSummaryCategory — valores válidos passam, inválidos viram outro', () => {
    expect(normalizeSummaryCategory('interesse_compra')).toEqual('interesse_compra')
    expect(normalizeSummaryCategory('  DUVIDA_TECNICA ')).toEqual('duvida_tecnica')
    expect(normalizeSummaryCategory('categoria_inventada')).toEqual('outro')
    expect(normalizeSummaryCategory(null)).toEqual('outro')
    expect(normalizeSummaryCategory(undefined)).toEqual('outro')
  })

  it('normalizeSaleClosed — só true explícito conta (default false)', () => {
    expect(normalizeSaleClosed(true)).toEqual(true)
    expect(normalizeSaleClosed('true')).toEqual(true)
    expect(normalizeSaleClosed('TRUE')).toEqual(true)
    expect(normalizeSaleClosed('sim')).toEqual(true)
    // tudo que não é true explícito = false (funil prefere subnotificar a inventar)
    expect(normalizeSaleClosed(false)).toEqual(false)
    expect(normalizeSaleClosed('false')).toEqual(false)
    expect(normalizeSaleClosed('')).toEqual(false)
    expect(normalizeSaleClosed(null)).toEqual(false)
    expect(normalizeSaleClosed(undefined)).toEqual(false)
    expect(normalizeSaleClosed('talvez')).toEqual(false)
    expect(normalizeSaleClosed(1)).toEqual(false)
  })

  it('SUMMARY_SYSTEM_PROMPT — contrato inclui sale_closed com regra de intenção', () => {
    // O writer depende dessas âncoras; se alguém remover do prompt, o campo apodrece
    // em silêncio (lição v7.83: contrato produtor↔consumidor com LLM precisa de guarda).
    expect(SUMMARY_SYSTEM_PROMPT.includes('"sale_closed"')).toEqual(true)
    expect(SUMMARY_SYSTEM_PROMPT.includes('INTENÇÃO não é venda')).toEqual(true)
  })
})
