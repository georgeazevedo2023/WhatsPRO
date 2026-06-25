// =============================================================================
// send-nps-poll — envia a enquete NPS ao FINALIZAR a conversa (chamado pelo
// TicketResolutionDrawer quando o atendente clica "Finalizar").
//
// Enquete nativa UAZAPI (/send/menu type=poll): escala 0-10 (numérica) ou
// categórica (legado). Opcional: 2ª enquete "encontrou o produto?" (Sim/Não).
//
// Idempotência: claim atômico de conversations.nps_sent_at (cobre duplo-clique/
// retry). Em falha de envio, libera o slot pra novo disparo.
//
// Auth: verify_jwt=false no gateway + verifyAuth() interno — o atendente que
// finalizou é o user do JWT (attendant_id), sem spoof.
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { buildNpsOptions, FOUND_PRODUCT_OPTIONS, FOUND_PRODUCT_AUTO_TAGS, type NpsScale } from '../_shared/nps.ts'

// @ts-ignore — Deno global
const supabase = createServiceClient()
const log = createLogger('send-nps-poll')

interface Body {
  conversation_id: string
  instance_id?: string
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function sendPoll(
  uazapiUrl: string,
  token: string,
  jid: string,
  text: string,
  choices: string[],
): Promise<{ ok: boolean; messageId?: string | null; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${uazapiUrl}/send/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': token },
      body: JSON.stringify({ number: jid, type: 'poll', text, choices, selectableCount: 1 }),
    })
    if (!res.ok) {
      const b = await res.text().catch(() => '')
      return { ok: false, error: `http_${res.status}: ${b.substring(0, 120)}` }
    }
    let messageId: string | null = null
    try {
      const j = await res.json()
      // UAZAPI devolve `messageid` (key.id curto) e `id` ("sender:keyid" composto).
      // O webhook poll_update referencia o key.id CURTO — extrai sempre ele.
      const raw = j.messageid || j.messageId || j.MessageId || j.id || null
      messageId = raw ? (String(raw).includes(':') ? String(raw).split(':').pop()! : String(raw)) : null
    } catch { /* sem JSON parseável — message_id fica null */ }
    return { ok: true, messageId }
  } catch (e) {
    return { ok: false, error: `network_error: ${(e as Error).message}` }
  }
}

// @ts-ignore — Deno.serve
Deno.serve(async (req: Request) => {
  const cors = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = await verifyAuth(req)
  if (!auth) return json({ error: 'unauthorized' }, 401, cors)
  const attendantId = auth.userId

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400, cors) }
  const conversationId = body.conversation_id
  if (!conversationId) return json({ error: 'missing_conversation_id' }, 400, cors)

  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, inbox_id, tags, nps_sent_at, contact_id, contacts(jid, phone), inboxes(instance_id)')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return json({ ok: false, skipped: 'conversation_not_found' }, 200, cors)

    // conversations não tem instance_id direto — vem via inbox → inboxes.instance_id.
    const instanceId = (conv as { inboxes?: { instance_id?: string } }).inboxes?.instance_id || body.instance_id
    if (!instanceId) return json({ ok: false, skipped: 'no_instance' }, 200, cors)

    const { data: agent } = await supabase
      .from('ai_agents')
      .select('poll_nps_enabled, poll_nps_question, poll_nps_options, poll_nps_scale, poll_nps_ask_found_product')
      .eq('instance_id', instanceId)
      .maybeSingle()
    if (!agent?.poll_nps_enabled) return json({ ok: false, skipped: 'nps_disabled' }, 200, cors)

    // Guard D6: não enviar se a conversa teve handoff por frustração
    const tags: string[] = ((conv as { tags?: string[] }).tags) || []
    if (tags.some((t) => String(t).includes('sentimento:negativo'))) {
      return json({ ok: false, skipped: 'negative_sentiment' }, 200, cors)
    }

    const contact = (conv as { contacts?: { jid?: string; phone?: string } }).contacts
    const jid = contact?.jid || contact?.phone
    if (!jid) return json({ ok: false, skipped: 'no_contact_jid' }, 200, cors)

    // Idempotência: claim atômico do slot (só envia se nps_sent_at ainda NULL).
    const { data: claimed } = await supabase
      .from('conversations')
      .update({ nps_sent_at: new Date().toISOString() })
      .eq('id', conversationId)
      .is('nps_sent_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) return json({ ok: false, skipped: 'already_sent' }, 200, cors)

    const releaseSlot = async () => {
      await supabase.from('conversations').update({ nps_sent_at: null }).eq('id', conversationId)
    }

    const { data: inst } = await supabase.from('instances').select('token').eq('id', instanceId).maybeSingle()
    const token = (inst as { token?: string } | null)?.token
    if (!token) {
      await releaseSlot()
      return json({ ok: false, error: 'no_instance_token' }, 200, cors)
    }

    const scale: NpsScale = ((agent as { poll_nps_scale?: string }).poll_nps_scale as NpsScale) || 'categorical'
    const question = (((agent as { poll_nps_question?: string }).poll_nps_question) || '').trim()
      || 'Sua opinião é muito importante 🙏 De 0 a 10, como foi seu atendimento?'
    const options = buildNpsOptions(scale, (agent as { poll_nps_options?: string[] }).poll_nps_options || null)
    // @ts-ignore — Deno global
    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

    const sent = await sendPoll(uazapiUrl, token, jid, question, options)
    if (!sent.ok) {
      await releaseSlot()
      log.warn('nps_send_failed', { conversationId, error: sent.error })
      return json({ ok: false, error: 'nps_send_failed', detail: sent.error }, 200, cors)
    }

    await supabase.from('poll_messages').insert({
      conversation_id: conversationId,
      instance_id: instanceId,
      message_id: sent.messageId,
      question,
      options,
      selectable_count: 1,
      is_nps: true,
      attendant_id: attendantId,
      nps_scale: scale,
    })
    await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      direction: 'outgoing',
      content: question,
      media_type: 'poll',
      media_url: JSON.stringify({ question, options, selectable_count: 1 }),
      external_id: `nps_${Date.now()}`,
    })

    // 2ª enquete opcional: "encontrou o produto?" (não é NPS — vira tag via auto_tags)
    let foundProductSent = false
    if ((agent as { poll_nps_ask_found_product?: boolean }).poll_nps_ask_found_product) {
      const q2 = 'E você encontrou o produto que procurava?'
      const sent2 = await sendPoll(uazapiUrl, token, jid, q2, FOUND_PRODUCT_OPTIONS)
      if (sent2.ok) {
        foundProductSent = true
        await supabase.from('poll_messages').insert({
          conversation_id: conversationId,
          instance_id: instanceId,
          message_id: sent2.messageId,
          question: q2,
          options: FOUND_PRODUCT_OPTIONS,
          selectable_count: 1,
          is_nps: false,
          attendant_id: attendantId,
          auto_tags: FOUND_PRODUCT_AUTO_TAGS,
        })
        await supabase.from('conversation_messages').insert({
          conversation_id: conversationId,
          direction: 'outgoing',
          content: q2,
          media_type: 'poll',
          media_url: JSON.stringify({ question: q2, options: FOUND_PRODUCT_OPTIONS, selectable_count: 1 }),
          external_id: `nps_found_${Date.now()}`,
        })
      }
    }

    log.info('nps_sent', { conversationId, scale, foundProductSent })
    return json({ ok: true, sent: true, found_product_sent: foundProductSent }, 200, cors)
  } catch (err) {
    log.error('send-nps-poll error', { error: (err as Error).message })
    return json({ ok: false, error: 'internal_error' }, 200, cors)
  }
})
