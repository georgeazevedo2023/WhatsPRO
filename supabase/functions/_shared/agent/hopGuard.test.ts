import { describe, it, expect, vi } from 'vitest'
import { checkHopLimit, generateTurnId } from './hopGuard.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabase(rows: any[], error: any = null) {
  return {
    from(_table: string) {
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: any) => Promise.resolve({ data: rows, error }),
        }),
        insert: (_payload: any) => Promise.resolve({ data: null, error: null }),
      }
    },
  }
}

describe('checkHopLimit', () => {
  it('permite hop 0 (turn_id sem rows)', async () => {
    const result = await checkHopLimit({
      supabase: makeSupabase([]),
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      log: makeLog() as any,
    })
    expect(result.allow).toBe(true)
    expect(result.hopsSoFar).toBe(0)
    expect(result.reason).toBe('ok')
  })

  it('permite hop 1 (turn_id com 1 row router)', async () => {
    const result = await checkHopLimit({
      supabase: makeSupabase([{ hop_n: 0 }]),
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      log: makeLog() as any,
    })
    expect(result.allow).toBe(true)
    expect(result.hopsSoFar).toBe(1)
  })

  it('bloqueia hop 2 (turn_id já tem 2 rows = router + specialist)', async () => {
    const log = makeLog()
    const result = await checkHopLimit({
      supabase: makeSupabase([{ hop_n: 0 }, { hop_n: 1 }]),
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      log: log as any,
    })
    expect(result.allow).toBe(false)
    expect(result.hopsSoFar).toBe(2)
    expect(result.reason).toContain('loop_detected')
    expect(log.error).toHaveBeenCalled()
  })

  it('respeita maxHops customizado', async () => {
    const result = await checkHopLimit({
      supabase: makeSupabase([{ hop_n: 0 }]),
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      maxHops: 1,
      log: makeLog() as any,
    })
    expect(result.allow).toBe(false)
    expect(result.hopsSoFar).toBe(1)
  })

  it('DB error → allow=true (defensive, não bloqueia pipeline)', async () => {
    const log = makeLog()
    const result = await checkHopLimit({
      supabase: makeSupabase([], { message: 'db down' }),
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      log: log as any,
    })
    expect(result.allow).toBe(true)
    expect(result.reason).toBe('db_error_default_allow')
    expect(log.warn).toHaveBeenCalled()
  })

  it('exception inesperada → allow=true (defensive)', async () => {
    const log = makeLog()
    const supabase: any = {
      from: () => {
        throw new Error('total meltdown')
      },
    }
    const result = await checkHopLimit({
      supabase,
      turn_id: 't1',
      agent_id: 'a',
      conversation_id: 'c',
      log: log as any,
    })
    expect(result.allow).toBe(true)
    expect(result.reason).toBe('unexpected_default_allow')
    expect(log.warn).toHaveBeenCalled()
  })
})

describe('generateTurnId', () => {
  it('retorna UUID v4 válido', () => {
    const id = generateTurnId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('gera UUIDs distintos em chamadas consecutivas', () => {
    const a = generateTurnId()
    const b = generateTurnId()
    expect(a).not.toBe(b)
  })
})
