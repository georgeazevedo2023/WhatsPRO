import { describe, it, expect, beforeEach } from 'vitest'
import { cacheGet, cacheSet, cacheClear, AGENT_CONFIG_TTL_MS } from './agentConfigCache'

describe('agentConfigCache', () => {
  beforeEach(() => cacheClear())

  it('devolve undefined em miss', () => {
    expect(cacheGet('agent:x')).toBeUndefined()
  })

  it('devolve o valor dentro do TTL', () => {
    const agent = { id: 'a1', enabled: true, prompt: 'p' }
    cacheSet('agent:a1', agent, AGENT_CONFIG_TTL_MS, 1_000)
    expect(cacheGet('agent:a1', 1_000 + AGENT_CONFIG_TTL_MS - 1)).toBe(agent)
  })

  it('expira exatamente no TTL (>=) e limpa a entrada', () => {
    cacheSet('agent:a1', { id: 'a1' }, AGENT_CONFIG_TTL_MS, 1_000)
    expect(cacheGet('agent:a1', 1_000 + AGENT_CONFIG_TTL_MS)).toBeUndefined()
    // depois de expirado, um novo get (mesmo com now antigo) segue miss — entrada deletada
    expect(cacheGet('agent:a1', 1_000)).toBeUndefined()
  })

  it('chaves independentes (agent vs kb)', () => {
    cacheSet('agent:a1', { id: 'a1' }, AGENT_CONFIG_TTL_MS, 0)
    cacheSet('kb:a1', [{ title: 't' }], AGENT_CONFIG_TTL_MS, 0)
    expect(cacheGet<{ id: string }>('agent:a1', 1)?.id).toBe('a1')
    expect(cacheGet<Array<{ title: string }>>('kb:a1', 1)?.[0]?.title).toBe('t')
  })

  it('cacheSet sobrescreve valor e renova TTL', () => {
    cacheSet('agent:a1', { v: 1 }, AGENT_CONFIG_TTL_MS, 0)
    cacheSet('agent:a1', { v: 2 }, AGENT_CONFIG_TTL_MS, 50_000)
    expect(cacheGet<{ v: number }>('agent:a1', 100_000)?.v).toBe(2)
  })

  it('cacheClear zera tudo', () => {
    cacheSet('agent:a1', { id: 'a1' }, AGENT_CONFIG_TTL_MS, 0)
    cacheClear()
    expect(cacheGet('agent:a1', 1)).toBeUndefined()
  })
})
