/**
 * Sprint B5 Onda 2c-i — Pre-LLM short-circuits (R136 + R129).
 *
 * Antes de invocar o LLM, dois detectores determinísticos podem CURTO-CIRCUITAR
 * a turn e enviar uma resposta pronta:
 *
 *   1) R136 — Multi-item misto (Paloma, 2026-05-21): lead mandou lista numerada
 *      com 1+ categorias cadastradas e 1+ orphans → pergunta horizontal única.
 *   2) R129 — Multi-categoria (Branca, 2026-05-21): texto bate em ≥2 categorias
 *      cadastradas E lead ainda não escolheu uma → pergunta "por qual prefere
 *      começar?".
 *
 * Ordem importa: R136 vence se ambos baterem (lista multi-item já contém o sinal
 * que R129 detectaria, mas o tratamento horizontal é mais rico).
 *
 * Cada disparo persiste tag de pending, envia mensagem, registra log e retorna
 * `Response`. Se o `sendTextMsg` falhar, fallback é deixar o LLM processar
 * normalmente (com a tag já persistida pra prevenir loop).
 */

import {
  detectMultiItem,
  type MultiItemDetectorResult,
} from '../multiItemDetector.ts'
import {
  buildHorizontalQuestion,
  HORIZONTAL_QUALIF_PENDING_TAG,
} from '../horizontalQualif.ts'
import {
  getCategoriesOrDefault,
  matchAllCategoriesBySearchText,
} from '../serviceCategories.ts'
import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export type SendTextFn = (text: string) => Promise<unknown>
export type BroadcastEventFn = (evt: {
  conversation_id: string
  inbox_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  media_type: string
  message_id?: string | null
  created_at?: string
}) => void

export interface PreLLMShortCircuitsCtx {
  supabase: any
  conversation: {
    id?: string
    inbox_id?: string | null
    tags?: string[] | null
    status_ia?: string | null
  } & Record<string, any>
  conversation_id: string
  agent_id: string
  agent: any
  incomingText: string
  leadName: string | null
  queuedMessages: unknown[] | null | undefined
  startTime: number
  corsHeaders: Record<string, string>
  sendTextMsg: SendTextFn
  broadcastEvent: BroadcastEventFn
}

export interface PreLLMShortCircuitsResult {
  shortCircuited: boolean
  response: Response | null
  /** Sinal pra autoExtract a jusante: R129 detectou multi-categoria — não auto-extrair fields. */
  suppressAutoExtractForMulti: boolean
}

// =============================================================================
// Helpers internos
// =============================================================================

function jsonResponse(body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Persiste mensagem outgoing + broadcast + log response_sent. Usado pelos dois
 * short-circuits.
 */
async function persistAndBroadcastReply(
  ctx: PreLLMShortCircuitsCtx,
  text: string,
  source: string,
  extraMeta: Record<string, unknown>,
): Promise<void> {
  const { data: savedMsg } = await ctx.supabase
    .from('conversation_messages')
    .insert({
      conversation_id: ctx.conversation_id,
      direction: 'outgoing',
      content: text,
      media_type: 'text',
    })
    .select('id, created_at')
    .single()
  ctx.broadcastEvent({
    conversation_id: ctx.conversation_id,
    inbox_id: ctx.conversation.inbox_id ?? null,
    direction: 'outgoing',
    content: text,
    media_type: 'text',
    message_id: savedMsg?.id,
    created_at: savedMsg?.created_at || new Date().toISOString(),
  })
  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'response_sent',
    latency_ms: Date.now() - ctx.startTime,
    metadata: {
      incoming_text: ctx.incomingText.substring(0, 500),
      response_text: text,
      source,
      message_count: (ctx.queuedMessages || []).length,
      ...extraMeta,
    },
  })
}

// =============================================================================
// R136 — Multi-item misto
// =============================================================================

async function tryR136MultiItem(
  ctx: PreLLMShortCircuitsCtx,
  log: Logger,
): Promise<{ handled: boolean; response: Response | null }> {
  const tags = ctx.conversation.tags || []
  const alreadyHasHorizontalPending = tags.some(
    (t: string) =>
      typeof t === 'string' &&
      (t === HORIZONTAL_QUALIF_PENDING_TAG || t.startsWith(HORIZONTAL_QUALIF_PENDING_TAG + ':')),
  )
  if (alreadyHasHorizontalPending) return { handled: false, response: null }

  const cfgPre = getCategoriesOrDefault(ctx.agent)
  const multiItem: MultiItemDetectorResult = detectMultiItem({
    text: ctx.incomingText,
    categoriesConfig: cfgPre,
  })
  if (!multiItem.detected || !multiItem.mixed) return { handled: false, response: null }

  const question = buildHorizontalQuestion({
    detector: multiItem,
    leadName: ctx.leadName,
    originalText: ctx.incomingText,
  })

  const mergedTagsHorizontal = [...tags, question.pendingTag]
  ctx.conversation.tags = mergedTagsHorizontal
  await ctx.supabase
    .from('conversations')
    .update({ tags: mergedTagsHorizontal })
    .eq('id', ctx.conversation_id)
  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'auto_field_extracted',
    metadata: {
      source: 'r136_multi_item_horizontal',
      new_tags: [question.pendingTag],
      items: multiItem.items,
      orphan_count: multiItem.orphanCount,
      reason: multiItem.reason,
    },
  })
  log.info('R136: multi-item misto detectado — enviando pergunta horizontal', {
    items: multiItem.items.length,
    orphans: multiItem.orphanCount,
    reason: multiItem.reason,
  })

  try {
    await ctx.sendTextMsg(question.text)
    await persistAndBroadcastReply(ctx, question.text, 'r136_multi_item_horizontal_ask', {})
    return {
      handled: true,
      response: jsonResponse(
        { ok: true, response: question.text, reason: 'r136_multi_item_horizontal_ask' },
        ctx.corsHeaders,
      ),
    }
  } catch (e) {
    log.warn('R136: send horizontal question failed, fallback to LLM', {
      error: (e as Error).message,
    })
    return { handled: false, response: null }
  }
}

// =============================================================================
// R129 — Multi-categoria sem interesse definido
// =============================================================================

async function tryR129MultiCategory(
  ctx: PreLLMShortCircuitsCtx,
  log: Logger,
): Promise<{ handled: boolean; response: Response | null; suppressAutoExtractForMulti: boolean }> {
  const tags = ctx.conversation.tags || []
  const interesseTagPre = tags.find(
    (t: string) => typeof t === 'string' && t.startsWith('interesse:'),
  )
  const interesseValue = interesseTagPre ? (interesseTagPre.split(':')[1] || '') : ''
  const alreadyHasMultiPending = tags.some(
    (t: string) => typeof t === 'string' && t.startsWith('multi_interesse_pending:'),
  )

  if (interesseValue || alreadyHasMultiPending) {
    return { handled: false, response: null, suppressAutoExtractForMulti: false }
  }

  const cfgPre = getCategoriesOrDefault(ctx.agent)
  const allCatsMatched = matchAllCategoriesBySearchText(ctx.incomingText, cfgPre)
  if (allCatsMatched.length < 2) {
    return { handled: false, response: null, suppressAutoExtractForMulti: false }
  }

  const multiSlug = `multi_interesse_pending:${allCatsMatched.map((c) => c.id).join(',')}`
  const mergedMulti = [...tags, multiSlug]
  ctx.conversation.tags = mergedMulti
  await ctx.supabase
    .from('conversations')
    .update({ tags: mergedMulti })
    .eq('id', ctx.conversation_id)
  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'auto_field_extracted',
    metadata: {
      source: 'r129_multi_interesse_detected',
      new_tags: [multiSlug],
      category_ids: allCatsMatched.map((c) => c.id),
    },
  })
  log.info('R129: multi-categoria detectada — enviando pergunta direta', {
    categories: allCatsMatched.map((c) => c.id),
    incoming_preview: ctx.incomingText.substring(0, 80),
  })

  const labels = allCatsMatched.map((c) => (c.label || c.id).toLowerCase())
  const friendly =
    labels.length === 2
      ? `${labels[0]} e ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
  const askMsg = `Posso te ajudar com ${friendly}. Por qual prefere começar?`

  try {
    await ctx.sendTextMsg(askMsg)
    await persistAndBroadcastReply(ctx, askMsg, 'r129_multi_interesse_ask', {
      category_ids: allCatsMatched.map((c) => c.id),
    })
    return {
      handled: true,
      response: jsonResponse(
        { ok: true, response: askMsg, reason: 'r129_multi_interesse_ask' },
        ctx.corsHeaders,
      ),
      suppressAutoExtractForMulti: true,
    }
  } catch (e) {
    log.warn('R129: send ask failed, fallback to LLM with prompt hint', {
      error: (e as Error).message,
    })
    return { handled: false, response: null, suppressAutoExtractForMulti: true }
  }
}

// =============================================================================
// API pública — orquestradora
// =============================================================================

export async function runPreLLMShortCircuits(
  ctx: PreLLMShortCircuitsCtx,
  log: Logger,
): Promise<PreLLMShortCircuitsResult> {
  if (!ctx.incomingText || !ctx.incomingText.trim()) {
    return { shortCircuited: false, response: null, suppressAutoExtractForMulti: false }
  }

  // R136 vence se ambos baterem (lista multi-item já carrega o sinal de R129).
  const r136 = await tryR136MultiItem(ctx, log)
  if (r136.handled) {
    return {
      shortCircuited: true,
      response: r136.response,
      suppressAutoExtractForMulti: false,
    }
  }

  const r129 = await tryR129MultiCategory(ctx, log)
  if (r129.handled) {
    return {
      shortCircuited: true,
      response: r129.response,
      suppressAutoExtractForMulti: r129.suppressAutoExtractForMulti,
    }
  }

  // Nenhum short-circuit disparou (ou disparou e send falhou — segue pro LLM).
  return {
    shortCircuited: false,
    response: null,
    suppressAutoExtractForMulti: r129.suppressAutoExtractForMulti,
  }
}
