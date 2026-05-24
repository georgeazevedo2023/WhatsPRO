/**
 * Sprint D (2026-05-24) — specialistBase: contrato único pra todos os specialists.
 *
 * Extraído de productSpecialist.ts (Sprint C4). Antes cada specialist replicava
 * ~140 linhas de boilerplate (LLM loop → log ai_agent_runs → dispatchResponse).
 * Agora cada specialist é só { name, intent, model, buildPrompt, toolDefs } e
 * delega o pipeline pra runSpecialist().
 *
 * Pesquisa 2026 (Anthropic multi-agent, OpenAI Agents SDK, MAST arXiv:2503.13657):
 *   - Cada subagente precisa de objetivo + formato + tools + BOUNDARY explícito
 *     (Anthropic mediu -40% no tempo de tarefa com boundaries claros).
 *   - Inter-agent misalignment = 36.9% das falhas (MAST) → boundaries não-sobrepostos.
 *   - Passar contexto COMPLETO ao specialist (Cognition: faminto-de-contexto = falha #1).
 *     Por isso geminiContents inteiro vai pra cada specialist (system prompt curto,
 *     histórico completo).
 *
 * Pipeline (idêntico ao que productSpecialist fazia):
 *   1. buildPrompt(ctx) → system prompt enxuto (<8 KB)
 *   2. runLlmCallLoop (compartilhado) — function-calling com retry/backoff
 *   3. log hop_n em ai_agent_runs (specialist=def.name, intent=def.intent)
 *   4. se errorResponse (3× falha LLM) → propaga pro caller fazer fallback monolith
 *   5. dispatchResponse (compartilhado) — envia + insert + broadcast + Response 200
 */

import { runLlmCallLoop, type ToolCallLogEntry, type ExecuteToolSafeFn, type SendPresenceFn } from './llmCallLoop.ts'
import { dispatchResponse, type SendTextMsgFn, type SendTtsFn, type BroadcastEventFn, type PickHandoffMessageFn, type RunQueueAssignmentFn } from './dispatchResponse.ts'
import { buildLeadMemoryBlock, consolidateLeadMemory } from './leadMemory.ts'
import { buildNameUsageDirective } from './greetingPolicy.ts'
import type { LLMToolDef } from '../llmProvider.ts'
import type { Logger } from './context.ts'
import type { Intent } from './router.ts'

// =============================================================================
// Contexto compartilhado por TODOS os specialists
// =============================================================================

export interface SpecialistCtx {
  /** turn_id gerado upstream pra agrupar hops do mesmo turno em ai_agent_runs */
  turn_id: string

  // Core data (compartilhado com monolith)
  agent: Record<string, any>
  agent_id: string
  conversation: { tags?: string[] | null; inbox_id?: string | null; status_ia?: string | null } & Record<string, any>
  conversation_id: string
  contact: { id: string } & Record<string, any>

  /** categorias do agent já carregadas upstream (product/qualification usam) */
  serviceCategories: any[]

  // LLM context
  geminiContents: any[] // histórico completo já formatado pelo upstream
  incomingText: string
  toolCallsLog: ToolCallLogEntry[] // ref mutável compartilhada
  executeToolSafe: ExecuteToolSafeFn

  // Lead / profile / funnel
  profileData: any
  funnelData: any
  leadProfile: any

  // Incoming / queue
  incomingHasAudio: boolean
  queuedMessages: any[]

  // Deferred handoff (compat dispatchResponse)
  pendingHandoffTrigger: string | null
  pendingHandoffTriggerMsg: string

  // Callbacks (reusados do monolith)
  sendTextMsg: SendTextMsgFn
  sendTts: SendTtsFn
  sendPresence: SendPresenceFn
  broadcastEvent: BroadcastEventFn
  pickHandoffMessage: PickHandoffMessageFn
  runQueueAssignment: RunQueueAssignmentFn

  // Flags
  hasInteracted: boolean
  /** já interagiu ALGUMA vez (qualquer data) — p/ classificar lead recorrente */
  hasEverInteracted: boolean

  // Misc
  startTime: number
  supabase: any
  log: Logger
  corsHeaders: Record<string, string>

  /**
   * Shadow mode (Sprint D): quando true, o specialist roda o LLM e loga em
   * ai_agent_runs, mas NÃO chama dispatchResponse (não envia ao lead). O monolith
   * responde o lead. Serve pra coletar regressão silenciosa em tráfego real.
   */
  shadow?: boolean

  /**
   * Latência (2026-05-24): resultado de uma busca de produto JÁ executada
   * deterministicamente ANTES do specialist (pré-LLM, mesma máquina R121/R137
   * do monolith). Quando presente, vai no FIM do system prompt como bloco
   * [INTERNO] e o product specialist responde em UM round (não precisa do round
   * "decidir chamar search_products"). Isso reverte a regressão de latência
   * (8-10s → ~4-5s) introduzida quando o pré-search foi desligado sob router.
   * O carrossel já foi enviado pela pré-busca; a flag carouselSentInThisCall
   * (compartilhada via executeToolSafe) garante idempotência se o LLM insistir
   * em buscar de novo. Vazio = comportamento anterior (specialist decide buscar).
   */
  preSearchContext?: string
}

/**
 * Definição estática de um specialist. Um objeto por specialist; o que muda
 * entre eles é só prompt + tools + boundary + modelo.
 */
export interface SpecialistDef {
  /** nome curto pro ai_agent_runs ('product'|'greeting'|'qualification'|'objection'|'handoff') */
  name: string
  /** intent do router que dispara este specialist (vai no log) */
  intent: Intent
  /** modelo LLM (default gpt-4.1 — bench Sprint C escolheu full size non-reasoning) */
  model: string
  /** tool defs em strict mode (subset mínimo pro job deste specialist) */
  toolDefs: LLMToolDef[]
  /** monta o system prompt a partir do contexto */
  buildPrompt: (ctx: SpecialistCtx) => string
  /**
   * Desabilita handoffGuard no LLM loop. handoffGuard protege o MONOLITH de
   * handoff prematuro pós-search_fail. Specialists que controlam o fechamento
   * via prompt (product/objection/handoff) passam true. greeting/qualification
   * que nunca chamam handoff_to_human deixam false (irrelevante — sem a tool).
   */
  disableHandoffGuard?: boolean
}

export interface SpecialistResult {
  /** Response 200 pronta pro caller propagar. NULL em shadow mode. */
  response: Response | null
  inputTokens: number
  outputTokens: number
  promptChars: number
  /**
   * Quando o LLM loop falha 3× (502), propaga aqui pro caller fazer fallback
   * pro monolith (recomendado) em vez de matar o turno. NULL = sucesso.
   */
  errorResponse: Response | null
  errorMessage?: string
  /** intent classificada (eco do def.intent) — debug */
  intent: Intent
  /** nome do specialist (eco do def.name) — debug */
  specialist: string
}

// =============================================================================
// Pipeline compartilhado
// =============================================================================

/**
 * Roda o pipeline de UM specialist: prompt → LLM loop → log → dispatch.
 *
 * Reusa 100% de runLlmCallLoop + dispatchResponse (Sprint B5). O único valor
 * que cada specialist adiciona é o def (prompt curto + tools mínimas + boundary).
 *
 * @param hopN número do hop (1 normalmente; router é hop 0).
 */
export async function runSpecialist(
  ctx: SpecialistCtx,
  def: SpecialistDef,
  hopN = 1,
): Promise<SpecialistResult> {
  // Sprint E.1: prepend memória longa do lead (fatos estruturados de lead_profiles).
  // Vazio pra lead novo. Vai no TOPO do system prompt (posição = verdade-base) pra
  // o specialist CONTINUAR de onde parou (reconhece returning lead, não re-pergunta).
  const memoryBlock = buildLeadMemoryBlock(ctx.leadProfile)

  // NOTA (decisão A, 2026-05-24): a SAUDAÇÃO/reconhecimento do 1º contato é feita de
  // forma DETERMINÍSTICA no index.ts (bloco greeting, religado pro router) — confiável,
  // cita a loja e pede o nome SEMPRE. Tentamos injetar uma "diretiva de abertura" aqui
  // no prompt do specialist, mas (a) o product specialist ignorava o cumprimento (fluxo
  // de tool dominava) e (b) a regra de "registrar nome além de responder" fazia o LLM
  // responder DUPLICADO. Por isso o specialist NÃO recebe diretiva de abertura — fica
  // com seu prompt limpo. A captura de nome mid-conversa (P5) será tratada de forma
  // determinística num follow-up (não via instrução solta no prompt). classifyLeadRecency
  // segue sendo a fonte única usada pelo bloco determinístico do monolith/router.
  const basePrompt = def.buildPrompt(ctx)
  // P7-strong: anti-repetição determinística do nome (feedback do dono — o LLM
  // citava o nome em toda mensagem). Olha o histórico; suprime se usado há pouco.
  const nameDirective = buildNameUsageDirective(ctx.geminiContents, ctx.leadProfile?.full_name)
  // Ordem: [memória do lead] → [prompt do specialist] → [uso do nome] → [pré-busca].
  // A pré-busca vai por último (mais perto da decisão) pra o product specialist
  // tratá-la como verdade-base "search já feito" e compor em 1 round.
  const systemPrompt = [memoryBlock, basePrompt, nameDirective, ctx.preSearchContext]
    .filter(Boolean)
    .join('\n\n')
  const promptChars = systemPrompt.length
  const toolDefs = def.toolDefs

  ctx.log.info(`${def.name}_specialist starting`, {
    turn_id: ctx.turn_id,
    intent: def.intent,
    prompt_chars: promptChars,
    model: def.model,
    tools_count: toolDefs.length,
    has_memory: !!memoryBlock,
    has_presearch: !!ctx.preSearchContext,
    shadow: !!ctx.shadow,
  })

  // Step 1: LLM call loop (reusa Sprint B5 Onda 4)
  const llmLoopResult = await runLlmCallLoop({
    agent: ctx.agent,
    llmModel: def.model,
    systemPrompt,
    toolDefs,
    geminiContents: ctx.geminiContents,
    toolCallsLog: ctx.toolCallsLog,
    executeToolSafe: ctx.executeToolSafe,
    conversation: ctx.conversation,
    hasInteracted: ctx.hasInteracted,
    sendPresence: ctx.sendPresence,
    log: ctx.log,
    supabase: ctx.supabase,
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    startTime: ctx.startTime,
    corsHeaders: ctx.corsHeaders,
    disableHandoffGuard: def.disableHandoffGuard,
  })

  // Step 2: log hop em ai_agent_runs (não bloqueia em falha)
  try {
    await ctx.supabase.from('ai_agent_runs').insert({
      conversation_id: ctx.conversation_id,
      agent_id: ctx.agent_id,
      turn_id: ctx.turn_id,
      hop_n: hopN,
      specialist: def.name,
      intent: def.intent,
      model: llmLoopResult.usedModel,
      input_tokens: llmLoopResult.inputTokens,
      output_tokens: llmLoopResult.outputTokens,
      latency_ms: Date.now() - ctx.startTime,
      tools_called: ctx.toolCallsLog.length > 0 ? ctx.toolCallsLog : null,
      prompt_chars: promptChars,
      metadata: {
        error_response: !!llmLoopResult.errorResponse,
        error_message: llmLoopResult.errorResponse ? 'LLM 3x failure (see ai_agent_logs)' : null,
        shadow: !!ctx.shadow,
      },
    })
  } catch (err) {
    ctx.log.warn?.(`ai_agent_runs hop ${hopN} insert failed (non-fatal)`, { error: (err as Error).message })
  }

  // Step 3: erro catastrófico do LLM → propaga (caller faz fallback)
  if (llmLoopResult.errorResponse) {
    ctx.log.warn?.(`${def.name}_specialist: LLM loop errorResponse — caller should fallback to monolith`, {
      input_tokens: llmLoopResult.inputTokens,
      output_tokens: llmLoopResult.outputTokens,
    })
    return {
      response: llmLoopResult.errorResponse,
      inputTokens: llmLoopResult.inputTokens,
      outputTokens: llmLoopResult.outputTokens,
      promptChars,
      errorResponse: llmLoopResult.errorResponse,
      errorMessage: 'LLM loop 3x failure',
      intent: def.intent,
      specialist: def.name,
    }
  }

  // Step 4a: shadow mode → NÃO despacha (monolith responde o lead). Só logamos.
  if (ctx.shadow) {
    ctx.log.info(`${def.name}_specialist SHADOW — response computed, not sent`, {
      response_preview: (llmLoopResult.responseText || '').substring(0, 120),
      tools: ctx.toolCallsLog.map((t) => t.name),
    })
    return {
      response: null,
      inputTokens: llmLoopResult.inputTokens,
      outputTokens: llmLoopResult.outputTokens,
      promptChars,
      errorResponse: null,
      intent: def.intent,
      specialist: def.name,
    }
  }

  // Step 4b: dispatchResponse (reusa Sprint B5 Onda 5)
  const { response } = await dispatchResponse({
    responseText: llmLoopResult.responseText,
    agent: ctx.agent,
    agent_id: ctx.agent_id,
    conversation: ctx.conversation,
    conversation_id: ctx.conversation_id,
    contact: ctx.contact,
    toolCallsLog: ctx.toolCallsLog,
    inputTokens: llmLoopResult.inputTokens,
    outputTokens: llmLoopResult.outputTokens,
    usedModel: llmLoopResult.usedModel,
    hadExplicitHandoffInLoop: ctx.toolCallsLog.some((t) => t.name === 'handoff_to_human'),
    profileData: ctx.profileData,
    funnelData: ctx.funnelData,
    leadProfile: ctx.leadProfile,
    incomingText: ctx.incomingText,
    incomingHasAudio: ctx.incomingHasAudio,
    queuedMessages: ctx.queuedMessages,
    pendingHandoffTrigger: ctx.pendingHandoffTrigger,
    pendingHandoffTriggerMsg: ctx.pendingHandoffTriggerMsg,
    startTime: ctx.startTime,
    sendTextMsg: ctx.sendTextMsg,
    sendTts: ctx.sendTts,
    sendPresence: ctx.sendPresence,
    broadcastEvent: ctx.broadcastEvent,
    pickHandoffMessage: ctx.pickHandoffMessage,
    runQueueAssignment: ctx.runQueueAssignment,
    supabase: ctx.supabase,
    log: ctx.log,
    corsHeaders: ctx.corsHeaders,
  })

  // Sprint E.1: consolida memória do lead (estágio + produtos vistos) APÓS o envio.
  // Fire-and-forget — a resposta já foi enviada no dispatchResponse; não bloqueamos
  // o retorno do turno. Só fatos verificados do toolCallsLog real.
  if (ctx.contact?.id) {
    void consolidateLeadMemory({
      supabase: ctx.supabase,
      contactId: ctx.contact.id,
      currentTags: (ctx.conversation.tags as string[]) || [],
      toolCallsLog: ctx.toolCallsLog,
      existingProductsSeen: ctx.leadProfile?.products_seen,
      existingInterests: ctx.leadProfile?.interests,
      log: ctx.log,
    }).catch(() => { /* já tratado internamente */ })
  }

  return {
    response,
    inputTokens: llmLoopResult.inputTokens,
    outputTokens: llmLoopResult.outputTokens,
    promptChars,
    errorResponse: null,
    intent: def.intent,
    specialist: def.name,
  }
}
