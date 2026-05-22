import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock antes do import — generateCarouselCopies usa Deno.env (não existe em vitest/Node).
vi.mock('../../carousel.ts', () => ({
  generateCarouselCopies: vi.fn(async (product: any, count: number) =>
    Array(count).fill(`${product.title} — copy mockada`),
  ),
}))

import { dispatchMediaTool, sendCarousel, sendMedia, sendPoll } from './mediaTools.ts'
import type { MediaToolsCtx } from './mediaTools.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabaseSpy() {
  const calls: Array<{ table: string; op: string; payload: any; chain: string[] }> = []
  const supabase: any = {
    from(table: string) {
      const queryState: { filters: Array<[string, any]>; selectCols?: string } = { filters: [] }
      const builder: any = {
        select(cols: string) {
          queryState.selectCols = cols
          return builder
        },
        eq(col: string, val: any) {
          queryState.filters.push([col, val])
          return builder
        },
        in(col: string, vals: any[]) {
          queryState.filters.push([col, vals])
          // simulate a final result for the carousel product query
          if (table === 'ai_agent_products') {
            return Promise.resolve({
              data: PRODUCTS_FIXTURE.filter((p) => (vals as string[]).includes(p.title)),
              error: null,
            })
          }
          return builder
        },
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload, chain: [] })
          return Promise.resolve({ data: null, error: null })
        },
      }
      return builder
    },
  }
  return { supabase, calls }
}

const PRODUCTS_FIXTURE = [
  {
    title: 'Tinta Coral 18L',
    description: 'Tinta acrílica fosca branca neve, 18 litros',
    price: 489.9,
    images: ['https://cdn.example/coral18l_1.jpg', 'https://cdn.example/coral18l_2.jpg'],
    in_stock: true,
  },
  {
    title: 'Tinta Suvinil 3.6L',
    description: 'Tinta acrílica acetinada azul',
    price: 89.9,
    images: ['https://cdn.example/suvinil_3l6.jpg'],
    in_stock: true,
  },
  {
    title: 'Sem imagem',
    description: 'Produto sem foto',
    price: 50.0,
    images: [],
    in_stock: true,
  },
]

function baseCtx(overrides: Partial<MediaToolsCtx> = {}): MediaToolsCtx {
  const { supabase } = makeSupabaseSpy()
  return {
    supabase,
    agent: { carousel_button_1: 'Quero esse', carousel_button_2: 'Mais info' },
    agent_id: 'agt-1',
    conversation: { inbox_id: 'inb-1' },
    conversation_id: 'conv-1',
    contact: { jid: '5581987654321@s.whatsapp.net' },
    instance: { token: 'tok-123' },
    instance_id: 'inst-1',
    uazapiUrl: 'https://uazapi.example',
    broadcastEvent: vi.fn(),
    ...overrides,
  }
}

// Stub global fetch — usado por fetchWithTimeout.
const originalFetch = globalThis.fetch
function mockFetchSequence(responses: Array<{ ok: boolean; status: number; body: string }>) {
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
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
  }) as any
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ────────────────────────────────────────────────────────────────────
// send_carousel
// ────────────────────────────────────────────────────────────────────

describe('sendCarousel', () => {
  it('valida ausência de product_ids', async () => {
    const r = await sendCarousel({ product_ids: [] }, baseCtx(), makeLog())
    expect(r).toBe('Nenhum produto especificado.')
  })

  it('valida limite de 10 produtos', async () => {
    const r = await sendCarousel(
      { product_ids: Array(11).fill('x') },
      baseCtx(),
      makeLog(),
    )
    expect(r).toBe('Máximo de 10 produtos por carrossel.')
  })

  it('retorna msg amigável quando produtos não têm imagem', async () => {
    const spy = makeSupabaseSpy()
    const r = await sendCarousel(
      { product_ids: ['Sem imagem'] },
      baseCtx({ supabase: spy.supabase }),
      makeLog(),
    )
    expect(r).toBe('Nenhum produto com imagem. Descreva por texto.')
  })

  it('happy path multi-produto: chama UAZAPI, insere msg, broadcast, retorna sucesso', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{"ok":true}' }])
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({ supabase: spy.supabase })
    const r = await sendCarousel(
      { product_ids: ['Tinta Coral 18L', 'Tinta Suvinil 3.6L'], message: 'Tintas pra você' },
      ctx,
      makeLog(),
    )

    expect(r).toContain('Carrossel enviado')
    expect(r).toContain('2 produto(s)')
    expect(ctx.broadcastEvent).toHaveBeenCalledTimes(1)
    const msgInsert = spy.calls.find((c) => c.table === 'conversation_messages')
    expect(msgInsert).toBeTruthy()
    expect(msgInsert!.payload.media_type).toBe('carousel')
    expect(msgInsert!.payload.content).toBe('Tintas pra você')
  })

  it('happy path single-product multi-foto: dispara Multi-photo carousel + copies mockadas', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{"ok":true}' }])
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({ supabase: spy.supabase })
    const log = makeLog()
    const r = await sendCarousel({ product_ids: ['Tinta Coral 18L'] }, ctx, log)

    expect(r).toContain('Carrossel enviado')
    expect(r).toContain('fotos')
    expect(log.info).toHaveBeenCalledWith(
      'Multi-photo carousel',
      expect.objectContaining({ title: 'Tinta Coral 18L', photoCount: 2 }),
    )
  })

  it('retry: 1ª variante falha (missing), 2ª passa', async () => {
    mockFetchSequence([
      { ok: false, status: 400, body: 'missing field phone' },
      { ok: true, status: 200, body: '{"ok":true}' },
    ])
    const r = await sendCarousel(
      { product_ids: ['Tinta Suvinil 3.6L'] },
      baseCtx(),
      makeLog(),
    )
    expect(r).toContain('Carrossel enviado')
  })

  it('todas 4 variantes falham → retorna erro', async () => {
    mockFetchSequence(Array(4).fill({ ok: false, status: 500, body: 'err' }))
    const r = await sendCarousel(
      { product_ids: ['Tinta Suvinil 3.6L'] },
      baseCtx(),
      makeLog(),
    )
    expect(r).toBe('Erro ao enviar carrossel. Descreva os produtos por texto.')
  })
})

// ────────────────────────────────────────────────────────────────────
// send_media
// ────────────────────────────────────────────────────────────────────

describe('sendMedia', () => {
  it('valida media_url obrigatório', async () => {
    const r = await sendMedia({}, baseCtx(), makeLog())
    expect(r).toBe('URL da mídia não informada.')
  })

  it('happy path image: chama UAZAPI + INSERT msg', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{"ok":true}' }])
    const spy = makeSupabaseSpy()
    const r = await sendMedia(
      { media_url: 'https://cdn.x/img.jpg', media_type: 'image', caption: 'Veja' },
      baseCtx({ supabase: spy.supabase }),
      makeLog(),
    )

    expect(r).toContain('Mídia enviada')
    const msgInsert = spy.calls.find((c) => c.table === 'conversation_messages')
    expect(msgInsert!.payload.media_type).toBe('image')
    expect(msgInsert!.payload.content).toBe('Veja')
  })

  it('media_type inválido cai pra image', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{}' }])
    const spy = makeSupabaseSpy()
    await sendMedia(
      { media_url: 'https://x', media_type: 'audio', caption: '' },
      baseCtx({ supabase: spy.supabase }),
      makeLog(),
    )
    const msgInsert = spy.calls.find((c) => c.table === 'conversation_messages')
    expect(msgInsert!.payload.media_type).toBe('image')
  })

  it('UAZAPI 500 → erro amigável', async () => {
    mockFetchSequence([{ ok: false, status: 500, body: 'err' }])
    const r = await sendMedia(
      { media_url: 'https://x', media_type: 'image' },
      baseCtx(),
      makeLog(),
    )
    expect(r).toBe('Erro ao enviar mídia (500). Descreva por texto.')
  })
})

// ────────────────────────────────────────────────────────────────────
// send_poll
// ────────────────────────────────────────────────────────────────────

describe('sendPoll', () => {
  it('valida pergunta + 2-12 opções', async () => {
    expect(await sendPoll({}, baseCtx(), makeLog())).toBe('Enquete precisa de pergunta + 2-12 opcoes.')
    expect(await sendPoll({ question: 'q', options: ['a'] }, baseCtx(), makeLog())).toBe(
      'Enquete precisa de pergunta + 2-12 opcoes.',
    )
    expect(await sendPoll({ question: 'q', options: Array(13).fill('a') }, baseCtx(), makeLog())).toBe(
      'Enquete precisa de pergunta + 2-12 opcoes.',
    )
  })

  it('happy path: chama /send/menu, INSERT poll_messages + conversation_messages + broadcast', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{"messageId":"poll-xyz"}' }])
    const spy = makeSupabaseSpy()
    const ctx = baseCtx({ supabase: spy.supabase })
    const r = await sendPoll(
      { question: 'Qual cor?', options: ['Azul', 'Verde', 'Vermelho'] },
      ctx,
      makeLog(),
    )

    expect(r).toContain('Enquete enviada')
    expect(r).toContain('Qual cor?')
    expect(r).toContain('3 opcoes')

    const pollInsert = spy.calls.find((c) => c.table === 'poll_messages')
    expect(pollInsert!.payload.message_id).toBe('poll-xyz')
    expect(pollInsert!.payload.selectable_count).toBe(1) // default

    const msgInsert = spy.calls.find((c) => c.table === 'conversation_messages')
    expect(msgInsert!.payload.media_type).toBe('poll')

    expect(ctx.broadcastEvent).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      media_type: 'poll',
    })
  })

  it('selectable_count=0 (multi-select) preservado', async () => {
    mockFetchSequence([{ ok: true, status: 200, body: '{}' }])
    const spy = makeSupabaseSpy()
    await sendPoll(
      { question: 'q', options: ['a', 'b'], selectable_count: 0 },
      baseCtx({ supabase: spy.supabase }),
      makeLog(),
    )
    const pollInsert = spy.calls.find((c) => c.table === 'poll_messages')
    expect(pollInsert!.payload.selectable_count).toBe(0)
  })

  it('UAZAPI 500 → erro amigável', async () => {
    mockFetchSequence([{ ok: false, status: 500, body: 'err' }])
    const r = await sendPoll(
      { question: 'q', options: ['a', 'b'] },
      baseCtx(),
      makeLog(),
    )
    expect(r).toBe('Erro ao enviar enquete (500). Faca a pergunta por texto.')
  })
})

// ────────────────────────────────────────────────────────────────────
// dispatchMediaTool
// ────────────────────────────────────────────────────────────────────

describe('dispatchMediaTool', () => {
  it('roteia send_carousel', async () => {
    const r = await dispatchMediaTool('send_carousel', { product_ids: [] }, baseCtx(), makeLog())
    expect(r).toBe('Nenhum produto especificado.')
  })

  it('roteia send_media', async () => {
    const r = await dispatchMediaTool('send_media', {}, baseCtx(), makeLog())
    expect(r).toBe('URL da mídia não informada.')
  })

  it('roteia send_poll', async () => {
    const r = await dispatchMediaTool('send_poll', {}, baseCtx(), makeLog())
    expect(r).toBe('Enquete precisa de pergunta + 2-12 opcoes.')
  })

  it('retorna null pra tool não-mídia', async () => {
    const r = await dispatchMediaTool('set_tags', { tags: [] }, baseCtx(), makeLog())
    expect(r).toBeNull()
  })
})
