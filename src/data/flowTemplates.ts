import type { TriggerType } from '@/types/flows'

export interface FlowTemplate {
  id: string
  name: string
  description: string
  category: 'vendas' | 'captacao' | 'atendimento' | 'nicho'
  steps_preview: string[]
  triggers_preview: Array<{ type: TriggerType; label: string }>
  compatibility_warnings?: string[]
  icon: string
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'vitrine',
    name: 'Vitrine de Produtos',
    description: 'Apresenta produtos e captura leads com interesse direto',
    category: 'vendas',
    icon: '🛒',
    steps_preview: ['Saudação', 'Apresentação produtos', 'Captura de interesse', 'Qualificação rápida'],
    triggers_preview: [
      { type: 'keyword', label: '"catálogo", "produtos", "preço"' },
      { type: 'conversation_started', label: 'Nova conversa' },
    ],
  },
  {
    id: 'sdr-bant',
    name: 'SDR BANT',
    description: 'Qualifica leads com metodologia BANT e agenda demonstrações',
    category: 'vendas',
    icon: '🎯',
    steps_preview: ['Saudação', 'Qualificação BANT', 'Agendamento demo', 'Handoff vendedor'],
    triggers_preview: [
      { type: 'keyword', label: '"oi", "olá", "bom dia"' },
      { type: 'lead_created', label: 'Lead criado' },
    ],
  },
  {
    id: 'lancamento',
    name: 'Lançamento',
    description: 'Sequência de aquecimento e vendas para lançamentos',
    category: 'vendas',
    icon: '🎪',
    steps_preview: ['Boas-vindas VIP', 'Conteúdo aquecimento', 'Abertura carrinho', 'Urgência e fechamento'],
    triggers_preview: [
      { type: 'utm_campaign', label: 'UTM lançamento' },
      { type: 'bio_link', label: 'Bio Link' },
    ],
    compatibility_warnings: ['Requer campanha UTM configurada'],
  },
  {
    id: 'carrinho-abandonado',
    name: 'Carrinho Abandonado',
    description: 'Recupera leads que demonstraram interesse mas não converteram',
    category: 'vendas',
    icon: '🛍️',
    steps_preview: ['Reativação', 'Objeção contorno', 'Oferta especial', 'Fechamento'],
    triggers_preview: [
      { type: 'tag_added', label: 'Tag: carrinho-abandonado' },
    ],
  },
  {
    id: 'cardapio',
    name: 'Cardápio Digital',
    description: 'Atendimento para restaurantes e deliveries',
    category: 'nicho',
    icon: '🍽️',
    steps_preview: ['Saudação + Cardápio', 'Pedido', 'Confirmação', 'Status entrega'],
    triggers_preview: [
      { type: 'conversation_started', label: 'Nova conversa' },
      { type: 'keyword', label: '"pedido", "cardápio", "delivery"' },
    ],
  },
  {
    id: 'sorteio',
    name: 'Sorteio / Promoção',
    description: 'Captação massiva via sorteios e promoções',
    category: 'captacao',
    icon: '🎁',
    steps_preview: ['Registro', 'Confirmação participação', 'Indicações', 'Resultado'],
    triggers_preview: [
      { type: 'keyword', label: '"sorteio", "participo", "quero"' },
      { type: 'qr_code', label: 'QR Code da promoção' },
    ],
  },
  {
    id: 'evento',
    name: 'Evento / Webinar',
    description: 'Captação e nutrição de participantes de eventos',
    category: 'captacao',
    icon: '📅',
    steps_preview: ['Inscrição', 'Confirmação', 'Lembretes', 'Pós-evento'],
    triggers_preview: [
      { type: 'utm_campaign', label: 'UTM evento' },
      { type: 'bio_link', label: 'Bio Link evento' },
    ],
    compatibility_warnings: ['Requer bio page configurada'],
  },
  {
    id: 'suporte',
    name: 'Suporte Técnico',
    description: 'Triagem e resolução de chamados de suporte',
    category: 'atendimento',
    icon: '🔧',
    steps_preview: ['Triagem', 'FAQ automático', 'Diagnóstico', 'Handoff especialista'],
    triggers_preview: [
      { type: 'keyword', label: '"suporte", "problema", "ajuda"' },
      { type: 'tag_added', label: 'Tag: precisa-suporte' },
    ],
  },
  {
    id: 'agendamento',
    name: 'Agendamento',
    description: 'Agendamento de consultas, reuniões ou serviços',
    category: 'atendimento',
    icon: '📆',
    steps_preview: ['Coleta disponibilidade', 'Confirmação horário', 'Lembrete', 'Feedback pós-atendimento'],
    triggers_preview: [
      { type: 'keyword', label: '"agendar", "consulta", "reunião"' },
      { type: 'intent', label: 'Intent: agendamento' },
    ],
  },
  {
    id: 'pos-venda',
    name: 'Pós-venda',
    description: 'Onboarding e retenção de clientes após a compra',
    category: 'atendimento',
    icon: '⭐',
    steps_preview: ['Boas-vindas cliente', 'Tutorial produto', 'NPS 30 dias', 'Upsell'],
    triggers_preview: [
      { type: 'tag_added', label: 'Tag: cliente' },
      { type: 'funnel_entered', label: 'Funil pós-venda' },
    ],
  },
  {
    id: 'politica',
    name: 'Política / LGPD',
    description: 'Coleta de consentimento e gestão de opt-out',
    category: 'atendimento',
    icon: '🔒',
    steps_preview: ['Apresentação política', 'Coleta consentimento', 'Opt-out LGPD'],
    triggers_preview: [
      { type: 'keyword', label: '"cancelar", "sair", "remover"' },
    ],
  },
  {
    id: 'imobiliaria',
    name: 'Imobiliária',
    description: 'Qualificação de interessados em imóveis',
    category: 'nicho',
    icon: '🏠',
    steps_preview: ['Captação interesse', 'Qualificação perfil', 'Portfólio personalizado', 'Agendamento visita'],
    triggers_preview: [
      { type: 'keyword', label: '"imóvel", "comprar", "alugar"' },
      { type: 'utm_campaign', label: 'UTM imóveis' },
    ],
  },
]

export const TEMPLATE_CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'captacao', label: 'Captação' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'nicho', label: 'Nicho' },
]

// ── Tipos para instalação via RPC install_flow_template ──────────────────────

export interface FlowInstallStep {
  subagent_type: string
  position: number
  step_config: Record<string, unknown>
  exit_rules: Array<{
    trigger: string
    value?: number | string
    message?: string
    action: string
  }>
  is_active: boolean
}

export interface FlowInstallTrigger {
  trigger_type: string
  trigger_config: Record<string, unknown>
  priority: number
  is_active: boolean
}

export interface FlowInstallDefinition {
  template_id: string
  default_name: string
  default_slug: string
  description: string
  steps: FlowInstallStep[]
  triggers: FlowInstallTrigger[]
}

// ── 4 Templates MVP instaláveis com 1 clique ─────────────────────────────────

export const FLOW_INSTALL_DEFINITIONS: Record<string, FlowInstallDefinition> = {
  vitrine: {
    template_id: 'vitrine',
    default_name: 'Vitrine de Produtos',
    default_slug: 'vitrine-de-produtos',
    description: 'Atendimento automático com catálogo, busca inteligente e pesquisa NPS ao final.',
    triggers: [
      {
        trigger_type: 'message_received',
        trigger_config: {},
        priority: 10,
        is_active: true,
      },
    ],
    steps: [
      {
        subagent_type: 'greeting',
        position: 0,
        step_config: {
          greeting_message: 'Ola! Bem-vindo a nossa loja! Como posso ajudar?',
          collect_name: true,
          context_depth: 'minimal',
        },
        exit_rules: [
          { trigger: 'max_messages', value: 3, action: 'next_step' },
          { trigger: 'greeting_done', action: 'next_step' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'sales',
        position: 1,
        step_config: {
          recommendation_mode: 'smart',
          max_products_per_search: 5,
          max_search_failures: 3,
          enable_follow_up_llm: true,
          auto_tag_interest: true,
        },
        exit_rules: [
          { trigger: 'max_messages', value: 15, action: 'next_step' },
          { trigger: 'search_fail', value: 3, message: 'Vou transferir para um atendente.', action: 'handoff_human' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'survey',
        position: 2,
        step_config: {
          questions: [
            {
              text: 'De 0 a 10, como foi o atendimento?',
              options: ['0','1','2','3','4','5','6','7','8','9','10'],
              type: 'poll',
              is_nps: true,
            },
          ],
          completion_message: 'Obrigado pela avaliacao!',
          post_action: 'next_step',
        },
        exit_rules: [{ trigger: 'survey_complete', action: 'next_step' }],
        is_active: true,
      },
      {
        subagent_type: 'handoff',
        position: 3,
        step_config: { briefing_depth: 'standard' },
        exit_rules: [
          { trigger: 'immediate', message: 'Transferindo para um atendente. Obrigado!', action: 'handoff_human' },
        ],
        is_active: true,
      },
    ],
  },

  'sdr-bant': {
    template_id: 'sdr-bant',
    default_name: 'SDR BANT',
    default_slug: 'sdr-bant',
    description: 'Qualificação de leads BANT e handoff automático para vendedor.',
    triggers: [
      {
        trigger_type: 'message_received',
        trigger_config: {},
        priority: 10,
        is_active: true,
      },
    ],
    steps: [
      {
        subagent_type: 'greeting',
        position: 0,
        step_config: {
          greeting_message: 'Ola! Que bom que voce entrou em contato. Vou te ajudar!',
          collect_name: true,
          context_depth: 'minimal',
        },
        exit_rules: [
          { trigger: 'max_messages', value: 2, action: 'next_step' },
          { trigger: 'greeting_done', action: 'next_step' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'qualification',
        position: 1,
        step_config: {
          mode: 'fixed',
          smart_fill: true,
          questions: [
            { key: 'nome', label: 'Qual seu nome?', type: 'text', required: true },
            { key: 'empresa', label: 'Qual sua empresa?', type: 'text', required: true },
            { key: 'orcamento', label: 'Qual seu orcamento aproximado?', type: 'currency_brl', required: true },
            { key: 'prazo', label: 'Quando pretende comprar?', type: 'select', required: true,
              options: ['Este mes', 'Proximo trimestre', 'Sem prazo'] },
          ],
          required_count: 4,
          fallback_retries: 2,
        },
        exit_rules: [
          { trigger: 'qualification_complete', action: 'next_step' },
          { trigger: 'max_messages', value: 10, message: 'Vou chamar nosso time de vendas.', action: 'handoff_human' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'handoff',
        position: 2,
        step_config: { briefing_depth: 'full' },
        exit_rules: [
          { trigger: 'immediate', message: 'Perfeito! Transferindo para um especialista. Ate ja!', action: 'handoff_human' },
        ],
        is_active: true,
      },
    ],
  },

  suporte: {
    template_id: 'suporte',
    default_name: 'Suporte Técnico',
    default_slug: 'suporte-tecnico',
    description: 'Triagem com base de conhecimento, handoff automático e NPS.',
    triggers: [
      {
        trigger_type: 'intent',
        trigger_config: { intents: ['suporte', 'reclamacao'], min_confidence: 70 },
        priority: 20,
        is_active: true,
      },
    ],
    steps: [
      {
        subagent_type: 'greeting',
        position: 0,
        step_config: {
          greeting_message: 'Ola! Sou o assistente de suporte. Como posso ajudar?',
          collect_name: false,
          context_depth: 'minimal',
        },
        exit_rules: [
          { trigger: 'max_messages', value: 2, action: 'next_step' },
          { trigger: 'greeting_done', action: 'next_step' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'support',
        position: 1,
        step_config: {
          confidence_high: 0.80,
          confidence_medium: 0.50,
          max_unanswered: 2,
          enable_llm_formulation: true,
        },
        exit_rules: [
          { trigger: 'max_messages', value: 10, action: 'next_step' },
          { trigger: 'unanswered', value: 2, message: 'Vou transferir para um especialista.', action: 'handoff_human' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'survey',
        position: 2,
        step_config: {
          questions: [
            {
              text: 'De 0 a 10, como foi o suporte?',
              options: ['0','1','2','3','4','5','6','7','8','9','10'],
              type: 'poll',
              is_nps: true,
            },
          ],
          completion_message: 'Obrigado pela avaliacao!',
          post_action: 'next_step',
        },
        exit_rules: [{ trigger: 'survey_complete', action: 'next_step' }],
        is_active: true,
      },
      {
        subagent_type: 'handoff',
        position: 3,
        step_config: { briefing_depth: 'standard' },
        exit_rules: [
          { trigger: 'immediate', message: 'Transferindo para atendente. Obrigado pela paciencia!', action: 'handoff_human' },
        ],
        is_active: true,
      },
    ],
  },

  'pos-venda': {
    template_id: 'pos-venda',
    default_name: 'Pós-Venda',
    default_slug: 'pos-venda',
    description: 'NPS pós-compra, pergunta aberta e follow-up automático em 7 dias.',
    triggers: [
      {
        trigger_type: 'tag_added',
        trigger_config: { tag: 'etapa:pos-venda' },
        priority: 15,
        is_active: true,
      },
    ],
    steps: [
      {
        subagent_type: 'greeting',
        position: 0,
        step_config: {
          greeting_message: 'Ola! Obrigado pela sua compra. Queremos saber como foi sua experiencia!',
          known_lead_message: 'Ola, {name}! Obrigado pela sua compra. Como foi a experiencia?',
          collect_name: false,
          context_depth: 'minimal',
        },
        exit_rules: [
          { trigger: 'max_messages', value: 2, action: 'next_step' },
          { trigger: 'greeting_done', action: 'next_step' },
        ],
        is_active: true,
      },
      {
        subagent_type: 'survey',
        position: 1,
        step_config: {
          questions: [
            {
              text: 'De 0 a 10, qual a chance de nos recomendar?',
              options: ['0','1','2','3','4','5','6','7','8','9','10'],
              type: 'poll',
              is_nps: true,
            },
            {
              text: 'O que podemos melhorar?',
              options: [],
              type: 'text',
            },
          ],
          completion_message: 'Muito obrigado pelo feedback!',
          post_action: 'next_step',
        },
        exit_rules: [{ trigger: 'survey_complete', action: 'next_step' }],
        is_active: true,
      },
      {
        subagent_type: 'followup',
        position: 2,
        step_config: {
          delay_hours: 168,
          message_template: 'Oi {name}! Voltando para saber se esta tudo certo com sua compra. Podemos ajudar?',
          max_escalations: 2,
          escalation_delays: [168, 336],
          post_action: 'complete',
        },
        exit_rules: [{ trigger: 'followup_scheduled', action: 'complete' }],
        is_active: true,
      },
    ],
  },
}
