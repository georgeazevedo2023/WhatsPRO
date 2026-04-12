// =============================================================================
// Subagents Router (S8)
// Despacha para o subagente correto baseado em subagent_type do step.
// Implementações reais por sprint:
//   S5: greeting ✅ | S6: qualification ✅ | S8: sales ✅ + support ✅
//   S9: survey ✅   | S10: followup ✅      | S10: handoff ✅ | S12: custom
// =============================================================================

import type { FlowContext, SubagentResult, SalesConfig, SupportConfig } from '../types.ts'
import { greetingSubagent } from './greeting.ts'
import type { GreetingConfig } from './greeting.ts'
import { qualificationSubagent } from './qualification.ts'
import type { QualificationConfig } from './qualification.ts'
import { salesSubagent } from './sales.ts'
import { supportSubagent } from './support.ts'
import { surveySubagent } from './survey.ts'
import type { SurveyConfig } from './survey.ts'
import { handoffSubagent } from './handoff.ts'
import type { HandoffConfig } from './handoff.ts'
import { followupSubagent } from './followup.ts'
import type { FollowupConfig } from './followup.ts'

// ── Mapa de subagent_type → handler ──────────────────────────────────────────

type SubagentDispatcher = (ctx: FlowContext) => Promise<SubagentResult>

const SUBAGENT_MAP: Record<string, SubagentDispatcher> = {
  greeting: (ctx) => greetingSubagent({ context: ctx, config: (ctx.step_config as GreetingConfig) ?? {} }),
  qualification: (ctx) => qualificationSubagent({ context: ctx, config: (ctx.step_config as QualificationConfig) ?? {} }),
  sales: (ctx) => salesSubagent({ context: ctx, config: (ctx.step_config as SalesConfig) ?? {} }),
  support: (ctx) => supportSubagent({ context: ctx, config: (ctx.step_config as SupportConfig) ?? {} }),
  survey: (ctx) => surveySubagent({ context: ctx, config: (ctx.step_config as SurveyConfig) ?? {} }),
  followup: (ctx) => followupSubagent({ context: ctx, config: (ctx.step_config as FollowupConfig) ?? {} }),
  handoff: (ctx) => handoffSubagent({ context: ctx, config: (ctx.step_config as HandoffConfig) ?? {} }),
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
