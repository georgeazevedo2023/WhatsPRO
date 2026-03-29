/**
 * Tests for Playground v4 — Edge cases, overrides, token/latency tracking
 */

interface ChatMessage { id: string; role: string; content: string; timestamp: Date; tokens?: { input: number; output: number }; latency_ms?: number; tool_calls?: { name: string; args: Record<string, unknown> }[] }
interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }

// ── Replicate override filtering logic ──
function filterToolDefs(allTools: ToolDef[], disabledTools: string[]): ToolDef[] {
  return allTools.filter(t => !disabledTools.includes(t.name));
}

// ── Replicate override resolution logic ──
function resolveOverrides(agentConfig: { model?: string; temperature?: number; max_tokens?: number }, overrides?: { model?: string; temperature?: number; max_tokens?: number }) {
  return {
    model: overrides?.model || agentConfig.model || 'gemini-2.5-flash',
    temperature: overrides?.temperature ?? agentConfig.temperature ?? 0.7,
    maxTokens: overrides?.max_tokens ?? agentConfig.max_tokens ?? 1024,
  };
}

// ── Replicate token/latency tracking ──
function computeTokensAndLatency(messages: ChatMessage[]): { tokens: { input: number; output: number }; latency: number } {
  const tokens = messages.reduce((acc, m) => ({ input: acc.input + (m.tokens?.input || 0), output: acc.output + (m.tokens?.output || 0) }), { input: 0, output: 0 });
  const latency = messages.reduce((sum, m) => sum + (m.latency_ms || 0), 0);
  return { tokens, latency };
}

// ── Replicate input validation ──
function validateInput(body: any): { error?: string; status?: number } {
  if (!body.agent_id) return { error: 'agent_id required', status: 400 };
  return {};
}

function validateMessages(geminiContents: any[]): { error?: string; status?: number } {
  if (geminiContents.length === 0) return { error: 'No messages to process', status: 400 };
  return {};
}

const ALL_TOOL_DEFS: ToolDef[] = [
  { name: 'search_products', description: 'Busca produtos', parameters: {} },
  { name: 'send_carousel', description: 'Carrossel', parameters: {} },
  { name: 'send_media', description: 'Mídia', parameters: {} },
  { name: 'assign_label', description: 'Label', parameters: {} },
  { name: 'set_tags', description: 'Tags', parameters: {} },
  { name: 'move_kanban', description: 'Kanban', parameters: {} },
  { name: 'update_lead_profile', description: 'Lead', parameters: {} },
  { name: 'handoff_to_human', description: 'Handoff', parameters: {} },
];

const mk = (role: string, content: string, extras?: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(), role, content, timestamp: new Date(), ...extras,
});

describe('Playground Edge Cases', () => {
  // ── Input validation ──
  it('1. missing agent_id returns 400', () => {
    const result = validateInput({});
    expect(result.error).toBe('agent_id required');
    expect(result.status).toBe(400);
  });

  it('2. valid agent_id returns no error', () => {
    const result = validateInput({ agent_id: 'abc-123' });
    expect(result.error).toBeUndefined();
  });

  it('3. empty geminiContents returns 400', () => {
    const result = validateMessages([]);
    expect(result.error).toBe('No messages to process');
    expect(result.status).toBe(400);
  });

  it('4. non-empty geminiContents returns no error', () => {
    const result = validateMessages([{ role: 'user', parts: [{ text: 'oi' }] }]);
    expect(result.error).toBeUndefined();
  });

  // ── Overrides ──
  it('5. disabled_tools filters tool definitions', () => {
    const filtered = filterToolDefs(ALL_TOOL_DEFS, ['send_carousel', 'send_media']);
    expect(filtered).toHaveLength(6);
    expect(filtered.find(t => t.name === 'send_carousel')).toBeUndefined();
    expect(filtered.find(t => t.name === 'send_media')).toBeUndefined();
    expect(filtered.find(t => t.name === 'search_products')).toBeDefined();
  });

  it('6. override model takes precedence over agent config', () => {
    const result = resolveOverrides({ model: 'gemini-2.0-flash' }, { model: 'gemini-2.5-pro' });
    expect(result.model).toBe('gemini-2.5-pro');
  });

  it('7. override temperature with ?? fallback', () => {
    // Override 0 should be used (not fallback)
    const result1 = resolveOverrides({ temperature: 0.7 }, { temperature: 0 });
    expect(result1.temperature).toBe(0);
    // Undefined override falls back to agent
    const result2 = resolveOverrides({ temperature: 0.5 }, {});
    expect(result2.temperature).toBe(0.5);
    // Both undefined falls back to 0.7
    const result3 = resolveOverrides({}, {});
    expect(result3.temperature).toBe(0.7);
  });

  it('8. override max_tokens with ?? fallback', () => {
    const result = resolveOverrides({ max_tokens: 2048 }, { max_tokens: 4096 });
    expect(result.maxTokens).toBe(4096);
    const result2 = resolveOverrides({}, {});
    expect(result2.maxTokens).toBe(1024);
  });

  // ── Token & Latency tracking ──
  it('9. tokens summed across multiple turns', () => {
    const msgs: ChatMessage[] = [
      mk('user', 'oi'),
      mk('assistant', 'Olá!', { tokens: { input: 500, output: 200 }, latency_ms: 1200 }),
      mk('user', 'tem tinta?'),
      mk('assistant', 'Sim!', { tokens: { input: 600, output: 300 }, latency_ms: 1500 }),
    ];
    const { tokens, latency } = computeTokensAndLatency(msgs);
    expect(tokens.input).toBe(1100);
    expect(tokens.output).toBe(500);
    expect(latency).toBe(2700);
  });

  it('10. handles messages with no tokens/latency', () => {
    const msgs: ChatMessage[] = [mk('user', 'oi'), mk('assistant', 'Olá!')];
    const { tokens, latency } = computeTokensAndLatency(msgs);
    expect(tokens.input).toBe(0);
    expect(tokens.output).toBe(0);
    expect(latency).toBe(0);
  });
});
