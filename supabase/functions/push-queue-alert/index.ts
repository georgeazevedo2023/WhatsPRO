// ============================================================================
// push-queue-alert — push FCM "cliente esperando" no APP do vendedor (v7.117.0)
//
// Roda via pg_cron a cada 2 min (vault CRON_AUTH_KEY). Replica a semântica de
// "Aguardando" da Fila: conversa aberta, IA fora do comando (status_ia
// desligada/shadow), última mensagem é do CLIENTE e é recente (≤15 min).
// Anti-ruído (lições do Casa do Agricultor, 2026-08-02):
//   - 1 aviso por mensagem (push_alert_log.last_message_id)
//   - cooldown 10 min por conversa (rajada de 5 msgs = 1 push)
//   - janela de 15 min: deploy/restart não "redescobre" fila antiga
//   - lead ATRIBUÍDO → só o dono; sem atribuição → membros do departamento
//     com queue_paused=false; sem departamento → todos os aparelhos ativos
//   - token morto (UNREGISTERED/404) → desativado sozinho
// Sem FIREBASE_SERVICE_ACCOUNT nos secrets → no-op barato (o app funciona
// inteiro sem push; ele "liga sozinho" quando o secret existir).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyCronOrService } from '../_shared/auth.ts'
import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('push-queue-alert')

const WINDOW_MIN = 15
const COOLDOWN_MIN = 10
const SCAN_LIMIT = 60

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

// Cache do access token OAuth por isolate (expira em ~1h; renovamos aos 50 min)
let cachedToken: { token: string; expiresAt: number } | null = null

function b64url(input: string | Uint8Array): string {
  const raw = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...input))
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** OAuth2 da service account com WebCrypto puro (zero deps, receita do agro). */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const keyData = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)))
  const jwt = `${unsigned}.${b64url(sig)}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`oauth failed: ${JSON.stringify(json).slice(0, 200)}`)
  cachedToken = { token: json.access_token, expiresAt: Date.now() + 50 * 60 * 1000 }
  return json.access_token
}

function readServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!raw) return null
  try {
    const text = raw.trim().startsWith('{') ? raw : atob(raw)
    const sa = JSON.parse(text)
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null
    return sa
  } catch {
    log.error('FIREBASE_SERVICE_ACCOUNT inválido (nem JSON nem base64 de JSON)')
    return null
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  const sa = readServiceAccount()
  if (!sa) {
    return new Response(JSON.stringify({ ok: true, skipped: 'firebase_not_configured' }), { headers: jsonHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const windowStart = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString()
  const { data: candidates, error: scanError } = await supabase
    .from('conversations')
    .select('id, contact_id, department_id, assigned_to, last_message, last_message_at')
    .eq('status', 'aberta')
    .eq('archived', false)
    .in('status_ia', ['desligada', 'shadow'])
    .gte('last_message_at', windowStart)
    .order('last_message_at', { ascending: false })
    .limit(SCAN_LIMIT)
  if (scanError) {
    log.error('scan failed', { error: scanError.message })
    return new Response(JSON.stringify({ ok: false, error: scanError.message }), { status: 500, headers: jsonHeaders })
  }

  let sent = 0, skipped = 0, deadTokens = 0
  const cooldownStart = new Date(Date.now() - COOLDOWN_MIN * 60 * 1000).toISOString()

  for (const conv of candidates ?? []) {
    // Última mensagem TEM que ser do cliente (humano é a vez de responder)
    const { data: lastMsg } = await supabase
      .from('conversation_messages')
      .select('id, direction, content, transcription')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lastMsg || lastMsg.direction !== 'incoming') { skipped++; continue }

    // Anti-ruído: 1 aviso por mensagem + cooldown por conversa
    const { data: alreadyNotified } = await supabase
      .from('push_alert_log')
      .select('last_message_id, notified_at')
      .eq('conversation_id', conv.id)
      .limit(1)
      .maybeSingle()
    if (alreadyNotified && (alreadyNotified.last_message_id === lastMsg.id || alreadyNotified.notified_at >= cooldownStart)) {
      skipped++
      continue
    }

    // Destinatários: atribuído → dono; senão membros do dept não-pausados; senão todos
    let userIds: string[] = []
    if (conv.assigned_to) {
      userIds = [conv.assigned_to]
    } else if (conv.department_id) {
      const { data: members } = await supabase
        .from('department_members')
        .select('user_id')
        .eq('department_id', conv.department_id)
        .eq('queue_paused', false)
      userIds = (members ?? []).map((m) => m.user_id)
    }
    let devicesQuery = supabase.from('push_devices').select('id, fcm_token, user_id').eq('enabled', true)
    if (userIds.length > 0) devicesQuery = devicesQuery.in('user_id', userIds)
    const { data: devices } = await devicesQuery
    if (!devices?.length) { skipped++; continue }

    const { data: contact } = await supabase
      .from('contacts').select('name').eq('id', conv.contact_id).limit(1).maybeSingle()
    const preview = (lastMsg.content || lastMsg.transcription || 'Nova mensagem').slice(0, 120)
    const title = `${contact?.name || 'Cliente'} está esperando 💬`

    const accessToken = await getAccessToken(sa)
    for (const device of devices) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: device.fcm_token,
            notification: { title, body: preview },
            android: {
              priority: 'HIGH',
              // tag por conversa: aviso novo do MESMO cliente substitui o
              // anterior em vez de empilhar (lição do agro)
              notification: { channel_id: 'fila', tag: `conv-${conv.id}` },
            },
            data: { conversation_id: conv.id },
          },
        }),
      })
      if (res.ok) {
        sent++
      } else {
        const body = await res.text()
        // Token morto (app desinstalado/dados limpos) → desativa sozinho
        if (res.status === 404 || body.includes('UNREGISTERED') || body.includes('INVALID_ARGUMENT')) {
          await supabase.from('push_devices').update({ enabled: false }).eq('id', device.id)
          deadTokens++
        } else {
          log.error('fcm send failed', { status: res.status, body: body.slice(0, 200) })
        }
      }
    }

    await supabase.from('push_alert_log').upsert(
      { conversation_id: conv.id, last_message_id: lastMsg.id, notified_at: new Date().toISOString() },
      { onConflict: 'conversation_id' },
    )
  }

  log.info('push sweep done', { candidates: candidates?.length ?? 0, sent, skipped, deadTokens })
  return new Response(JSON.stringify({ ok: true, candidates: candidates?.length ?? 0, sent, skipped, deadTokens }), { headers: jsonHeaders })
})
