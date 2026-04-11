// =============================================================================
// Orchestrator — Entry Point (S2 skeleton)
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
import { resolveFlow, getActiveFlowState } from './config/flowResolver.ts'
import { buildContext, fetchFirstStep } from './config/contextBuilder.ts'
import {
  createFlowState,
  updateFlowState,
  finalizeFlowState,
  logFlowEvent,
  applySubagentResult,
} from './config/stateManager.ts'
import { dispatchSubagent } from './subagents/index.ts'
import { loadMemory, validateResponse, trackMetrics } from './services/index.ts'
import type { OrchestratorInput, ActiveFlowState, SubagentResult } from './types.ts'

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
    const resolved = await resolveFlow(input.instance_id, leadId, input.message_text ?? '')

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
        flow?.version ?? 1,
        firstStep?.id ?? null,
      )

      if (!state) {
        console.error('[orchestrator] Failed to create flow_state')
        return jsonResponse({ error: 'State creation failed' }, 500, corsHeaders)
      }

      await logFlowEvent(state.id, leadId, 'flow_started', { flow_id: resolved.flowId })
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

    // ── Log do evento ─────────────────────────────────────────────────────────
    await logFlowEvent(state.id, leadId, 'subagent_called', {
      status: result.status,
      step_id: state.current_step_id,
      has_response: !!result.response_text,
    })

    // ── Processa status do subagente ──────────────────────────────────────────
    switch (result.status) {
      case 'advance': {
        // S4: avança para próximo step via next_step logic
        await handleAdvance(state, result)
        break
      }
      case 'handoff': {
        await finalizeFlowState(state.id, 'handoff')
        await logFlowEvent(state.id, leadId, 'handoff_triggered', {
          exit_rule: result.exit_rule_triggered,
        })
        break
      }
      case 'complete': {
        await finalizeFlowState(state.id, 'completed')
        await logFlowEvent(state.id, leadId, 'flow_completed', {})
        break
      }
      case 'error': {
        console.error('[orchestrator] Subagent error:', result.error)
        break
      }
      case 'continue':
      default:
        // Permanece no step atual
        break
    }

    // ── S2: NÃO envia mensagem ao lead ────────────────────────────────────────
    // S5+: validar com validator → chamar UAZAPI send/text
    // if (result.response_text) {
    //   const validation = await validateResponse(result.response_text, context)
    //   if (validation.passed) await sendToLead(input, result.response_text)
    // }

    // ── Métricas (S9) ─────────────────────────────────────────────────────────
    await trackMetrics(resolved.flowId, 'message_processed')

    return jsonResponse(
      {
        ok: true,
        flow_id: resolved.flowId,
        state_id: state.id,
        subagent_status: result.status,
        // S2: response_text existe no resultado mas não é enviado ao lead
        _dev_response_text: result.response_text ?? null,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('[orchestrator] Unhandled error:', err)
    return jsonResponse({ error: 'Internal error' }, 500, corsHeaders)
  }
})

// ── Advance: avança lead para o próximo step ──────────────────────────────────

async function handleAdvance(state: ActiveFlowState, result: SubagentResult): Promise<void> {
  if (!result.exit_rule_triggered) return

  const action = result.exit_rule_triggered.action

  if (action === 'next_step') {
    // S4: implementar lógica de next_step_id via flow_steps.position
    // Por ora: mantém no step atual com step_data_patch registrando o avanço
    await updateFlowState(state.id, {
      step_data_patch: { _advanced_at: new Date().toISOString() },
    })
  } else if (action === 'handoff_human' || action === 'handoff_department' || action === 'handoff_manager') {
    await finalizeFlowState(state.id, 'handoff')
  } else if (action === 'tag_and_close') {
    await finalizeFlowState(state.id, 'completed')
  }
  // outro_flow, followup, do_nothing → S4+
}

// ── Resolve lead_id a partir de conversation_id ───────────────────────────────

async function resolveLeadId(conversationId: string, instanceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('conversations')
    .select('lead_id')
    .eq('id', conversationId)
    .eq('instance_id', instanceId)
    .maybeSingle()

  return data?.lead_id ?? null
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
