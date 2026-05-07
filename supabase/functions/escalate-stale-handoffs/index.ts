// =============================================================================
// escalate-stale-handoffs — Gap C escalation cron (1min)
//
// Varre `notification_log` com status='sent' e detecta:
//   1. Conv atribuída há 5+ min SEM resposta do vendor + não foi re-pingado:
//      → re-ping pro vendor (nova msg "Lead ainda esperando, atender por favor")
//      → grava `re_pinged_at = now()`
//
//   2. Conv atribuída há 10+ min SEM resposta + não foi alertado gerente:
//      → manda alerta pro(s) gerente(s) do dept ("Lead órfão há 10min — Lucas
//        não respondeu")
//      → grava `manager_alerted_at = now()`
//
// "Resposta do vendor" = `conversation_messages.direction='outgoing'` E
// `sender_id = assigned_to` com `created_at > assigned_at`.
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { sendUazapiText } from '../_shared/sendWhatsApp.ts'

// @ts-ignore -- Deno
const supabase = createServiceClient()

const RE_PING_AFTER_MIN = 5
const MANAGER_ALERT_AFTER_MIN = 10

interface NotifRow {
  id: string
  conversation_id: string
  assigned_to_id: string
  instance_id: string | null
  sent_at: string
  re_pinged_at: string | null
  manager_alerted_at: string | null
}

async function vendorResponded(conversation_id: string, assigned_to_id: string, since: string): Promise<boolean> {
  const { count } = await supabase
    .from('conversation_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation_id)
    .eq('direction', 'outgoing')
    .eq('sender_id', assigned_to_id)
    .gte('created_at', since)
  return (count ?? 0) > 0
}

async function rePing(row: NotifRow, log: ReturnType<typeof createLogger>): Promise<void> {
  const { data: vendor } = await supabase
    .from('user_profiles')
    .select('full_name, personal_whatsapp, whatsapp_session_until, notifications_paused_until, notify_on_assignment')
    .eq('id', row.assigned_to_id)
    .maybeSingle()
  if (!vendor || !vendor.personal_whatsapp || !vendor.notify_on_assignment) return
  if (vendor.notifications_paused_until && new Date(vendor.notifications_paused_until).getTime() > Date.now()) return
  if (!vendor.whatsapp_session_until || new Date(vendor.whatsapp_session_until).getTime() < Date.now()) return

  if (!row.instance_id) return
  const { data: inst } = await supabase
    .from('instances').select('token').eq('id', row.instance_id).maybeSingle()
  const token = (inst as { token?: string } | null)?.token
  if (!token) return

  const { data: conv } = await supabase
    .from('conversations').select('contact_name, contact_phone').eq('id', row.conversation_id).maybeSingle()
  const leadName = (conv as { contact_name?: string | null } | null)?.contact_name || 'cliente'
  const firstName = (vendor.full_name || '').trim().split(/\s+/)[0] || 'membro'

  const text = [
    `⏰ ${firstName}, o lead ${leadName} ainda está esperando.`,
    ``,
    `Já tem ${RE_PING_AFTER_MIN} min que o atendimento foi atribuído pra você. Atender agora pra não perder a venda.`,
  ].join('\n')

  const result = await sendUazapiText(token, vendor.personal_whatsapp, text)
  await supabase.from('notification_log').update({ re_pinged_at: new Date().toISOString() }).eq('id', row.id)
  log.info('escalation_re_ping', { id: row.id, ok: result.ok })
}

async function alertManagers(row: NotifRow, log: ReturnType<typeof createLogger>): Promise<void> {
  // Pega dept(s) do vendor pelo conv (campo assigned_to_id no row)
  const { data: conv } = await supabase
    .from('conversations')
    .select('department_id, contact_name')
    .eq('id', row.conversation_id)
    .maybeSingle()
  if (!conv?.department_id) return

  // Gerentes do mesmo dept
  const { data: members } = await supabase
    .from('department_members')
    .select('user_id')
    .eq('department_id', conv.department_id)
  if (!members || members.length === 0) return

  const userIds = (members as { user_id: string }[]).map(m => m.user_id)
  if (userIds.length === 0) return

  const { data: managers } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('user_id', userIds)
    .in('role', ['gerente', 'super_admin'])

  if (!managers || managers.length === 0) return

  const managerIds = (managers as { user_id: string }[]).map(m => m.user_id)

  const { data: managerProfiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, personal_whatsapp, whatsapp_session_until, notifications_paused_until, notify_on_assignment')
    .in('id', managerIds)

  if (!managerProfiles) return

  if (!row.instance_id) return
  const { data: inst } = await supabase
    .from('instances').select('token').eq('id', row.instance_id).maybeSingle()
  const token = (inst as { token?: string } | null)?.token
  if (!token) return

  const { data: vendor } = await supabase
    .from('user_profiles').select('full_name').eq('id', row.assigned_to_id).maybeSingle()
  const vendorName = ((vendor as { full_name?: string | null } | null)?.full_name || 'Vendedor').trim()
  const leadName = (conv.contact_name as string | null) || 'cliente'

  for (const mgr of (managerProfiles as Array<{
    id: string; full_name: string | null; personal_whatsapp: string | null;
    whatsapp_session_until: string | null; notifications_paused_until: string | null;
    notify_on_assignment: boolean;
  }>)) {
    if (mgr.id === row.assigned_to_id) continue // não alerta o próprio
    if (!mgr.personal_whatsapp || !mgr.notify_on_assignment) continue
    if (mgr.notifications_paused_until && new Date(mgr.notifications_paused_until).getTime() > Date.now()) continue
    if (!mgr.whatsapp_session_until || new Date(mgr.whatsapp_session_until).getTime() < Date.now()) continue

    const mgrFirst = (mgr.full_name || '').trim().split(/\s+/)[0] || 'gestor'
    const text = [
      `🚨 Lead órfão, ${mgrFirst}!`,
      ``,
      `${leadName} foi atribuído a ${vendorName} há ${MANAGER_ALERT_AFTER_MIN} min e ele não respondeu.`,
      ``,
      `Considere reatribuir manualmente no helpdesk.`,
    ].join('\n')
    await sendUazapiText(token, mgr.personal_whatsapp, text)
  }

  await supabase.from('notification_log').update({ manager_alerted_at: new Date().toISOString() }).eq('id', row.id)
  log.info('escalation_manager_alert', { id: row.id, managers: managerProfiles.length })
}

// @ts-ignore -- Deno.serve
Deno.serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const log = createLogger('escalate-stale-handoffs')
  const startedAt = Date.now()

  try {
    const cutoffRePing = new Date(Date.now() - RE_PING_AFTER_MIN * 60 * 1000).toISOString()
    const cutoffManager = new Date(Date.now() - MANAGER_ALERT_AFTER_MIN * 60 * 1000).toISOString()

    // Busca rows enviadas há 5+ min ainda não escaladas (qualquer estágio).
    const { data: candidates } = await supabase
      .from('notification_log')
      .select('id, conversation_id, assigned_to_id, instance_id, sent_at, re_pinged_at, manager_alerted_at')
      .eq('status', 'sent')
      .lte('sent_at', cutoffRePing)
      .or('re_pinged_at.is.null,manager_alerted_at.is.null')
      .limit(50)

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, ms: Date.now() - startedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let rePinged = 0
    let alerted = 0

    for (const row of candidates as NotifRow[]) {
      // Vendor já respondeu? Skipa tudo.
      const responded = await vendorResponded(row.conversation_id, row.assigned_to_id, row.sent_at)
      if (responded) continue

      // 5min escalation
      if (!row.re_pinged_at && row.sent_at <= cutoffRePing) {
        await rePing(row, log)
        rePinged++
      }

      // 10min escalation
      if (!row.manager_alerted_at && row.sent_at <= cutoffManager) {
        await alertManagers(row, log)
        alerted++
      }
    }

    log.info('escalation_summary', {
      candidates: candidates.length, re_pinged: rePinged, manager_alerted: alerted,
      ms: Date.now() - startedAt,
    })

    return new Response(JSON.stringify({
      ok: true, processed: candidates.length, re_pinged: rePinged, manager_alerted: alerted,
      ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    log.warn('escalation_error', { error: (err as Error).message })
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
