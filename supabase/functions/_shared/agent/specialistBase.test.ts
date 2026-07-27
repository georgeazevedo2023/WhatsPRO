import { describe, it, expect, vi, beforeEach } from 'vitest'

// =============================================================================
// specialistBase.test.ts — R150/R152 (2026-07-26)
//
// R150: o bloco <knowledge_base> (FAQ) precisa chegar no system prompt de TODO
// specialist. A regressão original (migração monolito→router, 2026-05-24 →
// 2026-07-25) passou ~2 meses sem NENHUM teste alarmar porque nada assertava o
// CONTEÚDO do prompt final montado aqui. Este arquivo fecha esse buraco.
//
// R152: errorMessage cru do LLM loop precisa subir no SpecialistResult (o
// routerPipeline classifica transitório × permanente pro fallback do D6).
// =============================================================================

const mockState = vi.hoisted(() => ({
  llmCalls: [] as any[],
  llmResult: null as any,
  dispatchCalls: [] as any[],
}))

vi.mock('./llmCallLoop.ts', () => ({
  runLlmCallLoop: vi.fn(async (ctx: any) => {
    mockState.llmCalls.push(ctx)
    return mockState.llmResult
  }),
}))

vi.mock('./dispatchResponse.ts', () => ({
  dispatchResponse: vi.fn(async (ctx: any) => {
    mockState.dispatchCalls.push(ctx)
    return { response: new Response(JSON.stringify({ ok: true }), { status: 200 }) }
  }),
}))

vi.mock('./leadMemory.ts', () => ({
  buildLeadMemoryBlock: vi.fn(() => ''),
  consolidateLeadMemory: vi.fn(async () => undefined),
}))

import { runSpecialist, type SpecialistCtx, type SpecialistDef } from './specialistBase.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabase() {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ data: null, error: null })),
    })),
  }
}

function makeCtx(overrides: Partial<SpecialistCtx> = {}): SpecialistCtx {
  return {
    turn_id: 'turn_test_1',
    agent: { name: 'Sofia', temperature: 0.7 },
    agent_id: 'agent-1',
    conversation: { tags: [], inbox_id: 'inbox-1', status_ia: 'ligada' },
    conversation_id: 'conv-1',
    contact: { id: 'contact-1' },
    serviceCategories: [],
    geminiContents: [{ role: 'user', parts: [{ text: 'Vocês entregam em Garanhuns?' }] }],
    incomingText: 'Vocês entregam em Garanhuns?',
    toolCallsLog: [],
    executeToolSafe: vi.fn(async () => 'ok'),
    profileData: null,
    funnelData: null,
    leadProfile: null,
    incomingHasAudio: false,
    queuedMessages: [],
    pendingHandoffTrigger: null,
    pendingHandoffTriggerMsg: '',
    sendTextMsg: vi.fn(async () => undefined),
    sendTts: vi.fn(async () => undefined),
    sendPresence: vi.fn(),
    broadcastEvent: vi.fn(),
    pickHandoffMessage: vi.fn(() => 'Vou te passar pro consultor.'),
    runQueueAssignment: vi.fn(async (msg: string) => ({ result: null, finalMessage: msg })),
    hasInteracted: true,
    hasEverInteracted: true,
    startTime: Date.now(),
    supabase: makeSupabase(),
    log: makeLog(),
    corsHeaders: {},
    ...overrides,
  } as SpecialistCtx
}

const DEF: SpecialistDef = {
  name: 'qualification',
  intent: 'qualificacao',
  model: 'gpt-4.1',
  toolDefs: [],
  buildPrompt: () => 'PROMPT_BASE_DO_SPECIALIST',
}

const KNOWLEDGE_BLOCK =
  '<knowledge_base type="faq">\n<faq><question>Vocês entregam?</question><answer>Sim, em Garanhuns e região.</answer></faq>\n</knowledge_base>'

beforeEach(() => {
  mockState.llmCalls = []
  mockState.dispatchCalls = []
  mockState.llmResult = {
    responseText: 'Sim! Entregamos em Garanhuns e região.',
    inputTokens: 100,
    outputTokens: 40,
    usedModel: 'gpt-4.1',
    errorResponse: null,
    errorMessage: null,
  }
})

describe('runSpecialist — injeção do knowledge (R150)', () => {
  it('knowledgeInstruction presente → bloco entra no system prompt do LLM', async () => {
    const ctx = makeCtx({ knowledgeInstruction: KNOWLEDGE_BLOCK })
    await runSpecialist(ctx, DEF)
    expect(mockState.llmCalls).toHaveLength(1)
    const systemPrompt: string = mockState.llmCalls[0].systemPrompt
    expect(systemPrompt).toContain('<knowledge_base type="faq">')
    expect(systemPrompt).toContain('Sim, em Garanhuns e região.')
    // knowledge é DADO — vem DEPOIS do prompt do specialist (que abre o contexto)
    expect(systemPrompt.indexOf('PROMPT_BASE_DO_SPECIALIST')).toBeLessThan(
      systemPrompt.indexOf('<knowledge_base'),
    )
  })

  it('sem knowledgeInstruction → prompt não ganha bloco vazio nem lixo', async () => {
    const ctx = makeCtx()
    await runSpecialist(ctx, DEF)
    const systemPrompt: string = mockState.llmCalls[0].systemPrompt
    expect(systemPrompt).toContain('PROMPT_BASE_DO_SPECIALIST')
    expect(systemPrompt).not.toContain('<knowledge_base')
    expect(systemPrompt).not.toContain('undefined')
  })

  it('has_knowledge vai pro log de start (observabilidade em prod)', async () => {
    const ctx = makeCtx({ knowledgeInstruction: KNOWLEDGE_BLOCK })
    await runSpecialist(ctx, DEF)
    const startCall = (ctx.log.info as any).mock.calls.find((c: any[]) =>
      String(c[0]).includes('specialist starting'),
    )
    expect(startCall?.[1]?.has_knowledge).toBe(true)
  })
})

describe('runSpecialist — propagação do erro do LLM (R152)', () => {
  it('errorResponse do loop → errorMessage CRU sobe no result', async () => {
    mockState.llmResult = {
      responseText: '',
      inputTokens: 0,
      outputTokens: 0,
      usedModel: 'gpt-4.1',
      errorResponse: new Response(JSON.stringify({ error: 'LLM API error' }), { status: 502 }),
      errorMessage: 'OpenAI 502: upstream connect error',
    }
    const result = await runSpecialist(makeCtx(), DEF)
    expect(result.errorResponse).not.toBeNull()
    expect(result.errorMessage).toBe('OpenAI 502: upstream connect error')
    // erro catastrófico NÃO despacha resposta ao lead
    expect(mockState.dispatchCalls).toHaveLength(0)
  })

  it('errorMessage ausente no loop → fallback genérico preservado', async () => {
    mockState.llmResult = {
      responseText: '',
      inputTokens: 0,
      outputTokens: 0,
      usedModel: 'gpt-4.1',
      errorResponse: new Response(JSON.stringify({ error: 'LLM API error' }), { status: 502 }),
      errorMessage: null,
    }
    const result = await runSpecialist(makeCtx(), DEF)
    expect(result.errorMessage).toBe('LLM loop 3x failure')
  })
})
