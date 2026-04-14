/**
 * M19-S5: Edge Function — Assistente IA Conversacional
 *
 * Gestor faz perguntas em linguagem natural sobre métricas.
 * Fluxo: Auth → Rate limit → Cache → NLU (LLM) → Query → Format (LLM) → Response
 *
 * verify_jwt: false (auth manual)
 * CORS: getDynamicCorsHeaders(req)
 */

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import { callLLM } from '../_shared/llmProvider.ts'
import { executeIntent, AVAILABLE_INTENTS } from '../_shared/assistantQueries.ts'
import type { IntentParams } from '../_shared/assistantQueries.ts'

const log = createLogger('assistant-chat')

// ── Prompts ────────────────────────────────────────────────────────────────

const NLU_SYSTEM_PROMPT = `Você classifica perguntas de gestores sobre métricas de negócio de um CRM de WhatsApp.
Retorne APENAS um JSON válido (sem markdown, sem backticks): { "intent": "nome", "params": { ... } }

Intents disponíveis:
- leads_count: quantos leads, volume de leads, novos leads
- leads_by_origin: leads por canal, origem, de onde vêm
- conversion_rate: taxa de conversão, funil, quantos converteram
- top_sellers: melhores vendedores, ranking, quem mais vendeu
- worst_sellers: piores vendedores, quem menos resolveu
- handoff_rate: taxa de transbordo, quantos passaram para humano
- handoff_reasons: motivos de transbordo, por que transferiu
- agent_cost: custo da IA, quanto gastou com IA, tokens
- agent_efficiency: eficiência da IA, performance, latência
- ia_vs_vendor: comparativo IA vs vendedor, quem é melhor
- nps_average: NPS médio, satisfação, nota média
- nps_by_seller: NPS por vendedor, satisfação por atendente
- lead_score_distribution: distribuição de scores, faixas de score
- hot_leads: leads quentes, leads com score alto, oportunidades
- funnel_stages: etapas do funil, onde estão os leads
- resolution_time: tempo de resolução, quanto demora para resolver
- pending_conversations: conversas pendentes, fila, aguardando
- daily_trend: tendência, evolução, gráfico diário
- goals_progress: metas, objetivos, progresso das metas
- seller_detail: detalhes de um vendedor específico (requer seller_id)
- unknown: não consigo classificar esta pergunta

Params possíveis:
- period: "today", "7d", "30d", "90d" (default "30d")
- seller_id: UUID do vendedor (só para seller_detail)
- limit: número máximo de resultados (default 5)

Se não souber o período, use "30d".
Se a pergunta menciona "hoje" → "today", "semana" → "7d", "mês" → "30d", "trimestre" → "90d".`

const FORMAT_SYSTEM_PROMPT = `Você formata dados de métricas em resposta natural em português brasileiro.
Regras:
- Seja conciso (máximo 3 parágrafos curtos)
- Números formatados: 1.234 e 85,3%
- Valores monetários em dólar: $1,23
- Não repita os dados brutos se já estão claros
- Ao final, inclua um campo JSON "suggestions" com 2-3 perguntas de follow-up
- Formato da resposta: { "answer": "texto", "suggestions": ["pergunta1", "pergunta2"] }`

// ── Helpers ────────────────────────────────────────────────────────────────

function hashQuery(message: string, instanceId: string): string {
  let hash = 0
  const str = `${instanceId}:${message.toLowerCase().trim()}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `h_${Math.abs(hash).toString(36)}`
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Auth — verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse(corsHeaders)
    }

    const userClient = createUserClient(req)
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await userClient.auth.getUser(token)

    if (userError || !userData?.user) {
      return unauthorizedResponse(corsHeaders)
    }

    const userId = userData.user.id
    const serviceClient = createServiceClient()

    // 2. Role check — super_admin or gerente (.limit(1) para evitar crash se user tem 2 roles)
    const { data: roleData, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['super_admin', 'gerente'])
      .limit(1)
      .maybeSingle()

    if (roleError || !roleData) {
      return errorResponse(corsHeaders, 'Forbidden: Gerente ou Super Admin requerido', 403)
    }

    // 3. Parse body
    const body = await req.json()
    const { message, instance_id, conversation_id, context } = body as {
      message: string
      instance_id: string
      conversation_id?: string
      context?: string
    }

    if (!message?.trim() || !instance_id) {
      return errorResponse(corsHeaders, 'message e instance_id são obrigatórios', 400)
    }

    // 4. Instance access check
    const { data: accessData, error: accessError } = await serviceClient
      .from('user_instance_access')
      .select('instance_id')
      .eq('user_id', userId)
      .eq('instance_id', instance_id)
      .maybeSingle()

    // super_admin pode acessar qualquer instância
    const isSuperAdmin = roleData.role === 'super_admin'
    if (!isSuperAdmin && (accessError || !accessData)) {
      return errorResponse(corsHeaders, 'Acesso negado a esta instância', 403)
    }

    // 5. Rate limit — 20 req/min
    const rateResult = await checkRateLimit(userId, 'assistant-chat', 20, 60)
    if (rateResult.limited) {
      return errorResponse(corsHeaders, 'Limite de requisições excedido (20/min)', 429)
    }

    // 6. Cache check
    const queryHash = hashQuery(message, instance_id)
    const { data: cached } = await serviceClient
      .from('assistant_cache')
      .select('result')
      .eq('instance_id', instance_id)
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached?.result) {
      log.info('Cache hit', { queryHash, instance_id })
      return successResponse(corsHeaders, cached.result as Record<string, unknown>)
    }

    // 7. NLU — classify intent via LLM
    const nluPrompt = context
      ? `Contexto da página: ${context}\n\nPergunta: ${message}`
      : message

    const nluResult = await callLLM({
      systemPrompt: NLU_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: nluPrompt }],
      tools: [],
      temperature: 0,
      maxTokens: 200,
      model: 'gpt-4.1-mini',
    })

    let intent = 'unknown'
    let params: IntentParams = {}

    try {
      const parsed = JSON.parse(nluResult.text.replace(/```json\n?/g, '').replace(/```/g, '').trim())
      intent = parsed.intent || 'unknown'
      params = parsed.params || {}
    } catch {
      log.warn('NLU parse failed', { raw: nluResult.text })
      intent = 'unknown'
    }

    log.info('NLU classified', { intent, params, tokens: nluResult.inputTokens + nluResult.outputTokens })

    // 8. Execute query
    if (intent === 'unknown' || !AVAILABLE_INTENTS.includes(intent)) {
      const fallbackResponse = {
        answer: 'Não consegui entender essa pergunta. Tente reformular, por exemplo:\n• "Quantos leads tivemos esse mês?"\n• "Qual o NPS médio?"\n• "Quem são os melhores vendedores?"',
        data: null,
        format_type: 'number' as const,
        suggestions: [
          'Quantos leads novos esse mês?',
          'Qual a taxa de transbordo?',
          'Quem são os melhores vendedores?',
        ],
      }

      // Save to conversation history (fire-and-forget)
      saveToConversation(serviceClient, conversation_id, instance_id, userId, message, fallbackResponse.answer)

      return successResponse(corsHeaders, fallbackResponse)
    }

    const intentResult = await executeIntent(serviceClient, intent, instance_id, params)

    if (!intentResult) {
      return errorResponse(corsHeaders, 'Erro ao executar query', 500)
    }

    // 9. Format response via LLM
    const formatPrompt = `Pergunta do gestor: "${message}"
Dados retornados (intent: ${intent}):
${JSON.stringify(intentResult.data, null, 2)}
Dica: ${intentResult.summary_hint}`

    const formatResult = await callLLM({
      systemPrompt: FORMAT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: formatPrompt }],
      tools: [],
      temperature: 0.3,
      maxTokens: 500,
      model: 'gpt-4.1-mini',
    })

    let answer = ''
    let suggestions: string[] = []

    try {
      const parsed = JSON.parse(formatResult.text.replace(/```json\n?/g, '').replace(/```/g, '').trim())
      answer = parsed.answer || formatResult.text
      suggestions = parsed.suggestions || []
    } catch {
      answer = formatResult.text
      suggestions = ['Quantos leads novos esse mês?', 'Qual a taxa de conversão?']
    }

    const response = {
      answer,
      data: intentResult.data,
      format_type: intentResult.format_type,
      suggestions,
      intent,
      cached: false,
    }

    // 10. Cache result (fire-and-forget) — DELETE+INSERT em vez de upsert (R36: onConflict por colunas falha)
    serviceClient
      .from('assistant_cache')
      .delete()
      .eq('instance_id', instance_id)
      .eq('query_hash', queryHash)
      .then(() =>
        serviceClient
          .from('assistant_cache')
          .insert({
            instance_id: instance_id,
            query_hash: queryHash,
            result: response,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
      )
      .then((res: any) => {
        if (res?.error) log.warn('Cache write failed', { error: res.error.message })
      })
      .catch((err: any) => log.warn('Cache write error', { error: err?.message }))

    // 11. Save to conversation (fire-and-forget)
    saveToConversation(serviceClient, conversation_id, instance_id, userId, message, answer)

    log.info('Response sent', {
      intent,
      instance_id,
      nlu_tokens: nluResult.inputTokens + nluResult.outputTokens,
      format_tokens: formatResult.inputTokens + formatResult.outputTokens,
    })

    return successResponse(corsHeaders, response)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    log.error('Error', { error: errorMessage })
    return errorResponse(corsHeaders, errorMessage, 500)
  }
})

// ── Conversation persistence ───────────────────────────────────────────────

async function saveToConversation(
  // deno-lint-ignore no-explicit-any
  sb: any,
  conversationId: string | undefined,
  instanceId: string,
  userId: string,
  userMessage: string,
  assistantAnswer: string,
) {
  try {
    const supabase = sb
    const now = new Date().toISOString()

    if (conversationId) {
      // Append to existing conversation
      const { data: existing } = await supabase
        .from('assistant_conversations')
        .select('messages')
        .eq('id', conversationId)
        .maybeSingle()

      if (existing) {
        const messages = [...(existing.messages || []),
          { role: 'user', content: userMessage, timestamp: now },
          { role: 'assistant', content: assistantAnswer, timestamp: now },
        ]
        await supabase
          .from('assistant_conversations')
          .update({ messages, updated_at: now })
          .eq('id', conversationId)
      }
    } else {
      // Create new conversation
      const title = userMessage.length > 60 ? userMessage.slice(0, 57) + '...' : userMessage
      await supabase
        .from('assistant_conversations')
        .insert({
          instance_id: instanceId,
          user_id: userId,
          messages: [
            { role: 'user', content: userMessage, timestamp: now },
            { role: 'assistant', content: assistantAnswer, timestamp: now },
          ],
          title,
        })
    }
  } catch (err) {
    // Fire-and-forget — don't fail the response
    console.warn('[assistant-chat] saveToConversation error:', err)
  }
}
