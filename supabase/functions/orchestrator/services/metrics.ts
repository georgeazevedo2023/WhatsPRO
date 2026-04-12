// =============================================================================
// Metrics Service (S9)
// Timer envolvente que mede cada camada do pipeline.
// Salva timing_breakdown + cost_breakdown em flow_events.
//
// Uso:
//   const timer = createTimer()
//   ... detectIntents ...
//   timer.mark('intent')
//   ... resolveFlow ...
//   timer.mark('resolve')
//   const { timing, cost } = timer.finalize(intentLayer, llmTokens, llmCost)
//
// Wiki: [[wiki/fluxos-servicos]] (S4 — Metrics)
// =============================================================================

import type { TimerBreakdown, CostBreakdown } from '../types.ts'

export interface PipelineTimer {
  mark: (label: string) => void
  finalize: (intentLayer?: number, llmTokens?: number, llmCostBrl?: number) => {
    timing: TimerBreakdown
    cost: CostBreakdown
  }
}

export function createTimer(): PipelineTimer {
  const startMs = performance.now()
  const marks: Record<string, number> = {}
  let lastMark = startMs

  return {
    mark(label: string) {
      const now = performance.now()
      marks[label] = Math.round(now - lastMark)
      lastMark = now
    },

    finalize(intentLayer = 0, llmTokens = 0, llmCostBrl = 0) {
      const totalMs = Math.round(performance.now() - startMs)

      const timing: TimerBreakdown = {
        intent_ms: marks['intent'] ?? 0,
        resolve_ms: marks['resolve'] ?? 0,
        context_ms: marks['context'] ?? 0,
        subagent_ms: marks['subagent'] ?? 0,
        validator_ms: marks['validator'] ?? 0,
        send_ms: marks['send'] ?? 0,
        total_ms: totalMs,
      }

      const cost: CostBreakdown = {
        llm_tokens: llmTokens,
        llm_cost_brl: llmCostBrl,
        intent_layer: intentLayer,
      }

      return { timing, cost }
    },
  }
}
