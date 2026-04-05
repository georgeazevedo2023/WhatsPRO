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

/** Escape HTML to prevent XSS in campaign name */
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const supabase = createServiceClient()

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
      .select('id, name, status, destination_phone, welcome_message, starts_at, expires_at')
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

    const safeName = escHtml(campaign.name)

    log.info('Campaign redirect', { slug, campaign_id: campaign.id, ref_code: refCode })

    // ── CSS-only landing page (Supabase sandboxes JS in edge functions) ──
    // Uses <meta refresh> for redirect + pure CSS animations for countdown
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="3;url=${waUrl}">
<meta property="og:title" content="${safeName}">
<meta property="og:description" content="Fale conosco no WhatsApp">
<title>${safeName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5}
.card{text-align:center;padding:2.5rem 2rem;max-width:380px;width:90%}
.logo{width:56px;height:56px;margin:0 auto 1.5rem;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:16px;display:flex;align-items:center;justify-content:center}
.logo svg{width:28px;height:28px;fill:#fff}
h1{font-size:1.1rem;font-weight:600;margin-bottom:.25rem;color:#fff}
.sub{font-size:.85rem;color:#a3a3a3;margin-bottom:2rem}
.spinner{width:36px;height:36px;border:3px solid #262626;border-top-color:#25D366;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 1.25rem}
@keyframes spin{to{transform:rotate(360deg)}}
.cd{position:relative;height:2.5rem;margin-bottom:.5rem}
.cd span{position:absolute;left:50%;transform:translateX(-50%);font-size:1.5rem;font-weight:700;color:#25D366;opacity:0}
.n3{animation:num 1s 0s forwards}
.n2{animation:num 1s 1s forwards}
.n1{animation:num 1s 2s forwards}
@keyframes num{0%{opacity:0;transform:translateX(-50%) scale(.5)}10%{opacity:1;transform:translateX(-50%) scale(1)}90%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) scale(.5)}}
.label{font-size:.8rem;color:#737373;margin-bottom:2rem}
.btn{display:inline-block;padding:.75rem 1.5rem;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:.9rem;font-weight:600;cursor:pointer;text-decoration:none;transition:background .2s;opacity:0;animation:show .3s 3.5s forwards}
.btn:hover{background:#1da851}
@keyframes show{to{opacity:1}}
</style>
</head>
<body>
<div class="card">
  <div class="logo"><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.608.608l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.365 0-4.557-.82-6.285-2.188l-.44-.352-3.2 1.072 1.072-3.2-.352-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg></div>
  <h1>${safeName}</h1>
  <p class="sub">Redirecionando para WhatsApp...</p>
  <div class="spinner"></div>
  <div class="cd"><span class="n3">3</span><span class="n2">2</span><span class="n1">1</span></div>
  <p class="label">Abrindo WhatsApp em instantes</p>
  <a href="${waUrl}" class="btn">Abrir WhatsApp manualmente</a>
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
