import { describe, it, expect, vi } from 'vitest'
import { loadActiveProfile, type ProfileRow } from './profileReader.ts'

type QueryResult = { data: ProfileRow | null; error: unknown }

function makeBuilder(result: QueryResult) {
  const b: any = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    maybeSingle: vi.fn(async () => result),
  }
  return b
}

function makeSupabase(plan: {
  byFunnel?: QueryResult
  byDefault?: QueryResult
  throwOn?: 'funnel' | 'default'
}) {
  const calls: Array<{ table: string; via: 'funnel' | 'default' }> = []
  let nextCall: 'funnel' | 'default' | null = null
  const supabase = {
    from(table: string) {
      // Distingue funnel-lookup vs default-lookup pela ordem das chamadas eq.
      // Estratégia: a 1ª chamada após `select(...)` é eq('id') (funnel) ou eq('agent_id') (default).
      const b: any = {
        select: vi.fn(() => b),
        eq: vi.fn((col: string) => {
          if (col === 'id' && nextCall === null) nextCall = 'funnel'
          if (col === 'agent_id' && nextCall === null) nextCall = 'default'
          return b
        }),
        maybeSingle: vi.fn(async () => {
          const via = nextCall || 'default'
          calls.push({ table, via })
          if (plan.throwOn === via) throw new Error('db error')
          const result = via === 'funnel' ? plan.byFunnel : plan.byDefault
          nextCall = null
          return result || { data: null, error: null }
        }),
      }
      return b
    },
    _calls: calls,
  }
  return supabase
}

const SAMPLE_PROFILE: ProfileRow = {
  id: 'p-1',
  prompt: 'Você é o SDR',
  handoff_rule: 'so_se_pedir',
  handoff_max_messages: 8,
  handoff_department_id: null,
  handoff_message: null,
}

describe('loadActiveProfile', () => {
  it('retorna perfil do funil quando funnelProfileId aponta para profile ativo', async () => {
    const sb = makeSupabase({ byFunnel: { data: SAMPLE_PROFILE, error: null } })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1', funnelProfileId: 'p-1' })
    expect(r).toEqual(SAMPLE_PROFILE)
    expect(sb._calls).toHaveLength(1)
    expect(sb._calls[0]).toEqual({ table: 'agent_profiles', via: 'funnel' })
  })

  it('cai pro default quando funnelProfileId nao encontra profile (disabled ou inexistente)', async () => {
    const sb = makeSupabase({
      byFunnel: { data: null, error: null },
      byDefault: { data: SAMPLE_PROFILE, error: null },
    })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1', funnelProfileId: 'p-x' })
    expect(r).toEqual(SAMPLE_PROFILE)
    expect(sb._calls).toHaveLength(2)
    expect(sb._calls[1].via).toBe('default')
  })

  it('busca default quando funnelProfileId eh null', async () => {
    const sb = makeSupabase({ byDefault: { data: SAMPLE_PROFILE, error: null } })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1', funnelProfileId: null })
    expect(r).toEqual(SAMPLE_PROFILE)
    expect(sb._calls).toHaveLength(1)
    expect(sb._calls[0].via).toBe('default')
  })

  it('busca default quando funnelProfileId eh undefined', async () => {
    const sb = makeSupabase({ byDefault: { data: SAMPLE_PROFILE, error: null } })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1' })
    expect(r).toEqual(SAMPLE_PROFILE)
    expect(sb._calls).toHaveLength(1)
    expect(sb._calls[0].via).toBe('default')
  })

  it('retorna null quando agente nao tem default profile', async () => {
    const sb = makeSupabase({ byDefault: { data: null, error: null } })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1' })
    expect(r).toBeNull()
  })

  it('retorna null quando agentId vazio e funil nao casa', async () => {
    const sb = makeSupabase({ byFunnel: { data: null, error: null } })
    const r = await loadActiveProfile(sb as any, { agentId: '', funnelProfileId: 'p-x' })
    expect(r).toBeNull()
    // Nao deve chamar default lookup quando agentId vazio (curto-circuito)
    expect(sb._calls).toHaveLength(1)
  })

  it('retorna null quando agentId vazio e sem funnelProfileId', async () => {
    const sb = makeSupabase({})
    const r = await loadActiveProfile(sb as any, { agentId: '' })
    expect(r).toBeNull()
    expect(sb._calls).toHaveLength(0)
  })

  it('captura erro do DB e retorna null sem propagar', async () => {
    const sb = makeSupabase({ throwOn: 'default' })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1' })
    expect(r).toBeNull()
  })

  it('erro no lookup por funil tambem retorna null (sem cascade)', async () => {
    // try/catch global engole erro do funnel lookup tambem.
    const sb = makeSupabase({ throwOn: 'funnel' })
    const r = await loadActiveProfile(sb as any, { agentId: 'a-1', funnelProfileId: 'p-x' })
    expect(r).toBeNull()
  })
})
