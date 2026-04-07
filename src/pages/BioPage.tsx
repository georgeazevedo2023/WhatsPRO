import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { BioPage as BioPageType, BioButton, SocialPlatform, BioCatalogProduct } from '@/types/bio'
import { FONT_FAMILY_CLASS, BUTTON_SPACING_GAP } from '@/types/bio'
import { BioLeadCaptureModal } from '@/components/bio/BioLeadCaptureModal'

// ─── Social platform icons (SVG inline) ──────────────────────────────────────

const SOCIAL_ICONS: Record<SocialPlatform, string> = {
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  tiktok: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.28a8.19 8.19 0 004.79 1.52V7.37a4.85 4.85 0 01-1.02-.68z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  youtube: 'M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  twitter: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  pinterest: 'M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z',
  telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
}

// ─── Tipo estendido com catalog_product ──────────────────────────────────────

type BioButtonWithCatalog = BioButton & { catalog_product?: BioCatalogProduct | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSocialIcon(platform: SocialPlatform): string {
  return SOCIAL_ICONS[platform] || ''
}

function getBioPublicUrl(slug: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL || 'https://euljumeflwtljegknawy.supabase.co'
  return `${base}/functions/v1/bio-public?slug=${encodeURIComponent(slug)}`
}

async function trackClick(buttonId: string, supabaseUrl: string) {
  const base = supabaseUrl || 'https://euljumeflwtljegknawy.supabase.co'
  fetch(`${base}/functions/v1/bio-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ button_id: buttonId }),
  }).catch(() => null)
}

/** Filtra botões pelo agendamento (starts_at / ends_at) */
function isButtonVisible(button: BioButton): boolean {
  const now = Date.now()
  if (button.starts_at && new Date(button.starts_at).getTime() > now) return false
  if (button.ends_at && new Date(button.ends_at).getTime() < now) return false
  return true
}

// ─── Button action ────────────────────────────────────────────────────────────

function handleButtonClickAction(button: BioButtonWithCatalog, page?: BioPageType) {
  switch (button.type) {
    case 'whatsapp': {
      const phone = (button.phone || '').replace(/\D/g, '')
      let preMsg = button.pre_message || ''
      // Fase 3: injetar contexto AI Agent
      if (page?.ai_context_enabled && page.ai_context_template) {
        const ctx = page.ai_context_template
          .replace(/\{page_title\}/g, page.title)
          .replace(/\{button_label\}/g, button.label)
        preMsg = preMsg ? `${preMsg}\n${ctx}` : ctx
      }
      // M15: append bio tracking tag (invisible to user, detectable by webhook/AI Agent)
      if (page?.slug) {
        const bioTag = `[bio:${page.slug}|${button.label}]`
        preMsg = preMsg ? `${preMsg}\n${bioTag}` : bioTag
      }
      const msg = preMsg ? encodeURIComponent(preMsg) : ''
      window.open(`https://wa.me/${phone}${msg ? `?text=${msg}` : ''}`, '_blank')
      break
    }
    case 'form': {
      if (button.form_slug && page?.slug) {
        window.location.href = `/r?mode=form&fs=${button.form_slug}&bio_page=${encodeURIComponent(page.slug)}&bio_btn=${button.id}`
      } else if (button.form_slug) {
        window.location.href = `/r?mode=form&fs=${button.form_slug}`
      }
      break
    }
    case 'catalog': {
      const product = button.catalog_product
      const phone = (button.phone || '').replace(/\D/g, '')
      if (phone) {
        let baseMsg = product ? `Olá! Tenho interesse no produto: ${product.title}` : ''
        // Fase 3: injetar contexto AI Agent
        if (page?.ai_context_enabled && page.ai_context_template) {
          const ctx = page.ai_context_template
            .replace(/\{page_title\}/g, page.title)
            .replace(/\{button_label\}/g, button.label)
          baseMsg = baseMsg ? `${baseMsg}\n${ctx}` : ctx
        }
        // M15: append bio tracking tag
        if (page?.slug) {
          const bioTag = `[bio:${page.slug}|${button.label}]`
          baseMsg = baseMsg ? `${baseMsg}\n${bioTag}` : bioTag
        }
        const msg = baseMsg ? encodeURIComponent(baseMsg) : ''
        window.open(`https://wa.me/${phone}${msg ? `?text=${msg}` : ''}`, '_blank')
      } else if (button.url) {
        window.open(button.url, '_blank')
      }
      break
    }
    case 'url':
    case 'social': {
      if (button.url) window.open(button.url, '_blank')
      break
    }
  }
}

// ─── Template renderers ───────────────────────────────────────────────────────

interface TemplateProps {
  page: BioPageType
  buttons: BioButtonWithCatalog[]
  onButtonClick: (button: BioButtonWithCatalog) => void
}

// Cover image (Fase 2)
function CoverImage({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <div className="w-full aspect-[3/1] overflow-hidden">
      <img src={url} alt="cover" className="w-full h-full object-cover" />
    </div>
  )
}

// Shared avatar component
function Avatar({ url, title, rounded }: { url: string | null; title: string; rounded: 'full' | 'xl' }) {
  const cls = rounded === 'full' ? 'rounded-full' : 'rounded-xl'
  return (
    <div className={`w-24 h-24 ${cls} overflow-hidden bg-white/20 flex items-center justify-center shrink-0`}>
      {url ? (
        <img src={url} alt={title} className="w-full h-full object-contain" />
      ) : (
        <span className="text-4xl font-bold opacity-60">{title.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}

// Shared social icons row
function SocialIconsRow({ buttons, onButtonClick }: { buttons: BioButtonWithCatalog[]; onButtonClick: (b: BioButtonWithCatalog) => void }) {
  const socials = buttons.filter((b) => b.layout === 'social_icon')
  if (socials.length === 0) return null
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {socials.map((btn) => {
        const path = btn.social_platform ? getSocialIcon(btn.social_platform) : ''
        return (
          <button
            key={btn.id}
            onClick={() => onButtonClick(btn)}
            className="w-8 h-8 flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 transition-all duration-150"
            aria-label={btn.label}
          >
            {path ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d={path} />
              </svg>
            ) : (
              <span className="text-xs font-semibold">{btn.label.slice(0, 2)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Featured button: image 16:9 + chin text
function FeaturedButton({
  button,
  textColor,
  onButtonClick,
}: {
  button: BioButtonWithCatalog
  textColor: string
  onButtonClick: (b: BioButtonWithCatalog) => void
}) {
  return (
    <button
      onClick={() => onButtonClick(button)}
      className="w-full overflow-hidden rounded-[28px] border transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
      style={{ borderColor: textColor + '33' }}
    >
      {button.featured_image_url && (
        <div className="w-full aspect-video overflow-hidden">
          <img
            src={button.featured_image_url}
            alt={button.label}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="px-4 py-3 text-sm font-medium text-center" style={{ color: textColor }}>
        {button.label}
      </div>
    </button>
  )
}

// Stack button with optional thumbnail
function StackButton({
  button,
  style,
  radius,
  buttonColor,
  textColor,
  onButtonClick,
}: {
  button: BioButtonWithCatalog
  style: string
  radius: string
  buttonColor: string
  textColor: string
  onButtonClick: (b: BioButtonWithCatalog) => void
}) {
  const radiusCls = radius === 'full' ? 'rounded-[28px]' : radius === 'lg' ? 'rounded-2xl' : 'rounded-xl'

  const bgStyle =
    style === 'filled'
      ? { backgroundColor: buttonColor, color: textColor }
      : style === 'outline'
      ? { backgroundColor: 'transparent', color: textColor, border: `1px solid ${textColor}` }
      : { backgroundColor: textColor + '1a', color: textColor, border: `1px solid ${textColor}33` }

  return (
    <button
      onClick={() => onButtonClick(button)}
      className={`w-full min-h-[64px] flex items-center gap-3 px-5 transition-all duration-200 active:scale-[0.98] ${radiusCls}`}
      style={bgStyle}
    >
      {button.thumbnail_url && (
        <img
          src={button.thumbnail_url}
          alt=""
          className="w-12 h-12 rounded-xl object-cover shrink-0"
        />
      )}
      <span className="flex-1 text-center text-sm font-medium leading-tight">{button.label}</span>
    </button>
  )
}

// Catalog button (Fase 2)
function CatalogButton({
  button,
  style,
  radius,
  buttonColor,
  textColor,
  onButtonClick,
}: {
  button: BioButtonWithCatalog
  style: string
  radius: string
  buttonColor: string
  textColor: string
  onButtonClick: (b: BioButtonWithCatalog) => void
}) {
  const product = button.catalog_product
  const radiusCls = radius === 'full' ? 'rounded-[28px]' : radius === 'lg' ? 'rounded-2xl' : 'rounded-xl'
  const bgStyle =
    style === 'filled'
      ? { backgroundColor: buttonColor, color: textColor }
      : style === 'outline'
      ? { backgroundColor: 'transparent', color: textColor, border: `1px solid ${textColor}` }
      : { backgroundColor: textColor + '1a', color: textColor, border: `1px solid ${textColor}33` }

  return (
    <button
      onClick={() => onButtonClick(button)}
      className={`w-full min-h-[64px] flex items-center gap-3 px-4 transition-all duration-200 active:scale-[0.98] ${radiusCls}`}
      style={bgStyle}
    >
      {product?.image_url ? (
        <img src={product.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl shrink-0 opacity-20" style={{ backgroundColor: textColor }} />
      )}
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium truncate">{button.label || product?.title || 'Produto'}</p>
        {product?.price != null && (
          <p className="text-xs opacity-70 mt-0.5">
            {product.currency === 'BRL' ? 'R$' : (product.currency ?? '')} {product.price.toFixed(2)}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Template: simples ────────────────────────────────────────────────────────
function TemplateSimples({ page, buttons, onButtonClick }: TemplateProps) {
  const mainButtons = buttons.filter((b) => b.layout !== 'social_icon')
  const spacingCls = BUTTON_SPACING_GAP[page.button_spacing ?? 'normal']
  const fontCls = FONT_FAMILY_CLASS[page.font_family ?? 'default']

  return (
    <div
      className={`min-h-screen flex flex-col ${fontCls}`}
      style={{ backgroundColor: page.bg_color, color: page.text_color }}
    >
      <CoverImage url={page.cover_url} />
      <div className={`flex flex-col items-center py-10 px-4`}>
        <div className={`w-full max-w-[580px] flex flex-col items-center ${spacingCls}`}>
          <Avatar url={page.avatar_url} title={page.title} rounded="full" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{page.title}</h1>
            {page.description && (
              <p className="mt-1 text-sm opacity-75 max-w-xs mx-auto">{page.description}</p>
            )}
          </div>
          <SocialIconsRow buttons={buttons} onButtonClick={onButtonClick} />
          <div className={`w-full flex flex-col ${spacingCls}`}>
            {mainButtons.map((btn) => {
              if (btn.layout === 'featured') {
                return (
                  <FeaturedButton
                    key={btn.id}
                    button={btn}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              if (btn.type === 'catalog') {
                return (
                  <CatalogButton
                    key={btn.id}
                    button={btn}
                    style={page.button_style}
                    radius={page.button_radius}
                    buttonColor={page.button_color}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              return (
                <StackButton
                  key={btn.id}
                  button={btn}
                  style={page.button_style}
                  radius={page.button_radius}
                  buttonColor={page.button_color}
                  textColor={page.text_color}
                  onButtonClick={onButtonClick}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Template: shopping (inspirado Shopping Recife) ───────────────────────────
function TemplateShopping({ page, buttons, onButtonClick }: TemplateProps) {
  const mainButtons = buttons.filter((b) => b.layout !== 'social_icon')
  const spacingCls = BUTTON_SPACING_GAP[page.button_spacing ?? 'normal']
  const fontCls = FONT_FAMILY_CLASS[page.font_family ?? 'default']
  const bgStyle =
    page.bg_type === 'gradient' && page.bg_gradient_to
      ? { background: `linear-gradient(0deg, ${page.bg_color}, ${page.bg_gradient_to})` }
      : { backgroundColor: page.bg_color }

  return (
    <div
      className={`min-h-screen flex flex-col ${fontCls}`}
      style={{ ...bgStyle, color: page.text_color }}
    >
      <CoverImage url={page.cover_url} />
      <div className="flex flex-col items-center py-10 px-4">
        <div className={`w-full max-w-[580px] flex flex-col items-center ${spacingCls}`}>
          <Avatar url={page.avatar_url} title={page.title} rounded="full" />
          <h1 className="text-2xl font-bold text-center">{page.title}</h1>
          {page.description && (
            <p className="text-sm opacity-75 text-center max-w-xs">{page.description}</p>
          )}
          <SocialIconsRow buttons={buttons} onButtonClick={onButtonClick} />
          <div className={`w-full flex flex-col ${spacingCls}`}>
            {mainButtons.map((btn) => {
              if (btn.layout === 'featured') {
                return (
                  <FeaturedButton
                    key={btn.id}
                    button={btn}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              if (btn.type === 'catalog') {
                return (
                  <CatalogButton
                    key={btn.id}
                    button={btn}
                    style="outline"
                    radius={page.button_radius}
                    buttonColor={page.button_color}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              return (
                <button
                  key={btn.id}
                  onClick={() => onButtonClick(btn)}
                  className="w-full min-h-[64px] flex items-center gap-3 px-5 rounded-[28px] border transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
                  style={{ borderColor: page.text_color, color: page.text_color }}
                >
                  {btn.thumbnail_url && (
                    <img src={btn.thumbnail_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <span className="flex-1 text-center text-sm font-medium">{btn.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Template: negocio ────────────────────────────────────────────────────────
function TemplateNegocio({ page, buttons, onButtonClick }: TemplateProps) {
  const mainButtons = buttons.filter((b) => b.layout !== 'social_icon')
  const spacingCls = BUTTON_SPACING_GAP[page.button_spacing ?? 'normal']
  const fontCls = FONT_FAMILY_CLASS[page.font_family ?? 'default']
  const bg =
    page.bg_type === 'gradient' && page.bg_gradient_to
      ? { background: `linear-gradient(135deg, ${page.bg_color}, ${page.bg_gradient_to})` }
      : { backgroundColor: page.bg_color }

  return (
    <div
      className={`min-h-screen flex flex-col ${fontCls}`}
      style={{ ...bg, color: page.text_color }}
    >
      <CoverImage url={page.cover_url} />
      <div className="flex flex-col items-center py-10 px-4">
        <div className={`w-full max-w-[580px] flex flex-col items-center ${spacingCls}`}>
          <Avatar url={page.avatar_url} title={page.title} rounded="xl" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">{page.title}</h1>
            {page.description && (
              <p className="mt-1 text-sm opacity-70 max-w-xs mx-auto">{page.description}</p>
            )}
          </div>
          <SocialIconsRow buttons={buttons} onButtonClick={onButtonClick} />
          <div className={`w-full flex flex-col ${spacingCls}`}>
            {mainButtons.map((btn) => {
              if (btn.layout === 'featured') {
                return (
                  <FeaturedButton
                    key={btn.id}
                    button={btn}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              if (btn.type === 'catalog') {
                return (
                  <CatalogButton
                    key={btn.id}
                    button={btn}
                    style={page.button_style}
                    radius={page.button_radius}
                    buttonColor={page.button_color}
                    textColor={page.text_color}
                    onButtonClick={onButtonClick}
                  />
                )
              }
              return (
                <button
                  key={btn.id}
                  onClick={() => onButtonClick(btn)}
                  className="w-full min-h-[64px] flex items-center gap-3 px-5 rounded-2xl border transition-all duration-200 hover:bg-white/20 active:scale-[0.98]"
                  style={{
                    backgroundColor: page.text_color + '1a',
                    borderColor: page.text_color + '33',
                    color: page.text_color,
                  }}
                >
                  {btn.thumbnail_url && (
                    <img src={btn.thumbnail_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <span className="flex-1 text-center text-sm font-medium">{btn.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BioPage() {
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState<BioPageType | null>(null)
  const [buttons, setButtons] = useState<BioButtonWithCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Fase 3: estado de captura de lead
  const [captureModalOpen, setCaptureModalOpen] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<BioButtonWithCatalog | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }

    fetch(getBioPublicUrl(slug))
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data?.page) {
          setPage(data.page)
          // Filtra botões pelo agendamento
          const allButtons: BioButtonWithCatalog[] = data.buttons ?? []
          setButtons(allButtons.filter(isButtonVisible))
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  function handleButtonClick(button: BioButtonWithCatalog) {
    trackClick(button.id, supabaseUrl)

    // Fase 3: interceptar clique para captura (exceto botões social)
    if (page?.capture_enabled && button.type !== 'social') {
      setCaptureTarget(button)
      setCaptureModalOpen(true)
      return
    }

    handleButtonClickAction(button, page ?? undefined)
  }

  async function handleCaptureSubmit(data: { name?: string; phone?: string; email?: string }) {
    if (!captureTarget || !page) return
    setIsCapturing(true)
    try {
      const base = supabaseUrl || 'https://euljumeflwtljegknawy.supabase.co'
      await fetch(`${base}/functions/v1/bio-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture',
          bio_page_id: page.id,
          bio_button_id: captureTarget.id,
          ...data,
        }),
      }).catch(() => null)
    } finally {
      setIsCapturing(false)
      setCaptureModalOpen(false)
      const target = captureTarget
      setCaptureTarget(null)
      // Executa a ação original após captura
      handleButtonClickAction(target, page)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white gap-4">
        <div className="text-5xl">🔗</div>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-white/50 text-sm">Este link não existe ou foi desativado.</p>
      </div>
    )
  }

  const props: TemplateProps = { page, buttons, onButtonClick: handleButtonClick }

  return (
    <>
      {page.capture_enabled && captureTarget && (
        <BioLeadCaptureModal
          open={captureModalOpen}
          onClose={() => {
            setCaptureModalOpen(false)
            setCaptureTarget(null)
          }}
          onSubmit={handleCaptureSubmit}
          page={page}
          isSubmitting={isCapturing}
        />
      )}
      {(() => {
        switch (page.template) {
          case 'shopping':
            return <TemplateShopping {...props} />
          case 'negocio':
            return <TemplateNegocio {...props} />
          default:
            return <TemplateSimples {...props} />
        }
      })()}
    </>
  )
}
