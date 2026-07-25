// =============================================================================
// daily-manager-report — "Resumo do dia" pro WhatsApp dos GESTORES.
//
// Agrega as métricas do dia via RPC get_daily_manager_report (1 chamada,
// server-side) e envia o texto formatado (dailyReport.ts) via UAZAPI.
//
// Body:
//   { instance_id: string,       — instância alvo (ex.: re662a6d32de7e0)
//     day?: 'YYYY-MM-DD',        — default: hoje (America/Sao_Paulo)
//     test_phone?: string,       — MODO TESTE: envia SÓ pra esse número
//     title?: string }           — título do cabeçalho (default: nome do agente)
//
// Sem test_phone → envia pros gestores (user_roles gerente/super_admin) com
// personal_whatsapp cadastrado, respeitando opt-out e pausa de notificações
// (mesmo critério do notify-manager-nps).
//
// Auth: verify_jwt=false + verifyCronOrService (cron/service-role only).
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { sendUazapiText } from '../_shared/sendWhatsApp.ts'
import { buildDailyReportText, type DailyReportData } from '../_shared/dailyReport.ts'

// @ts-ignore — Deno global
const supabase = createServiceClient()
const log = createLogger('daily-manager-report')

interface Body {
  instance_id: string
  day?: string
  test_phone?: string
  title?: string
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function spToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function spTimeHHMM(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  })
}

// @ts-ignore — Deno.serve
Deno.serve(async (req: Request) => {
  const cors = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (!verifyCronOrService(req)) return unauthorizedResponse(cors)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400, cors) }
  if (!body.instance_id) return json({ error: 'missing_instance_id' }, 400, cors)

  try {
    const { data: inst, error: instErr } = await supabase
      .from('instances')
      .select('id, name, token, disabled')
      .eq('id', body.instance_id)
      .maybeSingle()
    if (instErr) log.error('instance select error', { error: instErr.message })
    if (!inst) return json({ ok: false, error: 'instance_not_found' }, 404, cors)
    const token = (inst as { token?: string }).token || ''

    const { data: agent, error: agentErr } = await supabase
      .from('ai_agents')
      .select('name, business_hours')
      .eq('instance_id', body.instance_id)
      .maybeSingle()
    if (agentErr) log.error('agent select error', { error: agentErr.message })

    const { data: report, error: rpcErr } = await supabase
      .rpc('get_daily_manager_report', {
        p_instance_id: body.instance_id,
        p_day: body.day || null,
      })
    if (rpcErr || !report) {
      log.error('rpc error', { error: rpcErr?.message })
      return json({ ok: false, error: `rpc_failed: ${rpcErr?.message || 'empty'}` }, 500, cors)
    }

    const data = report as unknown as DailyReportData
    const isToday = data.day === spToday()
    const title = body.title
      || (agent as { name?: string } | null)?.name
      || (inst as { name?: string }).name
      || 'WhatsPRO'

    const text = buildDailyReportText({
      title,
      data,
      businessHours: (agent as { business_hours?: unknown } | null)?.business_hours as never,
      cutoffLabel: isToday ? `até ${spTimeHHMM()}` : 'dia completo',
      footer: '_Resumo automático WhatsPRO · crm.wsmart.com.br_',
    })

    // ── destinatários
    let recipients: Array<{ phone: string; label: string }> = []
    if (body.test_phone) {
      recipients = [{ phone: body.test_phone, label: 'test' }]
    } else {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['gerente', 'super_admin'])
      const managerIds = Array.from(new Set(
        (roleRows as Array<{ user_id: string }> | null || []).map((r) => r.user_id),
      ))
      if (managerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, personal_whatsapp, notifications_paused_until, notify_on_assignment')
          .in('id', managerIds)
        for (const mgr of (profiles as Array<{
          id: string; full_name: string | null; personal_whatsapp: string | null
          notifications_paused_until: string | null; notify_on_assignment: boolean
        }> | null || [])) {
          if (!mgr.personal_whatsapp || mgr.notify_on_assignment === false) continue
          const paused = mgr.notifications_paused_until
            && new Date(mgr.notifications_paused_until).getTime() > Date.now()
          if (paused) continue
          recipients.push({ phone: mgr.personal_whatsapp, label: mgr.full_name || mgr.id })
        }
      }
    }

    if (recipients.length === 0) {
      log.info('no_recipients', { instance: body.instance_id })
      return json({ ok: true, sent: 0, skipped: 'no_recipients', preview: text }, 200, cors)
    }

    let sent = 0
    const failures: Array<{ label: string; error?: string }> = []
    for (const r of recipients) {
      const res = await sendUazapiText(token, r.phone, text)
      if (res.ok) sent++
      else failures.push({ label: r.label, error: res.error })
    }

    log.info('daily_report_sent', {
      instance: body.instance_id, day: data.day, sent, failed: failures.length, test: !!body.test_phone,
    })
    return json({ ok: sent > 0, day: data.day, sent, failed: failures, preview: text }, 200, cors)
  } catch (err) {
    log.error('daily-manager-report error', { error: (err as Error).message })
    return json({ ok: false, error: 'internal_error' }, 500, cors)
  }
})
