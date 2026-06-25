import { describe, it, expect } from 'vitest'
import { sanitizeAgentResponse, keepLastQuestionWhenStacked, SAFE_TEXT_RULES, AUTO_FIX_RULES, type SanitizerCtx } from './responseSanitizer'

const noopLog = { warn: () => {}, error: () => {} }

function ctx(overrides: Partial<SanitizerCtx> = {}): SanitizerCtx {
  return {
    outgoingTexts: [],
    leadName: null,
    toolCallsLog: [],
    incomingText: null,
    tags: [],
    agent: {},
    log: noopLog,
    ...overrides,
  }
}

describe('sanitizeAgentResponse — fonte única monolith×router (Onda 2)', () => {
  it('texto limpo passa intacto (enforced=false)', () => {
    const r = sanitizeAgentResponse('Qual tonalidade você imagina para o ambiente?', ctx())
    expect(r.enforced).toBe(false)
    expect(r.text).toBe('Qual tonalidade você imagina para o ambiente?')
    expect(r.rules).toEqual([])
  })

  it('texto curto (<15 chars) passa direto sem validar', () => {
    const r = sanitizeAgentResponse('Show! 😊', ctx())
    expect(r.enforced).toBe(false)
    expect(r.text).toBe('Show! 😊')
  })

  it('negação CURTA (<15 chars) NÃO escapa mais — "Não temos." é barrada (gap v7.96.0)', () => {
    const r = sanitizeAgentResponse('Não temos.', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('anti_negative_phrases')
    expect(r.text.toLowerCase()).not.toContain('não temos')
    expect(r.text.length).toBeGreaterThan(15)
  })

  it('confirmação de estoque CURTA ("Tem sim!") também é barrada', () => {
    const r = sanitizeAgentResponse('Tem sim!', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('anti_stock_confirmation')
  })

  it('ack curto legítimo ("Ok! 👍") continua passando sem reescrever', () => {
    const r = sanitizeAgentResponse('Ok! 👍', ctx())
    expect(r.enforced).toBe(false)
    expect(r.text).toBe('Ok! 👍')
  })

  it('negação proibida (SAFE_TEXT) → ponte propositiva sem expor a negativa', () => {
    const r = sanitizeAgentResponse(
      'Infelizmente não temos esse produto em estoque no momento, tudo bem?',
      ctx(),
    )
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('anti_negative_phrases')
    expect(r.text.toLowerCase()).not.toContain('não temos')
    expect(r.text.length).toBeGreaterThan(15)
  })

  it('negação com handoff já disparado no loop → ponte de vendedor (preserva handoff)', () => {
    const r = sanitizeAgentResponse(
      'Não encontrei opções desse produto no catálogo, vou te passar pro time.',
      ctx({ toolCallsLog: [{ name: 'handoff_to_human', result: 'ok' }] }),
    )
    expect(r.enforced).toBe(true)
    expect(r.text).toContain('vendedor')
    expect(r.text.toLowerCase()).not.toContain('não encontrei')
  })

  it('erro interno exposto (SAFE_TEXT) → substituído por ponte segura', () => {
    const r = sanitizeAgentResponse('Desculpe, ocorreu um erro ao processar sua mensagem.', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules.some((x) => SAFE_TEXT_RULES.has(x))).toBe(true)
    expect(r.text.toLowerCase()).not.toContain('erro')
  })

  it('confirmação de estoque ("temos sim") → bloqueada e substituída', () => {
    const r = sanitizeAgentResponse('Temos sim! O produto está disponível pra pronta entrega.', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('anti_stock_confirmation')
  })

  it('"anotei" (AUTO_FIX) → reescrita cirúrgica mantém o resto da resposta', () => {
    const r = sanitizeAgentResponse('Já anotei seu pedido aqui. Qual cor você prefere?', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('anti_anotei')
    expect(r.text.toLowerCase()).not.toContain('anotei')
    expect(r.text).toContain('Qual cor você prefere?')
  })

  it('perguntas empilhadas → mantém só a última (single_question)', () => {
    const r = sanitizeAgentResponse('Qual cor você prefere? E qual o tamanho você precisa?', ctx())
    expect(r.enforced).toBe(true)
    expect(r.rules).toContain('single_question')
    expect(r.text).toBe('E qual o tamanho você precisa?')
  })

  it('violação só-cosmética (name_overuse) é telemetria-only — não reescreve', () => {
    const r = sanitizeAgentResponse(
      'George, esse modelo atende bem o que você descreveu.',
      ctx({ leadName: 'George', outgoingTexts: ['Oi George! O que você procura?'] }),
    )
    expect(r.enforced).toBe(false)
    expect(r.text).toContain('George')
  })

  it('nunca lança em erro interno — degrade gracioso devolve o texto original', () => {
    const r = sanitizeAgentResponse('Texto qualquer com mais de quinze caracteres.', ctx({
      // tags malformadas não podem derrubar o turno
      tags: [null as unknown as string, 123 as unknown as string],
    }))
    expect(typeof r.text).toBe('string')
  })
})

describe('keepLastQuestionWhenStacked', () => {
  it('1 pergunta só → intacto', () => {
    expect(keepLastQuestionWhenStacked('Qual cor você prefere?')).toBe('Qual cor você prefere?')
  })
  it('2 perguntas na mesma linha → última', () => {
    expect(keepLastQuestionWhenStacked('Para qual ambiente? Interno ou externo?')).toBe('Interno ou externo?')
  })
  it('texto sem pergunta → intacto', () => {
    expect(keepLastQuestionWhenStacked('Vou te mostrar as opções.')).toBe('Vou te mostrar as opções.')
  })
})

describe('contratos de regra (paridade com o histórico v7.55.0/v7.57.3)', () => {
  it('SAFE_TEXT_RULES e AUTO_FIX_RULES preservam a partição original', () => {
    expect([...SAFE_TEXT_RULES].sort()).toEqual([
      'anti_internal_error',
      'anti_internal_leak',
      'anti_negative_phrases',
      'anti_stock_confirmation',
    ])
    expect([...AUTO_FIX_RULES].sort()).toEqual([
      'anti_anotei',
      'anti_jargon_paraphrase',
      'anti_lead_echo',
    ])
  })
})
