// =============================================================================
// notify-manager-nps — alerta o GESTOR quando o NPS vem ABAIXO do threshold.
//
// Disparado (fire-and-forget) pelo whatsapp-webhook no poll_update de uma enquete
// is_nps com nota baixa. Monta contexto rico (cliente nome+telefone, atendente que
// finalizou, RESUMO da conversa) e: (a) manda WhatsApp pros gestores (se ligado),
// (b) grava notificação in-app enriquecida.
//
// Idempotência: claim atômico de poll_messages.bad_alert_sent_at (cobre reedição
// de voto). Auth: verify_jwt=false + verifyCronOrService (chamado por service-role).
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { sendUazapiText } from '../_shared/sendWhatsApp.ts'
import { callLLM } from '../_shared/llmProvider.ts'
import { SUMMARY_SYSTEM_PROMPT } from '../_shared/summaryPrompt.ts'
import { scoreLabel, buildManagerAlertText, type NpsScale } from '../_shared/nps.ts'

// @ts-ignore — Deno global
const supabase = createServiceClient()
const log = createLogger('notify-manager-nps')

interface Body {
  poll_message_id: string
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/** Resumo da conversa: usa ai_summary cacheado; senão gera via callLLM; senão null. */
async function buildSummary(conversationId: string, cachedSummary: unknown): Promise<string | null> {
  const cached = cachedSummary as { summary?: string; reason?: string } | null
  if (cached?.summary && cached.summary.trim()) return cached.summary.trim()
  if (cached?.reason && cached.reason.trim()) return cached.reason.trim()

  try {
    const { data: msgs } = await supabase
      .from('conversation_messages')
      .select('direction, content, transcription, media_type')
      .eq('conversation_id', conversationId)
      .neq('direction', 'private_note')
      .order('created_at', { ascending: false })
      .limit(15)
    if (!msgs || msgs.length === 0) return null

    const conversationText = (msgs as Array<{ direction: string; content?: string; transcription?: string; media_type?: string }>)
      .reverse()
      .map((m) => {
        const role = m.direction === 'incoming' ? '[Cliente]' : '[Atendente]'
        const text = (m.content || m.transcription || (m.media_type && m.media_type !== 'text' ? `[${m.media_type}]` : '')).trim()
        return text ? `${role}: ${text}` : null
      })
      .filter(Boolean)
      .join('\n')
    if (!conversationText) return null

    const resp = await callLLM({
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Conversa:\n${conversationText}` }],
      tools: [],
      temperature: 0.3,
      maxTokens: 512,
      model: 'gpt-4.1-mini',
    })
    const cleaned = (resp.text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as { summary?: string; reason?: string }
    return (parsed.summary || parsed.reason || '').trim() || null
  } catch (e) {
    log.warn('buildSummary failed (non-fatal)', { error: (e as Error).message })
    return null
  }
}

// @ts-ignore — Deno.serve
Deno.serve(async (req: Request) => {
  const cors = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (!verifyCronOrService(req)) return unauthorizedResponse(cors)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400, cors) }
  const pollMessageId = body.poll_message_id
  if (!pollMessageId) return json({ error: 'missing_poll_message_id' }, 400, cors)

  try {
    const { data: pm } = await supabase
      .from('poll_messages')
      .select('id, conversation_id, instance_id, attendant_id, nps_scale, bad_alert_sent_at')
      .eq('id', pollMessageId)
      .maybeSingle()
    if (!pm) return json({ ok: false, skipped: 'poll_not_found' }, 200, cors)

    // Idempotência: só alerta se ainda não alertou (cobre reedição de voto).
    const { data: claimed } = await supabase
      .from('poll_messages')
      .update({ bad_alert_sent_at: new Date().toISOString() })
      .eq('id', pollMessageId)
      .is('bad_alert_sent_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) return json({ ok: false, skipped: 'already_alerted' }, 200, cors)

    const conversationId = (pm as { conversation_id?: string }).conversation_id
    const instanceId = (pm as { instance_id?: string }).instance_id
    const attendantId = (pm as { attendant_id?: string }).attendant_id
    const scale: NpsScale = ((pm as { nps_scale?: string }).nps_scale as NpsScale) || 'categorical'

    // Voto mais recente desta enquete → label do score
    const { data: vote } = await supabase
      .from('poll_responses')
      .select('selected_options, numeric_score')
      .eq('poll_message_id', pollMessageId)
      .order('voted_at', { ascending: false })
      .maybeSingle()
    const selected = (vote as { selected_options?: string[] } | null)?.selected_options || []
    const label = scoreLabel(selected, scale)

    // Config do agente (canais)
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('poll_nps_manager_alert_whatsapp, poll_nps_notify_on_bad')
      .eq('instance_id', instanceId)
      .maybeSingle()
    const alertWhatsapp = (agent as { poll_nps_manager_alert_whatsapp?: boolean } | null)?.poll_nps_manager_alert_whatsapp === true
    const notifyInApp = (agent as { poll_nps_notify_on_bad?: boolean } | null)?.poll_nps_notify_on_bad !== false

    // Cliente + atendente + resumo
    let customerName: string | null = null
    let customerPhone: string | null = null
    let cachedSummary: unknown = null
    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('ai_summary, contacts(name, phone, jid)')
        .eq('id', conversationId)
        .maybeSingle()
      const ct = (conv as { contacts?: { name?: string; phone?: string; jid?: string } } | null)?.contacts
      customerName = ct?.name || null
      customerPhone = ct?.phone || (ct?.jid ? ct.jid.replace(/@s\.whatsapp\.net$/i, '').replace(/[^\d]/g, '') : null)
      cachedSummary = (conv as { ai_summary?: unknown } | null)?.ai_summary || null
    }
    let attendantName: string | null = null
    if (attendantId) {
      const { data: att } = await supabase.from('user_profiles').select('full_name').eq('id', attendantId).maybeSingle()
      attendantName = (att as { full_name?: string } | null)?.full_name || null
    }
    const summary = conversationId ? await buildSummary(conversationId, cachedSummary) : null

    const alertText = buildManagerAlertText({ scoreLabel: label, customerName, customerPhone, attendantName, summary })

    // Gestores: user_roles gerente/super_admin → user_profiles (personal_whatsapp + guardas)
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['gerente', 'super_admin'])
    const managerIds = Array.from(new Set((roleRows as Array<{ user_id: string }> | null || []).map((r) => r.user_id)))
    if (managerIds.length === 0) {
      log.info('no_managers', { pollMessageId })
      return json({ ok: true, managers: 0 }, 200, cors)
    }
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, personal_whatsapp, notifications_paused_until, notify_on_assignment')
      .in('id', managerIds)

    // Token da instância (pro WhatsApp)
    let token: string | null = null
    if (alertWhatsapp && instanceId) {
      const { data: inst } = await supabase.from('instances').select('token').eq('id', instanceId).maybeSingle()
      token = (inst as { token?: string } | null)?.token || null
    }

    let whatsappSent = 0
    let inAppSent = 0
    for (const mgr of (profiles as Array<{
      id: string; full_name: string | null; personal_whatsapp: string | null
      notifications_paused_until: string | null; notify_on_assignment: boolean
    }> | null || [])) {
      // In-app (sempre, se notify_on_bad ligado) — enriquecido
      if (notifyInApp) {
        try {
          await supabase.from('notifications').insert({
            user_id: mgr.id,
            type: 'nps_bad_note',
            title: `NPS baixo (${label})`,
            message: alertText,
            metadata: {
              poll_message_id: pollMessageId,
              conversation_id: conversationId,
              score_label: label,
              customer_name: customerName,
              customer_phone: customerPhone,
              attendant_id: attendantId,
              attendant_name: attendantName,
              summary,
            },
            read: false,
          })
          inAppSent++
        } catch { /* não-crítico */ }
      }
      // WhatsApp (opt-in) — respeita opt-out + pausa
      if (alertWhatsapp && token && mgr.personal_whatsapp && mgr.notify_on_assignment !== false) {
        const paused = mgr.notifications_paused_until && new Date(mgr.notifications_paused_until).getTime() > Date.now()
        if (!paused) {
          const r = await sendUazapiText(token, mgr.personal_whatsapp, alertText)
          if (r.ok) whatsappSent++
        }
      }
    }

    log.info('nps_manager_alert', { pollMessageId, label, whatsappSent, inAppSent })
    return json({ ok: true, whatsapp_sent: whatsappSent, in_app_sent: inAppSent }, 200, cors)
  } catch (err) {
    log.error('notify-manager-nps error', { error: (err as Error).message })
    return json({ ok: false, error: 'internal_error' }, 200, cors)
  }
})
