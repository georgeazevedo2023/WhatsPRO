import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock carousel module (Deno.env access em generateCarouselCopies)
vi.mock('../../carousel.ts', () => ({
  generateCarouselCopies: vi.fn(async (product: any, count: number) =>
    Array(count).fill(`${product.title} — copy mockada`),
  ),
  cleanProductTitle: (t: string) => t,
}))

import { searchProducts, dispatchSearchTool, cleanSearchQuery } from './searchProducts.ts'
import type { SearchProductsCtx } from './searchProducts.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

// Supabase builder mock fluent — programa retornos por chamada (chain final
// é `await query.limit(N)` ou RPC).
function makeSupabase(handlers: {
  primary?: () => { data: any[] | null; error?: any }
  fallback?: () => { data: any[] | null; error?: any }
  fuzzy?: () => { data: any[] | null; error?: any }
}) {
  const calls: Array<{ table: string; op: string; payload?: any; filters: any[] }> = []

  const supabase: any = {
    from(table: string) {
      const filters: any[] = []
      let mode: 'primary' | 'fallback' = 'primary'
      const builder: any = {
        select(_cols: string) {
          return builder
        },
        eq(col: string, val: any) {
          filters.push(['eq', col, val])
          return builder
        },
        gte(col: string, val: any) {
          filters.push(['gte', col, val])
          return builder
        },
        lte(col: string, val: any) {
          filters.push(['lte', col, val])
          return builder
        },
        or(expr: string) {
          filters.push(['or', expr])
          // Se o or contém ',' duplicado de termos word-by-word, marca como fallback.
          // Heurística: o fallback usa 5 words → o expr tem múltiplos `title.ilike` separados.
          if ((expr.match(/title\.ilike/g) || []).length > 2) mode = 'fallback'
          return builder
        },
        async limit(_n: number) {
          calls.push({ table, op: 'select', filters: [...filters] })
          if (table === 'ai_agent_products') {
            const h = mode === 'fallback' ? handlers.fallback : handlers.primary
            return h ? h() : { data: [], error: null }
          }
          return { data: [], error: null }
        },
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload, filters: [] })
          return Promise.resolve({ data: null, error: null })
        },
        update(payload: any) {
          calls.push({ table, op: 'update', payload, filters: [] })
          return {
            eq(col: string, val: any) {
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
      return builder
    },
    async rpc(name: string, _params: any) {
      calls.push({ table: `rpc:${name}`, op: 'rpc', filters: [] })
      if (name === 'search_products_fuzzy' && handlers.fuzzy) return handlers.fuzzy()
      return { data: [], error: null }
    },
  }
  return { supabase, calls }
}

function baseCtx(supabase: any, overrides: Partial<SearchProductsCtx> = {}): SearchProductsCtx {
  return {
    supabase,
    agent: {
      max_qualification_retries: 2,
      max_enrichment_questions: 2,
      business_hours: null,
      carousel_text: 'Confira:',
      carousel_button_1: 'Quero',
      carousel_button_2: '',
    },
    agent_id: 'agt-1',
    conversation: { tags: [], inbox_id: 'inb-1' },
    conversation_id: 'conv-1',
    contact: { jid: '5581987654321@s.whatsapp.net', name: 'Pedro' },
    instance: { token: 'tok-1' },
    uazapiUrl: 'https://uazapi.example',
    incomingText: '',
    leadName: 'Pedro',
    mediaState: { carouselSent: false },
    broadcastEvent: vi.fn(),
    buildQualificationChain: vi.fn(
      (tags: string[], pending: Record<string, string>, name: string | null) =>
        `${name || ''} > ${[...tags, ...Object.entries(pending).map(([k, v]) => `${k}:${v}`)].join(',')}`,
    ),
    ...overrides,
  }
}

// Stub global fetch (UAZAPI calls)
const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  vi.clearAllMocks()
})

function mockFetch(handler: (url: string) => { ok: boolean; status: number; body: string }) {
  globalThis.fetch = vi.fn(async (url: any) => {
    const r = handler(String(url))
    return {
      ok: r.ok,
      status: r.status,
      text: async () => r.body,
      json: async () => {
        try {
          return JSON.parse(r.body)
        } catch {
          return {}
        }
      },
    } as any
  })
}

// =============================================================================
// Guards e short-circuits
// =============================================================================

// =============================================================================
// R138 cleanSearchQuery — sanitização (Sandrielly fix)
// =============================================================================

describe('cleanSearchQuery — sanitização (R138 v7.41.6)', () => {
  it('strip vírgulas (quebram PostgREST .or())', () => {
    expect(cleanSearchQuery('tinta, branca, fosca')).toBe('tinta branca fosca')
  })

  it('strip "?" e "!"', () => {
    expect(cleanSearchQuery('Quanto custa a tinta?')).toBe('Quanto custa a tinta')
    expect(cleanSearchQuery('Tinta Coral!')).toBe('Tinta Coral')
  })

  it('strip parênteses, colchetes, chaves', () => {
    expect(cleanSearchQuery('tinta (acrílica) [fosca] {branca}')).toBe('tinta acrílica fosca branca')
  })

  it('strip aspas simples e duplas, ponto-e-vírgula, dois pontos', () => {
    expect(cleanSearchQuery(`"tinta" 'iquine'; cor: branca`)).toBe('tinta iquine cor branca')
  })

  it('preserva pontos (pra "3.6L")', () => {
    expect(cleanSearchQuery('tinta 3.6L iquine')).toBe('tinta 3.6L iquine')
  })

  it('preserva hifens e acentos', () => {
    expect(cleanSearchQuery('porta-pivô acrílica')).toBe('porta-pivô acrílica')
  })

  it('colapsa whitespace múltiplo', () => {
    expect(cleanSearchQuery('tinta    branca   fosca')).toBe('tinta branca fosca')
  })

  it('strip trim final', () => {
    expect(cleanSearchQuery('   tinta   ')).toBe('tinta')
  })

  it('REPRO Sandrielly: "iquine por quanto esta a tinta pintalar da , de 3,6l? com george" → SEM vírgulas, SEM "?"', () => {
    const noisy = 'iquine por quanto esta a tinta pintalar da , de 3,6l? com george'
    const clean = cleanSearchQuery(noisy)
    expect(clean).not.toContain(',')
    expect(clean).not.toContain('?')
    expect(clean).toContain('iquine')
    expect(clean).toContain('pintalar')
    // Decimal BR "3,6" vira 2 tokens "3 6" após strip — funcionalmente ok pra ILIKE
    // (cada palavra é matched separadamente no AND fallback), mas não preserva
    // o decimal literal. Aceitável; pontuação BR fica em scope futuro.
    expect(clean).toContain('6l')
  })

  it('string vazia → string vazia', () => {
    expect(cleanSearchQuery('')).toBe('')
  })
})

// =============================================================================
// REPRO BUG SANDRIELLY — query com vírgulas chega NO PostgREST .or() sanitizada
// =============================================================================

describe('searchProducts entry sanitization — NÃO passa vírgula pro .or() (R138)', () => {
  it('REPRO Sandrielly: args.query com vírgulas é sanitizada ANTES do .or()', async () => {
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [], error: null }),
      fallback: () => ({ data: [], error: null }),
    })
    // Query EXATA que crashou em prod no caso Sandrielly (22:13:09 UTC 2026-05-22):
    const noisyQuery = 'iquine por quanto esta a tinta pintalar da , de 3,6l? com george'
    await searchProducts(
      { query: noisyQuery, category: 'tintas' },
      baseCtx(supabase, { conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1' } }),
      makeLog(),
    )
    // Verifica TODAS as chamadas .or() — nenhuma pode ter `,` dentro do value
    const orCalls = calls.flatMap((c) =>
      c.filters.filter((f: any) => Array.isArray(f) && f[0] === 'or'),
    )
    expect(orCalls.length).toBeGreaterThan(0)
    for (const orCall of orCalls) {
      const expr = orCall[1] as string
      // Cada filter no .or() é `col.op.val` separado por `,`. Extrai todos os values
      // e confirma que nenhum value (entre `.ilike.%` e `%`) contém `,`.
      const valueMatches = expr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
        expect(m[1]).not.toContain('?')
        expect(m[1]).not.toContain('(')
        expect(m[1]).not.toContain(')')
      }
    }
  })

  it('LLM mandando query "tinta verde, cinza" (vírgula direta) também sanitiza', async () => {
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [], error: null }),
    })
    await searchProducts(
      { query: 'tinta verde, cinza', category: 'tintas' },
      baseCtx(supabase, { conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1' } }),
      makeLog(),
    )
    const orCalls = calls.flatMap((c) =>
      c.filters.filter((f: any) => Array.isArray(f) && f[0] === 'or'),
    )
    for (const orCall of orCalls) {
      const expr = orCall[1] as string
      const valueMatches = expr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
      }
    }
  })
})

describe('searchProducts — guards', () => {
  it('R126 search guard bloqueia query genérica sem expectedCategory', async () => {
    // "material" é genérica e não casa categoria → guard deve bloquear
    const { supabase, calls } = makeSupabase({})
    const result = await searchProducts({ query: 'material' }, baseCtx(supabase), makeLog())
    // Não deve ter feito query no DB pra produtos
    const productCalls = calls.filter((c) => c.table === 'ai_agent_products')
    expect(productCalls.length).toBe(0)
    // Deve ter logado evento search_guard_blocked
    const logs = calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logs.some((l) => l.payload.event === 'search_guard_blocked')).toBe(true)
    // Mensagem retorna do guard (string específica)
    expect(typeof result).toBe('string')
  })
})

// =============================================================================
// Found products — auto-send media
// =============================================================================

describe('searchProducts — found products', () => {
  it('1 produto com 1 foto → envia send/media + retorna instrução NÍVEL 2', async () => {
    const product = {
      title: 'Tinta Coral 18L',
      category: 'tintas',
      description: 'Branca neve fosca',
      price: 489.9,
      images: ['https://cdn.example/coral.jpg'],
      in_stock: true,
    }
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [product] }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))

    const ctx = baseCtx(supabase, { conversation: { tags: ['interesse:tintas'] } })
    const result = await searchProducts(
      { query: 'tinta coral' },
      ctx,
      makeLog(),
    )

    expect(ctx.mediaState.carouselSent).toBe(true)
    expect(result).toContain('Foto')
    expect(result).toContain('Tinta Coral 18L')
    expect(result).toContain('489.90')
    expect(result).toContain('INSTRUÇÕES PARA SUA RESPOSTA')
    // Persistiu mensagem outgoing
    const msgInserts = calls.filter(
      (c) => c.table === 'conversation_messages' && c.op === 'insert',
    )
    expect(msgInserts.length).toBeGreaterThan(0)
    expect(msgInserts[0].payload.media_type).toBe('image')
    expect(ctx.broadcastEvent).toHaveBeenCalled()
  })

  it('2+ produtos → envia carrossel', async () => {
    const products = [
      { title: 'T1', category: 'tintas', price: 100, images: ['url1'], in_stock: true },
      { title: 'T2', category: 'tintas', price: 200, images: ['url2'], in_stock: true },
    ]
    const { supabase } = makeSupabase({
      primary: () => ({ data: products }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))

    const ctx = baseCtx(supabase, { conversation: { tags: ['interesse:tintas'] } })
    const result = await searchProducts({ query: 'tinta' }, ctx, makeLog())
    expect(ctx.mediaState.carouselSent).toBe(true)
    expect(result).toContain('Carrossel com 2 produto')
  })

  it('mediaState.carouselSent=true (já enviou) → mediaSent permanece true (preserva NÍVEL 2)', async () => {
    // Comportamento equivalente ao monolito: o early `if (carouselSentInThisCall)`
    // seta mediaSent=true mas NÃO impede os blocos de envio abaixo (bug latente
    // pré-existente do código original). Garantia preservada: o RETORNO sai com
    // instruções NÍVEL 2 (mediaSent começa true → cai no branch do return texto rico).
    const products = [
      { title: 'T1', category: 'tintas', price: 100, images: ['url1'], in_stock: true },
    ]
    const { supabase } = makeSupabase({
      primary: () => ({ data: products }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'] },
      mediaState: { carouselSent: true },
    })
    const result = await searchProducts({ query: 'tinta' }, ctx, makeLog())
    // mediaState segue true e o retorno tem o bloco NÍVEL 2
    expect(ctx.mediaState.carouselSent).toBe(true)
    expect(result).toContain('INSTRUÇÕES PARA SUA RESPOSTA')
  })

  it('reset search_fail counter quando acha resultado', async () => {
    const product = {
      title: 'T1',
      category: 'tintas',
      price: 100,
      images: ['url1'],
      in_stock: true,
    }
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [product] }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas', 'search_fail:1'] },
    })
    await searchProducts({ query: 'tinta' }, ctx, makeLog())
    const updates = calls.filter((c) => c.table === 'conversations' && c.op === 'update')
    // Alguma das updates deve zerar search_fail
    const resetUpdate = updates.find((u) => {
      const tags = u.payload.tags as string[]
      return tags?.some((t) => t === 'search_fail:0')
    })
    expect(resetUpdate).toBeTruthy()
  })
})

// =============================================================================
// Zero results — paths
// =============================================================================

describe('searchProducts — zero results paths', () => {
  it('PATH A: well-qualified + enrich < max → retorna instrução de enriquecimento', async () => {
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [] }),
      fuzzy: () => ({ data: [] }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'] },
      agent: {
        max_qualification_retries: 2,
        max_enrichment_questions: 2,
        business_hours: null,
      },
    })
    const result = await searchProducts({ query: 'tinta acrílica azul sirius' }, ctx, makeLog())
    expect(result).toContain('FASE DE ENRIQUECIMENTO')
    expect(result).toContain('pergunta 1/2')
    // Persistiu enrich_count + search_fail
    const update = calls.find((c) => c.table === 'conversations' && c.op === 'update')!
    const tagsArr = update.payload.tags as string[]
    expect(tagsArr.some((t) => t.startsWith('enrich_count:1'))).toBe(true)
    expect(tagsArr.some((t) => t.startsWith('search_fail:1'))).toBe(true)
  })

  it('PATH B: well-qualified + enrich >= max → handoff com qualif chain', async () => {
    const { supabase } = makeSupabase({
      primary: () => ({ data: [] }),
      fuzzy: () => ({ data: [] }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas', 'enrich_count:2'] },
    })
    const result = await searchProducts({ query: 'tinta azul' }, ctx, makeLog())
    expect(result).toContain('Enriquecimento COMPLETO')
    expect(result).toContain('handoff_to_human')
    expect(ctx.buildQualificationChain).toHaveBeenCalled()
  })

  it('PATH C: not well-qualified + retry < max → pede refinamento', async () => {
    const { supabase } = makeSupabase({
      primary: () => ({ data: [] }),
      fuzzy: () => ({ data: [] }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: [] }, // sem interesse, sem score
      agent: { max_qualification_retries: 2, max_enrichment_questions: 2, business_hours: null },
    })
    const result = await searchProducts({ query: 'xy' }, ctx, makeLog())
    // queryWords < 3, sem interesseTag → não é well-qualified → PATH C
    expect(result).toContain('retornou 0 produtos')
    expect(result).toContain('tentativa 1/2')
  })

  it('PATH C: not well-qualified + retry atingiu max → handoff', async () => {
    const { supabase } = makeSupabase({
      primary: () => ({ data: [] }),
      fuzzy: () => ({ data: [] }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['search_fail:1'] }, // próxima tentativa = 2 = max
      agent: { max_qualification_retries: 2, max_enrichment_questions: 2, business_hours: null },
    })
    const result = await searchProducts({ query: 'xy' }, ctx, makeLog())
    expect(result).toContain('sem resultados após 2 tentativas')
    expect(result).toContain('handoff_to_human')
  })

  it('R120: outside_hours short-circuit dispara handoff imediato sem enrich', async () => {
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [] }),
      fuzzy: () => ({ data: [] }),
    })
    // business_hours configurado pra ter aberto SOMENTE de 9h-17h em UTC; teste roda
    // forçando fora-de-hora: bh '{"mon": [], ...}' (todos dias fechados) → outside=true
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'] },
      agent: {
        max_qualification_retries: 2,
        max_enrichment_questions: 2,
        business_hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      },
    })
    const result = await searchProducts({ query: 'tinta azul' }, ctx, makeLog())
    expect(result).toContain('FORA DO HORÁRIO COMERCIAL')
    expect(result).toContain('handoff_to_human')
    const update = calls.find((c) => c.table === 'conversations' && c.op === 'update')!
    const tagsArr = update.payload.tags as string[]
    expect(tagsArr.some((t) => t === 'marca_indisponivel_outside_hours:1')).toBe(true)
  })
})

// =============================================================================
// Bug 27 — seed interesse: tag
// =============================================================================

describe('searchProducts — Bug 27 seed interesse', () => {
  it('LLM chama sem interesse: tag → backend deduz da query e seta', async () => {
    const product = {
      title: 'T1',
      category: 'tintas',
      price: 100,
      images: ['url1'],
      in_stock: true,
    }
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [product] }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: [] }, // SEM interesse:
      agent: {
        max_qualification_retries: 2,
        max_enrichment_questions: 2,
        business_hours: null,
        service_categories_v2: {
          categories: [
            {
              id: 'tintas',
              label: 'Tintas',
              keywords: ['tinta', 'esmalte', 'verniz'],
              stages: [
                { id: 's1', min_score: 0, max_score: 100, phrasing: 'q?', fields: [] },
              ],
            },
          ],
          default: { id: 'default', stages: [{ id: 's1', min_score: 0, max_score: 100, phrasing: 'q?', fields: [] }] },
        },
      },
      incomingText: 'quero tinta',
    })
    await searchProducts({ query: 'tinta acrílica' }, ctx, makeLog())
    // Verifica que persistiu auto_field_extracted
    const logs = calls.filter((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    const seedLog = logs.find(
      (l) => l.payload.event === 'auto_field_extracted' &&
        l.payload.metadata?.source === 'bug27_search_products_seed',
    )
    expect(seedLog).toBeTruthy()
  })

  it('não duplica seed quando interesse: já existe', async () => {
    const product = {
      title: 'T1',
      category: 'tintas',
      price: 100,
      images: ['url1'],
      in_stock: true,
    }
    const { supabase, calls } = makeSupabase({
      primary: () => ({ data: [product] }),
    })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'] },
    })
    await searchProducts({ query: 'tinta' }, ctx, makeLog())
    const seedLogs = calls.filter(
      (c) =>
        c.table === 'ai_agent_logs' &&
        c.op === 'insert' &&
        c.payload.event === 'auto_field_extracted' &&
        c.payload.metadata?.source === 'bug27_search_products_seed',
    )
    expect(seedLogs.length).toBe(0)
  })
})

// =============================================================================
// dispatcher
// =============================================================================

describe('dispatchSearchTool', () => {
  it('roteia search_products', async () => {
    const { supabase } = makeSupabase({ primary: () => ({ data: [] }), fuzzy: () => ({ data: [] }) })
    const ctx = baseCtx(supabase, { conversation: { tags: ['interesse:tintas'] } })
    const res = await dispatchSearchTool('search_products', { query: 'tinta azul' }, ctx, makeLog())
    expect(res).toBeTruthy()
    expect(typeof res).toBe('string')
  })

  it('retorna null pra name desconhecido', async () => {
    const { supabase } = makeSupabase({})
    const res = await dispatchSearchTool('set_tags', {}, baseCtx(supabase), makeLog())
    expect(res).toBeNull()
  })
})

// =============================================================================
// Carousel batching (2026-05-24) — "mais opções" / "nenhuma dessas"
// =============================================================================

describe('carousel batching — exclui já-mostrados + lote novo', () => {
  const P = (id: string, n: number) => ({
    id,
    title: `Tinta ${n}`,
    category: 'tintas',
    price: 10 * n,
    images: [`url${n}`],
    in_stock: true,
  })

  it('exclui produtos já mostrados e persiste o lote acumulado', async () => {
    const products = [P('p1', 1), P('p2', 2), P('p3', 3), P('p4', 4)]
    const { supabase, calls } = makeSupabase({ primary: () => ({ data: products }) })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1', shown_product_ids: ['p1', 'p2'] },
    })
    const result = await searchProducts({ query: 'tinta' }, ctx, makeLog())
    expect(result).toContain('Carrossel')
    // persistiu shown_product_ids = união {p1,p2} ∪ {p3,p4}
    const upd = calls.find(
      (c) => c.table === 'conversations' && c.op === 'update' && c.payload?.shown_product_ids,
    )
    expect(upd).toBeTruthy()
    expect(upd!.payload.shown_product_ids.sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(ctx.mediaState.carouselSent).toBe(true)
  })

  it('quando TODOS já foram mostrados → coleta+transbordo (NUNCA diz "acabou") + NÃO envia carrossel', async () => {
    const products = [P('p1', 1), P('p2', 2)]
    const { supabase, calls } = makeSupabase({ primary: () => ({ data: products }) })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1', shown_product_ids: ['p1', 'p2'] },
    })
    const result = await searchProducts({ query: 'tinta' }, ctx, makeLog())
    // Regra de ouro: nunca dizer que não tem; coletar + transbordar com resumo
    expect(result).toContain('handoff_to_human')
    expect(result).toContain('PROIBIDO')
    expect(result).toContain('não temos')      // citado como PROIBIDO
    expect(result).not.toContain('essas eram todas as opções dessa linha') // frase antiga removida
    expect(ctx.mediaState.carouselSent).toBe(false) // nada enviado
  })

  it('cap de 5 cards por lote (não despeja 8 de uma vez)', async () => {
    const products = Array.from({ length: 8 }, (_, i) => P(`p${i + 1}`, i + 1))
    const { supabase, calls } = makeSupabase({ primary: () => ({ data: products }) })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1' },
    })
    await searchProducts({ query: 'tinta' }, ctx, makeLog())
    const upd = calls.find(
      (c) => c.table === 'conversations' && c.op === 'update' && c.payload?.shown_product_ids,
    )
    expect(upd).toBeTruthy()
    expect(upd!.payload.shown_product_ids).toHaveLength(5) // só 5 enviados/registrados
  })

  it('sem shown_product_ids prévios → comportamento normal (envia + registra)', async () => {
    const products = [P('p1', 1), P('p2', 2)]
    const { supabase, calls } = makeSupabase({ primary: () => ({ data: products }) })
    mockFetch(() => ({ ok: true, status: 200, body: '{"ok":true}' }))
    const ctx = baseCtx(supabase, { conversation: { tags: ['interesse:tintas'], inbox_id: 'inb-1' } })
    const result = await searchProducts({ query: 'tinta' }, ctx, makeLog())
    expect(result).toContain('Carrossel')
    const upd = calls.find(
      (c) => c.table === 'conversations' && c.op === 'update' && c.payload?.shown_product_ids,
    )
    expect(upd!.payload.shown_product_ids.sort()).toEqual(['p1', 'p2'])
  })
})
