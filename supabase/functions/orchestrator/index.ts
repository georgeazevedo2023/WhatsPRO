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
import { validateResponse, trackMetrics } from './services/index.ts'
import type { OrchestratorInput, ActiveFlowState, SubagentResult, FlowContext } from './types.ts'

const supabase = createServiceClient()

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // ── Fase 1-5: Resolve fluxo ativo ────────────────────────────────────────
    const isLeadCreated = input.message_type === 'lead_created'
    const resolved = await resolveFlow(
      input.instance_id,
      leadId,
      input.message_text ?? '',
      isLeadCreated,
    )

    if (!resolved) {
      console.log('[orchestrator] No flow resolved for instance:', input.instance_id)
      return jsonResponse({ ok: true, skipped: 'no_flow' }, 200, corsHeaders)
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

    // ── Monta contexto (S5: injeta memória aqui) ──────────────────────────────
    const context = await buildContext(input, state)

    if (!context) {
      console.error('[orchestrator] Failed to build context for state:', state.id)
      return jsonResponse({ error: 'Context build failed' }, 500, corsHeaders)
    }

    // ── Despacha subagente (S2: todos são stubs) ──────────────────────────────
    const result: SubagentResult = await dispatchSubagent(context)

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

    // ── Envia resposta ao lead via UAZAPI (S5+) ───────────────────────────────
    if (result.response_text && context) {
      const validation = await validateResponse(result.response_text, context)
      if (validation.passed) {
        await sendToLead(input.instance_id, context.lead.lead_jid, result.response_text)
      } else {
        console.warn('[orchestrator] validator rejected response:', validation.issues)
      }
    }

    // ── Log do evento ─────────────────────────────────────────────────────────
    await logFlowEvent(
      state.id,
      resolved.flowId,                  // Fix: flow_id NOT NULL
      input.instance_id,                // Fix: instance_id NOT NULL
      leadId,
      'tool_called',                    // Fix: era 'subagent_called' (não está no CHECK)
      { status: result.status, has_response: !!result.response_text },
      state.flow_step_id,               // Fix: era current_step_id
    )

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

    // ── Métricas (S9) ─────────────────────────────────────────────────────────
    await trackMetrics(resolved.flowId, 'message_processed')

    return jsonResponse(
      {
        ok: true,
        flow_id: resolved.flowId,
        state_id: state.id,
        subagent_status: result.status,
        message_sent: !!result.response_text,
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
