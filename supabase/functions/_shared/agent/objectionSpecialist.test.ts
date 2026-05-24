import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const { buildObjectionPrompt, buildObjectionSpecialistDef } = await import('./objectionSpecialist.ts')

describe('buildObjectionPrompt', () => {
  it('empatia-primeiro + value-anchoring + nunca desconto por conta própria', () => {
    const p = buildObjectionPrompt({ agentName: 'Lucas', priorObjections: 0 })
    expect(p).toContain('VALIDE')
    expect(p).toContain('REANCORE')
    expect(p).toContain('NUNCA ofereça desconto')
  })

  it('embute business_info (preços/pagamento)', () => {
    const p = buildObjectionPrompt({ agentName: 'X', businessInfo: 'PIX 5% off, parcela 12x', priorObjections: 0 })
    expect(p).toContain('PIX 5% off')
  })

  it('sugere escalar quando já houve objeção anterior', () => {
    const p = buildObjectionPrompt({ agentName: 'X', priorObjections: 2 })
    expect(p).toContain('handoff_to_human')
    expect(p).toContain('2 objeção')
  })

  it('regra-chave (empatia antes de argumento) por último', () => {
    const p = buildObjectionPrompt({ agentName: 'X', priorObjections: 0 })
    expect(p).toContain('SOBRESCREVE TUDO')
    expect(p).toContain('empatia SEMPRE vem antes')
  })
})

describe('buildObjectionSpecialistDef', () => {
  it('name=objection, intent=objecao, inclui handoff_to_human', () => {
    const def = buildObjectionSpecialistDef()
    expect(def.name).toBe('objection')
    expect(def.intent).toBe('objecao')
    const names = def.toolDefs.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['set_tags', 'update_lead_profile', 'handoff_to_human']))
    expect(def.disableHandoffGuard).toBe(true)
  })

  it('conta objeções anteriores das tags', () => {
    const def = buildObjectionSpecialistDef()
    const p = def.buildPrompt({
      agent: { name: 'X', business_info: 'info' },
      conversation: { tags: ['objecao:preco', 'objecao:prazo', 'ia:ligada'] },
    } as any)
    expect(p).toContain('2 objeção')
  })
})
