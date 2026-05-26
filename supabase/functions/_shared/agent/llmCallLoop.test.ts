import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock llmProvider — controla `callLLM` por queue de respostas + `appendToolResults`.
// `vi.hoisted` permite usar refs aqui DENTRO do factory de vi.mock (hoisted to top).
const mockState = vi.hoisted(() => ({
  callLLMQueue: [] as any[],
  callLLMCalls: [] as any[],
}))

vi.mock('../llmProvider.ts', () => ({
  callLLM: vi.fn(async (req: any) => {
    mockState.callLLMCalls.push(req)
    if (mockState.callLLMQueue.length === 0) {
      throw new Error('mock callLLM queue empty — test bug')
    }
    const next = mockState.callLLMQueue.shift()
    if (next instanceof Error) throw next
    return next
  }),
  appendToolResults: (msgs: any[], toolCalls: any[], results: any[]) => {
    // Implementação simplificada que captura o efeito: anexa um turn de assistant com tool_calls
    // + turns de tool com os results. Pra teste basta retornar um array novo com sentinel.
    return [
      ...msgs,
      { role: 'assistant' as const, content: '', tool_calls: toolCalls.map((tc) => ({ id: tc.id || `id_${tc.name}`, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) } })) },
      ...results.map((r, i) => ({ role: 'tool' as const, content: r.result, tool_call_id: toolCalls[i]?.id || `id_${r.name}` })),
    ]
  },
}))

import { runLlmCallLoop, type LlmCallLoopCtx } from './llmCallLoop.ts'

// =============================================================================
// Helpers
// =============================================================================

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeLLMResponse(overrides: Partial<{
  text: string
  toolCalls: Array<{ name: string; args: any; id?: string }>
  inputTokens: number
  outputTokens: number
  model: string
  provider: 'openai' | 'gemini'
  latency_ms: number
}> = {}) {
  return {
    text: overrides.text ?? '',
    toolCalls: overrides.toolCalls ?? [],
    inputTokens: overrides.inputTokens ?? 100,
    outputTokens: overrides.outputTokens ?? 50,
    model: overrides.model ?? 'gpt-4.1-mini',
    provider: overrides.provider ?? 'openai',
    latency_ms: overrides.latency_ms ?? 800,
  }
}

function makeSupabaseStub() {
  const inserts: any[] = []
  return {
    inserts,
    supabase: {
      from(_table: string) {
        return {
          insert(payload: any) {
            inserts.push({ table: _table, payload })
            return Promise.resolve({ data: null, error: null })
          },
        }
      },
    },
  }
}

function makeCtx(overrides: Partial<LlmCallLoopCtx> = {}): LlmCallLoopCtx {
  const sup = makeSupabaseStub()
  return {
    agent: { temperature: 0.7, max_tokens: 1024, model: 'gpt-4.1-mini', greeting_message: 'Olá!' },
    llmModel: 'gpt-4.1-mini',
    systemPrompt: 'Você é um agente de vendas.',
    toolDefs: [
      { name: 'search_products', description: 'busca', parameters: { type: 'object', properties: {} } },
      { name: 'handoff_to_human', description: 'transbordo', parameters: { type: 'object', properties: {} } },
      { name: 'send_carousel', description: 'carrossel', parameters: { type: 'object', properties: {} } },
    ],
    geminiContents: [
      { role: 'user', parts: [{ text: 'Olá, queria saber sobre tintas.' }] },
    ],
    toolCallsLog: [],
    executeToolSafe: vi.fn(async (_name: string, _args: any) => 'ok'),
    conversation: { tags: [] },
    hasInteracted: false,
    sendPresence: vi.fn(),
    log: makeLog() as any,
    supabase: sup.supabase,
    agent_id: 'agent-1',
    conversation_id: 'conv-1',
    startTime: Date.now(),
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    ...overrides,
  }
}

beforeEach(() => {
  mockState.callLLMQueue.length = 0
  mockState.callLLMCalls.length = 0
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// Tests
// =============================================================================

describe('runLlmCallLoop — happy paths', () => {
  it('retorna texto puro quando LLM responde sem tool calls', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Temos tinta acrílica fosca a R$ 489,90.' }))
    const ctx = makeCtx()
    const result = await runLlmCallLoop(ctx)
    expect(result.errorResponse).toBeNull()
    expect(result.responseText).toBe('Temos tinta acrílica fosca a R$ 489,90.')
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(50)
    expect(result.usedModel).toBe('gpt-4.1-mini')
    expect(mockState.callLLMCalls).toHaveLength(1)
    expect(ctx.toolCallsLog).toHaveLength(0)
  })

  it('executa 1 tool call sequencial → segunda LLM call retorna texto final', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse({ toolCalls: [{ name: 'search_products', args: { query: 'tinta fosca' }, id: 'tc1' }] }),
      makeLLMResponse({ text: 'Encontrei a Coral 18L por R$ 489,90.' }),
    )
    const ctx = makeCtx()
    const result = await runLlmCallLoop(ctx)
    expect(result.errorResponse).toBeNull()
    expect(result.responseText).toContain('Coral 18L')
    expect(ctx.toolCallsLog).toHaveLength(1)
    expect(ctx.toolCallsLog[0].name).toBe('search_products')
    expect(ctx.executeToolSafe).toHaveBeenCalledWith('search_products', { query: 'tinta fosca' })
  })

  it('executa 2 tools paralelos quando NÃO há side-effects', async () => {
    // 2 tools "read-only" — set_tags + assign_label (não estão em sideEffectTools)
    mockState.callLLMQueue.push(
      makeLLMResponse({
        toolCalls: [
          { name: 'set_tags', args: { tags: ['interesse:tintas'] }, id: 'tc1' },
          { name: 'assign_label', args: { name: 'Lead Quente' }, id: 'tc2' },
        ],
      }),
      makeLLMResponse({ text: 'Anotado.' }),
    )
    const ctx = makeCtx()
    await runLlmCallLoop(ctx)
    expect(ctx.toolCallsLog).toHaveLength(2)
    expect(ctx.toolCallsLog.map((t) => t.name).sort()).toEqual(['assign_label', 'set_tags'])
  })

  it('força sequencial quando há side-effect (send_carousel)', async () => {
    const execOrder: string[] = []
    const execSpy = vi.fn(async (name: string) => {
      execOrder.push(name)
      return 'ok'
    })
    mockState.callLLMQueue.push(
      makeLLMResponse({
        toolCalls: [
          { name: 'search_products', args: {}, id: 'tc1' },
          { name: 'send_carousel', args: { product_ids: ['Coral 18L'] }, id: 'tc2' },
        ],
      }),
      makeLLMResponse({ text: 'Pronto.' }),
    )
    const ctx = makeCtx({ executeToolSafe: execSpy })
    await runLlmCallLoop(ctx)
    expect(execOrder).toEqual(['search_products', 'send_carousel'])
  })
})

describe('runLlmCallLoop — handoff', () => {
  it('handoff_to_human dispara break (não faz segunda LLM call)', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse({ toolCalls: [{ name: 'handoff_to_human', args: { reason: 'lead quer pessoa' }, id: 'tc1' }] }),
    )
    const ctx = makeCtx({
      conversation: { tags: ['interesse:tintas', 'tipo_tinta:acrílica', 'cor:branco'] },
    })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('') // não chega ao 2º LLM call
    expect(ctx.toolCallsLog.some((t) => t.name === 'handoff_to_human')).toBe(true)
    expect(mockState.callLLMCalls).toHaveLength(1)
  })

  it('handoff guard bloqueia handoff_to_human → marca log + quebra loop (comportamento preservado do monolito)', async () => {
    // tags com `produto:X` dispara o guard (sem search_products prévio no log).
    // Comportamento original: guard push entry com result=HANDOFF_GUARD_BLOCKED_MSG;
    // depois o `toolCallsLog.some(name==='handoff_to_human')` casa essa entry e dá break
    // antes do 2º LLM call. Bug latente do monolito — preservado linha-a-linha (caller
    // index.ts depende dessa semântica em hadExplicitHandoffInLoop).
    mockState.callLLMQueue.push(
      makeLLMResponse({ toolCalls: [{ name: 'handoff_to_human', args: { reason: 'lead pediu pessoa' }, id: 'tc1' }] }),
    )
    const ctx = makeCtx({
      conversation: { tags: ['produto:tinta_iquine', 'interesse:tintas'] },
    })
    const result = await runLlmCallLoop(ctx)
    expect(ctx.toolCallsLog).toHaveLength(1)
    expect(ctx.toolCallsLog[0].result).toContain('search_products')
    expect(ctx.toolCallsLog[0].result).toContain('REGRA BUSCA OBRIGATÓRIA')
    expect(result.responseText).toBe('') // loop quebrou, post-LLM cleanup não rodou
    expect(mockState.callLLMCalls).toHaveLength(1)
  })
})

describe('runLlmCallLoop — safety limits', () => {
  it('MAX_TOOL_ROUNDS=3 força chamada final text-only', async () => {
    // 3 rounds de tool calls + 1 final text-only call
    for (let i = 0; i < 3; i++) {
      mockState.callLLMQueue.push(
        makeLLMResponse({ toolCalls: [{ name: 'search_products', args: { q: `r${i}` }, id: `tc_r${i}` }] }),
      )
    }
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Resposta final forçada.' }))

    const ctx = makeCtx()
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Resposta final forçada.')
    // 3 tool rounds + 1 final text-only = 4 calls
    expect(mockState.callLLMCalls).toHaveLength(4)
    // Última chamada deve ter tools=[]
    expect(mockState.callLLMCalls[3].tools).toEqual([])
  })

  it('LLM erro 1× → retry com backoff → sucesso na 2ª', async () => {
    mockState.callLLMQueue.push(new Error('network timeout'))
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Funcionou na 2ª.' }))
    const ctx = makeCtx()
    const result = await runLlmCallLoop(ctx)
    expect(result.errorResponse).toBeNull()
    expect(result.responseText).toBe('Funcionou na 2ª.')
    expect(mockState.callLLMCalls).toHaveLength(2)
  }, 10000)

  it('LLM erro 3× → retorna errorResponse 502', async () => {
    for (let i = 0; i < 3; i++) {
      mockState.callLLMQueue.push(new Error(`fail ${i + 1}`))
    }
    const sup = makeSupabaseStub()
    const ctx = makeCtx({ supabase: sup.supabase })
    const result = await runLlmCallLoop(ctx)
    expect(result.errorResponse).not.toBeNull()
    expect(result.errorResponse?.status).toBe(502)
    // Insere log de erro no DB
    expect(sup.inserts.some((i) => i.payload.event === 'error')).toBe(true)
  }, 15000)
})

describe('runLlmCallLoop — pending questions', () => {
  it('injeta pending questions no último tool result', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse({ toolCalls: [{ name: 'search_products', args: {}, id: 'tc1' }] }),
      makeLLMResponse({ text: 'Anotei tudo.' }),
    )
    const ctx = makeCtx()
    ;(ctx.geminiContents as any).__pendingQuestions = ['Vocês entregam em SP?', 'Aceitam Pix?']
    await runLlmCallLoop(ctx)
    // O segundo LLM call deve ter o pending block injetado nas messages
    const secondCall = mockState.callLLMCalls[1]
    const lastMsg = secondCall.messages[secondCall.messages.length - 1]
    expect(lastMsg.role).toBe('tool')
    expect(lastMsg.content).toContain('PERGUNTAS PENDENTES DO LEAD')
    expect(lastMsg.content).toContain('Vocês entregam em SP?')
    expect(lastMsg.content).toContain('Aceitam Pix?')
    // E o array deve ter sido limpo (não re-injetar)
    expect((ctx.geminiContents as any).__pendingQuestions).toBeUndefined()
  })

  it('faz follow-up call quando há pending questions após resposta texto-puro', async () => {
    mockState.callLLMQueue.push(
      makeLLMResponse({ text: 'Temos sim Coral 18L.' }),
      makeLLMResponse({ text: 'Entregamos sim em SP, e aceitamos Pix.' }),
    )
    const ctx = makeCtx()
    ;(ctx.geminiContents as any).__pendingQuestions = ['Vocês entregam em SP?', 'Aceitam Pix?']
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toContain('Temos sim Coral 18L.')
    expect(result.responseText).toContain('Entregamos sim em SP')
    expect(mockState.callLLMCalls).toHaveLength(2)
    // 2ª call é follow-up com tools=[] e mensagem extra de "O lead também perguntou"
    const followUp = mockState.callLLMCalls[1]
    expect(followUp.tools).toEqual([])
    expect(followUp.messages.some((m: any) => m.content?.includes('O lead também perguntou'))).toBe(true)
  })
})

describe('runLlmCallLoop — post-LLM cleanup', () => {
  it('dedup nome duplicado ("GeorgeGeorge" → "George")', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Oi GeorgeGeorge, em que posso ajudar?' }))
    const ctx = makeCtx({ hasInteracted: false })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Oi George, em que posso ajudar?')
  })

  it('strip greeting Bug 17 v2 quando hasInteracted=true (greeting sem acento)', async () => {
    // Regex usa `\b` ASCII-only — greetings sem acento ("Bom dia", "Oi") são stripadas;
    // "Olá," (acento) tem limitação conhecida documentada no comment Bug 17 v2 do código.
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Bom dia! Tem tinta acrílica branca?' }))
    const ctx = makeCtx({
      hasInteracted: true,
      agent: { temperature: 0.7, max_tokens: 1024, model: 'gpt-4.1-mini', greeting_message: 'Olá! Bem-vindo!' },
    })
    const result = await runLlmCallLoop(ctx)
    // Regex Bug 17 v2 também consome a 1ª palavra capitalizada após greeting (name-like).
    // Aqui "Bom dia! Tem " é totalmente stripado, deixando só "tinta acrílica branca?".
    expect(result.responseText.toLowerCase()).not.toContain('bom dia')
    expect(result.responseText.toLowerCase()).toContain('tinta acrílica branca')
  })

  it('NÃO strip greeting quando hasInteracted=false (1ª msg)', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Olá, Pedro! Bem-vindo à Eletropiso.' }))
    const ctx = makeCtx({ hasInteracted: false })
    const result = await runLlmCallLoop(ctx)
    // Preservado intacto na 1ª interação
    expect(result.responseText).toBe('Olá, Pedro! Bem-vindo à Eletropiso.')
  })

  it('Bug 3 Fix v7.43.1: strip esvaziando texto → preserva raw original (não fallback genérico)', async () => {
    // Antes da v7.43.1, strip de "Olá!" resultava em "" → fallback "Em que posso te ajudar?".
    // Caso real Eletropiso V1 2026-05-23 14:44: destruía respostas úteis com greeting.
    // Agora: se strip esvazia mas raw tinha conteúdo, preserva o raw.
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Olá!' }))
    const ctx = makeCtx({ hasInteracted: true })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Olá!') // preserva raw em vez de fallback genérico
  })

  it('Fallback "Em que posso te ajudar?" só quando raw TAMBÉM vazio (LLM cuspiu nada)', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: '   ' })) // só whitespace
    const ctx = makeCtx({ hasInteracted: true })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Em que posso te ajudar?')
  })
})

describe('runLlmCallLoop — token ceiling', () => {
  it('trima llmMessages quando totalInputTokens > 8192 e toolRounds >= 1', async () => {
    // 1ª call: 9000 tokens, tool call → trim disparado no início da 2ª iteração
    mockState.callLLMQueue.push(
      makeLLMResponse({
        toolCalls: [{ name: 'search_products', args: {}, id: 'tc1' }],
        inputTokens: 9000,
      }),
      makeLLMResponse({ text: 'Pronto.' }),
    )
    const ctx = makeCtx({
      // 10 turns simulados → após append vira muito longo
      geminiContents: Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'model',
        parts: [{ text: `mensagem ${i}` }],
      })),
    })
    await runLlmCallLoop(ctx)
    // Não falhou; loop continuou normalmente. Validação principal é que log.warn foi chamado.
    expect((ctx.log.warn as any).mock.calls.some((c: any[]) => c[0]?.includes('Token ceiling reached'))).toBe(true)
  })
})

describe('runLlmCallLoop — restauração de 1º nome truncado (2026-05-26)', () => {
  it('restaura "Jo" → "João" na vocativa quando leadFirstName="João"', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Prazer, Jo! Te mostro as tintas 👇' }))
    const ctx = makeCtx({ leadFirstName: 'João' })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Prazer, João! Te mostro as tintas 👇')
  })

  it('NÃO toca quando o nome completo já está presente', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'João, e o Jo aqui do lado?' }))
    const ctx = makeCtx({ leadFirstName: 'João' })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('João, e o Jo aqui do lado?')
  })

  it('NÃO mexe em "Jo" dentro de outra palavra (Jorge)', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'O Jorge vai te atender.' }))
    const ctx = makeCtx({ leadFirstName: 'João' })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('O Jorge vai te atender.')
  })

  it('restaura prefixo mais longo primeiro ("Mari" → "Maria")', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Oi Mari, tudo bem?' }))
    const ctx = makeCtx({ leadFirstName: 'Maria' })
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Oi Maria, tudo bem?')
  })

  it('no-op quando não há leadFirstName', async () => {
    mockState.callLLMQueue.push(makeLLMResponse({ text: 'Prazer, Jo!' }))
    const ctx = makeCtx()
    const result = await runLlmCallLoop(ctx)
    expect(result.responseText).toBe('Prazer, Jo!')
  })
})
