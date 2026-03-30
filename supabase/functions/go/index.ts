import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('c')

    if (!slug) {
      return new Response('Missing campaign slug (?c=...)', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Service-role client (public endpoint, no user auth)
    const supabase = createServiceClient()

    // Look up campaign
    const { data: campaign, error } = await supabase
      .from('utm_campaigns')
      .select('id, name, status, destination_phone, welcome_message, expires_at')
      .eq('slug', slug)
      .maybeSingle()

    if (error || !campaign) {
      return new Response('Campaign not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Check status
    if (campaign.status !== 'active') {
      return new Response('Campaign is not active', {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Check expiration
    if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
      return new Response('Campaign has expired', {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    // Generate unique ref code
    const refCode = generateRefCode()

    // Record the visit
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

    // Build WhatsApp redirect URL
    const phone = campaign.destination_phone.replace(/\D/g, '')
    const parts: string[] = []
    if (campaign.welcome_message) parts.push(campaign.welcome_message)
    parts.push(`ref_${refCode}`)
    const text = encodeURIComponent(parts.join(' '))
    const waUrl = `https://wa.me/${phone}?text=${text}`

    log.info('Campaign redirect', { slug, campaign_id: campaign.id, ref_code: refCode })

    // Return instant redirect HTML (not a JSON response — keep as-is)
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${waUrl}">
<meta property="og:title" content="${campaign.name}">
<meta property="og:description" content="Fale conosco no WhatsApp">
<title>Redirecionando...</title>
<script>window.location.replace("${waUrl}")</script>
<style>
body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;color:#333}
.c{text-align:center}
.spinner{width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#25D366;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
a{color:#25D366;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<div class="c">
<div class="spinner"></div>
<p>Redirecionando para WhatsApp...</p>
<p><a href="${waUrl}">Clique aqui se nao redirecionou</a></p>
</div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
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
