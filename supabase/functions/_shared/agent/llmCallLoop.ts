/**
 * Sprint B5 Onda 4 — Loop principal de chamadas LLM com function calling.
 *
 * Extrai do `ai-agent/index.ts` os 3 blocos contíguos:
 *   - Setup: converte geminiContents legacy → llmMessages OpenAI-style, inicializa
 *     counters (attempts, toolRounds, totalInputTokens).
 *   - Main while loop: callLLM → tool execution (seq/parallel) → handoff guard →
 *     pendingQuestions injection → appendToolResults → MAX_TOOL_ROUNDS safety →
 *     retry com backoff em erro → 502 em 3 falhas.
 *   - Post-LLM cleanup: dedup nome ("GeorgeGeorge"→"George") + greeting strip
 *     Bug 17 v2 quando hasInteracted=true.
 *
 * No Sprint C, este módulo continua como orquestrador (não vira specialist).
 * O router LLM vai chamá-lo após escolher o specialist; ele encapsula o loop
 * function-calling padrão da OpenAI.
 *
 * Equivalência semântica linha-a-linha do monolito. Sem mudança de comportamento.
 *
 * Notas:
 *   - `executeToolSafe` continua sendo um closure do index.ts (R140 stack trace
 *     persist), injetado via ctx. Razão: R121 inline search + R137 wire pré-LLM
 *     + set_tags handler também usam executeToolSafe — keeping it in index.ts
 *     evita refator cross-cutting.
 *   - `toolCallsLog` é ref mutável: o caller (index.ts) cria o array antes da
 *     pre-LLM phase (R121/R137 já pushaaram); o loop continua pushando. Padrão
 *     idêntico ao de setTagsAndHandoff (Onda 3d).
 *   - `geminiContents.__pendingQuestions` é gambiarra herdada: o agrupador de
 *     msgs anexa lista de perguntas extras no array; o loop injeta no último
 *     tool result + faz follow-up call se sobrarem. Refator pra remover é
 *     fora de escopo da Onda 4.
 */

import { callLLM, appendToolResults, type LLMMessage, type LLMToolDef } from '../llmProvider.ts'
import { evaluateHandoffGuard, HANDOFF_GUARD_BLOCKED_MSG } from '../handoffGuard.ts'
import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface ToolCallLogEntry {
  name: string
  args?: any
  result?: string
}

export type ExecuteToolSafeFn = (name: string, args: Record<string, any>) => Promise<string>
// union literal: impl real aceita só 'composing'|'recording' (contravariância vs string).
export type SendPresenceFn = (state: 'composing' | 'recording') => void

export interface LlmCallLoopAgentConfig {
  temperature?: number | null
  max_tokens?: number | null
  model?: string | null
  greeting_message?: string | null
}

export interface LlmCallLoopCtx {
  /** Config do agente (model, temperature, etc.) */
  agent: LlmCallLoopAgentConfig & Record<string, any>
  /** Modelo efetivo (já com fallback resolvido upstream) */
  llmModel: string
  /** System prompt completo (montado upstream via promptSections) */
  systemPrompt: string
  /** Definições das tools disponíveis (já filtradas pelo profile/funnel) */
  toolDefs: LLMToolDef[]
  /**
   * Mensagens em formato Gemini legacy ({role, parts: [{text}]}). Convertido
   * internamente pra LLMMessage. Pode ter __pendingQuestions anexado como
   * gambiarra do agrupador de msgs upstream.
   */
  geminiContents: any[]
  /**
   * Ref mutável compartilhada com pre-LLM (R121 inline, R137 wire) e tools
   * (set_tags pode pushar pseudo-entries). O loop continua pushando real
   * tool calls executadas pelo LLM.
   */
  toolCallsLog: ToolCallLogEntry[]
  /**
   * Dispatcher do switch executeTool envolvido por executeToolSafe (R140
   * stack trace persist). Injetado pelo index.ts.
   */
  executeToolSafe: ExecuteToolSafeFn
  /**
   * Primeiro nome confirmado do lead (lead_profiles.full_name → 1º token), se houver.
   * Usado no post-LLM cleanup pra RESTAURAR o nome quando o LLM o trunca numa
   * vocativa ("João" → "Jo"). O truncamento é geração do LLM (provado: nenhum
   * regex determinístico nosso corta nomes); a restauração é determinística e
   * estreita (só age quando o nome completo não aparece e o prefixo isolado aparece).
   */
  leadFirstName?: string
  /** Conversation row — só `.tags` é lida (handoff guard) */
  conversation: { tags?: string[] | null } & Record<string, any>
  /** Toggle pra ativar greeting strip + dedup nome (Bug 17 v2) */
  hasInteracted: boolean
  /** Indicador de presença ("composing") enviado em retries */
  sendPresence: SendPresenceFn
  log: Logger
  /** DB + ids pra error log insert quando LLM falha 3× */
  supabase: any
  agent_id: string
  conversation_id: string
  /** startTime do turn (usado em latency_ms no error log) */
  startTime: number
  /** Headers CORS já resolvidos (caller passa dinâmico ou estático) */
  corsHeaders: Record<string, string>
  /**
   * Bug 12 fix (v7.43.13): desabilita o handoffGuard (exigência de search_products
   * antes de handoff_to_human). O guard protege o MONOLITH de pular o SDR. O
   * product_specialist tem fluxo próprio controlado (prompt regra 9: só escala após
   * pedido completo) e o guard bloqueava o fechamento legítimo de pedido multi-turn
   * (busca foi em turno anterior, não no turno do handoff). Default false (guard ativo).
   */
  disableHandoffGuard?: boolean
}

export interface LlmCallLoopResult {
  responseText: string
  inputTokens: number
  outputTokens: number
  usedModel: string
  /**
   * Quando LLM falha 3× consecutivas, o loop monta Response 502 e retorna
   * aqui pro caller propagar (preserva comportamento original do index.ts
   * que dava `return new Response(...)` dentro do while).
   */
  errorResponse: Response | null
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Executa o loop principal de function calling.
 *
 * - Faz até 5 tentativas em caso de erro de rede no LLM (retry exponencial 1.5s).
 * - Faz até 3 rounds de tool calls; depois força resposta texto-only (safety).
 * - Aplica handoff guard antes de executar handoff_to_human.
 * - Injeta pendingQuestions no último tool result; faz follow-up call se não há tools.
 * - Aplica strip de saudação + dedup de nome no responseText quando hasInteracted.
 *
 * Quando handoff_to_human é executado, sai do loop imediatamente (a tool já enviou
 * msg pro WhatsApp; responseText fica vazio e caller pula o envio adicional).
 */
export async function runLlmCallLoop(ctx: LlmCallLoopCtx): Promise<LlmCallLoopResult> {
  // ── Setup ──────────────────────────────────────────────────────────────
  // Convert Gemini-style contents to OpenAI-style messages
  let llmMessages: LLMMessage[] = ctx.geminiContents.map((c: any) => ({
    role: c.role === 'model' ? ('assistant' as const) : ('user' as const),
    content: c.parts?.[0]?.text || '',
  }))

  let responseText = ''
  let inputTokens = 0
  let outputTokens = 0
  let attempts = 0
  const maxAttempts = 5
  const MAX_TOOL_ROUNDS = 3
  let toolRounds = 0
  const MAX_ACCUMULATED_INPUT_TOKENS = 8192 // Safety ceiling for accumulated context across tool rounds
  let totalInputTokens = 0
  let usedModel = ctx.llmModel

  // ── Main while loop ────────────────────────────────────────────────────
  while (attempts < maxAttempts) {
    attempts++
    if (attempts > 1) ctx.sendPresence('composing')

    try {
      const llmResult = await callLLM({
        systemPrompt: ctx.systemPrompt,
        messages: llmMessages,
        tools: ctx.toolDefs,
        temperature: ctx.agent.temperature || 0.7,
        maxTokens: ctx.agent.max_tokens || 1024,
        model: ctx.llmModel,
      })

      ctx.log.info('LLM response', {
        provider: llmResult.provider,
        model: llmResult.model,
        latency_ms: llmResult.latency_ms,
        input_tokens: llmResult.inputTokens,
        output_tokens: llmResult.outputTokens,
        tool_calls: llmResult.toolCalls.length,
      })

      inputTokens += llmResult.inputTokens
      outputTokens += llmResult.outputTokens
      usedModel = llmResult.model

      totalInputTokens += llmResult.inputTokens
      if (totalInputTokens > MAX_ACCUMULATED_INPUT_TOKENS && toolRounds >= 1) {
        ctx.log.warn('Token ceiling reached — trimming context', {
          totalInputTokens,
          ceiling: MAX_ACCUMULATED_INPUT_TOKENS,
          toolRounds,
        })
        // Keep only the last 3 exchange pairs (6 messages) to stay within bounds
        if (llmMessages.length > 6) {
          llmMessages = llmMessages.slice(-6)
        }
      }

      // Handle tool calls
      if (llmResult.toolCalls.length > 0) {
        // Cart Engine (2026-05-25): add_to_cart/update_cart leem+escrevem
        // conversations.cart_items (read-modify-write no objeto compartilhado). Se o LLM
        // emitir 2 cart calls num turno, paralelo = race (última escrita vence, item some).
        // Tratar como side-effect força execução SEQUENCIAL → merges compõem corretamente.
        const sideEffectTools = new Set(['send_carousel', 'send_media', 'send_poll', 'handoff_to_human', 'set_cart'])
        const hasSideEffects = llmResult.toolCalls.some((tc) => sideEffectTools.has(tc.name))

        const toolResultEntries: { name: string; result: string }[] = []

        if (hasSideEffects || llmResult.toolCalls.length === 1) {
          for (const tc of llmResult.toolCalls) {
            // GUARD: handoff_to_human exige busca prévia quando há contexto de produto.
            // Lógica isolada em _shared/handoffGuard.ts pra ser testável (R122).
            // v7.43.13: pulado quando disableHandoffGuard (product_specialist controla
            // seu próprio fluxo de fechamento via prompt regra 9).
            if (tc.name === 'handoff_to_human' && !ctx.disableHandoffGuard) {
              const guard = evaluateHandoffGuard({
                tags: ctx.conversation.tags || [],
                toolNamesThisRound: ctx.toolCallsLog.map((t) => t.name),
              })
              if (!guard.allowed) {
                ctx.log.warn('GUARD: handoff blocked — search_products required first', {
                  reason: guard.reason,
                })
                ctx.toolCallsLog.push({ name: tc.name, args: tc.args, result: HANDOFF_GUARD_BLOCKED_MSG })
                toolResultEntries.push({ name: tc.name, result: HANDOFF_GUARD_BLOCKED_MSG })
                continue
              }
            }
            ctx.log.info('Tool (seq)', {
              tool: tc.name,
              args_preview: JSON.stringify(tc.args).substring(0, 100),
            })
            const result = await ctx.executeToolSafe(tc.name, tc.args || {})
            ctx.toolCallsLog.push({ name: tc.name, args: tc.args, result: result.substring(0, 200) })
            toolResultEntries.push({ name: tc.name, result })
          }
        } else {
          ctx.log.info('Parallel tools', { tools: llmResult.toolCalls.map((tc) => tc.name) })
          const results = await Promise.all(
            llmResult.toolCalls.map(async (tc) => {
              const result = await ctx.executeToolSafe(tc.name, tc.args || {})
              ctx.toolCallsLog.push({ name: tc.name, args: tc.args, result: result.substring(0, 200) })
              return { name: tc.name, result }
            }),
          )
          toolResultEntries.push(...results)
        }

        if (ctx.toolCallsLog.some((t) => t.name === 'handoff_to_human')) {
          ctx.log.info('handoff_to_human called, stopping loop')
          break
        }

        // Inject pending questions from grouped messages into the LAST tool result
        // so LLM sees them right before generating the response
        const pendingQs = (ctx.geminiContents as any).__pendingQuestions as string[] | undefined
        if (pendingQs?.length && toolResultEntries.length > 0) {
          const lastEntry = toolResultEntries[toolResultEntries.length - 1]
          const questionsBlock = pendingQs.map((q, i) => `${i + 1}. "${q}"`).join('\n')
          lastEntry.result += `\n\nPERGUNTAS PENDENTES DO LEAD (responda TODAS na sua mensagem):\n${questionsBlock}\nIMPORTANTE: sua resposta DEVE abordar cada pergunta acima. Se não tem info cadastrada sobre o tema, diga "Vou verificar com nosso consultor" e faça handoff_to_human.`
          // Clear so they're not injected again on next tool round
          ;(ctx.geminiContents as any).__pendingQuestions = undefined
        }

        // Append tool results to conversation for next LLM call
        llmMessages = appendToolResults(llmMessages, llmResult.toolCalls, toolResultEntries)
        toolRounds++

        // Safety: after MAX_TOOL_ROUNDS, force a final text-only LLM call (no tools)
        if (toolRounds >= MAX_TOOL_ROUNDS) {
          ctx.log.warn('Tool round limit reached', { rounds: MAX_TOOL_ROUNDS })
          try {
            const finalResult = await callLLM({
              systemPrompt: ctx.systemPrompt,
              messages: llmMessages,
              tools: [], // No tools — force text response
              temperature: ctx.agent.temperature || 0.7,
              maxTokens: ctx.agent.max_tokens || 1024,
              model: ctx.llmModel,
            })
            ctx.log.info('LLM response (final text-only)', {
              provider: finalResult.provider,
              model: finalResult.model,
              latency_ms: finalResult.latency_ms,
              input_tokens: finalResult.inputTokens,
              output_tokens: finalResult.outputTokens,
              tool_calls: 0,
            })
            inputTokens += finalResult.inputTokens
            outputTokens += finalResult.outputTokens
            responseText = finalResult.text
          } catch (e) {
            ctx.log.error?.('Final text-only call failed', { error: (e as Error).message })
          }
          break
        }
        continue
      }

      responseText = llmResult.text

      // If there are pending questions from grouped msgs that weren't answered by tool flow,
      // make one more LLM call with the pending questions appended
      const remainingQs = (ctx.geminiContents as any).__pendingQuestions as string[] | undefined
      if (remainingQs?.length && responseText.trim()) {
        ctx.log.info('Pending questions remain after text response — making follow-up call', {
          questions: remainingQs,
        })
        try {
          const followUpMsgs: LLMMessage[] = [
            ...llmMessages,
            { role: 'assistant' as const, content: responseText },
            {
              role: 'user' as const,
              content: `O lead também perguntou:\n${remainingQs
                .map((q, i) => `${i + 1}. "${q}"`)
                .join('\n')}\nResponda essas perguntas. Se não tem informação cadastrada sobre o tema, diga "Vou verificar com nosso consultor".`,
            },
          ]
          const followUp = await callLLM({
            systemPrompt: ctx.systemPrompt,
            messages: followUpMsgs,
            tools: [],
            temperature: ctx.agent.temperature || 0.7,
            maxTokens: 512,
            model: ctx.agent.model || 'gemini-2.5-flash',
          })
          if (followUp.text?.trim()) {
            responseText += '\n\n' + followUp.text.trim()
            inputTokens += followUp.inputTokens
            outputTokens += followUp.outputTokens
          }
        } catch (e) {
          ctx.log.warn('Follow-up for pending questions failed', { error: (e as Error).message })
        }
        ;(ctx.geminiContents as any).__pendingQuestions = undefined
      }
    } catch (err) {
      const errMsg = (err as Error).message || 'LLM error'
      ctx.log.error?.('LLM error', { attempt: attempts, error: errMsg })

      if (attempts < 3) {
        const backoffMs = 1500 * Math.pow(2, attempts - 1)
        ctx.log.info('Retrying LLM after backoff', { backoffMs })
        await new Promise((r) => setTimeout(r, backoffMs))
        continue
      }

      await ctx.supabase.from('ai_agent_logs').insert({
        agent_id: ctx.agent_id,
        conversation_id: ctx.conversation_id,
        event: 'error',
        model: usedModel,
        error: errMsg.substring(0, 300),
        latency_ms: Date.now() - ctx.startTime,
      })
      return {
        responseText: '',
        inputTokens,
        outputTokens,
        usedModel,
        errorResponse: new Response(JSON.stringify({ error: 'LLM API error' }), {
          status: 502,
          headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
        }),
      }
    }

    // ── Post-LLM cleanup ───────────────────────────────────────────────
    // Fix doubled names in response (e.g., "GeorgeGeorge" → "George")
    responseText = responseText.replace(/\b([A-ZÀ-Ú][a-zà-ú]{2,})\1\b/g, '$1')

    // Restaura o 1º nome do lead quando o LLM o TRUNCA na vocativa ("João" → "Jo").
    // Provado (2026-05-26) que nenhum regex determinístico nosso corta nomes — o
    // encurtamento é geração do LLM (o próprio index.ts:1403 já reconhecia isso).
    // Guarda estreita pra zero falso-positivo: só age quando (a) temos o 1º nome
    // confirmado (>=3 chars), (b) o nome completo NÃO aparece na resposta (LLM usou
    // só a forma curta) e (c) um prefixo isolado do nome (>=2 chars) aparece como
    // token. Tenta do prefixo mais longo pro mais curto. `\b` evita pegar "Jo" dentro
    // de "Jorge". Restaura pro nome que o lead de fato informou.
    {
      const fn = (ctx.leadFirstName || '').trim()
      const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (fn.length >= 3 && responseText && !new RegExp(`\\b${escRe(fn)}\\b`, 'i').test(responseText)) {
        for (let len = fn.length - 1; len >= 2; len--) {
          const pref = fn.slice(0, len)
          const prefRe = new RegExp(`\\b${escRe(pref)}\\b`, 'g')
          if (prefRe.test(responseText)) {
            responseText = responseText.replace(new RegExp(`\\b${escRe(pref)}\\b`, 'g'), fn)
            ctx.log.info?.('Restaurado 1º nome truncado pelo LLM', { truncated: pref, restored: fn })
            break
          }
        }
      }
    }

    // Strip greeting repetition from response (if LLM repeats it despite instructions)
    // Bug 17 fix v2 (2026-05-17): expandido pra cobrir Bom dia / Boa tarde / Boa noite /
    // Bem-vindo / Bem vinda + com ou sem nome + em qualquer linha (multiline regex).
    if (ctx.hasInteracted) {
      // Fix Bug 3 (v7.43.1): guarda raw response ANTES do strip pra log + fallback inteligente
      const rawBeforeStrip = responseText

      if (ctx.agent.greeting_message) {
        const greetNorm = ctx.agent.greeting_message.toLowerCase().trim().replace(/[!?.]/g, '')
        if (responseText.toLowerCase().includes(greetNorm)) {
          responseText = responseText
            .replace(new RegExp(ctx.agent.greeting_message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
            .trim()
        }
      }
      // Fix Bug 3 v2 (v7.43.1): regex menos agressivo. Antes capturava "Olá! Para sala..." e
      // consumia "Para" achando que era nome → restante "sala..." começa em lowercase ou vazio.
      // Agora: só captura nome se vier APÓS vírgula explícita ("Olá, Pedro!" sim; "Olá! Para sala" não).
      const greetingPrefixRe = /(?:^|\n)\s*(?:olá|ola|oi+e?|oie?|ei|hey|opa|eae|eai|fala|salve|bom\s+dia|boa\s+tarde|boa\s+noite|bem[\s-]*vind[oa])\b(?:[,]\s*[A-ZÀ-Úa-zà-ú][a-zà-ú]{1,})?[!.,]?\s*/gi
      responseText = responseText.replace(greetingPrefixRe, ' ').trim()
      // Limpa multiplos espacos/quebras consecutivas resultantes do strip
      responseText = responseText.replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n').replace(/  +/g, ' ').trim()
      // Fix Bug 3 v3 (v7.43.1): se strip esvaziou completamente, log o raw + preserva o original
      // em vez de usar fallback genérico "Em que posso te ajudar?" (era horrível UX — destrói
      // resposta útil que só tinha um "Olá" extra. Caso real Eletropiso V1 2026-05-23 14:44).
      if (!responseText && rawBeforeStrip.trim()) {
        ctx.log.warn?.('Greeting strip emptied response — usando raw original', {
          raw_preview: rawBeforeStrip.substring(0, 200),
        })
        responseText = rawBeforeStrip.trim()
      } else if (!responseText) {
        // Raw também vazio: LLM realmente não gerou nada. Fallback minimal.
        responseText = 'Em que posso te ajudar?'
      }
    }

    // Loop completed normally — sai do while
    break
  }

  return {
    responseText,
    inputTokens,
    outputTokens,
    usedModel,
    errorResponse: null,
  }
}
