import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

/**
 * AI Agent Playground (v2 — Sprint 3)
 *
 * All 8 tools simulated (no WhatsApp, no DB writes, no realtime).
 * Requires super_admin authentication.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await verifySuperAdmin(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  const startTime = Date.now()

  try {
    const body = await req.json()
    const { agent_id, messages: chatMessages } = body

    if (!agent_id) {
      return new Response(JSON.stringify({ ok: false, error: 'agent_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: agent } = await supabase.from('ai_agents').select('*').eq('id', agent_id).single()

    if (!agent) {
      return new Response(JSON.stringify({ ok: false, error: 'Agent not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const hasAssistantMsg = (chatMessages || []).some((m: any) => m.direction === 'outgoing')
    const greetingInstruction = !hasAssistantMsg && agent.greeting_message
      ? `\n\nIMPORTANTE: Esta é a PRIMEIRA interação com este lead. Você DEVE começar sua resposta com EXATAMENTE esta saudação: "${agent.greeting_message}" e depois continue respondendo à mensagem do lead.`
      : ''

    const extractionFields = (agent.extraction_fields || []).filter((f: any) => f.enabled)
    const extractionInstruction = extractionFields.length > 0
      ? `\nCampos para extrair (use set_tags + update_lead_profile):\n${extractionFields.map((f: any) => `- ${f.label} (chave: ${f.key})`).join('\n')}`
      : ''

    const systemPrompt = `Você é ${agent.name}, um assistente virtual de WhatsApp.

Personalidade: ${agent.personality || 'Profissional, simpático e objetivo'}

${agent.system_prompt || 'Responda de forma clara, objetiva e simpática. Use emojis com moderação.'}
${greetingInstruction}

REGRA CRÍTICA: Faça APENAS UMA pergunta por mensagem. Nunca envie duas perguntas na mesma resposta.

Regras:
- Responda SEMPRE em português do Brasil
- Seja conciso (máximo 3-4 frases por resposta)
- Use emojis com moderação (1-2 por mensagem)
- Nunca invente informações sobre produtos, preços ou disponibilidade
${agent.blocked_topics?.length ? `\nTópicos PROIBIDOS: ${agent.blocked_topics.join(', ')}` : ''}
${agent.blocked_phrases?.length ? `\nFrases PROIBIDAS: ${agent.blocked_phrases.join(', ')}` : ''}

Fluxo de Qualificação:
1. SAUDAÇÃO: Cumprimente + identifique motivo (set_tags motivo:X)
2. QUALIFICAR (1 pergunta por vez): produto, nome, cidade, necessidade → set_tags + update_lead_profile
3. BUSCAR: search_products com critérios
4. APRESENTAR: send_carousel (2+) ou send_media (1)
5. HANDOFF: Quando lead demonstrar interesse ou pedir vendedor → assign_label + set_tags + update_lead_profile + handoff_to_human

Máximo 4-5 perguntas. Se já tem produto + nome, faça handoff.

Labels: Use assign_label para etapas do pipeline
Tags: Use set_tags formato "chave:valor" (motivo, interesse, nome, cidade)
${extractionInstruction}

Regras de envio:
- send_carousel: 2+ produtos COM imagem
- send_media: 1 imagem/documento
- Sempre responda com texto APÓS usar send_carousel/send_media`

    const geminiContents: any[] = (chatMessages || [])
      .filter((m: any) => m.content?.trim())
      .map((m: any) => ({
        role: m.direction === 'incoming' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))

    if (geminiContents.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No messages to process' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 8 tools — all simulated in playground
    const tools = [{
      function_declarations: [
        { name: 'search_products', description: 'Busca produtos no catálogo. SEMPRE use antes de send_carousel/send_media.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, category: { type: 'STRING' }, subcategory: { type: 'STRING' }, min_price: { type: 'NUMBER' }, max_price: { type: 'NUMBER' } } } },
        { name: 'send_carousel', description: 'Envia carrossel de produtos (2+ com imagem).', parameters: { type: 'OBJECT', properties: { product_ids: { type: 'ARRAY', items: { type: 'STRING' } }, message: { type: 'STRING' } }, required: ['product_ids'] } },
        { name: 'send_media', description: 'Envia imagem ou documento.', parameters: { type: 'OBJECT', properties: { media_url: { type: 'STRING' }, media_type: { type: 'STRING' }, caption: { type: 'STRING' } }, required: ['media_url', 'media_type'] } },
        { name: 'assign_label', description: 'Atribui etiqueta (pipeline) à conversa.', parameters: { type: 'OBJECT', properties: { label_name: { type: 'STRING' } }, required: ['label_name'] } },
        { name: 'set_tags', description: 'Adiciona tags "chave:valor" à conversa.', parameters: { type: 'OBJECT', properties: { tags: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['tags'] } },
        { name: 'move_kanban', description: 'Move card CRM para outra coluna.', parameters: { type: 'OBJECT', properties: { column_name: { type: 'STRING' } }, required: ['column_name'] } },
        { name: 'update_lead_profile', description: 'Atualiza perfil do lead.', parameters: { type: 'OBJECT', properties: { full_name: { type: 'STRING' }, city: { type: 'STRING' }, interests: { type: 'ARRAY', items: { type: 'STRING' } }, notes: { type: 'STRING' }, reason: { type: 'STRING', description: 'Motivo do contato' }, average_ticket: { type: 'NUMBER', description: 'Ticket médio em reais' } } } },
        { name: 'handoff_to_human', description: 'Transfere para atendente humano.', parameters: { type: 'OBJECT', properties: { reason: { type: 'STRING' } }, required: ['reason'] } },
      ],
    }]

    async function executeTool(name: string, args: Record<string, any>): Promise<string> {
      if (name === 'search_products') {
        let query = supabase.from('ai_agent_products').select('title, category, description, price, images, in_stock').eq('agent_id', agent_id).eq('enabled', true)
        if (args.category) query = query.ilike('category', `%${args.category}%`)
        if (args.query) query = query.or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%,category.ilike.%${args.query}%`)
        if (args.min_price) query = query.gte('price', args.min_price)
        if (args.max_price) query = query.lte('price', args.max_price)
        const { data: products } = await query.limit(10)
        if (!products?.length) return 'Nenhum produto encontrado.'
        return products.map((p, i) => `${i + 1}. ${p.title} - R$${p.price?.toFixed(2) || '?'}${!p.in_stock ? ' (SEM ESTOQUE)' : ''}${p.images?.[0] ? ' [img]' : ''}`).join('\n')
      }
      if (name === 'send_carousel') {
        const titles: string[] = args.product_ids || []
        const { data: products } = await supabase.from('ai_agent_products').select('title, price, images').eq('agent_id', agent_id).eq('enabled', true).in('title', titles)
        const found = products?.filter((p: any) => p.images?.[0]) || []
        return found.length ? `[PLAYGROUND] Carrossel: ${found.map((p: any) => `${p.title} (R$${p.price?.toFixed(2)})`).join(', ')}` : 'Nenhum produto com imagem.'
      }
      if (name === 'send_media') return `[PLAYGROUND] Mídia: ${args.media_type}, "${args.caption || ''}"`
      if (name === 'assign_label') return `[PLAYGROUND] Label "${args.label_name}" atribuída`
      if (name === 'set_tags') return `[PLAYGROUND] Tags: ${(args.tags || []).join(', ')}`
      if (name === 'move_kanban') return `[PLAYGROUND] Card movido para "${args.column_name}"`
      if (name === 'update_lead_profile') {
        const parts = []
        if (args.full_name) parts.push(`nome=${args.full_name}`)
        if (args.city) parts.push(`cidade=${args.city}`)
        if (args.interests) parts.push(`interesses=${args.interests.join(',')}`)
        if (args.reason) parts.push(`motivo=${args.reason}`)
        if (args.average_ticket) parts.push(`ticket=R$${args.average_ticket}`)
        return `[PLAYGROUND] Lead: ${parts.join(', ')}`
      }
      if (name === 'handoff_to_human') return `[PLAYGROUND] Handoff: ${args.reason}`
      return `Tool ${name} não disponível.`
    }

    const geminiModel = agent.model || 'gemini-2.5-flash'
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`

    let currentContents = [...geminiContents]
    let responseText = ''
    let inputTokens = 0
    let outputTokens = 0
    const toolCallsLog: any[] = []
    let attempts = 0

    while (attempts < 5) {
      attempts++
      const geminiResponse = await fetchWithTimeout(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: currentContents,
          tools,
          generationConfig: { temperature: agent.temperature || 0.7, maxOutputTokens: agent.max_tokens || 1024 },
        }),
      })

      if (!geminiResponse.ok) {
        return new Response(JSON.stringify({ ok: false, error: `Gemini error (${geminiResponse.status})` }), {
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
          const result = await executeTool(name, toolArgs || {})
          toolCallsLog.push({ name, args: toolArgs })
          toolResults.push({ functionResponse: { name, response: { result } } })
        }
        currentContents.push({ role: 'model', parts })
        currentContents.push({ role: 'user', parts: toolResults })
        continue
      }

      responseText = parts.find((p: any) => p.text)?.text || ''
      break
    }

    if (!responseText.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'Resposta vazia' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      ok: true, response: responseText,
      tokens: { input: inputTokens, output: outputTokens },
      latency_ms: Date.now() - startTime,
      tool_calls: toolCallsLog.length > 0 ? toolCallsLog : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[playground] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
