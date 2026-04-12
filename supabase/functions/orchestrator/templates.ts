// =============================================================================
// Flow Templates (S10)
// 4 templates MVP instaláveis com 1 clique.
// Cada template define steps (subagent_type + config + exit_rules) e triggers.
//
// Templates:
//   T1 — Vitrine de Produtos (greeting → sales → survey NPS → handoff)
//   T2 — SDR BANT            (greeting → qualification BANT → handoff)
//   T3 — Suporte Técnico     (greeting → support → survey NPS → handoff)
//   T4 — Pós-Venda           (greeting → survey NPS + aberta → followup 7d)
// =============================================================================

// ── Tipos de Template ───────────────────────────────────────────────────────

export interface FlowTemplateStep {
  subagent_type: string
  position: number
  step_config: Record<string, unknown>
  exit_rules: {
    trigger: string
    value?: number | string
    message?: string
    action: string
  }[]
  is_active: boolean
}

export interface FlowTemplateTrigger {
  trigger_type: string
  trigger_config: Record<string, unknown>
  priority: number
  is_active: boolean
}

export interface FlowTemplate {
  id: string
  name: string
  description: string
  slug: string
  steps: FlowTemplateStep[]
  triggers: FlowTemplateTrigger[]
}

// ── T1: Vitrine de Produtos ─────────────────────────────────────────────────

const VITRINE: FlowTemplate = {
  id: 'vitrine',
  name: 'Vitrine de Produtos',
  description: 'Atendimento automatico com catalogo de produtos, busca inteligente e pesquisa NPS ao final.',
  slug: 'vitrine-de-produtos',
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
        {
          trigger: 'search_fail',
          value: 3,
          message: 'Vou transferir para um atendente que pode ajudar melhor.',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
    {
      subagent_type: 'survey',
      position: 2,
      step_config: {
        questions: [
          {
            key: 'nps',
            label: 'De 0 a 10, como foi o atendimento?',
            type: 'scale_1_10',
            required: true,
            is_nps: true,
          },
        ],
      },
      exit_rules: [
        { trigger: 'all_answered', action: 'next_step' },
      ],
      is_active: true,
    },
    {
      subagent_type: 'handoff',
      position: 3,
      step_config: {
        briefing_depth: 'standard',
      },
      exit_rules: [
        {
          trigger: 'immediate',
          message: 'Transferindo para um atendente. Obrigado!',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
  ],
}

// ── T2: SDR BANT ────────────────────────────────────────────────────────────

const SDR_BANT: FlowTemplate = {
  id: 'sdr_bant',
  name: 'SDR BANT',
  description: 'Qualificacao de leads com metodologia BANT (Budget, Authority, Need, Timeline) e handoff para vendedor.',
  slug: 'sdr-bant',
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
          { key: 'orcamento', label: 'Qual seu orcamento?', type: 'currency_brl', required: true },
          {
            key: 'prazo',
            label: 'Quando pretende comprar?',
            type: 'select',
            required: true,
            options: ['Este mes', 'Proximo trimestre', 'Sem prazo'],
          },
        ],
        required_count: 4,
        fallback_retries: 2,
      },
      exit_rules: [
        { trigger: 'qualification_complete', action: 'next_step' },
        {
          trigger: 'max_messages',
          value: 10,
          message: 'Vou transferir para nosso time de vendas que pode dar mais detalhes.',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
    {
      subagent_type: 'handoff',
      position: 2,
      step_config: {
        briefing_depth: 'full',
      },
      exit_rules: [
        {
          trigger: 'immediate',
          message: 'Perfeito! Estou transferindo para um especialista que vai te ajudar. Ate ja!',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
  ],
}

// ── T3: Suporte Técnico ─────────────────────────────────────────────────────

const SUPORTE: FlowTemplate = {
  id: 'suporte',
  name: 'Suporte Tecnico',
  description: 'Atendimento de suporte com base de conhecimento, handoff automatico e pesquisa NPS.',
  slug: 'suporte-tecnico',
  triggers: [
    {
      trigger_type: 'intent',
      trigger_config: {
        intents: ['suporte', 'reclamacao'],
        min_confidence: 70,
      },
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
        {
          trigger: 'unanswered',
          value: 2,
          message: 'Vou transferir para um especialista que pode resolver isso.',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
    {
      subagent_type: 'survey',
      position: 2,
      step_config: {
        questions: [
          {
            key: 'nps',
            label: 'De 0 a 10, como foi o atendimento de suporte?',
            type: 'scale_1_10',
            required: true,
            is_nps: true,
          },
        ],
      },
      exit_rules: [
        { trigger: 'all_answered', action: 'next_step' },
      ],
      is_active: true,
    },
    {
      subagent_type: 'handoff',
      position: 3,
      step_config: {
        briefing_depth: 'standard',
      },
      exit_rules: [
        {
          trigger: 'immediate',
          message: 'Transferindo para um atendente. Obrigado pela paciencia!',
          action: 'handoff_human',
        },
      ],
      is_active: true,
    },
  ],
}

// ── T4: Pós-Venda ───────────────────────────────────────────────────────────

const POS_VENDA: FlowTemplate = {
  id: 'pos_venda',
  name: 'Pos-Venda',
  description: 'Pesquisa de satisfacao pos-compra com NPS, pergunta aberta e follow-up automatico em 7 dias.',
  slug: 'pos-venda',
  triggers: [
    {
      trigger_type: 'tag_added',
      trigger_config: {
        tag: 'etapa:pos-venda',
      },
      priority: 15,
      is_active: true,
    },
  ],
  steps: [
    {
      subagent_type: 'greeting',
      position: 0,
      step_config: {
        greeting_message: 'Ola, {name}! Obrigado pela sua compra. Queremos saber como foi sua experiencia!',
        known_lead_message: 'Ola, {name}! Obrigado pela sua compra. Queremos saber como foi sua experiencia!',
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
            key: 'nps',
            label: 'De 0 a 10, qual a chance de voce recomendar nosso produto?',
            type: 'scale_1_10',
            required: true,
            is_nps: true,
          },
          {
            key: 'melhoria',
            label: 'O que podemos melhorar?',
            type: 'text',
            required: false,
          },
        ],
      },
      exit_rules: [
        { trigger: 'all_answered', action: 'next_step' },
      ],
      is_active: true,
    },
    {
      subagent_type: 'followup',
      position: 2,
      step_config: {
        delay_hours: 168,
        message_template: 'Oi {name}, tudo bem? Voltando para saber se esta tudo certo com sua compra!',
        max_escalations: 2,
        escalation_delays: [168, 336],
        post_action: 'complete',
      },
      exit_rules: [
        { trigger: 'followup_scheduled', action: 'complete' },
      ],
      is_active: true,
    },
  ],
}

// ── Export do array e lookup por id ──────────────────────────────────────────

export const FLOW_TEMPLATES: FlowTemplate[] = [
  VITRINE,
  SDR_BANT,
  SUPORTE,
  POS_VENDA,
]

/** Busca template por id. Retorna undefined se nao encontrado. */
export function getTemplateById(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id)
}

/** Busca template por slug. Retorna undefined se nao encontrado. */
export function getTemplateBySlug(slug: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.slug === slug)
}
