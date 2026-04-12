// supabase/functions/guided-flow-builder/index.ts
// verify_jwt = true (chamada pelo admin autenticado via supabase client)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getDynamicCorsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const SYSTEM_PROMPT = `Você é um assistente especializado em criar fluxos de atendimento WhatsApp.

Subagentes disponíveis (subagent_type):
- greeting: Coleta nome e saúda o lead
- qualification: Faz perguntas e qualifica (campos: budget, nome, interesse, etc)
- sales: Mostra produtos do catálogo (configura max_products, post_action)
- support: Responde dúvidas (configura confidence_threshold)
- survey: Coleta resposta via menu de opções (configura title, options[] 2-12 items)
- followup: Agenda mensagem após N horas (configura delay_hours, message)
- handoff: Transfere para atendente humano com briefing (configura message, department)

Pergunte o objetivo do fluxo, depois construa step a step.
Fluxos típicos: greeting→qualification→sales→handoff | greeting→support→survey | greeting→followup→handoff

IMPORTANTE: Responda SEMPRE em JSON válido com este schema exato:
{
  "assistant_message": "string com sua resposta em português",
  "draft_flow": {
    "name": "Nome do fluxo",
    "description": "Descrição",
    "steps": [
      {
        "position": 0,
        "name": "Nome do step",
        "subagent_type": "greeting",
        "step_config": {},
        "exit_rules": [{"trigger": "name_collected", "action": "next_step"}]
      }
    ],
    "triggers": [
      {
        "trigger_type": "conversation_started",
        "trigger_config": {},
        "priority": 100
      }
    ]
  },
  "suggestions": ["Próxima pergunta 1", "Próxima pergunta 2", "Próxima pergunta 3"]
}

Se ainda não tem informações suficientes para montar o fluxo, coloque "draft_flow": null.
`

serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json() as {
      session_id?: string
      message: string
      instance_id: string
    }

    if (!body.message || !body.instance_id) {
      return new Response(
        JSON.stringify({ error: 'message e instance_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Buscar ou criar sessão
    let sessionId = body.session_id
    let currentMessages: Array<{ role: string; content: string; timestamp: string }> = []

    if (sessionId) {
      const { data: session } = await supabase
        .from('guided_sessions')
        .select('messages, expires_at')
        .eq('id', sessionId)
        .single()

      if (session && new Date(session.expires_at) > new Date()) {
        currentMessages = session.messages as typeof currentMessages
      } else {
        // Sessão expirada ou não encontrada — criar nova
        sessionId = undefined
      }
    }

    if (!sessionId) {
      const { data: newSession, error: createError } = await supabase
        .from('guided_sessions')
        .insert({ instance_id: body.instance_id })
        .select('id')
        .single()

      if (createError || !newSession) {
        throw new Error('Falha ao criar sessão')
      }
      sessionId = newSession.id
    }

    // 2. Montar histórico para o LLM (últimas 20 msgs para não explodir contexto)
    const userMsg = { role: 'user' as const, content: body.message, timestamp: new Date().toISOString() }
    const historyForLLM = [...currentMessages, userMsg].slice(-20)

    const openaiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historyForLLM.map((m) => ({ role: m.role, content: m.content })),
    ]

    // 3. Chamar GPT-4.1-mini
    let parsedResponse: { assistant_message: string; draft_flow: unknown | null; suggestions: string[] } | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: attempt === 0
            ? openaiMessages
            : [...openaiMessages, { role: 'assistant', content: 'Preciso corrigir minha resposta:' }, { role: 'user', content: 'Responda APENAS com JSON válido, sem markdown, sem texto extra.' }],
          temperature: 0.7,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenAI error: ${errText}`)
      }

      const completion = await response.json() as { choices: Array<{ message: { content: string } }> }
      const rawContent = completion.choices[0]?.message?.content ?? '{}'

      try {
        parsedResponse = JSON.parse(rawContent)
        break
      } catch {
        if (attempt === 1) {
          parsedResponse = {
            assistant_message: rawContent,
            draft_flow: null,
            suggestions: [],
          }
        }
      }
    }

    if (!parsedResponse) {
      throw new Error('Falha ao obter resposta do LLM')
    }

    // 4. Append messages na sessão
    const assistantMsg = {
      role: 'assistant' as const,
      content: parsedResponse.assistant_message,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...currentMessages, userMsg, assistantMsg]

    await supabase
      .from('guided_sessions')
      .update({
        messages: updatedMessages,
        draft_flow: parsedResponse.draft_flow ?? null,
      })
      .eq('id', sessionId)

    // 5. Retornar
    return new Response(
      JSON.stringify({
        session_id: sessionId,
        assistant_message: parsedResponse.assistant_message,
        draft_flow: parsedResponse.draft_flow ?? null,
        suggestions: parsedResponse.suggestions ?? [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[guided-flow-builder] error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
