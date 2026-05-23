import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock callLLM antes de importar router
const mockState = vi.hoisted(() => ({
  callLLMQueue: [] as any[],
  callLLMCalls: [] as any[],
}))

vi.mock('../llmProvider.ts', () => ({
  callLLM: vi.fn(async (req: any) => {
    mockState.callLLMCalls.push(req)
    if (mockState.callLLMQueue.length === 0) {
      throw new Error('mock callLLM queue empty')
    }
    const next = mockState.callLLMQueue.shift()
    if (next instanceof Error) throw next
    return next
  }),
}))

import { classifyIntent, logRouterRun, ROUTER_SYSTEM_PROMPT, VALID_INTENTS, type RouterCtx } from './router.ts'

// =============================================================================
// Helpers
// =============================================================================

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeLLMResponse(text: string, overrides: Partial<{ model: string; inputTokens: number; outputTokens: number; latency_ms: number }> = {}) {
  return {
    text,
    toolCalls: [],
    inputTokens: overrides.inputTokens ?? 80,
    outputTokens: overrides.outputTokens ?? 30,
    model: overrides.model ?? 'gpt-5-nano',
    provider: 'openai' as const,
    latency_ms: overrides.latency_ms ?? 320,
  }
}

function makeCtx(overrides: Partial<RouterCtx> = {}): RouterCtx {
  return {
    lastIncoming: 'Oi, tudo bem?',
    conversationTags: [],
    shortHistory: [],
    log: makeLog() as any,
    ...overrides,
  }
}

beforeEach(() => {
  mockState.callLLMQueue.length = 0
  mockState.callLLMCalls.length = 0
  vi.clearAllMocks()
})

// =============================================================================
// Tests
// =============================================================================

describe('classifyIntent — happy paths (7 intents)', () => {
  it.each([
    ['saudacao', 'Oi tudo bem?'],
    ['qualificacao', 'Preciso de tinta'],
    ['produto', 'Quanto custa a Coral 18L fosca?'],
    ['handoff', 'Quero falar com um vendedor agora'],
    ['objecao', 'Tá muito caro isso, encontrei mais barato'],
    ['pagamento', 'Aceita pix? Pode parcelar?'],
    ['fora_escopo', 'Qual a previsão do tempo amanhã?'],
  ])('classifica intent=%s', async (intent, lastIncoming) => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent, confidence: 0.9, reason: 'casa exato' })),
    )
    const ctx = makeCtx({ lastIncoming })
    const result = await classifyIntent(ctx)
    expect(result.intent).toBe(intent)
    expect(result.confidence).toBe(0.9)
    expect(result.fallback).toBe(false)
    expect(VALID_INTENTS).toContain(result.intent)
  })
})

describe('classifyIntent — defesa em profundidade', () => {
  it('JSON malformado → fallback qualificacao', async () => {
    mockState.callLLMQueue.push(makeLLMResponse('isso não é JSON {{'))
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('qualificacao')
    expect(result.fallback).toBe(true)
    expect(result.reason).toContain('parse failed')
  })

  it('JSON com markdown fence ```json...``` é tolerado', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse('```json\n{"intent":"produto","confidence":0.85,"reason":"pediu coral"}\n```'),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('produto')
    expect(result.fallback).toBe(false)
  })

  it('JSON envolto em texto extra é tolerado (extrai entre { e })', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse('Aqui está minha análise: {"intent":"handoff","confidence":0.9,"reason":"pediu vendedor"} - obrigado'),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('handoff')
  })

  it('intent inválido (não está nas 7 categorias) → fallback qualificacao', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'compra_imediata', confidence: 0.95, reason: 'quer comprar' })),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('qualificacao')
    expect(result.fallback).toBe(true)
    expect(result.reason).toContain('compra_imediata')
  })

  it('confidence < 0.6 → override pra qualificacao mesmo com intent válido', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'objecao', confidence: 0.45, reason: 'incerto' })),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('qualificacao')
    expect(result.fallback).toBe(true)
    expect(result.confidence).toBe(0.45) // preserva a confidence original do LLM
    expect(result.reason).toContain('low-confidence')
    expect(result.reason).toContain('era objecao')
  })

  it('confidence < 0.6 + intent JÁ é qualificacao → NÃO marca fallback (caminho normal)', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'qualificacao', confidence: 0.5, reason: 'genérico' })),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('qualificacao')
    expect(result.fallback).toBe(false)
  })

  it('LLM exception → fallback qualificacao com confidence 0.5', async () => {
    mockState.callLLMQueue.push(new Error('network timeout'))
    const result = await classifyIntent(makeCtx())
    expect(result.intent).toBe('qualificacao')
    expect(result.fallback).toBe(true)
    expect(result.confidence).toBe(0.5)
    expect(result.reason).toContain('network timeout')
  })

  it('confidence > 1 é clampada pra 1.0', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'produto', confidence: 1.5, reason: 'super claro' })),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.confidence).toBe(1)
  })

  it('confidence negativa é clampada pra 0', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'qualificacao', confidence: -0.2, reason: 'erro' })),
    )
    const result = await classifyIntent(makeCtx())
    expect(result.confidence).toBe(0)
  })
})

describe('classifyIntent — prompt construction', () => {
  it('passa system prompt + user message com tags + history pra callLLM', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'produto', confidence: 0.8, reason: 'ok' })),
    )
    const ctx = makeCtx({
      lastIncoming: 'tinta fosca branca',
      conversationTags: ['interesse:tintas', 'cor:branca'],
      shortHistory: [
        { role: 'user', content: 'olá' },
        { role: 'assistant', content: 'oi! posso ajudar?' },
      ],
    })
    await classifyIntent(ctx)
    const call = mockState.callLLMCalls[0]
    expect(call.systemPrompt).toBe(ROUTER_SYSTEM_PROMPT)
    expect(call.messages[0].role).toBe('user')
    expect(call.messages[0].content).toContain('interesse:tintas, cor:branca')
    expect(call.messages[0].content).toContain('tinta fosca branca')
    expect(call.messages[0].content).toContain('[user] olá')
    expect(call.messages[0].content).toContain('[assistant] oi! posso ajudar?')
    expect(call.tools).toEqual([])
    expect(call.maxTokens).toBe(150)
    expect(call.temperature).toBe(0.1)
  })

  it('respeita routerModel override', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'qualificacao', confidence: 0.8, reason: '' }), {
        model: 'gpt-4.1-mini',
      }),
    )
    const ctx = makeCtx({ routerModel: 'gpt-4.1-mini' })
    await classifyIntent(ctx)
    expect(mockState.callLLMCalls[0].model).toBe('gpt-4.1-mini')
  })

  it('history > 5 msgs é truncado pra últimas 5', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse(JSON.stringify({ intent: 'qualificacao', confidence: 0.8, reason: '' })),
    )
    const ctx = makeCtx({
      shortHistory: Array.from({ length: 10 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `msg ${i}`,
      })),
    })
    await classifyIntent(ctx)
    const userMsg = mockState.callLLMCalls[0].messages[0].content
    expect(userMsg).toContain('msg 5')
    expect(userMsg).toContain('msg 9')
    expect(userMsg).not.toContain('msg 0')
    expect(userMsg).not.toContain('msg 4')
  })
})

describe('logRouterRun', () => {
  it('INSERT em ai_agent_runs com hop_n=0, specialist=router, todos os campos', async () => {
    const inserts: any[] = []
    const supabase: any = {
      from(_table: string) {
        return {
          insert(payload: any) {
            inserts.push({ table: _table, payload })
            return Promise.resolve({ data: null, error: null })
          },
        }
      },
    }
    await logRouterRun(supabase, {
      conversation_id: 'conv-1',
      agent_id: 'agent-1',
      turn_id: 'turn-uuid-x',
      result: {
        intent: 'produto',
        confidence: 0.92,
        reason: 'marca + tamanho',
        model: 'gpt-5-nano',
        inputTokens: 80,
        outputTokens: 30,
        latencyMs: 380,
        fallback: false,
      },
      promptChars: 850,
      log: makeLog() as any,
    })
    expect(inserts).toHaveLength(1)
    expect(inserts[0].table).toBe('ai_agent_runs')
    expect(inserts[0].payload).toMatchObject({
      conversation_id: 'conv-1',
      agent_id: 'agent-1',
      turn_id: 'turn-uuid-x',
      hop_n: 0,
      specialist: 'router',
      intent: 'produto',
      confidence: 0.92,
      model: 'gpt-5-nano',
      input_tokens: 80,
      output_tokens: 30,
      latency_ms: 380,
      prompt_chars: 850,
    })
    expect(inserts[0].payload.metadata).toMatchObject({
      reason: 'marca + tamanho',
      fallback: false,
    })
  })

  it('INSERT failure NÃO bloqueia pipeline (log warn + segue)', async () => {
    const supabase: any = {
      from() {
        return {
          insert: () => Promise.reject(new Error('db down')),
        }
      },
    }
    const log = makeLog()
    await expect(
      logRouterRun(supabase, {
        conversation_id: 'c',
        agent_id: 'a',
        turn_id: 't',
        result: {
          intent: 'qualificacao',
          confidence: 0.7,
          reason: '',
          model: 'gpt-5-nano',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          fallback: false,
        },
        promptChars: 0,
        log: log as any,
      }),
    ).resolves.toBeUndefined()
    expect(log.warn).toHaveBeenCalledWith(
      'logRouterRun insert failed (non-fatal)',
      expect.objectContaining({ error: 'db down' }),
    )
  })
})
