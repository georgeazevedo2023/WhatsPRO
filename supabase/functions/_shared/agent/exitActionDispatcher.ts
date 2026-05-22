/**
 * Sprint B5 Onda 2c-ii — Despacho de exit actions pré-LLM.
 *
 * Depois do `runPreLLMAutoExtract` setar `pendingExitActionHandoff` ou
 * `pendingExitActionSearch`, este módulo executa o efeito colateral:
 *
 *   - `dispatchExitActionHandoff` (Bug 24): dispara queue assignment +
 *     sendTextMsg + DB writes + broadcastEvent → retorna Response pra caller
 *     fazer early return. Substitui o trecho "Bug 24: exit_action=handoff via
 *     auto-extract — disparando" do ai-agent/index.ts.
 *
 *   - `runInlineSearchProducts` (R121 inline): chama search_products via
 *     callback `executeToolSafe`, registra log + toolCallsLog, retorna string
 *     pra injetar no prompt como `[INTERNO]`. Substitui o trecho
 *     "R121: executando search_products INLINE via auto-extract".
 *
 * Callbacks injetados via ctx (runQueueAssignment, sendTextMsg, broadcastEvent,
 * executeToolSafe, pickHandoffMessage) — o caller mantém as closures locais.
 */

import { mergeTags } from '../agentHelpers.ts'
import { isOutsideBusinessHours } from '../businessHours.ts'
import { STATUS_IA } from '../constants.ts'
import type { Logger } from './context.ts'
import type {
  PendingExitActionHandoff,
  PendingExitActionSearch,
} from './preLLMAutoExtract.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export type SendTextFn = (text: string) => Promise<unknown>
export type BroadcastEventFn = (evt: {
  conversation_id: string
  inbox_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  media_type: string
  message_id?: string | null
  created_at?: string
}) => void
export type ExecuteToolFn = (name: string, args: Record<string, any>) => Promise<string>
export type RunQueueAssignmentFn = (
  handoffMessageTemplate: string,
) => Promise<{ result: Record<string, any>; finalMessage: string }>
export type PickHandoffMessageFn = (opts: {
  agent: any
  profileData?: any | null
  funnelData?: any | null
  outsideHours: boolean
  fallbackRegular?: string
  fallbackOutside?: string
}) => string

export interface DispatchExitActionHandoffCtx {
  supabase: any
  conversation: {
    id?: string
    inbox_id?: string | null
    tags?: string[] | null
    status_ia?: string | null
  } & Record<string, any>
  conversation_id: string
  agent_id: string
  agent: any
  profileData: any | null | undefined
  funnelData: any | null | undefined
  startTime: number
  corsHeaders: Record<string, string>
  sendTextMsg: SendTextFn
  broadcastEvent: BroadcastEventFn
  runQueueAssignment: RunQueueAssignmentFn
  pickHandoffMessage: PickHandoffMessageFn
}

export interface DispatchExitActionHandoffResult {
  dispatched: boolean
  response: Response | null
}

export interface RunInlineSearchCtx {
  supabase: any
  conversation: { status_ia?: string | null } & Record<string, any>
  conversation_id: string
  agent_id: string
  executeToolSafe: ExecuteToolFn
}

export interface RunInlineSearchResult {
  inlineSearchContext: string
  toolCall: { name: string; args: Record<string, any>; result: string } | null
}

// =============================================================================
// dispatchExitActionHandoff — Bug 24
// =============================================================================

/**
 * Quando `pendingExitActionHandoff` está setado (auto-extract atingiu max_score
 * + exit_action=handoff), dispara o caminho de handoff completo:
 *   - resolve outsideHours + handoff message
 *   - runQueueAssignment (atribui vendedor ou enfileira)
 *   - sendTextMsg + insert conversation_messages + broadcast
 *   - update conversation (status_ia=SHADOW, lead_msg_count=0, dept opcional)
 *   - log implicit_handoff
 *   - retorna Response 200 pra caller fazer return
 *
 * Se conversation.status_ia já é SHADOW, NÃO dispara (return dispatched=false).
 */
export async function dispatchExitActionHandoff(
  ctx: DispatchExitActionHandoffCtx,
  pendingExit: PendingExitActionHandoff,
  log: Logger,
): Promise<DispatchExitActionHandoffResult> {
  if (ctx.conversation.status_ia === STATUS_IA.SHADOW) {
    return { dispatched: false, response: null }
  }

  log.info('Bug 24: exit_action=handoff via auto-extract — disparando', pendingExit as any)

  const notifyOutsideEA = ctx.agent.notify_outside_hours_on_handoff !== false
  const outsideHoursEA =
    notifyOutsideEA && isOutsideBusinessHours(ctx.agent.business_hours, ctx.agent.extended_hours_until)
  const handoffMsgEA = ctx.pickHandoffMessage({
    agent: ctx.agent,
    profileData: ctx.profileData,
    funnelData: ctx.funnelData,
    outsideHours: outsideHoursEA,
  })
  const { result: queueResEA, finalMessage: finalMsgEA } = await ctx.runQueueAssignment(handoffMsgEA)

  await ctx.sendTextMsg(finalMsgEA)
  await ctx.supabase.from('conversation_messages').insert({
    conversation_id: ctx.conversation_id,
    direction: 'outgoing',
    content: finalMsgEA,
    media_type: 'text',
  })

  const eaUpdates: Record<string, unknown> = {
    status_ia: STATUS_IA.SHADOW,
    tags: mergeTags(ctx.conversation.tags || [], { ia: STATUS_IA.SHADOW }),
    lead_msg_count: 0,
  }
  if (ctx.profileData?.handoff_department_id) {
    eaUpdates.department_id = ctx.profileData.handoff_department_id
  } else if (ctx.funnelData?.handoff_department_id) {
    eaUpdates.department_id = ctx.funnelData.handoff_department_id
  }
  await ctx.supabase.from('conversations').update(eaUpdates).eq('id', ctx.conversation_id)
  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'implicit_handoff',
    latency_ms: Date.now() - ctx.startTime,
    metadata: {
      reason: 'exit_action_auto_extract',
      exit_reason: pendingExit.reason,
      outside_hours: outsideHoursEA,
      queue: queueResEA,
    },
  })

  ctx.broadcastEvent({
    conversation_id: ctx.conversation_id,
    inbox_id: ctx.conversation.inbox_id ?? null,
    direction: 'outgoing',
    content: finalMsgEA,
    media_type: 'text',
  })

  return {
    dispatched: true,
    response: new Response(
      JSON.stringify({ ok: true, handoff: true, reason: 'exit_action_auto_extract', queue: queueResEA }),
      { headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } },
    ),
  }
}

// =============================================================================
// runInlineSearchProducts — R121 inline
// =============================================================================

/**
 * Quando `pendingExitActionSearch` está setado (categoria digital + R121
 * trigger ou C2 fallback), executa search_products INLINE via callback
 * `executeToolSafe`. Resultado vai pro prompt como `[INTERNO]` pra LLM não
 * chamar de novo.
 *
 * Se conversation.status_ia=SHADOW, retorna context vazio.
 * Erros são logados como warnings — não propagam.
 */
export async function runInlineSearchProducts(
  ctx: RunInlineSearchCtx,
  pendingSearch: PendingExitActionSearch,
  log: Logger,
): Promise<RunInlineSearchResult> {
  if (ctx.conversation.status_ia === STATUS_IA.SHADOW) {
    return { inlineSearchContext: '', toolCall: null }
  }

  try {
    log.info('R121: executando search_products INLINE via auto-extract', pendingSearch as any)
    const searchRes = await ctx.executeToolSafe('search_products', {
      query: pendingSearch.query,
      category: pendingSearch.category,
    })
    await ctx.supabase.from('ai_agent_logs').insert({
      agent_id: ctx.agent_id,
      conversation_id: ctx.conversation_id,
      event: 'tool_called',
      metadata: {
        tool: 'search_products',
        source: 'r121_auto_extract_inline',
        query: pendingSearch.query,
        category: pendingSearch.category,
        result_preview: String(searchRes).substring(0, 200),
      },
    })
    const resultStr = String(searchRes).substring(0, 200)
    const inlineSearchContext = `\n\n[INTERNO — search_products JA foi chamado pelo backend antes do seu turno. NAO chame de novo nesta resposta.]\nQuery: ${pendingSearch.query}\nResultado:\n${searchRes}\n\nUse esses resultados para responder ao lead. Se 0 produtos retornados E catalog_status=offline na categoria, mostre interesse e pergunte fields restantes (NAO diga "nao temos").`
    return {
      inlineSearchContext,
      toolCall: { name: 'search_products', args: pendingSearch as any, result: resultStr },
    }
  } catch (err) {
    log.error?.('R121 inline search failed (non-fatal)', { error: (err as Error).message })
    return { inlineSearchContext: '', toolCall: null }
  }
}
