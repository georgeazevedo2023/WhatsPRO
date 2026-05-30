// describe-image (2026-05-30) — descrição de imagem por VISÃO (Gemini 2.0 Flash).
//
// Espelha transcribe-audio: o lead manda foto de produto, a gente descreve com
// visão e grava em conversation_messages.transcription. O ai-agent já lê
// `transcription` antes de `content` (R132/incomingMessagesLoader), então o
// agente passa a "enxergar" a foto sem mexer no fluxo dele.
//
// Bug que motivou (caso Íris, EletropisoV2 PROD 2026-05-30): lead mandou foto de
// tanquinho + "vcs tem um desse?"; IA respondeu "me manda a foto" — porque
// imagem chegava com content="" e nada de visão alimentava o LLM.
//
// Provider: Gemini 2.0 Flash (mesmo modelo/padrão já usado no fallback de áudio;
// melhor custo-benefício ~US$0,0001/img + key GEMINI_API_KEY já configurada).
// Custo praticamente zero. GPT fica como evolução futura se precisar de fallback.

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { STATUS_IA } from '../_shared/constants.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const moduleLog = createLogger('describe-image')

function backgroundFetch(promise: Promise<any>): void {
  // @ts-ignore: EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise)
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// Prompt enxuto: o objetivo é dar ao vendedor/IA o suficiente pra identificar e
// buscar o item — NÃO inventar disponibilidade nem preço (isso é regra do agente).
export const IMAGE_DESCRIPTION_PROMPT =
  'Você está ajudando um atendente de uma loja de material de construção a identificar um produto que o cliente enviou em foto. ' +
  'Descreva em 1 a 2 frases curtas, em português do Brasil: o que é o produto, marca ou texto visível na embalagem/etiqueta, cor e características relevantes (tipo, modelo, tamanho/capacidade se aparecer). ' +
  'Seja objetivo e factual — descreva SOMENTE o que dá pra ver. Se não for um produto, descreva brevemente o que aparece. Responda apenas a descrição, sem rótulos nem comentários.'

export function detectImageMime(url: string, contentType?: string): string {
  if (contentType && contentType.includes('image/')) return contentType.split(';')[0].trim()
  const u = (url || '').toLowerCase()
  if (u.includes('.png')) return 'image/png'
  if (u.includes('.webp')) return 'image/webp'
  if (u.includes('.gif')) return 'image/gif'
  if (u.includes('.heic') || u.includes('.heif')) return 'image/heic'
  return 'image/jpeg' // WhatsApp default
}

/** Extrai o texto do candidate do Gemini (puro, testável). */
export function parseGeminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

/**
 * Compõe o que vai pro campo transcription preservando a legenda do cliente
 * (se a foto veio com caption no mesmo evento). Sem isso o `text = transcription || content`
 * do loader engoliria a legenda. Puro/testável.
 */
export function composeImageTranscription(description: string, caption?: string | null): string {
  const desc = (description || '').trim()
  const cap = (caption || '').trim()
  const head = desc ? `[Foto enviada pelo cliente] ${desc}` : '[Foto enviada pelo cliente]'
  return cap ? `${head}\nLegenda do cliente: ${cap}` : head
}

async function describeWithGemini(imageUrl: string, geminiKey: string, mimeHint?: string): Promise<string> {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

  moduleLog.info('Gemini vision: downloading image', { urlPreview: imageUrl.substring(0, 120) })
  const startMs = Date.now()

  const imgResp = await fetchWithTimeout(imageUrl, undefined, 30000)
  if (!imgResp.ok) throw new Error(`Image download failed: ${imgResp.status}`)

  const imgBuffer = await imgResp.arrayBuffer()
  const contentType = imgResp.headers.get('content-type') || ''
  const mimeType = (mimeHint && mimeHint.startsWith('image/')) ? mimeHint : detectImageMime(imageUrl, contentType)
  const base64Img = arrayBufferToBase64(imgBuffer)
  const downloadMs = Date.now() - startMs

  moduleLog.info('Image downloaded', { sizeKb: (imgBuffer.byteLength / 1024).toFixed(1), mimeType, downloadMs })

  const llmStart = Date.now()
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Img } },
          { text: IMAGE_DESCRIPTION_PROMPT },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 512 },
    }),
  }, 60000)
  const llmMs = Date.now() - llmStart

  if (resp.ok) {
    const text = parseGeminiText(await resp.json())
    if (text) {
      moduleLog.info('Gemini vision success', { downloadMs, llmMs, preview: text.substring(0, 100) })
      return text
    }
    moduleLog.warn('Gemini vision returned empty text')
    throw new Error('Gemini returned empty text')
  } else {
    const errText = await resp.text()
    moduleLog.error('Gemini vision failed', { status: resp.status, error: errText.substring(0, 200) })
    throw new Error(`Gemini HTTP ${resp.status}: ${errText.substring(0, 300)}`)
  }
}

/**
 * Fallback OpenAI (gpt-4.1 vision). Usado quando o Gemini falha (ex.: key vazada/
 * bloqueada). OpenAI busca a imagem pela URL (image_url) — não precisa baixar.
 * Mais caro que o Gemini Flash (~7x) mas ainda barato; espelha a resiliência do áudio.
 */
async function describeWithOpenAI(imageUrl: string, openaiKey: string): Promise<string> {
  const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1',
      max_tokens: 512,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: IMAGE_DESCRIPTION_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
    }),
  }, 60000)
  if (resp.ok) {
    const data = await resp.json()
    const text = data?.choices?.[0]?.message?.content?.trim() || ''
    if (text) {
      moduleLog.info('OpenAI vision success', { preview: text.substring(0, 100) })
      return text
    }
    throw new Error('OpenAI returned empty text')
  }
  const errText = await resp.text()
  throw new Error(`OpenAI HTTP ${resp.status}: ${errText.substring(0, 300)}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const isService = verifyCronOrService(req)
  const auth = isService ? { userId: 'service' } : await verifyAuth(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  const log = createLogger('describe-image')

  if (!isService) {
    const rl = await checkRateLimit(auth.userId, 'describe-image', 20, 60)
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rl), 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const { messageId, imageUrl, mimeType: callerMimeType, conversationId } = await req.json()
    log.info('START', { messageId, conversationId, imageUrl: imageUrl?.substring(0, 150) })

    if (!messageId || !imageUrl) {
      return errorResponse(corsHeaders, 'messageId and imageUrl required', 400)
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || ''
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
    if (!GEMINI_API_KEY && !OPENAI_API_KEY) return errorResponse(corsHeaders, 'No vision provider configured', 500)

    const supabase = createServiceClient()

    // Lê a legenda atual (se a foto veio com caption no mesmo evento) pra não perdê-la.
    const { data: existingMsg } = await supabase
      .from('conversation_messages')
      .select('content')
      .eq('id', messageId)
      .maybeSingle()
    const caption = (existingMsg?.content as string | null) || ''

    // Descreve (best-effort). Falha NÃO bloqueia o disparo do agente — só significa
    // que o agente não verá a foto (comportamento >= o de hoje).
    // Cadeia: Gemini 2.0 Flash (primário, mais barato) → OpenAI gpt-4.1 (fallback).
    // Espelha a resiliência do transcribe-audio. Falha total NÃO bloqueia o disparo
    // do agente (só significa que o agente não verá a foto — comportamento >= hoje).
    let description = ''
    let providerUsed = 'none'
    if (GEMINI_API_KEY) {
      try {
        description = await describeWithGemini(imageUrl, GEMINI_API_KEY, callerMimeType)
        providerUsed = 'gemini'
      } catch (err) {
        log.error('Gemini vision failed', { error: (err as Error).message })
      }
    }
    if (!description && OPENAI_API_KEY) {
      try {
        description = await describeWithOpenAI(imageUrl, OPENAI_API_KEY)
        providerUsed = 'openai'
      } catch (err) {
        log.error('OpenAI vision fallback failed', { error: (err as Error).message })
      }
    }

    const transcription = composeImageTranscription(description, caption)

    const { error: updateError } = await supabase
      .from('conversation_messages')
      .update({ transcription })
      .eq('id', messageId)
    if (updateError) log.error('DB update error', { error: updateError.message })
    else log.info('Saved description to DB', { messageId, hasDescription: !!description })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    // Broadcast pro helpdesk exibir a descrição (igual transcrição de áudio).
    if (conversationId) {
      backgroundFetch(
        fetchWithTimeout(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            messages: [{ topic: 'helpdesk-realtime', event: 'transcription-updated', payload: { messageId, conversationId, transcription } }],
          }),
        }, 10000).catch(err => log.error('Broadcast failed', { error: (err as Error).message })),
      )
    }

    // Dispara o agente DEPOIS de gravar a descrição (igual transcribe-audio).
    // Sempre dispara (mesmo sem descrição): garante que o lead não fica sem resposta.
    if (conversationId && isService) {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('inbox_id, status_ia, contact_id')
          .eq('id', conversationId)
          .single()

        if (conv && conv.status_ia !== STATUS_IA.DESLIGADA) {
          const { data: inbox } = await supabase
            .from('inboxes').select('instance_id').eq('id', conv.inbox_id).single()
          if (inbox) {
            const { data: aiAgent } = await supabase
              .from('ai_agents').select('id, enabled').eq('instance_id', inbox.instance_id).eq('enabled', true).maybeSingle()
            if (aiAgent) {
              const { data: contact } = await supabase
                .from('contacts').select('jid').eq('id', conv.contact_id).single()
              log.info('Triggering AI agent', { conversationId })
              backgroundFetch(
                fetch(`${SUPABASE_URL}/functions/v1/ai-agent-debounce`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
                  body: JSON.stringify({
                    conversation_id: conversationId,
                    instance_id: inbox.instance_id,
                    contact_jid: contact?.jid || '',
                    message: { content: transcription, direction: 'incoming', media_type: 'image' },
                  }),
                }).catch(err => log.error('AI agent trigger failed', { error: (err as Error).message })),
              )
            }
          }
        }
      } catch (err) {
        log.error('AI agent trigger error', { error: (err as Error).message })
      }
    }

    log.info('END', { messageId, provider: providerUsed, hasDescription: !!description })
    return successResponse(corsHeaders, { transcription, described: !!description, provider: providerUsed })
  } catch (error) {
    log.error('FATAL ERROR', { error: (error as Error).message })
    return errorResponse(corsHeaders, 'Internal server error', 500, (error as Error).message)
  }
})
