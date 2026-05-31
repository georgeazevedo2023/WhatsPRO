/**
 * Sprint B5 Onda 5 — Despacho final da resposta do AI Agent.
 *
 * Extrai do `ai-agent/index.ts` os steps 15.5-22 + final log/Response:
 *   - 15.5: handoff detection (explícito via toolCallsLog + implícito via HANDOFF_PATTERNS)
 *           → switch SHADOW + queue_event quando implícito
 *   - 16: TTS decision tree (skip / audio direct / audio+text split / text fallback)
 *   - 17-19: INSERT conversation_messages + UPDATE conversations + broadcastEvent
 *   - 20: ai_agent_logs.response_sent com metadata cheia
 *   - 21: upsert lead_profiles (interaction count + summary entry — top 10 últimas)
 *   - 22: deferred handoff trigger (quando perguntas vieram antes do trigger ser detectado)
 *   - final: log.info('Done') + Response 200
 *
 * Última onda do split B5. dispatchResponse é orquestrador puro — não vira specialist
 * no Sprint C (specialists só geram texto; o despacho continua centralizado).
 *
 * Preservação linha-a-linha do monolito. Sem mudança de comportamento.
 */

import { STATUS_IA } from '../constants.ts'
import { mergeTags } from '../agentHelpers.ts'
import { isOutsideBusinessHours, personalizeHandoffMessage, buildDeliveryLine } from '../businessHours.ts'
import { normalizeCart, formatCartOneLine, formatCartSummary } from './cart.ts'
import { buildPremiumHandoffSummary } from './handoffSummary.ts'
import { detectObjection } from '../objectionDetection.ts'
import { splitAudioAndText } from '../ttsProviders.ts'
import type { Logger } from './context.ts'

// =============================================================================
// HANDOFF_PATTERNS — copiado do index.ts (uso único dentro deste módulo)
// =============================================================================

const HANDOFF_PATTERNS = [
  /(?<!não\s)vou (?:te |lhe )?encaminhar/i,
  /(?<!não\s|sem\s)transferir (?:você|vc|voce|te|lhe) para/i,
  /(?:um|nosso|uma) atendente (?:humano|vai|irá)/i,
  /falar com (?:um |nosso )?vendedor/i,
  /(?<!não\s|sem\s)encaminhar (?:você|vc|voce) (?:para|ao|à)/i,
  // 2026-05-26: handoffs VERBALIZADOS que o LLM emite sem chamar handoff_to_human.
  // Sem estes padrões, a IA prometia vendedor mas NUNCA criava o handoff_queue_event
  // (lead esperava em vão). Descoberto no E2E do fix "catálogo é minoria" (caixa-d'água):
  // "Vou passar seu pedido para um vendedor que vai te informar... alguém entra em contato".
  // Cobertura tripla (verbo+vendedor / vendedor+vai / alguém entra em contato).
  /(?<!não\s|sem\s)(?:vou|vamos|já vou|estou|já estou)\s+(?:te\s+|lhe\s+)?(?:passar|passando|repassar|repassando|encaminhar|encaminhando|conectar|conectando|direcionar|direcionando|transferir|transferindo)(?:\s+\S+){0,5}?\s+(?:vendedor|consultor|atendente|especialista|time de vendas|equipe de vendas)/i,
  /(?:vendedor|consultor|atendente|especialista)\s+(?:que\s+)?(?:vai|ir[áa])\s+(?:te\s+|lhe\s+)?(?:informar|atender|ajudar|entrar em contato|passar|retornar)/i,
  /algu[ée]m\s+(?:vai\s+|já\s+vai\s+)?(?:entra|entrar)\s+em\s+contato/i,
]

// =============================================================================
// Tipos públicos
// =============================================================================

export interface ToolCallLogEntry {
  name: string
  args?: any
  result?: string
}

// Promise<void | boolean>: a impl real (index.ts) retorna boolean (sucesso do envio);
// Promise<boolean> não é atribuível a Promise<void>, então a união cobre ambos.
export type SendTextMsgFn = (text: string) => Promise<void | boolean>
export type SendTtsFn = (text: string) => Promise<boolean>
// union literal: a impl real aceita só 'composing'|'recording'; (state: string) exigiria
// que ela tratasse qualquer string (contravariância) → erro tsc.
export type SendPresenceFn = (state: 'composing' | 'recording') => void
export type BroadcastEventFn = (evt: Record<string, any>) => void
export type PickHandoffMessageFn = (opts: {
  agent: any
  profileData: any
  funnelData: any
  outsideHours: boolean
}) => string
export type RunQueueAssignmentFn = (
  handoffMessageTemplate: string,
) => Promise<{ result: any; finalMessage: string }>

export interface DispatchResponseCtx {
  // Core data
  responseText: string
  agent: Record<string, any>
  agent_id: string
  conversation: {
    tags?: string[] | null
    inbox_id?: string | null
    status_ia?: string | null
  } & Record<string, any>
  conversation_id: string
  contact: { id: string } & Record<string, any>

  // LLM state
  toolCallsLog: ToolCallLogEntry[]
  inputTokens: number
  outputTokens: number
  usedModel: string
  /** Loop break em handoff_to_human — `responseText` já foi descartado upstream */
  hadExplicitHandoffInLoop: boolean

  // Lead/profile/funnel
  profileData: any
  funnelData: any
  leadProfile: any

  // Incoming
  incomingText: string
  incomingHasAudio: boolean
  queuedMessages: any[]

  // Deferred handoff (step 22)
  pendingHandoffTrigger: string | null
  pendingHandoffTriggerMsg: string

  /**
   * Histórico recente {direction, content} (asc) p/ o digest de fallback do resumo
   * do vendedor quando as tags são esparsas (categorias não-premium). Opcional.
   */
  digestMessages?: Array<{ direction?: string | null; content?: string | null }> | null

  // Misc
  startTime: number

  // Callbacks injetados (closures do index.ts)
  sendTextMsg: SendTextMsgFn
  sendTts: SendTtsFn
  sendPresence: SendPresenceFn
  broadcastEvent: BroadcastEventFn
  pickHandoffMessage: PickHandoffMessageFn
  runQueueAssignment: RunQueueAssignmentFn

  // DB + util
  supabase: any
  log: Logger
  corsHeaders: Record<string, string>
}

export interface DispatchResponseResult {
  /** Response 200 final pro caller propagar */
  response: Response
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Defesa: o LLM às vezes "verbaliza" a chamada de tool no TEXTO em vez de usar o
 * canal de function-calling — e o lead vê a sintaxe crua. A evidência de PROD
 * (EletropisoV2, 30d, 2026-05-25→05-31) mostrou 5 formas distintas, NENHUMA coberta
 * pela regex antiga (que só pegava `functions.NOME`, `NOME({...})` e `NOME(key:"aspas")`):
 *   - bare-name numa linha:        `...vendedor.\nhandoff_to_human`              (4×)
 *   - parens com valor SEM aspas:  `handoff_to_human(reason: Lead busca cuba ...)` (3×)
 *   - wikilink (completo/truncado): `[[handoff_to_human|reason=Lead: Fernando ...]]` (1×, cenário 21.33)
 *   - JSON em linha separada:       `handoff_to_human\n{ "reason": "..." }`        (1×)
 *   - space-kv:                     `... fosco? set_tags nome:Fernando ambiente:interno` (1×)
 * Como os nomes de tool são identificadores snake_case em inglês — que NUNCA
 * aparecem em pt-BR legítimo voltado ao lead — é seguro ANCORAR no nome e remover o
 * "payload" em qualquer sintaxe que o LLM invente (parênteses com/sem aspas, JSON em
 * linha à parte, pipe de wikilink incl. truncado, chave:valor por espaço), com
 * wrappers opcionais (functions., [[, [, <, backtick, **). Texto legítimo (sem nome
 * de tool) é devolvido byte-a-byte intacto (guarda `stripped === text`).
 */
const LEAKED_TOOL_NAMES = [
  'handoff_to_human',
  'search_products',
  'set_tags',
  'send_carousel',
  'send_media',
  'send_poll',
  'update_lead_profile',
  'assign_label',
  'move_kanban',
  'set_cart',
].join('|')

// Um vazamento = nome de tool (snake_case) em "posição de call". Duas formas:
//   (1) WRAPPED   — nome com wrapper (functions. | [[ | [ | < | ` | **) e/ou payload.
//                   Wrapper/payload são sinal forte de call verbalizada; sempre remove.
//   (2) UNWRAPPED — nome "pelado", removido só se NÃO encostar em char de URL/e-mail/
//                   identificador (LEAD/TRAIL) e for seguido de payload OU de um limite
//                   seguro. Evita destruir links e e-mails legítimos que o agente manda
//                   (ex.: .../search_products?q=... e send_media@loja.com) — achados na
//                   verificação adversarial (over-strip hunter).
const _LEAK_NAME = '\\b(?:' + LEAKED_TOOL_NAMES + ')\\b'
// LEAD/TRAIL: o nome pelado não pode tocar char de URL/e-mail/identificador/SKU.
const _LEAK_LEAD = '(?<![\\w/@.\\-?=&:#~])'
const _LEAK_TRAIL = '(?![\\w/@.\\-?=&:#~])'
// payload opcional que o LLM inventa após o nome — a 1ª alternativa que casar vence.
// Parens/braces são BALANCEADOS 1 nível (não-lazy): cobre reason com (parênteses)
// internos e JSON/array aninhado ({"a":{"b":1}}, items=[{...}]) sem o over-strip do
// match guloso nem o under-strip do lazy que parava no 1º fecha. (verificação adversarial)
const _LEAK_PAYLOAD =
  '(?:' +
    '\\s*\\((?:[^()]|\\([^()]*\\))*\\)' + //             ( ... ) balanceado 1 nível
    '|\\s*\\([\\s\\S]*$' + //                            ( ... truncado (corte de stream sem fechar) → fim
    '|\\s*\\{(?:[^{}]|\\{[^{}]*\\})*\\}' + //            { json } balanceado 1 nível
    '|\\s*\\|[\\s\\S]*?(?:\\]\\]|$)' + //                | pipe de wikilink ... até ]] OU fim (incl. truncado)
    '|(?:\\s+[A-Za-zÀ-ÿ_][\\wÀ-ÿ]*\\s*[:=]\\s*\\S+)+' + // space-kv: nome:Fernando ambiente:interno
  ')'
const _LEAK_WRAPPED =
  '(?:functions\\.|\\[\\[|\\[|<|`|\\*\\*)' + _LEAK_NAME + _LEAK_PAYLOAD + '?' +
  '(?:\\s*(?:\\]\\]|\\]|>|`|\\*\\*))?' // wrapper de fechamento opcional
const _LEAK_UNWRAPPED = _LEAK_LEAD + _LEAK_NAME + '(?:' + _LEAK_PAYLOAD + '|' + _LEAK_TRAIL + ')'
const LEAKED_TOOL_RE = new RegExp(
  _LEAK_WRAPPED + '|' + _LEAK_UNWRAPPED,
  // flag i: o LLM pode emitir o nome em maiúsculas/misto (HANDOFF_TO_HUMAN,
  // Functions.Handoff_To_Human). Como os nomes nunca existem em pt-BR nem
  // case-insensitive, isto fecha a classe sem risco de over-strip.
  'gi',
)
export function stripLeakedToolCalls(text: string): string {
  if (!text) return text
  const stripped = text.replace(LEAKED_TOOL_RE, '').replace(/\bfunctions\.\s*$/gi, '')
  if (stripped === text) return text // no-op quando não há vazamento (não toca texto legítimo)
  // só normaliza/trima quando de fato removeu algo
  return stripped
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function stripCatalogMentions(text: string): string {
  if (!text) return text
  return text
    .replace(/\bno cat[aá]logo,\s*(?:tem|encontrei)\s+(?:a\s+)?op[cç][aã]o/ig, 'Encontrei uma opção')
    .replace(/\b(?:cat[aá]logo digital|cat[aá]logo)\b/ig, 'opções disponíveis')
}

export async function dispatchResponse(
  ctx: DispatchResponseCtx,
): Promise<DispatchResponseResult> {
  // Captura o texto cru ANTES de limpar: um handoff_to_human VERBALIZADO (vazado no
  // texto) é sinal de handoff mesmo que o strip o remova e a prosa restante não case
  // HANDOFF_PATTERNS — ver leakedHandoff usado na detecção de handoff implícito abaixo.
  const rawResponseText = ctx.responseText || ''
  let responseText = stripLeakedToolCalls(rawResponseText)
  responseText = stripCatalogMentions(responseText)
  const leakedHandoff = /\bhandoff_to_human\b/.test(rawResponseText)
  // Se o strip esvaziou o texto (a msg era SÓ o vazamento) mas havia handoff
  // verbalizado, manda uma confirmação segura — nunca enviar bolha vazia ao lead.
  if (!responseText.trim() && leakedHandoff) {
    responseText = 'Perfeito! Já vou te passar pra um de nossos vendedores pra finalizar seu atendimento. 😊'
  }
  const {
    agent, agent_id, conversation, conversation_id, contact,
    toolCallsLog, inputTokens, outputTokens, usedModel,
    hadExplicitHandoffInLoop,
    profileData, funnelData, leadProfile,
    incomingText, incomingHasAudio, queuedMessages,
    pendingHandoffTrigger, pendingHandoffTriggerMsg,
    startTime,
    sendTextMsg, sendTts, sendPresence, broadcastEvent,
    pickHandoffMessage, runQueueAssignment,
    supabase, log, corsHeaders,
  } = ctx

  // ── 15.5 Detect handoff BEFORE sending ───────────────────────────────
  const toolNames = toolCallsLog.map((t: any) => t.name)
  const hadExplicitHandoff = toolNames.includes('handoff_to_human')
  const textLooksLikeHandoff =
    !hadExplicitHandoff &&
    responseText.trim() !== '' &&
    (HANDOFF_PATTERNS.some((p) => p.test(responseText)) || leakedHandoff)
  const shouldDisableIa = hadExplicitHandoff || textLooksLikeHandoff

  // If implicit handoff detected, switch to shadow BEFORE sending (so helpdesk sees correct status)
  if (textLooksLikeHandoff) {
    log.info('Implicit handoff detected — switching to shadow before sending text')
    // D30: atribui via fila. LLM gerou o texto livre — não há template para D-γ
    // (mas helper roda mesmo assim para criar handoff_queue_event + assigned_to).
    const { result: queueRes } = await runQueueAssignment('')
    let freshConversationImplicit: any = null
    try {
      const { data } = await supabase
        .from('conversations')
        .select('tags, cart_items')
        .eq('id', conversation_id)
        .maybeSingle()
      freshConversationImplicit = data
    } catch {
      freshConversationImplicit = null
    }
    const implicitTags = ((freshConversationImplicit as any)?.tags || conversation.tags || []) as string[]
    const cartItemsImplicit = normalizeCart((freshConversationImplicit as any)?.cart_items || (conversation as any).cart_items)
    const cartFullImplicit = formatCartSummary(cartItemsImplicit)
    const deliveryLineImplicit = buildDeliveryLine(implicitTags)
    const rawSellerNoteImplicit = [
      responseText,
      cartFullImplicit ? `Pedido:\n${cartFullImplicit}` : '',
      deliveryLineImplicit,
    ].filter(Boolean).join('\n\n').trim()
    let sellerNoteImplicit = buildPremiumHandoffSummary({
      tags: implicitTags,
      leadName: (leadProfile as { full_name?: string | null } | null)?.full_name || (contact as any)?.name || null,
      fallbackReason: rawSellerNoteImplicit,
      messages: ctx.digestMessages,
    }) || rawSellerNoteImplicit
    if (cartFullImplicit && !/Pedido \(/i.test(sellerNoteImplicit)) {
      sellerNoteImplicit = `${sellerNoteImplicit}\n${cartFullImplicit}`.trim()
    }
    await supabase.from('conversations').update({
      status_ia: STATUS_IA.SHADOW,
      tags: mergeTags(implicitTags, {
        ia: STATUS_IA.SHADOW,
        handoff_created: 'true',
        agent_status: 'inactive',
        human_assigned: 'true',
        seller_notified: 'true',
        followups_paused: 'true',
      }),
      lead_msg_count: 0, // R86: reset counter so returning lead doesn't re-trigger auto-handoff
    }).eq('id', conversation_id)
    await supabase.from('ai_agent_logs').insert({
      agent_id, conversation_id, event: 'implicit_handoff',
      metadata: { response_text: responseText.substring(0, 300), queue: queueRes },
    })
    if (sellerNoteImplicit) {
      const noteContentImplicit = `📋 Resumo do pedido (interno):\n${sellerNoteImplicit}`
      await supabase.from('conversation_messages').insert({
        conversation_id,
        direction: 'private_note',
        content: noteContentImplicit,
        media_type: 'text',
      })
      broadcastEvent({
        conversation_id,
        inbox_id: conversation.inbox_id,
        direction: 'private_note',
        content: noteContentImplicit,
        media_type: 'text',
      })
    }
  }

  // ── 16 Send response via UAZAPI (TTS audio or text) ──────────────────
  const skipTextSend = hadExplicitHandoffInLoop && !responseText.trim()
  let sentMediaType = 'text'
  const maxTtsLength = agent.voice_max_text_length || 150
  const voiceReplyToAudio = agent.voice_reply_to_audio !== false
  const wantsAudio = agent.voice_enabled || (incomingHasAudio && voiceReplyToAudio)
  const shouldSendAudio = wantsAudio && responseText.length <= maxTtsLength
  // #20: For long responses when lead sent audio, split into audio summary + text
  const shouldSplitAudio = wantsAudio && responseText.length > maxTtsLength

  log.info('TTS check', {
    voiceEnabled: agent.voice_enabled,
    incomingHasAudio,
    voiceReplyToAudio,
    responseLen: responseText.length,
    maxTts: maxTtsLength,
    shouldSendAudio,
    shouldSplitAudio,
  })
  let ttsDebugError = ''

  if (skipTextSend) {
    log.info('Skipping text send — handoff tool already sent message')
  } else if (shouldSendAudio) {
    // Short response → send as audio directly
    sendPresence('recording')
    const sent = await sendTts(responseText)
    if (sent) {
      sentMediaType = 'audio'
    } else {
      ttsDebugError = 'all_providers_failed'
      await sendTextMsg(responseText)
    }
  } else if (shouldSplitAudio) {
    // #20: Long response → audio summary (first sentence) + full text
    const split = splitAudioAndText(responseText, maxTtsLength)
    if (split) {
      sendPresence('recording')
      const sent = await sendTts(split.audioText)
      if (sent) {
        sentMediaType = 'audio'
        log.info('Split audio+text', {
          audioChars: split.audioText.length,
          fullChars: split.fullText.length,
        })
      } else {
        ttsDebugError = 'split_audio_failed'
      }
      // Always send full text after audio (or as fallback if audio failed)
      await sendTextMsg(split.fullText)
    } else {
      // Can't split meaningfully, send as text
      await sendTextMsg(responseText)
    }
  } else {
    await sendTextMsg(responseText)
  }

  // ── 17-19 Save message + update conversation + broadcast ─────────────
  // Wrapped in try-catch to guarantee response_sent log
  let savedMsg: any = null
  try {
    if (!skipTextSend && responseText.trim()) {
      const { data } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id,
          direction: 'outgoing',
          content: responseText,
          media_type: sentMediaType,
          external_id: `ai_agent_${Date.now()}`,
        })
        .select('id, created_at')
        .single()
      savedMsg = data
    }

    // 18. Update conversation — DON'T touch status_ia if handoff already set it to SHADOW
    const conversationUpdate: Record<string, any> = {
      last_message_at: new Date().toISOString(),
      last_message: responseText.substring(0, 200),
    }
    if (!hadExplicitHandoff && !textLooksLikeHandoff) {
      conversationUpdate.status_ia = STATUS_IA.LIGADA
    }
    await supabase.from('conversations').update(conversationUpdate).eq('id', conversation_id)

    // 19. Broadcast to helpdesk realtime
    const effectiveStatusIa =
      hadExplicitHandoff || textLooksLikeHandoff ? STATUS_IA.SHADOW : STATUS_IA.LIGADA
    broadcastEvent({
      conversation_id,
      inbox_id: conversation.inbox_id,
      message_id: savedMsg?.id,
      direction: 'outgoing',
      content: responseText,
      media_type: sentMediaType,
      created_at: savedMsg?.created_at || new Date().toISOString(),
      status_ia: effectiveStatusIa,
    })
  } catch (postSendErr) {
    log.error?.('Post-send DB ops failed (message already sent to WhatsApp)', {
      error: (postSendErr as Error).message,
    })
  }

  // ── 20 Log interaction ───────────────────────────────────────────────
  await supabase.from('ai_agent_logs').insert({
    agent_id,
    conversation_id,
    event: 'response_sent',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model: usedModel,
    latency_ms: Date.now() - startTime,
    sub_agent: profileData?.id ?? 'no_profile',
    tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
    metadata: {
      incoming_text: incomingText.substring(0, 500),
      response_text: responseText.substring(0, 500),
      message_count: (queuedMessages || []).length,
      sent_media_type: sentMediaType,
      tts_attempted: shouldSendAudio,
      tts_error: ttsDebugError || null,
      incoming_has_audio: incomingHasAudio,
      voice_reply_to_audio: voiceReplyToAudio,
      voice_enabled: agent.voice_enabled,
      response_length: responseText.length,
      max_tts_length: maxTtsLength,
    },
  })

  // ── 21 Update lead_profile: interaction count + conversation summary ─
  try {
    const products = toolCallsLog
      .filter((t: any) => t.name === 'search_products' || t.name === 'send_carousel')
      .flatMap((t: any) => {
        if (t.name === 'send_carousel') return t.args?.product_ids || []
        return t.args?.query ? [t.args.query] : []
      })
    const currentTags = conversation.tags || []

    const summaryEntry = {
      date: new Date().toISOString(),
      summary: `${incomingText.substring(0, 100)} → ${responseText.substring(0, 100)}`,
      products: [...new Set(products)].slice(0, 5),
      sentiment: currentTags.find((t: string) => t.startsWith('sentimento:'))?.split(':')[1] || null,
      outcome: shouldDisableIa ? 'handoff' : 'respondido',
      tools_used: [...new Set(toolNames)],
    }

    // Reuse leadProfile from step 8 (avoid duplicate DB query)
    const existingSummaries: any[] = leadProfile?.conversation_summaries || []
    const updatedSummaries = [...existingSummaries, summaryEntry].slice(-10)
    const newCount = (leadProfile?.total_interactions || 0) + 1

    const profileUpdate: Record<string, any> = {
      contact_id: contact.id,
      conversation_summaries: updatedSummaries,
      total_interactions: newCount,
      last_contact_at: new Date().toISOString(),
    }
    // Don't set full_name from contact.name (WhatsApp pushName) — only from lead_profiles confirmed by lead

    await supabase.from('lead_profiles').upsert(profileUpdate, { onConflict: 'contact_id' })

    log.info('Profile updated', { summaries: updatedSummaries.length, interactions: newCount })
  } catch (sumErr) {
    log.error?.('Profile update error', { error: (sumErr as Error).message })
  }

  // ── 22 Execute deferred handoff trigger ─────────────────────────────
  // (when grouped msgs had questions before the trigger)
  if (pendingHandoffTrigger && !hadExplicitHandoff && !textLooksLikeHandoff) {
    log.info('Executing deferred handoff trigger after LLM response', {
      trigger: pendingHandoffTrigger,
    })
    // Bug 16b: respeitar horário comercial (antes sempre usava handoff_message)
    const notifyOutsideDef = agent.notify_outside_hours_on_handoff !== false
    const outsideHoursDef =
      notifyOutsideDef && isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)
    // Premium #2 Cart Engine (2026-05-25): se houver pedido estruturado, personaliza
    // a msg ao lead (nome + linha compacta) e anexa o itemizado+total ao reason que o
    // vendedor recebe. Esta via (handoff deferido/verbalizado) é a que dispara quando o
    // LLM NÃO chama handoff_to_human — então o inject precisa existir aqui também.
    const cartItemsDef = normalizeCart((conversation as Record<string, unknown>).cart_items)
    const cartOneLineDef = formatCartOneLine(cartItemsDef)
    const cartFullDef = formatCartSummary(cartItemsDef)
    const handoffMsg = personalizeHandoffMessage(
      pickHandoffMessage({
        agent,
        profileData,
        funnelData,
        outsideHours: outsideHoursDef,
      }),
      { leadName: (leadProfile as { full_name?: string | null } | null)?.full_name || null, itemSummary: cartOneLineDef },
    )
    // D30: atribui via fila ANTES de enviar
    const { result: queueRes, finalMessage } = await runQueueAssignment(handoffMsg)
    await sendTextMsg(finalMessage)
    await supabase.from('conversation_messages').insert({
      conversation_id,
      direction: 'outgoing',
      content: finalMessage,
      media_type: 'text',
    })
    // R113.1 G1: detect objection synchronously (deferred path)
    const objectionTagDeferred = detectObjection(pendingHandoffTriggerMsg)
    const tagsToMergeDeferred: Record<string, string> = {
      ia: STATUS_IA.SHADOW,
      handoff_created: 'true',
      agent_status: 'inactive',
      human_assigned: 'true',
      seller_notified: 'true',
      followups_paused: 'true',
    }
    if (objectionTagDeferred) tagsToMergeDeferred.objecao = objectionTagDeferred

    await supabase.from('conversations').update({
      status_ia: STATUS_IA.SHADOW,
      tags: mergeTags(conversation.tags || [], tagsToMergeDeferred),
      lead_msg_count: 0, // R86: reset counter so returning lead doesn't re-trigger auto-handoff
    }).eq('id', conversation_id)
    await supabase.from('ai_agent_logs').insert({
      agent_id,
      conversation_id,
      event: 'handoff_trigger',
      latency_ms: Date.now() - startTime,
      metadata: {
        trigger: pendingHandoffTrigger,
        objection: objectionTagDeferred,
        deferred: true,
        incoming_text: incomingText.substring(0, 300),
        cart_items: cartItemsDef,
        order_summary: cartFullDef || null,
        queue: queueRes,
      },
    })
    broadcastEvent({
      conversation_id,
      inbox_id: conversation.inbox_id,
      direction: 'outgoing',
      content: finalMessage,
      media_type: 'text',
    })
    // Nota interna pro vendedor (2026-05-26): resumo estruturado fixado no fio da
    // conversa (private_note NUNCA vai pro lead). Cobre o handoff deferido/forçado
    // (ex.: catálogo-ausente). Texto rico fica aqui; ao lead, só a ponte humanizada.
    const deliveryLineDef = buildDeliveryLine(conversation.tags || [])
    const rawSellerNoteDef = [
      pendingHandoffTrigger,
      cartFullDef ? `🛒 ${cartFullDef}` : '',
      deliveryLineDef,
    ].filter(Boolean).join('\n\n').trim()
    const sellerNoteDef = buildPremiumHandoffSummary({
      tags: conversation.tags || [],
      leadName: (leadProfile as { full_name?: string | null } | null)?.full_name || null,
      fallbackReason: rawSellerNoteDef,
      messages: ctx.digestMessages,
    }) || rawSellerNoteDef
    if (sellerNoteDef) {
      const noteContentDef = `📋 Resumo do pedido (interno):\n${sellerNoteDef}`
      await supabase.from('conversation_messages').insert({
        conversation_id, direction: 'private_note', content: noteContentDef, media_type: 'text',
      })
      broadcastEvent({
        conversation_id, inbox_id: conversation.inbox_id,
        direction: 'private_note', content: noteContentDef, media_type: 'text',
      })
    }
  }

  // ── Final ────────────────────────────────────────────────────────────
  log.info('Done', {
    latency_ms: Date.now() - startTime,
    inputTokens,
    outputTokens,
    toolCount: toolCallsLog.length,
  })

  return {
    response: new Response(
      JSON.stringify({
        ok: true,
        conversation_id,
        response: responseText.substring(0, 200),
        tokens: { input: inputTokens, output: outputTokens },
        latency_ms: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    ),
  }
}
