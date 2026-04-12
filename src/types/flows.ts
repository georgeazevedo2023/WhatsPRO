import type { Database } from '@/integrations/supabase/types'

export type Flow = Database['public']['Tables']['flows']['Row']
export type FlowInsert = Database['public']['Tables']['flows']['Insert']
export type FlowUpdate = Database['public']['Tables']['flows']['Update']
export type FlowTrigger = Database['public']['Tables']['flow_triggers']['Row']
export type FlowTriggerInsert = Database['public']['Tables']['flow_triggers']['Insert']
export type FlowTriggerUpdate = Database['public']['Tables']['flow_triggers']['Update']

// FlowStep (da tabela flow_steps — auto-generated em src/integrations/supabase/types.ts)
export type FlowStep = Database['public']['Tables']['flow_steps']['Row']
export type FlowStepInsert = Database['public']['Tables']['flow_steps']['Insert']
export type FlowStepUpdate = Database['public']['Tables']['flow_steps']['Update']

// Tipos válidos de subagente (8 tipos, conforme CHECK constraint do banco)
export type SubagentType =
  | 'greeting'
  | 'qualification'
  | 'sales'
  | 'support'
  | 'survey'
  | 'followup'
  | 'handoff'
  | 'custom'

export const SUBAGENT_TYPE_LABELS: Record<SubagentType, string> = {
  greeting:      'Saudação',
  qualification: 'Qualificação',
  sales:         'Vendas',
  support:       'Suporte',
  survey:        'Enquete',
  followup:      'Follow-up',
  handoff:       'Atendente Humano',
  custom:        'Personalizado',
}

export const SUBAGENT_TYPE_DESCRIPTIONS: Record<SubagentType, string> = {
  greeting:      'Coleta nome e saúda o lead na primeira mensagem',
  qualification: 'Faz perguntas e preenche dados do lead',
  sales:         'Apresenta produtos do catálogo com fotos',
  support:       'Responde dúvidas via base de conhecimento',
  survey:        'Coleta resposta via menu de opções UAZAPI',
  followup:      'Agenda mensagem automática após N horas',
  handoff:       'Transfere para atendente humano com briefing completo',
  custom:        'Lógica personalizada via step_config JSON',
}

export type FlowMode = 'active' | 'assistant' | 'shadow' | 'off'
export type FlowStatus = 'active' | 'paused' | 'archived'

export type TriggerType =
  | 'keyword'
  | 'intent'
  | 'message_received'
  | 'lead_created'
  | 'conversation_started'
  | 'bio_link'
  | 'utm_campaign'
  | 'qr_code'
  | 'tag_added'
  | 'poll_answered'
  | 'funnel_entered'
  | 'webhook_received'
  | 'schedule'
  | 'api'

export type TriggerActivation = 'always' | 'business_hours' | 'outside_hours' | 'custom'

// Tipo enriquecido para listagem
export interface FlowWithCounts extends Flow {
  trigger_count: number
  step_count: number
}

// Grupos de trigger_type para o formulário
export const TRIGGER_GROUPS: { label: string; types: TriggerType[] }[] = [
  {
    label: 'Mensagem',
    types: ['keyword', 'intent', 'message_received', 'conversation_started'],
  },
  {
    label: 'Entrada',
    types: ['lead_created', 'bio_link', 'utm_campaign', 'qr_code'],
  },
  {
    label: 'CRM',
    types: ['tag_added', 'poll_answered', 'funnel_entered'],
  },
  {
    label: 'Externo',
    types: ['webhook_received', 'schedule', 'api'],
  },
]

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  keyword: 'Palavra-chave',
  intent: 'Intenção detectada',
  message_received: 'Mensagem recebida',
  conversation_started: 'Nova conversa',
  lead_created: 'Lead criado',
  bio_link: 'Bio Link',
  utm_campaign: 'Campanha UTM',
  qr_code: 'QR Code',
  tag_added: 'Tag adicionada',
  poll_answered: 'Enquete respondida',
  funnel_entered: 'Entrou no funil',
  webhook_received: 'Webhook externo',
  schedule: 'Agendamento (cron)',
  api: 'API externa',
}

export const FLOW_MODE_LABELS: Record<FlowMode, string> = {
  active: 'IA Ativa',
  assistant: 'IA Assistente',
  shadow: 'Shadow',
  off: 'Desligado',
}
