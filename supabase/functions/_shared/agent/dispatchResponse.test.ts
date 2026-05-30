import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ttsProviders — splitAudioAndText e ttsWithFallback usam Deno.env
vi.mock('../ttsProviders.ts', () => ({
  splitAudioAndText: vi.fn((text: string, maxLen: number) => {
    if (text.length <= maxLen) return null
    // Mock split: primeira frase como audio + tudo como text
    const firstSentence = text.split(/[.!?]/)[0] + '.'
    return { audioText: firstSentence, fullText: text }
  }),
}))

// Mock objectionDetection (uses regex; safe to use real, but for predictability mock it)
vi.mock('../objectionDetection.ts', () => ({
  detectObjection: vi.fn((msg: string) => {
    if (/caro|preço/i.test(msg)) return 'preco'
    return null
  }),
}))

import { dispatchResponse, type DispatchResponseCtx } from './dispatchResponse.ts'

// =============================================================================
// Helpers
// =============================================================================

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabaseSpy() {
  const inserts: any[] = []
  const updates: any[] = []
  const upserts: any[] = []
  const supabase: any = {
    from(table: string) {
      return {
        insert(payload: any) {
          inserts.push({ table, payload })
          return {
            select() {
              return {
                single: async () => ({
                  data: { id: `msg_${inserts.length}`, created_at: new Date().toISOString() },
                  error: null,
                }),
              }
            },
            then: (resolve: any) => resolve({ data: null, error: null }),
          }
        },
        update(payload: any) {
          return {
            eq(col: string, val: any) {
              updates.push({ table, payload, where: { [col]: val } })
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        upsert(payload: any, opts?: any) {
          upserts.push({ table, payload, opts })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  return { supabase, inserts, updates, upserts }
}

function makeCtx(overrides: Partial<DispatchResponseCtx> = {}): {
  ctx: DispatchResponseCtx
  inserts: any[]
  updates: any[]
  upserts: any[]
} {
  const sup = makeSupabaseSpy()
  const ctx: DispatchResponseCtx = {
    responseText: 'Tudo certo, posso ajudar.',
    agent: {
      voice_enabled: false,
      voice_max_text_length: 150,
      voice_reply_to_audio: true,
      notify_outside_hours_on_handoff: false,
      business_hours: null,
      extended_hours_until: null,
    },
    agent_id: 'agent-1',
    conversation: { tags: [], inbox_id: 'inbox-1', status_ia: 'ligada' },
    conversation_id: 'conv-1',
    contact: { id: 'contact-1' },
    toolCallsLog: [],
    inputTokens: 100,
    outputTokens: 50,
    usedModel: 'gpt-4.1-mini',
    hadExplicitHandoffInLoop: false,
    profileData: null,
    funnelData: null,
    leadProfile: null,
    incomingText: 'oi',
    incomingHasAudio: false,
    queuedMessages: [],
    pendingHandoffTrigger: null,
    pendingHandoffTriggerMsg: '',
    startTime: Date.now(),
    sendTextMsg: vi.fn(async () => undefined),
    sendTts: vi.fn(async () => true),
    sendPresence: vi.fn(),
    broadcastEvent: vi.fn(),
    pickHandoffMessage: vi.fn(() => 'Vou te encaminhar pro consultor.'),
    runQueueAssignment: vi.fn(async (template: string) => ({
      result: { assigned_to: 'user-x', queue_event_id: 'q1' },
      finalMessage: template || 'Vou te encaminhar.',
    })),
    supabase: sup.supabase,
    log: makeLog() as any,
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    ...overrides,
  }
  return { ctx, inserts: sup.inserts, updates: sup.updates, upserts: sup.upserts }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// Tests
// =============================================================================

describe('dispatchResponse — happy paths', () => {
  it('envia texto simples + INSERT msg + UPDATE conv (status_ia LIGADA) + broadcast + log + lead_profile upsert', async () => {
    const { ctx, inserts, updates, upserts } = makeCtx()
    const result = await dispatchResponse(ctx)
    expect(ctx.sendTextMsg).toHaveBeenCalledWith('Tudo certo, posso ajudar.')
    expect(inserts.some((i) => i.table === 'conversation_messages')).toBe(true)
    expect(updates.some((u) => u.table === 'conversations' && u.payload.status_ia === 'ligada')).toBe(true)
    expect(ctx.broadcastEvent).toHaveBeenCalled()
    expect(inserts.some((i) => i.table === 'ai_agent_logs' && i.payload.event === 'response_sent')).toBe(true)
    expect(upserts.some((u) => u.table === 'lead_profiles')).toBe(true)
    expect(result.response.status).toBe(200)
  })

  it('Response 200 com body { ok, conversation_id, response, tokens, latency_ms }', async () => {
    const { ctx } = makeCtx()
    const result = await dispatchResponse(ctx)
    const body = await result.response.json()
    expect(body.ok).toBe(true)
    expect(body.conversation_id).toBe('conv-1')
    expect(body.response).toBe('Tudo certo, posso ajudar.')
    expect(body.tokens).toEqual({ input: 100, output: 50 })
    expect(typeof body.latency_ms).toBe('number')
  })
})

describe('dispatchResponse — TTS branches', () => {
  it('voice_enabled + responseText curto → manda audio direto via sendTts', async () => {
    const { ctx, inserts } = makeCtx({
      agent: {
        voice_enabled: true,
        voice_max_text_length: 150,
        voice_reply_to_audio: true,
      },
      responseText: 'Curtinha pra audio.',
    })
    await dispatchResponse(ctx)
    expect(ctx.sendPresence).toHaveBeenCalledWith('recording')
    expect(ctx.sendTts).toHaveBeenCalledWith('Curtinha pra audio.')
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
    // sentMediaType = 'audio' deve aparecer no INSERT msg
    const msgInsert = inserts.find((i) => i.table === 'conversation_messages')
    expect(msgInsert.payload.media_type).toBe('audio')
  })

  it('TTS falha → fallback pra sendTextMsg + log tts_error', async () => {
    const { ctx, inserts } = makeCtx({
      agent: { voice_enabled: true, voice_max_text_length: 150, voice_reply_to_audio: true },
      sendTts: vi.fn(async () => false),
      responseText: 'Mensagem curta.',
    })
    await dispatchResponse(ctx)
    expect(ctx.sendTextMsg).toHaveBeenCalledWith('Mensagem curta.')
    const logInsert = inserts.find((i) => i.table === 'ai_agent_logs' && i.payload.event === 'response_sent')
    expect(logInsert.payload.metadata.tts_error).toBe('all_providers_failed')
  })

  it('wantsAudio + responseText longo → split: audio summary + sendTextMsg full', async () => {
    const longText = 'Primeira frase resumo. ' + 'Detalhes longos. '.repeat(20)
    const { ctx } = makeCtx({
      agent: { voice_enabled: true, voice_max_text_length: 30, voice_reply_to_audio: true },
      responseText: longText,
    })
    await dispatchResponse(ctx)
    expect(ctx.sendTts).toHaveBeenCalledWith('Primeira frase resumo.')
    expect(ctx.sendTextMsg).toHaveBeenCalledWith(longText)
  })

  it('incomingHasAudio + voice_reply_to_audio (mesmo sem voice_enabled) → manda audio', async () => {
    const { ctx } = makeCtx({
      agent: { voice_enabled: false, voice_max_text_length: 150, voice_reply_to_audio: true },
      incomingHasAudio: true,
      responseText: 'Resposta curta.',
    })
    await dispatchResponse(ctx)
    expect(ctx.sendTts).toHaveBeenCalled()
  })
})

describe('dispatchResponse — handoff branches', () => {
  it('hadExplicitHandoffInLoop=true + responseText vazio → skipTextSend + sem INSERT msg', async () => {
    const { ctx, inserts } = makeCtx({
      hadExplicitHandoffInLoop: true,
      responseText: '',
      toolCallsLog: [{ name: 'handoff_to_human', args: {}, result: 'ok' }],
    })
    await dispatchResponse(ctx)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
    expect(ctx.sendTts).not.toHaveBeenCalled()
    expect(inserts.some((i) => i.table === 'conversation_messages')).toBe(false)
    // Mas response_sent ainda é logado
    expect(inserts.some((i) => i.table === 'ai_agent_logs' && i.payload.event === 'response_sent')).toBe(true)
  })

  it('handoff explícito via toolCallsLog → effectiveStatusIa=SHADOW no broadcast + outcome=handoff no lead_profile', async () => {
    const { ctx, upserts } = makeCtx({
      hadExplicitHandoffInLoop: true,
      responseText: '',
      toolCallsLog: [{ name: 'handoff_to_human', args: {}, result: 'ok' }],
    })
    await dispatchResponse(ctx)
    const broadcastCall = (ctx.broadcastEvent as any).mock.calls[0]?.[0]
    expect(broadcastCall.status_ia).toBe('shadow')
    const profileUpsert = upserts.find((u) => u.table === 'lead_profiles')
    const summary = profileUpsert.payload.conversation_summaries.at(-1)
    expect(summary.outcome).toBe('handoff')
  })

  it('handoff implícito detectado via HANDOFF_PATTERNS → switch SHADOW + queue + implicit_handoff log', async () => {
    const { ctx, updates, inserts } = makeCtx({
      responseText: 'Vou te encaminhar pro nosso consultor agora mesmo.',
    })
    await dispatchResponse(ctx)
    expect(ctx.runQueueAssignment).toHaveBeenCalledWith('')
    // UPDATE conversations seta SHADOW
    expect(updates.some((u) => u.table === 'conversations' && u.payload.status_ia === 'shadow')).toBe(true)
    const shadowUpdate = updates.find((u) => u.table === 'conversations' && u.payload.status_ia === 'shadow')
    expect(shadowUpdate?.payload.tags).toContain('followups_paused:true')
    // ai_agent_logs com event=implicit_handoff
    expect(inserts.some((i) => i.table === 'ai_agent_logs' && i.payload.event === 'implicit_handoff')).toBe(true)
  })

  it('"não vou te encaminhar" NÃO dispara handoff implícito (regex negative lookbehind)', async () => {
    const { ctx, inserts } = makeCtx({
      responseText: 'Não vou te encaminhar agora, posso responder.',
    })
    await dispatchResponse(ctx)
    expect(ctx.runQueueAssignment).not.toHaveBeenCalled()
    expect(inserts.some((i) => i.table === 'ai_agent_logs' && i.payload.event === 'implicit_handoff')).toBe(false)
  })
})

describe('dispatchResponse — deferred handoff trigger (step 22)', () => {
  it('pendingHandoffTrigger + sem handoff explícito → executa trigger deferred', async () => {
    const { ctx, inserts, updates } = makeCtx({
      pendingHandoffTrigger: 'falar com humano',
      pendingHandoffTriggerMsg: 'quero falar com alguém',
    })
    await dispatchResponse(ctx)
    expect(ctx.runQueueAssignment).toHaveBeenCalled()
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(2) // primeira pro responseText, segunda pro deferred handoff
    expect(inserts.some((i) => i.table === 'ai_agent_logs' && i.payload.event === 'handoff_trigger')).toBe(true)
    expect(updates.some((u) => u.table === 'conversations' && u.payload.status_ia === 'shadow')).toBe(true)
    const shadowUpdate = updates.find((u) => u.table === 'conversations' && u.payload.status_ia === 'shadow')
    expect(shadowUpdate?.payload.tags).toContain('followups_paused:true')
  })

  it('deferred handoff detecta objeção no msg do trigger → adiciona objecao tag', async () => {
    const { ctx, updates } = makeCtx({
      pendingHandoffTrigger: 'falar com humano',
      pendingHandoffTriggerMsg: 'tá muito caro isso',
    })
    await dispatchResponse(ctx)
    const convUpdate = updates.find((u) => u.table === 'conversations' && u.payload.status_ia === 'shadow')
    const tags = convUpdate.payload.tags as string[]
    expect(tags.some((t) => t.startsWith('objecao:'))).toBe(true)
  })

  it('NÃO executa deferred handoff quando já houve handoff explícito', async () => {
    const { ctx } = makeCtx({
      pendingHandoffTrigger: 'falar com humano',
      pendingHandoffTriggerMsg: 'algo',
      toolCallsLog: [{ name: 'handoff_to_human', args: {} }],
      hadExplicitHandoffInLoop: true,
      responseText: '',
    })
    await dispatchResponse(ctx)
    // runQueueAssignment NÃO deve ser chamada (handoff já foi executado pelo tool)
    expect(ctx.runQueueAssignment).not.toHaveBeenCalled()
  })
})

describe('dispatchResponse — lead_profile update', () => {
  it('persiste summary com products + outcome + tools_used + sentiment de tags', async () => {
    const { ctx, upserts } = makeCtx({
      conversation: {
        tags: ['sentimento:positivo'],
        inbox_id: 'inbox-1',
        status_ia: 'ligada',
      },
      toolCallsLog: [
        { name: 'search_products', args: { query: 'tinta acrílica' } },
        { name: 'send_carousel', args: { product_ids: ['Tinta Coral 18L'] } },
      ],
      leadProfile: { conversation_summaries: [], total_interactions: 3 },
    })
    await dispatchResponse(ctx)
    const upsert = upserts.find((u) => u.table === 'lead_profiles')
    expect(upsert.payload.contact_id).toBe('contact-1')
    expect(upsert.payload.total_interactions).toBe(4) // 3 + 1
    const summary = upsert.payload.conversation_summaries.at(-1)
    expect(summary.products).toEqual(expect.arrayContaining(['tinta acrílica', 'Tinta Coral 18L']))
    expect(summary.sentiment).toBe('positivo')
    expect(summary.outcome).toBe('respondido')
    expect(summary.tools_used).toEqual(expect.arrayContaining(['search_products', 'send_carousel']))
  })

  it('limita conversation_summaries a 10 últimas (slice -10)', async () => {
    const existing = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-05-${i + 1}`,
      summary: `s${i}`,
    }))
    const { ctx, upserts } = makeCtx({
      leadProfile: { conversation_summaries: existing, total_interactions: 12 },
    })
    await dispatchResponse(ctx)
    const upsert = upserts.find((u) => u.table === 'lead_profiles')
    expect(upsert.payload.conversation_summaries).toHaveLength(10)
  })
})
