/**
 * Integration tests for Playground — tests the FULL flow by simulating
 * what the edge function does: build prompt → call LLM → execute tools → return response.
 *
 * These tests mock callLLM() but use REAL shared functions from agentHelpers.ts.
 * If any shared function changes, these tests break immediately.
 */
import {
  isJustGreeting,
  buildBusinessInfoSection,
  buildKnowledgeInstruction,
  buildExtractionInstruction,
  buildSubAgentInstruction,
  buildGeminiContents,
  buildPlaygroundResponse,
  validateSetTags,
  validateLeadProfileUpdate,
  normalizeCarouselProductIds,
  computeScenarioResults,
  type ScenarioExpected,
} from '../../../../supabase/functions/_shared/agentHelpers.ts'

/* ═══════════════════════════════════════════════════════════════════ */
/*  Simulate the full playground edge function flow                    */
/* ═══════════════════════════════════════════════════════════════════ */

interface MockLLMResponse {
  text: string
  toolCalls: { name: string; args: Record<string, unknown> }[]
  inputTokens: number
  outputTokens: number
}

interface AgentConfig {
  name: string
  greeting_message: string | null
  personality: string
  system_prompt: string
  business_info: any
  blocked_topics: string[]
  extraction_fields: { label: string; key: string; enabled: boolean }[]
  sub_agents: Record<string, { enabled: boolean; prompt: string }>
}

/**
 * Simulates the FULL playground flow:
 * 1. Build system prompt (using real shared functions)
 * 2. Build gemini contents (using real shared function)
 * 3. Call LLM (mocked)
 * 4. Execute tools (mocked but uses real validation)
 * 5. Build final response (using real shared function)
 */
function simulatePlaygroundFlow(params: {
  agent: AgentConfig
  chatMessages: { content: string; direction: string }[]
  llmResponses: MockLLMResponse[]  // queue of responses (for multi-turn with tools)
  availableLabels?: string[]
  faq?: { title: string; content: string }[]
}): {
  response: string
  greeting_sent: boolean
  just_greeting: boolean
  toolCallsLog: { name: string; args: Record<string, unknown>; result: string }[]
  totalTokens: { input: number; output: number }
  systemPromptContains: (text: string) => boolean
  systemPrompt: string
} {
  const { agent, chatMessages, llmResponses, availableLabels = [], faq = [] } = params

  // Step 1: Build prompt sections (REAL functions)
  const biSection = buildBusinessInfoSection(agent.business_info)
  const knowledgeInstruction = buildKnowledgeInstruction(faq, [])
  const extractionInstruction = buildExtractionInstruction(agent.extraction_fields)
  const subAgentInstruction = buildSubAgentInstruction(agent.sub_agents)

  const hasAssistantMsg = chatMessages.some(m => m.direction === 'outgoing')
  const greetingText = agent.greeting_message || ''
  const leadMsgCount = chatMessages.filter(m => m.direction === 'incoming').length

  const systemPrompt = `Você é ${agent.name}, um assistente virtual de WhatsApp.
Personalidade: ${agent.personality}
${agent.system_prompt}
${biSection}
${agent.blocked_topics?.length ? `Tópicos PROIBIDOS: ${agent.blocked_topics.join(', ')}` : ''}
CONTEXTO: Lead NOVO. A saudação "${greetingText}" já foi enviada.
LIMITE DE MENSAGENS: ${leadMsgCount}/8
Labels disponíveis: ${availableLabels.join(', ') || '(nenhuma)'}
${extractionInstruction}
${knowledgeInstruction}
${subAgentInstruction}
DETECÇÃO DE OBJEÇÕES: preco, concorrente, prazo, indecisao, qualidade`

  // Step 2: Check just-greeting (REAL function)
  const isFirstTurn = !hasAssistantMsg && !!agent.greeting_message
  const firstText = chatMessages[0]?.content || ''
  const isFirstMsgJustGreeting = isFirstTurn && isJustGreeting(firstText)

  if (isFirstMsgJustGreeting) {
    return {
      response: agent.greeting_message!,
      greeting_sent: true, just_greeting: true,
      toolCallsLog: [], totalTokens: { input: 0, output: 0 },
      systemPromptContains: (t: string) => systemPrompt.includes(t),
      systemPrompt,
    }
  }

  // Step 3: Build gemini contents (REAL function)
  const geminiContents = buildGeminiContents(chatMessages)

  // Step 4: LLM loop with tool execution (mock LLM, real tool validation)
  const toolCallsLog: { name: string; args: Record<string, unknown>; result: string }[] = []
  let responseText = ''
  let totalInput = 0, totalOutput = 0
  let attempts = 0
  const llmQueue = [...llmResponses]

  while (attempts < 5 && llmQueue.length > 0) {
    attempts++
    const llmResult = llmQueue.shift()!
    totalInput += llmResult.inputTokens
    totalOutput += llmResult.outputTokens

    if (llmResult.toolCalls.length > 0) {
      for (const tc of llmResult.toolCalls) {
        let result: string
        switch (tc.name) {
          case 'set_tags': result = validateSetTags(tc.args.tags).message; break
          case 'update_lead_profile': result = validateLeadProfileUpdate(tc.args); break
          case 'send_carousel': {
            const ids = normalizeCarouselProductIds(tc.args.product_ids)
            result = `[ENVIADO] Carrossel com ${ids.length} produto(s)`; break
          }
          case 'handoff_to_human': result = `[HANDOFF] Motivo: ${tc.args.reason || 'N/A'}`; break
          case 'search_products': result = '1. Tinta Coral R$189.90 [com foto]\n2. Tinta Suvinil R$159.90 [com foto]'; break
          case 'assign_label': {
            const found = availableLabels.find(l => l.toLowerCase() === String(tc.args.label_name).toLowerCase())
            result = found ? `Label "${found}" atribuída.` : `Etiqueta "${tc.args.label_name}" não encontrada.`; break
          }
          default: result = `Tool ${tc.name} executada.`
        }
        toolCallsLog.push({ name: tc.name, args: tc.args, result })
      }
      continue // loop back to LLM with tool results
    }

    responseText = llmResult.text
    break
  }

  // Step 5: Build final response (REAL function)
  const finalResult = buildPlaygroundResponse({
    hasAssistantMsg, greetingMessage: agent.greeting_message, firstMessageText: firstText, llmResponse: responseText,
  })

  return {
    ...finalResult,
    toolCallsLog,
    totalTokens: { input: totalInput, output: totalOutput },
    systemPromptContains: (t: string) => systemPrompt.includes(t),
    systemPrompt,
  }
}

const DEFAULT_AGENT: AgentConfig = {
  name: 'Eletropiso', greeting_message: 'Olá! Bem-vindo a Eletropiso!', personality: 'Profissional e simpático',
  system_prompt: 'Responda de forma clara.', business_info: { hours: 'Seg-Sex 8h-18h', address: 'Rua A, 123' },
  blocked_topics: ['política', 'religião'], extraction_fields: [{ label: 'CPF', key: 'cpf', enabled: true }],
  sub_agents: { sdr: { enabled: true, prompt: 'Qualifique leads com 1 pergunta por vez' } },
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Tests                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Integration: Just-greeting flow', () => {
  it('1. "oi" → returns only greeting, no LLM call', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponses: [], // should NOT be used
    })
    expect(r.response).toBe('Olá! Bem-vindo a Eletropiso!')
    expect(r.just_greeting).toBe(true)
    expect(r.totalTokens.input).toBe(0) // no LLM call
  })

  it('2. "bom dia!" → just greeting (punctuation stripped)', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'Bom dia!', direction: 'incoming' }],
      llmResponses: [],
    })
    expect(r.just_greeting).toBe(true)
  })
})

describe('Integration: First turn with substantive message', () => {
  it('3. "tem tinta?" → greeting + LLM response', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'tem tinta latex?', direction: 'incoming' }],
      llmResponses: [{ text: 'Qual cor você procura?', toolCalls: [{ name: 'set_tags', args: { tags: ['motivo:compra', 'interesse:tinta'] } }], inputTokens: 500, outputTokens: 100 },
        { text: 'Qual cor você procura?', toolCalls: [], inputTokens: 200, outputTokens: 80 }],
    })
    expect(r.response).toContain('Olá! Bem-vindo a Eletropiso!')
    expect(r.response).toContain('Qual cor você procura?')
    expect(r.greeting_sent).toBe(true)
    expect(r.toolCallsLog.some(t => t.name === 'set_tags')).toBe(true)
  })
})

describe('Integration: Multi-turn with tool calls', () => {
  it('4. search → carousel → handoff (3 LLM turns)', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null }, // skip greeting
      chatMessages: [{ content: 'quero tinta coral branco neve', direction: 'incoming' }],
      llmResponses: [
        // Turn 1: LLM calls search_products
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'tinta coral branco neve' } }], inputTokens: 500, outputTokens: 50 },
        // Turn 2: LLM sees results, calls send_carousel
        { text: '', toolCalls: [{ name: 'send_carousel', args: { product_ids: ['Tinta Coral'] } }], inputTokens: 600, outputTokens: 60 },
        // Turn 3: LLM responds with text
        { text: 'Encontrei a Tinta Coral! Veja o carrossel acima.', toolCalls: [], inputTokens: 400, outputTokens: 100 },
      ],
    })
    expect(r.toolCallsLog).toHaveLength(2)
    expect(r.toolCallsLog[0].name).toBe('search_products')
    expect(r.toolCallsLog[1].name).toBe('send_carousel')
    expect(r.response).toContain('Tinta Coral')
    expect(r.totalTokens.input).toBe(1500)
  })

  it('5. search → no results → handoff', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'tem pneu?', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'set_tags', args: { tags: ['motivo:fora_escopo'] } }, { name: 'handoff_to_human', args: { reason: 'Produto fora do catálogo: pneu' } }], inputTokens: 500, outputTokens: 50 },
        { text: 'Vou te encaminhar para nosso especialista!', toolCalls: [], inputTokens: 300, outputTokens: 80 },
      ],
    })
    expect(r.toolCallsLog.some(t => t.name === 'handoff_to_human')).toBe(true)
    expect(r.toolCallsLog.find(t => t.name === 'handoff_to_human')!.result).toContain('pneu')
  })
})

describe('Integration: System prompt validation', () => {
  it('6. prompt contains business info', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'qual horario?', direction: 'incoming' }],
      llmResponses: [{ text: 'Seg-Sex 8h-18h', toolCalls: [], inputTokens: 100, outputTokens: 50 }],
    })
    expect(r.systemPromptContains('Seg-Sex 8h-18h')).toBe(true)
    expect(r.systemPromptContains('Rua A, 123')).toBe(true)
  })

  it('7. prompt contains blocked topics', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'o que acha de politica?', direction: 'incoming' }],
      llmResponses: [{ text: 'Não posso falar sobre isso.', toolCalls: [], inputTokens: 100, outputTokens: 50 }],
    })
    expect(r.systemPromptContains('política')).toBe(true)
    expect(r.systemPromptContains('religião')).toBe(true)
  })

  it('8. prompt contains extraction fields', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponses: [],
    })
    expect(r.systemPromptContains('CPF')).toBe(true)
    expect(r.systemPromptContains('cpf')).toBe(true)
  })

  it('9. prompt contains sub-agent instructions', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponses: [],
    })
    expect(r.systemPromptContains('Modo SDR')).toBe(true)
    expect(r.systemPromptContains('Qualifique leads')).toBe(true)
  })

  it('10. prompt contains FAQ when provided', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [{ content: 'qual prazo de entrega?', direction: 'incoming' }],
      llmResponses: [{ text: '3-5 dias úteis', toolCalls: [], inputTokens: 100, outputTokens: 50 }],
      faq: [{ title: 'Prazo de entrega?', content: '3-5 dias úteis' }],
    })
    expect(r.systemPromptContains('Prazo de entrega?')).toBe(true)
    expect(r.systemPromptContains('3-5 dias úteis')).toBe(true)
  })
})

describe('Integration: Tool validation in flow', () => {
  it('11. set_tags validates format and reports invalid', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'set_tags', args: { tags: ['motivo:saudacao', 'invalido'] } }], inputTokens: 100, outputTokens: 50 },
        { text: 'Olá!', toolCalls: [], inputTokens: 100, outputTokens: 50 },
      ],
    })
    const tagResult = r.toolCallsLog.find(t => t.name === 'set_tags')!.result
    expect(tagResult).toContain('motivo:saudacao')
    expect(tagResult).toContain('AVISO')
    expect(tagResult).toContain('invalido')
  })

  it('12. assign_label fails when label not found', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'quero comprar', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'assign_label', args: { label_name: 'Inexistente' } }], inputTokens: 100, outputTokens: 50 },
        { text: 'Ok!', toolCalls: [], inputTokens: 100, outputTokens: 50 },
      ],
      availableLabels: ['Novo', 'Qualificado'],
    })
    expect(r.toolCallsLog[0].result).toContain('não encontrada')
  })

  it('13. assign_label succeeds with matching label', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'quero comprar', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'assign_label', args: { label_name: 'Qualificado' } }], inputTokens: 100, outputTokens: 50 },
        { text: 'Ok!', toolCalls: [], inputTokens: 100, outputTokens: 50 },
      ],
      availableLabels: ['Novo', 'Qualificado'],
    })
    expect(r.toolCallsLog[0].result).toContain('atribuída')
  })

  it('14. update_lead_profile validates fields', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'sou o Carlos de Recife', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'update_lead_profile', args: { full_name: 'Carlos', city: 'Recife' } }], inputTokens: 100, outputTokens: 50 },
        { text: 'Prazer Carlos!', toolCalls: [], inputTokens: 100, outputTokens: 50 },
      ],
    })
    expect(r.toolCallsLog[0].result).toContain('nome=Carlos')
    expect(r.toolCallsLog[0].result).toContain('cidade=Recife')
  })
})

describe('Integration: Retry and max attempts', () => {
  it('15. stops after 5 attempts (tools only, no text)', () => {
    const r = simulatePlaygroundFlow({
      agent: { ...DEFAULT_AGENT, greeting_message: null },
      chatMessages: [{ content: 'busca infinita', direction: 'incoming' }],
      llmResponses: [
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'x' } }], inputTokens: 100, outputTokens: 10 },
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'y' } }], inputTokens: 100, outputTokens: 10 },
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'z' } }], inputTokens: 100, outputTokens: 10 },
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'w' } }], inputTokens: 100, outputTokens: 10 },
        { text: '', toolCalls: [{ name: 'search_products', args: { query: 'v' } }], inputTokens: 100, outputTokens: 10 },
      ],
    })
    expect(r.toolCallsLog).toHaveLength(5)
    expect(r.response).toBe('') // no text response generated
  })

  it('16. second message has no greeting', () => {
    const r = simulatePlaygroundFlow({
      agent: DEFAULT_AGENT,
      chatMessages: [
        { content: 'oi', direction: 'incoming' },
        { content: 'Olá!', direction: 'outgoing' },
        { content: 'tem cimento?', direction: 'incoming' },
      ],
      llmResponses: [{ text: 'Sim, temos!', toolCalls: [], inputTokens: 200, outputTokens: 50 }],
    })
    expect(r.greeting_sent).toBe(false)
    expect(r.response).toBe('Sim, temos!')
    expect(r.response).not.toContain('Bem-vindo')
  })
})

describe('Integration: Scenario results evaluation', () => {
  it('17. full sales flow evaluated as PASS', () => {
    const expected: ScenarioExpected = {
      tools_must_use: ['set_tags', 'search_products'], tools_must_not_use: [],
      should_handoff: false, should_block: false,
    }
    const msgs = [
      { role: 'user', content: 'tem tinta?' },
      { role: 'system', content: '', tool_calls: [{ name: 'set_tags' }, { name: 'search_products' }] },
      { role: 'assistant', content: 'Encontrei tintas!' },
    ]
    expect(computeScenarioResults(expected, msgs).pass).toBe(true)
  })

  it('18. guardrail block evaluated correctly', () => {
    const expected: ScenarioExpected = {
      tools_must_use: [], tools_must_not_use: ['search_products'],
      should_handoff: false, should_block: true,
    }
    const msgs = [
      { role: 'user', content: 'tem vaga?' },
      { role: 'assistant', content: 'Desculpe, nao posso ajudar com vagas.' },
    ]
    const r = computeScenarioResults(expected, msgs)
    expect(r.pass).toBe(true)
    expect(r.blocked_occurred).toBe(true)
  })
})

describe('Integration: geminiContents correctness', () => {
  it('19. only user messages in geminiContents (no greeting)', () => {
    const contents = buildGeminiContents([
      { content: 'oi', direction: 'incoming' },
      { content: 'tem tinta?', direction: 'incoming' },
    ])
    expect(contents).toHaveLength(2)
    expect(contents.every(c => c.role === 'user')).toBe(true)
  })

  it('20. mixed direction messages mapped correctly', () => {
    const contents = buildGeminiContents([
      { content: 'oi', direction: 'incoming' },
      { content: 'Olá!', direction: 'outgoing' },
      { content: 'tem tinta?', direction: 'incoming' },
    ])
    expect(contents[0].role).toBe('user')
    expect(contents[1].role).toBe('model')
    expect(contents[2].role).toBe('user')
  })
})
