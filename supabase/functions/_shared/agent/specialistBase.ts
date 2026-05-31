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
import { buildBusinessSection, type AgentForPrompt } from './promptSections.ts'
import { validateLLMResponse, autoFixHumanizationViolations } from '../responseValidator.ts'
import { countMsgsSinceNameUse } from '../validatorAgent.ts'
import { evaluateProductQualificationFlow } from './productQualificationFlow.ts'
import { readProductQualificationState } from './productQualificationState.ts'
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
  /**
   * Greeting determinístico (boas-vindas + pedido de nome) foi ENVIADO ao lead
   * NESTE MESMO turno, em mensagem separada (index.ts), e a conversa seguiu pro
   * specialist porque o lead trouxe uma pergunta/produto junto. Quando true, o
   * specialist NÃO deve recumprimentar nem repedir o nome (evita double-ask no
   * 1º turno). Default undefined/false = comportamento normal.
   */
  greetingSentThisTurn?: boolean

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
// Backstop de validação (2026-05-26)
// =============================================================================
//
// Causa-raiz do bug "No momento não encontrei a caixa-d'água de 1000 litros":
// quando routing_mode='router', a resposta do specialist era retornada SEM passar
// por nenhum validador (o bloco de validação do monolith em index.ts fica APÓS o
// `return specialistResult.response`). Resultado: frases negativas proibidas
// vazavam pro lead. Aqui religamos o validador determinístico (responseValidator)
// no caminho do router e o promovemos de telemetria → ENFORCEMENT para as 3 regras
// de segurança de texto (negação / erro interno / vazamento de tag interna).
//
// Regras só-cosméticas (echo opener, recumprimento, name overuse, preço) seguem
// telemetria-only aqui — reescrevê-las deterministicamente arriscaria distorcer a
// resposta; o monolith continua tratando-as quando é fallback. O enforcement é
// cirúrgico: substitui o texto SÓ quando ele é nocivo de enviar, preservando o
// handoff que o LLM já tenha disparado no loop.
// SAFE_TEXT_RULES: violações graves que justificam SUBSTITUIR o texto inteiro por
// ponte propositiva segura (preservando handoff). Ex.: negação proibida, erro vazado.
const SAFE_TEXT_RULES = new Set(['anti_negative_phrases', 'anti_stock_confirmation', 'anti_internal_error', 'anti_internal_leak'])
// AUTO_FIX_RULES: violações de humanização (cosméticas/comportamentais) que devem
// ser CIRURGICAMENTE reescritas via autoFixHumanizationViolations (remove a frase
// ofensora, mantém o resto). Ex.: eco do lead, parafraseio de jargão, "anotei".
// Promovidas a block→auto_fix em v7.57.3 (palavra-veneno que delata IA).
const AUTO_FIX_RULES = new Set(['anti_lead_echo', 'anti_jargon_paraphrase', 'anti_anotei'])
// ENFORCED_BLOCK_RULES = união dos 2 (compat com chamadas antigas — toda regra block é tratada).
const ENFORCED_BLOCK_RULES = new Set([...SAFE_TEXT_RULES, ...AUTO_FIX_RULES])

interface SanitizeResult {
  text: string
  enforced: boolean
  rules: string[]
}

/** Extrai os textos das mensagens 'model' (saídas do bot) do histórico Gemini. */
function extractOutgoingTexts(geminiContents: any[]): string[] {
  return (geminiContents || [])
    .filter((c) => c?.role === 'model')
    .map((c) => (c?.parts || []).map((p: any) => p?.text || '').join(' ').trim())
    .filter((t) => t.length > 0)
}

function buildSafeQualificationFallback(ctx: SpecialistCtx): string | null {
  const verdict = getPremiumQualificationVerdict(ctx)
  const field = verdict.nextRequiredField
  if (!field) return null

  const leadName = (ctx.leadProfile?.full_name || '').trim().split(/\s+/)[0] || ''
  const prefix = leadName ? `Prazer, ${leadName}. ` : ''

  if (field.key === 'ambiente_torneira') return `${prefix}A torneira é para cozinha ou área gourmet?`
  if (field.key === 'tipo_torneira') return 'Você pretende instalar na bancada ou na parede?'
  if (field.key === 'modelo_torneira') return 'Você procura o modelo com ducha flexível ou bica alta?'
  if (field.key === 'acabamento_torneira') return 'Qual acabamento você prefere: cromado, preto fosco, dourado ou escovado?'
  if (field.key === 'tipo_cuba') return 'Sua cuba é simples ou dupla?'
  if (field.key === 'perfil') return 'Você procura algo mais sofisticado ou uma opção com melhor custo-benefício?'
  if (field.key === 'aplicacao_revestimento') return `${prefix}Esse revestimento será para piso ou parede?`
  if (field.key === 'ambiente_revestimento') return 'É para sua casa ou para algum ambiente comercial?'
  if (field.key === 'formato') return 'Você já tem alguma medida em mente, como 60x60, 90x90 ou 120x120?'
  if (field.key === 'acabamento') return 'Você prefere acabamento brilhante, acetinado ou fosco?'
  if (field.key === 'cor') return 'Qual tonalidade você imagina para o ambiente?'
  if (field.key === 'local_aplicacao') return 'Vai utilizar em qual ambiente?'
  if (field.key === 'area') return 'Qual a metragem aproximada?'

  return field.examples
    ? `Qual ${field.label}? ${field.examples}.`
    : `Qual ${field.label}?`
}

function getPremiumQualificationVerdict(ctx: SpecialistCtx) {
  const state = readProductQualificationState((ctx.conversation.tags as string[]) || [])
  return evaluateProductQualificationFlow({
    tags: (ctx.conversation.tags as string[]) || [],
    agent: ctx.agent,
    incomingText: ctx.incomingText,
    catalogResult: state.catalogResult,
  })
}

function responseMentionsPremiumField(fieldKey: string, text: string): boolean {
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  switch (fieldKey) {
    case 'ambiente_torneira':
      return /\b(cozinha|area gourmet|gourmet|aplicacao)\b/.test(norm)
    case 'tipo_torneira':
      return /\b(bancada|parede|instalacao|instalar)\b/.test(norm)
    case 'modelo_torneira':
      return /\b(ducha|flexivel|bica alta|modelo)\b/.test(norm)
    case 'acabamento_torneira':
      return /\b(acabamento|cromado|preto fosco|dourado|escovado)\b/.test(norm)
    case 'tipo_cuba':
      return /\b(cuba|simples|dupla)\b/.test(norm)
    case 'perfil':
      return /\b(premium|sofisticad|custo-beneficio|custo beneficio|melhor)\b/.test(norm)
    case 'aplicacao_revestimento':
      return /\b(piso|parede|aplicacao|aplicar)\b/.test(norm)
    case 'ambiente_revestimento':
      return /\b(residencial|comercial|casa|empresa|loja|ambiente)\b/.test(norm)
    case 'formato':
      return /\b(formato|medida|tamanho|60x60|80x80|90x90|120x120)\b/.test(norm)
    case 'acabamento':
      return /\b(acabamento|brilhante|acetinado|fosco|polido)\b/.test(norm)
    case 'cor':
      return /\b(cor|tom|tonalidade|bege|cinza|branco|off)\b/.test(norm)
    case 'local_aplicacao':
      return /\b(ambiente|sala|cozinha|quarto|banheiro|area integrada)\b/.test(norm)
    case 'area':
      return /\b(metragem|metros|m2|area|quantos m)\b/.test(norm)
    default:
      return true
  }
}

function keepLastQuestionWhenStacked(text: string): string {
  const questionCount = (text.match(/\?/g) || []).length
  if (questionCount > 1) {
    const questionSentences = text.match(/[^.!?\n]*\?/g)
      ?.map((part) => part.trim())
      .filter(Boolean)
    if (questionSentences && questionSentences.length > 1) {
      return questionSentences[questionSentences.length - 1]
    }
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return text
  const questionLines = lines.filter((line) => line.includes('?'))
  if (questionLines.length < 2) return text
  return questionLines[questionLines.length - 1]
}

/**
 * Roda o validador determinístico e, se houver violação de segurança (block),
 * substitui o texto por uma ponte propositiva segura — preservando handoff.
 */
function sanitizeSpecialistResponse(
  responseText: string,
  ctx: SpecialistCtx,
): SanitizeResult {
  const text = keepLastQuestionWhenStacked((responseText || '').trim())
  if (text.length < 15) return { text: responseText, enforced: false, rules: [] }

  const leadName = (ctx.leadProfile?.full_name || '').trim() || null
  const outgoing = extractOutgoingTexts(ctx.geminiContents)
  const catalogPrices = ctx.toolCallsLog
    .filter((t) => t.name === 'search_products' && t.result)
    .flatMap((t) => String(t.result).match(/R\$\s*[\d.,]+/g) || [])
  const validatorCtx = {
    messageCount: outgoing.length,
    leadName,
    msgsSinceLastNameUse: countMsgsSinceNameUse(leadName, outgoing.slice(-6).reverse()),
    catalogPrices,
    lastIncomingText: ctx.incomingText || null,
  }

  let result
  try {
    result = validateLLMResponse(text, validatorCtx)
  } catch (e) {
    ctx.log.error?.('sanitizeSpecialistResponse: validateLLMResponse failed (non-fatal)', { error: (e as Error).message })
    return { text: responseText, enforced: false, rules: [] }
  }

  if (result.valid) {
    const premiumVerdict = getPremiumQualificationVerdict(ctx)
    const premiumSafeText = premiumVerdict.nextRequiredField ? buildSafeQualificationFallback(ctx) : null
    const looksPrematureHandoff = /\b(consultor|vendedor|vou verificar|vou passar|encaminh)/i.test(text)
    if (
      premiumSafeText &&
      premiumVerdict.nextRequiredField &&
      (looksPrematureHandoff || (text.includes('?') && !responseMentionsPremiumField(premiumVerdict.nextRequiredField.key, text)))
    ) {
      return { text: premiumSafeText, enforced: true, rules: ['premium_next_question'] }
    }
    const compacted = text !== (responseText || '').trim()
    return { text: compacted ? text : responseText, enforced: compacted, rules: compacted ? ['single_question'] : [] }
  }

  // Telemetria de TODAS as violações (mantém o sinal que existia no monolith).
  ctx.log.warn('responseValidator (router) caught violations', {
    violations: result.violations.map((v) => `${v.rule}:${v.severity}`),
  })

  let currentText = text
  const fixedRules: string[] = []

  // (1) Auto-fix cirúrgico das violações de humanização (anti_lead_echo, anti_jargon_paraphrase, anti_anotei).
  //     Remove fragmento ofensor, mantém o resto. Re-valida pra ver se sobrou algo nocivo.
  const hasAutoFix = result.violations.some((v) => AUTO_FIX_RULES.has(v.rule))
  if (hasAutoFix) {
    try {
      const fix = autoFixHumanizationViolations(currentText, validatorCtx)
      if (fix.fixed.length > 0) {
        currentText = fix.text
        fixedRules.push(...fix.fixed)
        // Re-valida — pode ter sobrado SAFE_TEXT_RULE
        result = validateLLMResponse(currentText, validatorCtx)
      }
    } catch (e) {
      ctx.log.warn?.('autoFixHumanizationViolations failed (non-fatal)', { error: (e as Error).message })
    }
  }

  // (2) Se ainda há violação SAFE_TEXT (negação proibida/erro vazado), substitui texto inteiro.
  const safeTextHarmful = result.violations.filter((v) => v.severity === 'block' && SAFE_TEXT_RULES.has(v.rule))
  if (safeTextHarmful.length > 0) {
    const handoffCalled = ctx.toolCallsLog.some((t) => t.name === 'handoff_to_human')
    const safeText = handoffCalled
      ? 'Vou te conectar com nosso vendedor pra confirmar a melhor opção e o valor pra você. Só um instante! 🙌'
      : 'Deixa eu confirmar essa informação certinho pra você. Você tem preferência de marca ou alguma especificação do produto?'
    const premiumSafeText = handoffCalled ? null : buildSafeQualificationFallback(ctx)
    return { text: premiumSafeText || safeText, enforced: true, rules: [...fixedRules, ...safeTextHarmful.map((v) => v.rule)] }
  }

  // (3) Só houve auto-fix (sem SAFE_TEXT) — retorna o texto reescrito.
  if (fixedRules.length > 0) {
    const premiumSafeText = buildSafeQualificationFallback(ctx)
    if (premiumSafeText && (fixedRules.includes('anti_anotei') || !currentText.includes('?'))) {
      return { text: premiumSafeText, enforced: true, rules: [...fixedRules, 'premium_next_question'] }
    }
    return { text: currentText, enforced: true, rules: fixedRules }
  }

  // (4) Tinha violações mas nenhuma enforced (ex.: só rewrite cosmético sem auto-fix) — passa.
  const compacted = text !== (responseText || '').trim()
  return { text: compacted ? text : responseText, enforced: compacted, rules: compacted ? ['single_question'] : [] }
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
  // Anti double-ask no 1º turno (2026-05-26): quando o greeting determinístico já
  // enviou boas-vindas + pedido de nome NESTE turno (lead abriu com saudação +
  // pergunta), o specialist herdava o pedido de nome do próprio prompt (ex.: greeting
  // specialist linha 42) e PEDIA O NOME DE NOVO → 2 bolhas pedindo nome no mesmo turno.
  // Esta diretiva (determinística, no topo) suprime recumprimento + repedido de nome.
  const greetingDoneDirective = ctx.greetingSentThisTurn
    ? `[JÁ CUMPRIMENTADO NESTE TURNO] As boas-vindas e o pedido do nome JÁ foram enviados ao lead AGORA, nesta mesma conversa, numa mensagem separada (logo acima). NÃO cumprimente de novo (nada de "olá/oi/bem-vindo") e NÃO pergunte o nome outra vez. Vá DIRETO ao ponto: responda o que o lead pediu / faça seu trabalho. Se o lead informou o nome junto, registre com update_lead_profile sem repetir a pergunta.`
    : null
  // P7-strong: anti-repetição determinística do nome (feedback do dono — o LLM
  // citava o nome em toda mensagem). Olha o histórico; suprime se usado há pouco.
  const nameDirective = buildNameUsageDirective(ctx.geminiContents, ctx.leadProfile?.full_name)
  // Paridade router↔monolito (2026-05-29): injeta as Informações da Empresa
  // (endereço/horário/pagamento/entrega) + a REGRA ABSOLUTA anti-alucinação no prompt
  // de TODO specialist. Sem isto, sob o router o specialist não sabia onde fica a loja
  // e o LLM confirmava a suposição errada do lead (ex.: "essa loja é em São João?" →
  // "sim", quando a loja é em Garanhuns). O monolito (index.ts) já injetava via
  // buildBusinessSection; os specialists não recebiam — gap fechado aqui.
  const businessSection = buildBusinessSection(ctx.agent as AgentForPrompt)
  // Ordem: [memória do lead] → [já cumprimentado] → [prompt do specialist] →
  // [info da empresa] → [uso do nome] → [pré-busca]. A pré-busca vai por último (mais
  // perto da decisão) pra o product specialist tratá-la como verdade-base "search já
  // feito" e compor em 1 round.
  const systemPrompt = [memoryBlock, greetingDoneDirective, basePrompt, businessSection, nameDirective, ctx.preSearchContext]
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
    leadFirstName: (ctx.leadProfile?.full_name || '').trim().split(/\s+/)[0] || undefined,
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

  // Step 3.5: backstop de validação (router não passava por validador nenhum).
  // Substitui texto nocivo (negação/erro-interno/leak) por ponte segura.
  const sanitized = sanitizeSpecialistResponse(llmLoopResult.responseText, ctx)
  const responseText = sanitized.text
  if (sanitized.enforced) {
    ctx.log.warn(`${def.name}_specialist: response SANITIZED by validator backstop`, {
      rules: sanitized.rules,
      original_preview: (llmLoopResult.responseText || '').substring(0, 160),
    })
    try {
      await ctx.supabase.from('ai_agent_logs').insert({
        agent_id: ctx.agent_id,
        conversation_id: ctx.conversation_id,
        event: 'response_sanitized',
        metadata: {
          source: `${def.name}_specialist`,
          rules: sanitized.rules,
          original_text: (llmLoopResult.responseText || '').substring(0, 500),
          sanitized_text: responseText,
        },
      })
    } catch { /* observability — non-fatal */ }
  }

  // Step 4a: shadow mode → NÃO despacha (monolith responde o lead). Só logamos.
  if (ctx.shadow) {
    ctx.log.info(`${def.name}_specialist SHADOW — response computed, not sent`, {
      response_preview: (responseText || '').substring(0, 120),
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

  // Digest da conversa pro resumo do vendedor (fallback quando tags esparsas):
  // mapeia geminiContents (role/parts) → {direction, content} cronológico.
  const digestMessages = (ctx.geminiContents || []).map((c: any) => ({
    direction: c?.role === 'model' ? 'outgoing' : 'incoming',
    content: (c?.parts || []).map((p: any) => p?.text || '').join(' ').trim(),
  }))

  // Step 4b: dispatchResponse (reusa Sprint B5 Onda 5)
  const { response } = await dispatchResponse({
    responseText,
    digestMessages,
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
