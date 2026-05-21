import { describe, it, expect } from 'vitest'
import { validateLLMResponse, type ResponseValidatorContext } from './responseValidator.ts'

const baseCtx: ResponseValidatorContext = {
  messageCount: 5,
  leadName: null,
  msgsSinceLastNameUse: null,
  catalogPrices: [],
}

describe('validateLLMResponse', () => {
  it('passa string limpa sem violacoes', () => {
    const r = validateLLMResponse('Qual a metragem do ambiente?', baseCtx)
    expect(r.valid).toBe(true)
    expect(r.violations).toHaveLength(0)
    expect(r.blockSend).toBe(false)
    expect(r.rewriteSuggestion).toBeNull()
  })

  // 1. anti_negative_phrases
  it('anti_negative_phrases: HIT em "Nao temos" com acento', () => {
    const r = validateLLMResponse('Não temos esse modelo', baseCtx)
    expect(r.blockSend).toBe(true)
    expect(r.violations.some((v) => v.rule === 'anti_negative_phrases')).toBe(true)
  })
  it('anti_negative_phrases: MISS em frase positiva', () => {
    const r = validateLLMResponse('Temos várias opções de porcelanato disponíveis', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_negative_phrases')).toBe(false)
  })

  // 2. anti_internal_error
  it('anti_internal_error: HIT em "Desculpe"', () => {
    const r = validateLLMResponse('Desculpe, não consegui processar', baseCtx)
    expect(r.blockSend).toBe(true)
    expect(r.violations.some((v) => v.rule === 'anti_internal_error')).toBe(true)
  })
  it('anti_internal_error: MISS em resposta normal', () => {
    const r = validateLLMResponse('Vou separar três opções pra você', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_internal_error')).toBe(false)
  })

  // 3. anti_internal_leak
  it('anti_internal_leak: HIT em [INTERNO]', () => {
    const r = validateLLMResponse('Aqui está [INTERNO] o produto', baseCtx)
    expect(r.blockSend).toBe(true)
    expect(r.violations.some((v) => v.rule === 'anti_internal_leak')).toBe(true)
  })
  it('anti_internal_leak: MISS em texto comum (case sensitive ao formato)', () => {
    const r = validateLLMResponse('Vamos olhar opções internas pra você', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_internal_leak')).toBe(false)
  })

  // 4. anti_echo_opener
  it('anti_echo_opener: HIT em "Anotado,"', () => {
    const r = validateLLMResponse('Anotado, qual a metragem?', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_echo_opener')).toBe(true)
    expect(r.blockSend).toBe(false)
  })
  it('anti_echo_opener: HIT em "Só pra confirmar" (acento)', () => {
    const r = validateLLMResponse('Só pra confirmar, você quer porcelanato?', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_echo_opener')).toBe(true)
  })
  it('anti_echo_opener: MISS quando inicia com pergunta direta', () => {
    const r = validateLLMResponse('Qual a metragem total?', baseCtx)
    expect(r.violations.some((v) => v.rule === 'anti_echo_opener')).toBe(false)
  })

  // 5. anti_recumprimento
  it('anti_recumprimento: HIT em "Olá" quando messageCount > 1', () => {
    const r = validateLLMResponse('Olá! Vamos continuar?', { ...baseCtx, messageCount: 5 })
    expect(r.violations.some((v) => v.rule === 'anti_recumprimento')).toBe(true)
  })
  it('anti_recumprimento: MISS quando messageCount === 1 (primeira interacao)', () => {
    const r = validateLLMResponse('Olá! Bem-vindo', { ...baseCtx, messageCount: 1 })
    expect(r.violations.some((v) => v.rule === 'anti_recumprimento')).toBe(false)
  })

  // 6. name_overuse
  it('name_overuse: HIT quando nome usado ha menos de 3 msgs', () => {
    const r = validateLLMResponse('Maria, vamos olhar opções', {
      ...baseCtx,
      leadName: 'Maria',
      msgsSinceLastNameUse: 1,
    })
    expect(r.violations.some((v) => v.rule === 'name_overuse')).toBe(true)
  })
  it('name_overuse: MISS quando ultimo uso ja foi 3+ msgs atras', () => {
    const r = validateLLMResponse('Maria, voltamos ao porcelanato', {
      ...baseCtx,
      leadName: 'Maria',
      msgsSinceLastNameUse: 4,
    })
    expect(r.violations.some((v) => v.rule === 'name_overuse')).toBe(false)
  })

  // 7. hallucinated_price
  it('hallucinated_price: HIT quando preco nao bate catalogo', () => {
    const r = validateLLMResponse('Custa R$99,99', { ...baseCtx, catalogPrices: ['R$56,90'] })
    expect(r.blockSend).toBe(true)
    expect(r.violations.some((v) => v.rule === 'hallucinated_price')).toBe(true)
  })
  it('hallucinated_price: MISS quando preco bate catalogo', () => {
    const r = validateLLMResponse('Custa R$56,90', { ...baseCtx, catalogPrices: ['R$56,90'] })
    expect(r.violations.some((v) => v.rule === 'hallucinated_price')).toBe(false)
  })
  it('hallucinated_price: MISS quando catalogo vazio (pula checagem)', () => {
    const r = validateLLMResponse('Custa R$99,99 inventado', { ...baseCtx, catalogPrices: [] })
    expect(r.violations.some((v) => v.rule === 'hallucinated_price')).toBe(false)
  })

  // Composicao
  it('rewriteSuggestion eh string quando ha violacao rewrite', () => {
    const r = validateLLMResponse('Anotado, qual a metragem?', baseCtx)
    expect(typeof r.rewriteSuggestion).toBe('string')
    expect(r.rewriteSuggestion).toMatch(/abertura eco/i)
  })

  it('blockSend=true quando mistura block + rewrite', () => {
    const r = validateLLMResponse('Anotado, não temos esse modelo', baseCtx)
    expect(r.blockSend).toBe(true)
    expect(r.violations.length).toBeGreaterThanOrEqual(2)
  })
})
