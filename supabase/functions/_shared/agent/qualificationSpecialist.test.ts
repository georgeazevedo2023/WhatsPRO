import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const { buildQualificationPrompt, buildQualificationSpecialistDef } = await import('./qualificationSpecialist.ts')

describe('buildQualificationPrompt', () => {
  it('inclui uma-pergunta-por-vez e escape hatch anti-arg-inventado', () => {
    const p = buildQualificationPrompt({ agentName: 'Lucas', qualificationContext: '' })
    expect(p).toContain('Lucas')
    expect(p).toContain('UMA pergunta')
    expect(p).toContain('NUNCA invente')
  })

  it('embute o contexto determinístico quando há próxima pergunta', () => {
    const p = buildQualificationPrompt({
      agentName: 'X',
      qualificationContext: 'PRÓXIMA PERGUNTA OBRIGATÓRIA: ambiente',
    })
    expect(p).toContain('PRÓXIMA PERGUNTA OBRIGATÓRIA: ambiente')
  })

  it('regra-chave (só qualifica) por último', () => {
    const p = buildQualificationPrompt({ agentName: 'X', qualificationContext: '' })
    expect(p).toContain('SOBRESCREVE TUDO')
  })
})

describe('buildQualificationSpecialistDef', () => {
  it('name=qualification, intent=qualificacao, tools set_tags+update_lead_profile (sem handoff/search)', () => {
    const def = buildQualificationSpecialistDef()
    expect(def.name).toBe('qualification')
    expect(def.intent).toBe('qualificacao')
    const names = def.toolDefs.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['set_tags', 'update_lead_profile']))
    expect(names).not.toContain('handoff_to_human')
    expect(names).not.toContain('search_products')
  })

  it('buildPrompt roda sem throw com contexto mínimo', () => {
    const def = buildQualificationSpecialistDef()
    const p = def.buildPrompt({
      agent: { name: 'Lucas' },
      conversation: { tags: [] },
      geminiContents: [{ role: 'user', parts: [{ text: 'queria tinta' }] }],
    } as any)
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(50)
  })
})
