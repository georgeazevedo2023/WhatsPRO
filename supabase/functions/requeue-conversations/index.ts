// =============================================================================
// requeue-conversations — D30 Sprint C (cron 1min)
//
// Para cada handoff_queue_events com status='active' AND expires_at < now()
// AND paused_at IS NULL, decide entre 5 destinos:
//
//   (A) atendente saiu do dept (department_members deletada) → status=timed_out
//       + cria novo evento ativo via pick_next_assignee (skip do antigo).
//   (B) horário comercial fechou → set paused_at=now(), envia
//       out_of_hours_message UMA VEZ (flag out_of_hours_msg_sent), continua.
//   (C) atendente respondeu (1 outgoing após event.created_at + 5s) →
//       status=responded.
//   (D) timeout default → status=timed_out + pick_next_assignee (skip do antigo)
//       + novo evento ativo + UPDATE conversations.assigned_to.
//   (E) loop completo (rotation_number > membros elegíveis) → notifica gestor
//       sino mas SEGUE atribuindo.
//
// PARTE 2 — Reativação:
//   Para cada paused_at IS NOT NULL: se horário REABRIU →
//   paused_at=null + expires_at=now()+timeout (5min completos, regra Q5).
//
// Auth: verify_jwt=false + verifyCronOrService (chamado por pg_cron com
// SUPABASE_ANON_KEY do vault).
// =============================================================================

import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'
import { assignHandoff } from '../_shared/handoffQueue.ts'
import { isOutsideBusinessHours } from '../_shared/businessHours.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_URL = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'

const RESPONDED_GRACE_SECONDS = 5  // ignora outgoing nos 5s após criação do evento

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

/** Broadcast pro helpdesk pra atualizar badge "Em fila" / status. */
function broadcastQueueUpdate(payload: Record<string, unknown>) {
  for (const topic of ['helpdesk-realtime', 'helpdesk-conversations']) {
    fetchFireAndForget(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic, event: 'queue-update', payload }] }),
    })
  }
}

/** Notifica gestores (super_admin) — sino. Falha silente.
 *  2026-05-14: dedup idempotente — se já há uma notification do mesmo tipo +
 *  conversa nas últimas 6h, NÃO cria outra. Bloqueia explosão (136k notifs/9h
 *  no incidente do sandbox).
 */
async function notifyGestores(
  supabase: SupabaseClient,
  type: string,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  try {
    const convId = (metadata as Record<string, string>)?.conversation_id
    if (convId) {
      const sinceIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', type)
        .filter('metadata->>conversation_id', 'eq', convId)
        .gte('created_at', sinceIso)
        .limit(1)
        .maybeSingle()
      if (existing) return  // dedup: já tem alerta recente pra essa conversa
    }

    const { data: gestores } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['super_admin', 'gerente'])
    if (!gestores || gestores.length === 0) return
    const rows = gestores.map((g: { user_id: string }) => ({
      user_id: g.user_id, type, title, message, metadata,
    }))
    await supabase.from('notifications').insert(rows)
  } catch { /* silent */ }
}

/** Carrega o agente da inbox da conversa pra checar horário comercial. */
async function loadAgentForConversation(supabase: SupabaseClient, conversationId: string) {
  // 2026-05-17 (Bug 15b) — contact_id era omitido aqui, fazendo o Case B
  // (envio do out_of_hours_message) buscar contato com id vazio e falhar
  // silenciosamente. Resultado: out_of_hours_msg_sent permanecia false e o
  // lead nunca era avisado que estava fora do horário.
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, inbox_id, contact_id, assigned_to')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) return { conv: null, inbox: null, agent: null, instance: null }

  const { data: inbox } = await supabase
    .from('inboxes')
    .select('id, instance_id, default_department_id')
    .eq('id', conv.inbox_id)
    .maybeSingle()
  if (!inbox?.instance_id) return { conv, inbox, agent: null, instance: null }

  const [{ data: agent }, { data: instance }] = await Promise.all([
    supabase.from('ai_agents')
      .select('id, business_hours, extended_hours_until, out_of_hours_message')
      .eq('instance_id', inbox.instance_id)
      .eq('enabled', true)
      .maybeSingle(),
    supabase.from('instances').select('token').eq('id', inbox.instance_id).maybeSingle(),
  ])
  return { conv, inbox, agent, instance }
}

/** Conta membros elegíveis na fila (não pausados, gestor opt-in respeitado). */
async function countEligibleMembers(supabase: SupabaseClient, departmentId: string): Promise<number> {
  // Conta TODOS não-pausados; gestor é minoria, ignorar imprecisão pro sino.
  const { count } = await supabase
    .from('department_members')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', departmentId)
    .eq('queue_paused', false)
  return count || 0
}

/** Caso C: detecta se algum atendente respondeu após criação do evento. */
async function detectResponded(
  supabase: SupabaseClient,
  conversationId: string,
  eventCreatedAt: string,
): Promise<boolean> {
  const cutoff = new Date(new Date(eventCreatedAt).getTime() + RESPONDED_GRACE_SECONDS * 1000).toISOString()
  const { count } = await supabase
    .from('conversation_messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('direction', 'outgoing')
    .gte('created_at', cutoff)
  return (count || 0) > 0
}

// @ts-ignore -- Deno serve config
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createServiceClient()
  const log = createLogger('requeue-conversations')

  const stats = {
    expired_processed: 0,
    case_a_orphan: 0,
    case_b_paused: 0,
    case_c_responded: 0,
    case_d_reattributed: 0,
    case_e_loop_alert: 0,
    no_eligible_alert: 0,
    paused_resumed: 0,
    errors: 0,
  }

  // ─── PARTE 1 — eventos ATIVOS expirados (não pausados) ─────────────────────
  const { data: expiredEvents, error: expErr } = await supabase
    .from('handoff_queue_events')
    .select('id, conversation_id, department_id, assigned_user_id, expires_at, rotation_number, out_of_hours_msg_sent, created_at')
    .eq('status', 'active')
    .is('paused_at', null)
    .lt('expires_at', new Date().toISOString())
    .limit(100)

  if (expErr) {
    log.warn('Failed to fetch expired events', { error: expErr.message })
  }

  for (const ev of expiredEvents || []) {
    stats.expired_processed++
    try {
      const { conv, inbox, agent, instance } = await loadAgentForConversation(supabase, ev.conversation_id)

      if (!conv) {
        // Conversa apagada — cancela evento
        await supabase.from('handoff_queue_events').update({
          status: 'cancelled', resolved_at: new Date().toISOString(), resolved_reason: 'conversation_deleted',
        }).eq('id', ev.id)
        continue
      }

      // ─── Case B: horário comercial fechou ───────────────────────────────
      if (agent && isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)) {
        const updates: Record<string, unknown> = { paused_at: new Date().toISOString() }
        let oofMessageSent = false

        if (!ev.out_of_hours_msg_sent && agent.out_of_hours_message && instance?.token) {
          // Busca contato + envia via UAZAPI
          const { data: contact } = await supabase
            .from('contacts').select('jid').eq('id', conv.contact_id ?? '').maybeSingle()
          if (contact?.jid) {
            try {
              const res = await fetchWithTimeout(`${UAZAPI_URL}/send/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', token: instance.token },
                body: JSON.stringify({ number: contact.jid, text: agent.out_of_hours_message }),
              }, 10000)
              if (res.ok) {
                oofMessageSent = true
                await supabase.from('conversation_messages').insert({
                  conversation_id: ev.conversation_id, direction: 'outgoing',
                  content: agent.out_of_hours_message, media_type: 'text',
                  external_id: `queue_oof_${ev.id}`,
                })
              }
            } catch (e) {
              log.warn('UAZAPI out_of_hours send failed', { error: (e as Error).message })
            }
          }
        }
        if (oofMessageSent) updates.out_of_hours_msg_sent = true

        await supabase.from('handoff_queue_events').update(updates).eq('id', ev.id)
        broadcastQueueUpdate({ event_id: ev.id, conversation_id: ev.conversation_id, kind: 'paused', oof_sent: oofMessageSent })
        stats.case_b_paused++
        continue
      }

      // ─── Case C: atendente respondeu? ──────────────────────────────────
      const responded = ev.assigned_user_id
        ? await detectResponded(supabase, ev.conversation_id, ev.created_at)
        : false
      if (responded) {
        await supabase.from('handoff_queue_events').update({
          status: 'responded', resolved_at: new Date().toISOString(), resolved_reason: 'outgoing_after_assignment',
        }).eq('id', ev.id)
        broadcastQueueUpdate({ event_id: ev.id, conversation_id: ev.conversation_id, kind: 'responded' })
        stats.case_c_responded++
        continue
      }

      // ─── Case A/D: orphan check + reatribuir ───────────────────────────
      const isOrphan = ev.assigned_user_id
        ? !(await supabase
            .from('department_members')
            .select('user_id')
            .eq('department_id', ev.department_id)
            .eq('user_id', ev.assigned_user_id)
            .maybeSingle()).data
        : false

      // Marca atual como timed_out (ou orphan)
      await supabase.from('handoff_queue_events').update({
        status: 'timed_out',
        resolved_at: new Date().toISOString(),
        resolved_reason: isOrphan ? 'orphan_assignee' : 'timeout',
      }).eq('id', ev.id)
      if (isOrphan) stats.case_a_orphan++

      // Tenta reatribuir
      const skipIds = ev.assigned_user_id ? [ev.assigned_user_id] : []
      const newAssignment = await assignHandoff({
        supabase,
        conversation_id: ev.conversation_id,
        department_id: ev.department_id,
        previous_assignee_id: null,  // já tentamos no Sprint B; aqui vai pra fila normal
        skip_user_ids: skipIds,
        logger: log,
      })

      if (!newAssignment.assigned_user_id) {
        // Nenhum atendente elegível → sino gestor
        await notifyGestores(
          supabase,
          'handoff_queue_no_eligible',
          'Fila esgotada',
          `Conversa sem atendente disponível (departamento ${ev.department_id}).`,
          { conversation_id: ev.conversation_id, department_id: ev.department_id, reason: newAssignment.reason },
        )
        broadcastQueueUpdate({ event_id: ev.id, conversation_id: ev.conversation_id, kind: 'no_eligible' })
        stats.no_eligible_alert++
        continue
      }

      // Atualiza rotation_number do NOVO evento criado pelo helper
      const newRotation = (ev.rotation_number || 0) + 1
      if (newAssignment.queue_event_id) {
        await supabase.from('handoff_queue_events').update({
          rotation_number: newRotation,
          previous_assignee_id: ev.assigned_user_id,
        }).eq('id', newAssignment.queue_event_id)
      }

      stats.case_d_reattributed++

      // ─── Case E: loop completo? ────────────────────────────────────────
      const eligibleCount = await countEligibleMembers(supabase, ev.department_id)
      if (eligibleCount > 0 && newRotation > eligibleCount) {
        await notifyGestores(
          supabase,
          'handoff_queue_full_rotation',
          'Fila deu volta completa',
          `Conversa ${ev.conversation_id} já passou por todos os atendentes do dept sem resposta.`,
          { conversation_id: ev.conversation_id, department_id: ev.department_id, rotation: newRotation, eligible: eligibleCount },
        )
        stats.case_e_loop_alert++
      }

      broadcastQueueUpdate({
        event_id: newAssignment.queue_event_id, conversation_id: ev.conversation_id,
        kind: 'reattributed', assigned_user_id: newAssignment.assigned_user_id, rotation: newRotation,
      })
    } catch (e) {
      stats.errors++
      log.warn('Error processing expired event', { event_id: ev.id, error: (e as Error).message })
    }
  }

  // ─── PARTE 2 — eventos PAUSADOS (horário pode ter reaberto) ────────────────
  const { data: pausedEvents, error: pausedErr } = await supabase
    .from('handoff_queue_events')
    .select('id, conversation_id, department_id')
    .eq('status', 'active')
    .not('paused_at', 'is', null)
    .limit(100)

  if (pausedErr) {
    log.warn('Failed to fetch paused events', { error: pausedErr.message })
  }

  for (const ev of pausedEvents || []) {
    try {
      const { conv, agent } = await loadAgentForConversation(supabase, ev.conversation_id)
      if (!conv || !agent) continue
      if (isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)) continue  // ainda fora

      // Busca timeout do dept
      const { data: dept } = await supabase
        .from('departments').select('queue_mode_timeout_minutes')
        .eq('id', ev.department_id).maybeSingle()
      const timeoutMin = Number(dept?.queue_mode_timeout_minutes) || 5

      // Reseta com timeout COMPLETO (Q5) — não saldo
      const newExpiresAt = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString()
      await supabase.from('handoff_queue_events').update({
        paused_at: null, expires_at: newExpiresAt,
      }).eq('id', ev.id)
      broadcastQueueUpdate({ event_id: ev.id, conversation_id: ev.conversation_id, kind: 'resumed', expires_at: newExpiresAt })
      stats.paused_resumed++
    } catch (e) {
      stats.errors++
      log.warn('Error resuming paused event', { event_id: ev.id, error: (e as Error).message })
    }
  }

  log.info('done', stats)
  return new Response(JSON.stringify({ ok: true, ...stats }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
