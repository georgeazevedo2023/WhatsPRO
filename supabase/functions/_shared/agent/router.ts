/**
 * Sprint C2 (2026-05-23) — Router LLM tiny.
 *
 * Classifica a INTENT da última msg do lead em 1 de 7 categorias e retorna
 * { intent, confidence, reason }. NÃO responde ao lead — apenas roteia pra
 * um specialist no hop 1.
 *
 * Modelo padrão: gpt-5-nano (latência <500ms, custo ~$0.0001/turno).
 * Pode ser sobrescrito via ctx.routerModel (debug/A-B testing).
 *
 * Output JSON estrito. Em falha de parse OU confidence < 0.6 → fallback seguro
 * pra `qualificacao` (não bloqueia o pipeline, apenas roteia conservadoramente).
 *
 * Pipeline (no caller do index.ts):
 *   1. agent.routing_mode === 'router' → chama classifyIntent
 *   2. classifyIntent insere row em ai_agent_runs com specialist='router', intent, confidence
 *   3. Caller despacha pro specialist correspondente (hop 1) com hop_n=1
 *   4. Max 2 hops (hop guard em Sprint C5)
 *
 * Em modo monolith, este helper NÃO é chamado.
 */

import { callLLM } from '../llmProvider.ts'
import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export type Intent =
  | 'saudacao'
  | 'qualificacao'
  | 'produto'
  | 'handoff'
  | 'objecao'
  | 'pagamento'
  | 'fora_escopo'

export const VALID_INTENTS: readonly Intent[] = [
  'saudacao',
  'qualificacao',
  'produto',
  'handoff',
  'objecao',
  'pagamento',
  'fora_escopo',
] as const

export interface RouterResult {
  intent: Intent
  confidence: number // 0-1
  reason: string // 1 frase justificando
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  /** True quando o LLM falhou parse e usamos fallback determinístico */
  fallback: boolean
}

export interface RouterCtx {
  /** Última msg do lead (texto direto, sem agrupamento) */
  lastIncoming: string
  /** Tags atuais da conversa (sinaliza estado da qualificação) */
  conversationTags: string[]
  /** Histórico curto (até 5 últimas msgs alternando user/assistant) */
  shortHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  /** Modelo router (default gpt-5-nano) */
  routerModel?: string
  log: Logger
}

// =============================================================================
// Prompt — ~800 chars XML-style (compacto pra gpt-5-nano)
// =============================================================================

export const ROUTER_SYSTEM_PROMPT = `<role>Você classifica a INTENÇÃO da última mensagem do lead em um sistema de atendimento WhatsApp. Você NÃO responde ao lead — apenas roteia pra um specialist.</role>

<intents>
- saudacao: lead APENAS cumprimentou ("oi", "bom dia") ou disse o nome. Sem produto/pergunta.
- produto: lead MENCIONA qualquer produto, categoria, marca, tipo de item ou pede preço — COM OU SEM detalhes. Exemplos: "queria tinta", "preço do Coral 18L", "tem fechadura digital?", "quanto custa porta de madeira?". Inclui pedidos vagos como "vcs tem tinta?" e específicos como "Coral fosca branca 18L pra sala".
- qualificacao: lead RESPONDE a uma pergunta de qualificação JÁ FEITA pelo bot (ex.: "interno", "branco", "550 reais"). Veja o histórico — só use se a última msg do bot foi uma pergunta de campo.
- handoff: lead pediu explicitamente falar com vendedor humano / sentimento muito negativo / venda já fechada.
- objecao: lead reclamou de preço, prazo, qualidade, comparou concorrente.
- pagamento: pergunta sobre pix, parcelar, boleto, desconto.
- fora_escopo: pergunta sem relação com vendas/produtos da loja.
</intents>

<rules_criticas>
- "Mencionou produto/categoria/marca/item" SEMPRE = produto. Nunca classifique como qualificacao só porque o lead "foi vago" — o specialist decide se precisa qualificar mais.
- qualificacao APENAS quando lead está respondendo um campo perguntado pelo bot no turno anterior.
- Múltiplas intents na msg? Escolha a PRIMÁRIA pela ordem de prioridade: handoff > produto > pagamento > objecao > qualificacao > saudacao > fora_escopo.
</rules_criticas>

<output_schema>
{ "intent": "<um dos 7 acima>", "confidence": <0.0-1.0>, "reason": "<1 frase>" }
</output_schema>

<rules>
- confidence < 0.6 → roteie pra "qualificacao" (default seguro).
- Retorne APENAS o JSON, sem markdown ou texto extra.
</rules>`

// =============================================================================
// Helpers privados
// =============================================================================

function buildRouterUserMessage(ctx: RouterCtx): string {
  const tagsLine = ctx.conversationTags.length > 0
    ? ctx.conversationTags.join(', ')
    : '(nenhuma)'
  const historyLines = ctx.shortHistory
    .slice(-5)
    .map((m) => `[${m.role}] ${m.content.substring(0, 200)}`)
    .join('\n')
  return [
    `<context>`,
    `Tags atuais: ${tagsLine}`,
    `Última msg lead: ${ctx.lastIncoming.substring(0, 500)}`,
    `Histórico curto:`,
    historyLines || '(vazio)',
    `</context>`,
  ].join('\n')
}

/**
 * Extrai JSON da resposta do LLM. Tolera:
 *   - JSON puro
 *   - JSON envolto em ```json ... ``` (markdown fence)
 *   - Texto extra antes/depois do JSON (busca primeiro { até último } balanceado)
 */
function parseRouterJson(text: string): { intent: string; confidence: number; reason: string } | null {
  if (!text) return null
  // Remove markdown fences
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim()
  // Tenta JSON puro primeiro
  try {
    return JSON.parse(cleaned)
  } catch {
    /* fallthrough */
  }
  // Busca substring entre { e } balanceados (best-effort)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(cleaned.substring(start, end + 1))
  } catch {
    return null
  }
}

function normalizeIntent(raw: unknown): Intent | null {
  if (typeof raw !== 'string') return null
  const norm = raw.toLowerCase().trim()
  return (VALID_INTENTS as readonly string[]).includes(norm) ? (norm as Intent) : null
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Classifica intent da última msg do lead via LLM.
 *
 * Sempre retorna um RouterResult válido — em qualquer falha (LLM exception,
 * parse JSON, intent inválida, confidence baixa) faz fallback determinístico
 * pra `qualificacao` com confidence 0.5 e flag fallback=true.
 *
 * Caller é responsável por:
 *   - Decidir se chama (agent.routing_mode === 'router')
 *   - Inserir row em ai_agent_runs com os campos retornados
 *   - Despachar pro specialist no hop 1
 */
export async function classifyIntent(ctx: RouterCtx): Promise<RouterResult> {
  const startMs = Date.now()
  // Fix Bug 1 (2026-05-23 v7.43.1): gpt-5-nano (reasoning) falha 100% no parse JSON
  // em prod — gera narrativa antes do JSON. Trocado pra gpt-4.1-mini (non-reasoning,
  // latência ~500ms, JSON output confiável). Caller pode override via ctx.routerModel.
  const model = ctx.routerModel || 'gpt-4.1-mini'

  const userMsg = buildRouterUserMessage(ctx)

  try {
    const llmResult = await callLLM({
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
      tools: [],
      temperature: 0.1, // baixa pra classificação determinística
      maxTokens: 150,
      model,
    })

    const parsed = parseRouterJson(llmResult.text)
    if (!parsed) {
      // Fix Bug 1 (2026-05-23): persiste RAW response no log warn pra debug futuro.
      // No fallback retornado, raw vai no campo reason (max 200 chars).
      const rawPreview = (llmResult.text || '').substring(0, 200)
      ctx.log.warn('Router: JSON parse failed, fallback qualificacao', {
        raw_preview: rawPreview,
        model: llmResult.model,
        output_tokens: llmResult.outputTokens,
      })
      return {
        intent: 'qualificacao',
        confidence: 0.5,
        reason: `fallback: JSON parse failed | raw: ${rawPreview.substring(0, 150)}`,
        model: llmResult.model,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
        latencyMs: llmResult.latency_ms,
        fallback: true,
      }
    }

    const intent = normalizeIntent(parsed.intent)
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0
    const reason = typeof parsed.reason === 'string' ? parsed.reason.substring(0, 200) : ''

    if (!intent) {
      ctx.log.warn('Router: intent inválido, fallback qualificacao', {
        raw_intent: parsed.intent,
      })
      return {
        intent: 'qualificacao',
        confidence: 0.5,
        reason: `fallback: intent inválido (${parsed.intent})`,
        model: llmResult.model,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
        latencyMs: llmResult.latency_ms,
        fallback: true,
      }
    }

    // Default seguro: confidence baixa → qualificacao (regra do prompt mas
    // garantida em código também, pois LLM pode ignorar instrução).
    if (confidence < 0.6 && intent !== 'qualificacao') {
      ctx.log.info('Router: confidence < 0.6, override pra qualificacao', {
        original_intent: intent,
        confidence,
      })
      return {
        intent: 'qualificacao',
        confidence,
        reason: `fallback low-confidence (era ${intent}): ${reason}`,
        model: llmResult.model,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
        latencyMs: llmResult.latency_ms,
        fallback: true,
      }
    }

    ctx.log.info('Router classified', { intent, confidence, latency_ms: llmResult.latency_ms })
    return {
      intent,
      confidence,
      reason,
      model: llmResult.model,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      latencyMs: llmResult.latency_ms,
      fallback: false,
    }
  } catch (err) {
    const errMsg = (err as Error).message || 'router error'
    ctx.log.error?.('Router LLM call failed, fallback qualificacao', { error: errMsg })
    return {
      intent: 'qualificacao',
      confidence: 0.5,
      reason: `fallback: ${errMsg.substring(0, 100)}`,
      model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      fallback: true,
    }
  }
}

/**
 * Insere row em ai_agent_runs com o resultado do router (hop 0).
 * Caller passa supabase + ids + turn_id pra agrupar com o specialist (hop 1).
 *
 * NÃO bloqueia o pipeline se INSERT falhar (log e segue) — observabilidade
 * não pode mascarar erro de produção real.
 */
export async function logRouterRun(
  supabase: any,
  params: {
    conversation_id: string
    agent_id: string
    turn_id: string
    result: RouterResult
    promptChars: number
    log: Logger
  },
): Promise<void> {
  try {
    await supabase.from('ai_agent_runs').insert({
      conversation_id: params.conversation_id,
      agent_id: params.agent_id,
      turn_id: params.turn_id,
      hop_n: 0,
      specialist: 'router',
      intent: params.result.intent,
      confidence: params.result.confidence,
      model: params.result.model,
      input_tokens: params.result.inputTokens,
      output_tokens: params.result.outputTokens,
      latency_ms: params.result.latencyMs,
      prompt_chars: params.promptChars,
      metadata: {
        reason: params.result.reason,
        fallback: params.result.fallback,
      },
    })
  } catch (err) {
    params.log.warn('logRouterRun insert failed (non-fatal)', {
      error: (err as Error).message,
    })
  }
}
