/**
 * Tests for edge cases + scenario results — imports from REAL shared module.
 */
import {
  computeScenarioResults,
  isJustGreeting,
  buildPlaygroundResponse,
  type ScenarioExpected,
} from '../../../../supabase/functions/_shared/agentHelpers.ts'

const mk = (role: string, content: string, extras?: Record<string, unknown>) => ({
  role, content, ...extras,
})

describe('computeScenarioResults — PASS/FAIL logic', () => {
  it('1. PASS when all expected tools used', () => {
    const expected: ScenarioExpected = { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false }
    const msgs = [
      mk('user', 'oi'),
      mk('system', '', { tool_calls: [{ name: 'search_products' }, { name: 'set_tags' }] }),
      mk('assistant', 'Encontrei!'),
    ]
    const r = computeScenarioResults(expected, msgs)
    expect(r.pass).toBe(true)
    expect(r.tools_missing).toEqual([])
  })

  it('2. FAIL when expected tool missing', () => {
    const expected: ScenarioExpected = { tools_must_use: ['search_products', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false }
    const msgs = [mk('user', 'oi'), mk('system', '', { tool_calls: [{ name: 'search_products' }] }), mk('assistant', 'Resultado')]
    const r = computeScenarioResults(expected, msgs)
    expect(r.pass).toBe(false)
    expect(r.tools_missing).toContain('handoff_to_human')
  })

  it('3. FAIL when unexpected tool used', () => {
    const expected: ScenarioExpected = { tools_must_use: ['set_tags'], tools_must_not_use: ['search_products'], should_handoff: false, should_block: false }
    const msgs = [mk('user', 'horario?'), mk('system', '', { tool_calls: [{ name: 'set_tags' }, { name: 'search_products' }] }), mk('assistant', '8h')]
    const r = computeScenarioResults(expected, msgs)
    expect(r.pass).toBe(false)
    expect(r.tools_unexpected).toContain('search_products')
  })

  it('4. PASS on guardrail block', () => {
    const expected: ScenarioExpected = { tools_must_use: [], tools_must_not_use: [], should_handoff: false, should_block: true }
    const msgs = [mk('user', 'tem vaga?'), mk('assistant', 'Desculpe, nao posso ajudar com vagas.')]
    const r = computeScenarioResults(expected, msgs)
    expect(r.pass).toBe(true)
    expect(r.blocked_occurred).toBe(true)
  })

  it('5. deduplicates tools from system msgs only', () => {
    const expected: ScenarioExpected = { tools_must_use: ['search_products'], tools_must_not_use: [], should_handoff: false, should_block: false }
    const tc = [{ name: 'search_products' }]
    const msgs = [mk('user', 'oi'), mk('system', '', { tool_calls: tc }), mk('assistant', 'Ok', { tool_calls: tc })]
    const r = computeScenarioResults(expected, msgs)
    expect(r.tools_used).toEqual(['search_products'])
  })

  it('6. token + latency aggregation', () => {
    const expected: ScenarioExpected = { tools_must_use: [], tools_must_not_use: [], should_handoff: false, should_block: false }
    const msgs = [
      mk('assistant', 'r1', { tokens: { input: 500, output: 200 }, latency_ms: 1200 }),
      mk('assistant', 'r2', { tokens: { input: 600, output: 300 }, latency_ms: 1800 }),
    ]
    const r = computeScenarioResults(expected, msgs)
    expect(r.total_tokens.input).toBe(1100)
    expect(r.total_tokens.output).toBe(500)
    expect(r.total_latency_ms).toBe(3000)
  })
})

describe('Edge cases — greeting flow integration', () => {
  it('7. "oi" → just greeting, "tem tinta?" → greeting + response', () => {
    // Simulates the FULL flow an admin would experience
    const r1 = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: 'Olá!', firstMessageText: 'oi', llmResponse: '' })
    expect(r1.just_greeting).toBe(true)
    expect(r1.response).toBe('Olá!')

    const r2 = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: 'Olá!', firstMessageText: 'tem tinta latex?', llmResponse: 'Qual cor?' })
    expect(r2.just_greeting).toBe(false)
    expect(r2.response).toBe('Olá!\n\nQual cor?')
  })

  it('8. greeting edge: "oi!" with punctuation', () => {
    expect(isJustGreeting('oi!')).toBe(true)
    expect(isJustGreeting('Oi!!')).toBe(true)
    expect(isJustGreeting('Oi??')).toBe(true)
  })

  it('9. greeting edge: "oi tudo bem" is greeting', () => {
    expect(isJustGreeting('oi tudo bem')).toBe(true)
    expect(isJustGreeting('Oi tudo bem?')).toBe(true)
  })

  it('10. greeting edge: "oi quero comprar" is NOT greeting', () => {
    expect(isJustGreeting('oi quero comprar')).toBe(false)
    expect(isJustGreeting('oi me ajuda')).toBe(false)
  })
})
