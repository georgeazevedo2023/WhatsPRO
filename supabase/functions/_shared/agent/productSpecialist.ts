/**
 * Sprint C4 (2026-05-23) — product_specialist
 *
 * Primeiro specialist do orquestrador. Roda quando router classifica intent='produto'.
 *
 * Pipeline:
 *   1. Monta prompt enxuto (~3 KB): persona + task + rules + tools strict + catálogo + facts
 *   2. Filtra toolDefs pra apenas as 5 tools de produto (strict mode)
 *   3. Delega pra `runLlmCallLoop` (compartilhado com monolith) — função-calling com retry/backoff/handoff guard
 *   4. Delega pra `dispatchResponse` (compartilhado) — envia msg + insert + broadcast + lead_profile + Response 200
 *   5. Insere row em `ai_agent_runs` com specialist='product', hop_n=1, intent='produto'
 *
 * Reusa 100% da infra extraída em Sprint B5. O ganho real é o PROMPT — sai de 45 KB
 * (monolito) pra ~3 KB compacto focado em produto.
 *
 * Tools permitidas (strict): search_products, send_carousel, send_media,
 * set_tags, update_lead_profile.
 *
 * NUNCA chama handoff_to_human diretamente — escala via router/monolith se necessário.
 */

import { runLlmCallLoop, type ToolCallLogEntry, type ExecuteToolSafeFn, type SendPresenceFn } from './llmCallLoop.ts'
import { dispatchResponse, type SendTextMsgFn, type SendTtsFn, type BroadcastEventFn, type PickHandoffMessageFn, type RunQueueAssignmentFn } from './dispatchResponse.ts'
import type { LLMToolDef } from '../llmProvider.ts'
import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface ProductSpecialistCtx {
  /** turn_id gerado upstream pra agrupar hops do mesmo turno em ai_agent_runs */
  turn_id: string

  // Core data (compartilhado com monolith)
  agent: Record<string, any>
  agent_id: string
  conversation: { tags?: string[] | null; inbox_id?: string | null; status_ia?: string | null } & Record<string, any>
  conversation_id: string
  contact: { id: string } & Record<string, any>

  // Categories e service info
  serviceCategories: any[] // array de categorias do agent (já carregadas upstream)

  // LLM context
  geminiContents: any[] // histórico já agrupado/formatado pelo upstream
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

  // Deferred handoff (compatibilidade c/ dispatchResponse)
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

  // Misc
  startTime: number
  supabase: any
  log: Logger
  corsHeaders: Record<string, string>

  /** Modelo do specialist (default: gpt-5-mini — reasoning, structured outputs nativos) */
  specialistModel?: string
}

export interface ProductSpecialistResult {
  /** Response 200 pronta pro caller propagar */
  response: Response
  /** Inputs/outputs reais (debug/dashboard C7) */
  inputTokens: number
  outputTokens: number
  promptChars: number
}

// =============================================================================
// Prompt builder — compacto (~3 KB target)
// =============================================================================

/**
 * Monta system prompt do product_specialist. Alvo: <3.5 KB ao final.
 *
 * Componentes:
 *   - persona + task
 *   - 7 rules essenciais (search_products primeiro, categoria offline = handoff, etc.)
 *   - tools list nominal
 *   - catalog summary: lista compacta de categorias com flag digital/offline
 *   - facts collected: tags humanizadas (ambiente, cor, voltagem, etc.)
 */
export function buildProductSpecialistPrompt(args: {
  agentName: string
  serviceCategories: any[]
  collectedTags: string[]
  businessInfo?: any
}): string {
  const { agentName, serviceCategories, collectedTags, businessInfo } = args

  const categorySummary = (serviceCategories || [])
    .slice(0, 30)
    .map((c: any) => {
      const status = c.catalog_status === 'offline' ? ' [OFFLINE]' : c.catalog_status === 'none' ? ' [SEM CAT]' : ''
      return `- ${c.id || c.name || 'unknown'}${status}`
    })
    .join('\n') || '(sem categorias configuradas)'

  // Tags humanizadas: tira tags internas (ia:*, lead_score:*, multi_interesse_pending) e formata por tipo
  const internalKeys = new Set(['ia', 'lead_score', 'multi_interesse_pending', 'qualif_horizontal', 'search_fail', 'ia_cleared'])
  const factsCollected = (collectedTags || [])
    .filter((t) => {
      const [key] = t.split(':')
      return !internalKeys.has(key)
    })
    .slice(0, 20)
    .join(', ') || '(nenhum fato coletado ainda)'

  const businessLine = businessInfo
    ? typeof businessInfo === 'string'
      ? businessInfo.substring(0, 300)
      : JSON.stringify(businessInfo).substring(0, 300)
    : '(não cadastrado)'

  return `<persona>Você é ${agentName || 'consultor de vendas'}, especialista em PRODUTO. Atende leads via WhatsApp.</persona>

<task>Lead pediu um produto. Sua função: buscar no catálogo e enviar a melhor opção. NÃO faça small talk.</task>

<rules>
1. SEMPRE chame search_products PRIMEIRO antes de opinar sobre qualquer produto.
2. Categoria marcada [OFFLINE] no catálogo → NÃO busque; responda informando que esse produto é atendido sob consulta e marque set_tags(interesse:CATEGORIA).
3. 1 produto encontrado com foto → use send_media (foto + preço). 2+ produtos → use send_carousel.
4. Marca específica mencionada pelo lead → chame search_products IMEDIATAMENTE com query incluindo a marca.
5. Após search com 0 resultados → faça UMA pergunta de qualificação (ambiente/cor/marca) usando set_tags pra registrar.
6. NUNCA diga "não temos" — sempre ofereça alternativa ou escale via set_tags(escalada_humano:1).
7. Máximo 2 perguntas de qualificação antes de oferecer produto. Se lead já respondeu 2× sem casar, retorne resposta vazia (orquestrador decide handoff).
</rules>

<tools_available>
- search_products(query, category): busca catálogo. Sempre com expectedCategory derivada do interesse:* tag.
- send_carousel(product_ids): 2+ produtos com foto.
- send_media(product_id): 1 produto.
- set_tags(tags): registra interesse, ambiente, cor, marca etc.
- update_lead_profile(notes): nome confirmado, objections.
</tools_available>

<catalog_summary>
${categorySummary}
</catalog_summary>

<facts_collected>
${factsCollected}
</facts_collected>

<business_info>${businessLine}</business_info>`
}

// =============================================================================
// Tool definitions — strict mode (5 tools apenas)
// =============================================================================

export function getProductSpecialistToolDefs(): LLMToolDef[] {
  return [
    {
      name: 'search_products',
      description: 'Busca produtos no catálogo do agente. Use SEMPRE primeiro antes de descrever produto.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca (marca, tipo, palavras-chave)' },
          category: { type: ['string', 'null'], description: 'Categoria esperada (id da service_categories)' },
        },
        required: ['query', 'category'],
      },
    },
    {
      name: 'send_carousel',
      description: 'Envia 2+ produtos como carrossel com fotos e botões.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          product_ids: { type: 'array', items: { type: 'string' }, description: 'Lista de títulos exatos (max 10)' },
        },
        required: ['product_ids'],
      },
    },
    {
      name: 'send_media',
      description: 'Envia 1 produto como foto+legenda.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          media_url: { type: 'string', description: 'URL da imagem do produto' },
          caption: { type: 'string', description: 'Legenda com nome + preço + descrição curta' },
        },
        required: ['media_url', 'caption'],
      },
    },
    {
      name: 'set_tags',
      description: 'Registra fatos qualificados do lead (interesse, ambiente, cor, marca, etc.)',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          tags: {
            type: 'object',
            description: 'Mapa chave:valor. Ex: { "interesse": "tintas", "cor": "branco" }',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['tags'],
      },
    },
    {
      name: 'update_lead_profile',
      description: 'Atualiza perfil do lead (nome confirmado, objeções, contexto).',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'], description: 'Nome do lead confirmado' },
          objections: { type: ['array', 'null'], items: { type: 'string' }, description: 'Objeções coletadas' },
          notes: { type: ['string', 'null'], description: 'Anotações livres' },
        },
        required: ['name', 'objections', 'notes'],
      },
    },
  ]
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Roda o pipeline do product_specialist: prompt enxuto → LLM loop → dispatch.
 *
 * Insere row em `ai_agent_runs` (hop_n=1, specialist='product') no final.
 *
 * Em caso de errorResponse do llmCallLoop (3 falhas LLM), propaga a Response 502.
 * Em caso de empty response, ainda chama dispatchResponse (que loga empty_response).
 */
export async function runProductSpecialist(ctx: ProductSpecialistCtx): Promise<ProductSpecialistResult> {
  const specialistModel = ctx.specialistModel || 'gpt-5-mini'
  const systemPrompt = buildProductSpecialistPrompt({
    agentName: (ctx.agent.name as string) || 'consultor',
    serviceCategories: ctx.serviceCategories,
    collectedTags: (ctx.conversation.tags as string[]) || [],
    businessInfo: ctx.agent.business_info,
  })
  const promptChars = systemPrompt.length
  const toolDefs = getProductSpecialistToolDefs()

  ctx.log.info('Product specialist starting', {
    turn_id: ctx.turn_id,
    prompt_chars: promptChars,
    model: specialistModel,
    tools_count: toolDefs.length,
  })

  // Step 1: LLM call loop (reusa pipeline do Sprint B5 Onda 4)
  const llmLoopResult = await runLlmCallLoop({
    agent: ctx.agent,
    llmModel: specialistModel,
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
  })

  // Step 2: log hop_n=1 em ai_agent_runs (não bloqueia em falha)
  try {
    await ctx.supabase.from('ai_agent_runs').insert({
      conversation_id: ctx.conversation_id,
      agent_id: ctx.agent_id,
      turn_id: ctx.turn_id,
      hop_n: 1,
      specialist: 'product',
      intent: 'produto',
      model: llmLoopResult.usedModel,
      input_tokens: llmLoopResult.inputTokens,
      output_tokens: llmLoopResult.outputTokens,
      latency_ms: Date.now() - ctx.startTime,
      tools_called: ctx.toolCallsLog.length > 0 ? ctx.toolCallsLog : null,
      prompt_chars: promptChars,
      metadata: {
        error_response: !!llmLoopResult.errorResponse,
      },
    })
  } catch (err) {
    ctx.log.warn?.('ai_agent_runs hop 1 insert failed (non-fatal)', { error: (err as Error).message })
  }

  // Step 3: se LLM falhou catastroficamente, propaga
  if (llmLoopResult.errorResponse) {
    return {
      response: llmLoopResult.errorResponse,
      inputTokens: llmLoopResult.inputTokens,
      outputTokens: llmLoopResult.outputTokens,
      promptChars,
    }
  }

  // Step 4: dispatchResponse (reusa pipeline do Sprint B5 Onda 5)
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

  return {
    response,
    inputTokens: llmLoopResult.inputTokens,
    outputTokens: llmLoopResult.outputTokens,
    promptChars,
  }
}
