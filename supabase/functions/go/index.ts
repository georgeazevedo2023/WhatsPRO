import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const log = createLogger('go')

/** Generate a short alphanumeric ref code (no ambiguous chars) */
function generateRefCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const supabase = createServiceClient()

  // ── POST: receive client-side data from React landing page ────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { ref_code, event, screen_width, screen_height, language, timezone } = body
      if (!ref_code) return new Response('Missing ref_code', { status: 400, headers: corsHeaders })

      // Build metadata to merge
      let newMetadata: Record<string, unknown> = {}

      if (event === 'form_started') {
        // Form abandonment tracking — merge form_started flag into existing metadata
        const { data: existing } = await supabase
          .from('utm_visits')
          .select('metadata')
          .eq('ref_code', ref_code)
          .maybeSingle()
        const prev = (existing?.metadata as Record<string, unknown>) || {}
        newMetadata = { ...prev, form_started: true, form_started_at: new Date().toISOString() }
      } else {
        // Standard client-side enrichment (screen, language, timezone)
        const { data: existing } = await supabase
          .from('utm_visits')
          .select('metadata')
          .eq('ref_code', ref_code)
          .maybeSingle()
        const prev = (existing?.metadata as Record<string, unknown>) || {}
        newMetadata = { ...prev, screen_width, screen_height, language, timezone }
      }

      await supabase.from('utm_visits').update({
        metadata: newMetadata,
      }).eq('ref_code', ref_code)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      log.error('POST error', { error: (err as Error).message })
      return new Response('Error', { status: 500, headers: corsHeaders })
    }
  }

  // ── GET: redirect flow ────────────────────────────────────────────
  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('c')

    if (!slug) {
      return new Response('Missing campaign slug (?c=...)', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Look up campaign
    const { data: campaign, error } = await supabase
      .from('utm_campaigns')
      .select('id, name, status, destination_phone, welcome_message, starts_at, expires_at, landing_mode, form_slug')
      .eq('slug', slug)
      .maybeSingle()

    if (error || !campaign) {
      return new Response('Campaign not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    if (campaign.status !== 'active') {
      return new Response('Campaign is not active', {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    if (campaign.starts_at && new Date(campaign.starts_at) > new Date()) {
      return new Response('Campaign not yet active', {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
      return new Response('Campaign has expired', {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Generate unique ref code & record visit (server-side data)
    const refCode = generateRefCode()
    const visitorIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const userAgent = req.headers.get('user-agent') || ''
    const referrer = req.headers.get('referer') || ''

    await supabase.from('utm_visits').insert({
      campaign_id: campaign.id,
      ref_code: refCode,
      visitor_ip: visitorIp,
      user_agent: userAgent,
      referrer: referrer,
    })

    // Build WhatsApp URL
    const phone = campaign.destination_phone.replace(/\D/g, '')
    const msgParts: string[] = []
    if (campaign.welcome_message) msgParts.push(campaign.welcome_message)
    msgParts.push(`ref_${refCode}`)
    const text = encodeURIComponent(msgParts.join(' '))
    const waUrl = `https://wa.me/${phone}?text=${text}`

    log.info('Campaign redirect', { slug, campaign_id: campaign.id, ref_code: refCode, mode: campaign.landing_mode })

    // Redirect to React landing page (Supabase sandboxes JS/HTML in edge functions)
    const CRM_URL = Deno.env.get('CRM_URL') || 'https://crm.wsmart.com.br'
    const postUrl = encodeURIComponent(url.origin + url.pathname)
    const params = new URLSearchParams({
      n: campaign.name,
      wa: waUrl,
      ref: refCode,
      p: url.origin + url.pathname,
    })
    if (campaign.landing_mode === 'form' && campaign.form_slug) {
      params.set('mode', 'form')
      params.set('fs', campaign.form_slug)
    }
    const redirectUrl = `${CRM_URL}/r?${params.toString()}`

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
        'Cache-Control': 'no-cache, no-store',
      },
    })
  } catch (err) {
    log.error('Error', { error: (err as Error).message })
    return new Response('Internal error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    })
  }
})
