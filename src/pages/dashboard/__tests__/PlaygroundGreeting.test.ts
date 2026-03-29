/**
 * Tests for greeting logic — imports from REAL shared module.
 * If the source code changes, these tests break.
 */
import {
  isJustGreeting,
  buildGeminiContents,
  buildPlaygroundResponse,
} from '../../../../supabase/functions/_shared/agentHelpers.ts'

describe('isJustGreeting — detects simple greetings', () => {
  it('1. detects common greetings', () => {
    expect(isJustGreeting('oi')).toBe(true)
    expect(isJustGreeting('Oi!')).toBe(true)
    expect(isJustGreeting('boa tarde')).toBe(true)
    expect(isJustGreeting('Bom dia!')).toBe(true)
    expect(isJustGreeting('oie')).toBe(true)
    expect(isJustGreeting('tudo bem?')).toBe(true)
    expect(isJustGreeting('blz')).toBe(true)
  })

  it('2. rejects substantive messages', () => {
    expect(isJustGreeting('oi, tem tinta?')).toBe(false)
    expect(isJustGreeting('bom dia, preciso de cimento')).toBe(false)
    expect(isJustGreeting('quanto custa o porcelanato?')).toBe(false)
    expect(isJustGreeting('quero falar com vendedor')).toBe(false)
  })
})

describe('buildPlaygroundResponse — response construction', () => {
  it('3. "oi" returns ONLY greeting, no LLM', () => {
    const r = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: 'Olá! Bem-vindo!', firstMessageText: 'oi', llmResponse: 'Isso não devia aparecer' })
    expect(r.response).toBe('Olá! Bem-vindo!')
    expect(r.just_greeting).toBe(true)
    expect(r.llm_called).toBe(false)
  })

  it('4. substantive first msg = greeting + LLM response', () => {
    const r = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: 'Olá!', firstMessageText: 'tem tinta?', llmResponse: 'Qual tipo?' })
    expect(r.response).toBe('Olá!\n\nQual tipo?')
    expect(r.greeting_sent).toBe(true)
    expect(r.llm_called).toBe(true)
  })

  it('5. second message = no greeting', () => {
    const r = buildPlaygroundResponse({ hasAssistantMsg: true, greetingMessage: 'Olá!', firstMessageText: 'tem cimento?', llmResponse: 'Sim!' })
    expect(r.response).toBe('Sim!')
    expect(r.greeting_sent).toBe(false)
  })

  it('6. no greeting configured = straight to LLM', () => {
    const r = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: null, firstMessageText: 'oi', llmResponse: 'Olá!' })
    expect(r.response).toBe('Olá!')
    expect(r.greeting_sent).toBe(false)
    expect(r.llm_called).toBe(true)
  })

  it('7. REGRESSION: greeting appears exactly once', () => {
    const greeting = 'Olá! Bem-vindo a Eletropiso!'
    const r = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: greeting, firstMessageText: 'tem tinta?', llmResponse: 'Qual tipo?' })
    expect(r.response.split(greeting).length - 1).toBe(1)
  })

  it('8. REGRESSION: only one "Olá" in final response', () => {
    const r = buildPlaygroundResponse({ hasAssistantMsg: false, greetingMessage: 'Olá! Bem-vindo!', firstMessageText: 'tem tinta?', llmResponse: 'Qual tipo de tinta?' })
    expect((r.response.match(/Olá/g) || []).length).toBe(1)
  })
})

describe('buildGeminiContents — no greeting injection', () => {
  it('9. does NOT contain greeting in contents', () => {
    const contents = buildGeminiContents([{ content: 'oi', direction: 'incoming' }])
    expect(contents.map(c => c.parts[0].text)).toEqual(['oi'])
  })

  it('10. filters empty/whitespace messages', () => {
    const contents = buildGeminiContents([
      { content: 'oi', direction: 'incoming' },
      { content: '', direction: 'outgoing' },
      { content: '  ', direction: 'incoming' },
      { content: 'tem tinta?', direction: 'incoming' },
    ])
    expect(contents).toHaveLength(2)
  })
})
