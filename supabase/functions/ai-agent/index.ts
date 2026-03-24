import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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

    // Check handoff cooldown (IA fully disabled)
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

    // 5. Combine queued messages
    const incomingText = (queuedMessages || [])
      .filter((m: any) => m.direction === 'incoming' || !m.direction)
      .map((m: any) => m.content || '')
      .filter(Boolean)
      .join('\n')

    if (!incomingText.trim()) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`

      const shadowRes = await fetchWithTimeout(geminiUrl, {
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

    // 9. Greeting check
    // Agent has replied = outgoing messages exist in recent history
    // Context cleared = lead_profile exists with empty summaries+interests+notes (set by "Limpar contexto")
    // OR lead_profile doesn't exist at all (never created)
    const agentHasReplied = contextMessages.some((m: any) => m.direction === 'outgoing')
    const contextWasCleared = leadProfile
      ? (!leadProfile.conversation_summaries?.length && !leadProfile.interests?.length && !leadProfile.notes)
      : false // No profile = no clear action was taken
    const shouldGreet = (!agentHasReplied || contextWasCleared) && agent.greeting_message

    // If context was cleared but old messages exist, clear them so model treats as first interaction
    if (shouldGreet && agentHasReplied) {
      contextMessages.length = 0
      console.log('[ai-agent] Greeting mode — cleared old messages from history')
    }

    const greetingInstruction = shouldGreet
      ? `\n\nIMPORTANTE: Esta é a PRIMEIRA interação. Responda APENAS com esta saudação EXATA, sem adicionar NADA mais: "${agent.greeting_message}"`
      : ''

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
${greetingInstruction}
${leadContext}
${campaignContext}

REGRA CRÍTICA: Faça APENAS UMA pergunta por mensagem. Nunca envie duas perguntas na mesma resposta.

Regras gerais:
- Responda SEMPRE em português do Brasil
- Seja conciso (máximo 3-4 frases por resposta)
- Use emojis com moderação (1-2 por mensagem)
- Nunca invente informações sobre produtos, preços ou disponibilidade
${agent.blocked_topics?.length ? `\nTópicos PROIBIDOS (não fale sobre): ${agent.blocked_topics.join(', ')}` : ''}
${agent.blocked_phrases?.length ? `\nFrases PROIBIDAS (nunca use): ${agent.blocked_phrases.join(', ')}` : ''}

Fluxo de Qualificação do Lead:
1. SAUDAÇÃO: Na primeira mensagem, cumprimente e pergunte o nome
2. QUALIFICAR (UMA pergunta por vez):
   - Colete nome do lead → update_lead_profile(full_name) — salve APENAS o nome informado, nunca duplique (ex: se disse "Pedro", salve "Pedro", NÃO "PedroPedro")
   - Identifique o motivo REAL do contato → set_tags motivo:X (valores: compra, troca, orcamento, duvida, suporte, financeiro, emprego, fornecedor, informacao)
   - Identifique o produto/serviço de interesse → set_tags interesse:X
   - Colete cidade/bairro se relevante → update_lead_profile(city)
   - Se mencionar valor → update_lead_profile(average_ticket, reason)
3. BUSCAR: Quando souber o suficiente, use search_products para encontrar opções
4. APRESENTAR: Se encontrar 2+ produtos com imagem, use send_carousel. Se for 1, use send_media
5. TRANSBORDO OBRIGATÓRIO — faça handoff_to_human IMEDIATAMENTE quando:
   a) search_products NÃO encontrou o produto E o lead perguntou preço/valor → Responda: "Só um instante que vou te encaminhar para nosso consultor de vendas." e faça handoff
   b) Lead pedir para falar com vendedor/atendente
   c) Lead demonstrar interesse em comprar ("quero esse", "quanto custa", "me passa o preço")
   d) Lead já tiver sido qualificado (produto + nome coletados)
   → SEMPRE nesta ordem: set_tags → update_lead_profile → assign_label → handoff_to_human

REGRA DE TRANSBORDO POR PRODUTO NÃO ENCONTRADO:
- Se search_products retornar 0 resultados e o lead perguntar preço/disponibilidade:
  1. Responda EXATAMENTE: "Só um instante que vou te encaminhar para nosso consultor de vendas."
  2. Use handoff_to_human com motivo detalhado (produto buscado + dados do lead)
  3. NÃO tente sugerir alternativas, NÃO pergunte mais nada — faça o transbordo direto

REGRA CRÍTICA DE TAGS: SEMPRE use set_tags A CADA mensagem do lead para atualizar motivo e interesse.
- Quando o lead disser "quero comprar X" → set_tags motivo:compra, interesse:X
- Quando o lead disser "preciso trocar Y" → set_tags motivo:troca, interesse:Y
- Quando o lead pedir orçamento → set_tags motivo:orcamento
- Tags com mesma chave são substituídas automaticamente (motivo:saudacao → motivo:compra)

Máximo 4-5 perguntas de qualificação. Se já tem produto de interesse + nome, faça handoff.

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
          description: 'Busca produtos no catálogo por texto, categoria, subcategoria ou faixa de preço. SEMPRE use antes de send_carousel ou send_media.',
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
          let query = supabase
            .from('ai_agent_products')
            .select('title, category, subcategory, description, price, images, in_stock')
            .eq('agent_id', agent_id)
            .eq('enabled', true)

          if (args.category) query = query.ilike('category', `%${args.category}%`)
          if (args.subcategory) query = query.ilike('subcategory', `%${args.subcategory}%`)
          if (args.min_price) query = query.gte('price', args.min_price)
          if (args.max_price) query = query.lte('price', args.max_price)
          if (args.query) {
            query = query.or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%,category.ilike.%${args.query}%`)
          }

          const { data: products } = await query.limit(10)
          if (!products || products.length === 0) return 'Nenhum produto encontrado com esses critérios.'

          return products.map((p, i) =>
            `${i + 1}. ${p.title} - R$${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (SEM ESTOQUE)' : ''}${p.images?.[0] ? ' [tem imagem]' : ' [sem imagem]'}`
          ).join('\n')
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

          const carousel = withImages.slice(0, 10).map((p: any) => ({
            text: `${p.title}\n${p.description?.substring(0, 80) || ''}\nR$ ${p.price?.toFixed(2) || 'Sob consulta'}${!p.in_stock ? ' (INDISPONÍVEL)' : ''}`,
            image: p.images[0],
            buttons: [{ id: p.title, text: 'Quero este!', type: 'REPLY' }],
          }))

          const sendRes = await fetchWithTimeout(`${uazapiUrl}/send/carousel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instance.token },
            body: JSON.stringify({ number: contact.jid, message: args.message || 'Confira nossas opções:', carousel }),
          })

          if (!sendRes.ok) {
            const err = await sendRes.json().catch(() => ({}))
            console.error('[ai-agent] Carousel error:', sendRes.status, JSON.stringify(err).substring(0, 200))
            return `Erro ao enviar carrossel (${sendRes.status}). Descreva os produtos por texto.`
          }

          return `Carrossel enviado! ${withImages.length} produto(s): ${withImages.map((p: any) => p.title).join(', ')}`
        }

        case 'send_media': {
          const { media_url, media_type, caption } = args
          if (!media_url) return 'URL da mídia não informada.'

          const type = ['image', 'video', 'document'].includes(media_type) ? media_type : 'image'

          const sendRes = await fetchWithTimeout(`${uazapiUrl}/send/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instance.token },
            body: JSON.stringify({ number: contact.jid, type, file: media_url, text: caption || '' }),
          })

          if (!sendRes.ok) return `Erro ao enviar mídia (${sendRes.status}). Descreva por texto.`
          return `Mídia enviada! Tipo: ${type}${caption ? `, legenda: "${caption.substring(0, 50)}"` : ''}`
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
          const newStatus = 'desligada'

          // Send handoff message directly (don't rely on Gemini generating it)
          const handoffMsg = agent.handoff_message || 'Só um instante que vou te encaminhar para nosso consultor de vendas.'
          await fetchWithTimeout(`${uazapiUrl}/send/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instance.token },
            body: JSON.stringify({ number: contact.jid, text: handoffMsg }),
          })
          await supabase.from('conversation_messages').insert({
            conversation_id, direction: 'outgoing', content: handoffMsg, media_type: 'text',
          })

          // Set IA to desligada
          await supabase.from('conversations').update({ status_ia: newStatus }).eq('id', conversation_id)

          // Auto-assign "Atendimento Humano" label if available
          const handoffLabel = (availableLabels || []).find((l: any) =>
            l.name.toLowerCase().includes('atendimento') || l.name.toLowerCase().includes('humano')
          )
          if (handoffLabel) {
            await supabase.from('conversation_labels').delete().eq('conversation_id', conversation_id)
            await supabase.from('conversation_labels').insert({ conversation_id, label_id: handoffLabel.id })
          }

          // Add ia:desativada tag
          const existing: string[] = conversation.tags || []
          const tagMap = new Map<string, string>()
          for (const t of existing) tagMap.set(t.split(':')[0], t)
          tagMap.set('ia', 'ia:desativada')
          await supabase.from('conversations').update({ tags: Array.from(tagMap.values()) }).eq('id', conversation_id)

          // Log handoff
          await supabase.from('ai_agent_logs').insert({
            agent_id, conversation_id, event: 'handoff',
            metadata: { reason: args.reason, cooldown_minutes: cooldown, new_status: newStatus },
          })

          // Broadcast status change
          await Promise.all(
            ['helpdesk-realtime', 'helpdesk-conversations'].map(topic =>
              fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
                method: 'POST',
                headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
                body: JSON.stringify({ messages: [{ topic, event: 'new-message', payload: { conversation_id, status_ia: newStatus } }] }),
              }).catch((err: Error) => console.warn('[ai-agent] broadcast failed:', err.message))
            )
          )

          return `Conversa transferida para atendente humano. Motivo: ${args.reason}. IA em modo shadow (observando).`
        }

        default:
          return `Tool ${name} não implementada.`
      }
    }

    // 15. Call Gemini API with function calling loop
    const geminiModel = agent.model || 'gemini-2.5-flash'
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`

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

        currentContents.push({ role: 'model', parts })
        currentContents.push({ role: 'user', parts: toolResults })
        continue
      }

      responseText = parts.find((p: any) => p.text)?.text || ''
      break
    }

    if (!responseText.trim()) {
      return new Response(JSON.stringify({ error: 'Empty response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[ai-agent] Response (${outputTokens} tok): ${responseText.substring(0, 100)}...`)

    // 16. Send response via UAZAPI (TTS audio or text)
    let sentMediaType = 'text'
    const shouldSendAudio = agent.voice_enabled &&
      responseText.length <= (agent.voice_max_text_length || 150)

    if (shouldSendAudio) {
      // Generate TTS audio via Gemini
      try {
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
        const ttsRes = await fetchWithTimeout(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Leia o seguinte texto em português brasileiro com tom natural e amigável: "${responseText}"` }] }],
            generationConfig: {
              response_modalities: ['AUDIO'],
              speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Kore' } } },
            },
          }),
        })

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json()
          const audioPart = ttsData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
          if (audioPart?.inlineData?.data) {
            // Send as PTT via UAZAPI
            await fetchWithTimeout(`${uazapiUrl}/send/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instance.token },
              body: JSON.stringify({ number: contact.jid, type: 'ptt', file: audioPart.inlineData.data }),
            })
            sentMediaType = 'audio'
            console.log(`[ai-agent] TTS audio sent (${responseText.length} chars)`)
          } else {
            // Fallback to text
            await fetchWithTimeout(`${uazapiUrl}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instance.token },
              body: JSON.stringify({ number: contact.jid, text: responseText }),
            })
          }
        } else {
          // TTS failed, send as text
          console.error('[ai-agent] TTS failed:', ttsRes.status)
          await fetchWithTimeout(`${uazapiUrl}/send/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instance.token },
            body: JSON.stringify({ number: contact.jid, text: responseText }),
          })
        }
      } catch (ttsErr) {
        console.error('[ai-agent] TTS error:', ttsErr)
        await fetchWithTimeout(`${uazapiUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.token },
          body: JSON.stringify({ number: contact.jid, text: responseText }),
        })
      }
    } else {
      await fetchWithTimeout(`${uazapiUrl}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ number: contact.jid, text: responseText }),
      })
    }

    // 17. Save outgoing message to DB
    const { data: savedMsg } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id, direction: 'outgoing',
        content: responseText, media_type: sentMediaType,
        external_id: `ai_agent_${Date.now()}`,
      })
      .select('id, created_at')
      .single()

    // 18. Update conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), last_message: responseText.substring(0, 200), status_ia: 'ligada' })
      .eq('id', conversation_id)

    // 19. Broadcast to helpdesk realtime
    const broadcastPayload = {
      conversation_id, inbox_id: conversation.inbox_id,
      message_id: savedMsg?.id, direction: 'outgoing',
      content: responseText, media_type: sentMediaType,
      created_at: savedMsg?.created_at || new Date().toISOString(),
      status_ia: 'ligada',
    }

    await Promise.all(
      ['helpdesk-realtime', 'helpdesk-conversations'].map(topic =>
        fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ messages: [{ topic, event: 'new-message', payload: broadcastPayload }] }),
        }).catch((err: Error) => console.warn('[ai-agent] broadcast failed:', err.message))
      )
    )

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
      },
    })

    // 21. Update lead_profile: interaction count + conversation summary (ALWAYS)
    try {
      const toolNames = toolCallsLog.map((t: any) => t.name)
      const products = toolCallsLog
        .filter((t: any) => t.name === 'search_products' || t.name === 'send_carousel')
        .flatMap((t: any) => {
          if (t.name === 'send_carousel') return t.args?.product_ids || []
          return t.args?.query ? [t.args.query] : []
        })
      const hadHandoff = toolNames.includes('handoff_to_human')
      const currentTags = conversation.tags || []

      const summaryEntry = {
        date: new Date().toISOString(),
        summary: `${incomingText.substring(0, 100)} → ${responseText.substring(0, 100)}`,
        products: [...new Set(products)].slice(0, 5),
        sentiment: currentTags.find((t: string) => t.startsWith('sentimento:'))?.split(':')[1] || null,
        outcome: hadHandoff ? 'handoff' : 'respondido',
        tools_used: [...new Set(toolNames)],
      }

      // Load current profile, append summary, update in one operation
      const { data: curProfile } = await supabase
        .from('lead_profiles')
        .select('conversation_summaries, total_interactions')
        .eq('contact_id', contact.id)
        .maybeSingle()

      const existingSummaries: any[] = curProfile?.conversation_summaries || []
      const updatedSummaries = [...existingSummaries, summaryEntry].slice(-10)
      const newCount = (curProfile?.total_interactions || 0) + 1

      const profileUpdate: Record<string, any> = {
        contact_id: contact.id,
        conversation_summaries: updatedSummaries,
        total_interactions: newCount,
        last_contact_at: new Date().toISOString(),
      }
      if (!curProfile) profileUpdate.full_name = contact.name || null

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

    return new Response(JSON.stringify({ error: errMsg, stack: errStack }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
