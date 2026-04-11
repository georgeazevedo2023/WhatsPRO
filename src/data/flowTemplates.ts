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
