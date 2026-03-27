import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyCronOrService, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { STATUS_IA } from '../_shared/constants.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Accept authenticated user OR internal service call (service_role key from webhook)
  const isService = verifyCronOrService(req)
  const auth = isService ? { userId: 'service' } : await verifyAuth(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  // Rate limit: max 20 transcriptions per user per minute (skip for service calls)
  if (!isService) {
    const rl = await checkRateLimit(auth.userId, 'transcribe-audio', 20, 60)
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rl), 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const { messageId, audioUrl, conversationId } = await req.json()

    if (!messageId || !audioUrl) {
      return new Response(JSON.stringify({ error: 'messageId and audioUrl required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Transcribing audio for message:', messageId, 'url:', audioUrl.substring(0, 80))

    // Download audio file (30s timeout)
    const audioResponse = await fetchWithTimeout(audioUrl, undefined, 30000)
    if (!audioResponse.ok) {
      console.error('Failed to download audio:', audioResponse.status)
      return new Response(JSON.stringify({ error: 'Failed to download audio' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const audioBlob = await audioResponse.blob()
    console.log('Audio downloaded, size:', audioBlob.size, 'type:', audioBlob.type)

    // Send to Groq Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-large-v3')
    formData.append('temperature', '0')
    formData.append('language', 'pt')
    formData.append('response_format', 'verbose_json')
    formData.append('prompt', 'Conversa o áudio em texto de forma clara e precisa.')

    // Retry Groq Whisper up to 2 times on transient failures
    let transcription = ''
    for (let attempt = 1; attempt <= 2; attempt++) {
      const groqResponse = await fetchWithTimeout('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: formData,
      }, 60000)

      if (groqResponse.ok) {
        const result = await groqResponse.json()
        transcription = result.text || ''
        break
      }

      const errText = await groqResponse.text()
      console.error(`Groq API error (attempt ${attempt}):`, groqResponse.status, errText)

      if (attempt === 2 || ![429, 500, 503].includes(groqResponse.status)) {
        return new Response(JSON.stringify({ error: 'Groq transcription failed', details: errText }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Wait 1s before retry
      await new Promise(r => setTimeout(r, 1000))
    }
    console.log('Transcription result:', transcription.substring(0, 100))

    // Update message in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: updateError } = await supabase
      .from('conversation_messages')
      .update({ transcription })
      .eq('id', messageId)

    if (updateError) {
      console.error('Failed to update transcription:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to save transcription' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Transcription saved for message:', messageId)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    // Broadcast transcription update via Realtime REST API
    if (conversationId) {
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
      }, 10000).then(r => console.log('Transcription broadcast status:', r.status))
        .catch(err => console.error('Transcription broadcast failed:', err))
    }

    // Trigger AI Agent for transcribed audio (the webhook skipped it because content was empty)
    if (conversationId && transcription && isService) {
      try {
        // Load conversation to get instance_id and check AI status
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

              console.log('Triggering AI agent for transcribed audio, conversation:', conversationId)
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
              }).catch(err => console.error('AI agent trigger after transcription failed:', err))
            }
          }
        }
      } catch (err) {
        console.error('AI agent trigger after transcription error:', err)
      }
    }

    return new Response(JSON.stringify({ ok: true, transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
