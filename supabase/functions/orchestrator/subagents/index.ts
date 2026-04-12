// =============================================================================
// Subagents Router (S5)
// Despacha para o subagente correto baseado em subagent_type do step.
// S5: greeting REAL. Demais: stubs.
// Implementações reais por sprint:
//   S5: greeting ✅ | S6: qualification | S7: sales | S8: support
//   S9: survey      | S10: followup     | S11: handoff | S12: custom
// =============================================================================

import type { FlowContext, SubagentResult } from '../types.ts'
import { greetingSubagent } from './greeting.ts'
import type { GreetingConfig } from './greeting.ts'

// ── Mapa de subagent_type → handler ──────────────────────────────────────────

type SubagentDispatcher = (ctx: FlowContext) => Promise<SubagentResult>

const SUBAGENT_MAP: Record<string, SubagentDispatcher> = {
  greeting: (ctx) => greetingSubagent({ context: ctx, config: (ctx.step_config as GreetingConfig) ?? {} }),
  qualification: stubSubagent('qualification'),
  sales: stubSubagent('sales'),
  support: stubSubagent('support'),
  survey: stubSubagent('survey'),
  followup: stubSubagent('followup'),
  handoff: stubSubagent('handoff'),
  custom: stubSubagent('custom'),
}

// ── Dispatcher principal ──────────────────────────────────────────────────────

/**
 * Despacha para o subagente do step atual.
 * Se step_type não reconhecido, retorna stub genérico com log.
 */
export async function dispatchSubagent(context: FlowContext): Promise<SubagentResult> {
  const stepType = getStepType(context)
  const handler = SUBAGENT_MAP[stepType]

  if (!handler) {
    console.warn(`[subagents] Unknown step_type: ${stepType} — using stub`)
    return stubResult(stepType)
  }

  return handler(context)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStepType(context: FlowContext): string {
  // subagent_type é injetado em step_config pelo contextBuilder (coluna separada no DB)
  return (context.step_config.subagent_type as string) ?? 'custom'
}

/** Cria stub dispatcher que loga e retorna continue sem response_text */
function stubSubagent(name: string): SubagentDispatcher {
  return async (_ctx: FlowContext): Promise<SubagentResult> => {
    console.log(`[subagents:${name}] stub — S2 skeleton, no message sent`)
    return stubResult(name)
  }
}

function stubResult(name: string): SubagentResult {
  return {
    status: 'continue',
    // response_text: undefined → orchestrator NÃO envia mensagem ao lead
    step_data_patch: {
      _stub_subagent: name,
      _stub_at: new Date().toISOString(),
    },
  }
}
