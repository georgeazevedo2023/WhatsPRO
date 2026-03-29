import {
  buildLegacyQueueUpdate,
  createQueuedMessage,
  extractInterestFromTags,
  formatFollowUpMessage,
  resolveNextFollowUpStep,
  shouldTriggerAiAgentFromWebhook,
  type QueuedMessage,
} from './aiRuntime.ts'

describe('aiRuntime helpers', () => {
  it('builds a queued message with safe fallbacks', () => {
    expect(createQueuedMessage({ text: 'Oi' }, '2026-03-25T12:00:00.000Z')).toEqual({
      content: 'Oi',
      media_type: 'text',
      media_url: null,
      direction: 'incoming',
      timestamp: '2026-03-25T12:00:00.000Z',
    })
  })

  it('preserves legacy queued messages when the row is still active', () => {
    const previousMessage: QueuedMessage = {
      content: 'primeira',
      media_type: 'text',
      media_url: null,
      direction: 'incoming',
      timestamp: '2026-03-25T12:00:00.000Z',
    }
    const nextMessage: QueuedMessage = {
      content: 'segunda',
      media_type: 'text',
      media_url: null,
      direction: 'incoming',
      timestamp: '2026-03-25T12:00:05.000Z',
    }

    expect(buildLegacyQueueUpdate({
      messages: [previousMessage],
      processed: false,
      first_message_at: previousMessage.timestamp,
    }, nextMessage)).toEqual({
      messages: [previousMessage, nextMessage],
      firstMessageAt: previousMessage.timestamp,
    })
  })

  it('resets legacy queued messages after the row was already processed', () => {
    const nextMessage: QueuedMessage = {
      content: 'nova janela',
      media_type: 'text',
      media_url: null,
      direction: 'incoming',
      timestamp: '2026-03-25T12:01:00.000Z',
    }

    expect(buildLegacyQueueUpdate({
      messages: [{ ...nextMessage, content: 'antiga' }],
      processed: true,
      first_message_at: '2026-03-25T12:00:00.000Z',
    }, nextMessage)).toEqual({
      messages: [nextMessage],
      firstMessageAt: nextMessage.timestamp,
    })
  })

  it('chooses the first eligible follow-up step', () => {
    expect(resolveNextFollowUpStep({
      rules: [
        { days: 3, message: 'step 1' },
        { days: 7, message: 'step 2' },
      ],
      daysSince: 4,
      lastStep: 0,
      lastStatus: null,
    })).toEqual({
      nextStepIndex: 0,
      rule: { days: 3, message: 'step 1' },
    })
  })

  it('advances to the next follow-up step after a previous send', () => {
    expect(resolveNextFollowUpStep({
      rules: [
        { days: 3, message: 'step 1' },
        { days: 7, message: 'step 2' },
      ],
      daysSince: 8,
      lastStep: 1,
      lastStatus: 'sent',
    })).toEqual({
      nextStepIndex: 1,
      rule: { days: 7, message: 'step 2' },
    })
  })

  it('skips follow-up when the lead already replied or all steps are exhausted', () => {
    expect(resolveNextFollowUpStep({
      rules: [{ days: 3, message: 'step 1' }],
      daysSince: 10,
      lastStep: 0,
      lastStatus: 'replied',
    })).toBeNull()

    expect(resolveNextFollowUpStep({
      rules: [{ days: 3, message: 'step 1' }],
      daysSince: 10,
      lastStep: 1,
      lastStatus: 'sent',
    })).toBeNull()
  })

  it('formats follow-up messages with normalized tags and variables', () => {
    const produto = extractInterestFromTags(['origem:ads', 'interesse:verniz_sparlack'])

    expect(formatFollowUpMessage({
      template: 'Oi {nome}, ainda tenho {produto} na {loja} apos {dias_sem_contato} dias.',
      nome: 'Maria',
      produto,
      daysSince: 5,
      loja: 'Eletropiso',
    })).toBe('Oi Maria, ainda tenho verniz sparlack na Eletropiso apos 5 dias.')
  })

  it('blocks webhook AI trigger when the conversation was manually disabled', () => {
    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'incoming',
      fromMe: false,
      mediaType: 'text',
      statusIa: 'desligada',
    })).toBe(false)
  })

  it('allows webhook AI trigger for valid inbound text states', () => {
    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'incoming',
      fromMe: false,
      mediaType: 'text',
      statusIa: 'ligada',
    })).toBe(true)

    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'incoming',
      fromMe: false,
      mediaType: 'text',
      statusIa: 'shadow',
    })).toBe(true)
  })

  it('blocks webhook AI trigger for outbound, self, or audio events', () => {
    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'outgoing',
      fromMe: false,
      mediaType: 'text',
      statusIa: 'ligada',
    })).toBe(false)

    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'incoming',
      fromMe: true,
      mediaType: 'text',
      statusIa: 'ligada',
    })).toBe(false)

    expect(shouldTriggerAiAgentFromWebhook({
      direction: 'incoming',
      fromMe: false,
      mediaType: 'audio',
      statusIa: 'ligada',
    })).toBe(false)
  })
})

describe('executeToolSafe pattern', () => {
  // Replicate the wrapper pattern to verify its error isolation behavior
  async function executeToolSafe(
    executeFn: (name: string, args: Record<string, any>) => Promise<string>,
    name: string,
    args: Record<string, any>,
  ): Promise<string> {
    try {
      return await executeFn(name, args)
    } catch (err) {
      return `Erro interno ao executar ${name}. Responda ao lead sem usar este resultado.`
    }
  }

  it('returns tool result on success', async () => {
    const mockTool = async () => 'Produto encontrado: Tinta Coral 18L'
    const result = await executeToolSafe(mockTool, 'search_products', { query: 'tinta' })
    expect(result).toBe('Produto encontrado: Tinta Coral 18L')
  })

  it('returns error string on tool exception (does NOT throw)', async () => {
    const failingTool = async () => { throw new Error('DB connection lost') }
    const result = await executeToolSafe(failingTool, 'set_tags', { tags: ['interesse:tinta'] })
    expect(result).toContain('Erro interno ao executar set_tags')
    // The key assertion: this did NOT throw — it returned a string
    expect(typeof result).toBe('string')
  })

  it('error string is meaningful to LLM (contains tool name)', async () => {
    const failingTool = async () => { throw new Error('timeout') }
    const result = await executeToolSafe(failingTool, 'update_lead_profile', {})
    expect(result).toContain('update_lead_profile')
    expect(result).toContain('Erro interno')
  })
})
