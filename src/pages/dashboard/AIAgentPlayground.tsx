import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot, Send, User, Loader2, Clock, Zap, RotateCcw,
  Wrench, ShoppingCart, Image, Tag, Bookmark, Columns3, UserCog,
  PhoneForwarded, Mic, Sparkles, Package, MessageSquare, X, FileImage,
  ThumbsUp, ThumbsDown, ChevronDown, Settings2, Download,
  Copy, Shield, Eye, Timer, Layers, UserCircle, AlertTriangle, Play,
  Pause, Square, Search, BarChart3,
  Check, CircleDot, ListChecks
} from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════ */
/*  Types                                                      */
/* ═══════════════════════════════════════════════════════════ */

interface AIAgent {
  id: string; name: string; instance_id: string;
  personality: string | null; greeting_message: string | null;
  model: string | null; temperature: number | null; max_tokens: number | null;
  blocked_topics: string[] | null;
}

interface ToolCall {
  name: string; args: Record<string, unknown>; result?: string; duration_ms?: number;
}

interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system';
  content: string; timestamp: Date;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
  media_type?: 'text' | 'image' | 'audio'; media_url?: string;
  rating?: 'approved' | 'disapproved'; note?: string;
}

interface PlaygroundResponse {
  ok: boolean; response: string; error?: string;
  tokens?: { input: number; output: number };
  latency_ms?: number; tool_calls?: ToolCall[];
}

interface Overrides {
  temperature: number; maxTokens: number; model: string;
  disabledTools: Set<string>;
}

/* ── Scenario types ── */
type ScenarioCategory =
  | 'vendas' | 'suporte' | 'troca' | 'devolucao' | 'defeito'
  | 'curioso' | 'vaga_emprego' | 'indeciso' | 'transbordo'
  | 'pergunta_direta' | 'midia_cenario_1' | 'midia_cenario_2'
  | 'cenario_audio' | 'interacao_texto' | 'interacao_mista'
  | 'interacao_audio' | 'objecao';

interface TestStep {
  content: string;
  media_type?: 'text' | 'image' | 'audio';
  delay_ms?: number;
}

interface ExpectedOutcome {
  tools_must_use: string[];
  tools_must_not_use: string[];
  should_handoff: boolean;
  should_block: boolean;
  max_turns?: number;
}

interface TestScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: TestStep[];
  expected: ExpectedOutcome;
  tags?: string[];
}

interface ScenarioRunResults {
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

interface ScenarioRun {
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

type WatchSpeed = 0.5 | 1 | 1.5 | 2 | 3;

/* ═══════════════════════════════════════════════════════════ */
/*  Constants                                                  */
/* ═══════════════════════════════════════════════════════════ */

const TOOL_META: Record<string, { icon: typeof Wrench; label: string; color: string }> = {
  search_products: { icon: ShoppingCart, label: 'Buscar Produtos', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  send_carousel: { icon: Package, label: 'Carrossel', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  send_media: { icon: Image, label: 'Midia', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  assign_label: { icon: Bookmark, label: 'Label', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  set_tags: { icon: Tag, label: 'Tags', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  move_kanban: { icon: Columns3, label: 'Kanban', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  update_lead_profile: { icon: UserCog, label: 'Lead', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  handoff_to_human: { icon: PhoneForwarded, label: 'Handoff', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const ALL_TOOLS = Object.keys(TOOL_META);
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

const PERSONAS = [
  { name: 'Cliente curioso', msgs: ['Oi, quais produtos voces tem?', 'Tem promocao?'] },
  { name: 'Cliente apressado', msgs: ['Preciso de um orcamento urgente pra 50 sacos de cimento'] },
  { name: 'Pede vendedor', msgs: ['Oi', 'Quero falar com um vendedor humano'] },
  { name: 'Envia audio', msgs: ['(audio simulado) Queria saber preco do porcelanato'] },
  { name: 'Multi-mensagem', msgs: ['oi', 'tudo bem?', 'queria ver tintas', 'tem coral?'] },
  { name: 'Frustrado', msgs: ['Ninguem responde nessa loja', 'Ja mandei 3 mensagens'] },
];

const CATEGORY_META: Record<ScenarioCategory, { label: string; emoji: string; icon: typeof Wrench; color: string; gradient: string }> = {
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

const DIFFICULTY_COLORS = { easy: 'bg-emerald-500/20 text-emerald-400', medium: 'bg-amber-500/20 text-amber-400', hard: 'bg-red-500/20 text-red-400' };

/* ═══════════════════════════════════════════════════════════ */
/*  Test Scenario Templates                                    */
/* ═══════════════════════════════════════════════════════════ */

const TEST_SCENARIOS: TestScenario[] = [
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

/* ═══════════════════════════════════════════════════════════ */
/*  Component                                                  */
/* ═══════════════════════════════════════════════════════════ */

const AIAgentPlayground = () => {
  const { isSuperAdmin } = useAuth();

  /* ── Existing state ── */
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID().substring(0, 12));
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({ temperature: 0.7, maxTokens: 1024, model: 'gemini-2.5-flash', disabledTools: new Set() });
  const [bufferMode, setBufferMode] = useState(false);
  const [bufferSec, setBufferSec] = useState(10);
  const [bufferedMsgs, setBufferedMsgs] = useState<string[]>([]);  // eslint-disable-line
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bufferCountdown, setBufferCountdown] = useState(0);  // eslint-disable-line
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── New state ── */
  const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e'>('manual');

  /* ── E2E state ── */
  const [e2eNumber, setE2eNumber] = useState('5581985749970');
  const [e2eRunning, setE2eRunning] = useState(false);
  const [e2eResults, setE2eResults] = useState<any[]>([]);
  const [e2eCurrentScenario, setE2eCurrentScenario] = useState<string | null>(null);
  const [e2eLiveSteps, setE2eLiveSteps] = useState<any[]>([]);
  const [e2eSelectedScenario, setE2eSelectedScenario] = useState<TestScenario | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);
  const [watchSpeed, setWatchSpeed] = useState<WatchSpeed>(1);
  const watchSpeedRef = useRef<WatchSpeed>(1);
  watchSpeedRef.current = watchSpeed;
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const [runHistory, setRunHistory] = useState<ScenarioRun[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  /* ── Data fetching ── */
  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_agents').select('id, name, instance_id, personality, greeting_message, model, temperature, max_tokens, blocked_topics')
        .eq('enabled', true).order('name');
      if (error) throw error;
      const list = (data || []) as unknown as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
        if (list[0].temperature) setOverrides(o => ({ ...o, temperature: list[0].temperature || 0.7 }));
        if (list[0].max_tokens) setOverrides(o => ({ ...o, maxTokens: list[0].max_tokens || 1024 }));
        if (list[0].model) setOverrides(o => ({ ...o, model: list[0].model || 'gemini-2.5-flash' }));
      }
    } catch (err) { handleError(err, 'Erro ao carregar agentes', 'Playground'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAgents(); }, []);
  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [messages]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  /* ── Send message ── */
  const sendToAgent = async (userMessages: string[]) => {
    if (!selectedAgentId) return;
    const combined = userMessages.join('\n');
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: combined,
      timestamp: new Date(), media_type: attachedImage ? 'image' : 'text', media_url: attachedImage || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setAttachedImage(null);
    setSending(true);

    try {
      const history = [...messagesRef.current].map(m => ({
        content: m.content, media_type: m.media_type || 'text', media_url: m.media_url || null,
        direction: m.role === 'user' ? 'incoming' : 'outgoing', timestamp: m.timestamp.toISOString(),
      }));

      const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', {
        agent_id: selectedAgentId, messages: history,
        overrides: { temperature: overrides.temperature, max_tokens: overrides.maxTokens, model: overrides.model, disabled_tools: [...overrides.disabledTools] },
      });

      if (result.ok && result.response) {
        if (result.tool_calls?.length) {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: '', timestamp: new Date(), tool_calls: result.tool_calls }]);
        }
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.response, timestamp: new Date(), tokens: result.tokens, latency_ms: result.latency_ms, tool_calls: result.tool_calls }]);
      } else {
        toast.error(result.error || 'Erro ao processar resposta');
      }
    } catch (err: any) {
      if (err?.status === 404) toast.error('Edge function ai-agent-playground nao implantada');
      else handleError(err, 'Erro ao chamar agente', 'Playground');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !attachedImage) || sending) return;
    setInput('');
    if (bufferMode && text) {
      setBufferedMsgs(prev => [...prev, text]);
      setBufferCountdown(bufferSec);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = setTimeout(() => {
        setBufferedMsgs(prev => { if (prev.length > 0) sendToAgent(prev); return []; });
        setBufferCountdown(0);
      }, bufferSec * 1000);
      const tick = setInterval(() => { setBufferCountdown(c => { if (c <= 1) { clearInterval(tick); return 0; } return c - 1; }); }, 1000);
      return;
    }
    sendToAgent([text]);
  };

  /* ── Rating ── */
  const rateMessage = async (msgId: string, rating: 'approved' | 'disapproved') => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating } : m));
  };

  /* ── Replay ── */
  const replayMessage = async (msgIndex: number) => {
    if (sending || !selectedAgentId) return;
    const targetMsg = messages[msgIndex];
    if (targetMsg?.role !== 'user') return;
    const historyBefore = messages.slice(0, msgIndex);
    setMessages(historyBefore);
    await new Promise(r => setTimeout(r, 100));
    await sendToAgent([targetMsg.content]);
  };

  const replaySession = async () => {
    if (sending || !selectedAgentId) return;
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
    if (userMsgs.length === 0) return;
    setMessages([]);
    await new Promise(r => setTimeout(r, 100));
    for (const msg of userMsgs) {
      await sendToAgent([msg]);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  /* ── Personas ── */
  const runPersona = async (persona: typeof PERSONAS[0]) => {
    if (sending || !selectedAgentId) return;
    for (const msg of persona.msgs) {
      setInput(msg);
      await new Promise(r => setTimeout(r, 300));
      await sendToAgent([msg]);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const testGuardrail = (topic: string) => { setInput(`O que voce acha sobre ${topic}? Me fala tudo sobre ${topic}`); inputRef.current?.focus(); };

  /* ── E2E test runner ── */
  const runE2eScenario = async (scenario: TestScenario) => {
    if (e2eRunning || !selectedAgentId || !selectedAgent?.instance_id) return;
    setE2eRunning(true);
    setE2eCurrentScenario(scenario.id);
    setE2eSelectedScenario(scenario);
    // Show live progress
    setE2eLiveSteps(scenario.steps.map((s, i) => ({ step: i + 1, input: s.content, media_type: s.media_type || 'text', status: 'sending' as string, agent_response: null, tools_used: [], tags: [], latency_ms: 0 })));

    try {
      const { data, error } = await supabase.functions.invoke('e2e-test', {
        body: { agent_id: selectedAgentId, instance_id: selectedAgent.instance_id, test_number: e2eNumber, steps: scenario.steps.map(s => ({ content: s.content, media_type: s.media_type || 'text' })) },
      });
      if (error) throw error;

      // Update live steps with real results
      setE2eLiveSteps((data?.results || []).map((r: any) => ({ ...r, status: 'done' })));

      const toolsUsed = (data?.results || []).flatMap((r: any) => r.tools_used || []);
      const uniqueTools = [...new Set(toolsUsed)];
      const expected = scenario.expected;
      const tools_missing = expected.tools_must_use.filter(t => !uniqueTools.includes(t));
      const tools_unexpected = expected.tools_must_not_use.filter(t => uniqueTools.includes(t));
      const handoff = uniqueTools.includes('handoff_to_human');
      const pass = tools_missing.length === 0 && tools_unexpected.length === 0 && (expected.should_handoff ? handoff : true);

      setE2eResults(prev => [{ id: crypto.randomUUID().substring(0, 8), scenario_id: scenario.id, scenario_name: scenario.name, category: scenario.category, timestamp: new Date(), pass, tools_used: uniqueTools, tools_missing, tools_unexpected, handoff, steps: data?.results || [], total_latency_ms: data?.total_latency_ms || 0, conversation_id: data?.conversation_id }, ...prev]);
      toast.success(pass ? `E2E PASSOU: ${scenario.name}` : `E2E FALHOU: ${scenario.name}`, { duration: 5000 });
    } catch (err: any) {
      toast.error(`E2E erro: ${err?.message || 'falha na execucao'}`);
      setE2eLiveSteps(prev => prev.map(s => ({ ...s, status: 'error' })));
      setE2eResults(prev => [{ id: crypto.randomUUID().substring(0, 8), scenario_id: scenario.id, scenario_name: scenario.name, category: scenario.category, timestamp: new Date(), pass: false, error: err?.message, steps: [], total_latency_ms: 0 }, ...prev]);
    } finally {
      setE2eRunning(false);
      setE2eCurrentScenario(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleClear = () => { setMessages([]); setBufferedMsgs([]); setAttachedImage(null); if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current); inputRef.current?.focus(); };

  /* ── Scenario execution ── */
  const computeResults = (scenario: TestScenario, msgs: ChatMessage[]): ScenarioRunResults => {
    // Use only system messages for tool calls to avoid counting duplicates (tools appear in both system and assistant msgs)
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

  const runScenario = async (scenario: TestScenario) => {
    if (sending || !selectedAgentId) return;
    isPausedRef.current = false;
    isStoppedRef.current = false;

    const run: ScenarioRun = {
      id: crypto.randomUUID().substring(0, 12), scenario_id: scenario.id, scenario_name: scenario.name,
      category: scenario.category, started_at: new Date(), status: 'running', current_step: 0,
      total_steps: scenario.steps.length, messages: [], results: null,
    };
    setScenarioRun(run);
    setMessages([]);

    for (let i = 0; i < scenario.steps.length; i++) {
      // Pause loop
      while (isPausedRef.current && !isStoppedRef.current) { await new Promise(r => setTimeout(r, 200)); }
      if (isStoppedRef.current) break;

      setScenarioRun(prev => prev ? { ...prev, current_step: i, status: isPausedRef.current ? 'paused' : 'running' } : null);
      const step = scenario.steps[i];
      const speed = watchSpeedRef.current;
      const delay = (step.delay_ms || 1500) / speed;
      await new Promise(r => setTimeout(r, delay));

      if (isStoppedRef.current) break;

      // For audio steps, set media_type on the user message
      if (step.media_type === 'audio') {
        const audioMsg: ChatMessage = {
          id: crypto.randomUUID(), role: 'user', content: step.content,
          timestamp: new Date(), media_type: 'audio',
        };
        setMessages(prev => [...prev, audioMsg]);
        setSending(true);
        try {
          const history = [...messagesRef.current].map(m => ({
            content: m.content, media_type: m.media_type || 'text', media_url: null,
            direction: m.role === 'user' ? 'incoming' : 'outgoing', timestamp: m.timestamp.toISOString(),
          }));
          const result = await edgeFunctionFetch<PlaygroundResponse>('ai-agent-playground', {
            agent_id: selectedAgentId!, messages: history,
            overrides: { temperature: overrides.temperature, max_tokens: overrides.maxTokens, model: overrides.model, disabled_tools: [...overrides.disabledTools] },
          });
          if (result.ok && result.response) {
            if (result.tool_calls?.length) setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: '', timestamp: new Date(), tool_calls: result.tool_calls }]);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.response, timestamp: new Date(), tokens: result.tokens, latency_ms: result.latency_ms, tool_calls: result.tool_calls }]);
          }
        } catch { /* scenario continues */ }
        finally { setSending(false); }
      } else {
        await sendToAgent([step.content]);
      }
      await new Promise(r => setTimeout(r, 800 / speed));
    }

    const finalMsgs = messagesRef.current;
    const results = computeResults(scenario, finalMsgs);
    const finishedRun: ScenarioRun = { ...run, status: isStoppedRef.current ? 'error' : 'done', finished_at: new Date(), current_step: scenario.steps.length, messages: finalMsgs, results };
    setScenarioRun(finishedRun);
    setRunHistory(prev => [finishedRun, ...prev]);
    toast.success(results.pass ? 'Cenario PASSOU!' : 'Cenario FALHOU', { description: scenario.name });
  };

  const pauseScenario = () => { isPausedRef.current = true; setScenarioRun(prev => prev ? { ...prev, status: 'paused' } : null); };
  const resumeScenario = () => { isPausedRef.current = false; setScenarioRun(prev => prev ? { ...prev, status: 'running' } : null); };
  const stopScenario = () => { isStoppedRef.current = true; isPausedRef.current = false; };

  /* ── Filtered scenarios ── */
  const filteredScenarios = useMemo(() => {
    let list = TEST_SCENARIOS;
    if (selectedCategory !== 'all') list = list.filter(s => s.category === selectedCategory);
    if (scenarioSearch) {
      const q = scenarioSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return list;
  }, [selectedCategory, scenarioSearch]);

  /* ── Stats ── */
  const totalTokens = messages.reduce((acc, m) => ({ input: acc.input + (m.tokens?.input || 0), output: acc.output + (m.tokens?.output || 0) }), { input: 0, output: 0 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalCost = (totalTokens.input * 0.15 + totalTokens.output * 0.6) / 1_000_000;
  const avgLatency = (() => { const lats = messages.filter(m => m.latency_ms).map(m => m.latency_ms!); return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0; })();

  /* ── Export ── */
  const exportConversation = (format: 'json' | 'md') => {
    const data = format === 'json'
      ? JSON.stringify({ session_id: sessionId, agent: selectedAgent?.name, messages, overrides }, null, 2)
      : messages.map(m => {
          if (m.role === 'system') return `---\n**Tools:** ${m.tool_calls?.map(t => t.name).join(', ')}\n---`;
          const label = m.role === 'user' ? 'Lead' : 'Agente IA';
          let line = `**${label}:** ${m.content}`;
          if (m.latency_ms) line += ` _(${m.latency_ms}ms)_`;
          return line;
        }).join('\n\n');
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `playground-${sessionId}.${format}`; a.click(); URL.revokeObjectURL(url);
    toast.success(`Exportado como .${format}`);
  };

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agents.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Bot className="w-12 h-12 text-primary opacity-30" />
      <p className="font-semibold">Nenhum agente ativo</p>
      <p className="text-sm text-muted-foreground">Crie e ative um agente na Configuracao</p>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*  Render helpers                                             */
  /* ═══════════════════════════════════════════════════════════ */

  const renderChatMessages = () => (
    <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
          <MessageSquare className="w-10 h-10 opacity-20" />
          <p className="text-sm">Envie uma mensagem para testar o agente</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {messages.map((msg, idx) => {
            if (msg.role === 'system' && msg.tool_calls?.length) {
              return (
                <div key={msg.id} className="flex justify-center py-0.5">
                  <div className="flex flex-wrap gap-1 justify-center max-w-[95%]">
                    {msg.tool_calls.map((tc, i) => {
                      const meta = TOOL_META[tc.name] || { icon: Wrench, label: tc.name, color: 'text-muted-foreground bg-muted border-border' };
                      const Icon = meta.icon;
                      return (
                        <Collapsible key={i}>
                          <CollapsibleTrigger className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium ${meta.color} cursor-pointer hover:opacity-80 transition-all`}>
                            <Icon className="w-3 h-3" />{meta.label}<ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1">
                            <div className="text-[10px] bg-background/80 rounded-lg p-2 border border-border/50 max-w-xs">
                              <p className="font-mono font-semibold mb-0.5">{tc.name}()</p>
                              {Object.entries(tc.args || {}).map(([k, v]) => (<p key={k} className="text-muted-foreground"><span className="text-foreground">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>))}
                              {tc.result && <p className="mt-1 text-emerald-400 border-t border-border/30 pt-1">{tc.result}</p>}
                              {tc.duration_ms != null && <p className="text-muted-foreground">{tc.duration_ms}ms</p>}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex gap-2 justify-end">
                  <div className="max-w-[75%] space-y-0.5">
                    {msg.media_type === 'audio' && (<div className="flex items-center gap-2 bg-primary rounded-2xl rounded-tr-md px-3 py-2"><Mic className="w-3.5 h-3.5 text-primary-foreground/70" /><span className="text-xs text-primary-foreground/80">Audio</span></div>)}
                    {msg.content && msg.media_type !== 'audio' && (<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-3.5 py-2"><p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p></div>)}
                    <div className="flex items-center gap-1.5 justify-end pr-0.5">
                      <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <button onClick={() => replayMessage(idx)} disabled={sending} className="p-0.5 rounded text-muted-foreground/30 hover:text-primary transition-colors disabled:opacity-30" title="Replay"><Play className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1"><User className="w-3 h-3 text-secondary-foreground" /></div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary" /></div>
                <div className="max-w-[78%] space-y-0.5">
                  <div className={`bg-muted/80 rounded-2xl rounded-tl-md px-3.5 py-2 border ${msg.rating === 'approved' ? 'border-emerald-500/30' : msg.rating === 'disapproved' ? 'border-red-500/30' : 'border-transparent'}`}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.latency_ms != null && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2 h-2" />{msg.latency_ms}ms</span>}
                    {msg.tokens && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap className="w-2 h-2" />{msg.tokens.input + msg.tokens.output}</span>}
                    <span className="mx-0.5" />
                    <button onClick={() => rateMessage(msg.id, 'approved')} className={`p-0.5 rounded transition-colors ${msg.rating === 'approved' ? 'text-emerald-400' : 'text-muted-foreground/30 hover:text-emerald-400'}`}><ThumbsUp className="w-3 h-3" /></button>
                    <button onClick={() => rateMessage(msg.id, 'disapproved')} className={`p-0.5 rounded transition-colors ${msg.rating === 'disapproved' ? 'text-red-400' : 'text-muted-foreground/30 hover:text-red-400'}`}><ThumbsDown className="w-3 h-3" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copiado'); }} className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary animate-pulse" /></div>
              <div className="bg-muted/80 rounded-2xl rounded-tl-md px-4 py-3"><div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" /></div></div>
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );

  const renderInputBar = () => (
    <div className={`border-t p-2.5 flex items-end gap-1.5 flex-shrink-0 ${bufferMode ? 'border-amber-500/30' : 'border-border/50'}`}>
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith('image/')) { toast.error('Apenas imagens'); return; } setAttachedImage(URL.createObjectURL(f)); e.target.value = ''; }} />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={sending}><FileImage className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Imagem</TooltipContent></Tooltip>
      <Textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite uma mensagem... (Enter envia)" disabled={sending || !selectedAgentId} rows={1} className="flex-1 min-h-[36px] max-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 text-sm py-2" />
      <Button size="icon" className="h-8 w-8 shrink-0 rounded-xl" onClick={handleSend} disabled={(!input.trim() && !attachedImage) || sending || !selectedAgentId}>
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*  Main Render                                                */
  /* ═══════════════════════════════════════════════════════════ */

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-[1400px] mx-auto animate-fade-in h-[calc(100vh-5rem)] flex flex-col gap-2">

        {/* ══════ Header ══════ */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Playground IA</h1>
              <p className="text-xs text-muted-foreground">8 tools · debug · cenarios · sessao {sessionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {agents.length > 1 && (
              <Select value={selectedAgentId || ''} onValueChange={(v) => { setSelectedAgentId(v); setMessages([]); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Tooltip><TooltipTrigger asChild><Button variant={showOverrides ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setShowOverrides(!showOverrides)}><Settings2 className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Configuracoes</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => exportConversation('json')} disabled={!messages.length}><Download className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Exportar JSON</TooltipContent></Tooltip>
            {messages.length > 0 && (
              <>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={replaySession} disabled={sending}><Play className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Replay sessao</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={handleClear}><RotateCcw className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Reset</TooltipContent></Tooltip>
              </>
            )}
          </div>
        </div>

        {/* ══════ Simulation Warning ══════ */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[10px] leading-tight">Playground de testes do Agente IA — Chat Manual e Cenarios usam LLM simulado. Aba E2E Real envia mensagens reais via WhatsApp.</p>
        </div>

        {/* ══════ Tabs ══════ */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start flex-shrink-0">
            <TabsTrigger value="manual" className="gap-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5" />Chat Manual</TabsTrigger>
            <TabsTrigger value="scenarios" className="gap-1.5 text-xs"><Layers className="w-3.5 h-3.5" />Cenarios<Badge variant="secondary" className="ml-1 text-[9px] px-1">{TEST_SCENARIOS.length}</Badge></TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" />Resultados{runHistory.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1">{runHistory.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="e2e" className="gap-1.5 text-xs"><Zap className="w-3.5 h-3.5 text-amber-400" />E2E Real{e2eResults.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1">{e2eResults.length}</Badge>}</TabsTrigger>
          </TabsList>

          {/* ══════ Tab: Chat Manual ══════ */}
          <TabsContent value="manual" className="flex-1 min-h-0">
            {/* Overrides */}
            {showOverrides && (
              <Card className="flex-shrink-0 border-primary/20 bg-primary/5 mb-2">
                <CardContent className="p-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Modelo</label><Select value={overrides.model} onValueChange={v => setOverrides(o => ({ ...o, model: v }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Temperatura: {overrides.temperature.toFixed(1)}</label><Slider value={[overrides.temperature]} min={0} max={2} step={0.1} onValueChange={([v]) => setOverrides(o => ({ ...o, temperature: v }))} className="mt-2" /></div>
                    <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Max Tokens: {overrides.maxTokens}</label><Slider value={[overrides.maxTokens]} min={128} max={8192} step={128} onValueChange={([v]) => setOverrides(o => ({ ...o, maxTokens: v }))} className="mt-2" /></div>
                    <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Buffer/Debounce</label><div className="flex items-center gap-2 mt-1"><Switch checked={bufferMode} onCheckedChange={setBufferMode} /><span className="text-xs">{bufferMode ? `${bufferSec}s` : 'Off'}</span>{bufferMode && <Slider value={[bufferSec]} min={3} max={30} step={1} onValueChange={([v]) => setBufferSec(v)} className="w-20" />}</div></div>
                  </div>
                  <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Tools ativas</label>
                    <div className="flex flex-wrap gap-1.5">{ALL_TOOLS.map(name => { const meta = TOOL_META[name]; const Icon = meta.icon; const disabled = overrides.disabledTools.has(name); return (
                      <button key={name} onClick={() => setOverrides(o => { const s = new Set(o.disabledTools); disabled ? s.delete(name) : s.add(name); return { ...o, disabledTools: s }; })} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-all ${disabled ? 'opacity-30 line-through border-border' : meta.color}`}><Icon className="w-3 h-3" />{meta.label}</button>
                    ); })}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats bar */}
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0 px-1 mb-2">
              <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]"><Bot className="w-3 h-3" />{selectedAgent?.name}</Badge>
              <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Zap className="w-3 h-3" />{overrides.model}</Badge>
              {totalTokens.input + totalTokens.output > 0 && (
                <>
                  <Badge variant="outline" className="px-2 py-0.5 text-[11px]">{(totalTokens.input + totalTokens.output).toLocaleString()} tok</Badge>
                  {avgLatency > 0 && <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Clock className="w-3 h-3" />{avgLatency}ms</Badge>}
                </>
              )}
            </div>

            {/* Chat */}
            <div className="flex-1 border border-border/50 rounded-2xl bg-card/50 overflow-hidden flex flex-col min-h-0">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-muted-foreground p-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center">
                    <Bot className="w-10 h-10 text-primary/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground mb-1">Teste o agente em tempo real</p>
                    <p className="text-sm text-muted-foreground">Envie uma mensagem ou escolha um perfil abaixo</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {PERSONAS.map(p => (
                      <button key={p.name} onClick={() => runPersona(p)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border/50 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all">
                        <UserCircle className="w-3.5 h-3.5" />{p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : renderChatMessages()}
              {renderInputBar()}
            </div>
          </TabsContent>

          {/* ══════ Tab: Cenarios ══════ */}
          <TabsContent value="scenarios" className="flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-3 flex-1 min-h-0">

              {/* Left: Gallery */}
              <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border/50 space-y-2">
                  <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input value={scenarioSearch} onChange={e => setScenarioSearch(e.target.value)} placeholder="Buscar cenario..." className="h-8 text-xs pl-8" /></div>
                  <Select value={selectedCategory} onValueChange={v => setSelectedCategory(v as any)}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {(Object.entries(CATEGORY_META) as [ScenarioCategory, typeof CATEGORY_META[ScenarioCategory]][]).map(([key, meta]) => {
                        const count = TEST_SCENARIOS.filter(s => s.category === key).length;
                        if (count === 0) return null;
                        const Icon = meta.icon;
                        return <SelectItem key={key} value={key}><span className="flex items-center gap-1.5"><Icon className="w-3 h-3" />{meta.label} ({count})</span></SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {filteredScenarios.map(scenario => {
                      const catMeta = CATEGORY_META[scenario.category];
                      const isSelected = selectedScenario?.id === scenario.id;
                      return (
                        <button key={scenario.id} onClick={() => { setSelectedScenario(scenario); setMessages([]); setScenarioRun(null); }}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-primary/40 bg-primary/5 shadow-md' : 'border-border/30 hover:bg-accent/50 hover:border-border/60'}`}>
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl leading-none mt-0.5">{catMeta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-sm font-semibold truncate flex-1">{scenario.name}</span>
                                <Badge className={`text-[9px] px-1.5 py-0.5 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{scenario.difficulty}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{scenario.description}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{scenario.steps.length} steps</span>
                                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{scenario.expected.tools_must_use.length} tools</span>
                                {scenario.expected.should_handoff && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-red-500/20 text-red-400">handoff</Badge>}
                                {scenario.expected.should_block && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/20 text-amber-400">guardrail</Badge>}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredScenarios.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum cenario encontrado</p>}
                  </div>
                </ScrollArea>
              </div>

              {/* Center: Chat + Watch Controls */}
              <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden min-h-0">
                {/* Progress bar */}
                {scenarioRun && scenarioRun.status !== 'idle' && (
                  <div className="px-3 pt-2 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-muted-foreground">Step {Math.min(scenarioRun.current_step + 1, scenarioRun.total_steps)}/{scenarioRun.total_steps}</span>
                      <div className="flex-1"><Progress value={(scenarioRun.current_step / scenarioRun.total_steps) * 100} className="h-1.5" /></div>
                      <Badge variant={scenarioRun.status === 'done' ? (scenarioRun.results?.pass ? 'default' : 'destructive') : 'secondary'} className="text-[9px] px-1.5">
                        {scenarioRun.status === 'done' ? (scenarioRun.results?.pass ? 'PASS' : 'FAIL') : scenarioRun.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                )}

                {!selectedScenario ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/10 flex items-center justify-center">
                      <Layers className="w-10 h-10 text-violet-400/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground mb-1">Selecione um cenario</p>
                      <p className="text-sm">Escolha um cenario na galeria para executar o teste automatizado</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {renderChatMessages()}
                    {/* Watch controls */}
                    <div className="border-t border-border/50 p-2 flex items-center gap-2 flex-shrink-0">
                      {!scenarioRun || scenarioRun.status === 'done' || scenarioRun.status === 'error' ? (
                        <Button size="sm" className="gap-1.5 text-xs" onClick={() => runScenario(selectedScenario)} disabled={sending}>
                          <Play className="w-3.5 h-3.5" /> Executar
                        </Button>
                      ) : scenarioRun.status === 'paused' ? (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={resumeScenario}><Play className="w-3.5 h-3.5" /> Continuar</Button>
                          <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={stopScenario}><Square className="w-3.5 h-3.5" /> Parar</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={pauseScenario}><Pause className="w-3.5 h-3.5" /> Pausar</Button>
                          <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={stopScenario}><Square className="w-3.5 h-3.5" /> Parar</Button>
                        </>
                      )}
                      <div className="flex-1" />
                      <span className="text-[10px] text-muted-foreground">Velocidade:</span>
                      <Select value={String(watchSpeed)} onValueChange={v => setWatchSpeed(Number(v) as WatchSpeed)}>
                        <SelectTrigger className="w-[70px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{[0.5, 1, 1.5, 2, 3].map(s => <SelectItem key={s} value={String(s)}>{s}x</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Execution Panel */}
              <div className="border border-border/50 rounded-xl bg-card/50 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {selectedScenario ? (
                      <>
                        {/* Scenario info */}
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${CATEGORY_META[selectedScenario.category].gradient} border border-border/30`}>
                          <div className="flex items-start gap-3 mb-2">
                            <span className="text-3xl">{CATEGORY_META[selectedScenario.category].emoji}</span>
                            <div className="flex-1">
                              <span className="text-sm font-bold block">{selectedScenario.name}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{selectedScenario.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-[10px] px-2 py-0.5 ${DIFFICULTY_COLORS[selectedScenario.difficulty]}`}>{selectedScenario.difficulty}</Badge>
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">{selectedScenario.steps.length} steps</Badge>
                          </div>
                        </div>

                        {/* Steps */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><ListChecks className="w-3 h-3" />Steps</p>
                          <div className="space-y-1">
                            {selectedScenario.steps.map((step, i) => {
                              const isDone = scenarioRun && i < scenarioRun.current_step;
                              const isActive = scenarioRun && i === scenarioRun.current_step && scenarioRun.status === 'running';
                              return (
                                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] border transition-all ${isActive ? 'border-primary/40 bg-primary/5 animate-pulse' : isDone ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-transparent'}`}>
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    {isDone ? <Check className="w-2.5 h-2.5" /> : <span className="text-[8px]">{i + 1}</span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate">{step.content}</p>
                                    {step.media_type === 'audio' && <Badge variant="outline" className="text-[8px] px-1 mt-0.5">audio</Badge>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Expected outcomes */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Eye className="w-3 h-3" />Esperado</p>
                          <div className="space-y-1 text-[11px]">
                            {selectedScenario.expected.tools_must_use.map(tool => {
                              const used = scenarioRun?.results?.tools_used.includes(tool);
                              const meta = TOOL_META[tool];
                              const Icon = meta?.icon || Wrench;
                              return (
                                <div key={tool} className="flex items-center gap-1.5">
                                  {scenarioRun?.results ? (used ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                                  <Icon className="w-3 h-3" /><span>{meta?.label || tool}</span>
                                </div>
                              );
                            })}
                            {selectedScenario.expected.should_handoff && (
                              <div className="flex items-center gap-1.5">
                                {scenarioRun?.results ? (scenarioRun.results.handoff_occurred ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                                <PhoneForwarded className="w-3 h-3" /><span>Handoff</span>
                              </div>
                            )}
                            {selectedScenario.expected.should_block && (
                              <div className="flex items-center gap-1.5">
                                {scenarioRun?.results ? (scenarioRun.results.blocked_occurred ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />) : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                                <Shield className="w-3 h-3" /><span>Bloqueio (guardrail)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Results */}
                        {scenarioRun?.results && (
                          <div className="border-t border-border/50 pt-3">
                            <div className={`p-3 rounded-lg border ${scenarioRun.results.pass ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                              <p className={`text-sm font-bold ${scenarioRun.results.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                                {scenarioRun.results.pass ? 'PASSOU' : 'FALHOU'}
                              </p>
                              <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                                <p>Tools usadas: {scenarioRun.results.tools_used.join(', ') || 'nenhuma'}</p>
                                {scenarioRun.results.tools_missing.length > 0 && <p className="text-red-400">Faltaram: {scenarioRun.results.tools_missing.join(', ')}</p>}
                                {scenarioRun.results.tools_unexpected.length > 0 && <p className="text-amber-400">Inesperadas: {scenarioRun.results.tools_unexpected.join(', ')}</p>}
                                <p>Tokens: {scenarioRun.results.total_tokens.input + scenarioRun.results.total_tokens.output}</p>
                                <p>Latencia: {scenarioRun.results.total_latency_ms}ms</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-10 text-muted-foreground">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-3">
                          <Eye className="w-8 h-8 text-primary/30" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Detalhes do cenario</p>
                        <p className="text-xs">Selecione um cenario na galeria</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* ══════ Tab: Resultados ══════ */}
          <TabsContent value="results" className="flex-1 min-h-0">
            <div className="border border-border/50 rounded-xl bg-card/50 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Summary stats */}
              {runHistory.length > 0 && (
                <div className="p-3 border-b border-border/50 flex items-center gap-4 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">{runHistory.length} runs</Badge>
                  <Badge variant="outline" className="text-xs text-emerald-400">{runHistory.filter(r => r.results?.pass).length} passed</Badge>
                  <Badge variant="outline" className="text-xs text-red-400">{runHistory.filter(r => r.results && !r.results.pass).length} failed</Badge>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setRunHistory([])}>Limpar</Button>
                </div>
              )}
              <ScrollArea className="flex-1">
                {runHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/10 flex items-center justify-center">
                      <BarChart3 className="w-10 h-10 text-blue-400/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground mb-1">Nenhum teste executado ainda</p>
                      <p className="text-sm">Execute cenarios na aba "Cenarios" para ver resultados aqui</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {runHistory.map(run => {
                      const catMeta = CATEGORY_META[run.category];
                      const CatIcon = catMeta.icon;
                      return (
                        <Collapsible key={run.id}>
                          <CollapsibleTrigger className="w-full text-left">
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
                              <Badge className={`text-[9px] px-1.5 ${run.results?.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {run.results?.pass ? 'PASS' : 'FAIL'}
                              </Badge>
                              <CatIcon className={`w-3.5 h-3.5 ${catMeta.color.split(' ')[0]}`} />
                              <span className="text-xs font-medium flex-1 truncate">{run.scenario_name}</span>
                              <span className="text-[10px] text-muted-foreground">{run.results?.total_tokens ? `${run.results.total_tokens.input + run.results.total_tokens.output} tok` : ''}</span>
                              <span className="text-[10px] text-muted-foreground">{run.results?.total_latency_ms ? `${run.results.total_latency_ms}ms` : ''}</span>
                              <span className="text-[10px] text-muted-foreground">{run.started_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 mt-1 p-3 rounded-lg border border-border/30 bg-muted/30 space-y-2 text-[11px]">
                              <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-muted-foreground">Tools usadas:</span> {run.results?.tools_used.join(', ') || 'nenhuma'}</div>
                                <div><span className="text-muted-foreground">Tools esperadas:</span> {run.results?.tools_expected.join(', ') || 'nenhuma'}</div>
                                {run.results?.tools_missing.length ? <div className="text-red-400">Faltaram: {run.results.tools_missing.join(', ')}</div> : null}
                                {run.results?.tools_unexpected.length ? <div className="text-amber-400">Inesperadas: {run.results.tools_unexpected.join(', ')}</div> : null}
                              </div>
                              <div className="text-muted-foreground">Handoff: {run.results?.handoff_occurred ? 'Sim' : 'Nao'} | Bloqueio: {run.results?.blocked_occurred ? 'Sim' : 'Nao'}</div>
                              <div className="text-muted-foreground">{run.messages.length} mensagens | {run.total_steps} steps</div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ══════ Tab: E2E Real ══════ */}
          <TabsContent value="e2e" className="flex-1 min-h-0">
            {/* Config bar */}
            <div className="flex items-center gap-3 flex-wrap mb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Numero:</span>
                <Input value={e2eNumber} onChange={e => setE2eNumber(e.target.value)} className="w-[170px] h-8 text-sm font-mono" placeholder="5581999999999" />
              </div>
              <Badge variant="outline" className="text-xs gap-1"><Bot className="w-3 h-3" />{selectedAgent?.name}</Badge>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-[11px]">Mensagens REAIS via WhatsApp + Gemini</span>
              </div>
              {e2eResults.length > 0 && (
                <>
                  <div className="flex-1" />
                  <Badge variant="secondary" className="text-xs">{e2eResults.length} runs</Badge>
                  <Badge variant="outline" className="text-xs text-emerald-400">{e2eResults.filter(r => r.pass).length} pass</Badge>
                  <Badge variant="outline" className="text-xs text-red-400">{e2eResults.filter(r => !r.pass).length} fail</Badge>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setE2eResults([])}>Limpar</Button>
                </>
              )}
            </div>

            {/* 2-column layout: scenarios (left) + live execution (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-3 flex-1 min-h-0">

              {/* Left: Scenario gallery */}
              <div className="border border-border/50 rounded-xl bg-card/50 overflow-hidden flex flex-col min-h-0">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {(Object.entries(CATEGORY_META) as [ScenarioCategory, typeof CATEGORY_META[ScenarioCategory]][]).map(([catKey, catMeta]) => {
                      const catScenarios = TEST_SCENARIOS.filter(s => s.category === catKey);
                      if (catScenarios.length === 0) return null;
                      return (
                        <div key={catKey}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{catMeta.emoji}</span>
                            <span className="text-sm font-semibold">{catMeta.label}</span>
                            <Badge variant="outline" className="text-[9px]">{catScenarios.length}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {catScenarios.map(scenario => {
                              const isRunning = e2eCurrentScenario === scenario.id;
                              const result = e2eResults.find(r => r.scenario_id === scenario.id);
                              return (
                                <button key={scenario.id} onClick={() => { setE2eSelectedScenario(scenario); if (!e2eRunning) setE2eLiveSteps([]); }}
                                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${isRunning ? 'border-amber-500/50 bg-amber-500/5 animate-pulse' : e2eSelectedScenario?.id === scenario.id ? 'border-primary/40 bg-primary/5' : result ? (result.pass ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5') : 'border-border/30 hover:bg-accent/50'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium flex-1 truncate">{scenario.name}</span>
                                    {result && <Badge className={`text-[8px] px-1 ${result.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{result.pass ? 'PASS' : 'FAIL'}</Badge>}
                                    <Badge className={`text-[8px] px-1 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{scenario.difficulty}</Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{scenario.steps.length} steps · {scenario.description}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: Live execution panel */}
              <div className="border border-border/50 rounded-xl bg-card/50 overflow-hidden flex flex-col min-h-0">
                {e2eSelectedScenario ? (
                  <>
                    {/* Scenario header */}
                    <div className={`p-3 border-b border-border/50 flex-shrink-0 bg-gradient-to-r ${CATEGORY_META[e2eSelectedScenario.category].gradient}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{CATEGORY_META[e2eSelectedScenario.category].emoji}</span>
                        <span className="text-sm font-bold flex-1">{e2eSelectedScenario.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{e2eSelectedScenario.description}</p>
                      <Button size="sm" className="gap-1.5 w-full" disabled={e2eRunning} onClick={() => runE2eScenario(e2eSelectedScenario)}>
                        {e2eRunning && e2eCurrentScenario === e2eSelectedScenario.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Executando...</> : <><Zap className="w-3.5 h-3.5" />Executar E2E Real</>}
                      </Button>
                    </div>

                    {/* Live steps */}
                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-2">
                        {e2eLiveSteps.length > 0 ? e2eLiveSteps.map((step, i) => (
                          <div key={i} className={`p-3 rounded-lg border transition-all ${step.status === 'sending' ? 'border-amber-500/40 bg-amber-500/5 animate-pulse' : step.status === 'done' ? 'border-border/30 bg-card' : step.status === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-border/20 bg-muted/20 opacity-50'}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : step.status === 'sending' ? 'bg-amber-500/20 text-amber-400' : step.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                                {step.status === 'done' ? '✓' : step.status === 'sending' ? '⋯' : step.status === 'error' ? '✗' : i + 1}
                              </div>
                              <span className="text-xs font-medium">Step {step.step || i + 1}</span>
                              {step.latency_ms > 0 && <span className="text-[10px] text-muted-foreground">{step.latency_ms}ms</span>}
                              {step.tools_used?.length > 0 && step.tools_used.map((t: string) => <Badge key={t} variant="outline" className="text-[8px] px-1">{t}</Badge>)}
                            </div>
                            <div className="space-y-1 text-[13px]">
                              <p><span className="text-emerald-400 font-medium">Lead:</span> {step.input}</p>
                              {step.agent_response && <p><span className="text-primary font-medium">Agente:</span> {step.agent_response}</p>}
                              {step.status === 'sending' && <p className="text-amber-400 text-xs animate-pulse">Enviando via WhatsApp...</p>}
                            </div>
                            {step.tags?.length > 0 && <div className="flex gap-1 mt-1.5 flex-wrap">{step.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}</div>}
                          </div>
                        )) : (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground mb-2">Steps do cenario:</p>
                            {e2eSelectedScenario.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-border/20 bg-muted/10">
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</div>
                                <div>
                                  <p className="text-sm">{step.content}</p>
                                  {step.media_type === 'audio' && <Badge variant="outline" className="text-[8px] mt-0.5">audio</Badge>}
                                </div>
                              </div>
                            ))}
                            <div className="mt-2 text-xs text-muted-foreground">
                              <p>Tools esperadas: {e2eSelectedScenario.expected.tools_must_use.join(', ') || 'nenhuma'}</p>
                              {e2eSelectedScenario.expected.should_handoff && <p className="text-pink-400">Handoff esperado</p>}
                              {e2eSelectedScenario.expected.should_block && <p className="text-red-400">Bloqueio esperado (guardrail)</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-amber-400/40" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Selecione um cenario</p>
                    <p className="text-xs text-center">Clique em um cenario na galeria para ver os steps e executar o teste E2E real</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default AIAgentPlayground;
