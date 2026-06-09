import { describe, it, expect } from 'vitest'
import {
  shouldReopenConversation,
  REOPEN_WINDOW_DAYS_DEFAULT,
  type ReopenCandidate,
} from './conversationReopen.ts'

const NOW = new Date('2026-05-17T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86400000).toISOString()
}

describe('shouldReopenConversation (D34)', () => {
  it('returns no_candidate when input is null', () => {
    const d = shouldReopenConversation(null, NOW)
    expect(d.reopen).toBe(false)
    expect(d.reason).toBe('no_candidate')
  })

  it('returns no_resolved_at when candidate lacks resolved_at', () => {
    const c: ReopenCandidate = { id: 'c1', tags: ['interesse:tintas'], resolved_at: null }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(false)
    expect(d.reason).toBe('no_resolved_at')
  })

  it('reopens when resolved 2 days ago and tags preserved', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: ['interesse:tintas', 'motivo:compra'],
      resolved_at: daysAgo(2),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(true)
    expect(d.reason).toBe('reopen')
    expect(d.mergedTags).toEqual(['interesse:tintas', 'motivo:compra', 'reaberta:2026-05-17'])
    expect(d.reopenTag).toBe('reaberta:2026-05-17')
  })

  it('reopens at the exact 60d boundary', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: [],
      resolved_at: daysAgo(60),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(true)
  })

  it('does NOT reopen after 61d (outside window)', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: ['interesse:tintas'],
      resolved_at: daysAgo(61),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(false)
    expect(d.reason).toBe('outside_window')
  })

  it('does NOT reopen when tagged as spam', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: ['resultado:spam', 'motivo:compra'],
      resolved_at: daysAgo(5),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(false)
    expect(d.reason).toBe('spam')
  })

  it('reopens venda fechada (cliente recorrente)', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: ['resultado:venda', 'valor:150000', 'interesse:tintas'],
      resolved_at: daysAgo(15),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(true)
    expect(d.mergedTags).toContain('resultado:venda')
    expect(d.mergedTags).toContain('reaberta:2026-05-17')
  })

  it('does NOT duplicate reaberta tag when same day reopen happens twice', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: ['interesse:tintas', 'reaberta:2026-05-17'],
      resolved_at: daysAgo(1),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(true)
    expect(d.mergedTags?.filter(t => t === 'reaberta:2026-05-17').length).toBe(1)
  })

  it('strips handoff/control + loop tags on reopen, keeps business tags (2026-06-09)', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: [
        'interesse:cabos', 'cidade:circleyton',
        'handoff_created:true', 'human_assigned:true', 'seller_notified:true',
        'followups_paused:true', 'agent_status:inactive', 'handoff_at:1749480000000',
        'enriching:1', 'enrich_count:2', 'questions_after_empty:2',
        'catalog_result:empty', 'physical_stock_required:true',
        'flow_mode:qualify_then_handoff', 'search_fail:1', 'seller_handoff_pending:cabos',
      ],
      resolved_at: daysAgo(3),
    }
    const d = shouldReopenConversation(c, NOW)
    expect(d.reopen).toBe(true)
    // tags de negócio preservadas
    expect(d.mergedTags).toContain('interesse:cabos')
    expect(d.mergedTags).toContain('cidade:circleyton')
    expect(d.mergedTags).toContain('reaberta:2026-05-17')
    // tags de controle/loop removidas → conversa reaberta nasce com IA atendendo
    for (const stripped of [
      'handoff_created:true', 'human_assigned:true', 'seller_notified:true',
      'followups_paused:true', 'agent_status:inactive', 'handoff_at:1749480000000',
      'enriching:1', 'enrich_count:2', 'questions_after_empty:2', 'catalog_result:empty',
      'physical_stock_required:true', 'flow_mode:qualify_then_handoff', 'search_fail:1',
      'seller_handoff_pending:cabos',
    ]) {
      expect(d.mergedTags).not.toContain(stripped)
    }
  })

  it('honors custom windowDays', () => {
    const c: ReopenCandidate = {
      id: 'c1',
      tags: [],
      resolved_at: daysAgo(35),
    }
    const tight = shouldReopenConversation(c, NOW, { windowDays: 30 })
    expect(tight.reopen).toBe(false)
    expect(tight.reason).toBe('outside_window')

    const loose = shouldReopenConversation(c, NOW, { windowDays: 90 })
    expect(loose.reopen).toBe(true)
  })

  it('REOPEN_WINDOW_DAYS_DEFAULT is 60', () => {
    expect(REOPEN_WINDOW_DAYS_DEFAULT).toBe(60)
  })
})
