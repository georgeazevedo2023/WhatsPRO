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
  /**
   * Bug 4 fix (2026-05-23 v7.43.2): quando LLM loop falha 3× (errorResponse 502),
   * propaga aqui pro caller decidir se faz fallback pro monolith (recomendado)
   * ou retorna 502 ao webhook. NULL = sucesso.
   */
  errorResponse: Response | null
  /** Mensagem de erro do LLM (debug) quando errorResponse não é null */
  errorMessage?: string
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

  // Prompt v5 (v7.43.11) — bench 50/50 (v3) + refinamento de upsell/pedido completo.
  // v7.43.8: removido priorToolsCalled (era remendo). Fix de raiz: R121 inline
  // desabilitado quando routing_mode=router. Specialist é único caminho de search.
  // v7.43.11 (Bug 9 UX): regra 3 (offline) refinada — qualifica brevemente + pergunta
  // "mais algum item?" ANTES de encaminhar. Nova regra 8: monte PEDIDO COMPLETO antes
  // do handoff (não escale item a item — junte tudo num pedido só pro vendedor).
  return `Você é ${agentName || 'consultor de vendas'}, especialista em produto. Atende leads via WhatsApp em português brasileiro.

OBJETIVO: ajudar o lead a montar um PEDIDO COMPLETO (um ou vários itens) e só então passar pro vendedor com tudo detalhado. Texto curto e direto (1-2 frases, tom WhatsApp).

REGRA UNIVERSAL: toda chamada de tool vem acompanhada de uma frase de texto pro lead no MESMO turno. NUNCA chame tool sem texto. NUNCA repita a mesma tool 2 vezes em turnos consecutivos.

FLUXO POR SITUAÇÃO:

1. Marca específica do catálogo mencionada → chame search_products com a marca + "Vou ver as opções..."

2. Pergunta vaga sem marca em categoria ONLINE → chame search_products com categoria + "Vou buscar pra você..."

3. Categoria [OFFLINE] no catálogo → NÃO busque. Antes de escalar, COLETE info útil pro vendedor: faça 1 pergunta de qualificação rápida do item (tamanho/tipo/modelo/material conforme o item — ex.: trena "de quantos metros?", fechadura "interna ou externa?"). Registre com set_tags. NÃO encaminhe ainda — siga pra regra 8.

4. Marca FORA do catálogo → NÃO busque. set_tags(["interesse:CATEGORIA"]) + "Não trabalhamos com [marca]. Temos [marcas do catálogo] com qualidade equivalente. Qual prefere?"

5. Lead pediu múltiplos produtos → search_products do PRIMEIRO + "Encontrei essas opções de [primeiro]. Depois te mostro [segundo]."

6. Search retornou produtos (carrossel JÁ ENVIADO) → próximo turno: APENAS texto convidando a clicar "Eu quero!". NÃO chame tool.

7. Search 0 resultados → APENAS texto oferecendo alternativa. NÃO repita o search.

8. PEDIDO COMPLETO antes do handoff: sempre que o lead escolher um item OU adicionar outro, pergunte "Quer adicionar mais algum item ao pedido ou prefere que eu já passe pro vendedor?". Mantenha o pedido aberto até o lead confirmar que terminou.

9. FECHAMENTO: quando o lead confirmar que o pedido está completo ("é só isso", "pode finalizar", "só isso mesmo") OU pedir explicitamente um vendedor → chame handoff_to_human com o reason contendo o RESUMO COMPLETO do pedido (todos os itens + quantidades + qualificações). Escreva tb uma frase curta confirmando ao lead que vai passar pro vendedor.

REGRA DE CONTEXTO: leia o histórico. Se o lead JÁ escolheu produto(s), novos itens são ADIÇÕES ao mesmo pedido — trate como upsell, mantenha o pedido aberto até o lead dizer que terminou.

NUNCA diga "não temos" sem oferecer alternativa.
NUNCA encaminhe pro vendedor item a item — junte tudo num pedido só. handoff_to_human só quando lead confirmar pedido completo OU pedir explicitamente vendedor.

CATÁLOGO:
${categorySummary}

FATOS JÁ COLETADOS: ${factsCollected}

NEGÓCIO: ${businessLine}`
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
      // Bug 4 real fix (v7.43.3): schema alinhado com monolith (index.ts:1741).
      // Antes usava map object com `additionalProperties: { type: 'string' }`, que
      // viola OpenAI strict mode (precisa ser `false`) E divergia do handler real
      // (que espera string[] formato "chave:valor", não map). Causava OpenAI 400 →
      // fallback Gemini → Gemini 400 → errorResponse 502 (observado prod 14:59 + 15:18).
      name: 'set_tags',
      description: 'Adiciona tags à conversa para rastrear interesses e fatos qualificados. Tags são cumulativas. Formato: "chave:valor" (ex: "interesse:tintas", "ambiente:interno", "cor:branco").',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            description: 'Tags no formato "chave:valor"',
            items: { type: 'string' },
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
    {
      // Bug 11 fix (v7.43.13): specialist é dono do fluxo de venda completo, incluindo
      // o fechamento. handoff_to_human escala pro vendedor humano com o pedido montado.
      // O executeToolSafe (index.ts) já processa esta tool (fila/departamento/fora-horário).
      // Antes era removida (escala via monolith) — mas isso gerava "Em que posso ajudar?"
      // genérico quando o lead confirmava o pedido. Agora o specialist fecha o ciclo.
      name: 'handoff_to_human',
      description: 'Encaminha o lead pro vendedor humano. Use quando: (1) lead confirmou que o pedido está completo, (2) lead pediu explicitamente um vendedor, ou (3) item sob consulta exige especialista. SEMPRE inclua no reason um resumo do pedido (todos os itens + qualificações).',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo + resumo completo do pedido (itens escolhidos, quantidades, qualificações coletadas)' },
        },
        required: ['reason'],
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
  // Decisão de modelo v7.43.6 (validada em bench real 5 cenários × 5 modelos):
  //   gpt-4.1-mini:  50/50 lat 1.9s, custo ~$10.50/mês — descartado a pedido (qualidade humana 8/10)
  //   gpt-4.1 ✅:    50/50 lat 2.1s, custo ~$53/mês — ESCOLHIDO: qualidade humana 10/10
  //   gpt-5.4:       50/50 lat 2.5s, custo ~$84/mês — markdown problemático no WhatsApp
  //   gpt-5.5:       50/50 lat 3.0s, custo ~$167/mês — overkill, às vezes omite CTA
  //   gpt-5-mini:    50/50 lat 11.2s, custo ~$32/mês — reasoning queima budget
  // gpt-4.1 (full size, non-reasoning): score 10/10 técnico + 10/10 redação natural.
  // Latência empata com mini (2.1s vs 1.9s), tom WhatsApp mais natural ("Veja as opções
  // que encontrei!" vs "Achei algumas tintas..."). Sem reasoning desperdiçado.
  const specialistModel = ctx.specialistModel || 'gpt-4.1'
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
  // v7.43.8: removido maxTokens override (era remendo pra reasoning models que
  // nem usamos mais). gpt-4.1 é non-reasoning, não precisa de override.
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
    // Bug 12 (v7.43.13): specialist controla fechamento via prompt regra 9 (só escala
    // após pedido completo). handoffGuard era proteção do monolith e bloqueava o
    // handoff legítimo de pedido multi-turn (busca foi turno anterior).
    disableHandoffGuard: true,
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
        // Bug 4 fix visibility (v7.43.2): pega último erro real do ai_agent_logs
        // pra dashboard C7 + debug sem precisar parsear logs externos.
        error_message: llmLoopResult.errorResponse ? 'LLM 3x failure (see ai_agent_logs)' : null,
      },
    })
  } catch (err) {
    ctx.log.warn?.('ai_agent_runs hop 1 insert failed (non-fatal)', { error: (err as Error).message })
  }

  // Step 3: se LLM falhou catastroficamente, propaga (caller decide fallback)
  if (llmLoopResult.errorResponse) {
    ctx.log.warn?.('Product specialist: LLM loop returned errorResponse — caller should fallback to monolith', {
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
    }
  }

  // v7.43.8: removido fallback contextual (era remendo). Com gpt-4.1 + prompt v3,
  // response sempre vem com texto válido. Se vier vazio, é um bug de raiz que
  // precisa ser corrigido na origem, não mascarado com texto pré-fabricado.

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
    errorResponse: null,
  }
}
