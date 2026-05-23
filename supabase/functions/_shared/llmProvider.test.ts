import { describe, it, expect, vi } from 'vitest'

// Mock Deno.env (módulo lê no carregamento)
;(globalThis as any).Deno = {
  env: {
    get: vi.fn(() => ''),
  },
}

const { isReasoningModel } = await import('./llmProvider.ts')

describe('isReasoningModel', () => {
  it.each([
    ['gpt-5', true],
    ['gpt-5-mini', true],
    ['gpt-5-nano', true],
    ['gpt-5-mini-2026-01-15', true],
    ['o1', true],
    ['o1-mini', true],
    ['o1-preview', true],
    ['o3', true],
    ['o3-mini', true],
    ['o4-mini', true],
    ['GPT-5-MINI', true], // case-insensitive
  ])('detecta "%s" como reasoning model', (model, expected) => {
    expect(isReasoningModel(model)).toBe(expected)
  })

  it.each([
    ['gpt-4.1-mini', false],
    ['gpt-4o', false],
    ['gpt-4o-mini', false],
    ['gpt-3.5-turbo', false],
    ['gemini-2.5-flash', false],
    ['claude-3-5-sonnet', false],
    ['', false],
    // Edge case: prefix match precisa de boundary — não pega "gpt-50" se um dia existir
    ['gpt-50-future', false],
    ['o5-future', false],
  ])('NÃO detecta "%s" como reasoning model', (model, expected) => {
    expect(isReasoningModel(model)).toBe(expected)
  })

  it('null/undefined safe', () => {
    expect(isReasoningModel(undefined as any)).toBe(false)
    expect(isReasoningModel(null as any)).toBe(false)
  })
})
