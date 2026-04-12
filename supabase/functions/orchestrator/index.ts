// =============================================================================
// Orchestrator — Entry Point (S4)
// Recebe OrchestratorInput do whatsapp-webhook e orquestra:
//   resolveFlow → createFlowState → buildContext → dispatchSubagent
//   → apply result → log event → respond
//
// S2: skeleton funcional — processa mensagem mas NÃO envia resposta ao lead.
//     Todos os subagentes retornam stub (status: 'continue', sem response_text).
//     Critério de conclusão S2: toggle USE_ORCHESTRATOR sem afetar mensagens.
//
// Fluxo completo (S5+): resolveFlow → memory → context → subagent →
//                        validator → send message → metrics → shadow
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { fetchWithTimeout, fetchFireAndForget } from '../_shared/fetchWithTimeout.ts'
import { resolveFlow } from './config/flowResolver.ts'
import { buildContext, fetchFirstStep } from './config/contextBuilder.ts'
import {
  createFlowState,
  updateFlowState,
  finalizeFlowState,
  logFlowEvent,
  applySubagentResult,
} from './config/stateManager.ts'
import { dispatchSubagent } from './subagents/index.ts'
import { validateResponse, detectIntents, createTimer } from './services/index.ts'
import type { OrchestratorInput, ActiveFlowState, SubagentResult, FlowContext, IntentDetectorResult } from './types.ts'

const supabase = createServiceClient()

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const timer = createTimer()
    const input = (await req.json()) as OrchestratorInput

    // Validação mínima do input
    if (!input.conversation_id || !input.instance_id) {
      return jsonResponse({ error: 'Missing conversation_id or instance_id' }, 400, corsHeaders)
    }

    // Busca lead_id via conversation
    const leadId = await resolveLeadId(input.conversation_id, input.instance_id)
    if (!leadId) {
      console.warn('[orchestrator] Lead not found for conversation:', input.conversation_id)
      return jsonResponse({ ok: true, skipped: 'no_lead' }, 200, corsHeaders)
    }

    // ── S7: Detecta intents ANTES de resolver fluxo ─────────────────────────
    const intents = await detectIntents(input.message_text ?? '')
    timer.mark('intent')
    console.log(
      '[orchestrator] intents:',
      intents.primary?.intent ?? 'none',
      `(${intents.primary?.confidence ?? 0}, L${intents.primary?.layer ?? 0})`,
      `${intents.processing_time_ms}ms`,
      intents.bypass ? `BYPASS:${intents.bypass}` : '',
    )

    // ── S7: Bypass — intents que exigem ação imediata ────────────────────────
    if (intents.bypass === 'cancelamento') {
      // LGPD opt-out: tag + finaliza fluxo ativo (se houver) + não responde
      const { data: activeState } = await supabase
        .from('flow_states')
        .select('id, flow_id')
        .eq('lead_id', leadId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (activeState) {
        await finalizeFlowState(activeState.id, 'abandoned')
        await logFlowEvent(activeState.id, activeState.flow_id, input.instance_id, leadId,
          'flow_completed', { reason: 'optout_lgpd', intent: 'cancelamento' })
      }

      // Aplica tags de opt-out na conversa (mesmo padrão do ai-agent: tagMap merge)
      const { data: conv } = await supabase
        .from('conversations')
        .select('tags')
        .eq('id', input.conversation_id)
        .maybeSingle()
      const existingTags: string[] = (conv?.tags as string[]) ?? []
      const tagMap = new Map<string, string>()
      for (const t of existingTags) tagMap.set(t.split(':')[0], t)
      tagMap.set('optout', 'optout:lgpd')
      tagMap.set('motivo', 'motivo:cancelamento')
      await supabase.from('conversations')
        .update({ tags: Array.from(tagMap.values()) })
        .eq('id', input.conversation_id)

      console.log('[orchestrator] BYPASS cancelamento — opt-out LGPD para lead:', leadId)
      return jsonResponse({ ok: true, bypass: 'cancelamento', lead_id: leadId }, 200, corsHeaders)
    }

    // ── Fase 1-5: Resolve fluxo ativo ────────────────────────────────────────
    const isLeadCreated = input.message_type === 'lead_created'
    const resolved = await resolveFlow(
      input.instance_id,
      leadId,
      input.message_text ?? '',
      isLeadCreated,
      intents,                      // S7: passa intents para trigger matching
    )

    timer.mark('resolve')

    if (!resolved) {
      console.log('[orchestrator] No flow resolved for instance:', input.instance_id)
      return jsonResponse({
        ok: true,
        skipped: 'no_flow',
        intent: intents.primary?.intent ?? null,
        intent_confidence: intents.primary?.confidence ?? 0,
        intent_layer: intents.primary?.layer ?? 0,
        intent_bypass: intents.bypass ?? null,
        intent_ms: intents.processing_time_ms,
      }, 200, corsHeaders)
    }

    // ── S9: Busca mode do flow (shadow gate) ──────────────────────────────────
    const { data: flowData } = await supabase
      .from('flows')
      .select('mode')
      .eq('id', resolved.flowId)
      .maybeSingle()
    const flowMode = (flowData?.mode as string) ?? 'active'
    const isShadow = flowMode === 'shadow'
    if (isShadow) {
      console.log('[orchestrator] SHADOW MODE — IA não responde ao lead')
    }

    // ── Obtém ou cria flow_state ──────────────────────────────────────────────
    let state: ActiveFlowState | null = resolved.state

    if (!state) {
      // Lead não tinha fluxo ativo → cria novo estado
      const firstStep = await fetchFirstStep(resolved.flowId)

      const { data: flow } = await supabase
        .from('flows')
        .select('version')
        .eq('id', resolved.flowId)
        .maybeSingle()

      state = await createFlowState(
        leadId,
        resolved.flowId,
        input.instance_id,              // Fix: instance_id NOT NULL
        flow?.version ?? 1,
        firstStep?.id ?? null,
        input.conversation_id,          // opcional
      )

      if (!state) {
        console.error('[orchestrator] Failed to create flow_state')
        return jsonResponse({ error: 'State creation failed' }, 500, corsHeaders)
      }

      await logFlowEvent(
        state.id,
        resolved.flowId,                // Fix: flow_id NOT NULL
        input.instance_id,              // Fix: instance_id NOT NULL
        leadId,
        'flow_started',
        { trigger: 'new_conversation' },
        state.flow_step_id,             // Fix: era current_step_id
      )
    }

    // ── Monta contexto (S5: memória, S7: intents) ──────────────────────────────
    const context = await buildContext(input, state, intents)

    timer.mark('context')

    if (!context) {
      console.error('[orchestrator] Failed to build context for state:', state.id)
      return jsonResponse({ error: 'Context build failed' }, 500, corsHeaders)
    }

    // ── Despacha subagente ────────────────────────────────────────────────────
    const result: SubagentResult = await dispatchSubagent(context)
    timer.mark('subagent')

    // ── Aplica resultado no state ─────────────────────────────────────────────
    await applySubagentResult(state, result)

    // ── Aplica lead_profile_patch (ex: full_name coletado pelo greeting) ──────
    if (result.lead_profile_patch && Object.keys(result.lead_profile_patch).length > 0) {
      const { error: patchErr } = await supabase
        .from('lead_profiles')
        .update(result.lead_profile_patch)
        .eq('id', leadId)
      if (patchErr) {
        console.error('[orchestrator] lead_profile_patch error:', patchErr.message)
      }
    }

    // ── S9: Valida resposta antes de enviar ──────────────────────────────────
    let validatorBlocked = false
    if (result.response_text && context) {
      const validation = await validateResponse(result.response_text, context)
      timer.mark('validator')

      if (!validation.passed) {
        validatorBlocked = true
        console.warn('[validator] BLOCKED:', validation.issues.map(i => i.check).join(', '))

        // Log validator_flagged event
        await logFlowEvent(state.id, resolved.flowId, input.instance_id, leadId,
          'validator_flagged',
          { issues: validation.issues, original_text: result.response_text.slice(0, 200) },
          state.flow_step_id,
        )

        // Track falhas consecutivas → auto handoff em 3
        const failures = ((state.step_data as Record<string, unknown>)?.validator_failures as number ?? 0) + 1
        await updateFlowState(state.id, { step_data_patch: { validator_failures: failures } })
        if (failures >= 3) {
          await finalizeFlowState(state.id, 'handoff')
          await logFlowEvent(state.id, resolved.flowId, input.instance_id, leadId,
            'handoff_triggered', { reason: 'validator_3_failures', failures }, state.flow_step_id)
        }
      } else if (!isShadow) {
        // Envia ao lead (usa corrected_text se disponível)
        const textToSend = validation.corrected_text ?? result.response_text
        await sendToLead(input.instance_id, context.lead.lead_jid, textToSend)

        // Salva last_response para check no_repetition na próxima msg
        await updateFlowState(state.id, { step_data_patch: { last_response: textToSend, validator_failures: 0 } })
      }
      // Shadow mode: validator roda mas NÃO envia
    } else {
      timer.mark('validator')
    }

    // ── S8: Envia media/carousel (bloqueado em shadow mode) ──────────────────
    if (result.media && context && !isShadow && !validatorBlocked) {
      await handleMediaSend(input, context, result)
    }
    timer.mark('send')

    // ── Aplica tags na conversa (se subagente pediu) ─────────────────────────
    if (result.tags_to_set?.length && input.conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('tags')
        .eq('id', input.conversation_id)
        .maybeSingle()
      const existingTags: string[] = (conv?.tags as string[]) ?? []
      const tagMap = new Map<string, string>()
      for (const t of existingTags) tagMap.set(t.split(':')[0], t)
      for (const t of result.tags_to_set) tagMap.set(t.split(':')[0], t)
      await supabase.from('conversations')
        .update({ tags: Array.from(tagMap.values()) })
        .eq('id', input.conversation_id)
    }

    // ── Processa status do subagente ──────────────────────────────────────────
    switch (result.status) {
      case 'advance': {
        // S4: avança para próximo step via next_step logic
        await handleAdvance(state, result, resolved.flowId, input.instance_id, leadId)
        break
      }
      case 'handoff': {
        await finalizeFlowState(state.id, 'handoff')
        await logFlowEvent(
          state.id,
          resolved.flowId,
          input.instance_id,
          leadId,
          'handoff_triggered',
          { exit_rule: result.exit_rule_triggered },
          state.flow_step_id,
        )
        break
      }
      case 'complete': {
        await finalizeFlowState(state.id, 'completed')
        await logFlowEvent(
          state.id,
          resolved.flowId,
          input.instance_id,
          leadId,
          'flow_completed',
          {},
        )
        break
      }
      case 'error': {
        console.error('[orchestrator] Subagent error:', result.error)
        await logFlowEvent(
          state.id,
          resolved.flowId,
          input.instance_id,
          leadId,
          'error',
          { message: result.error ?? 'unknown' },
        )
        break
      }
      case 'continue':
      default:
        // Permanece no step atual
        break
    }

    // ── S9: Finaliza métricas e loga com timing/cost ────────────────────────
    const { timing, cost } = timer.finalize(
      intents.primary?.layer ?? 0,
      0,    // TODO: acumular llm_tokens dos subagentes
      0,    // TODO: acumular llm_cost dos subagentes
    )

    // ── S9: Log do evento com timing + cost ─────────────────────────────────
    await logFlowEvent(
      state.id,
      resolved.flowId,
      input.instance_id,
      leadId,
      'tool_called',
      { status: result.status, has_response: !!result.response_text, shadow: isShadow },
      state.flow_step_id,
      timing,
      cost,
    )

    console.log(`[orchestrator] timing: ${timing.total_ms}ms (intent:${timing.intent_ms} resolve:${timing.resolve_ms} ctx:${timing.context_ms} sub:${timing.subagent_ms} val:${timing.validator_ms} send:${timing.send_ms})`)

    return jsonResponse(
      {
        ok: true,
        flow_id: resolved.flowId,
        state_id: state.id,
        subagent_status: result.status,
        message_sent: !!result.response_text && !isShadow && !validatorBlocked,
        shadow: isShadow,
        intent: intents.primary?.intent ?? null,
        intent_confidence: intents.primary?.confidence ?? 0,
        intent_layer: intents.primary?.layer ?? 0,
        intent_bypass: intents.bypass ?? null,
        timing_ms: timing.total_ms,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('[orchestrator] Unhandled error:', err)
    return jsonResponse({ error: 'Internal error' }, 500, corsHeaders)
  }
})

// ── Advance: avança lead para o próximo step ─────────────────────────────────
// Busca o próximo step pelo position > current → atualiza flow_step_id.
// Se não existe próximo step → fluxo concluído.

async function handleAdvance(
  state: ActiveFlowState,
  result: SubagentResult,
  flowId: string,
  instanceId: string,
  leadId: string,
): Promise<void> {
  if (!result.exit_rule_triggered) return

  const action = result.exit_rule_triggered.action
  const exitTrigger = result.exit_rule_triggered.trigger

  // Handoff actions
  if (action === 'handoff_human' || action === 'handoff_department' || action === 'handoff_manager') {
    await finalizeFlowState(state.id, 'handoff')
    await logFlowEvent(state.id, flowId, instanceId, leadId, 'handoff_triggered',
      { action, exit_rule: exitTrigger, exit_message: result.exit_rule_triggered.message },
      state.flow_step_id,
    )
    return
  }

  // Completar e fechar
  if (action === 'tag_and_close') {
    await finalizeFlowState(state.id, 'completed')
    await logFlowEvent(state.id, flowId, instanceId, leadId, 'flow_completed',
      { action, tags: result.tags_to_set },
    )
    return
  }

  // do_nothing — permanece no step
  if (action === 'do_nothing') return

  // next_step — avança para o próximo step pelo position
  if (action === 'next_step') {
    await logFlowEvent(state.id, flowId, instanceId, leadId, 'step_exited',
      { action, exit_rule: exitTrigger }, state.flow_step_id,
    )

    const nextStep = await fetchNextStep(flowId, state.flow_step_id)

    if (nextStep) {
      // Avança para o próximo step
      await updateFlowState(state.id, {
        flow_step_id: nextStep.id,
        completed_steps_append: state.flow_step_id ?? undefined,
        step_data_patch: { message_count: 0 },  // reseta contador do step
      })
      await logFlowEvent(state.id, flowId, instanceId, leadId, 'step_entered',
        { step_type: nextStep.subagent_type, position: nextStep.position }, nextStep.id,
      )
    } else {
      // Não existe próximo step → fluxo concluído
      await updateFlowState(state.id, {
        completed_steps_append: state.flow_step_id ?? undefined,
      })
      await finalizeFlowState(state.id, 'completed')
      await logFlowEvent(state.id, flowId, instanceId, leadId, 'flow_completed',
        { reason: 'no_next_step' },
      )
    }
    return
  }

  // another_flow → S10+  |  followup → S10+
  // Por ora: loga e ignora
  await logFlowEvent(state.id, flowId, instanceId, leadId, 'step_exited',
    { action, exit_rule: exitTrigger, note: 'action_not_implemented_yet' }, state.flow_step_id,
  )
}

// ── Busca o próximo step do fluxo por posição ─────────────────────────────────

async function fetchNextStep(
  flowId: string,
  currentStepId: string | null,
): Promise<{ id: string; subagent_type: string; position: number } | null> {
  // Descobre a posição do step atual
  let currentPosition = -1

  if (currentStepId) {
    const { data: current } = await supabase
      .from('flow_steps')
      .select('position')
      .eq('id', currentStepId)
      .maybeSingle()
    currentPosition = current?.position ?? -1
  }

  // Busca o próximo step ativo com position > currentPosition
  const { data: next } = await supabase
    .from('flow_steps')
    .select('id, subagent_type, position')
    .eq('flow_id', flowId)
    .eq('is_active', true)
    .gt('position', currentPosition)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  return next ?? null
}

// ── Resolve lead_id (lead_profiles.id) a partir de conversation_id ───────────
// Schema real:
//   conversations.contact_id → contacts.id
//   conversations.inbox_id   → inboxes.id (inboxes.instance_id = instância)
//   lead_profiles.contact_id → contacts.id
//   flow_states.lead_id      → lead_profiles.id

async function resolveLeadId(conversationId: string, instanceId: string): Promise<string | null> {
  // Passo 1: busca contact_id + inbox da conversa
  const { data: conv } = await supabase
    .from('conversations')
    .select('contact_id, inbox_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.contact_id || !conv?.inbox_id) return null

  // Passo 2: valida que o inbox pertence à instância correta
  const { data: inbox } = await supabase
    .from('inboxes')
    .select('instance_id')
    .eq('id', conv.inbox_id)
    .maybeSingle()

  if (!inbox || inbox.instance_id !== instanceId) {
    console.warn('[orchestrator] Inbox não pertence à instância:', instanceId)
    return null
  }

  // Passo 3: busca lead_profile.id pelo contact_id
  const { data: profile } = await supabase
    .from('lead_profiles')
    .select('id')
    .eq('contact_id', conv.contact_id)
    .maybeSingle()

  return profile?.id ?? null
}

// ── Envia mensagem de texto ao lead via UAZAPI ────────────────────────────────
// Busca o token da instância e faz POST em /send/text.
// Silencia erros (best-effort) — não propaga para não quebrar o fluxo.

async function sendToLead(
  instanceId: string,
  leadJid: string,
  text: string,
): Promise<void> {
  if (!leadJid) {
    console.warn('[orchestrator] sendToLead: leadJid vazio — mensagem não enviada')
    return
  }

  // Busca token da instância
  const { data: instance } = await supabase
    .from('instances')
    .select('token')
    .eq('id', instanceId)
    .maybeSingle()

  if (!instance?.token) {
    console.error('[orchestrator] sendToLead: token da instância não encontrado:', instanceId)
    return
  }

  const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'
  const delay = Math.min(5000, Math.max(1000, text.length * 40))  // typing delay como ai-agent

  try {
    const res = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instance.token },
      body: JSON.stringify({ number: leadJid, text, delay }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[orchestrator] sendToLead UAZAPI error:', res.status, body)
    } else {
      console.log('[orchestrator] sendToLead OK:', leadJid, '|', text.slice(0, 40))
    }
  } catch (err) {
    console.error('[orchestrator] sendToLead fetch error:', err)
  }
}

// ── S8: Broadcast para Realtime (helpdesk exibe media/carousel) ──────────────

function broadcastEvent(payload: Record<string, unknown>): void {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  for (const topic of ['helpdesk-realtime', 'helpdesk-conversations']) {
    fetchFireAndForget(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic, event: 'new-message', payload }] }),
    })
  }
}

// ── S8: Resolve instance token + inbox_id para media sends ──────────────────

async function resolveInstanceAndInbox(
  instanceId: string,
  conversationId: string | null,
): Promise<{ token: string; inboxId: string | null } | null> {
  const { data: instance } = await supabase
    .from('instances')
    .select('token')
    .eq('id', instanceId)
    .maybeSingle()

  if (!instance?.token) {
    console.error('[orchestrator] media: token not found:', instanceId)
    return null
  }

  let inboxId: string | null = null
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('inbox_id')
      .eq('id', conversationId)
      .maybeSingle()
    inboxId = conv?.inbox_id ?? null
  }

  return { token: instance.token, inboxId }
}

// ── S8: Envia imagem via UAZAPI /send/media ─────────────────────────────────

async function sendMediaToLead(
  token: string,
  leadJid: string,
  imageUrl: string,
  caption: string,
): Promise<boolean> {
  const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'

  try {
    const res = await fetchWithTimeout(`${uazapiUrl}/send/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number: leadJid, media: imageUrl, type: 'image', text: caption }),
    }, 10000)

    if (!res.ok) {
      const body = await res.text()
      console.error('[orchestrator] sendMedia UAZAPI error:', res.status, body)
      return false
    }
    console.log('[orchestrator] sendMedia OK:', leadJid)
    return true
  } catch (err) {
    console.error('[orchestrator] sendMedia fetch error:', err)
    return false
  }
}

// ── S8: Envia carousel via UAZAPI /send/carousel ────────────────────────────
// 4 variantes de payload para compatibilidade com UAZAPI (mesmo padrão do ai-agent)

async function sendCarouselToLead(
  token: string,
  leadJid: string,
  message: string,
  carousel: unknown[],
): Promise<boolean> {
  const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'
  const rawNum = leadJid.replace('@s.whatsapp.net', '')

  const variants = [
    { phone: leadJid, message, carousel },
    { number: leadJid, text: message, carousel },
    { phone: rawNum, message, carousel },
    { number: rawNum, text: message, carousel },
  ]

  for (const payload of variants) {
    try {
      const res = await fetchWithTimeout(`${uazapiUrl}/send/carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify(payload),
      }, 10000)

      if (res.ok) {
        const body = await res.text()
        if (!body.toLowerCase().includes('missing')) {
          console.log('[orchestrator] sendCarousel OK:', leadJid)
          return true
        }
      }
    } catch { /* try next variant */ }
  }

  console.error('[orchestrator] sendCarousel ALL variants failed:', leadJid)
  return false
}

// ── S10: Envia poll via UAZAPI /send/menu (type: poll) ──────────────────────

async function sendPollToLead(
  token: string,
  leadJid: string,
  text: string,
  choices: string[],
): Promise<boolean> {
  const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') ?? 'https://wsmart.uazapi.com'

  try {
    const res = await fetchWithTimeout(`${uazapiUrl}/send/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number: leadJid, text, choices, type: 'poll' }),
    }, 10000)

    if (!res.ok) {
      const body = await res.text()
      console.error('[orchestrator] sendPoll UAZAPI error:', res.status, body)
      return false
    }
    console.log('[orchestrator] sendPoll OK:', leadJid)
    return true
  } catch (err) {
    console.error('[orchestrator] sendPoll fetch error:', err)
    return false
  }
}

// ── S8/S10: Handler central de media do subagente ───────────────────────────

async function handleMediaSend(
  input: OrchestratorInput,
  context: FlowContext,
  result: SubagentResult,
): Promise<void> {
  const media = result.media!
  const conversationId = input.conversation_id
  const leadJid = context.lead.lead_jid

  if (!leadJid) {
    console.warn('[orchestrator] handleMediaSend: leadJid vazio')
    return
  }

  const resolved = await resolveInstanceAndInbox(input.instance_id, conversationId)
  if (!resolved) return

  const { token, inboxId } = resolved
  let sent = false
  let mediaType = ''
  let mediaUrl = ''
  let msgContent = ''

  if (media.type === 'image' && media.url) {
    sent = await sendMediaToLead(token, leadJid, media.url, media.caption ?? '')
    mediaType = 'image'
    mediaUrl = media.url
    msgContent = media.caption ?? ''
  } else if (media.type === 'carousel' && media.cards?.length) {
    const message = media.caption ?? ''
    const carouselPayload = media.cards.map(c => ({
      body: c.body,
      ...(c.imageUrl ? { image: { url: c.imageUrl } } : {}),
      ...(c.buttons?.length ? { buttons: c.buttons } : {}),
    }))
    sent = await sendCarouselToLead(token, leadJid, message, carouselPayload)
    mediaType = 'carousel'
    mediaUrl = JSON.stringify({ message, cards: carouselPayload })
    msgContent = message
  } else if (media.type === 'poll' && media.poll_options?.length) {
    const question = media.caption ?? ''
    sent = await sendPollToLead(token, leadJid, question, media.poll_options)
    mediaType = 'poll'
    mediaUrl = JSON.stringify({ question, options: media.poll_options })
    msgContent = question
  }

  // INSERT conversation_messages + broadcastEvent (mesmo padrão do ai-agent)
  if (sent && conversationId) {
    await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      direction: 'outgoing',
      content: msgContent,
      media_type: mediaType,
      media_url: mediaUrl,
      external_id: `ai_${mediaType}_${Date.now()}`,
    })

    broadcastEvent({
      conversation_id: conversationId,
      inbox_id: inboxId,
      direction: 'outgoing',
      content: msgContent,
      media_type: mediaType,
      media_url: mediaUrl,
    })
  }
}

// ── Helper de resposta JSON ───────────────────────────────────────────────────

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
