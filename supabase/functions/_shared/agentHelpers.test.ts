import { describe, it, expect } from 'vitest'
import { mergeTags } from './agentHelpers.ts'

describe('mergeTags', () => {
  it('adds a new tag to an empty array', () => {
    expect(mergeTags([], { ia: 'shadow' })).toEqual(['ia:shadow'])
  })

  it('replaces value for existing key', () => {
    const result = mergeTags(['ia:ligada', 'campanha:promo'], { ia: 'handoff' })
    expect(result).toEqual(['ia:handoff', 'campanha:promo'])
  })

  it('adds multiple new tags', () => {
    const result = mergeTags(['ia:ligada'], { ia: 'shadow', status: 'ok' })
    expect(result).toContain('ia:shadow')
    expect(result).toContain('status:ok')
    expect(result).toHaveLength(2)
  })

  it('returns empty array when both inputs are empty', () => {
    expect(mergeTags([], {})).toEqual([])
  })
})

// STUB — implementation extracted from ai-agent in Task 2
// import { handleGreetingRpcError } from './agentHelpers'
// These stubs are placeholders; skip them until Task 2 extracts the function:
describe.skip('handleGreetingRpcError (stub — implemented in Task 2)', () => {
  it('returns greeting_rpc_error when greetError is non-null', () => {})
  it('returns greeting_duplicate when inserted is false', () => {})
  it('returns proceed when inserted is true', () => {})
})
