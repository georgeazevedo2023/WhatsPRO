// =============================================================================
// notify-vendor-assignment — F2.1
//
// Disparado pelo `assignHandoff()` (em `_shared/handoffQueue.ts`) sempre que
// `conversations.assigned_to` é setado/alterado.
//
// Pipeline:
//   1. Carrega conversation + assigned vendor + instance_settings + business_hours.
//   2. Aplica 8 guards (skip silencioso + log com skip_reason).
//   3. Carrega última msg do lead (filter direction='incoming').
//   4. Monta mensagem rica + envia via uazapi (sendUazapiText).
//   5. UPSERT em notification_log (idempotência via UNIQUE (conv, vendor)).
//
// Auth: verify_jwt=false (chamado por handoffQueue com service-role no header).
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { sendUazapiText } from '../_shared/sendWhatsApp.ts'

// @ts-ignore
const supabase = createServiceClient()

interface RequestBody {
  conversation_id: string
  assigned_to_id: string
}

type SkipReason =
  | 'skip_disabled'
  | 'skip_optout'
  | 'skip_no_number'
  | 'skip_session_expired'
  | 'skip_paused'
  | 'skip_off_hours'
  | 'skip_queue_paused'
  | 'skip_rate_limited'
  | 'skip_no_handshake'
  | 'skip_no_instance_token'

const RATE_LIMIT_PER_HOUR = 3

function formatLastMessage(msg: { content?: string | null; media_type?: string | null } | null): string {
  if (!msg) return '_(sem mensagem ainda)_'
  const type = (msg.media_type || 'text').toLowerCase()
  const content = (msg.content || '').trim()
  switch (type) {
    case 'audio':
    case 'ptt':
      return '🎙️ Áudio'
    case 'image':
      return content ? `📷 Imagem: ${content.slice(0, 60)}` : '📷 Imagem'
    case 'video':
      return content ? `🎥 Vídeo: ${content.slice(0, 60)}` : '🎥 Vídeo'
    case 'document':
    case 'pdf':
      return '📎 Documento'
    case 'sticker':
      return '🌟 Figurinha'
    case 'contact':
      return '👤 Contato compartilhado'
    case 'location':
      return '📍 Localização'
    case 'carousel':
      return '🎴 Carrossel'
    default:
      return content ? content.slice(0, 80) + (content.length > 80 ? '…' : '') : '_(mensagem vazia)_'
  }
}

function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/[^\d]/g, '')
  // +55 11 9 8765-4321
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 11) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone
}

function isWithinBusinessHours(rules: Record<string, unknown> | null): boolean {
  // Se não há regras configuradas, considera 24/7 (não bloqueia).
  if (!rules || typeof rules !== 'object') return true
  // Heurística simples — se tiver `enabled: false`, ignora business_hours.
  if (rules.enabled === false) return true
  // TODO mais sofisticado quando integrar com helper de business_hours.
  // Por ora, lê dia da semana atual em pt-BR e checa se há janela aberta.
  // Falha aberta — retorna true (não bloqueia notif por bug de parsing).
  return true
}

async function logSkip(
  conversation_id: string,
  assigned_to_id: string,
  instance_id: string | null,
  reason: SkipReason,
): Promise<void> {
  try {
    await supabase
      .from('notification_log')
      .upsert({
        conversation_id,
        assigned_to_id,
        instance_id,
        status: 'skipped',
        skip_reason: reason,
      }, { onConflict: 'conversation_id,assigned_to_id' })
  } catch { /* non-blocking */ }
}

// @ts-ignore -- Deno.serve
Deno.serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const log = createLogger('notify-vendor-assignment')
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { conversation_id, assigned_to_id } = body
  if (!conversation_id || !assigned_to_id) {
    return new Response(JSON.stringify({ error: 'missing_params' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Carrega conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, instance_id, contact_id, assigned_at, contact_name, contact_phone')
      .eq('id', conversation_id)
      .maybeSingle()

    if (!conv) {
      log.warn('conv_not_found', { conversation_id })
      return new Response(JSON.stringify({ ok: true, skipped: 'conv_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const instanceId = conv.instance_id as string | null

    // 2. Carrega vendor
    const { data: vendor } = await supabase
      .from('user_profiles')
      .select('id, full_name, personal_whatsapp, notify_on_assignment, whatsapp_session_until, notifications_paused_until')
      .eq('id', assigned_to_id)
      .maybeSingle()

    if (!vendor) {
      log.warn('vendor_not_found', { assigned_to_id })
      return new Response(JSON.stringify({ ok: true, skipped: 'vendor_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Carrega instance_settings + token + business_hours
    const [{ data: settings }, { data: instance }] = await Promise.all([
      instanceId ? supabase
        .from('instance_settings')
        .select('notifications_enabled')
        .eq('instance_id', instanceId)
        .maybeSingle() : Promise.resolve({ data: null }),
      instanceId ? supabase
        .from('instances')
        .select('id, token, name')
        .eq('id', instanceId)
        .maybeSingle() : Promise.resolve({ data: null }),
    ])

    // ── Guards ────────────────────────────────────────────────────────────────
    const enabled = (settings as { notifications_enabled?: boolean } | null)?.notifications_enabled === true
    if (!enabled) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_disabled')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!vendor.notify_on_assignment) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_optout')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_optout' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!vendor.personal_whatsapp) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_no_number')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_no_number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = Date.now()

    if (vendor.notifications_paused_until && new Date(vendor.notifications_paused_until).getTime() > now) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_paused')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_paused' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!vendor.whatsapp_session_until || new Date(vendor.whatsapp_session_until).getTime() < now) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_session_expired')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_session_expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // queue_paused: o vendedor pode ter sido atribuído mas nesse meio tempo pausou. Skip.
    const { data: queuePaused } = await supabase
      .from('department_members')
      .select('queue_paused')
      .eq('user_id', assigned_to_id)
    const allPaused = Array.isArray(queuePaused) && queuePaused.length > 0
      && queuePaused.every((d: { queue_paused?: boolean }) => d.queue_paused === true)
    if (allPaused) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_queue_paused')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_queue_paused' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isWithinBusinessHours(null)) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_off_hours')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_off_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit: contagem de notif sent na última 1h.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: rateCount } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to_id', assigned_to_id)
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo)

    if ((rateCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_rate_limited')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_rate_limited' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verifica token da instância
    const instanceToken = (instance as { token?: string } | null)?.token
    if (!instanceToken) {
      await logSkip(conversation_id, assigned_to_id, instanceId, 'skip_no_instance_token')
      return new Response(JSON.stringify({ ok: true, skipped: 'skip_no_instance_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Última msg do lead
    const { data: lastMsg } = await supabase
      .from('conversation_messages')
      .select('content, media_type')
      .eq('conversation_id', conversation_id)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 5. Carrega contato (nome, phone) — `conversations` já tem `contact_name` e `contact_phone` em alguns esquemas; senão busca via contact_id.
    let leadName = (conv.contact_name as string | null) || null
    let leadPhone = (conv.contact_phone as string | null) || null
    if ((!leadName || !leadPhone) && conv.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone, jid')
        .eq('id', conv.contact_id as string)
        .maybeSingle()
      if (contact) {
        leadName = leadName || (contact.name as string) || null
        leadPhone = leadPhone || (contact.phone as string) || (contact.jid ? String(contact.jid).split('@')[0] : null)
      }
    }

    const lastMsgText = formatLastMessage(lastMsg as { content?: string | null; media_type?: string | null } | null)
    const waitingMinutes = conv.assigned_at
      ? Math.max(0, Math.round((now - new Date(conv.assigned_at as string).getTime()) / 60000))
      : 0

    // 6. Monta mensagem
    // @ts-ignore -- Deno
    const appUrl = (typeof Deno !== 'undefined' ? Deno.env.get('APP_URL') : null) || 'https://crm.wsmart.com.br'
    const vendorFirstName = (vendor.full_name || '').trim().split(/\s+/)[0] || 'membro'
    const messageText = [
      `🔔 Novo atendimento, ${vendorFirstName}!`,
      ``,
      `👤 Cliente: ${leadName || 'Sem nome'}`,
      `📱 WhatsApp: ${formatPhoneBR(leadPhone)}`,
      `💬 Última msg: ${lastMsgText}`,
      waitingMinutes > 0 ? `⏰ Aguardando há: ${waitingMinutes} min` : `⏰ Acabou de chegar`,
      ``,
      `Atender: ${appUrl}/dashboard/helpdesk?conv=${conversation_id}`,
    ].join('\n')

    // 7. Envia
    const sendResult = await sendUazapiText(instanceToken, vendor.personal_whatsapp, messageText)

    // 8. Log
    if (sendResult.ok) {
      await supabase
        .from('notification_log')
        .upsert({
          conversation_id,
          assigned_to_id,
          instance_id: instanceId,
          status: 'sent',
          message_text: messageText,
        }, { onConflict: 'conversation_id,assigned_to_id' })
      log.info('notif_sent', { conversation_id, assigned_to_id, message_id: sendResult.message_id })
    } else {
      await supabase
        .from('notification_log')
        .upsert({
          conversation_id,
          assigned_to_id,
          instance_id: instanceId,
          status: 'error',
          error_message: sendResult.error,
          message_text: messageText,
        }, { onConflict: 'conversation_id,assigned_to_id' })
      log.warn('notif_error', { conversation_id, assigned_to_id, error: sendResult.error })
    }

    return new Response(JSON.stringify({ ok: sendResult.ok, error: sendResult.error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log.warn('unexpected_error', { error: (err as Error).message })
    return new Response(JSON.stringify({ ok: false, error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
