import { describe, it, expect } from 'vitest'
import { classifyLeadRecency, buildOpeningDirective } from './greetingPolicy.ts'

describe('classifyLeadRecency', () => {
  it('novo: primeiro contato (nunca interagiu, sem nome)', () => {
    expect(classifyLeadRecency({ hasInteracted: false, hasEverInteracted: false, fullName: null })).toBe('novo')
  })

  it('ativo: conversa em andamento (interagiu nas últimas 24h)', () => {
    expect(classifyLeadRecency({ hasInteracted: true, hasEverInteracted: true, fullName: 'George' })).toBe('ativo')
  })

  it('recorrente: tem nome + já interagiu antes + conversa esfriou', () => {
    expect(classifyLeadRecency({ hasInteracted: false, hasEverInteracted: true, fullName: 'George' })).toBe('recorrente')
  })

  it('P9: voltou mas SEM nome conhecido → trata como novo (não finge intimidade)', () => {
    expect(classifyLeadRecency({ hasInteracted: false, hasEverInteracted: true, fullName: null })).toBe('novo')
  })

  it('P9: nome vazio/whitespace não conta como conhecido', () => {
    expect(classifyLeadRecency({ hasInteracted: false, hasEverInteracted: true, fullName: '  ' })).toBe('novo')
  })

  it('equivalência com a lógica antiga do monolith (shouldGreet/isReturningLead)', () => {
    // Tabela-verdade: replica o que o monolith calculava inline antes do refactor.
    const cases = [
      { hasInteracted: false, hasEverInteracted: false, fullName: null },
      { hasInteracted: false, hasEverInteracted: true, fullName: 'Ana' },
      { hasInteracted: true, hasEverInteracted: true, fullName: 'Ana' },
      { hasInteracted: false, hasEverInteracted: true, fullName: null },
    ]
    for (const c of cases) {
      const recency = classifyLeadRecency(c)
      const isReturningOld = !!(c.fullName && c.fullName.trim()) && c.hasEverInteracted && !c.hasInteracted
      const shouldGreetOld = !c.hasInteracted // (parte de greeting_message é externa)
      expect(recency === 'recorrente').toBe(isReturningOld)
      expect(recency !== 'ativo').toBe(shouldGreetOld)
    }
  })
})

describe('buildOpeningDirective', () => {
  it('novo: cita a loja, espelha cumprimento, pede nome, responde produto junto (P1/P3/P4)', () => {
    const d = buildOpeningDirective({ recency: 'novo', agentName: 'Lucas', businessName: 'Eletropiso', leadName: null })!
    expect(d).toContain('Eletropiso')
    expect(d).toContain('ESPELHE')
    expect(d).toMatch(/com quem você fala/i)
    expect(d).toContain('PRIMEIRO CONTATO')
    expect(d).toMatch(/produto/i) // cobre o caso de abrir com produto
    // P5: registro de nome presente quando desconhecido
    expect(d).toContain('update_lead_profile')
  })

  it('recorrente: reconhece pelo nome, retoma memória, NÃO pede nome de novo (P2/P7)', () => {
    const d = buildOpeningDirective({ recency: 'recorrente', agentName: 'Lucas', businessName: 'Eletropiso', leadName: 'George' })!
    expect(d).toContain('George')
    expect(d).toContain('MEMÓRIA DO LEAD')
    expect(d).toContain('NÃO peça o nome de novo')
    expect(d).toContain('parcimônia')
    // recorrente já tem nome → NÃO injeta bloco de registro de nome
    expect(d).not.toContain('[REGISTRO DO NOME]')
  })

  it('ativo + nome conhecido: nada a injetar (null)', () => {
    expect(buildOpeningDirective({ recency: 'ativo', agentName: 'Lucas', leadName: 'George' })).toBeNull()
  })

  it('ativo + nome desconhecido: injeta SÓ o registro de nome (P5 mid-conversa)', () => {
    const d = buildOpeningDirective({ recency: 'ativo', agentName: 'Lucas', leadName: null })!
    expect(d).toContain('[REGISTRO DO NOME]')
    expect(d).not.toContain('PRIMEIRO CONTATO')
  })

  it('fallback do nome da loja: usa agentName quando businessName ausente', () => {
    const d = buildOpeningDirective({ recency: 'novo', agentName: 'Eletropiso', leadName: null })!
    expect(d).toContain('Eletropiso')
  })

  // Decisão A: saudação determinística por fora → diretiva só registra nome.
  it('greetingHandledExternally + nome desconhecido: SÓ registro de nome (sem cumprimento)', () => {
    const d = buildOpeningDirective({ recency: 'novo', agentName: 'Lucas', businessName: 'Eletropiso', leadName: null, greetingHandledExternally: true })!
    expect(d).toContain('[REGISTRO DO NOME]')
    expect(d).not.toContain('PRIMEIRO CONTATO')
    expect(d).not.toContain('Bem-vindo')
  })

  it('greetingHandledExternally + nome conhecido: nada a injetar (null)', () => {
    expect(buildOpeningDirective({ recency: 'recorrente', agentName: 'Lucas', leadName: 'George', greetingHandledExternally: true })).toBeNull()
  })
})
