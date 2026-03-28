import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { STATUS_IA } from '../_shared/constants.ts'

// Wrapper to ensure background fetches survive response return in Edge Functions
function backgroundFetch(promise: Promise<any>): void {
  // @ts-ignore: EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise)
  }
}

/**
 * Safely converts an ArrayBuffer to base64 without stack overflow.
 * The spread trick `...new Uint8Array()` crashes for buffers > ~100KB.
 */
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

// ────────────────────────────────────────────────────────────────────────
// Provider 1: Gemini — try URL-based first, then inline base64
// ────────────────────────────────────────────────────────────────────────

/**
 * Detect MIME type from URL extension or content-type header.
 * WhatsApp audio is typically ogg/opus; UAZAPI mp3Link returns mp3.
 */
function detectAudioMime(url: string, contentType?: string): string {
  if (contentType && contentType.includes('audio/')) return contentType.split(';')[0].trim()
  if (url.includes('.mp3')) return 'audio/mp3'
  if (url.includes('.ogg')) return 'audio/ogg'
  if (url.includes('.wav')) return 'audio/wav'
  if (url.includes('.m4a') || url.includes('.aac')) return 'audio/aac'
  return 'audio/ogg' // WhatsApp default (ogg/opus)
}

async function transcribeWithGemini(audioUrl: string, geminiKey: string, mimeHint?: string): Promise<string> {
  const prompt = 'Transcreva este áudio para texto em português do Brasil. Retorne APENAS o texto transcrito, sem comentários, explicações ou formatação extra.'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

  // Gemini file_data.file_uri only works with Google Cloud Storage (gs://) or File API URIs.
  // UAZAPI returns HTTP URLs — we MUST download and send as inline_data (base64).
  // This is the fastest path: skip the URL-based attempt entirely (saves 60s timeout on failure).

  console.log('[transcribe] Gemini inline_data: downloading audio from:', audioUrl.substring(0, 120))
  const startMs = Date.now()

  const audioResp = await fetchWithTimeout(audioUrl, undefined, 30000)
  if (!audioResp.ok) {
    throw new Error(`Audio download failed: ${audioResp.status}`)
  }

  const audioBuffer = await audioResp.arrayBuffer()
  const contentType = audioResp.headers.get('content-type') || ''
  // Use caller hint > response header > URL detection
  const mimeType = (mimeHint && mimeHint.startsWith('audio/')) ? mimeHint : detectAudioMime(audioUrl, contentType)
  const base64Audio = arrayBufferToBase64(audioBuffer)
  const downloadMs = Date.now() - startMs

  console.log(`[transcribe] Audio downloaded: ${(audioBuffer.byteLength / 1024).toFixed(1)}KB, mime=${mimeType}, download=${downloadMs}ms`)

  // For large files (>20MB), use Gemini File API to avoid request size limits
  const MAX_INLINE_SIZE = 20 * 1024 * 1024
  if (audioBuffer.byteLength > MAX_INLINE_SIZE) {
    console.log('[transcribe] Large file detected — using File API upload')
    return await transcribeViaFileApi(audioBuffer, mimeType, prompt, geminiKey)
  }

  const llmStart = Date.now()
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Audio } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
  }, 60000)

  const llmMs = Date.now() - llmStart

  if (resp.ok) {
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    if (text) {
      console.log(`[transcribe] Gemini success (download=${downloadMs}ms, llm=${llmMs}ms): ${text.substring(0, 80)}`)
      return text
    }
    console.warn('[transcribe] Gemini returned empty text, response:', JSON.stringify(data).substring(0, 300))
  } else {
    const errText = await resp.text()
    console.error(`[transcribe] Gemini failed: ${resp.status} ${errText.substring(0, 200)}`)
  }

  throw new Error('Gemini transcription failed')
}

/**
 * For audio files >20MB: upload via Gemini File API, then reference in generateContent.
 * Flow: POST to /upload → get file URI → use file_data.file_uri in prompt
 */
async function transcribeViaFileApi(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  prompt: string,
  geminiKey: string,
): Promise<string> {
  // Step 1: Upload file to Gemini File API
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`
  const uploadResp = await fetchWithTimeout(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: audioBuffer,
  }, 120000)

  if (!uploadResp.ok) {
    const err = await uploadResp.text()
    throw new Error(`File API upload failed: ${uploadResp.status} ${err.substring(0, 200)}`)
  }

  const uploadData = await uploadResp.json()
  const fileUri = uploadData?.file?.uri
  if (!fileUri) throw new Error('File API returned no file URI')

  console.log('[transcribe] File API upload OK, uri:', fileUri)

  // Step 2: Use file_data.file_uri to transcribe (now works because it's a Gemini URI)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { file_data: { file_uri: fileUri, mime_type: mimeType } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
  }, 60000)

  if (resp.ok) {
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    if (text) {
      console.log(`[transcribe] Gemini File API success: ${text.substring(0, 80)}`)
      return text
    }
  }

  const errText = await resp.text().catch(() => '')
  throw new Error(`Gemini File API transcription failed: ${resp.status} ${errText.substring(0, 200)}`)
}

// ────────────────────────────────────────────────────────────────────────
// Provider 2: Groq Whisper (fallback)
// ────────────────────────────────────────────────────────────────────────

async function transcribeWithGroq(audioUrl: string, groqKey: string): Promise<string> {
  console.log('[transcribe] Trying Groq Whisper fallback, url:', audioUrl.substring(0, 80))

  const audioResp = await fetchWithTimeout(audioUrl, undefined, 30000)
  if (!audioResp.ok) throw new Error(`Audio download failed: ${audioResp.status}`)

  const audioBlob = await audioResp.blob()
  console.log('[transcribe] Groq audio size:', audioBlob.size, 'type:', audioBlob.type)

  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.mp3')
  formData.append('model', 'whisper-large-v3')
  formData.append('temperature', '0')
  formData.append('language', 'pt')
  formData.append('response_format', 'verbose_json')
  formData.append('prompt', 'Transcreva o áudio em texto de forma clara e precisa.')

  for (let attempt = 1; attempt <= 2; attempt++) {
    const groqResp = await fetchWithTimeout('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}` },
      body: formData,
    }, 60000)

    if (groqResp.ok) {
      const result = await groqResp.json()
      const text = result.text || ''
      if (text) {
        console.log('[transcribe] Groq success:', text.substring(0, 80))
        return text
      }
    }

    const errText = await groqResp.text()
    console.error(`[transcribe] Groq error (attempt ${attempt}):`, groqResp.status, errText.substring(0, 200))

    if (attempt === 2 || ![429, 500, 503].includes(groqResp.status)) {
      throw new Error(`Groq failed (${groqResp.status}): ${errText.substring(0, 200)}`)
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error('Groq transcription failed after retries')
}

// ────────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const isService = verifyCronOrService(req)
  const auth = isService ? { userId: 'service' } : await verifyAuth(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  if (!isService) {
    const rl = await checkRateLimit(auth.userId, 'transcribe-audio', 20, 60)
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rl), 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const { messageId, audioUrl, mimeType: callerMimeType, conversationId } = await req.json()
    console.log('[transcribe] ========= START =========')
    console.log('[transcribe] messageId:', messageId, 'conversationId:', conversationId, 'audioUrl:', audioUrl?.substring(0, 150))
    
    if (auth.userId === 'service') {
      console.log('[transcribe] Authenticated as internal service.')
    }

    if (!messageId || !audioUrl) {
      console.error('[transcribe] Missing params: messageId=', messageId, 'audioUrl=', audioUrl)
      return new Response(JSON.stringify({ error: 'messageId and audioUrl required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || ''
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''

    console.log('[transcribe] Keys available — Gemini:', !!GEMINI_API_KEY, 'Groq:', !!GROQ_API_KEY)

    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'No transcription provider configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Provider chain: Gemini → Groq ────────────────────────────────
    let transcription = ''
    let providerUsed = 'none'

    if (GEMINI_API_KEY) {
      try {
        transcription = await transcribeWithGemini(audioUrl, GEMINI_API_KEY, callerMimeType)
        providerUsed = 'gemini'
      } catch (err) {
        console.error('[transcribe] Gemini fully failed:', (err as Error).message)
      }
    }

    if (!transcription && GROQ_API_KEY) {
      try {
        transcription = await transcribeWithGroq(audioUrl, GROQ_API_KEY)
        providerUsed = 'groq'
      } catch (err) {
        console.error('[transcribe] Groq also failed:', (err as Error).message)
      }
    }

    if (!transcription) {
      console.error('[transcribe] ALL providers failed')
      return new Response(JSON.stringify({ error: 'All transcription providers failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[transcribe] ✅ Transcribed via ${providerUsed}:`, transcription.substring(0, 100))

    // ── Save to database ────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: updateError } = await supabase
      .from('conversation_messages')
      .update({ 
        transcription,
        media_url: audioUrl // Save the final (possibly converted to MP3) URL
      })
      .eq('id', messageId)

    if (updateError) {
      console.error('[transcribe] DB update error:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to save transcription' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[transcribe] Saved to DB for message:', messageId)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    // ── Broadcast transcription update via Realtime ─────────────────
    if (conversationId) {
      backgroundFetch(
        fetchWithTimeout(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: [{
              topic: 'helpdesk-realtime',
              event: 'transcription-updated',
              payload: { messageId, conversationId, transcription },
            }],
          }),
        }, 10000)
          .then(r => console.log('[transcribe] Broadcast status:', r.status))
          .catch(err => console.error('[transcribe] Broadcast failed:', err)),
      )
    }

    // ── Trigger AI Agent ────────────────────────────────────────────
    if (conversationId && transcription && isService) {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('inbox_id, status_ia, contact_id')
          .eq('id', conversationId)
          .single()

        if (conv && conv.status_ia !== STATUS_IA.DESLIGADA) {
          const { data: inbox } = await supabase
            .from('inboxes')
            .select('instance_id')
            .eq('id', conv.inbox_id)
            .single()

          if (inbox) {
            const { data: aiAgent } = await supabase
              .from('ai_agents')
              .select('id, enabled')
              .eq('instance_id', inbox.instance_id)
              .eq('enabled', true)
              .maybeSingle()

            if (aiAgent) {
              const { data: contact } = await supabase
                .from('contacts')
                .select('jid')
                .eq('id', conv.contact_id)
                .single()

              console.log('[transcribe] Triggering AI agent for conversation:', conversationId)
              backgroundFetch(
                fetch(`${SUPABASE_URL}/functions/v1/ai-agent-debounce`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    conversation_id: conversationId,
                    instance_id: inbox.instance_id,
                    contact_jid: contact?.jid || '',
                    message: {
                      content: transcription,
                      direction: 'incoming',
                      media_type: 'audio',
                    },
                  }),
                }).catch(err => console.error('[transcribe] AI agent trigger failed:', err)),
              )
            }
          }
        }
      } catch (err) {
        console.error('[transcribe] AI agent trigger error:', err)
      }
    }

    console.log('[transcribe] ========= END =========')
    return new Response(JSON.stringify({ ok: true, transcription, provider: providerUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[transcribe] FATAL ERROR:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
