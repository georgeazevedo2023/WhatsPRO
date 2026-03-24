import type { CampaignType } from '@/types';

export interface CampaignTemplate {
  type: CampaignType;
  label: string;
  description: string;
  template: string;
  icon: string; // lucide icon name
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    type: 'venda',
    label: 'Vendas',
    description: 'Campanha focada em conversao e vendas',
    template: 'Este lead veio por uma campanha de vendas. Apresente produtos, colete interesse e qualifique para transbordo ao vendedor. Foque em entender a necessidade e oferecer a melhor solucao.',
    icon: 'ShoppingBag',
  },
  {
    type: 'suporte',
    label: 'Suporte',
    description: 'Campanha de atendimento e suporte',
    template: 'Este lead veio por uma campanha de suporte. Identifique o problema rapidamente, seja empatico e encaminhe para o departamento correto se necessario.',
    icon: 'Headphones',
  },
  {
    type: 'promocao',
    label: 'Promocao',
    description: 'Campanha com oferta ou desconto',
    template: 'Este lead foi atraido por uma promocao. Destaque a oferta mencionada na campanha, crie senso de urgencia e facilite a conversao. Informe prazo e condicoes da promocao.',
    icon: 'Percent',
  },
  {
    type: 'evento',
    label: 'Evento',
    description: 'Campanha de evento, workshop ou lancamento',
    template: 'Este lead se interessou por um evento. Compartilhe detalhes (data, local, programacao), confirme participacao e envie lembretes. Seja entusiastico.',
    icon: 'Calendar',
  },
  {
    type: 'recall',
    label: 'Re-engajamento',
    description: 'Campanha para reativar clientes inativos',
    template: 'Este lead esta sendo re-engajado. Seja caloroso, mencione que sentimos falta dele, apresente novidades desde sua ultima visita e ofereca um incentivo para retornar.',
    icon: 'RefreshCw',
  },
  {
    type: 'fidelizacao',
    label: 'Fidelizacao',
    description: 'Campanha para clientes existentes',
    template: 'Este e um cliente existente em campanha de fidelizacao. Ofereca beneficios exclusivos, agradeca a preferencia, pergunte sobre experiencias anteriores e reforce o relacionamento.',
    icon: 'Heart',
  },
];

export const getCampaignTemplate = (type: CampaignType): CampaignTemplate | undefined =>
  CAMPAIGN_TEMPLATES.find(t => t.type === type);
