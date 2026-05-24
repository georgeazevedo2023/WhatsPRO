import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const { buildHandoffPrompt, buildHandoffSpecialistDef } = await import('./handoffSpecialist.ts')

describe('buildHandoffPrompt', () => {
  it('exige reason rico (itens+qualif+objeções) e confirmação ao lead', () => {
    const p = buildHandoffPrompt({ agentName: 'Lucas', collectedFacts: 'interesse:tintas, cor:branco' })
    expect(p).toContain('handoff_to_human')
    expect(p).toContain('resumo completo')
    expect(p).toContain('interesse:tintas, cor:branco')
  })

  it('regra-chave (não reabrir qualif) por último', () => {
    const p = buildHandoffPrompt({ agentName: 'X', collectedFacts: '' })
    expect(p).toContain('SOBRESCREVE TUDO')
    expect(p).toContain('NÃO reabre qualificação')
  })
})

describe('buildHandoffSpecialistDef', () => {
  it('name=handoff, intent=handoff, tools handoff_to_human+send_poll, guard off', () => {
    const def = buildHandoffSpecialistDef()
    expect(def.name).toBe('handoff')
    expect(def.intent).toBe('handoff')
    const names = def.toolDefs.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['handoff_to_human', 'send_poll']))
    expect(def.disableHandoffGuard).toBe(true)
  })

  it('collectedFacts remove tags internas', () => {
    const def = buildHandoffSpecialistDef()
    const p = def.buildPrompt({
      agent: { name: 'X' },
      conversation: { tags: ['interesse:tintas', 'ia:ligada', 'lead_score:80'] },
    } as any)
    expect(p).toContain('interesse:tintas')
    expect(p).not.toContain('ia:ligada')
    expect(p).not.toContain('lead_score:80')
  })
})
