// M16: Templates por tipo de funil — defaults para auto-criacao de recursos
// Cada template define colunas do kanban, campos do form, botoes da bio page

import type { FunnelType } from '@/types/funnels';

// ── Kanban Columns por tipo ─────────────────────────────────────────
export const FUNNEL_KANBAN_COLUMNS: Record<FunnelType, { name: string; color: string }[]> = {
  sorteio: [
    { name: 'Inscrito', color: '#10b981' },
    { name: 'Confirmado', color: '#3b82f6' },
    { name: 'Sorteado', color: '#f59e0b' },
    { name: 'Entregue', color: '#8b5cf6' },
  ],
  captacao: [
    { name: 'Novo', color: '#10b981' },
    { name: 'Qualificado', color: '#3b82f6' },
    { name: 'Em Contato', color: '#f59e0b' },
  ],
  venda: [
    { name: 'Novo', color: '#10b981' },
    { name: 'Interesse', color: '#3b82f6' },
    { name: 'Proposta', color: '#f59e0b' },
    { name: 'Negociacao', color: '#ec4899' },
    { name: 'Fechado', color: '#8b5cf6' },
  ],
  vaga: [
    { name: 'Candidato', color: '#10b981' },
    { name: 'Entrevista', color: '#3b82f6' },
    { name: 'Avaliacao', color: '#f59e0b' },
    { name: 'Aprovado', color: '#8b5cf6' },
  ],
  lancamento: [
    { name: 'Interessado', color: '#10b981' },
    { name: 'Lista VIP', color: '#3b82f6' },
    { name: 'Pre-venda', color: '#f59e0b' },
    { name: 'Comprou', color: '#8b5cf6' },
  ],
  evento: [
    { name: 'Inscrito', color: '#10b981' },
    { name: 'Confirmado', color: '#3b82f6' },
    { name: 'Presente', color: '#f59e0b' },
    { name: 'Follow-up', color: '#8b5cf6' },
  ],
  atendimento: [
    { name: 'Triagem', color: '#10b981' },
    { name: 'Em Atendimento', color: '#3b82f6' },
    { name: 'Resolvido', color: '#8b5cf6' },
  ],
};

// ── Bio Page defaults por tipo ──────────────────────────────────────
export interface BioPagesDefaults {
  template: 'simples' | 'shopping' | 'negocio';
  captureEnabled: boolean;
  captureFields: string[];
  buttons: { type: string; label: string; layout?: string }[];
}

export const FUNNEL_BIO_DEFAULTS: Partial<Record<FunnelType, BioPagesDefaults>> = {
  sorteio: {
    template: 'shopping',
    captureEnabled: true,
    captureFields: ['name', 'phone', 'email'],
    buttons: [
      { type: 'form', label: 'Participar do Sorteio', layout: 'featured' },
      { type: 'whatsapp', label: 'Falar no WhatsApp' },
    ],
  },
  captacao: {
    template: 'simples',
    captureEnabled: true,
    captureFields: ['name', 'phone'],
    buttons: [
      { type: 'whatsapp', label: 'Falar no WhatsApp', layout: 'featured' },
    ],
  },
  venda: {
    template: 'shopping',
    captureEnabled: true,
    captureFields: ['name', 'phone'],
    buttons: [
      { type: 'whatsapp', label: 'Comprar pelo WhatsApp', layout: 'featured' },
    ],
  },
  vaga: {
    template: 'negocio',
    captureEnabled: true,
    captureFields: ['name', 'phone', 'email'],
    buttons: [
      { type: 'form', label: 'Candidatar-se', layout: 'featured' },
      { type: 'whatsapp', label: 'Falar com RH' },
    ],
  },
  lancamento: {
    template: 'shopping',
    captureEnabled: true,
    captureFields: ['name', 'phone', 'email'],
    buttons: [
      { type: 'form', label: 'Entrar na Lista VIP', layout: 'featured' },
      { type: 'whatsapp', label: 'Saber mais' },
    ],
  },
  evento: {
    template: 'negocio',
    captureEnabled: true,
    captureFields: ['name', 'phone', 'email'],
    buttons: [
      { type: 'form', label: 'Inscrever-se', layout: 'featured' },
      { type: 'whatsapp', label: 'Duvidas sobre o evento' },
    ],
  },
  // atendimento: sem bio page
};

// ── Campaign defaults por tipo ──────────────────────────────────────
export interface CampaignDefaults {
  campaignType: string;
  utmSource: string;
  utmMedium: string;
  landingMode: 'redirect' | 'form';
}

export const FUNNEL_CAMPAIGN_DEFAULTS: Partial<Record<FunnelType, CampaignDefaults>> = {
  sorteio: { campaignType: 'promocao', utmSource: 'instagram', utmMedium: 'organic', landingMode: 'form' },
  venda: { campaignType: 'venda', utmSource: 'instagram', utmMedium: 'paid', landingMode: 'redirect' },
  lancamento: { campaignType: 'evento', utmSource: 'instagram', utmMedium: 'organic', landingMode: 'form' },
  evento: { campaignType: 'evento', utmSource: 'instagram', utmMedium: 'organic', landingMode: 'form' },
};

// ── Form template mapping por tipo ──────────────────────────────────
// Mapeia tipo de funil para template de formulario existente em FORM_TEMPLATES
export const FUNNEL_FORM_TEMPLATE: Partial<Record<FunnelType, string>> = {
  sorteio: 'sorteio',
  vaga: 'vaga',
  lancamento: 'cadastro',
  evento: 'evento',
  atendimento: 'chamado',
};

// ── UTM Options (PT-BR) ────────────────────────────────────────────
export const UTM_SOURCE_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'site', label: 'Site' },
  { value: 'panfleto', label: 'Panfleto / Impresso' },
  { value: 'indicacao', label: 'Indicacao' },
] as const;

export const UTM_MEDIUM_OPTIONS = [
  { value: 'organico', label: 'Organico', desc: 'Postagens normais, sem pagar' },
  { value: 'pago', label: 'Pago', desc: 'Anuncios patrocinados' },
  { value: 'social', label: 'Rede Social', desc: 'Compartilhamento em redes' },
  { value: 'email', label: 'E-mail', desc: 'Campanhas de e-mail marketing' },
  { value: 'indicacao', label: 'Indicacao', desc: 'Link compartilhado por alguem' },
  { value: 'qrcode', label: 'QR Code', desc: 'Codigo impresso ou digital' },
  { value: 'link_direto', label: 'Link Direto', desc: 'Link clicado diretamente' },
] as const;

// Color palette for kanban columns
export const COLUMN_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#64748b',
] as const;
