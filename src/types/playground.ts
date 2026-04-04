/**
 * Playground types, constants, and test scenarios.
 * Extracted from AIAgentPlayground.tsx per D-07/D-08/D-15.
 */

import {
  ShoppingCart, Package, Image, Bookmark, Tag, Columns3, UserCog,
  PhoneForwarded, Wrench, MessageSquare, RotateCcw, AlertTriangle,
  Eye, Shield, Timer, Zap, Layers, Mic, Sparkles,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════ */
/*  Types                                                      */
/* ═══════════════════════════════════════════════════════════ */

export interface AIAgent {
  id: string; name: string; instance_id: string;
  personality: string | null; greeting_message: string | null;
  model: string | null; temperature: number | null; max_tokens: number | null;
  blocked_topics: string[] | null;
}

export interface ToolCall {
  name: string; args: Record<string, unknown>; result?: string; duration_ms?: number;
}

export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system';
  content: string; timestamp: Date;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
  media_type?: 'text' | 'image' | 'audio'; media_url?: string;
  rating?: 'approved' | 'disapproved'; note?: string;
}

export interface PlaygroundResponse {
  ok: boolean; response: string; error?: string;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
}

export interface Overrides {
  temperature: number; maxTokens: number; model: string;
  disabledTools: Set<string>;
}

/* ── Scenario types ── */
export type ScenarioCategory =
  | 'vendas' | 'suporte' | 'troca' | 'devolucao' | 'defeito'
  | 'curioso' | 'vaga_emprego' | 'indeciso' | 'transbordo'
  | 'pergunta_direta' | 'midia_cenario_1' | 'midia_cenario_2'
  | 'cenario_audio' | 'interacao_texto' | 'interacao_mista'
  | 'interacao_audio' | 'objecao';

export interface TestStep {
  content: string;
  media_type?: 'text' | 'image' | 'audio';
  delay_ms?: number;
}

export interface ExpectedOutcome {
  tools_must_use: string[];
  tools_must_not_use: string[];
  should_handoff: boolean;
  should_block: boolean;
  max_turns?: number;
}

export interface TestScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: TestStep[];
  expected: ExpectedOutcome;
  tags?: string[];
}

export interface ScenarioRunResults {
  tools_used: string[];
  tools_expected: string[];
  tools_missing: string[];
  tools_unexpected: string[];
  handoff_occurred: boolean;
  blocked_occurred: boolean;
  total_tokens: { input: number; output: number };
  total_latency_ms: number;
  pass: boolean;
}

export interface ScenarioRun {
  id: string;
  scenario_id: string;
  scenario_name: string;
  category: ScenarioCategory;
  started_at: Date;
  finished_at?: Date;
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  current_step: number;
  total_steps: number;
  messages: ChatMessage[];
  results: ScenarioRunResults | null;
}

export type WatchSpeed = 0.5 | 1 | 1.5 | 2 | 3;

/* ── E2E result types ── */
export interface E2eResult {
  step: number;
  input: string;
  media_type: string;
  agent_response: string | null;
  agent_raw: Record<string, unknown> | null;
  tools_used: string[];
  tags: string[];
  status_ia: string | undefined;
  latency_ms: number;
  tokens: { input: number; output: number };
}

export interface E2eLiveStep extends E2eResult {
  status: 'pending' | 'running' | 'sending' | 'done' | 'error';
}

/** Aggregated result for one E2E run (scenario-level, not step-level). */
export interface E2eRunResult {
  id: string;
  scenario_id: string;
  scenario_name: string;
  category: ScenarioCategory;
  timestamp: Date;
  pass: boolean;
  tools_used?: string[];
  tools_missing?: string[];
  tools_unexpected?: string[];
  handoff?: boolean;
  steps: E2eResult[];
  total_latency_ms: number;
  conversation_id?: string | null;
  error?: string;
}

/* ═══════════════════════════════════════════════════════════ */
/*  Constants                                                  */
/* ═══════════════════════════════════════════════════════════ */

export const TOOL_META: Record<string, { icon: typeof Wrench; label: string; color: string }> = {
  search_products: { icon: ShoppingCart, label: 'Buscar Produtos', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  send_carousel: { icon: Package, label: 'Carrossel', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  send_media: { icon: Image, label: 'Midia', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  assign_label: { icon: Bookmark, label: 'Label', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  set_tags: { icon: Tag, label: 'Tags', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  move_kanban: { icon: Columns3, label: 'Kanban', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  update_lead_profile: { icon: UserCog, label: 'Lead', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  handoff_to_human: { icon: PhoneForwarded, label: 'Handoff', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export const ALL_TOOLS = Object.keys(TOOL_META);
export const MODELS = ['gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1', 'gemini-2.5-flash', 'gemini-2.5-pro'];

export const PERSONAS = [
  { name: 'Cliente curioso', msgs: ['Oi, quais produtos voces tem?', 'Tem promocao?'] },
  { name: 'Cliente apressado', msgs: ['Preciso de um orcamento urgente pra 50 sacos de cimento'] },
  { name: 'Pede vendedor', msgs: ['Oi', 'Quero falar com um vendedor humano'] },
  { name: 'Envia audio', msgs: ['(audio simulado) Queria saber preco do porcelanato'] },
  { name: 'Multi-mensagem', msgs: ['oi', 'tudo bem?', 'queria ver tintas', 'tem coral?'] },
  { name: 'Frustrado', msgs: ['Ninguem responde nessa loja', 'Ja mandei 3 mensagens'] },
];

export const CATEGORY_META: Record<ScenarioCategory, { label: string; emoji: string; icon: typeof Wrench; color: string; gradient: string }> = {
  vendas:          { label: 'Vendas',            emoji: '\u{1F6D2}', icon: ShoppingCart,    color: 'text-emerald-400 bg-emerald-500/10', gradient: 'from-emerald-500/20 to-emerald-500/5' },
  suporte:         { label: 'Suporte / FAQ',     emoji: '\u{1F4AC}', icon: MessageSquare,  color: 'text-blue-400 bg-blue-500/10', gradient: 'from-blue-500/20 to-blue-500/5' },
  troca:           { label: 'Troca',             emoji: '\u{1F504}', icon: RotateCcw,      color: 'text-orange-400 bg-orange-500/10', gradient: 'from-orange-500/20 to-orange-500/5' },
  devolucao:       { label: 'Devolucao',         emoji: '\u{1F4E6}', icon: Package,        color: 'text-red-400 bg-red-500/10', gradient: 'from-red-500/20 to-red-500/5' },
  defeito:         { label: 'Defeito/Garantia',  emoji: '\u{26A0}\u{FE0F}', icon: AlertTriangle,  color: 'text-amber-400 bg-amber-500/10', gradient: 'from-amber-500/20 to-amber-500/5' },
  curioso:         { label: 'Curioso',           emoji: '\u{1F440}', icon: Eye,            color: 'text-violet-400 bg-violet-500/10', gradient: 'from-violet-500/20 to-violet-500/5' },
  vaga_emprego:    { label: 'Vaga de Emprego',   emoji: '\u{1F6AB}', icon: Shield,         color: 'text-red-500 bg-red-500/10', gradient: 'from-red-500/20 to-red-500/5' },
  indeciso:        { label: 'Indeciso',          emoji: '\u{1F914}', icon: Timer,          color: 'text-yellow-400 bg-yellow-500/10', gradient: 'from-yellow-500/20 to-yellow-500/5' },
  transbordo:      { label: 'Transbordo',        emoji: '\u{1F4DE}', icon: PhoneForwarded, color: 'text-pink-400 bg-pink-500/10', gradient: 'from-pink-500/20 to-pink-500/5' },
  pergunta_direta: { label: 'Pergunta Direta',   emoji: '\u{26A1}',  icon: Zap,            color: 'text-teal-400 bg-teal-500/10', gradient: 'from-teal-500/20 to-teal-500/5' },
  midia_cenario_1: { label: 'Carrossel + Foto',  emoji: '\u{1F5BC}\u{FE0F}', icon: Image,  color: 'text-indigo-400 bg-indigo-500/10', gradient: 'from-indigo-500/20 to-indigo-500/5' },
  midia_cenario_2: { label: 'Carrossel Duplo',   emoji: '\u{1F3A0}', icon: Layers,         color: 'text-indigo-400 bg-indigo-500/10', gradient: 'from-indigo-500/20 to-indigo-500/5' },
  cenario_audio:   { label: 'Cenario Audio',     emoji: '\u{1F3A4}', icon: Mic,            color: 'text-cyan-400 bg-cyan-500/10', gradient: 'from-cyan-500/20 to-cyan-500/5' },
  interacao_texto:  { label: 'So Texto',         emoji: '\u{1F4DD}', icon: MessageSquare,  color: 'text-gray-400 bg-gray-500/10', gradient: 'from-gray-500/20 to-gray-500/5' },
  interacao_mista:  { label: 'Mista Audio+Texto', emoji: '\u{1F500}', icon: Sparkles,      color: 'text-purple-400 bg-purple-500/10', gradient: 'from-purple-500/20 to-purple-500/5' },
  interacao_audio:  { label: 'So Audio',         emoji: '\u{1F50A}', icon: Mic,            color: 'text-cyan-400 bg-cyan-500/10', gradient: 'from-cyan-500/20 to-cyan-500/5' },
  objecao:         { label: 'Objecoes',          emoji: '\u{1F6E1}\u{FE0F}', icon: Shield, color: 'text-rose-400 bg-rose-500/10', gradient: 'from-rose-500/20 to-rose-500/5' },
};

export const DIFFICULTY_COLORS = { easy: 'bg-emerald-500/20 text-emerald-400', medium: 'bg-amber-500/20 text-amber-400', hard: 'bg-red-500/20 text-red-400' };

/* ═══════════════════════════════════════════════════════════ */
/*  Test Scenario Templates                                    */
/* ═══════════════════════════════════════════════════════════ */

export const TEST_SCENARIOS: TestScenario[] = [
  // ── Vendas ──
  { id: 'vendas-completo', name: 'Fluxo completo de venda', category: 'vendas', difficulty: 'hard', description: 'Lead chega, qualifica, busca produto, recebe carrossel e faz handoff.', tags: ['media', 'handoff'],
    steps: [
      { content: 'Oi, tudo bem?' },
      { content: 'To procurando tinta pra pintar minha sala' },
      { content: 'Meu nome e Carlos, sou de Recife' },
      { content: 'Quero algo de boa qualidade, ate uns 200 reais' },
      { content: 'Gostei dessa! Quero comprar, pode me passar pra um vendedor?' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags', 'update_lead_profile'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  { id: 'vendas-direta', name: 'Venda direta (produto especifico)', category: 'vendas', difficulty: 'medium', description: 'Lead ja sabe o que quer, busca direto.',
    steps: [
      { content: 'Boa tarde, voces tem cimento CP-II?' },
      { content: 'Quero 10 sacos, qual o preco?' },
    ],
    expected: { tools_must_use: ['search_products'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Suporte ──
  { id: 'suporte-horario', name: 'Pergunta sobre horario', category: 'suporte', difficulty: 'easy', description: 'Lead pergunta horario de funcionamento.',
    steps: [{ content: 'Qual o horario de funcionamento de voces?' }],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: ['search_products'], should_handoff: false, should_block: false },
  },
  { id: 'suporte-pagamento', name: 'Formas de pagamento', category: 'suporte', difficulty: 'easy', description: 'Lead pergunta formas de pagamento.',
    steps: [{ content: 'Oi, quais formas de pagamento voces aceitam?' }, { content: 'Vocces parcelam no cartao?' }],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Troca ──
  { id: 'troca-produto', name: 'Troca de produto', category: 'troca', difficulty: 'medium', description: 'Cliente quer trocar produto comprado.',
    steps: [
      { content: 'Oi, comprei uma tinta semana passada e quero trocar' },
      { content: 'A cor ficou diferente do que eu esperava, quero outra cor' },
      { content: 'Tenho a nota fiscal sim' },
    ],
    expected: { tools_must_use: ['set_tags', 'update_lead_profile'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── Devolucao ──
  { id: 'devolucao-insatisfacao', name: 'Devolucao por insatisfacao', category: 'devolucao', difficulty: 'medium', description: 'Cliente insatisfeito quer devolver.',
    steps: [
      { content: 'Quero devolver um produto que comprei' },
      { content: 'Nao gostei da qualidade, quero meu dinheiro de volta' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── Defeito ──
  { id: 'defeito-garantia', name: 'Produto com defeito na garantia', category: 'defeito', difficulty: 'medium', description: 'Produto com defeito dentro da garantia.',
    steps: [
      { content: 'Comprei um chuveiro eletrico e parou de funcionar' },
      { content: 'Tem 2 meses que comprei, ta na garantia' },
      { content: 'Quero trocar por um novo ou reembolso' },
    ],
    expected: { tools_must_use: ['set_tags', 'update_lead_profile'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── Curioso ──
  { id: 'curioso-navegando', name: 'Navegando sem intencao', category: 'curioso', difficulty: 'easy', description: 'Lead so olhando, sem intencao de compra imediata.',
    steps: [
      { content: 'Oi, to so dando uma olhada' },
      { content: 'Que tipo de produtos voces vendem?' },
      { content: 'Legal, vou pensar. Obrigado!' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: ['handoff_to_human'], should_handoff: false, should_block: false },
  },
  // ── Vaga de emprego ──
  { id: 'vaga-emprego', name: 'Pergunta sobre vaga de emprego', category: 'vaga_emprego', difficulty: 'easy', description: 'Deve ser bloqueado pelo guardrail.',
    steps: [
      { content: 'Oi, voces tem vagas de emprego disponiveis?' },
      { content: 'Quero trabalhar com voces, como faco pra enviar curriculo?' },
    ],
    expected: { tools_must_use: [], tools_must_not_use: ['search_products'], should_handoff: false, should_block: true },
  },
  // ── Indeciso ──
  { id: 'indeciso-comparando', name: 'Cliente indeciso comparando', category: 'indeciso', difficulty: 'hard', description: 'Cliente que nao consegue decidir entre opcoes.',
    steps: [
      { content: 'Oi, to em duvida entre dois tipos de piso' },
      { content: 'Porcelanato e ceramica, qual e melhor?' },
      { content: 'Hmm mas o porcelanato e muito caro ne?' },
      { content: 'E se eu pegar o ceramica, qual voce recomenda?' },
      { content: 'Vou pensar mais um pouco...' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Transbordo ──
  { id: 'transbordo-direto', name: 'Pede atendente direto', category: 'transbordo', difficulty: 'easy', description: 'Lead pede humano logo no inicio.',
    steps: [
      { content: 'Oi' },
      { content: 'Quero falar com um atendente humano por favor' },
    ],
    expected: { tools_must_use: ['handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false, max_turns: 2 },
  },
  // ── Pergunta direta ──
  { id: 'pergunta-preco', name: 'Preco de produto especifico', category: 'pergunta_direta', difficulty: 'easy', description: 'Lead pergunta preco diretamente.',
    steps: [
      { content: 'Qual o preco do saco de cimento?' },
    ],
    expected: { tools_must_use: ['search_products'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Midia cenario 1 ──
  { id: 'midia-1-carousel-foto', name: 'Carrossel + foto + handoff', category: 'midia_cenario_1', difficulty: 'hard', description: 'Fluxo rico: carrossel 5 cards, foto individual, copy de venda, handoff.',
    steps: [
      { content: 'Oi, quero ver opcoes de tinta latex' },
      { content: 'Me mostra as opcoes com foto' },
      { content: 'Gostei da Suvinil! Me mostra so ela com mais detalhes' },
      { content: 'Perfeito, quero essa. Passa pro vendedor!' },
    ],
    expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── Midia cenario 2 ──
  { id: 'midia-2-carousel-duplo', name: 'Carrossel duplo + handoff', category: 'midia_cenario_2', difficulty: 'hard', description: 'Dois carrosseis diferentes antes do handoff.',
    steps: [
      { content: 'Oi, preciso de tinta e pincel' },
      { content: 'Me mostra as tintas disponiveis' },
      { content: 'Agora me mostra os pinceis' },
      { content: 'Quero a tinta Coral e o pincel Atlas. Passa pro vendedor!' },
    ],
    expected: { tools_must_use: ['search_products', 'send_carousel', 'handoff_to_human'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── Audio ──
  { id: 'audio-completo', name: 'Interacao toda por audio', category: 'cenario_audio', difficulty: 'medium', description: 'Lead envia apenas audios.',
    steps: [
      { content: '(audio) Oi, to procurando cimento pra uma obra', media_type: 'audio' },
      { content: '(audio) Preciso de uns 20 sacos, qual o preco?', media_type: 'audio' },
      { content: '(audio) Beleza, vou querer. Me passa pro vendedor', media_type: 'audio' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: true, should_block: false },
  },
  // ── So texto ──
  { id: 'texto-completo', name: 'Somente texto, sem midia', category: 'interacao_texto', difficulty: 'medium', description: 'Fluxo padrao sem midia.',
    steps: [
      { content: 'Boa tarde!' },
      { content: 'Preciso de argamassa pra assentar piso' },
      { content: 'Meu nome e Ana, sou de Olinda' },
      { content: 'Qual a mais barata?' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags', 'update_lead_profile'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Mista audio+texto ──
  { id: 'mista-audio-texto', name: 'Audio e texto alternados', category: 'interacao_mista', difficulty: 'medium', description: 'Lead alterna entre audio e texto.',
    steps: [
      { content: 'Oi, tudo bem?', media_type: 'text' },
      { content: '(audio) To procurando material pra reforma', media_type: 'audio' },
      { content: 'Preciso de argamassa e rejunte', media_type: 'text' },
      { content: '(audio) Quanto fica os dois juntos?', media_type: 'audio' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── So audio longo ──
  { id: 'audio-longo', name: 'Audio do inicio ao fim', category: 'interacao_audio', difficulty: 'hard', description: 'Toda conversa por audio, 5 mensagens.',
    steps: [
      { content: '(audio) Ola, boa tarde', media_type: 'audio' },
      { content: '(audio) Quero ver opcoes de piso porcelanato', media_type: 'audio' },
      { content: '(audio) Meu nome e Roberto, sou de Recife', media_type: 'audio' },
      { content: '(audio) Gostei do mais barato, pode me passar mais detalhes?', media_type: 'audio' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags', 'update_lead_profile'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  // ── Objecoes ──
  { id: 'objecao-preco', name: 'Objecao: preco alto', category: 'objecao', difficulty: 'hard', description: 'Lead reclama do preco.',
    steps: [
      { content: 'Oi, quanto custa o porcelanato polido?' },
      { content: 'Nossa, ta muito caro! Na loja do lado e mais barato' },
      { content: 'Voces nao fazem desconto?' },
    ],
    expected: { tools_must_use: ['search_products', 'set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  { id: 'objecao-concorrente', name: 'Objecao: concorrente mais barato', category: 'objecao', difficulty: 'hard', description: 'Lead compara com concorrente.',
    steps: [
      { content: 'Vi o mesmo produto mais barato na Leroy Merlin' },
      { content: 'Por que eu compraria de voces se la e mais barato?' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  { id: 'objecao-momento', name: 'Objecao: nao e o momento', category: 'objecao', difficulty: 'medium', description: 'Lead diz que nao e a hora.',
    steps: [
      { content: 'Oi, to pesquisando precos pra uma obra que vai comecar mes que vem' },
      { content: 'Agora nao vou comprar, so quero ter uma ideia de preco' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: ['handoff_to_human'], should_handoff: false, should_block: false },
  },
  { id: 'objecao-qualidade', name: 'Objecao: qualidade duvidosa', category: 'objecao', difficulty: 'hard', description: 'Lead questiona qualidade.',
    steps: [
      { content: 'Vi reclamacao dessa marca no Reclame Aqui' },
      { content: 'Como sei que o produto e bom e nao vai dar problema?' },
      { content: 'Tem garantia?' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
  { id: 'objecao-confianca', name: 'Objecao: nao confio em compra online', category: 'objecao', difficulty: 'hard', description: 'Lead nao confia.',
    steps: [
      { content: 'Voces tem loja fisica? Nao gosto de comprar online' },
      { content: 'Como sei que vou receber o produto?' },
      { content: 'E se vier errado, como troco?' },
    ],
    expected: { tools_must_use: ['set_tags'], tools_must_not_use: [], should_handoff: false, should_block: false },
  },
];

// Batch history types (F1 — persistent history)
export interface E2eBatchSummary {
  id: string
  agent_id: string
  created_at: string
  run_type: 'manual' | 'scheduled' | 'regression'
  total: number
  passed: number
  failed: number
  composite_score: number | null
  status: 'running' | 'complete' | 'approved' | 'rejected'
  prompt_hash: string | null
  created_by: string | null
  // F4 — regression detection fields
  is_regression: boolean
  regression_context: {
    delta: number
    current_score: number
    previous_score: number
    consecutive_below_threshold: number
    failed_scenarios: Array<{ id: string; name: string; reason: string }>
  } | null
}

export interface E2eBatchDetail extends E2eBatchSummary {
  runs: E2eBatchRun[]
}

export interface E2eBatchRun {
  id: string
  scenario_id: string | null
  scenario_name: string | null
  category: string | null
  passed: boolean
  tools_used: string[] | null
  tools_missing: string[] | null
  latency_ms: number | null
  error: string | null
  results: unknown
  created_at: string
  approval: string | null
}

/* ═══════════════════════════════════════════════════════════ */
/*  Pure utility functions                                     */
/* ═══════════════════════════════════════════════════════════ */

/**
 * Compute scenario run results from a completed set of messages.
 * Pure function — no side effects, no refs.
 */
export const computeResults = (scenario: TestScenario, msgs: ChatMessage[]): ScenarioRunResults => {
  // Use only system messages for tool calls to avoid counting duplicates
  const toolsUsed = msgs.filter(m => m.role === 'system' && m.tool_calls?.length).flatMap(m => m.tool_calls!.map(tc => tc.name));
  const uniqueTools = [...new Set(toolsUsed)];
  const assistantMsgs = msgs.filter(m => m.role === 'assistant');
  const allContent = assistantMsgs.map(m => m.content.toLowerCase()).join(' ');
  const handoff_occurred = uniqueTools.includes('handoff_to_human');
  const blocked_occurred = allContent.includes('nao posso') || allContent.includes('nao consigo ajudar') || allContent.includes('nao e possivel') || allContent.includes('topico bloqueado');
  const tools_missing = scenario.expected.tools_must_use.filter(t => !uniqueTools.includes(t));
  const tools_unexpected = scenario.expected.tools_must_not_use.filter(t => uniqueTools.includes(t));
  const tokens = msgs.reduce((acc, m) => ({ input: acc.input + (m.tokens?.input || 0), output: acc.output + (m.tokens?.output || 0) }), { input: 0, output: 0 });
  const latency = msgs.reduce((sum, m) => sum + (m.latency_ms || 0), 0);

  const pass = tools_missing.length === 0 && tools_unexpected.length === 0
    && (scenario.expected.should_handoff ? handoff_occurred : true)
    && (scenario.expected.should_block ? blocked_occurred : true);

  return { tools_used: uniqueTools, tools_expected: scenario.expected.tools_must_use, tools_missing, tools_unexpected, handoff_occurred, blocked_occurred, total_tokens: tokens, total_latency_ms: latency, pass };
};
