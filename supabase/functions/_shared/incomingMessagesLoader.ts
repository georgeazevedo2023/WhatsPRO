// R132 (2026-05-21): re-leitura da tabela conversation_messages antes do LLM
// pra cobrir race conditions Camada 3 — mensagens novas chegando durante o
// debounce timer (R126 Camada 3), transcrições de áudio que chegaram tarde
// (R132 Edson) e múltiplas msgs combinadas (C8). Fix B do trio A/B/C.
//
// O queue do debounce é a fonte primária; a leitura da tabela complementa.
// Quando há divergência, a tabela ganha (é o estado real do que o lead enviou).

export type IncomingMessageRow = {
  content: string | null
  transcription: string | null
  media_type: string | null
  created_at: string
}

export type QueueMessageEntry = {
  content?: string | null
  direction?: string
  media_type?: string | null
  media_url?: string | null
  timestamp?: string
}

export type NormalizedMessage = {
  content: string
  direction: 'incoming'
  media_type: string | null
  timestamp: string
}

export type IncomingMessagesResult = {
  text: string
  hasAudio: boolean
  messages: NormalizedMessage[]
  source: 'db' | 'queue_fallback'
  count: number
}

/**
 * Constrói result a partir de rows da tabela conversation_messages.
 * Prioriza transcription sobre content (áudio com content="" + transcription populated).
 */
export function buildIncomingFromDbRows(rows: IncomingMessageRow[]): IncomingMessagesResult {
  const messages: NormalizedMessage[] = []
  let hasAudio = false
  for (const row of rows) {
    const t = (row.transcription || '').trim()
    const c = (row.content || '').trim()
    const text = t || c
    if (text) {
      messages.push({
        content: text,
        direction: 'incoming',
        media_type: row.media_type,
        timestamp: row.created_at,
      })
    }
    if (row.media_type === 'audio') hasAudio = true
  }
  return {
    text: messages.map((m) => m.content).join('\n'),
    hasAudio,
    messages,
    source: 'db',
    count: rows.length,
  }
}

/**
 * Fallback puro a partir do queue (caso a query DB falhe). Mantém o comportamento
 * pré-R132. Áudio com content="" some — é o bug que o caminho DB corrige.
 */
export function buildIncomingFromQueue(queue: QueueMessageEntry[]): IncomingMessagesResult {
  const incoming = queue.filter((m) => m.direction === 'incoming' || !m.direction)
  const messages: NormalizedMessage[] = incoming
    .map((m) => ({
      content: (m.content || '').trim(),
      direction: 'incoming' as const,
      media_type: m.media_type ?? null,
      timestamp: m.timestamp || new Date().toISOString(),
    }))
    .filter((m) => m.content.length > 0)
  const hasAudio = incoming.some((m) => m.media_type === 'audio')
  return {
    text: messages.map((m) => m.content).join('\n'),
    hasAudio,
    messages,
    source: 'queue_fallback',
    count: incoming.length,
  }
}

/**
 * Calcula o lower-bound timestamp pra query: timestamp da primeira msg do queue
 * menos um buffer pra capturar msgs que chegaram alguns ms antes do enfileiramento.
 */
export function calcLowerBoundTs(queue: QueueMessageEntry[], bufferMs = 2000): string {
  const first = queue.find((m) => m.timestamp)?.timestamp
  if (first) {
    return new Date(new Date(first).getTime() - bufferMs).toISOString()
  }
  // Sem timestamp no queue: pega últimos 30s
  return new Date(Date.now() - 30_000).toISOString()
}

/**
 * Carrega mensagens incoming da tabela e constrói o texto + flags.
 * Em caso de erro/dados vazios, faz fallback pro queue.
 */
export async function loadIncomingMessages(
  supabase: any,
  conversation_id: string,
  queue: QueueMessageEntry[],
): Promise<IncomingMessagesResult> {
  try {
    const sinceIso = calcLowerBoundTs(queue)
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('content, transcription, media_type, created_at')
      .eq('conversation_id', conversation_id)
      .eq('direction', 'incoming')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(20)

    if (error || !Array.isArray(data) || data.length === 0) {
      return buildIncomingFromQueue(queue)
    }
    return buildIncomingFromDbRows(data as IncomingMessageRow[])
  } catch {
    return buildIncomingFromQueue(queue)
  }
}
