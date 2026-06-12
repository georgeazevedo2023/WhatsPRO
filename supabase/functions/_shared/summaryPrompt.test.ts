import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { normalizeSummaryCategory, normalizeSaleClosed, SUMMARY_SYSTEM_PROMPT } from './summaryPrompt.ts'

Deno.test('normalizeSummaryCategory — valores válidos passam, inválidos viram outro', () => {
  assertEquals(normalizeSummaryCategory('interesse_compra'), 'interesse_compra')
  assertEquals(normalizeSummaryCategory('  DUVIDA_TECNICA '), 'duvida_tecnica')
  assertEquals(normalizeSummaryCategory('categoria_inventada'), 'outro')
  assertEquals(normalizeSummaryCategory(null), 'outro')
  assertEquals(normalizeSummaryCategory(undefined), 'outro')
})

Deno.test('normalizeSaleClosed — só true explícito conta (default false)', () => {
  assertEquals(normalizeSaleClosed(true), true)
  assertEquals(normalizeSaleClosed('true'), true)
  assertEquals(normalizeSaleClosed('TRUE'), true)
  assertEquals(normalizeSaleClosed('sim'), true)
  // tudo que não é true explícito = false (funil prefere subnotificar a inventar)
  assertEquals(normalizeSaleClosed(false), false)
  assertEquals(normalizeSaleClosed('false'), false)
  assertEquals(normalizeSaleClosed(''), false)
  assertEquals(normalizeSaleClosed(null), false)
  assertEquals(normalizeSaleClosed(undefined), false)
  assertEquals(normalizeSaleClosed('talvez'), false)
  assertEquals(normalizeSaleClosed(1), false)
})

Deno.test('SUMMARY_SYSTEM_PROMPT — contrato inclui sale_closed com regra de intenção', () => {
  // O writer depende dessas âncoras; se alguém remover do prompt, o campo apodrece
  // em silêncio (lição v7.83: contrato produtor↔consumidor com LLM precisa de guarda).
  assertEquals(SUMMARY_SYSTEM_PROMPT.includes('"sale_closed"'), true)
  assertEquals(SUMMARY_SYSTEM_PROMPT.includes('INTENÇÃO não é venda'), true)
})
