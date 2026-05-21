import { describe, it, expect } from 'vitest'
import {
  buildIncomingFromDbRows,
  buildIncomingFromQueue,
  calcLowerBoundTs,
  loadIncomingMessages,
  type IncomingMessageRow,
  type QueueMessageEntry,
} from './incomingMessagesLoader.ts'

describe('buildIncomingFromDbRows', () => {
  it('texto puro: content é usado', () => {
    const rows: IncomingMessageRow[] = [
      { content: 'Bom dia', transcription: null, media_type: 'text', created_at: '2026-05-21T11:23:04Z' },
    ]
    const result = buildIncomingFromDbRows(rows)
    expect(result.text).toBe('Bom dia')
    expect(result.hasAudio).toBe(false)
    expect(result.source).toBe('db')
  })

  it('R132 repro: áudio com content="" + transcription populated → transcription vence', () => {
    const rows: IncomingMessageRow[] = [
      { content: '', transcription: ' Você tem a quartisolite rejunto para a piscina?', media_type: 'audio', created_at: '2026-05-21T11:24:03Z' },
    ]
    const result = buildIncomingFromDbRows(rows)
    expect(result.text).toBe('Você tem a quartisolite rejunto para a piscina?')
    expect(result.hasAudio).toBe(true)
  })

  it('texto + áudio (Edson cenário real): concatena texto e transcrição', () => {
    const rows: IncomingMessageRow[] = [
      { content: 'Edson', transcription: null, media_type: 'text', created_at: '2026-05-21T11:23:44Z' },
      { content: '', transcription: 'Você tem a quartisolite rejunto para a piscina?', media_type: 'audio', created_at: '2026-05-21T11:24:03Z' },
    ]
    const result = buildIncomingFromDbRows(rows)
    expect(result.text).toBe('Edson\nVocê tem a quartisolite rejunto para a piscina?')
    expect(result.hasAudio).toBe(true)
    expect(result.count).toBe(2)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[1]).toMatchObject({
      content: 'Você tem a quartisolite rejunto para a piscina?',
      media_type: 'audio',
      direction: 'incoming',
    })
  })

  it('mensagens vazias são ignoradas (content="" + transcription=null)', () => {
    const rows: IncomingMessageRow[] = [
      { content: '', transcription: null, media_type: 'image', created_at: '2026-05-21T11:27:04Z' },
      { content: 'Vc tem', transcription: null, media_type: 'text', created_at: '2026-05-21T11:27:10Z' },
    ]
    const result = buildIncomingFromDbRows(rows)
    expect(result.text).toBe('Vc tem')
    expect(result.count).toBe(2)
  })

  it('transcription com whitespace ao redor é trimado', () => {
    const rows: IncomingMessageRow[] = [
      { content: '', transcription: '   olá   ', media_type: 'audio', created_at: '2026-05-21T11:24:03Z' },
    ]
    const result = buildIncomingFromDbRows(rows)
    expect(result.text).toBe('olá')
  })

  it('empty rows array → text vazio', () => {
    const result = buildIncomingFromDbRows([])
    expect(result.text).toBe('')
    expect(result.hasAudio).toBe(false)
    expect(result.count).toBe(0)
  })
})

describe('buildIncomingFromQueue (fallback)', () => {
  it('filtra outgoing mas mantém sem direction', () => {
    const queue: QueueMessageEntry[] = [
      { content: 'Olá', direction: 'incoming', timestamp: '2026-05-21T11:23:04Z' },
      { content: 'Resp', direction: 'outgoing', timestamp: '2026-05-21T11:23:24Z' },
      { content: 'Edson', timestamp: '2026-05-21T11:23:44Z' },
    ]
    const result = buildIncomingFromQueue(queue)
    expect(result.text).toBe('Olá\nEdson')
    expect(result.source).toBe('queue_fallback')
  })

  it('áudio com content="" some no fallback (é o bug R132)', () => {
    const queue: QueueMessageEntry[] = [
      { content: 'Edson', direction: 'incoming', media_type: 'text', timestamp: '2026-05-21T11:23:44Z' },
      { content: '', direction: 'incoming', media_type: 'audio', timestamp: '2026-05-21T11:24:03Z' },
    ]
    const result = buildIncomingFromQueue(queue)
    expect(result.text).toBe('Edson') // confirma que sem o fix B, áudio some
    expect(result.hasAudio).toBe(true)
  })
})

describe('calcLowerBoundTs', () => {
  it('subtrai 2s da primeira msg do queue', () => {
    const queue: QueueMessageEntry[] = [
      { content: 'a', timestamp: '2026-05-21T11:24:00.000Z' },
    ]
    expect(calcLowerBoundTs(queue, 2000)).toBe('2026-05-21T11:23:58.000Z')
  })

  it('queue vazio → pega últimos 30s', () => {
    const before = Date.now()
    const got = calcLowerBoundTs([])
    const gotMs = new Date(got).getTime()
    expect(before - gotMs).toBeGreaterThanOrEqual(30_000 - 100)
    expect(before - gotMs).toBeLessThanOrEqual(30_000 + 100)
  })
})

describe('loadIncomingMessages — integração com supabase mock', () => {
  function mkSupabase(rowsOrError: IncomingMessageRow[] | { error: string }) {
    const builder: any = {
      from: () => builder,
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      order: () => builder,
      limit: () =>
        Array.isArray(rowsOrError)
          ? Promise.resolve({ data: rowsOrError, error: null })
          : Promise.resolve({ data: null, error: { message: rowsOrError.error } }),
    }
    return builder
  }

  it('happy path: DB retorna rows → usa db', async () => {
    const supabase = mkSupabase([
      { content: 'Edson', transcription: null, media_type: 'text', created_at: '2026-05-21T11:23:44Z' },
      { content: '', transcription: 'Você tem quartisolite?', media_type: 'audio', created_at: '2026-05-21T11:24:03Z' },
    ])
    const result = await loadIncomingMessages(supabase, 'conv-1', [
      { content: 'Edson', direction: 'incoming', timestamp: '2026-05-21T11:23:44Z' },
    ])
    expect(result.source).toBe('db')
    expect(result.text).toContain('Edson')
    expect(result.text).toContain('Você tem quartisolite?')
  })

  it('DB error → fallback pro queue', async () => {
    const supabase = mkSupabase({ error: 'connection refused' })
    const result = await loadIncomingMessages(supabase, 'conv-1', [
      { content: 'Edson', direction: 'incoming', timestamp: '2026-05-21T11:23:44Z' },
    ])
    expect(result.source).toBe('queue_fallback')
    expect(result.text).toBe('Edson')
  })

  it('DB vazio → fallback pro queue', async () => {
    const supabase = mkSupabase([])
    const result = await loadIncomingMessages(supabase, 'conv-1', [
      { content: 'so no queue', direction: 'incoming', timestamp: '2026-05-21T11:23:44Z' },
    ])
    expect(result.source).toBe('queue_fallback')
    expect(result.text).toBe('so no queue')
  })

  it('exceção no supabase → fallback pro queue', async () => {
    const supabase: any = {
      from: () => { throw new Error('boom') },
    }
    const result = await loadIncomingMessages(supabase, 'conv-1', [
      { content: 'safe', direction: 'incoming', timestamp: '2026-05-21T11:23:44Z' },
    ])
    expect(result.source).toBe('queue_fallback')
    expect(result.text).toBe('safe')
  })
})
