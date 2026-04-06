// ─── Bio Link Types ───────────────────────────────────────────────────────────

export type BioTemplate = 'simples' | 'shopping' | 'negocio'
export type BioBgType = 'solid' | 'gradient'
export type BioButtonStyle = 'filled' | 'outline' | 'soft'
export type BioButtonRadius = 'full' | 'lg' | 'md'
export type BioPageStatus = 'active' | 'draft' | 'archived'
export type BioButtonType = 'url' | 'whatsapp' | 'form' | 'social' | 'catalog'
export type BioButtonLayout = 'stack' | 'featured' | 'social_icon'
export type BioFontFamily = 'default' | 'serif' | 'mono'
export type BioButtonSpacing = 'compact' | 'normal' | 'loose'
export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'
  | 'twitter'
  | 'pinterest'
  | 'telegram'

export interface BioPage {
  id: string
  instance_id: string
  created_by: string

  slug: string
  title: string
  description: string | null
  avatar_url: string | null

  // Visual
  bg_color: string
  bg_type: BioBgType
  bg_gradient_to: string | null
  button_style: BioButtonStyle
  button_radius: BioButtonRadius
  button_color: string
  text_color: string

  // Fase 2 — visual extras
  cover_url: string | null
  font_family: BioFontFamily
  button_spacing: BioButtonSpacing

  template: BioTemplate
  view_count: number
  status: BioPageStatus

  created_at: string
  updated_at: string
}

export interface BioButton {
  id: string
  bio_page_id: string

  position: number
  label: string
  type: BioButtonType

  // url / form
  url: string | null
  form_slug: string | null

  // whatsapp
  phone: string | null
  pre_message: string | null
  whatsapp_tag: string | null

  // social
  social_platform: SocialPlatform | null

  // catalog (Fase 2)
  catalog_product_id: string | null

  // layout
  layout: BioButtonLayout
  thumbnail_url: string | null
  featured_image_url: string | null

  // Fase 2 — agendamento
  starts_at: string | null
  ends_at: string | null

  click_count: number
  created_at: string
}

// Produto do catálogo resolvido pela edge function (retornado junto ao botão)
export interface BioCatalogProduct {
  id: string
  title: string
  price: number | null
  currency: string | null
  image_url: string | null
}

// DTO para criação de bio page
export interface CreateBioPageInput {
  instance_id: string
  slug: string
  title: string
  description?: string
  avatar_url?: string
  bg_color?: string
  bg_type?: BioBgType
  bg_gradient_to?: string
  button_style?: BioButtonStyle
  button_radius?: BioButtonRadius
  button_color?: string
  text_color?: string
  template?: BioTemplate
  status?: BioPageStatus
  // Fase 2
  cover_url?: string
  font_family?: BioFontFamily
  button_spacing?: BioButtonSpacing
}

// DTO para criação de botão
export interface CreateBioButtonInput {
  bio_page_id: string
  position: number
  label: string
  type: BioButtonType
  url?: string
  form_slug?: string
  phone?: string
  pre_message?: string
  whatsapp_tag?: string
  social_platform?: SocialPlatform
  layout?: BioButtonLayout
  thumbnail_url?: string
  featured_image_url?: string
  // Fase 2
  catalog_product_id?: string
  starts_at?: string
  ends_at?: string
}

// Defaults por template
export const TEMPLATE_DEFAULTS: Record<BioTemplate, Partial<BioPage>> = {
  simples: {
    bg_color: '#0f0f0f',
    bg_type: 'solid',
    button_style: 'filled',
    button_radius: 'full',
    button_color: '#25D366',
    text_color: '#ffffff',
  },
  shopping: {
    bg_color: '#780016',
    bg_type: 'solid',
    button_style: 'outline',
    button_radius: 'full',
    button_color: '#ffffff',
    text_color: '#ffffff',
  },
  negocio: {
    bg_color: '#1a1a2e',
    bg_type: 'gradient',
    bg_gradient_to: '#16213e',
    button_style: 'soft',
    button_radius: 'lg',
    button_color: '#ffffff',
    text_color: '#ffffff',
  },
}

// Labels de plataformas sociais
export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter/X',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
}

// Mapeamento de fonte para classe CSS
export const FONT_FAMILY_CLASS: Record<BioFontFamily, string> = {
  default: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
}

// Mapeamento de espaçamento para gap CSS
export const BUTTON_SPACING_GAP: Record<BioButtonSpacing, string> = {
  compact: 'gap-2',
  normal: 'gap-3',
  loose: 'gap-5',
}
