// M16: Funnels — tipos, interfaces e defaults por tipo de funil

export type FunnelType = 'sorteio' | 'captacao' | 'venda' | 'vaga' | 'lancamento' | 'evento' | 'atendimento';
export type FunnelStatus = 'active' | 'paused' | 'archived';

export interface Funnel {
  id: string;
  instance_id: string;
  created_by: string | null;
  name: string;
  slug: string;
  description: string | null;
  type: FunnelType;
  status: FunnelStatus;
  icon: string | null;
  campaign_id: string | null;
  bio_page_id: string | null;
  form_id: string | null;
  kanban_board_id: string | null;
  ai_template: string | null;
  ai_custom_text: string | null;
  handoff_message: string | null;
  handoff_message_outside_hours: string | null;
  handoff_department: string | null;
  max_messages_before_handoff: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FunnelWithMetrics extends Funnel {
  lead_count: number;
  conversion_rate: number;
  campaign_name?: string;
  bio_page_title?: string;
  form_name?: string;
}

export interface CreateFunnelInput {
  instance_id: string;
  name: string;
  slug: string;
  description?: string;
  type: FunnelType;
  icon?: string;
  campaign_id?: string;
  bio_page_id?: string;
  form_id?: string;
  kanban_board_id?: string;
  ai_template?: string;
  ai_custom_text?: string;
  handoff_message?: string;
  handoff_message_outside_hours?: string;
  handoff_department?: string;
  max_messages_before_handoff?: number;
  settings?: Record<string, unknown>;
}

// Configuracao de cada tipo de funil
export interface FunnelTypeConfig {
  type: FunnelType;
  label: string;
  icon: string;
  description: string;
  color: string;
  needsCampaign: boolean;
  needsBioPage: boolean;
  needsForm: boolean;
  formTemplate: string | null;
  kanbanColumns: string[];
  defaultAiTemplate: string;
}

export const FUNNEL_TYPE_CONFIGS: Record<FunnelType, FunnelTypeConfig> = {
  sorteio: {
    type: 'sorteio',
    label: 'Sorteio',
    icon: '🎁',
    description: 'Sorteio ou giveaway com inscricao e regulamento',
    color: 'rose',
    needsCampaign: true,
    needsBioPage: true,
    needsForm: true,
    formTemplate: 'sorteio',
    kanbanColumns: ['Inscrito', 'Confirmado', 'Sorteado', 'Entregue'],
    defaultAiTemplate: 'Lead participou do sorteio "{funnel_name}". Confirme inscricao, explique regras. NAO tente vender.',
  },
  captacao: {
    type: 'captacao',
    label: 'Captacao',
    icon: '🎯',
    description: 'Captar leads organicamente via Bio Link ou redes sociais',
    color: 'emerald',
    needsCampaign: false,
    needsBioPage: true,
    needsForm: false,
    formTemplate: null,
    kanbanColumns: ['Novo', 'Qualificado', 'Em Contato'],
    defaultAiTemplate: 'Lead veio da pagina "{funnel_name}". Qualifique e colete dados.',
  },
  venda: {
    type: 'venda',
    label: 'Venda',
    icon: '🛒',
    description: 'Funil de vendas com qualificacao e proposta',
    color: 'blue',
    needsCampaign: true,
    needsBioPage: true,
    needsForm: false,
    formTemplate: null,
    kanbanColumns: ['Novo', 'Interesse', 'Proposta', 'Negociacao', 'Fechado'],
    defaultAiTemplate: 'Lead interessado em compra via funil "{funnel_name}". Fluxo SDR completo: qualifique, busque produtos, envie carousel.',
  },
  vaga: {
    type: 'vaga',
    label: 'Vaga de Emprego',
    icon: '💼',
    description: 'Receber candidaturas com formulario e triagem',
    color: 'violet',
    needsCampaign: false,
    needsBioPage: true,
    needsForm: true,
    formTemplate: 'vaga',
    kanbanColumns: ['Candidato', 'Entrevista', 'Avaliacao', 'Aprovado'],
    defaultAiTemplate: 'Lead se candidatou via funil "{funnel_name}". Confirme candidatura e explique proximos passos do processo seletivo.',
  },
  lancamento: {
    type: 'lancamento',
    label: 'Lancamento',
    icon: '🚀',
    description: 'Lancamento de produto com lista VIP e pre-venda',
    color: 'amber',
    needsCampaign: true,
    needsBioPage: true,
    needsForm: true,
    formTemplate: 'cadastro',
    kanbanColumns: ['Interessado', 'Lista VIP', 'Pre-venda', 'Comprou'],
    defaultAiTemplate: 'Lead entrou na lista VIP do lancamento "{funnel_name}". Crie expectativa e avise quando abrir pre-venda.',
  },
  evento: {
    type: 'evento',
    label: 'Evento',
    icon: '🎫',
    description: 'Inscricao em evento com confirmacao e follow-up',
    color: 'cyan',
    needsCampaign: true,
    needsBioPage: true,
    needsForm: true,
    formTemplate: 'evento',
    kanbanColumns: ['Inscrito', 'Confirmado', 'Presente', 'Follow-up'],
    defaultAiTemplate: 'Lead se inscreveu no evento "{funnel_name}". Confirme inscricao e envie detalhes.',
  },
  atendimento: {
    type: 'atendimento',
    label: 'Atendimento',
    icon: '🎧',
    description: 'Triagem por formulario no WhatsApp antes de atender',
    color: 'slate',
    needsCampaign: false,
    needsBioPage: false,
    needsForm: true,
    formTemplate: 'chamado',
    kanbanColumns: ['Triagem', 'Em Atendimento', 'Resolvido'],
    defaultAiTemplate: 'Lead esta em triagem via funil "{funnel_name}". Inicie FORM:{form_slug} no primeiro contato.',
  },
};

// Gerar slug a partir do nome
export function generateFunnelSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

// Status labels e cores
export const FUNNEL_STATUS_CONFIG: Record<FunnelStatus, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-600' },
  paused: { label: 'Pausado', color: 'bg-amber-500/10 text-amber-600' },
  archived: { label: 'Arquivado', color: 'bg-slate-500/10 text-slate-500' },
};
