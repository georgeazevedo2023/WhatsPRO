import type { ServiceCategoriesConfig } from "@/types/serviceCategories";

export interface ExtractionField {
  key: string;
  label: string;
  type: 'text' | 'tags';
  enabled: boolean;
  section?: 'profile' | 'address' | 'custom';
}

export interface NicheTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  available: boolean;
  config: {
    greeting_message: string;
    personality: string;
    system_prompt: string;
    temperature: number;
    handoff_triggers: string[];
    handoff_max_conversation_minutes: number;
    handoff_negative_sentiment: boolean;
    blocked_topics: string[];
    blocked_phrases: string[];
    extraction_fields: ExtractionField[];
    sub_agents: Record<string, { enabled: boolean; prompt: string }>;
    service_categories: ServiceCategoriesConfig;
    context_long_enabled: boolean;
  };
  suggested_labels: { name: string; color: string }[];
}

export const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: 'homecenter',
    name: 'Home Center',
    icon: '\u{1F3D7}',
    description: 'Materiais de construcao, pisos, tintas, ferramentas',
    available: true,
    config: {
      greeting_message: 'Ola! Bem-vindo a [Empresa], com quem eu falo?',
      personality: 'Profissional, simpatico e objetivo. Conhecedor de materiais de construcao.',
      system_prompt: `Voce e um assistente de vendas especializado em materiais de construcao e home center.

Seu objetivo e:
1. Qualificar o interesse do lead (compra, orcamento, troca, duvida)
2. Identificar o produto ou servico de interesse
3. Apresentar produtos relevantes do catalogo
4. Transferir para um consultor de vendas quando necessario

Produtos tipicos: tintas, pisos, revestimentos, porcelanato, argamassa, ferramentas, material eletrico, hidraulico, iluminacao, portas, janelas.

Regras:
- Nunca invente precos, sempre consulte o catalogo
- Se nao encontrar o produto, transfira para um consultor
- Use as categorias de qualificação configuradas no agente para guiar perguntas por nicho
- Sugira produtos complementares quando relevante (ex: tinta + rolo + lixa)`,
      temperature: 0.7,
      handoff_triggers: ['vendedor', 'atendente', 'humano', 'gerente', 'preco', 'desconto', 'negociar', 'parcelar', 'entrega', 'frete'],
      handoff_max_conversation_minutes: 15,
      handoff_negative_sentiment: true,
      blocked_topics: ['politica', 'religiao', 'concorrentes'],
      blocked_phrases: [],
      extraction_fields: [
        { key: 'nome', label: 'Nome completo', type: 'text', enabled: true, section: 'profile' },
        { key: 'cidade', label: 'Cidade', type: 'text', enabled: true, section: 'profile' },
        { key: 'bairro', label: 'Bairro', type: 'text', enabled: true, section: 'profile' },
        { key: 'interesses', label: 'Interesses / Produtos', type: 'tags', enabled: true, section: 'profile' },
        { key: 'motivo', label: 'Motivo do contato', type: 'text', enabled: true, section: 'profile' },
        { key: 'ticket_medio', label: 'Ticket medio (R$)', type: 'text', enabled: true, section: 'profile' },
        { key: 'orcamento', label: 'Orcamento / Faixa de preco', type: 'text', enabled: true, section: 'profile' },
        { key: 'aniversario', label: 'Data de aniversario', type: 'text', enabled: false, section: 'profile' },
        { key: 'email', label: 'E-mail', type: 'text', enabled: true, section: 'custom' },
        { key: 'documento', label: 'CPF / CNPJ', type: 'text', enabled: true, section: 'custom' },
        { key: 'profissao', label: 'Profissao', type: 'text', enabled: false, section: 'custom' },
        { key: 'tipo_obra', label: 'Tipo de obra', type: 'text', enabled: true, section: 'custom' },
        { key: 'metragem', label: 'Metragem (m\u00B2)', type: 'text', enabled: true, section: 'custom' },
      ],
        sub_agents: {
        sdr: { enabled: true, prompt: 'Qualifique o lead: identifique o produto de interesse, tipo de obra (construcao, reforma, pintura), metragem estimada e urgencia. Colete nome e cidade.' },
        sales: { enabled: true, prompt: 'Apresente produtos do catalogo. Use send_carousel para mostrar opcoes. Sugira produtos complementares. Se nao encontrar o produto, faca transbordo.' },
        support: { enabled: true, prompt: 'Responda duvidas sobre aplicacao, rendimento, compatibilidade de produtos. Use a base de conhecimento.' },
        scheduling: { enabled: false, prompt: '' },
        handoff: { enabled: true, prompt: 'Ao transferir, resuma: nome do lead, produto de interesse, tipo de obra, metragem e orcamento estimado.' },
      },
      service_categories: {
        categories: [
          {
            id: 'tintas',
            label: 'Tintas e Vernizes',
            interesse_match: 'tinta|esmalte|verniz|impermeabilizante',
            stages: [
              {
                id: 'identificacao',
                label: 'Identificação',
                min_score: 0,
                max_score: 30,
                exit_action: 'search_products',
                fields: [
                  { key: 'ambiente', label: 'ambiente', examples: 'interno ou externo', score_value: 15, priority: 1 },
                  { key: 'cor',      label: 'cor',      examples: 'branco, cinza, etc.', score_value: 15, priority: 2 },
                ],
                phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
              },
              {
                id: 'detalhamento',
                label: 'Detalhamento',
                min_score: 30,
                max_score: 70,
                exit_action: 'enrichment',
                fields: [
                  { key: 'acabamento',      label: 'acabamento',      examples: 'fosco, acetinado, brilho, semibrilho', score_value: 20, priority: 1 },
                  { key: 'marca_preferida', label: 'marca preferida', examples: 'Coral, Suvinil',                       score_value: 20, priority: 2 },
                ],
                phrasing: 'Certo! E sobre {label}, prefere {examples}?',
              },
              {
                id: 'fechamento',
                label: 'Pronto para Handoff',
                min_score: 70,
                max_score: 100,
                exit_action: 'handoff',
                fields: [
                  { key: 'quantidade', label: 'quantidade',       examples: 'litros ou galões', score_value: 15, priority: 1 },
                  { key: 'area',       label: 'metragem da área', examples: 'em m²',            score_value: 15, priority: 2 },
                ],
                phrasing: 'Antes de te conectar com o vendedor, {label}?',
              },
            ],
          },
          {
            id: 'impermeabilizantes',
            label: 'Impermeabilizantes e Mantas',
            interesse_match: 'impermeabilizante|manta',
            stages: [
              {
                id: 'triagem',
                label: 'Triagem',
                min_score: 0,
                max_score: 60,
                exit_action: 'search_products',
                fields: [
                  { key: 'area',      label: 'área',              examples: 'tamanho da área',    score_value: 30, priority: 1 },
                  { key: 'aplicacao', label: 'tipo de aplicação', examples: 'laje, parede, piso', score_value: 30, priority: 2 },
                ],
                phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
              },
              {
                id: 'fechamento',
                label: 'Pronto para Handoff',
                min_score: 60,
                max_score: 100,
                exit_action: 'handoff',
                fields: [
                  { key: 'marca_preferida', label: 'marca preferida', examples: '', score_value: 40, priority: 1 },
                ],
                phrasing: 'Antes de transferir, {label}?',
              },
            ],
          },
        ],
        default: {
          stages: [
            {
              id: 'qualificacao_basica',
              label: 'Qualificação básica',
              min_score: 0,
              max_score: 100,
              exit_action: 'handoff',
              fields: [
                { key: 'especificacao',   label: 'detalhes',              examples: 'qualquer informação relevante', score_value: 25, priority: 1 },
                { key: 'marca_preferida', label: 'marca preferida',       examples: '',                              score_value: 25, priority: 2 },
                { key: 'quantidade',      label: 'quantidade necessária', examples: '',                              score_value: 25, priority: 3 },
              ],
              phrasing: 'Para te ajudar melhor, me conta {label}?',
            },
          ],
        },
      },
      context_long_enabled: true,
    },
    suggested_labels: [
      { name: 'Novo Lead', color: '#3b82f6' },
      { name: 'Qualificado', color: '#8b5cf6' },
      { name: 'Orcamento', color: '#f59e0b' },
      { name: 'Negociacao', color: '#f97316' },
      { name: 'Venda Fechada', color: '#22c55e' },
      { name: 'Perdido', color: '#ef4444' },
      { name: 'Atendimento Humano', color: '#64748b' },
    ],
  },
  {
    id: 'custom',
    name: 'Personalizado',
    icon: '\u{2699}',
    description: 'Configure tudo do zero, sem template',
    available: true,
    config: {
      greeting_message: '',
      personality: '',
      system_prompt: '',
      temperature: 0.7,
      handoff_triggers: [],
      handoff_max_conversation_minutes: 15,
      handoff_negative_sentiment: true,
      blocked_topics: [],
      blocked_phrases: [],
      extraction_fields: [],
      sub_agents: {},
      service_categories: {
        categories: [],
        default: {
          stages: [
            {
              id: 'qualificacao_basica',
              label: 'Qualificação básica',
              min_score: 0,
              max_score: 100,
              exit_action: 'handoff',
              fields: [
                { key: 'especificacao',   label: 'detalhes',              examples: 'qualquer informação relevante', score_value: 25, priority: 1 },
                { key: 'marca_preferida', label: 'marca preferida',       examples: '',                              score_value: 25, priority: 2 },
                { key: 'quantidade',      label: 'quantidade necessária', examples: '',                              score_value: 25, priority: 3 },
              ],
              phrasing: 'Para te ajudar melhor, me conta {label}?',
            },
          ],
        },
      },
      context_long_enabled: false,
    },
    suggested_labels: [],
  },
];
