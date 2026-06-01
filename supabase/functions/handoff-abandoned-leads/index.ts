// =============================================================================
// handoff-abandoned-leads — Sprint E.2 (cron 1min)
//
// Transbordo automático por inatividade. DOIS caminhos (flags distintas):
//
//   T1 — PENDENTE (`abandon_handoff_enabled`): conversa com a tag
//     `seller_handoff_pending:*` (a IA fez a pergunta da marca e está esperando).
//       Estágio 1 (nudge): após `abandon_nudge_after_min` sem resposta → cutuca
//         o lead ("Ainda tá por aí? 😊") e marca tag `abandon_nudged:{ms}`.
//       Estágio 2 (handoff): após `abandon_handoff_after_min` da cutucada ainda
//         sem resposta → entrega o lead pro vendedor + nota interna.
//
//   T2 — INATIVIDADE genérica (`inactivity_handoff_enabled`, v7.65.0): QUALQUER
//     lead silencioso. Após `inactivity_handoff_after_min` (default 3) sem
//     resposta → transbordo DIRETO (sem cutucada). Guarda-corpos: só se o lead
//     já interagiu ao menos 1x E a conversa não terminou em despedida.
//
// Se o lead respondeu em qualquer ponto, NÃO agimos — o pré-router do ai-agent
// força o handoff normal na resposta dele.
//
// Reusa as MESMAS primitivas do dispatchResponse step 22 (assignHandoff,
// personalizeHandoffMessage, formatCart*) — zero duplicação de regra de negócio.
//
// Auth: verify_jwt=false + verifyCronOrService (pg_cron com vault.CRON_AUTH_KEY).
// =============================================================================

import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'
import { assignHandoff } from '../_shared/handoffQueue.ts'
import {
  isOutsideBusinessHours,
  enrichOutsideHoursMessage,
  personalizeHandoffMessage,
} from '../_shared/businessHours.ts'
import { normalizeCart, formatCartOneLine, formatCartSummary } from '../_shared/agent/cart.ts'
import {
  decideAbandonStage,
  looksLikeConversationClosed,
  parseNudgedAtMs,
  parsePendingTrigger,
  personalizeNudge,
  DEFAULT_NUDGE_MESSAGE,
} from '../_shared/agent/abandonHandoff.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_URL = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

interface Candidate {
  conversation_id: string
  inbox_id: string
  contact_id: string | null
  department_id: string | null
  inbox_default_department_id: string | null
  tags: string[] | null
  cart_items: unknown
  last_message_at: string | null
  contact_jid: string | null
  instance_token: string | null
  agent_id: string
  // deno-lint-ignore no-explicit-any
  business_hours: Record<string, any> | null
  extended_hours_until: string | null
  handoff_message: string | null
  handoff_message_outside_hours: string | null
  notify_outside_hours_on_handoff: boolean | null
  abandon_handoff_enabled: boolean | null
  abandon_nudge_after_min: number | null
  abandon_handoff_after_min: number | null
  abandon_nudge_message: string | null
  inactivity_handoff_enabled: boolean | null
  inactivity_handoff_after_min: number | null
  has_pending_handoff: boolean | null
}

/** Broadcast pro helpdesk atualizar status/badge. Falha silente. */
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

/** created_at da última mensagem do BOT (outgoing + sender_id NULL). */
async function lastBotMessageAt(supabase: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('conversation_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'outgoing')
    .is('sender_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at ?? null
}

/** Última mensagem do LEAD (incoming): created_at + conteúdo (p/ detectar encerramento). */
async function lastIncomingMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ createdAt: string; content: string | null } | null> {
  const { data } = await supabase
    .from('conversation_messages')
    .select('created_at, content')
    .eq('conversation_id', conversationId)
    .eq('direction', 'incoming')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.created_at) return null
  return { createdAt: data.created_at, content: data.content ?? null }
}

/** Primeiro nome confirmado do lead (lead_profiles.full_name). */
async function leadFullName(supabase: SupabaseClient, contactId: string | null): Promise<string | null> {
  if (!contactId) return null
  const { data } = await supabase
    .from('lead_profiles')
    .select('full_name')
    .eq('contact_id', contactId)
    .maybeSingle()
  return data?.full_name ?? null
}

/** Envia texto via UAZAPI. Retorna true se enviou. */
async function sendText(token: string, jid: string, text: string, log: ReturnType<typeof createLogger>): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${UAZAPI_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number: jid, text }),
    }, 10000)
    return res.ok
  } catch (e) {
    log.warn('UAZAPI send failed', { error: (e as Error).message })
    return false
  }
}

// @ts-ignore -- Deno serve
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createServiceClient()
  const log = createLogger('handoff-abandoned-leads')
  const stats = { scanned: 0, nudged: 0, handed_off: 0, skipped: 0, errors: 0 }

  const { data: candidates, error } = await supabase
    .rpc('find_abandoned_handoff_candidates', { p_limit: 50 })

  if (error) {
    log.warn('Failed to fetch candidates', { error: error.message })
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  for (const c of (candidates || []) as Candidate[]) {
    stats.scanned++
    try {
      // Gate de horário comercial: só cutuca/transborda DENTRO do expediente.
      // Lead que abandona de madrugada/fim de semana espera o expediente reabrir
      // (timers medem do último contato; ao reabrir, dispara). Evita pingar o lead
      // fora de hora e acionar vendedor offline.
      if (isOutsideBusinessHours(c.business_hours, c.extended_hours_until)) {
        stats.skipped++
        continue
      }

      const botAt = await lastBotMessageAt(supabase, c.conversation_id)
      if (!botAt) { stats.skipped++; continue } // sem msg do bot → não é abandono pós-pergunta

      const incoming = await lastIncomingMessage(supabase, c.conversation_id)
      const incomingAt = incoming?.createdAt ?? null
      const leadRepliedSinceBot = !!(incomingAt && new Date(incomingAt).getTime() > new Date(botAt).getTime())
      const leadEverReplied = !!incomingAt // T2: só transborda quem já interagiu
      const conversationClosed = looksLikeConversationClosed(incoming?.content) // T2: pula despedidas
      const nudgedAtMs = parseNudgedAtMs(c.tags)

      const stage = decideAbandonStage({
        nudgeAfterMin: Number(c.abandon_nudge_after_min) || 0,
        handoffAfterMin: Number(c.abandon_handoff_after_min) || 0,
        lastBotMessageAt: botAt,
        nudgedAtMs,
        leadRepliedSinceBot,
        pendingEnabled: !!c.abandon_handoff_enabled,
        hasPendingTag: !!c.has_pending_handoff,
        inactivityEnabled: !!c.inactivity_handoff_enabled,
        inactivityAfterMin: Number(c.inactivity_handoff_after_min) || 0,
        leadEverReplied,
        conversationClosed,
      })

      if (stage === 'none') { stats.skipped++; continue }
      if (!c.contact_jid || !c.instance_token) { stats.skipped++; continue }

      const leadName = await leadFullName(supabase, c.contact_id)

      // ─── ESTÁGIO 1: cutucada ──────────────────────────────────────────────
      if (stage === 'nudge') {
        const base = (c.abandon_nudge_message || '').trim() || DEFAULT_NUDGE_MESSAGE
        const text = personalizeNudge(base, leadName)
        const sent = await sendText(c.instance_token, c.contact_jid, text, log)
        if (!sent) { stats.errors++; continue }

        await supabase.from('conversation_messages').insert({
          conversation_id: c.conversation_id, direction: 'outgoing',
          content: text, media_type: 'text',
          external_id: `abandon_nudge_${c.conversation_id}_${Date.now()}`,
        })
        // marca a cutucada (não repetir + medir estágio 2)
        const newTags = [...(c.tags || []), `abandon_nudged:${Date.now()}`]
        await supabase.from('conversations').update({ tags: newTags }).eq('id', c.conversation_id)
        await supabase.from('ai_agent_logs').insert({
          agent_id: c.agent_id, conversation_id: c.conversation_id,
          event: 'abandon_nudge', metadata: { nudge_after_min: c.abandon_nudge_after_min },
        })
        broadcastQueueUpdate({ conversation_id: c.conversation_id, kind: 'abandon_nudge' })
        stats.nudged++
        continue
      }

      // ─── transbordo (T1 estágio 2 OU T2 inatividade direta) ────────────────
      // viaInactivity: handoff genérico (sem tag pendente). Muda só a razão/nota
      // pro vendedor — a entrega na fila é idêntica.
      const viaInactivity = !c.has_pending_handoff
      const cartItems = normalizeCart(c.cart_items)
      const cartOneLine = formatCartOneLine(cartItems)
      const cartFull = formatCartSummary(cartItems)
      const silentMin = Math.round((Date.now() - new Date(botAt).getTime()) / 60_000)
      const trigger = viaInactivity
        ? (cartOneLine ? `Pedido em andamento: ${cartOneLine}` : 'Lead conversando com a IA')
        : parsePendingTrigger(c.tags)

      const notifyOutside = c.notify_outside_hours_on_handoff !== false
      const outsideHours = notifyOutside && isOutsideBusinessHours(c.business_hours, c.extended_hours_until)
      const rawBase = outsideHours
        ? (c.handoff_message_outside_hours
            ? enrichOutsideHoursMessage(c.handoff_message_outside_hours, c.business_hours)
            : null)
        : (c.handoff_message || null)
      const baseMsg = rawBase || 'Só um instante, vou te encaminhar para nosso consultor de vendas.'
      // No caso de inatividade sem carrinho, não inventa "pedido" no texto pro lead.
      const handoffMsg = personalizeHandoffMessage(baseMsg, {
        leadName,
        itemSummary: viaInactivity ? (cartOneLine || null) : (cartOneLine || trigger),
      })

      // Atribui via fila (resolve dept: o da conversa OU o default da inbox).
      const deptId = c.department_id || c.inbox_default_department_id || null
      const queueRes = await assignHandoff({
        supabase,
        conversation_id: c.conversation_id,
        department_id: deptId,
        logger: log,
      })

      const sent = await sendText(c.instance_token, c.contact_jid, handoffMsg, log)
      if (sent) {
        await supabase.from('conversation_messages').insert({
          conversation_id: c.conversation_id, direction: 'outgoing',
          content: handoffMsg, media_type: 'text',
          external_id: `abandon_handoff_${c.conversation_id}_${Date.now()}`,
        })
      }

      // status_ia=shadow + limpa tags de abandono (preserva o resto, troca ia:*).
      const cleanedTags = (c.tags || []).filter(
        (t) => typeof t === 'string'
          && !t.startsWith('ia:')
          && !t.startsWith('seller_handoff_pending:')
          && !t.startsWith('abandon_nudged:'),
      )
      cleanedTags.push('ia:shadow')
      await supabase.from('conversations').update({
        status_ia: 'shadow',
        tags: cleanedTags,
        lead_msg_count: 0, // R86: não re-disparar auto-handoff num retorno
      }).eq('id', c.conversation_id)

      // Nota interna pro vendedor (NUNCA vai pro lead).
      const noteHeader = viaInactivity
        ? `📋 Transbordo automático — lead ficou ${silentMin}min sem responder à IA (interno):`
        : '📋 Resumo do pedido (interno):'
      const noteBody = viaInactivity
        ? (cartFull ? `🛒 ${cartFull}` : 'Lead estava em conversa com a IA e parou de responder. Sem itens no carrinho.')
        : [trigger, cartFull ? `🛒 ${cartFull}` : ''].filter(Boolean).join('\n\n').trim()
      if (noteBody) {
        await supabase.from('conversation_messages').insert({
          conversation_id: c.conversation_id, direction: 'private_note',
          content: `${noteHeader}\n${noteBody}`, media_type: 'text',
        })
      }

      await supabase.from('ai_agent_logs').insert({
        agent_id: c.agent_id, conversation_id: c.conversation_id,
        event: 'handoff_trigger',
        metadata: {
          trigger, abandoned: true, deferred: true,
          inactivity: viaInactivity, silent_min: silentMin,
          outside_hours: outsideHours,
          cart_items: cartItems, order_summary: cartFull || null,
          queue: queueRes,
        },
      })
      broadcastQueueUpdate({
        conversation_id: c.conversation_id,
        kind: viaInactivity ? 'inactivity_handoff' : 'abandon_handoff',
        assigned_user_id: queueRes.assigned_user_id,
      })
      stats.handed_off++
    } catch (e) {
      stats.errors++
      log.warn('Error processing candidate', { conversation_id: c.conversation_id, error: (e as Error).message })
    }
  }

  log.info('done', stats)
  return new Response(JSON.stringify({ ok: true, ...stats }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
