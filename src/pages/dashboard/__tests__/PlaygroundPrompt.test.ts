/**
 * Tests for prompt building — imports from REAL shared module.
 */
import {
  buildBusinessInfoSection,
  buildKnowledgeInstruction,
  buildExtractionInstruction,
  buildSubAgentInstruction,
  resolveGreetingText,
} from '../../../../supabase/functions/_shared/agentHelpers.ts'

describe('buildBusinessInfoSection', () => {
  it('1. null/undefined returns fallback', () => {
    const r = buildBusinessInfoSection(null)
    expect(r).toContain('Nenhuma informação da empresa')
    expect(r).toContain('handoff_to_human')
  })

  it('2. populates all fields', () => {
    const r = buildBusinessInfoSection({ hours: '8h-18h', address: 'Rua A', phone: '1234', payment_methods: 'Pix', delivery_info: '3 dias', extra: 'VIP' })
    expect(r).toContain('8h-18h')
    expect(r).toContain('Rua A')
    expect(r).toContain('1234')
    expect(r).toContain('Pix')
    expect(r).toContain('3 dias')
    expect(r).toContain('VIP')
  })

  it('3. partial fields — only shows what is set', () => {
    const r = buildBusinessInfoSection({ hours: '8h-18h' })
    expect(r).toContain('8h-18h')
    expect(r).not.toContain('Endereço')
    expect(r).not.toContain('Telefone')
  })
})

describe('buildKnowledgeInstruction', () => {
  it('4. empty lists = empty string', () => {
    expect(buildKnowledgeInstruction([], [])).toBe('')
  })

  it('5. FAQ formatted correctly', () => {
    const r = buildKnowledgeInstruction([{ title: 'Prazo?', content: '3 dias' }], [])
    expect(r).toContain('<knowledge_base type="faq">')
    expect(r).toContain('<question>Prazo?</question>')
    expect(r).toContain('<answer>3 dias</answer>')
  })

  it('6. docs formatted correctly', () => {
    const r = buildKnowledgeInstruction([], [{ title: 'Política', content: 'Troca 30 dias' }])
    expect(r).toContain('<knowledge_base type="documents">')
    expect(r).toContain('<doc title="Política">')
  })

  it('7. both FAQ + docs', () => {
    const r = buildKnowledgeInstruction([{ title: 'Q?', content: 'A' }], [{ title: 'D', content: 'C' }])
    expect(r).toContain('type="faq"')
    expect(r).toContain('type="documents"')
  })
})

describe('buildExtractionInstruction', () => {
  it('8. no enabled fields = empty', () => {
    expect(buildExtractionInstruction([{ label: 'CPF', key: 'cpf', enabled: false }])).toBe('')
  })

  it('9. enabled fields included', () => {
    const r = buildExtractionInstruction([{ label: 'CPF', key: 'cpf', enabled: true }, { label: 'Email', key: 'email', enabled: false }])
    expect(r).toContain('CPF')
    expect(r).toContain('cpf')
    expect(r).not.toContain('Email')
  })
})

describe('buildSubAgentInstruction', () => {
  it('10. no active agents = empty', () => {
    expect(buildSubAgentInstruction({})).toBe('')
    expect(buildSubAgentInstruction({ sdr: { enabled: false, prompt: 'x' } })).toBe('')
  })

  it('11. active agents included', () => {
    const r = buildSubAgentInstruction({ sdr: { enabled: true, prompt: 'Qualifique' }, sales: { enabled: false, prompt: 'Venda' } })
    expect(r).toContain('Modo SDR')
    expect(r).toContain('Qualifique')
    expect(r).not.toContain('SALES')
  })
})

describe('resolveGreetingText — returning lead', () => {
  it('12. new lead = standard greeting', () => {
    const r = resolveGreetingText({ hasInteracted: false, hasEverInteracted: false, leadFullName: null, greetingMessage: 'Olá!', returningGreetingMessage: null })
    expect(r.type).toBe('new')
    expect(r.text).toBe('Olá!')
  })

  it('13. returning lead = personalized', () => {
    const r = resolveGreetingText({ hasInteracted: false, hasEverInteracted: true, leadFullName: 'Carlos', greetingMessage: 'Olá!', returningGreetingMessage: 'Oi {nome}!' })
    expect(r.type).toBe('returning')
    expect(r.text).toBe('Oi Carlos!')
  })

  it('14. active session = skip', () => {
    const r = resolveGreetingText({ hasInteracted: true, hasEverInteracted: true, leadFullName: 'Carlos', greetingMessage: 'Olá!', returningGreetingMessage: null })
    expect(r.type).toBe('skip')
  })
})
