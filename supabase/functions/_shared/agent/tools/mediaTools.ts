/**
 * Sprint B5 Onda 3a — Tools de envio de mídia.
 *
 * Extrai os 3 handlers do switch `executeTool` do ai-agent:
 *   - sendCarousel: UAZAPI /send/carousel (4 variantes de retry) + INSERT msg
 *   - sendMedia: UAZAPI /send/media + INSERT msg
 *   - sendPoll: UAZAPI /send/menu (poll) + INSERT poll_messages + INSERT msg + broadcast
 *
 * Cada handler retorna `string` com mensagem pra LLM (mesmo contrato do switch
 * original). Sem mudança de comportamento — equivalência semântica.
 */

import { fetchWithTimeout } from '../../fetchWithTimeout.ts'
import type { Logger } from '../context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export type BroadcastEventFn = (evt: Record<string, any>) => void

export interface MediaToolsCtx {
  supabase: any
  agent: { carousel_button_1?: string | null; carousel_button_2?: string | null } & Record<string, any>
  agent_id: string
  conversation: { inbox_id?: string | null } & Record<string, any>
  conversation_id: string
  contact: { jid: string } & Record<string, any>
  instance: { token: string } & Record<string, any>
  instance_id: string
  uazapiUrl: string
  broadcastEvent: BroadcastEventFn
}

// =============================================================================
// Helpers privados
// =============================================================================

/**
 * Normaliza string pra ASCII (NFD + strip diacríticos). Usado como ID de botão
 * UAZAPI — Baileys serializa em UTF-8/Latin-1, só o `id` precisa ASCII.
 */
function safeBtnId(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// =============================================================================
// send_carousel
// =============================================================================

export async function sendCarousel(
  args: Record<string, any>,
  ctx: MediaToolsCtx,
  log: Logger,
): Promise<string> {
  const titles: string[] = args.product_ids || []
  if (titles.length === 0) return 'Nenhum produto especificado.'
  if (titles.length > 10) return 'Máximo de 10 produtos por carrossel.'

  const { data: products } = await ctx.supabase
    .from('ai_agent_products')
    .select('title, description, price, images, in_stock')
    .eq('agent_id', ctx.agent_id)
    .eq('enabled', true)
    .in('title', titles)

  if (!products || products.length === 0) return 'Nenhum produto encontrado.'

  const withImages = (products as any[]).filter((p) => p.images?.[0])
  if (withImages.length === 0) return 'Nenhum produto com imagem. Descreva por texto.'

  const scBtn1 = ctx.agent.carousel_button_1 || 'Eu quero!'
  const scBtn2 = ctx.agent.carousel_button_2 || ''

  // Regra de negócio (feedback_single_product_send_media + v7.52.3): 1 PRODUTO =
  // SEMPRE foto única com legenda (/send/media), NUNCA carrossel — mesmo que o
  // produto tenha várias fotos. Antes, 1 produto multi-foto virava carrossel de N
  // cards e o lead enxergava como "vários produtos". A correção da v7.52.3 cobriu o
  // caminho do searchProducts (pré-busca), mas a tool send_carousel — que o LLM pode
  // chamar diretamente — ainda fazia o multi-card. Aqui a tool fica IDEMPOTENTE à
  // regra: 1 produto sempre cai em send_media, independente de como o LLM chamou.
  if (withImages.length === 1) {
    const p = withImages[0]
    const caption = `${p.title}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`
    log.info('send_carousel com 1 produto → redirecionado p/ send_media (foto única)', {
      title: p.title, photoCount: (p.images as string[]).length,
    })
    return sendMedia(
      { media_url: p.images[0], media_type: 'image', caption },
      ctx,
      log,
    )
  }

  const carousel: any[] = withImages.slice(0, 10).map((p) => ({
    text: `${p.title}\n${p.description?.substring(0, 80) || ''}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`,
    image: p.images[0],
    buttons: [
      { id: safeBtnId(p.title), text: scBtn1, type: 'REPLY' },
      ...(scBtn2 ? [{ id: safeBtnId(`info_${p.title}`), text: scBtn2, type: 'REPLY' }] : []),
    ],
  }))

  // Retry strategy — 4 variantes matching uazapi-proxy order.
  const msg = args.message || 'Confira nossas opções:'
  const rawNumSc = ctx.contact.jid.split('@')[0]
  const variants = [
    { phone: ctx.contact.jid, message: msg, carousel },
    { number: ctx.contact.jid, text: msg, carousel },
    { phone: rawNumSc, message: msg, carousel },
    { number: rawNumSc, text: msg, carousel },
  ]
  let sent = false
  for (const payload of variants) {
    const res = await fetchWithTimeout(
      `${ctx.uazapiUrl}/send/carousel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: ctx.instance.token },
        body: JSON.stringify(payload),
      },
      10000,
    )
    const body = await res.text()
    log.info('send_carousel attempt', {
      variant: Object.keys(payload)[0],
      status: res.status,
      body: body.substring(0, 120),
    })
    if (res.ok && !body.toLowerCase().includes('missing')) {
      sent = true
      break
    }
  }
  if (!sent) return 'Erro ao enviar carrossel. Descreva os produtos por texto.'

  // Save carousel to helpdesk.
  const scMediaUrl = JSON.stringify({ message: msg, cards: carousel })
  await ctx.supabase.from('conversation_messages').insert({
    conversation_id: ctx.conversation_id,
    direction: 'outgoing',
    content: msg,
    media_type: 'carousel',
    media_url: scMediaUrl,
    external_id: `ai_carousel_${Date.now()}`,
  })
  ctx.broadcastEvent({
    conversation_id: ctx.conversation_id,
    inbox_id: ctx.conversation.inbox_id,
    direction: 'outgoing',
    content: msg,
    media_type: 'carousel',
    media_url: scMediaUrl,
  })

  // 1 produto já saiu por send_media acima (early return); aqui é sempre 2+.
  return `Carrossel enviado com ${withImages.length} produto(s) ao lead! NÃO repita os nomes dos produtos no texto — apenas pergunte se é isso que procura.`
}

// =============================================================================
// send_media
// =============================================================================

export async function sendMedia(
  args: Record<string, any>,
  ctx: MediaToolsCtx,
  _log: Logger,
): Promise<string> {
  const { media_url, media_type, caption } = args
  if (!media_url) return 'URL da mídia não informada.'

  const type = ['image', 'video', 'document'].includes(media_type) ? media_type : 'image'

  const sendRes = await fetchWithTimeout(
    `${ctx.uazapiUrl}/send/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: ctx.instance.token },
      body: JSON.stringify({
        number: ctx.contact.jid,
        type,
        file: media_url,
        text: caption || '',
        delay: 2000,
      }),
    },
  )

  if (!sendRes.ok) return `Erro ao enviar mídia (${sendRes.status}). Descreva por texto.`

  await ctx.supabase.from('conversation_messages').insert({
    conversation_id: ctx.conversation_id,
    direction: 'outgoing',
    content: caption || '',
    media_type: type,
    media_url,
    external_id: `ai_media_${Date.now()}`,
  })

  // INSERT de mídia no ai-agent DEVE broadcastar (feedback_media_insert_must_broadcast),
  // senão o helpdesk não exibe a foto em tempo real. searchProducts.ts:645 já fazia isso
  // no seu caminho de 1-produto; a tool send_media (e o redirect de send_carousel p/ 1
  // produto) precisa do mesmo broadcast.
  ctx.broadcastEvent({
    conversation_id: ctx.conversation_id,
    inbox_id: ctx.conversation.inbox_id,
    direction: 'outgoing',
    content: caption || '',
    media_type: type,
    media_url,
  })

  return 'Mídia enviada com legenda ao lead! NÃO repita a mesma informação no texto — apenas faça a próxima pergunta (ex: "É esse que você procura?").'
}

// =============================================================================
// send_poll — M17 F4 (Enquete nativa do WhatsApp)
// =============================================================================

export async function sendPoll(
  args: Record<string, any>,
  ctx: MediaToolsCtx,
  _log: Logger,
): Promise<string> {
  const { question, options, selectable_count } = args
  if (
    !question ||
    !options ||
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 12
  ) {
    return 'Enquete precisa de pergunta + 2-12 opcoes.'
  }
  const sc = selectable_count === 0 ? 0 : 1

  const pollRes = await fetchWithTimeout(
    `${ctx.uazapiUrl}/send/menu`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: ctx.instance.token },
      body: JSON.stringify({
        number: ctx.contact.jid,
        type: 'poll',
        text: String(question).substring(0, 255),
        choices: options.map((o: string) => String(o).substring(0, 100)),
        selectableCount: sc,
      }),
    },
  )

  if (!pollRes.ok) return `Erro ao enviar enquete (${pollRes.status}). Faca a pergunta por texto.`

  let pollMsgId: string | null = null
  try {
    const pollJson = await pollRes.json()
    pollMsgId = pollJson.messageId || pollJson.MessageId || null
  } catch {
    /* non-critical */
  }

  await ctx.supabase.from('poll_messages').insert({
    conversation_id: ctx.conversation_id,
    instance_id: ctx.instance_id,
    message_id: pollMsgId,
    question,
    options,
    selectable_count: sc,
  })

  await ctx.supabase.from('conversation_messages').insert({
    conversation_id: ctx.conversation_id,
    direction: 'outgoing',
    content: question,
    media_type: 'poll',
    media_url: JSON.stringify({ question, options, selectable_count: sc }),
    external_id: `ai_poll_${Date.now()}`,
  })

  ctx.broadcastEvent({ conversation_id: ctx.conversation_id, media_type: 'poll' })

  return `Enquete enviada: "${question}" com ${options.length} opcoes. Aguarde o lead votar.`
}

// =============================================================================
// API pública — dispatcher
// =============================================================================

/**
 * Despacha `name` ('send_carousel' | 'send_media' | 'send_poll') pro handler
 * apropriado. Retorna null se name não é tool de mídia (caller continua com
 * o próximo handler no switch original).
 */
export async function dispatchMediaTool(
  name: string,
  args: Record<string, any>,
  ctx: MediaToolsCtx,
  log: Logger,
): Promise<string | null> {
  switch (name) {
    case 'send_carousel':
      return sendCarousel(args, ctx, log)
    case 'send_media':
      return sendMedia(args, ctx, log)
    case 'send_poll':
      return sendPoll(args, ctx, log)
    default:
      return null
  }
}
