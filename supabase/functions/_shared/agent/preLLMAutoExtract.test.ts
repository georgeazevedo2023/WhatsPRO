import { describe, it, expect, vi } from 'vitest'
import { runPreLLMAutoExtract } from './preLLMAutoExtract.ts'
import type { PreLLMAutoExtractCtx } from './preLLMAutoExtract.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabaseSpy() {
  const calls: Array<{ table: string; op: string; payload: any; filter?: any }> = []
  const supabase: any = {
    from(table: string) {
      return {
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
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  return { supabase, calls }
}

/**
 * Categoria "tintas" com 2 stages:
 *   - stage1 (0→30): ambiente (15) + cor (15) → exit_action=search_products
 *   - stage2 (30→100): acabamento (40) + marca_preferida (30) → exit_action=handoff
 *
 * Score 30 = atinge max do stage1 (search_products) com ambiente+cor.
 * Score 100 = atinge max do stage2 (handoff) com acabamento+marca.
 */
function makeAgent(opts: { catalogStatus?: 'digital' | 'offline'; catId?: string } = {}) {
  return {
    service_categories: {
      default: {
        stages: [
          {
            id: 'qual_basica',
            label: 'Qualificação básica',
            min_score: 0,
            max_score: 100,
            exit_action: 'handoff',
            fields: [
              { key: 'detalhes', label: 'detalhes', examples: 'qualquer', score_value: 25, priority: 1 },
            ],
            phrasing: 'me conta {label}?',
          },
        ],
      },
      categories: [
        {
          id: opts.catId || 'tintas',
          label: 'Tintas',
          interesse_match: 'tinta|tintas|coral',
          catalog_status: opts.catalogStatus || 'digital',
          stages: [
            {
              id: 'identificacao',
              label: 'Identificação',
              min_score: 0,
              max_score: 30,
              exit_action: 'search_products',
              fields: [
                { key: 'ambiente', label: 'ambiente', examples: 'interno, externo', score_value: 15, priority: 1 },
                { key: 'cor', label: 'cor', examples: 'branco, cinza, azul', score_value: 15, priority: 2 },
              ],
              phrasing: 'qual {label}?',
            },
            {
              id: 'fechamento',
              label: 'Fechamento',
              min_score: 30,
              max_score: 100,
              exit_action: 'handoff',
              fields: [
                { key: 'acabamento', label: 'acabamento', examples: 'fosco, acetinado, brilho', score_value: 40, priority: 1 },
                { key: 'marca_preferida', label: 'marca preferida', examples: 'Coral, Suvinil', score_value: 30, priority: 2 },
              ],
              phrasing: 'qual {label}?',
            },
          ],
        },
      ],
    },
  }
}

function baseCtx(overrides: Partial<PreLLMAutoExtractCtx> = {}): PreLLMAutoExtractCtx {
  const { supabase } = makeSupabaseSpy()
  return {
    supabase,
    conversation: { id: 'conv-1', tags: [], status_ia: 'active' },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    agent: makeAgent(),
    incomingText: '',
    suppressAutoExtractForMulti: false,
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────
// Guards
// ────────────────────────────────────────────────────────────────────

describe('runPreLLMAutoExtract — guards', () => {
  it('retorna default quando incomingText vazio', async () => {
    const r = await runPreLLMAutoExtract(baseCtx({ incomingText: '' }), makeLog())
    expect(r).toEqual({
      pendingExitActionHandoff: null,
      pendingExitActionSearch: null,
      tagsMutated: false,
    })
  })

  it('retorna default quando suppressAutoExtractForMulti=true', async () => {
    const ctx = baseCtx({
      incomingText: 'quero tinta interno fosca',
      suppressAutoExtractForMulti: true,
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionHandoff).toBeNull()
    expect(r.pendingExitActionSearch).toBeNull()
    expect(r.tagsMutated).toBe(false)
  })

  it('retorna default quando categoria não casa', async () => {
    const ctx = baseCtx({ incomingText: 'oi tudo bem?' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.tagsMutated).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────
// R121 trigger ("tem X?")
// ────────────────────────────────────────────────────────────────────

describe('R121 "tem X?" trigger', () => {
  it('dispara pendingExitActionSearch quando categoria digital + msg direta', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: 'vcs têm tinta Coral?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.category).toBe('tintas')
    expect(r.pendingExitActionSearch!.query).toContain('tinta')
  })

  it('NÃO dispara em categoria offline', async () => {
    const ctx = baseCtx({
      agent: makeAgent({ catalogStatus: 'offline', catId: 'portas' }),
      incomingText: 'vcs têm porta de madeira?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    // Cat offline pula R121, mas autoExtract pode ter rodado (nesse caso sem fields casa)
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('NÃO dispara quando lead já recebeu produtos (tag produto:)', async () => {
    const ctx = baseCtx({
      conversation: { tags: ['produto:abc-123'], status_ia: 'active' },
      incomingText: 'vcs têm tinta Coral?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('NÃO dispara quando aguardando_upsell', async () => {
    const ctx = baseCtx({
      conversation: { tags: ['aguardando_upsell'], status_ia: 'active' },
      incomingText: 'vcs têm tinta?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('NÃO dispara quando status_ia=SHADOW', async () => {
    const ctx = baseCtx({
      conversation: { tags: [], status_ia: 'shadow' },
      incomingText: 'vcs têm tinta Coral?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('query construída usa tags existentes (sem META_KEYS)', async () => {
    const ctx = baseCtx({
      conversation: {
        tags: ['interesse:tintas', 'cor:branco', 'lead_score:15', 'motivo:teste'],
        status_ia: 'active',
      },
      incomingText: 'vcs têm tinta?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    const q = r.pendingExitActionSearch!.query
    expect(q).toContain('tintas')
    expect(q).toContain('branco')
    expect(q).not.toContain('lead_score')
    expect(q).not.toContain('motivo')
    expect(q).not.toContain('15')
  })
})

// ────────────────────────────────────────────────────────────────────
// R137 + R138 — searchGuard wire com sanitização (v7.41.6 2026-05-22)
// ────────────────────────────────────────────────────────────────────

describe('R137 searchGuard wire (com sanitização R138)', () => {
  it('caso Sandrielly EXATO: "Por quanto está a tinta pintalar da Iquine, de 3,6L?\\ncom george" → query sanitizada SEM vírgula nem "?"', async () => {
    const log = makeLog()
    const ctx = baseCtx({
      incomingText: 'Por quanto está a tinta pintalar da Iquine, de 3,6L?\ncom george',
    })
    const r = await runPreLLMAutoExtract(ctx, log)
    expect(r.pendingExitActionSearch).not.toBeNull()
    const q = r.pendingExitActionSearch!.query
    // PostgREST .or() bom: sem vírgula, parênteses, "?", aspas
    expect(q).not.toMatch(/[,;:"'?!()\[\]{}]/)
    // Marca preservada
    expect(q.toLowerCase()).toContain('iquine')
    // "com george" stripado
    expect(q.toLowerCase()).not.toContain('george')
    // Categoria correta
    expect(r.pendingExitActionSearch!.category).toBe('tintas')
    expect(log.info).toHaveBeenCalledWith(
      'R137: searchGuard wire forçando search_products inline',
      expect.objectContaining({ reason: 'brand_mentioned' }),
    )
  })

  it('"Preciso de tinta acrílica fosca" (R121 verboso) força search com query limpa', async () => {
    const ctx = baseCtx({ incomingText: 'Preciso de tinta acrílica fosca' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.query).not.toMatch(/[,?"']/)
    expect(r.pendingExitActionSearch!.query.toLowerCase()).toContain('tinta')
  })

  it('"Quanto custa a Coral fosca?" (marca isolada + "?") força search SEM "?"', async () => {
    const ctx = baseCtx({ incomingText: 'Quanto custa a Coral fosca?' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.query).not.toContain('?')
    expect(r.pendingExitActionSearch!.query.toLowerCase()).toContain('coral')
  })

  it('saudação simples não dispara (no_signal)', async () => {
    const ctx = baseCtx({ incomingText: 'oi tudo bem?' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('categoria offline NÃO dispara mesmo com marca mencionada', async () => {
    const ctx = baseCtx({
      agent: makeAgent({ catalogStatus: 'offline', catId: 'tintas' }),
      incomingText: 'Quero tinta Coral fosca',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('lead já recebeu produto (aguardando_upsell) NÃO redispara', async () => {
    const ctx = baseCtx({
      conversation: { tags: ['aguardando_upsell'], status_ia: 'active' },
      incomingText: 'Por quanto está a tinta Iquine?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('SHADOW NÃO dispara', async () => {
    const ctx = baseCtx({
      conversation: { tags: [], status_ia: 'shadow' },
      incomingText: 'Por quanto está a tinta Iquine?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('R121 verboso "tem X?" tem precedência sobre R137 (não duplica)', async () => {
    const log = makeLog()
    const ctx = baseCtx({ incomingText: 'vcs têm tinta Iquine?' })
    const r = await runPreLLMAutoExtract(ctx, log)
    // R121 inline DIRECT_PRODUCT_QUESTION_RE dispara primeiro
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(log.info).not.toHaveBeenCalledWith(
      'R137: searchGuard wire forçando search_products inline',
      expect.anything(),
    )
  })

  it('query final NÃO contém "?" mesmo quando incoming pergunta', async () => {
    const ctx = baseCtx({ incomingText: 'Quanto custa a tinta Iquine?' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.query).not.toContain('?')
  })

  it('"meu nome é X" também é stripado do fim', async () => {
    const ctx = baseCtx({
      incomingText: 'Preciso de tinta Iquine meu nome é Pedro',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.query.toLowerCase()).not.toContain('pedro')
    expect(r.pendingExitActionSearch!.query.toLowerCase()).toContain('iquine')
  })

  it('query muito curta (1 char) NÃO dispara — proteção contra ruído', async () => {
    // R121 verboso "quero X" exige captura ≥2 chars (regex pattern já filtra)
    const ctx = baseCtx({ incomingText: 'Quero a' })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────
// R143 — interesse seed sem fields extraídos (caso Jessica)
// ────────────────────────────────────────────────────────────────────

describe('R143 interesse seed quando extracted=[]', () => {
  it('caso Jessica: "porta de frente disponível" → seedar interesse:portas mesmo sem fields', async () => {
    const spy = makeSupabaseSpy()
    // Agent com categoria portas (offline, fields material/ambiente/tipo)
    const agentPortas = {
      service_categories: {
        default: {
          stages: [
            { id: 'q', label: 'q', min_score: 0, max_score: 100, exit_action: 'handoff',
              fields: [{ key: 'd', label: 'd', examples: 'x', score_value: 25, priority: 1 }],
              phrasing: '{label}?' },
          ],
        },
        categories: [
          {
            id: 'portas',
            label: 'Portas',
            interesse_match: 'porta|portas',
            catalog_status: 'offline',
            stages: [
              { id: 'q', label: 'Qualif', min_score: 0, max_score: 30, exit_action: 'handoff',
                fields: [
                  { key: 'material_porta', label: 'material', examples: 'madeira, PVC ou alumínio', score_value: 10, priority: 1 },
                  { key: 'ambiente_porta', label: 'ambiente', examples: 'sala, cozinha, quarto ou banheiro', score_value: 10, priority: 2 },
                  { key: 'tipo_porta', label: 'tipo', examples: 'frisada ou lisa', score_value: 10, priority: 3 },
                ],
                phrasing: '{label}? ({examples})' },
            ],
          },
        ],
      },
    }

    const ctx = baseCtx({
      supabase: spy.supabase,
      agent: agentPortas,
      incomingText: 'Oi vc manda pra mim os modelo de porta de frente disponível',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())

    // R143: tags mutadas com seed interesse:portas
    expect(r.tagsMutated).toBe(true)
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update).toBeTruthy()
    expect(update!.payload.tags).toContain('interesse:portas')
  })

  it('NÃO redispara se já tinha interesse: tag', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      conversation: { tags: ['interesse:tintas'], status_ia: 'active' },
      incomingText: 'oi tudo bem?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    // Sem fields novos, sem novo seed (já existia)
    expect(r.tagsMutated).toBe(false)
  })

  it('categoria offline + 0 fields → seed interesse + tagsMutated=true', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      agent: makeAgent({ catalogStatus: 'offline', catId: 'tintas' }),
      incomingText: 'tinta', // só matchCategoryBySearchText, sem field extraído
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.tagsMutated).toBe(true)
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update!.payload.tags).toContain('interesse:tintas')
  })
})

// ────────────────────────────────────────────────────────────────────
// Auto-extract + score + persistência
// ────────────────────────────────────────────────────────────────────

describe('Auto-extract + score + tags', () => {
  it('extrai fields, persiste tags e calcula score progressivo', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: 'quero tinta para área interno cor branco',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())

    expect(r.tagsMutated).toBe(true)
    // ambiente:interno (15) + cor:branco (15) = score 30 → fronteira [0,30) cai em stage2
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(update).toBeTruthy()
    expect(update!.payload.tags).toContain('interesse:tintas')
    expect(update!.payload.tags).toContain('ambiente:interno')
    expect(update!.payload.tags).toContain('cor:branco')
    expect(update!.payload.tags.find((t: string) => t.startsWith('lead_score:'))).toBe('lead_score:30')

    // R137 wire (v7.41.6): "quero X" dispara searchGuard wire via R121 verboso.
    // pendingExitActionSearch é setado pelo wire ANTES do score loop do auto-extract.
    expect(r.pendingExitActionSearch).not.toBeNull()
    expect(r.pendingExitActionSearch!.category).toBe('tintas')
    expect(r.pendingExitActionHandoff).toBeNull()
  })

  it('dispara pendingExitActionHandoff quando atinge max do stage handoff', async () => {
    const spy = makeSupabaseSpy()
    // Lead já está com score 30 (max stage1) e tags acabamento+marca disparam o stage2
    const ctx = baseCtx({
      supabase: spy.supabase,
      conversation: {
        tags: ['interesse:tintas', 'ambiente:interno', 'cor:branco', 'lead_score:30'],
        status_ia: 'active',
      },
      incomingText: 'fosco da marca Coral',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())

    expect(r.tagsMutated).toBe(true)
    // acabamento (40) + marca (30) = +70 → score 100 → exit_action=handoff
    expect(r.pendingExitActionHandoff).not.toBeNull()
    expect(r.pendingExitActionHandoff!.reason).toContain('tintas')
    expect(r.pendingExitActionHandoff!.queueMotivo).toContain('Tintas')
    expect(r.pendingExitActionHandoff!.queueMotivo).toContain('acabamento')
  })

  it('NÃO dispara handoff quando status_ia=SHADOW (mesmo com score max)', async () => {
    const ctx = baseCtx({
      conversation: {
        tags: ['interesse:tintas', 'ambiente:interno', 'cor:branco', 'lead_score:30'],
        status_ia: 'shadow',
      },
      incomingText: 'fosco da marca Coral',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionHandoff).toBeNull()
  })

  it('NÃO dispara search C2 em catalog_status=offline', async () => {
    const ctx = baseCtx({
      agent: makeAgent({ catalogStatus: 'offline' }),
      incomingText: 'quero tinta para área interno cor branco',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    // Score atinge max do stage1 mas catalog_status=offline pula a flag de search
    expect(r.pendingExitActionSearch).toBeNull()
  })

  it('reutiliza interesse: existente (resolved_via=interesse_tag)', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      conversation: { tags: ['interesse:tintas'], status_ia: 'active' },
      incomingText: 'cor azul interno',
    })
    await runPreLLMAutoExtract(ctx, makeLog())
    const update = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    // NÃO adiciona interesse:tintas de novo (seedTags vazio)
    const occurrences = update!.payload.tags.filter((t: string) => t === 'interesse:tintas').length
    expect(occurrences).toBe(1)
    const logInsert = spy.calls.find((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logInsert!.payload.metadata.resolved_via).toBe('interesse_tag')
    expect(logInsert!.payload.metadata.seed_tags).toEqual([])
  })

  it('autoExtract sem matches mas com categoria detectada → seed interesse (R143)', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      incomingText: 'me manda tinta', // só interesse, nenhum field específico
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    // R143 (2026-05-22 v7.41.10): agora seeda interesse:tintas mesmo sem fields
    expect(r.tagsMutated).toBe(true)
    const update = spy.calls.find((c) => c.op === 'update')
    expect(update).toBeTruthy()
    expect(update!.payload.tags).toContain('interesse:tintas')
  })

  it('log auto_field_extracted contém pending_exit_handoff=true quando aplicável', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({
      supabase: spy.supabase,
      conversation: {
        tags: ['interesse:tintas', 'ambiente:interno', 'cor:branco', 'lead_score:30'],
        status_ia: 'active',
      },
      incomingText: 'fosco Coral',
    })
    await runPreLLMAutoExtract(ctx, makeLog())
    const logIns = spy.calls.find((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logIns!.payload.event).toBe('auto_field_extracted')
    expect(logIns!.payload.metadata.pending_exit_handoff).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────
// Prioridade R121 trigger vs autoExtract C2 fallback
// ────────────────────────────────────────────────────────────────────

describe('Prioridade R121 trigger > C2 fallback', () => {
  it('quando R121 dispara primeiro, C2 não sobrescreve', async () => {
    // "vcs têm tinta interno cor branco" — R121 dispara (msg direta) + autoExtract
    // também atinge max do stage1. R121 vence (já está setado quando C2 testa o `!pendingExitActionSearch`).
    const ctx = baseCtx({
      incomingText: 'vcs têm tinta para área interno cor branco?',
    })
    const r = await runPreLLMAutoExtract(ctx, makeLog())
    expect(r.pendingExitActionSearch).not.toBeNull()
    // Query R121 (sem newTags) — apenas o que estava nas tags antes
    // Não deve conter "interno" e "branco" porque foram newTags (R121 roda antes do autoExtract)
    // Mas pode conter incomingText como fallback
    expect(r.pendingExitActionSearch!.query.length).toBeGreaterThan(0)
  })
})
