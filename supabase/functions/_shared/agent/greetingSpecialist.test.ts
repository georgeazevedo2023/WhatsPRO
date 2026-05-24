import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const { buildGreetingPrompt, buildGreetingSpecialistDef } = await import('./greetingSpecialist.ts')

describe('buildGreetingPrompt', () => {
  it('inclui nome do agent e foco em abertura', () => {
    const p = buildGreetingPrompt({ agentName: 'Lucas', businessName: 'Eletropiso' })
    expect(p).toContain('Lucas')
    expect(p).toContain('Eletropiso')
    expect(p).toContain('ABERTURA')
  })

  it('pede o nome quando lead desconhecido e persiste via update_lead_profile', () => {
    const p = buildGreetingPrompt({ agentName: 'X', leadName: null })
    expect(p).toContain('ainda não disse o nome')
    expect(p).toContain('update_lead_profile')
    expect(p).toContain('full_name')
  })

  it('usa o nome quando lead é conhecido (não pede de novo)', () => {
    const p = buildGreetingPrompt({ agentName: 'X', leadName: 'Marcos' })
    expect(p).toContain('Marcos')
    expect(p).toContain('não peça o nome de novo')
  })

  it('regra-chave (não qualificar/buscar/handoff) vem por último', () => {
    const p = buildGreetingPrompt({ agentName: 'X' })
    expect(p).toContain('SOBRESCREVE TUDO')
    expect(p.trim().endsWith('leva pro especialista certo.')).toBe(true)
  })
})

describe('buildGreetingSpecialistDef', () => {
  it('name=greeting, intent=saudacao, 2 tools sem handoff', () => {
    const def = buildGreetingSpecialistDef()
    expect(def.name).toBe('greeting')
    expect(def.intent).toBe('saudacao')
    const toolNames = def.toolDefs.map((t) => t.name)
    expect(toolNames).toContain('set_tags')
    expect(toolNames).toContain('update_lead_profile')
    expect(toolNames).not.toContain('handoff_to_human')
    expect(toolNames).not.toContain('search_products')
  })

  it('buildPrompt lê nome conhecido das tags', () => {
    const def = buildGreetingSpecialistDef()
    const p = def.buildPrompt({
      agent: { name: 'Lucas' },
      conversation: { tags: ['lead_name:Ana', 'ia:ligada'] },
      leadProfile: null, profileData: null,
    } as any)
    expect(p).toContain('Ana')
  })
})
