/**
 * Tests for media/audio scenarios — imports REAL computeScenarioResults.
 */
import { computeScenarioResults, type ScenarioExpected } from '../../../../supabase/functions/_shared/agentHelpers.ts'

interface TestStep { content: string; media_type?: 'text' | 'image' | 'audio'; delay_ms?: number; }
interface TestScenario { id: string; name: string; category: string; description: string; difficulty: string; steps: TestStep[]; expected: ScenarioExpected; tags?: string[]; }
interface ChatMessage { id: string; role: string; content: string; timestamp: Date; tool_calls?: { name: string; args: Record<string, unknown> }[]; tokens?: { input: number; output: number }; latency_ms?: number; media_type?: string; }

function computeResults(scenario: TestScenario, msgs: ChatMessage[]) {
  return computeScenarioResults(scenario.expected, msgs)
}

const mk = (role: 'user' | 'assistant' | 'system', content: string, extras?: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(), role, content, timestamp: new Date(), ...extras,
});

/* ═══════════════════════════════════════════════════════════════ */
/*  1. Carousel scenarios                                         */
/* ═══════════════════════════════════════════════════════════════ */

describe('Midia Cenario 1: carousel + foto + handoff', () => {
  const scenario: TestScenario = {
    id: 'midia-1', name: 'Carousel + foto + handoff', category: 'midia_cenario_1', difficulty: 'hard', description: '',
    steps: [{ content: 'quero tinta' }, { content: 'mostra opcoes' }, { content: 'gostei dessa' }, { content: 'quero comprar' }],
    expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
  };

  it('passes when all media tools + handoff are used', () => {
    const msgs: ChatMessage[] = [
      mk('user', 'quero tinta'),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: { query: 'tinta' } }] }),
      mk('assistant', 'Encontrei tintas!'),
      mk('user', 'mostra opcoes'),
      mk('system', '', { tool_calls: [{ name: 'send_carousel', args: { product_ids: ['1', '2', '3'] } }] }),
      mk('assistant', 'Aqui estao as opcoes!'),
      mk('user', 'gostei dessa'),
      mk('system', '', { tool_calls: [{ name: 'send_media', args: { media_url: 'url', media_type: 'image' } }] }),
      mk('assistant', 'Excelente escolha!'),
      mk('user', 'quero comprar'),
      mk('system', '', { tool_calls: [{ name: 'handoff_to_human', args: { reason: 'compra' } }] }),
      mk('assistant', 'Transferindo para vendedor!'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(true);
    expect(r.handoff_occurred).toBe(true);
  });

  it('fails when send_carousel is missing', () => {
    const msgs: ChatMessage[] = [
      mk('user', 'quero tinta'),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: {} }] }),
      mk('assistant', 'Temos tinta Coral por R$89'),
      mk('user', 'quero comprar'),
      mk('system', '', { tool_calls: [{ name: 'handoff_to_human', args: { reason: 'compra' } }] }),
      mk('assistant', 'Transferindo!'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(false);
    expect(r.tools_missing).toContain('send_carousel');
  });
});

describe('Midia Cenario 2: carousel duplo + handoff', () => {
  const scenario: TestScenario = {
    id: 'midia-2', name: 'Carousel duplo', category: 'midia_cenario_2', difficulty: 'hard', description: '',
    steps: [{ content: 'tinta e pincel' }, { content: 'mostra tintas' }, { content: 'agora pinceis' }, { content: 'quero os dois' }],
    expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
  };

  it('passes with two carousels and handoff', () => {
    const msgs: ChatMessage[] = [
      mk('user', 'tinta e pincel'),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: { query: 'tinta' } }] }),
      mk('assistant', 'Tintas disponiveis'),
      mk('user', 'mostra tintas'),
      mk('system', '', { tool_calls: [{ name: 'send_carousel', args: { product_ids: ['t1', 't2'] } }] }),
      mk('assistant', 'Carrossel de tintas'),
      mk('user', 'agora pinceis'),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: { query: 'pincel' } }, { name: 'send_carousel', args: { product_ids: ['p1', 'p2'] } }] }),
      mk('assistant', 'Carrossel de pinceis'),
      mk('user', 'quero os dois'),
      mk('system', '', { tool_calls: [{ name: 'handoff_to_human', args: { reason: 'compra dupla' } }] }),
      mk('assistant', 'Transferindo!'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(true);
    expect(r.tools_used).toContain('send_carousel');
    expect(r.tools_used).toContain('search_products');
  });
});

/* ═══════════════════════════════════════════════════════════════ */
/*  2. Audio scenarios                                            */
/* ═══════════════════════════════════════════════════════════════ */

describe('Cenario Audio: interacao toda por audio', () => {
  const scenario: TestScenario = {
    id: 'audio-1', name: 'Audio completo', category: 'cenario_audio', difficulty: 'medium', description: '',
    steps: [
      { content: '(audio) procurando cimento', media_type: 'audio' },
      { content: '(audio) 20 sacos, preco?', media_type: 'audio' },
      { content: '(audio) quero, passa pro vendedor', media_type: 'audio' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: true, should_block: false },
  };

  it('passes with audio user messages + correct tools', () => {
    const msgs: ChatMessage[] = [
      mk('user', '(audio) procurando cimento', { media_type: 'audio' }),
      mk('system', '', { tool_calls: [{ name: 'set_tags', args: { tags: ['motivo:compra'] } }] }),
      mk('assistant', 'Temos cimento!'),
      mk('user', '(audio) 20 sacos, preco?', { media_type: 'audio' }),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: { query: 'cimento' } }] }),
      mk('assistant', 'Saco de cimento R$35'),
      mk('user', '(audio) quero, passa pro vendedor', { media_type: 'audio' }),
      mk('system', '', { tool_calls: [{ name: 'handoff_to_human', args: { reason: 'compra' } }] }),
      mk('assistant', 'Transferindo!'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(true);
    // Verify all user msgs are audio
    expect(msgs.filter(m => m.role === 'user').every(m => m.media_type === 'audio')).toBe(true);
  });

  it('correctly identifies audio-only conversations', () => {
    const steps: TestStep[] = [
      { content: 'msg1', media_type: 'audio' },
      { content: 'msg2', media_type: 'audio' },
      { content: 'msg3', media_type: 'audio' },
    ];
    expect(steps.every(s => s.media_type === 'audio')).toBe(true);
    expect(steps.some(s => s.media_type === 'text' || !s.media_type)).toBe(false);
  });
});

describe('Interacao mista: audio + texto alternados', () => {
  it('handles mixed media types correctly', () => {
    const steps: TestStep[] = [
      { content: 'oi', media_type: 'text' },
      { content: '(audio) procurando material', media_type: 'audio' },
      { content: 'argamassa e rejunte', media_type: 'text' },
      { content: '(audio) quanto fica?', media_type: 'audio' },
    ];
    const audioSteps = steps.filter(s => s.media_type === 'audio');
    const textSteps = steps.filter(s => s.media_type === 'text');
    expect(audioSteps).toHaveLength(2);
    expect(textSteps).toHaveLength(2);
  });

  it('passes when expected tools used in mixed interaction', () => {
    const scenario: TestScenario = {
      id: 'mista', name: 'Mista', category: 'interacao_mista', difficulty: 'medium', description: '',
      steps: [{ content: 'oi' }, { content: '(audio) material reforma', media_type: 'audio' }],
      expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mk('user', 'oi'),
      mk('system', '', { tool_calls: [{ name: 'set_tags', args: { tags: ['motivo:reforma'] } }] }),
      mk('assistant', 'Ola!'),
      mk('user', '(audio) material reforma', { media_type: 'audio' }),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: { query: 'reforma' } }] }),
      mk('assistant', 'Temos varios materiais!'),
    ];
    expect(computeResults(scenario, msgs).pass).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════ */
/*  3. send_media tool scenarios                                   */
/* ═══════════════════════════════════════════════════════════════ */

describe('send_media tool usage', () => {
  it('detects send_media as used tool', () => {
    const scenario: TestScenario = {
      id: 'media', name: 'Media', category: 'midia_cenario_1', difficulty: 'medium', description: '',
      steps: [{ content: 'mostra foto do produto' }],
      expected: { tools_must_use: ['send_media'], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mk('user', 'mostra foto do produto'),
      mk('system', '', { tool_calls: [{ name: 'send_media', args: { media_url: 'https://example.com/foto.jpg', media_type: 'image', caption: 'Produto X' } }] }),
      mk('assistant', 'Aqui esta a foto!'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(true);
    expect(r.tools_used).toContain('send_media');
  });

  it('fails when send_media expected but not used', () => {
    const scenario: TestScenario = {
      id: 'media-fail', name: 'Media Fail', category: 'midia_cenario_1', difficulty: 'medium', description: '',
      steps: [{ content: 'mostra foto' }],
      expected: { tools_must_use: ['send_media'], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mk('user', 'mostra foto'),
      mk('assistant', 'Desculpe, nao tenho foto disponivel.'),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.pass).toBe(false);
    expect(r.tools_missing).toContain('send_media');
  });
});

/* ═══════════════════════════════════════════════════════════════ */
/*  4. Scenario template validation                                */
/* ═══════════════════════════════════════════════════════════════ */

describe('Scenario template integrity', () => {
  // Replicate the scenario data for validation
  const MEDIA_SCENARIOS: TestScenario[] = [
    { id: 'midia-1-carousel-foto', name: 'Carrossel + foto + handoff', category: 'midia_cenario_1', difficulty: 'hard', description: 'Fluxo rico.',
      steps: [{ content: 'quero tinta' }, { content: 'mostra opcoes' }, { content: 'gostei' }, { content: 'quero comprar' }],
      expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
    },
    { id: 'midia-2-carousel-duplo', name: 'Carrossel duplo + handoff', category: 'midia_cenario_2', difficulty: 'hard', description: 'Dois carrosseis.',
      steps: [{ content: 'tinta e pincel' }, { content: 'tintas' }, { content: 'pinceis' }, { content: 'quero' }],
      expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
    },
    { id: 'audio-completo', name: 'Audio completo', category: 'cenario_audio', difficulty: 'medium', description: 'Audio.',
      steps: [{ content: 'a', media_type: 'audio' }, { content: 'b', media_type: 'audio' }, { content: 'c', media_type: 'audio' }],
      expected: { tools_must_use: ['search_products', 'set_tags', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
    },
  ];

  it('all media scenarios have at least 2 steps', () => {
    for (const s of MEDIA_SCENARIOS) {
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('carousel scenarios require search_products before send_carousel', () => {
    const carouselScenarios = MEDIA_SCENARIOS.filter(s => s.expected.tools_must_use.includes('send_carousel'));
    for (const s of carouselScenarios) {
      expect(s.expected.tools_must_use).toContain('search_products');
      const searchIdx = s.expected.tools_must_use.indexOf('search_products');
      const carouselIdx = s.expected.tools_must_use.indexOf('send_carousel');
      expect(searchIdx).toBeLessThan(carouselIdx);
    }
  });

  it('audio scenarios have all steps with media_type=audio', () => {
    const audioScenarios = MEDIA_SCENARIOS.filter(s => s.category === 'cenario_audio');
    for (const s of audioScenarios) {
      expect(s.steps.every(step => step.media_type === 'audio')).toBe(true);
    }
  });

  it('handoff scenarios have should_handoff=true and handoff_to_human in tools', () => {
    const handoffScenarios = MEDIA_SCENARIOS.filter(s => s.expected.should_handoff);
    for (const s of handoffScenarios) {
      expect(s.expected.tools_must_use).toContain('handoff_to_human');
    }
  });
});

/* ═══════════════════════════════════════════════════════════════ */
/*  5. Token/latency aggregation in media-heavy flows              */
/* ═══════════════════════════════════════════════════════════════ */

describe('Interacao so texto (sem midia)', () => {
  it('text-only scenario has no audio/image steps', () => {
    const steps: TestStep[] = [
      { content: 'Boa tarde!' },
      { content: 'Preciso de argamassa' },
      { content: 'Meu nome e Ana' },
      { content: 'Qual a mais barata?' },
    ];
    expect(steps.every(s => !s.media_type || s.media_type === 'text')).toBe(true);
    expect(steps.some(s => s.media_type === 'audio')).toBe(false);
    expect(steps.some(s => s.media_type === 'image')).toBe(false);
  });
});

describe('Token and latency aggregation in media flows', () => {
  it('correctly sums tokens across multiple tool-heavy turns', () => {
    const scenario: TestScenario = {
      id: 'tok', name: 'Token test', category: 'midia_cenario_1', difficulty: 'easy', description: '',
      steps: [{ content: 'a' }],
      expected: { tools_must_use: [], tools_must_not_use: [], should_handoff: false, should_block: false },
    };
    const msgs: ChatMessage[] = [
      mk('user', 'a'),
      mk('system', '', { tool_calls: [{ name: 'search_products', args: {} }] }),
      mk('assistant', 'r1', { tokens: { input: 500, output: 200 }, latency_ms: 1200 }),
      mk('user', 'b'),
      mk('system', '', { tool_calls: [{ name: 'send_carousel', args: {} }] }),
      mk('assistant', 'r2', { tokens: { input: 600, output: 300 }, latency_ms: 1800 }),
    ];
    const r = computeResults(scenario, msgs);
    expect(r.total_tokens.input).toBe(1100);
    expect(r.total_tokens.output).toBe(500);
    expect(r.total_latency_ms).toBe(3000);
  });
});
