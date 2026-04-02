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
- Pergunte sempre: tipo de produto, ambiente de uso, metragem/quantidade, acabamento preferido
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
    config: { greeting_message: '', personality: '', system_prompt: '', temperature: 0.7, handoff_triggers: [], handoff_max_conversation_minutes: 15, handoff_negative_sentiment: true, blocked_topics: [], blocked_phrases: [], extraction_fields: [], sub_agents: {}, context_long_enabled: false },
    suggested_labels: [],
  },
];
