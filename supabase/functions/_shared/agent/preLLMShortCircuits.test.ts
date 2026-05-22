import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPreLLMShortCircuits } from './preLLMShortCircuits.ts'
import type { PreLLMShortCircuitsCtx } from './preLLMShortCircuits.ts'

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

/**
 * Mock supabase com 2 tabelas usadas pelo módulo:
 *   - conversations.update(...).eq(...) → registra payload
 *   - ai_agent_logs.insert(...) → registra payload
 *   - conversation_messages.insert(...).select(...).single() → retorna id+created_at
 */
function makeSupabaseSpy() {
  const calls: Array<{ table: string; op: string; payload: any; filter?: any }> = []
  const supabase: any = {
    from(table: string) {
      const chain: any = {
        update(payload: any) {
          calls.push({ table, op: 'update', payload })
          return {
            eq(_col: string, val: any) {
              calls[calls.length - 1].filter = val
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload })
          // Quando for conversation_messages, encadeia select().single()
          if (table === 'conversation_messages') {
            return {
              select(_cols: string) {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'msg-id-mock', created_at: '2026-05-21T20:00:00.000Z' },
                      error: null,
                    })
                  },
                }
              },
            }
          }
          return Promise.resolve({ data: null, error: null })
        },
      }
      return chain
    },
  }
  return { supabase, calls }
}

const STAGE = {
  id: 's1',
  label: 'discovery',
  min_score: 0,
  max_score: 100,
  fields: [],
  exit_action: 'handoff',
  phrasing: 'me conta {label}?',
}

const DEFAULT_AGENT = {
  service_categories: {
    default: { stages: [STAGE] },
    categories: [
      {
        id: 'portas',
        label: 'Portas',
        interesse_match: 'porta|portas|porta de entrada',
        catalog_status: 'offline',
        stages: [STAGE],
      },
      {
        id: 'janelas',
        label: 'Janelas',
        interesse_match: 'janela|janelas',
        catalog_status: 'offline',
        stages: [STAGE],
      },
      {
        id: 'tintas',
        label: 'Tintas',
        interesse_match: 'tinta|tintas|esmalte|verniz',
        catalog_status: 'digital',
        stages: [STAGE],
      },
    ],
  },
}

function baseCtx(overrides: Partial<PreLLMShortCircuitsCtx> = {}): PreLLMShortCircuitsCtx {
  const { supabase } = makeSupabaseSpy()
  return {
    supabase,
    conversation: { id: 'conv-1', inbox_id: 'inb-1', tags: [], status_ia: 'active' },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    agent: DEFAULT_AGENT,
    incomingText: '',
    leadName: 'Paloma Pinheiro',
    queuedMessages: [{ a: 1 }, { a: 2 }],
    startTime: Date.now() - 100,
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    sendTextMsg: vi.fn(async () => undefined),
    broadcastEvent: vi.fn(),
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────
// Guards de entrada
// ────────────────────────────────────────────────────────────────────

describe('runPreLLMShortCircuits — guards', () => {
  it('retorna shortCircuited=false quando incomingText vazio', async () => {
    const ctx = baseCtx({ incomingText: '' })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false)
    expect(r.response).toBeNull()
    expect(r.suppressAutoExtractForMulti).toBe(false)
  })

  it('retorna shortCircuited=false quando incomingText só espaços', async () => {
    const ctx = baseCtx({ incomingText: '   \n   ' })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────────────────
// R136 — Multi-item misto
// ────────────────────────────────────────────────────────────────────

describe('R136 — multi-item misto', () => {
  it('detecta lista numerada mista e dispara pergunta horizontal', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      // Lista numerada: tintas casa, "massa PVA" e "lixas" não casam → mixed
      incomingText: '1 massa PVA\n1 latao de tinta branca\n15 lixas dagua',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())

    expect(r.shortCircuited).toBe(true)
    expect(r.response).not.toBeNull()
    expect(r.suppressAutoExtractForMulti).toBe(false)
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(1)
    expect(ctx.broadcastEvent).toHaveBeenCalledTimes(1)

    // Tag persistida
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update).toBeTruthy()
    expect(update!.payload.tags).toContain('qualif_horizontal:pending')

    // Logs disparados
    const logs = spy.calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logs.length).toBe(2)
    expect(logs[0].payload.event).toBe('auto_field_extracted')
    expect(logs[0].payload.metadata.source).toBe('r136_multi_item_horizontal')
    expect(logs[1].payload.event).toBe('response_sent')
    expect(logs[1].payload.metadata.source).toBe('r136_multi_item_horizontal_ask')
    expect(logs[1].payload.metadata.message_count).toBe(2)

    // Conversation tags mutadas em memória
    expect(ctx.conversation.tags).toContain('qualif_horizontal:pending')
  })

  it('NÃO dispara quando tag qualif_horizontal:pending já existe', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      conversation: { tags: ['qualif_horizontal:pending'], inbox_id: 'inb-1' },
      incomingText: '1 massa PVA\n1 latao de tinta\n15 lixas',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    // R129 também não dispara (já tem tag pending? não, é diferente). Mas multi-categoria
    // só roda se NÃO houver multi_interesse_pending — aqui texto tem tinta apenas → 1 cat.
    expect(r.shortCircuited).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })

  it('fallback pro LLM quando sendTextMsg falha (tag fica persistida)', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: '1 massa PVA\n1 latao de tinta\n15 lixas',
      sendTextMsg: vi.fn(async () => {
        throw new Error('uazapi down')
      }),
    })
    const log = makeLog()
    const r = await runPreLLMShortCircuits(ctx, log)

    expect(r.shortCircuited).toBe(false)
    expect(r.response).toBeNull()
    expect(log.warn).toHaveBeenCalledWith(
      'R136: send horizontal question failed, fallback to LLM',
      expect.objectContaining({ error: 'uazapi down' }),
    )

    // Mesmo no fallback, tag e log auto_field_extracted ficam persistidos
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update!.payload.tags).toContain('qualif_horizontal:pending')
    const logs = spy.calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logs.length).toBe(1)
    expect(logs[0].payload.metadata.source).toBe('r136_multi_item_horizontal')
  })

  it('NÃO dispara quando lista detectada mas todos items casam (não-mixed)', async () => {
    // Lista numerada toda de tintas → multiItem.detected=true mas mixed=false
    const ctx = baseCtx({
      incomingText: '1 tinta acrilica\n2 tinta esmalte\n3 verniz brilhante',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    // Pode cair em R129 (tintas só bate em 1 categoria) → não dispara nada
    expect(r.shortCircuited).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────────────────
// R129 — Multi-categoria sem interesse
// ────────────────────────────────────────────────────────────────────

describe('R129 — multi-categoria', () => {
  it('detecta 2 categorias e dispara pergunta direta', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: 'quero porta e janela pra casa nova',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())

    expect(r.shortCircuited).toBe(true)
    expect(r.suppressAutoExtractForMulti).toBe(true)
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(1)

    const askedText = (ctx.sendTextMsg as any).mock.calls[0][0] as string
    expect(askedText).toContain('portas')
    expect(askedText).toContain('janelas')
    expect(askedText).toMatch(/prefere começar/)

    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update!.payload.tags).toContain('multi_interesse_pending:portas,janelas')

    const logs = spy.calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logs[0].payload.metadata.source).toBe('r129_multi_interesse_detected')
    expect(logs[1].payload.metadata.source).toBe('r129_multi_interesse_ask')
    expect(logs[1].payload.metadata.category_ids).toEqual(['portas', 'janelas'])
  })

  it('monta texto com 3 categorias usando "A, B e C"', async () => {
    const ctx = baseCtx({
      incomingText: 'quero porta janela e tinta pro projeto',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(true)
    const askedText = (ctx.sendTextMsg as any).mock.calls[0][0] as string
    // "portas, janelas e tintas" (ordem da config)
    expect(askedText).toMatch(/portas, janelas e tintas/)
  })

  it('NÃO dispara quando tag interesse: já existe', async () => {
    const ctx = baseCtx({
      conversation: { tags: ['interesse:portas'], inbox_id: 'inb-1' },
      incomingText: 'quero porta e janela',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false)
    expect(r.suppressAutoExtractForMulti).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })

  it('NÃO dispara quando tag multi_interesse_pending: já existe (R134 guard)', async () => {
    const ctx = baseCtx({
      conversation: {
        tags: ['multi_interesse_pending:portas,janelas'],
        inbox_id: 'inb-1',
      },
      incomingText: 'quero porta e janela',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false)
    expect(r.suppressAutoExtractForMulti).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })

  it('NÃO dispara com 1 categoria só (fluxo normal)', async () => {
    const ctx = baseCtx({ incomingText: 'me manda preco da tinta acrilica' })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })

  it('fallback pro LLM com suppressAutoExtractForMulti=true quando send falha', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: 'quero porta e janela',
      sendTextMsg: vi.fn(async () => {
        throw new Error('uazapi 500')
      }),
    })
    const log = makeLog()
    const r = await runPreLLMShortCircuits(ctx, log)

    expect(r.shortCircuited).toBe(false)
    expect(r.suppressAutoExtractForMulti).toBe(true) // tag já persistida
    expect(log.warn).toHaveBeenCalledWith(
      'R129: send ask failed, fallback to LLM with prompt hint',
      expect.objectContaining({ error: 'uazapi 500' }),
    )
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update!.payload.tags).toContain('multi_interesse_pending:portas,janelas')
  })
})

// ────────────────────────────────────────────────────────────────────
// Ordem R136 > R129
// ────────────────────────────────────────────────────────────────────

describe('Ordem R136 > R129', () => {
  it('lista multi-item mista detectada vence multi-categoria', async () => {
    const spy = makeSupabaseSpy()
    // Lista numerada mista (tintas + orfãos) MAS o texto também casaria multi-categoria
    // se R129 testasse — porta E janela aparecem em items.
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: '1 porta de entrada\n1 janela aluminio\n5 massa pva',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(true)

    const logs = spy.calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logs[0].payload.metadata.source).toBe('r136_multi_item_horizontal')
    // R129 não deve ter rodado (sem log r129_*)
    expect(logs.find((l) => l.payload.metadata.source?.startsWith('r129_'))).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────────────────
// Bug #7 fix (2026-05-22): extrai fields ricos antes do short-circuit
// ────────────────────────────────────────────────────────────────────

const RICH_STAGE_PORTAS = {
  id: 'portas-stage',
  label: 'qualif portas',
  min_score: 0,
  max_score: 100,
  fields: [
    { key: 'subtipo_porta', label: 'subtipo', examples: 'entrada, interna, externa, social', score_value: 20, priority: 1 },
    { key: 'material_porta', label: 'material', examples: 'madeira, alumínio, PVC, aço', score_value: 20, priority: 2 },
  ],
  exit_action: 'handoff',
  phrasing: 'qual {label}?',
}

const RICH_STAGE_JANELAS = {
  id: 'janelas-stage',
  label: 'qualif janelas',
  min_score: 0,
  max_score: 100,
  fields: [
    { key: 'tipo_janela', label: 'tipo', examples: 'basculante, correr, maxim-ar', score_value: 20, priority: 1 },
  ],
  exit_action: 'handoff',
  phrasing: 'qual {label}?',
}

const RICH_STAGE_TINTAS = {
  id: 'tintas-stage',
  label: 'qualif tintas',
  min_score: 0,
  max_score: 100,
  fields: [
    { key: 'ambiente', label: 'ambiente', examples: 'interno, externo', score_value: 15, priority: 1 },
    { key: 'acabamento', label: 'acabamento', examples: 'fosco, acetinado, brilho', score_value: 15, priority: 2 },
  ],
  exit_action: 'handoff',
  phrasing: 'qual {label}?',
}

const RICH_AGENT = {
  service_categories: {
    default: { stages: [STAGE] },
    categories: [
      {
        id: 'portas',
        label: 'Portas',
        interesse_match: 'porta|portas',
        catalog_status: 'offline',
        stages: [RICH_STAGE_PORTAS],
      },
      {
        id: 'janelas',
        label: 'Janelas',
        interesse_match: 'janela|janelas',
        catalog_status: 'offline',
        stages: [RICH_STAGE_JANELAS],
      },
      {
        id: 'tintas',
        label: 'Tintas',
        interesse_match: 'tinta|tintas',
        catalog_status: 'digital',
        stages: [RICH_STAGE_TINTAS],
      },
    ],
  },
}

describe('Bug #7 — rich field extraction antes do short-circuit', () => {
  it('R129 extrai subtipo_porta:entrada + material_porta:madeira da msg original', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      agent: RICH_AGENT,
      incomingText: 'quero porta de entrada de madeira e janela basculante',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())

    expect(r.shortCircuited).toBe(true)

    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update).toBeTruthy()
    // Tags deveriam incluir multi_pending + subtipo:entrada + material:madeira + tipo_janela:basculante
    const tags: string[] = update!.payload.tags
    expect(tags.some((t) => t.startsWith('multi_interesse_pending:'))).toBe(true)
    expect(tags).toContain('subtipo_porta:entrada')
    expect(tags).toContain('material_porta:madeira')
    expect(tags).toContain('tipo_janela:basculante')

    // Log deve incluir rich_extracted
    const logIns = spy.calls.find(
      (c) => c.table === 'ai_agent_logs' && c.op === 'insert' && c.payload.metadata?.source === 'r129_multi_interesse_detected',
    )
    expect(logIns!.payload.metadata.rich_extracted).toBeTruthy()
    expect(logIns!.payload.metadata.rich_extracted.length).toBe(3)
  })

  it('R129 não duplica tags quando key já existe', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      agent: RICH_AGENT,
      conversation: { tags: ['material_porta:aluminio'], inbox_id: 'inb-1' },
      incomingText: 'quero porta de entrada de madeira e janela',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(true)

    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    const tags: string[] = update!.payload.tags
    // material_porta:aluminio preservado, madeira NÃO adicionado
    expect(tags).toContain('material_porta:aluminio')
    expect(tags).not.toContain('material_porta:madeira')
    expect(tags.filter((t) => t.startsWith('material_porta:')).length).toBe(1)
    // subtipo:entrada extraído normalmente
    expect(tags).toContain('subtipo_porta:entrada')
  })

  it('R136 extrai ambiente + acabamento na lista multi-item mista', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      agent: RICH_AGENT,
      // Lista mista: tinta casa (com "fosco" e "interno"), massa+lixas são orphans
      incomingText: '1 massa PVA\n1 latao de tinta fosco interno\n15 lixas',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(true)

    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    const tags: string[] = update!.payload.tags
    expect(tags.some((t) => t === 'qualif_horizontal:pending')).toBe(true)
    expect(tags).toContain('ambiente:interno')
    expect(tags).toContain('acabamento:fosco')

    const logIns = spy.calls.find(
      (c) => c.table === 'ai_agent_logs' && c.op === 'insert' && c.payload.metadata?.source === 'r136_multi_item_horizontal',
    )
    expect(logIns!.payload.metadata.rich_extracted.length).toBeGreaterThanOrEqual(2)
  })

  it('R129 sem fields ricos cadastrados (agent default) não falha', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      // DEFAULT_AGENT tem fields=[] no stage
      incomingText: 'quero porta e janela pra obra',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(true)
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    const tags: string[] = update!.payload.tags
    expect(tags.some((t) => t.startsWith('multi_interesse_pending:'))).toBe(true)
    // Não há fields ricos pra extrair → só a tag pending
    const richTags = tags.filter(
      (t) => !t.startsWith('multi_interesse_pending:') && !t.startsWith('ia_cleared:'),
    )
    expect(richTags.length).toBe(0)
  })

  it('R129 NÃO sobrescreve tag existente (idempotência R134)', async () => {
    // Se rodar 2× (race), o guard alreadyHasMultiPending pula totalmente
    const ctx = baseCtx({
      agent: RICH_AGENT,
      conversation: { tags: ['multi_interesse_pending:portas,janelas'], inbox_id: 'inb-1' },
      incomingText: 'quero porta de entrada de madeira',
    })
    const r = await runPreLLMShortCircuits(ctx, makeLog())
    expect(r.shortCircuited).toBe(false) // guard funcionou
  })
})
