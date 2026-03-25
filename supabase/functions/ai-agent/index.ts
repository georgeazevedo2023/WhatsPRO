import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY') || ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

/** Remove redundant brand/name from last segment of product title */
function cleanProductTitle(title: string): string {
  const parts = title.split(' - ')
  if (parts.length <= 2) return title
  const lastPart = parts[parts.length - 1].trim()
  const rest = parts.slice(0, -1).join(' - ')
  const lastWords = lastPart.split(/\s+/)
  // Check for 3-consecutive-word overlap between last segment and earlier text
  for (let i = 0; i <= lastWords.length - 3; i++) {
    const subseq = lastWords.slice(i, i + 3).join(' ')
    if (rest.toLowerCase().includes(subseq.toLowerCase())) {
      const restLower = rest.toLowerCase()
      const uniqueWords = lastWords.filter(w => w.length > 2 && !restLower.includes(w.toLowerCase()))
      return uniqueWords.length > 0 ? `${rest} - ${uniqueWords.join(' ')}` : rest
    }
  }
  return title
}

// LLM prompt only generates cards 2-N (card 1 is code-generated)
const COPY_PROMPT = (title: string, price: string, desc: string, count: number) =>
  `Gere ${count} textos curtos e persuasivos para cards de carrossel WhatsApp.\n` +
  `Produto: ${title} | ${price}\nDescrição: ${desc.substring(0, 200)}\n\n` +
  `Responda APENAS um JSON array de ${count} strings. Exemplo: ["texto1","texto2",...]\n` +
  `- Texto 1: Copy de vendas — benefício principal\n` +
  `- Texto 2: Detalhes técnicos ou especificações\n` +
  `- Texto 3: Diferencial de qualidade\n` +
  `- Texto 4: Urgência + call-to-action\n\n` +
  `Regras: máx 80 chars por texto, sem emojis, português BR, persuasivo. NÃO mencione o nome completo do produto.`

function parseCopyResponse(text: string, count: number): string[] | null {
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return null
  try {
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr) || arr.length < count) return null
    return arr.slice(0, count).map((c: any) => String(c).substring(0, 120))
  } catch { return null }
}

/** Generate sales copy for carousel cards: Card 1 = code, Cards 2-5 = Groq → Gemini → Mistral → static */
async function generateCarouselCopies(product: any, numCards: number): Promise<string[]> {
  const title = product.title || 'Produto'
  const price = product.price ? `R$ ${product.price.toFixed(2)}` : 'Sob consulta'
  const desc = product.description || ''

  // Card 1 is ALWAYS code-generated (deterministic, clean title + price)
  const card1 = `${cleanProductTitle(title)}\n${price}`

  if (numCards <= 1) return [card1]

  const copyCount = numCards - 1 // How many cards the LLM needs to generate
  const prompt = COPY_PROMPT(title, price, desc, copyCount)

  // Static fallback for cards 2-5
  const fallbackCopies = [
    `Qualidade garantida!\nO melhor para sua obra`,
    `Alto desempenho e durabilidade\nResultado profissional`,
    `Marca de confiança!\nEscolha dos especialistas`,
    `Aproveite agora!\nUnidades limitadas`,
  ].slice(0, copyCount)

  // Try LLM chain for cards 2-N: Groq → Gemini → Mistral → static
  const providers: Array<{ name: string, call: () => Promise<string | null> }> = []

  if (GROQ_API_KEY) providers.push({ name: 'Groq', call: async () => {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 300 }),
    }, 3000)
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  }})

  if (GEMINI_API_KEY) providers.push({ name: 'Gemini', call: async () => {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 300 } }) }, 3000)
    if (!res.ok) return null
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  }})

  if (MISTRAL_API_KEY) providers.push({ name: 'Mistral', call: async () => {
    const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 300 }),
    }, 3000)
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  }})

  for (const provider of providers) {
    try {
      const text = await provider.call()
      if (text) {
        const copies = parseCopyResponse(text, copyCount)
        if (copies) {
          console.log(`[ai-agent] Carousel copies: ${provider.name} OK`)
          return [card1, ...copies]
        }
      }
      console.warn(`[ai-agent] ${provider.name} copy: bad response`)
    } catch (e) { console.warn(`[ai-agent] ${provider.name} copy error:`, e) }
  }

  console.warn('[ai-agent] Carousel copies: all LLMs failed, using static')
  return [card1, ...fallbackCopies]
}

/** Handoff detection phrases — used for implicit handoff when Gemini doesn't call the tool */
const HANDOFF_PHRASES = ['encaminhar para', 'consultor de vendas', 'atendente humano', 'transferir para', 'falar com um vendedor', 'encaminhar você']

/** Merge tags using key:value format (same key = replace) */
function mergeTags(existing: string[], newTags: Record<string, string>): string[] {
  const tagMap = new Map(existing.map(t => [t.split(':')[0], t]))
  for (const [k, v] of Object.entries(newTags)) tagMap.set(k, `${k}:${v}`)
  return Array.from(tagMap.values())
}

/**
 * AI Agent - Main Brain (v2 — Sprint 3)
 *
 * Tools: search_products, send_carousel, send_media, handoff_to_human,
 *        assign_label, set_tags, move_kanban, update_lead_profile
 * Modes: normal, shadow (listens without responding)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Validate caller: only accept requests with valid anon key (called by debounce/webhook)
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!token || token !== anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { conversation_id, instance_id, messages: queuedMessages, agent_id } = body

    if (!conversation_id || !instance_id || !agent_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Load agent config
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (!agent || !agent.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'agent_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Load conversation (with tags)
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, contact_id, inbox_id, status, status_ia, assigned_to, department_id, tags, created_at')
      .eq('id', conversation_id)
      .single()

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if IA is fully disabled (manual block — not shadow/handoff)
    if (conversation.status_ia === 'desligada') {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'ia_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Load contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, jid, ia_blocked_instances')
      .eq('id', conversation.contact_id)
      .single()

    if (!contact?.jid) {
      return new Response(JSON.stringify({ error: 'Contact JID not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check IA block for this contact on this instance
    const blockedInstances: string[] = contact.ia_blocked_instances || []
    if (blockedInstances.includes(instance_id)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'ia_blocked_instance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if contact number is in agent's blocked numbers list
    const blockedNumbers: string[] = agent.blocked_numbers || []
    const contactPhone = contact.phone || contact.jid?.split('@')[0] || ''
    if (blockedNumbers.some(bn => contactPhone.includes(bn) || bn.includes(contactPhone))) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'blocked_number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Load instance token (needed by tools)
    const { data: instance } = await supabase
      .from('instances')
      .select('token')
      .eq('id', instance_id)
      .maybeSingle()

    if (!instance?.token) {
      return new Response(JSON.stringify({ error: 'Instance token not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

    // 4.5 Send "typing..." indicator (refresh — debounce sent it once but processing takes time)
    const sendPresence = (type: 'composing' | 'recording') => {
      fetchFireAndForget(`${uazapiUrl}/chat/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ id: contact.jid, presence: type }),
      })
    }

    /** Calculate typing delay: ~40ms per char, min 1s, max 5s */
    const typingDelay = (text: string) => Math.min(5000, Math.max(1000, text.length * 40))

    /** Send text message via UAZAPI with typing delay */
    const sendTextMsg = async (text: string) => {
      const res = await fetchWithTimeout(`${uazapiUrl}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ number: contact.jid, text, delay: typingDelay(text) }),
      })
      if (!res.ok) console.error(`[ai-agent] send/text failed: ${res.status} ${(await res.text()).substring(0, 100)}`)
      return res.ok
    }

    /** Send text as TTS audio via Gemini, returns true if audio sent, false if fallback to text */
    const sendTts = async (text: string): Promise<boolean> => {
      try {
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`
        const ttsRes = await fetchWithTimeout(ttsUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Leia o seguinte texto em português brasileiro com tom natural e amigável: "${text}"` }] }],
            generationConfig: { response_modalities: ['AUDIO'], speech_config: { voice_config: { prebuilt_voice_config: { voice_name: agent.voice_name || 'Kore' } } } },
          }),
        })
        if (!ttsRes.ok) { console.warn('[ai-agent] TTS failed:', ttsRes.status); return false }
        const ttsData = await ttsRes.json()
        const audioPart = ttsData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
        if (!audioPart?.inlineData?.data) return false
        const pcmBytes = Uint8Array.from(atob(audioPart.inlineData.data), c => c.charCodeAt(0))
        const wavHeader = new ArrayBuffer(44)
        const view = new DataView(wavHeader)
        const sr = 24000, ch = 1, bps = 16
        view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + pcmBytes.length, true); view.setUint32(8, 0x57415645, false)
        view.setUint32(12, 0x666D7420, false); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
        view.setUint16(22, ch, true); view.setUint32(24, sr, true); view.setUint32(28, sr * ch * (bps / 8), true)
        view.setUint16(32, ch * (bps / 8), true); view.setUint16(34, bps, true)
        view.setUint32(36, 0x64617461, false); view.setUint32(40, pcmBytes.length, true)
        const wavBytes = new Uint8Array(44 + pcmBytes.length)
        wavBytes.set(new Uint8Array(wavHeader), 0); wavBytes.set(pcmBytes, 44)
        let wavBin = ''
        for (let i = 0; i < wavBytes.length; i += 8192) wavBin += String.fromCharCode(...wavBytes.subarray(i, Math.min(i + 8192, wavBytes.length)))
        await fetchWithTimeout(`${uazapiUrl}/send/media`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'token': instance.token },
          body: JSON.stringify({ number: contact.jid, type: 'ptt', file: btoa(wavBin), delay: 2000 }),
        })
        console.log(`[ai-agent] TTS sent (${text.length} chars)`)
        return true
      } catch (e) { console.warn('[ai-agent] TTS error:', e); return false }
    }

    /** Broadcast event to helpdesk (fire-and-forget, uses SERVICE_ROLE) */
    const broadcastEvent = (payload: Record<string, any>) => {
      for (const topic of ['helpdesk-realtime', 'helpdesk-conversations']) {
        fetchFireAndForget(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_ROLE_KEY, 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ messages: [{ topic, event: 'new-message', payload }] }),
        })
      }
    }
    sendPresence('composing')

    // 5. Combine queued messages
    const incomingMessages = (queuedMessages || [])
      .filter((m: any) => m.direction === 'incoming' || !m.direction)
    const incomingText = incomingMessages
      .map((m: any) => m.content || '')
      .filter(Boolean)
      .join('\n')
    const incomingHasAudio = incomingMessages.some((m: any) => m.media_type === 'audio')

    if (!incomingText.trim()) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5.5 Check handoff_triggers — force handoff if lead text matches any trigger
    // Only trigger after agent has replied at least once (skip on first interaction)
    const triggers: string[] = agent.handoff_triggers || []
    const { count: outgoingCount } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
      .eq('direction', 'outgoing')
    const hasInteracted = (outgoingCount || 0) >= 1

    if (triggers.length > 0 && hasInteracted) {
      const textLower = incomingText.toLowerCase()
      const matchedTrigger = triggers.find((t: string) => textLower.includes(t.toLowerCase()))
      if (matchedTrigger) {
        console.log(`[ai-agent] Handoff trigger matched: "${matchedTrigger}" in text: "${incomingText.substring(0, 80)}"`)
        const handoffMsg = agent.handoff_message || 'Só um instante que vou te encaminhar para nosso consultor de vendas.'

        // Send handoff message
        await sendTextMsg(handoffMsg)
        await supabase.from('conversation_messages').insert({
          conversation_id, direction: 'outgoing', content: handoffMsg, media_type: 'text',
        })

        // Switch to shadow mode (AI listens, extracts tags/labels, but doesn't respond)
        await supabase.from('conversations').update({
          status_ia: 'shadow',
          tags: mergeTags(conversation.tags || [], { ia: 'shadow' }),
        }).eq('id', conversation_id)

        // Log + Broadcast
        await supabase.from('ai_agent_logs').insert({
          agent_id, conversation_id, event: 'handoff_trigger',
          latency_ms: Date.now() - startTime,
          metadata: { trigger: matchedTrigger, incoming_text: incomingText.substring(0, 300) },
        })
        broadcastEvent({ conversation_id, inbox_id: conversation.inbox_id, direction: 'outgoing', content: handoffMsg, media_type: 'text' })

        return new Response(JSON.stringify({ ok: true, handoff: true, trigger: matchedTrigger }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 6. Load labels (current + available)
    const { data: currentLabels } = await supabase
      .from('conversation_labels')
      .select('label_id, labels(name)')
      .eq('conversation_id', conversation_id)

    const { data: availableLabels } = await supabase
      .from('labels')
      .select('id, name')
      .eq('inbox_id', conversation.inbox_id)

    const currentLabelNames = (currentLabels || []).map((cl: any) => cl.labels?.name).filter(Boolean)
    const availableLabelNames = (availableLabels || []).map((l: any) => l.name)

    // 7. Load context: last N messages
    const contextLimit = agent.context_short_messages || 10
    const { data: historyMessages } = await supabase
      .from('conversation_messages')
      .select('direction, content, media_type, created_at')
      .eq('conversation_id', conversation_id)
      .neq('direction', 'private_note')
      .order('created_at', { ascending: false })
      .limit(contextLimit)

    const contextMessages = (historyMessages || []).reverse()

    // 8. Load lead profile (ALWAYS — needed for greeting check + profile updates)
    let leadContext = ''
    const { data: leadProfile } = await supabase
      .from('lead_profiles')
      .select('*')
      .eq('contact_id', contact.id)
      .maybeSingle()

    // Build lead context for system prompt (only when long context is enabled)
    if (agent.context_long_enabled && leadProfile) {
      const parts: string[] = []
      if (leadProfile.full_name) parts.push(`Nome: ${leadProfile.full_name}`)
      if (leadProfile.city) parts.push(`Cidade: ${leadProfile.city}`)
      if (leadProfile.interests?.length) parts.push(`Interesses: ${leadProfile.interests.join(', ')}`)
      if (leadProfile.average_ticket) parts.push(`Ticket médio: R$${leadProfile.average_ticket}`)
      if (leadProfile.reason) parts.push(`Motivo do contato: ${leadProfile.reason}`)
      if (leadProfile.notes) parts.push(`Observações: ${leadProfile.notes}`)
      if (parts.length > 0) leadContext = `\n\nDados conhecidos do lead:\n${parts.join('\n')}`

      // Explicit name personalization instruction
      if (leadProfile.full_name) {
        leadContext += `\n\nSEMPRE use o nome "${leadProfile.full_name}" para personalizar suas respostas. Chame o lead pelo nome.`
      }

      // Conversation history (persistent summaries from past interactions)
      const summaries: any[] = leadProfile.conversation_summaries || []
      if (summaries.length > 0) {
        const recent = summaries.slice(-5) // Last 5 interactions
        leadContext += `\n\nHistórico de interações anteriores (${summaries.length} total):\n`
        leadContext += recent.map((s: any) => {
          const date = new Date(s.date).toLocaleDateString('pt-BR')
          const parts = [`[${date}] ${s.summary}`]
          if (s.products?.length) parts.push(`Produtos: ${s.products.join(', ')}`)
          if (s.sentiment) parts.push(`Sentimento: ${s.sentiment}`)
          if (s.outcome) parts.push(`Resultado: ${s.outcome}`)
          return parts.join(' | ')
        }).join('\n')
        leadContext += '\n\nUse este histórico para personalizar o atendimento. Faça referência a interações anteriores quando relevante.'
      }
    }

    // 8.5 Load campaign context (if conversation has campaign attribution)
    let campaignContext = ''
    const campaignTag = (conversation.tags || []).find((t: string) => t.startsWith('campanha:'))
    if (campaignTag) {
      const campaignName = campaignTag.split(':').slice(1).join(':')
      const { data: campaignData } = await supabase
        .from('utm_campaigns')
        .select('name, campaign_type, ai_template, ai_custom_text, utm_source, utm_medium')
        .eq('instance_id', instance_id)
        .eq('name', campaignName)
        .maybeSingle()

      if (campaignData) {
        const parts: string[] = [
          `\n\n=== CONTEXTO DA CAMPANHA ===`,
          `Este lead chegou pela campanha "${campaignData.name}" (tipo: ${campaignData.campaign_type}).`,
          `Origem: ${campaignData.utm_source || 'direto'}${campaignData.utm_medium ? ` / ${campaignData.utm_medium}` : ''}`,
        ]
        if (campaignData.ai_template) parts.push(`Instrução base: ${campaignData.ai_template}`)
        if (campaignData.ai_custom_text) parts.push(`Detalhes: ${campaignData.ai_custom_text}`)
        parts.push('Adapte seu atendimento ao contexto desta campanha.')
        campaignContext = parts.join('\n')
      }
    }

    // ── SHADOW MODE ──────────────────────────────────────────────────────
    // AI listens without responding, only extracts info via tools
    if (conversation.status_ia === 'shadow') {
      console.log(`[ai-agent] Shadow mode for conversation ${conversation_id}`)

      const shadowPrompt = `Você é um extrator de dados. Analise a mensagem do lead e extraia informações relevantes.
Use set_tags para registrar dados no formato "chave:valor".
Use update_lead_profile para salvar nome, cidade e interesses.
NÃO gere resposta para o usuário. Apenas extraia dados.
${agent.extraction_fields?.length ? `\nCampos para extrair: ${agent.extraction_fields.filter((f: any) => f.enabled).map((f: any) => f.label).join(', ')}` : ''}`

      const shadowTools = [{
        function_declarations: [
          { name: 'set_tags', description: 'Adiciona tags à conversa', parameters: { type: 'OBJECT', properties: { tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tags formato chave:valor' } }, required: ['tags'] } },
          { name: 'update_lead_profile', description: 'Atualiza perfil do lead', parameters: { type: 'OBJECT', properties: { full_name: { type: 'STRING' }, city: { type: 'STRING' }, interests: { type: 'ARRAY', items: { type: 'STRING' } }, notes: { type: 'STRING' } } } },
        ],
      }]

      const geminiModel = agent.model || 'gemini-2.5-flash'
      const shadowUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`

      const shadowRes = await fetchWithTimeout(shadowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: shadowPrompt }] },
          contents: [{ role: 'user', parts: [{ text: incomingText }] }],
          tools: shadowTools,
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      })

      if (shadowRes.ok) {
        const shadowData = await shadowRes.json()
        const parts = shadowData?.candidates?.[0]?.content?.parts || []
        for (const p of parts) {
          if (p.functionCall) {
            const { name, args } = p.functionCall
            await executeShadowTool(name, args || {})
          }
        }
      }

      await supabase.from('ai_agent_logs').insert({
        agent_id, conversation_id, event: 'shadow_extraction',
        latency_ms: Date.now() - startTime,
        metadata: { incoming_text: incomingText.substring(0, 300) },
      })

      return new Response(JSON.stringify({ ok: true, reason: 'shadow_mode' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Shadow tool executor (only set_tags and update_lead_profile)
    async function executeShadowTool(name: string, args: Record<string, any>) {
      if (name === 'set_tags') {
        const newTags: string[] = args.tags || []
        const existing: string[] = conversation.tags || []
        const tagMap = new Map<string, string>()
        for (const t of existing) tagMap.set(t.split(':')[0], t)
        for (const t of newTags) tagMap.set(t.split(':')[0], t)
        await supabase.from('conversations').update({ tags: Array.from(tagMap.values()) }).eq('id', conversation_id)
      }
      if (name === 'update_lead_profile') {
        const updates: Record<string, any> = { last_contact_at: new Date().toISOString() }
        if (args.full_name) updates.full_name = args.full_name
        if (args.city) updates.city = args.city
        if (args.interests?.length) updates.interests = args.interests
        if (args.notes) updates.notes = args.notes
        if (args.reason) updates.reason = args.reason
        if (args.average_ticket) updates.average_ticket = args.average_ticket
        await supabase.from('lead_profiles').upsert({ contact_id: contact.id, ...updates }, { onConflict: 'contact_id' })
      }
    }

    // ── NORMAL MODE ──────────────────────────────────────────────────────

    // 9. Greeting check — FRESH query to avoid race conditions with cached contextMessages
    const { count: recentOutgoingTotal } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
      .eq('direction', 'outgoing')
      .gte('created_at', new Date(Date.now() - 120000).toISOString()) // last 2 minutes

    const agentHasRepliedRecently = (recentOutgoingTotal || 0) > 0
    const agentHasReplied = contextMessages.some((m: any) => m.direction === 'outgoing')

    // Only greet if NO outgoing messages in last 2 min (fresh DB check, not cached)
    const shouldGreet = !agentHasRepliedRecently && agent.greeting_message

    // If context was cleared but old messages exist, clear them so model treats as first interaction
    if (shouldGreet && agentHasReplied) {
      contextMessages.length = 0
      console.log('[ai-agent] Greeting mode — cleared old messages from history')
    }

    // If first interaction, send greeting and STOP — wait for lead to respond
    if (shouldGreet) {
      // Save greeting to DB first (acts as lock for concurrent calls)
      const { data: saved } = await supabase.from('conversation_messages').insert({
        conversation_id, direction: 'outgoing', content: agent.greeting_message, media_type: 'text',
        external_id: `ai_greeting_${Date.now()}`,
      }).select('id').single()

      // Double-check: if another call also just saved, count will be >1
      const { count: justNow } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation_id)
        .eq('direction', 'outgoing')
        .gte('created_at', new Date(Date.now() - 10000).toISOString()) // last 10s
      if ((justNow || 0) > 1) {
        if (saved?.id) await supabase.from('conversation_messages').delete().eq('id', saved.id)
        console.log('[ai-agent] Greeting duplicate detected — skipping')
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_duplicate' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Step 3: We're the only one — send via UAZAPI (TTS or text)
      const maxTts = agent.voice_max_text_length || 150
      const voiceReply = agent.voice_reply_to_audio ?? true
      const greetWithAudio = (agent.voice_enabled || (incomingHasAudio && voiceReply)) && agent.greeting_message.length <= maxTts
      let greetMediaType = 'text'

      if (greetWithAudio) {
        sendPresence('recording')
        const sent = await sendTts(agent.greeting_message)
        if (sent) { greetMediaType = 'audio' } else { await sendTextMsg(agent.greeting_message) }
      } else {
        await sendTextMsg(agent.greeting_message)
      }

      // Step 4: Update DB record with correct media_type + update conversation
      if (greetMediaType === 'audio' && saved?.id) {
        await supabase.from('conversation_messages').update({ media_type: 'audio' }).eq('id', saved.id)
      }
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
        last_message: agent.greeting_message.substring(0, 200),
        status_ia: 'ligada',
      }).eq('id', conversation_id)
      broadcastEvent({ conversation_id, inbox_id: conversation.inbox_id, direction: 'outgoing', content: agent.greeting_message, media_type: greetMediaType })

      console.log(`[ai-agent] First interaction — greeting sent as ${greetMediaType}`)
      await supabase.from('ai_agent_logs').insert({
        agent_id, conversation_id, event: 'greeting_sent',
        latency_ms: Date.now() - startTime,
        metadata: { media_type: greetMediaType },
      })
      return new Response(JSON.stringify({ ok: true, greeting: true, media_type: greetMediaType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 10. Build extraction fields + sub-agents instructions
    const extractionFields = (agent.extraction_fields || []).filter((f: any) => f.enabled)
    const extractionInstruction = extractionFields.length > 0
      ? `\nCampos para extrair durante a conversa (use set_tags + update_lead_profile):\n${extractionFields.map((f: any) => `- ${f.label} (chave: ${f.key})`).join('\n')}`
      : ''

    // Sub-agents: inject active sub-agent prompts as behavioral modes
    const subAgents = agent.sub_agents || {}
    const activeSubAgents = Object.entries(subAgents)
      .filter(([_, v]: [string, any]) => v?.enabled && v?.prompt)
      .map(([k, v]: [string, any]) => `[Modo ${k.toUpperCase()}]: ${v.prompt}`)
    const subAgentInstruction = activeSubAgents.length > 0
      ? `\n\nModos de atendimento disponíveis (adapte seu comportamento conforme o contexto da conversa):\n${activeSubAgents.join('\n\n')}`
      : ''

    // 11. Build system prompt
    const systemPrompt = `Você é ${agent.name}, um assistente virtual de WhatsApp.

Personalidade: ${agent.personality || 'Profissional, simpático e objetivo'}

${agent.system_prompt || 'Responda de forma clara, objetiva e simpática. Use emojis com moderação.'}
${leadContext || '\n\nNenhum histórico anterior deste lead. Trate como NOVO cliente — não assuma que já se conhecem.'}
${campaignContext}

REGRA CRÍTICA: Faça APENAS UMA pergunta por mensagem. Nunca envie duas perguntas na mesma resposta.

Regras gerais:
- Responda SEMPRE em português do Brasil
- Seja conciso (máximo 3-4 frases por resposta)
- Use emojis com moderação (1-2 por mensagem)
- Nunca invente informações sobre produtos, preços ou disponibilidade
- Se NÃO há dados conhecidos do lead abaixo, trate como PRIMEIRA interação — NÃO diga "que bom te ver de novo" ou similares
${agent.blocked_topics?.length ? `\nTópicos PROIBIDOS (não fale sobre): ${agent.blocked_topics.join(', ')}` : ''}
${agent.blocked_phrases?.length ? `\nFrases PROIBIDAS (nunca use): ${agent.blocked_phrases.join(', ')}` : ''}

Fluxo de Qualificação do Lead (SDR):
1. SAUDAÇÃO: Na primeira mensagem, cumprimente e pergunte o nome
2. QUALIFICAR (UMA pergunta por vez):
   - Colete nome do lead → update_lead_profile(full_name) — salve APENAS o nome informado, nunca duplique
   - Identifique o motivo REAL do contato → set_tags motivo:X (valores: compra, troca, orcamento, duvida, suporte, financeiro, emprego, fornecedor, informacao)
   - Identifique o produto/serviço de interesse → set_tags interesse:X
   - Colete cidade/bairro se relevante → update_lead_profile(city)
   - Se mencionar valor → update_lead_profile(average_ticket, reason)

3. REGRA CRÍTICA — GENÉRICO vs ESPECÍFICO:
   a) MENÇÃO GENÉRICA (ex: "verniz", "tinta", "piso", "argamassa") → NÃO faça search_products ainda!
      Primeiro QUALIFIQUE perguntando:
      - Para que ambiente? (interno, externo, sol e chuva?)
      - Tem preferência de marca?
      - Qual cor ou tonalidade?
      - Qual tamanho/quantidade precisa?
      Só use search_products DEPOIS de ter pelo menos 1 critério específico (marca, cor, tamanho ou aplicação).
   b) MENÇÃO ESPECÍFICA (ex: "Verniz Sol E Chuva da Iquine", "tinta Coral Branco Neve 18L") → use search_products IMEDIATAMENTE

4. APRESENTAR PRODUTO — Após search_products retornar resultados:
   a) Se encontrou produto com fotos: use send_carousel para enviar as fotos
   b) O send_carousel automaticamente mostra múltiplas fotos quando há 1 produto com várias fotos
   c) Depois pergunte: "É esse que você procura?"
   d) Se encontrou produto sem foto: descreva em texto e pergunte se é o que procura
   e) Se NÃO encontrou: faça handoff_to_human IMEDIATAMENTE — NÃO diga "não encontrei", NÃO pergunte nada, apenas faça o transbordo

5. TRANSBORDO OBRIGATÓRIO — faça handoff_to_human quando:
   a) Lead confirmar interesse no produto apresentado ("quero esse", "é esse mesmo", "quanto custa", "sim")
   b) Lead pedir para falar com vendedor/atendente/humano
   c) search_products retornar 0 resultados
   d) Lead indeciso após 5 mensagens de qualificação sem afunilar interesse
   e) Qualificação completa mas sem produto exato no catálogo
   → SEMPRE nesta ordem: set_tags → update_lead_profile → handoff_to_human
   → No motivo do handoff SEMPRE inclua: nome do lead, telefone, produto de interesse, motivo

REGRA CRÍTICA DE TRANSBORDO:
- NUNCA diga "não encontrei", "não temos", "não achei" — simplesmente faça handoff_to_human
- NUNCA pergunte "posso te transferir?", "o que acha?", "quer que eu transfira?" — apenas transfira
- NUNCA use "Posso te transferir..." — use afirmação direta: "Vou te encaminhar..."
- A mensagem de transbordo é enviada automaticamente pelo tool handoff_to_human — NÃO gere texto adicional

REGRA CRÍTICA: NUNCA faça search_products para termos genéricos ("verniz", "tinta", "piso") sem qualificar antes (ambiente, marca, cor, tamanho).
REGRA CRÍTICA: Para menções ESPECÍFICAS (marca + produto), SEMPRE faça search_products antes de qualquer outra ação.
REGRA CRÍTICA: Se search_products retornou 0 resultados, faça handoff_to_human IMEDIATAMENTE sem comentar.
REGRA CRÍTICA: Quando search_products retorna produto com fotos, o carrossel é enviado automaticamente — NÃO chame send_carousel novamente.

REGRA CRÍTICA DE TAGS: SEMPRE use set_tags A CADA mensagem do lead para atualizar motivo e interesse.
- "vocês tem X?", "tem X?", "quero X", "procuro X", "preciso de X" → motivo:compra, interesse:X
- "quanto custa X?", "qual o preço?", "me passa o valor" → motivo:compra, interesse:X
- "preciso trocar Y", "quero devolver" → motivo:troca, interesse:Y
- "quero um orçamento", "me faz um orçamento" → motivo:orcamento
- "como aplica?", "qual a diferença entre?", "serve para?" → motivo:duvida_tecnica
- Perguntar se a loja TEM um produto é COMPRA, não dúvida
- Tags com mesma chave são substituídas automaticamente (motivo:saudacao → motivo:compra)

Máximo 4-5 perguntas de qualificação. Se indeciso após 5, faça handoff.

Gerenciamento de Labels (Pipeline):
- Use assign_label para mover o lead pelas etapas do funil de vendas
- Labels representam etapas do pipeline
- Labels disponíveis nesta inbox: ${availableLabelNames.length > 0 ? availableLabelNames.join(', ') : '(nenhuma configurada)'}
${currentLabelNames.length > 0 ? `- Labels atuais da conversa: ${currentLabelNames.join(', ')}` : ''}

Gerenciamento de Tags:
- Use set_tags para registrar informações coletadas do lead
- Formato: "chave:valor" (ex: "motivo:compra", "interesse:tinta_interna", "nome:George")
- Tags são cumulativas (novas substituem antigas com mesma chave)
${conversation.tags?.length ? `- Tags atuais: ${conversation.tags.join(', ')}` : ''}
${extractionInstruction}

Regras dos tools de envio:
- Use send_carousel quando tiver 2+ produtos COM imagem
- Use send_media quando quiser enviar UMA imagem específica
- SEMPRE responda com texto DEPOIS de usar send_carousel ou send_media
- Nunca use send_carousel ou send_media sem antes ter feito search_products
${subAgentInstruction}`

    // 12. Build conversation history for Gemini
    const geminiContents: any[] = []
    for (const msg of contextMessages) {
      if (msg.content) {
        geminiContents.push({
          role: msg.direction === 'incoming' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })
      }
    }
    geminiContents.push({ role: 'user', parts: [{ text: incomingText }] })

    // 13. Define tools for function calling (8 tools)
    const tools = [{
      function_declarations: [
        {
          name: 'search_products',
          description: 'Busca produtos no catálogo. Se encontrar produtos com fotos, envia carrossel AUTOMATICAMENTE — NÃO chame send_carousel depois. Use APENAS para buscas específicas (marca, modelo), não para termos genéricos.',
          parameters: { type: 'OBJECT', properties: {
            query: { type: 'STRING', description: 'Texto de busca (nome, modelo, marca)' },
            category: { type: 'STRING', description: 'Categoria do produto' },
            subcategory: { type: 'STRING', description: 'Subcategoria do produto' },
            min_price: { type: 'NUMBER', description: 'Preço mínimo' },
            max_price: { type: 'NUMBER', description: 'Preço máximo' },
          }},
        },
        {
          name: 'send_carousel',
          description: 'Envia carrossel de produtos no WhatsApp com imagens e botões. Use quando tiver 2+ produtos COM imagem.',
          parameters: { type: 'OBJECT', properties: {
            product_ids: { type: 'ARRAY', description: 'Títulos exatos dos produtos (max 10)', items: { type: 'STRING' } },
            message: { type: 'STRING', description: 'Texto antes do carrossel' },
          }, required: ['product_ids'] },
        },
        {
          name: 'send_media',
          description: 'Envia imagem ou documento no WhatsApp. Use para foto de produto específico.',
          parameters: { type: 'OBJECT', properties: {
            media_url: { type: 'STRING', description: 'URL da imagem ou documento' },
            media_type: { type: 'STRING', description: 'Tipo: image, video, document' },
            caption: { type: 'STRING', description: 'Legenda da mídia' },
          }, required: ['media_url', 'media_type'] },
        },
        {
          name: 'assign_label',
          description: 'Atribui uma etiqueta (label) à conversa para rastrear o estágio no funil de vendas. Labels disponíveis: ' + availableLabelNames.join(', '),
          parameters: { type: 'OBJECT', properties: {
            label_name: { type: 'STRING', description: 'Nome exato da etiqueta a atribuir' },
          }, required: ['label_name'] },
        },
        {
          name: 'set_tags',
          description: 'Adiciona tags à conversa para rastrear interesses e informações. Tags são cumulativas. Formato: "chave:valor".',
          parameters: { type: 'OBJECT', properties: {
            tags: { type: 'ARRAY', description: 'Tags no formato "chave:valor" (ex: "motivo:compra", "interesse:tinta")', items: { type: 'STRING' } },
          }, required: ['tags'] },
        },
        {
          name: 'move_kanban',
          description: 'Move o card do CRM Kanban para outra coluna. Use para atualizar estágio do lead no quadro de vendas.',
          parameters: { type: 'OBJECT', properties: {
            column_name: { type: 'STRING', description: 'Nome da coluna de destino' },
          }, required: ['column_name'] },
        },
        {
          name: 'update_lead_profile',
          description: 'Atualiza perfil do lead com informações coletadas. Use para salvar nome, cidade, interesses, motivo do contato e ticket médio.',
          parameters: { type: 'OBJECT', properties: {
            full_name: { type: 'STRING', description: 'Nome completo do lead' },
            city: { type: 'STRING', description: 'Cidade do lead' },
            interests: { type: 'ARRAY', description: 'Interesses do lead', items: { type: 'STRING' } },
            notes: { type: 'STRING', description: 'Observações adicionais' },
            reason: { type: 'STRING', description: 'Motivo do contato (ex: compra, orçamento, dúvida, suporte, informação)' },
            average_ticket: { type: 'NUMBER', description: 'Valor estimado do ticket/orçamento em reais' },
          }},
        },
        {
          name: 'handoff_to_human',
          description: 'Transfere a conversa para um atendente humano. Use quando lead pedir vendedor, demonstrar interesse em comprar, ou quando detectar frustração.',
          parameters: { type: 'OBJECT', properties: {
            reason: { type: 'STRING', description: 'Motivo do transbordo com resumo dos dados coletados (produto, nome, cidade, interesses)' },
          }, required: ['reason'] },
        },
      ],
    }]

    // 14. Tool execution function
    async function executeTool(name: string, args: Record<string, any>): Promise<string> {
      switch (name) {
        case 'search_products': {
          const baseQuery = () => supabase
            .from('ai_agent_products')
            .select('title, category, subcategory, description, price, images, in_stock')
            .eq('agent_id', agent_id)
            .eq('enabled', true)

          let query = baseQuery()
          if (args.min_price) query = query.gte('price', args.min_price)
          if (args.max_price) query = query.lte('price', args.max_price)

          // Build search: try exact phrase first, then word-by-word fallback
          const searchText = args.query || ''
          const categoryText = args.category || ''

          if (searchText) {
            query = query.or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%,category.ilike.%${searchText}%,subcategory.ilike.%${searchText}%`)
          }
          if (categoryText) query = query.or(`category.ilike.%${categoryText}%,subcategory.ilike.%${categoryText}%`)

          let { data: products } = await query.limit(10)

          // Fallback: if no results and query has multiple words, search each word
          if ((!products || products.length === 0) && searchText && searchText.includes(' ')) {
            const words = searchText.split(/\s+/).filter((w: string) => w.length > 2)
            if (words.length > 1) {
              let fallback = baseQuery()
              if (args.min_price) fallback = fallback.gte('price', args.min_price)
              if (args.max_price) fallback = fallback.lte('price', args.max_price)
              // Match ALL words in title or description (AND logic)
              for (const word of words.slice(0, 5)) {
                fallback = fallback.or(`title.ilike.%${word}%,description.ilike.%${word}%`)
              }
              const { data: fallbackProducts } = await fallback.limit(10)
              products = fallbackProducts
              if (products?.length) console.log(`[ai-agent] search_products fallback found ${products.length} results with words: ${words.join(', ')}`)
            }
          }

          if (!products || products.length === 0) return 'Nenhum produto encontrado com esses critérios.'

          // Auto-send carousel when products have images
          const withImages = products.filter((p: any) => p.images?.[0])
          if (withImages.length > 0) {
            let carousel: any[]

            if (withImages.length === 1 && withImages[0].images?.length > 1) {
              // Single product with multiple photos → multi-photo carousel with AI sales copy
              const p = withImages[0]
              const photos = (p.images as string[]).slice(0, 5)
              const copies = await generateCarouselCopies(p, photos.length)
              carousel = photos.map((img: string, idx: number) => ({
                text: copies[idx] || `${p.title}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}`,
                image: img,
                buttons: [{ id: `${p.title}_${idx}`, text: idx === photos.length - 1 ? 'Quero este!' : 'Ver mais', type: 'REPLY' }],
              }))
              console.log(`[ai-agent] Auto-carousel: ${p.title} with ${photos.length} photos (AI copy)`)
            } else {
              // Multiple products → 1 card per product
              carousel = withImages.slice(0, 10).map((p: any) => ({
                text: `${p.title}\n${p.description?.substring(0, 80) || ''}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`,
                image: p.images[0],
                buttons: [{ id: p.title, text: 'Quero este!', type: 'REPLY' }],
              }))
            }

            // Send carousel with retry strategy (UAZAPI is finicky with field names)
            const carouselPayloads = [
              { phone: contact.jid, message: 'Confira:', carousel },
              { number: contact.jid, text: 'Confira:', carousel },
              { chatId: contact.jid, message: 'Confira:', carousel },
            ]
            let carouselSent = false
            for (const payload of carouselPayloads) {
              try {
                const res = await fetchWithTimeout(`${uazapiUrl}/send/carousel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'token': instance.token },
                  body: JSON.stringify(payload),
                })
                const resBody = await res.text()
                if (res.ok && !resBody.includes('missing required')) {
                  carouselSent = true
                  console.log(`[ai-agent] Auto-carousel sent: ${withImages.length} product(s), variant: ${Object.keys(payload)[0]}`)
                  break
                }
                console.warn(`[ai-agent] Carousel variant ${Object.keys(payload)[0]} failed:`, res.status, resBody.substring(0, 100))
              } catch (err) {
                console.error('[ai-agent] Carousel attempt failed:', err)
              }
            }
            if (!carouselSent) {
              console.error('[ai-agent] All carousel variants failed')
            } else {
              // Save carousel to conversation_messages so it appears in helpdesk
              await supabase.from('conversation_messages').insert({
                conversation_id, direction: 'outgoing',
                content: 'Confira:',
                media_type: 'carousel',
                media_url: JSON.stringify({ message: 'Confira:', cards: carousel }),
                external_id: `ai_carousel_${Date.now()}`,
              })
            }
          }

          const resultText = products.map((p: any, i: number) =>
            `${i + 1}. ${p.title} - R$${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (SEM ESTOQUE)' : ''}`
          ).join('\n')

          if (withImages.length > 0) {
            return `Produtos encontrados e carrossel com fotos JÁ FOI ENVIADO ao lead.\nNÃO repita nomes de produtos, preços ou descrições no texto.\nNÃO use send_carousel nem send_media (já enviado).\nApenas responda com uma PERGUNTA CURTA como: "É esse que você procura?" ou "Algum desses te interessa?"`
          }
          return resultText
        }

        case 'send_carousel': {
          const titles: string[] = args.product_ids || []
          if (titles.length === 0) return 'Nenhum produto especificado.'
          if (titles.length > 10) return 'Máximo de 10 produtos por carrossel.'

          const { data: products } = await supabase
            .from('ai_agent_products')
            .select('title, description, price, images, in_stock')
            .eq('agent_id', agent_id)
            .eq('enabled', true)
            .in('title', titles)

          if (!products || products.length === 0) return 'Nenhum produto encontrado.'

          const withImages = products.filter((p: any) => p.images?.[0])
          if (withImages.length === 0) return 'Nenhum produto com imagem. Descreva por texto.'

          let carousel: any[]

          // Single product with multiple photos → multi-photo carousel with AI sales copy
          if (withImages.length === 1 && withImages[0].images?.length > 1) {
            const p = withImages[0]
            const photos = (p.images as string[]).slice(0, 5) // Max 5 photos
            const copies = await generateCarouselCopies(p, photos.length)
            carousel = photos.map((img: string, idx: number) => ({
              text: copies[idx] || `${p.title}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}`,
              image: img,
              buttons: [{ id: `${p.title}_${idx}`, text: idx === photos.length - 1 ? 'Quero este!' : 'Ver mais', type: 'REPLY' }],
            }))
            console.log(`[ai-agent] Multi-photo carousel: ${p.title} with ${photos.length} photos (AI copy)`)
          } else {
            // Multiple products → 1 card per product
            carousel = withImages.slice(0, 10).map((p: any) => ({
              text: `${p.title}\n${p.description?.substring(0, 80) || ''}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`,
              image: p.images[0],
              buttons: [{ id: p.title, text: 'Quero este!', type: 'REPLY' }],
            }))
          }

          // Retry strategy for carousel (UAZAPI field names vary)
          const msg = args.message || 'Confira nossas opções:'
          const variants = [
            { phone: contact.jid, message: msg, carousel },
            { number: contact.jid, text: msg, carousel },
            { chatId: contact.jid, message: msg, carousel },
          ]
          let sent = false
          for (const payload of variants) {
            const res = await fetchWithTimeout(`${uazapiUrl}/send/carousel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instance.token },
              body: JSON.stringify(payload),
            })
            const body = await res.text()
            if (res.ok && !body.includes('missing required')) { sent = true; break }
          }
          if (!sent) return 'Erro ao enviar carrossel. Descreva os produtos por texto.'

          // Save carousel to helpdesk
          await supabase.from('conversation_messages').insert({
            conversation_id, direction: 'outgoing', content: msg,
            media_type: 'carousel', media_url: JSON.stringify({ message: msg, cards: carousel }),
            external_id: `ai_carousel_${Date.now()}`,
          })

          const photoCount = withImages.length === 1 ? `${(withImages[0].images as string[]).slice(0, 5).length} fotos` : `${withImages.length} produto(s)`
          return `Carrossel enviado com ${photoCount} ao lead! NÃO repita os nomes dos produtos no texto — apenas pergunte se é isso que procura.`
        }

        case 'send_media': {
          const { media_url, media_type, caption } = args
          if (!media_url) return 'URL da mídia não informada.'

          const type = ['image', 'video', 'document'].includes(media_type) ? media_type : 'image'

          const sendRes = await fetchWithTimeout(`${uazapiUrl}/send/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instance.token },
            body: JSON.stringify({ number: contact.jid, type, file: media_url, text: caption || '', delay: 2000 }),
          })

          if (!sendRes.ok) return `Erro ao enviar mídia (${sendRes.status}). Descreva por texto.`

          // Save media to helpdesk
          await supabase.from('conversation_messages').insert({
            conversation_id, direction: 'outgoing', content: caption || '',
            media_type: type, media_url,
            external_id: `ai_media_${Date.now()}`,
          })

          return `Mídia enviada com legenda ao lead! NÃO repita a mesma informação no texto — apenas faça a próxima pergunta (ex: "É esse que você procura?").`
        }

        case 'assign_label': {
          const { label_name } = args
          if (!label_name) return 'Nome da etiqueta não informado.'

          const { data: label } = await supabase
            .from('labels')
            .select('id, name')
            .eq('inbox_id', conversation.inbox_id)
            .ilike('name', label_name)
            .maybeSingle()

          if (!label) return `Etiqueta "${label_name}" não encontrada. Disponíveis: ${availableLabelNames.join(', ')}`

          // Pipeline: replace existing labels (one stage at a time)
          await supabase.from('conversation_labels').delete().eq('conversation_id', conversation_id)
          const { error } = await supabase.from('conversation_labels').insert({ conversation_id, label_id: label.id })

          if (error) return `Erro ao atribuir etiqueta: ${error.message}`

          await supabase.from('ai_agent_logs').insert({
            agent_id, conversation_id, event: 'label_assigned',
            metadata: { label_name: label.name, label_id: label.id },
          })

          return `Etiqueta "${label.name}" atribuída.`
        }

        case 'set_tags': {
          const newTags: string[] = args.tags || []
          if (newTags.length === 0) return 'Nenhuma tag informada.'

          const existing: string[] = conversation.tags || []
          const tagMap = new Map<string, string>()
          for (const t of existing) tagMap.set(t.split(':')[0], t)
          for (const t of newTags) tagMap.set(t.split(':')[0], t)
          const merged = Array.from(tagMap.values())

          const { error } = await supabase
            .from('conversations')
            .update({ tags: merged })
            .eq('id', conversation_id)

          if (error) return `Erro ao definir tags: ${error.message}`

          // Update local reference for subsequent tool calls
          conversation.tags = merged
          return `Tags atualizadas: ${merged.join(', ')}`
        }

        case 'move_kanban': {
          const { column_name } = args
          if (!column_name) return 'Nome da coluna não informado.'

          const { data: board } = await supabase
            .from('kanban_boards')
            .select('id')
            .eq('instance_id', instance_id)
            .maybeSingle()

          if (!board) return 'Nenhum quadro Kanban vinculado a esta instância.'

          const { data: targetCol } = await supabase
            .from('kanban_columns')
            .select('id, name')
            .eq('board_id', board.id)
            .ilike('name', column_name)
            .maybeSingle()

          if (!targetCol) return `Coluna "${column_name}" não encontrada no Kanban.`

          // Find card by contact_id (direct FK, reliable)
          let { data: card } = await supabase
            .from('kanban_cards')
            .select('id, title, column_id')
            .eq('board_id', board.id)
            .eq('contact_id', contact.id)
            .maybeSingle()

          // Auto-create card if not found
          if (!card) {
            const { data: newCard } = await supabase
              .from('kanban_cards')
              .insert({
                board_id: board.id,
                column_id: targetCol.id,
                contact_id: contact.id,
                title: contact.name || contact.phone,
                created_by: agent_id,
                tags: ['lead', 'auto-criado'],
              })
              .select('id, title, column_id')
              .single()

            if (!newCard) return 'Erro ao criar card no Kanban.'

            await supabase.from('ai_agent_logs').insert({
              agent_id, conversation_id, event: 'kanban_created',
              metadata: { card_id: newCard.id, column_name: targetCol.name, contact_id: contact.id },
            })

            return `Card "${newCard.title}" criado na coluna "${targetCol.name}".`
          }

          if (card.column_id === targetCol.id) return `Card já está na coluna "${targetCol.name}".`

          await supabase.from('kanban_cards').update({ column_id: targetCol.id }).eq('id', card.id)

          await supabase.from('ai_agent_logs').insert({
            agent_id, conversation_id, event: 'kanban_moved',
            metadata: { card_id: card.id, column_name: targetCol.name, contact_id: contact.id },
          })

          return `Card "${card.title}" movido para "${targetCol.name}".`
        }

        case 'update_lead_profile': {
          const updates: Record<string, any> = { last_contact_at: new Date().toISOString() }
          if (args.full_name) {
            // Fix duplicated names (e.g. "PedroPedro" → "Pedro")
            let cleanName = args.full_name.trim()
            if (cleanName.length >= 4) {
              const half = cleanName.length / 2
              if (cleanName.length % 2 === 0 && cleanName.substring(0, half) === cleanName.substring(half)) {
                cleanName = cleanName.substring(0, half)
              }
            }
            updates.full_name = cleanName
          }
          if (args.city) updates.city = args.city
          if (args.interests?.length) updates.interests = args.interests
          if (args.notes) updates.notes = args.notes
          if (args.reason) updates.reason = args.reason
          if (args.average_ticket) updates.average_ticket = args.average_ticket

          const { error } = await supabase
            .from('lead_profiles')
            .upsert({ contact_id: contact.id, ...updates }, { onConflict: 'contact_id' })

          // Note: contacts.name preserves WhatsApp pushname, full_name goes only in lead_profiles

          if (error) return `Erro ao atualizar perfil: ${error.message}`

          const saved = Object.entries(updates).filter(([k]) => k !== 'last_contact_at')
            .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join(', ')
          return `Perfil atualizado: ${saved}`
        }

        case 'handoff_to_human': {
          const cooldown = agent.handoff_cooldown_minutes || 30
          const newStatus = 'shadow' // AI keeps listening (tags, labels, context) but doesn't respond

          // Send handoff message directly (don't rely on Gemini generating it)
          const handoffMsg = agent.handoff_message || 'Só um instante que vou te encaminhar para nosso consultor de vendas.'
          await sendTextMsg(handoffMsg)
          await supabase.from('conversation_messages').insert({
            conversation_id, direction: 'outgoing', content: handoffMsg, media_type: 'text',
          })

          // Set IA to shadow mode + tag
          await supabase.from('conversations').update({
            status_ia: newStatus,
            tags: mergeTags(conversation.tags || [], { ia: 'shadow' }),
          }).eq('id', conversation_id)

          // Auto-assign "Atendimento Humano" label if available
          const handoffLabel = (availableLabels || []).find((l: any) =>
            l.name.toLowerCase().includes('atendimento') || l.name.toLowerCase().includes('humano')
          )
          if (handoffLabel) {
            await supabase.from('conversation_labels').delete().eq('conversation_id', conversation_id)
            await supabase.from('conversation_labels').insert({ conversation_id, label_id: handoffLabel.id })
          }

          // Log + broadcast
          await supabase.from('ai_agent_logs').insert({
            agent_id, conversation_id, event: 'handoff',
            metadata: { reason: args.reason, cooldown_minutes: cooldown, new_status: newStatus },
          })
          broadcastEvent({ conversation_id, status_ia: newStatus })

          return `Conversa transferida para atendente humano. Motivo: ${args.reason}. IA em modo shadow (observando).`
        }

        default:
          return `Tool ${name} não implementada.`
      }
    }

    // 15. Call Gemini API with function calling loop
    const geminiModel = agent.model || 'gemini-2.5-flash'
    const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
    const geminiUrl = `${GEMINI_BASE}/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`

    console.log(`[ai-agent] Calling Gemini ${geminiModel} for conversation ${conversation_id}`)

    let currentContents = [...geminiContents]
    let responseText = ''
    let inputTokens = 0
    let outputTokens = 0
    const toolCallsLog: any[] = []
    let attempts = 0
    const maxAttempts = 5 // 8 tools may need more rounds

    while (attempts < maxAttempts) {
      attempts++
      if (attempts > 1) sendPresence('composing') // Refresh typing indicator between tool rounds

      const geminiResponse = await fetchWithTimeout(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: currentContents,
          tools,
          generationConfig: {
            temperature: agent.temperature || 0.7,
            maxOutputTokens: agent.max_tokens || 1024,
          },
        }),
      })

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text()
        console.error('[ai-agent] Gemini error:', geminiResponse.status, errText.substring(0, 300))
        // Retry once on transient failures (429, 500, 503)
        if (attempts === 1 && [429, 500, 503].includes(geminiResponse.status)) {
          console.log('[ai-agent] Retrying Gemini after transient error...')
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        await supabase.from('ai_agent_logs').insert({
          agent_id, conversation_id, event: 'error', model: geminiModel,
          error: `Gemini ${geminiResponse.status}: ${errText.substring(0, 200)}`,
          latency_ms: Date.now() - startTime,
        })
        return new Response(JSON.stringify({ error: 'Gemini API error' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const geminiData = await geminiResponse.json()
      inputTokens += geminiData?.usageMetadata?.promptTokenCount || 0
      outputTokens += geminiData?.usageMetadata?.candidatesTokenCount || 0

      const parts = geminiData?.candidates?.[0]?.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length > 0) {
        const toolResults: any[] = []
        for (const fc of functionCalls) {
          const { name, args: toolArgs } = fc.functionCall
          console.log(`[ai-agent] Tool: ${name}(${JSON.stringify(toolArgs).substring(0, 100)})`)
          const result = await executeTool(name, toolArgs || {})
          toolCallsLog.push({ name, args: toolArgs, result: result.substring(0, 200) })
          toolResults.push({ functionResponse: { name, response: { result } } })
        }

        // If handoff was called, STOP — don't let Gemini generate more text (prevents duplicate messages)
        if (toolCallsLog.some(t => t.name === 'handoff_to_human')) {
          console.log('[ai-agent] handoff_to_human called — stopping loop, no further text needed')
          break
        }

        currentContents.push({ role: 'model', parts })
        currentContents.push({ role: 'user', parts: toolResults })
        continue
      }

      responseText = parts.find((p: any) => p.text)?.text || ''

      // Fix doubled names in response (e.g., "GeorgeGeorge" → "George")
      responseText = responseText.replace(/\b([A-ZÀ-Ú][a-zà-ú]{2,})\1\b/g, '$1')

      break
    }

    // If handoff was called, skip text response entirely (handoff tool already sent its message)
    const hadExplicitHandoffInLoop = toolCallsLog.some(t => t.name === 'handoff_to_human')
    if (hadExplicitHandoffInLoop && !responseText.trim()) {
      console.log('[ai-agent] Handoff completed — skipping text response')
      // Still need to update conversation and log, so set a minimal marker
      responseText = ''
    } else if (!responseText.trim()) {
      console.warn('[ai-agent] Empty Gemini response — using fallback message')
      responseText = 'Desculpe, não consegui processar sua mensagem. Pode repetir?'
      await supabase.from('ai_agent_logs').insert({
        agent_id, conversation_id, event: 'empty_response', model: geminiModel,
        latency_ms: Date.now() - startTime,
      })
    }

    console.log(`[ai-agent] Response (${outputTokens} tok): ${responseText.substring(0, 100)}...`)

    // 15.5 Detect handoff BEFORE sending — explicit tool call OR implicit (text mentions transfer)
    const toolNames = toolCallsLog.map((t: any) => t.name)
    const hadExplicitHandoff = toolNames.includes('handoff_to_human')
    const textLooksLikeHandoff = !hadExplicitHandoff && responseText.trim() !== '' &&
      HANDOFF_PHRASES.some(p => responseText.toLowerCase().includes(p))
    const shouldDisableIa = hadExplicitHandoff || textLooksLikeHandoff

    // If implicit handoff detected, switch to shadow BEFORE sending (so helpdesk sees correct status)
    if (textLooksLikeHandoff) {
      console.log('[ai-agent] Implicit handoff detected — switching to shadow before sending text')
      await supabase.from('conversations').update({
        status_ia: 'shadow',
        tags: mergeTags(conversation.tags || [], { ia: 'shadow' }),
      }).eq('id', conversation_id)
      await supabase.from('ai_agent_logs').insert({
        agent_id, conversation_id, event: 'implicit_handoff',
        metadata: { response_text: responseText.substring(0, 300) },
      })
    }

    // 16. Send response via UAZAPI (TTS audio or text) — SKIP if handoff already handled it
    const skipTextSend = hadExplicitHandoffInLoop && !responseText.trim()
    let sentMediaType = 'text'
    const maxTtsLength = agent.voice_max_text_length || 150
    // Send audio if: (1) voice globally enabled, OR (2) lead sent audio and voice_reply_to_audio is on
    const voiceReplyToAudio = agent.voice_reply_to_audio !== false // default true
    const shouldSendAudio = (agent.voice_enabled || (incomingHasAudio && voiceReplyToAudio)) &&
      responseText.length <= maxTtsLength

    console.log(`[ai-agent] TTS check: voice_enabled=${agent.voice_enabled}, incomingHasAudio=${incomingHasAudio}, voiceReplyToAudio=${voiceReplyToAudio}, responseLen=${responseText.length}, maxTts=${maxTtsLength}, shouldSendAudio=${shouldSendAudio}`)
    let ttsDebugError = ''

    if (skipTextSend) {
      console.log('[ai-agent] Skipping text send — handoff tool already sent message')
    } else if (shouldSendAudio) {
      // Switch to "recording..." indicator before TTS
      sendPresence('recording')
      try {
        console.log('[ai-agent] Generating TTS audio via gemini-2.5-flash-preview-tts...')
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`
        const ttsRes = await fetchWithTimeout(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Leia o seguinte texto em português brasileiro com tom natural e amigável: "${responseText}"` }] }],
            generationConfig: {
              response_modalities: ['AUDIO'],
              speech_config: { voice_config: { prebuilt_voice_config: { voice_name: agent.voice_name || 'Kore' } } },
            },
          }),
        })

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json()
          const audioPart = ttsData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
          if (audioPart?.inlineData?.data) {
            // Convert PCM to WAV (Gemini TTS returns raw PCM 24kHz 16-bit mono)
            const pcmBytes = Uint8Array.from(atob(audioPart.inlineData.data), c => c.charCodeAt(0))
            const wavHeader = new ArrayBuffer(44)
            const view = new DataView(wavHeader)
            const sampleRate = 24000, channels = 1, bitsPerSample = 16
            const byteRate = sampleRate * channels * (bitsPerSample / 8)
            const blockAlign = channels * (bitsPerSample / 8)
            // RIFF header
            view.setUint32(0, 0x52494646, false) // "RIFF"
            view.setUint32(4, 36 + pcmBytes.length, true)
            view.setUint32(8, 0x57415645, false) // "WAVE"
            // fmt chunk
            view.setUint32(12, 0x666D7420, false) // "fmt "
            view.setUint32(16, 16, true)
            view.setUint16(20, 1, true) // PCM
            view.setUint16(22, channels, true)
            view.setUint32(24, sampleRate, true)
            view.setUint32(28, byteRate, true)
            view.setUint16(32, blockAlign, true)
            view.setUint16(34, bitsPerSample, true)
            // data chunk
            view.setUint32(36, 0x64617461, false) // "data"
            view.setUint32(40, pcmBytes.length, true)
            // Combine header + PCM data
            const wavBytes = new Uint8Array(44 + pcmBytes.length)
            wavBytes.set(new Uint8Array(wavHeader), 0)
            wavBytes.set(pcmBytes, 44)
            // Base64 encode WAV (chunked to avoid stack overflow)
            let wavBinary = ''
            for (let i = 0; i < wavBytes.length; i += 8192) {
              wavBinary += String.fromCharCode(...wavBytes.subarray(i, Math.min(i + 8192, wavBytes.length)))
            }
            const wavBase64 = btoa(wavBinary)
            // Send as PTT via UAZAPI
            await fetchWithTimeout(`${uazapiUrl}/send/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instance.token },
              body: JSON.stringify({ number: contact.jid, type: 'ptt', file: wavBase64, delay: 2000 }),
            })
            sentMediaType = 'audio'
            console.log(`[ai-agent] TTS audio sent (${responseText.length} chars, WAV ${wavBytes.length} bytes)`)
          } else {
            ttsDebugError = 'no_audio_data_in_response'
            console.warn('[ai-agent] TTS response has no audio data, fallback to text')
            await sendTextMsg(responseText)
          }
        } else {
          const ttsErrBody = await ttsRes.text().catch(() => '')
          ttsDebugError = `http_${ttsRes.status}: ${ttsErrBody.substring(0, 300)}`
          console.error('[ai-agent] TTS failed:', ttsRes.status, ttsErrBody.substring(0, 200))
          await sendTextMsg(responseText)
        }
      } catch (ttsErr: any) {
        ttsDebugError = `exception: ${ttsErr?.message || String(ttsErr)}`
        console.error('[ai-agent] TTS error:', ttsErr)
        await sendTextMsg(responseText)
      }
    } else {
      await sendTextMsg(responseText)
    }

    // 17. Save outgoing message to DB (skip if handoff already saved its message)
    let savedMsg: any = null
    if (!skipTextSend && responseText.trim()) {
      const { data } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id, direction: 'outgoing',
          content: responseText, media_type: sentMediaType,
          external_id: `ai_agent_${Date.now()}`,
        })
        .select('id, created_at')
        .single()
      savedMsg = data
    }

    // 18. Update conversation (DON'T reset status_ia if handoff happened — already set above)
    const newStatusIa = shouldDisableIa ? 'shadow' : 'ligada'
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), last_message: responseText.substring(0, 200), status_ia: newStatusIa })
      .eq('id', conversation_id)

    // 19. Broadcast to helpdesk realtime
    const broadcastPayload = {
      conversation_id, inbox_id: conversation.inbox_id,
      message_id: savedMsg?.id, direction: 'outgoing',
      content: responseText, media_type: sentMediaType,
      created_at: savedMsg?.created_at || new Date().toISOString(),
      status_ia: newStatusIa,
    }

    broadcastEvent(broadcastPayload)

    // 20. Log interaction
    await supabase.from('ai_agent_logs').insert({
      agent_id, conversation_id,
      event: 'response_sent',
      input_tokens: inputTokens, output_tokens: outputTokens,
      model: geminiModel, latency_ms: Date.now() - startTime,
      sub_agent: activeSubAgents.length > 0 ? 'multi' : 'orchestrator',
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

    // 21. Update lead_profile: interaction count + conversation summary (ALWAYS)
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
      if (!leadProfile) profileUpdate.full_name = contact.name || null

      await supabase.from('lead_profiles').upsert(profileUpdate, { onConflict: 'contact_id' })

      console.log(`[ai-agent] Profile updated. Summaries: ${updatedSummaries.length}, interactions: ${newCount}`)
    } catch (sumErr) {
      console.error('[ai-agent] Profile update error:', sumErr)
    }

    console.log(`[ai-agent] Done. ${Date.now() - startTime}ms, ${inputTokens}+${outputTokens} tok, ${toolCallsLog.length} tools`)

    return new Response(JSON.stringify({
      ok: true, conversation_id,
      response: responseText.substring(0, 200),
      tokens: { input: inputTokens, output: outputTokens },
      latency_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : ''
    console.error('[ai-agent] FATAL:', errMsg, errStack)

    // Log error to database for debugging
    try {
      await supabase.from('ai_agent_logs').insert({
        agent_id: null, conversation_id: null,
        event: 'error', error: errMsg,
        metadata: { stack: errStack?.substring(0, 500), timestamp: new Date().toISOString() },
      })
    } catch (_) {}

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
