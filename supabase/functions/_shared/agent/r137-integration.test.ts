/**
 * R137 Integration Tests — 5 cenários reais (2026-05-22 v7.41.6)
 *
 * Exercita o pipeline FULL pós-R137 fix:
 *   incoming text →
 *   preLLMAutoExtract.runPreLLMAutoExtract() →
 *   exitActionDispatcher.runInlineSearchProducts() →
 *   executeToolSafe('search_products') →
 *   dispatchSearchTool() →
 *   searchProducts() handler →
 *   (catalog query mocked) →
 *   handleZeroResults / found products → return string pro LLM
 *
 * O teste anterior (R137 v7.41.4) só cobriu preLLMAutoExtract isoladamente.
 * Esta sequência é o caminho real que crashou em prod (caso Sandrielly).
 *
 * 5 cenários:
 *   #1 Sandrielly EXATO inside hours — catalogo vazio → PATH A enrichment
 *   #2 Sandrielly EXATO outside hours — catalogo vazio → R120 outside_hours handoff
 *   #3 "Quanto custa a Coral fosca?" — query SEM verbo R121 → R137 marca isolada
 *   #4 "Preciso de tinta acrílica fosca" — R121 verboso → search
 *   #5 "Boa tarde, tudo bem?" — saudação pura → no_signal, sem R137
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../carousel.ts', () => ({
  generateCarouselCopies: vi.fn(async (product: any, count: number) =>
    Array(count).fill(`${product.title} — copy`),
  ),
  cleanProductTitle: (t: string) => t,
}))

import { runPreLLMAutoExtract } from './preLLMAutoExtract.ts'
import { runInlineSearchProducts } from './exitActionDispatcher.ts'
import { dispatchSearchTool } from './tools/searchProducts.ts'
import type { PreLLMAutoExtractCtx } from './preLLMAutoExtract.ts'
import type { SearchProductsCtx } from './tools/searchProducts.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

/**
 * Supabase mock que valida `.or()` parsing — se vier vírgula dentro de %value%,
 * REJEITA (simulando o erro PostgREST 400 real).
 */
function makeRealisticSupabase(productCatalog: any[] = []) {
  const orFilterCalls: string[] = []
  const tagUpdates: any[] = []
  const logs: any[] = []

  const supabase: any = {
    from(table: string) {
      const filters: any[] = []
      const builder: any = {
        select(_cols?: string) {
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
          orFilterCalls.push(expr)
          // Valida formato: cada filter dentro do .or() deve ser `col.op.val`.
          // Se algum value (entre `.ilike.%` e o próximo `%,` ou fim) contém vírgula
          // não escapada, o REAL PostgREST 400. Reproduzimos esse erro.
          const valueMatches = expr.matchAll(/\.ilike\.%([^%]*)%/g)
          for (const m of valueMatches) {
            if (m[1].includes(',') || m[1].includes('(') || m[1].includes(')')) {
              throw new Error(`PostgREST 400: malformed .or() filter — value contains unescaped delimiter: ${m[1]}`)
            }
          }
          return builder
        },
        async limit(_n: number) {
          if (table === 'ai_agent_products') {
            return { data: productCatalog, error: null }
          }
          return { data: [], error: null }
        },
        insert(payload: any) {
          if (table === 'ai_agent_logs') logs.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
        update(payload: any) {
          if (table === 'conversations' && payload.tags) tagUpdates.push(payload.tags)
          return {
            eq(_col: string, _val: any) {
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        upsert(_payload: any) {
          return Promise.resolve({ data: null, error: null })
        },
      }
      return builder
    },
    async rpc(_name: string, _params: any) {
      return { data: [], error: null }
    },
  }

  return { supabase, orFilterCalls, tagUpdates, logs }
}

/** Agente EletropisoV2-like: 1 categoria tintas digital + handoff inside hours */
function makeAgent(opts: { businessHours?: any; maxEnrich?: number } = {}) {
  return {
    max_qualification_retries: 2,
    max_enrichment_questions: opts.maxEnrich ?? 2,
    business_hours: opts.businessHours ?? null,
    extended_hours_until: null,
    carousel_text: 'Confira:',
    carousel_button_1: 'Quero',
    carousel_button_2: '',
    handoff_message: 'Vou conectar você com nosso consultor de vendas.',
    handoff_message_outside_hours: 'Fora do horário. Anotei seu pedido.',
    notify_outside_hours_on_handoff: true,
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
          id: 'tintas',
          label: 'Tintas',
          interesse_match: 'tinta|tintas|esmalte|verniz|coral|suvinil|iquine',
          catalog_status: 'digital',
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
                { key: 'acabamento', label: 'acabamento', examples: 'fosco, brilho', score_value: 40, priority: 1 },
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

function makePreLLMCtx(supabase: any, agent: any, incomingText: string, overrides: any = {}): PreLLMAutoExtractCtx {
  return {
    supabase,
    conversation: { id: 'conv-1', tags: [], status_ia: 'active', ...overrides.conversation },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    agent,
    incomingText,
    suppressAutoExtractForMulti: false,
  }
}

function makeSearchCtx(supabase: any, agent: any, conversationTags: string[] = []): SearchProductsCtx {
  return {
    supabase,
    agent,
    agent_id: 'agt-1',
    conversation: { tags: conversationTags, inbox_id: 'inb-1', id: 'conv-1' },
    conversation_id: 'conv-1',
    contact: { id: 'cnt-1', jid: '5581987654321@s.whatsapp.net', name: 'TestLead' },
    instance: { token: 'tok-test' },
    uazapiUrl: 'https://uazapi.example',
    incomingText: '',
    leadName: 'TestLead',
    mediaState: { carouselSent: false },
    broadcastEvent: vi.fn(),
    buildQualificationChain: vi.fn(
      (tags: string[], pending: Record<string, string>, name: string | null) =>
        `${name || ''} > ${[...tags].filter((t: string) => !t.startsWith('lead_score')).join(',')}`,
    ),
  }
}

// =============================================================================
// CENÁRIO 1 — Sandrielly EXATO inside hours, catálogo vazio
// =============================================================================

describe('R137 Integration #1 — Sandrielly EXATO inside hours + catálogo vazio', () => {
  it('R137 dispara → search roda SEM CRASH → 0 results → PATH A enrichment', async () => {
    const { supabase, orFilterCalls, logs } = makeRealisticSupabase([])
    const agent = makeAgent({ businessHours: null, maxEnrich: 2 })
    const log = makeLog()

    // Fase 1 — pre-LLM auto-extract dispara R137
    const ctxPre = makePreLLMCtx(
      supabase,
      agent,
      'Por quanto está a tinta pintalar da Iquine, de 3,6L?\ncom george',
    )
    const preResult = await runPreLLMAutoExtract(ctxPre, log)

    expect(preResult.pendingExitActionSearch).not.toBeNull()
    const query = preResult.pendingExitActionSearch!.query
    expect(query).not.toContain(',')
    expect(query).not.toContain('?')
    expect(query.toLowerCase()).toContain('iquine')
    expect(query.toLowerCase()).not.toContain('george') // stripado

    // Fase 2 — search_products INLINE (não deve crashar)
    const ctxSearch = makeSearchCtx(supabase, agent, ['interesse:tintas'])
    let searchResult: string
    try {
      searchResult = await dispatchSearchTool('search_products', {
        query: preResult.pendingExitActionSearch!.query,
        category: preResult.pendingExitActionSearch!.category,
      }, ctxSearch, log) as string
    } catch (err) {
      // Se passar de vírgula no .or(), o mock throw simula o PostgREST 400.
      // Antes do R138, esse era exatamente o crash do Sandrielly.
      throw new Error(`FAIL Cenário 1 — search crashed: ${(err as Error).message}`)
    }

    // Validação: search rodou e retornou string (não crash)
    expect(typeof searchResult).toBe('string')
    // Validação: as chamadas .or() ao supabase tinham values SEM vírgulas
    for (const orExpr of orFilterCalls) {
      const valueMatches = orExpr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
      }
    }
    // Validação: PATH A enrichment foi disparado (deve mencionar "ENRIQUECIMENTO" ou perguntar field)
    expect(searchResult.toLowerCase()).toMatch(/enriquec|ambiente|cor|acabamento/)
  })
})

// =============================================================================
// CENÁRIO 2 — Sandrielly EXATO outside hours, catálogo vazio
// =============================================================================

describe('R137 Integration #2 — Sandrielly EXATO outside hours + catálogo vazio', () => {
  it('R137 dispara → search SEM CRASH → 0 results + outside hours → R120 handoff', async () => {
    const { supabase, orFilterCalls } = makeRealisticSupabase([])
    // Schema correto do businessHours.ts: keys são mon/tue/wed/thu/fri/sat/sun com {open, start, end}.
    // Força janela impossível (00:00-00:01) pra todos os dias → garante outside.
    const restrictiveBusinessHours = {
      mon: { open: true, start: '00:00', end: '00:01' },
      tue: { open: true, start: '00:00', end: '00:01' },
      wed: { open: true, start: '00:00', end: '00:01' },
      thu: { open: true, start: '00:00', end: '00:01' },
      fri: { open: true, start: '00:00', end: '00:01' },
      sat: { open: false },
      sun: { open: false },
    }
    const agent = makeAgent({ businessHours: restrictiveBusinessHours, maxEnrich: 2 })
    const log = makeLog()

    const ctxPre = makePreLLMCtx(
      supabase,
      agent,
      'Por quanto está a tinta pintalar da Iquine, de 3,6L?\ncom george',
    )
    const preResult = await runPreLLMAutoExtract(ctxPre, log)
    expect(preResult.pendingExitActionSearch).not.toBeNull()

    const ctxSearch = makeSearchCtx(supabase, agent, ['interesse:tintas'])
    const searchResult = await dispatchSearchTool('search_products', {
      query: preResult.pendingExitActionSearch!.query,
      category: preResult.pendingExitActionSearch!.category,
    }, ctxSearch, log) as string

    expect(typeof searchResult).toBe('string')
    // .or() limpo (defesa profunda)
    for (const orExpr of orFilterCalls) {
      const valueMatches = orExpr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
      }
    }
    // PATH R120: handoff direto fora hora
    expect(searchResult.toLowerCase()).toMatch(/handoff|fora.*hor|outside/)
  })
})

// =============================================================================
// CENÁRIO 3 — "Quanto custa a Coral fosca?" marca isolada sem verbo R121
// =============================================================================

describe('R137 Integration #3 — Marca isolada Coral SEM verbo R121', () => {
  it('R137 brand_mentioned dispara → search SEM CRASH → no_results PATH', async () => {
    const { supabase, orFilterCalls } = makeRealisticSupabase([])
    const agent = makeAgent({ maxEnrich: 2 })
    const log = makeLog()

    const ctxPre = makePreLLMCtx(supabase, agent, 'Quanto custa a Coral fosca?')
    const preResult = await runPreLLMAutoExtract(ctxPre, log)

    expect(preResult.pendingExitActionSearch).not.toBeNull()
    expect(preResult.pendingExitActionSearch!.query).not.toContain('?')
    expect(preResult.pendingExitActionSearch!.query.toLowerCase()).toContain('coral')

    const ctxSearch = makeSearchCtx(supabase, agent, ['interesse:tintas'])
    const searchResult = await dispatchSearchTool('search_products', {
      query: preResult.pendingExitActionSearch!.query,
      category: preResult.pendingExitActionSearch!.category,
    }, ctxSearch, log) as string

    expect(typeof searchResult).toBe('string')
    for (const orExpr of orFilterCalls) {
      const valueMatches = orExpr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
        expect(m[1]).not.toContain('?')
      }
    }
  })
})

// =============================================================================
// CENÁRIO 4 — R121 verboso "Preciso de tinta acrílica fosca"
// =============================================================================

describe('R137 Integration #4 — R121 verboso "Preciso de"', () => {
  it('R121 inline > R137 → search SEM CRASH', async () => {
    const { supabase, orFilterCalls } = makeRealisticSupabase([])
    const agent = makeAgent({ maxEnrich: 2 })
    const log = makeLog()

    const ctxPre = makePreLLMCtx(supabase, agent, 'Preciso de tinta acrílica fosca')
    const preResult = await runPreLLMAutoExtract(ctxPre, log)

    expect(preResult.pendingExitActionSearch).not.toBeNull()

    const ctxSearch = makeSearchCtx(supabase, agent, ['interesse:tintas'])
    const searchResult = await dispatchSearchTool('search_products', {
      query: preResult.pendingExitActionSearch!.query,
      category: preResult.pendingExitActionSearch!.category,
    }, ctxSearch, log) as string

    expect(typeof searchResult).toBe('string')
    for (const orExpr of orFilterCalls) {
      const valueMatches = orExpr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
      }
    }
  })
})

// =============================================================================
// CENÁRIO 5 — Saudação pura "Boa tarde, tudo bem?" não dispara R137
// =============================================================================

describe('R137 Integration #5 — Saudação pura NÃO dispara', () => {
  it('signal=no_signal → preLLM retorna sem pendingExitActionSearch', async () => {
    const { supabase } = makeRealisticSupabase([])
    const agent = makeAgent()
    const log = makeLog()

    const ctxPre = makePreLLMCtx(supabase, agent, 'Boa tarde, tudo bem?')
    const preResult = await runPreLLMAutoExtract(ctxPre, log)

    expect(preResult.pendingExitActionSearch).toBeNull()
    // Não deve ter logado R137 wire
    expect(log.info).not.toHaveBeenCalledWith(
      'R137: searchGuard wire forçando search_products inline',
      expect.anything(),
    )
  })
})

// =============================================================================
// R142 — buildQualificationChain enriquecida (Wsmart caso 2026-05-22 20:18)
// =============================================================================

describe('R142 buildQualificationChain — chain rica pra atendente', () => {
  // Reproduz a função local do index.ts (mesma lógica, p/ testabilidade).
  function buildQualificationChain(tags: string[], pendingTags: Record<string, string>, name: string | null): string {
    const tagMap = new Map<string, string>()
    for (const t of tags) { const [k, ...r] = t.split(':'); tagMap.set(k, r.join(':')) }
    for (const [k, v] of Object.entries(pendingTags)) tagMap.set(k, v)

    const parts: string[] = []
    if (name) parts.push(name)
    const fmt = (v: string) => v.replace(/_/g, ' ')

    if (tagMap.has('interesse')) parts.push(fmt(tagMap.get('interesse')!))
    if (tagMap.has('produto')) parts.push(fmt(tagMap.get('produto')!))
    if (tagMap.has('marca_preferida')) parts.push(fmt(tagMap.get('marca_preferida')!))
    else if (tagMap.has('marca_indisponivel')) parts.push(`marca: ${fmt(tagMap.get('marca_indisponivel')!)} (indisponível)`)
    if (tagMap.has('ambiente')) parts.push(`ambiente: ${fmt(tagMap.get('ambiente')!)}`)
    if (tagMap.has('aplicacao')) parts.push(fmt(tagMap.get('aplicacao')!))
    if (tagMap.has('tipo_tinta')) parts.push(`tipo: ${fmt(tagMap.get('tipo_tinta')!)}`)
    if (tagMap.has('cor')) parts.push(`cor: ${fmt(tagMap.get('cor')!)}`)
    if (tagMap.has('acabamento')) parts.push(fmt(tagMap.get('acabamento')!))
    if (tagMap.has('voltagem')) parts.push(`${fmt(tagMap.get('voltagem')!)}`)
    if (tagMap.has('quantidade')) parts.push(fmt(tagMap.get('quantidade')!))
    if (tagMap.has('volume')) parts.push(fmt(tagMap.get('volume')!))
    if (tagMap.has('area')) parts.push(`${tagMap.get('area')}m²`)

    return parts.join(' > ')
  }

  it('caso real Wsmart pós-fix: chain inclui ambiente:interno', () => {
    const tags = [
      'marca_citada:iquine',
      'interesse:tintas',
      'motivo:compra',
      'produto:iquine_pintalar_3.6l',
      'ambiente:interno',
      'lead_score:15',
    ]
    const chain = buildQualificationChain(tags, {}, 'Pedro')
    expect(chain).toContain('Pedro')
    expect(chain).toContain('tintas')
    expect(chain).toContain('iquine pintalar 3.6l')
    expect(chain).toContain('ambiente: interno')
    // Antes do R142, chain era "Pedro > tintas > iquine pintalar 3.6l" (sem ambiente)
  })

  it('chain completa: marca + ambiente + tipo + cor + acabamento + quantidade', () => {
    const tags = [
      'interesse:tintas',
      'produto:iquine_pintalar',
      'marca_preferida:iquine',
      'ambiente:interno',
      'tipo_tinta:acrilica',
      'cor:cinza_andorinha',
      'acabamento:fosco',
      'quantidade:2_latas',
    ]
    const chain = buildQualificationChain(tags, {}, 'Sandrielly')
    expect(chain).toBe('Sandrielly > tintas > iquine pintalar > iquine > ambiente: interno > tipo: acrilica > cor: cinza andorinha > fosco > 2 latas')
  })

  it('chuveiro: inclui voltagem', () => {
    const tags = ['interesse:chuveiros_eletricos', 'voltagem:220v', 'produto:lorenzetti_loren_acqua']
    const chain = buildQualificationChain(tags, {}, 'João')
    expect(chain).toContain('220v')
  })

  it('volume preservado pra tintas (3.6l, 18l)', () => {
    const tags = ['interesse:tintas', 'volume:3.6l']
    const chain = buildQualificationChain(tags, {}, null)
    expect(chain).toContain('3.6l')
  })

  it('marca indisponível mostrada com sufixo', () => {
    const tags = ['interesse:tintas', 'marca_indisponivel:tinta_xyz']
    const chain = buildQualificationChain(tags, {}, null)
    expect(chain).toContain('tinta xyz')
    expect(chain).toContain('(indisponível)')
  })

  it('vazio retorna só name (ou string vazia)', () => {
    expect(buildQualificationChain([], {}, 'Pedro')).toBe('Pedro')
    expect(buildQualificationChain([], {}, null)).toBe('')
  })
})

// =============================================================================
// REGRESSION TEST — caso histórico Sandrielly query EXATA pó-cleanup
// =============================================================================

describe('R137+R138 — regressão Sandrielly NÃO repete', () => {
  it('query EXATA do log prod 22:13:09 não causa crash em .or()', async () => {
    const { supabase, orFilterCalls } = makeRealisticSupabase([])
    const agent = makeAgent()
    const log = makeLog()

    // Query EXATA que crashou em prod (capturada de ai_agent_logs.metadata.query):
    const exactProdQuery = 'iquine por quanto esta a tinta pintalar da , de 3,6l? com george'

    const ctxSearch = makeSearchCtx(supabase, agent, ['interesse:tintas'])

    // Antes do R138, este call lançava PostgREST 400.
    // Agora deve sanitizar args.query no entry e nunca passar vírgula pro .or().
    const result = await dispatchSearchTool('search_products', {
      query: exactProdQuery,
      category: 'tintas',
    }, ctxSearch, log) as string

    expect(typeof result).toBe('string')
    // Verifica TODOS os .or() chamados — nenhum value tem vírgula nem "?" nem "("
    expect(orFilterCalls.length).toBeGreaterThan(0)
    for (const orExpr of orFilterCalls) {
      const valueMatches = orExpr.matchAll(/\.ilike\.%([^%]*)%/g)
      for (const m of valueMatches) {
        expect(m[1]).not.toContain(',')
        expect(m[1]).not.toContain('?')
        expect(m[1]).not.toContain('(')
      }
    }
  })
})
