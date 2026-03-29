/**
 * Tests for scenario results — imports REAL computeScenarioResults from shared module.
 */
import { computeScenarioResults, type ScenarioExpected } from '../../../../supabase/functions/_shared/agentHelpers.ts'

interface ChatMessage { id: string; role: string; content: string; timestamp: Date; tool_calls?: { name: string; args: Record<string, unknown> }[]; tokens?: { input: number; output: number }; latency_ms?: number; }

function computeResults(scenario: { expected: ScenarioExpected }, msgs: ChatMessage[]) {
  return computeScenarioResults(scenario.expected, msgs)
}

const mkMsg = (role: 'user' | 'assistant' | 'system', content: string, extras?: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(), role, content, timestamp: new Date(), ...extras,
});

// ─── Test 1: computeResults PASS when all expected tools used ─────────
describe('computeResults', () => {
  it('returns pass=true when all expected tools are used', () => {
    const scenario: TestScenario = {
      id: 'test', name: 'Test', category: 'vendas', description: '', difficulty: 'easy',
      steps: [{ content: 'oi' }],
      expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mkMsg('user', 'oi'),
      mkMsg('system', '', { tool_calls: [{ name: 'search_products', args: {} }, { name: 'set_tags', args: {} }] }),
      mkMsg('assistant', 'Encontrei produtos!'),
    ];
    const result = computeResults(scenario, msgs);
    expect(result.pass).toBe(true);
    expect(result.tools_missing).toEqual([]);
    expect(result.tools_unexpected).toEqual([]);
  });

  // ─── Test 2: computeResults FAIL when expected tool missing ──────────
  it('returns pass=false when expected tool is missing', () => {
    const scenario: TestScenario = {
      id: 'test', name: 'Test', category: 'vendas', description: '', difficulty: 'easy',
      steps: [{ content: 'oi' }],
      expected: { tools_must_use: ['search_products', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mkMsg('user', 'oi'),
      mkMsg('system', '', { tool_calls: [{ name: 'search_products', args: {} }] }),
      mkMsg('assistant', 'Encontrei produtos!'),
    ];
    const result = computeResults(scenario, msgs);
    expect(result.pass).toBe(false);
    expect(result.tools_missing).toContain('handoff_to_human');
    expect(result.handoff_occurred).toBe(false);
  });

  // ─── Test 3: computeResults detects unexpected tools ──────────────
  it('returns pass=false when unexpected tool is used', () => {
    const scenario: TestScenario = {
      id: 'test', name: 'Test', category: 'suporte', description: '', difficulty: 'easy',
      steps: [{ content: 'horario?' }],
      expected: { tools_must_use: ['set_tags'], tools_must_not_use: ['search_products'], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mkMsg('user', 'horario?'),
      mkMsg('system', '', { tool_calls: [{ name: 'set_tags', args: {} }, { name: 'search_products', args: {} }] }),
      mkMsg('assistant', 'Abrimos as 8h'),
    ];
    const result = computeResults(scenario, msgs);
    expect(result.pass).toBe(false);
    expect(result.tools_unexpected).toContain('search_products');
  });

  // ─── Test 4: computeResults detects guardrail block ──────────────
  it('returns pass=true when guardrail blocks correctly', () => {
    const scenario: TestScenario = {
      id: 'vaga', name: 'Vaga', category: 'vaga_emprego', description: '', difficulty: 'easy',
      steps: [{ content: 'tem vaga?' }],
      expected: { tools_must_use: [], tools_must_not_use: ['search_products'], should_handoff: false, should_block: true },
    };
    const msgs: ChatMessage[] = [
      mkMsg('user', 'tem vaga?'),
      mkMsg('assistant', 'Desculpe, nao posso ajudar com vagas de emprego.'),
    ];
    const result = computeResults(scenario, msgs);
    expect(result.pass).toBe(true);
    expect(result.blocked_occurred).toBe(true);
  });

  // ─── Test 5: computeResults only counts system msg tool_calls ────
  it('does not double-count tools from assistant messages', () => {
    const scenario: TestScenario = {
      id: 'test', name: 'Test', category: 'vendas', description: '', difficulty: 'easy',
      steps: [{ content: 'oi' }],
      expected: { tools_must_use: ['search_products'], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    // Tool appears in both system and assistant msgs (real behavior)
    const toolCalls = [{ name: 'search_products', args: { query: 'tinta' } }];
    const msgs: ChatMessage[] = [
      mkMsg('user', 'oi'),
      mkMsg('system', '', { tool_calls: toolCalls }),
      mkMsg('assistant', 'Encontrei tintas!', { tool_calls: toolCalls }),
    ];
    const result = computeResults(scenario, msgs);
    expect(result.tools_used).toEqual(['search_products']); // not duplicated
    expect(result.pass).toBe(true);
  });
});
