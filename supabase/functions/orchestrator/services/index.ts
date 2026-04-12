// =============================================================================
// Services — Interface pública dos serviços do Orchestrator.
// Memory (S5 — REAL), IntentDetector (S7 — REAL), Validator (S9 — REAL),
// Metrics (S9 — REAL), Shadow (S11 — stub)
// =============================================================================

import type { FlowContext, SubagentResult } from '../types.ts'
import {
  loadMemory as _loadMemory,
  saveShortMemory as _saveShortMemory,
} from './memory.ts'
import { detectIntents as _detectIntents } from './intentDetector.ts'
import { validateResponse as _validateResponse } from './validator.ts'
import { createTimer as _createTimer } from './metrics.ts'

// ── Memory Service (S5 — REAL) ────────────────────────────────────────────────

export interface MemorySnapshot {
  short_memory: Record<string, unknown>
  long_memory: Record<string, unknown>
}

/**
 * Carrega memória curta e longa do lead.
 * S5: lê lead_memory WHERE memory_type IN ('short','long') AND não expirada.
 */
export async function loadMemory(leadId: string, instanceId: string): Promise<MemorySnapshot> {
  return _loadMemory(leadId, instanceId)
}

/**
 * Salva memória curta após interação (merge + TTL 1h via RPC).
 * S5: upsert em lead_memory via upsert_lead_short_memory RPC.
 */
export async function saveShortMemory(
  leadId: string,
  instanceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  return _saveShortMemory(leadId, instanceId, patch)
}

// ── Intent Detector Service (S7 — REAL) ──────────────────────────────────────

export { type IntentDetectorResult, type DetectedIntent } from '../types.ts'

/**
 * Detecta intenções na mensagem do lead.
 * S7: 3 camadas (normalização BR → fuzzy match → LLM semântico).
 */
export const detectIntents = _detectIntents

// ── Validator Service (S9 — REAL) ─────────────────────────────────────────────

export { type ValidationResult, type ValidatorIssue } from '../types.ts'

/**
 * Valida e corrige resposta do subagente antes de enviar ao lead.
 * S9: 10 checks automáticos (size, language, prompt leak, price, repetition,
 *     greeting, name freq, emoji, markdown, PII). 3 falhas → handoff.
 */
export const validateResponse = _validateResponse

// ── Metrics Service (S9 — REAL) ──────────────────────────────────────────────

export { type PipelineTimer } from './metrics.ts'

/**
 * Timer envolvente que mede cada camada do pipeline.
 * S9: createTimer → mark → finalize → TimerBreakdown + CostBreakdown.
 */
export const createTimer = _createTimer

// ── Shadow Mode Service (S11) ─────────────────────────────────────────────────

/**
 * Avalia resultado do subagente contra o AI Agent atual (shadow).
 * S2: no-op.
 * S11: compara métricas, loga em shadow_sessions, alerta gestor.
 */
export async function runShadow(
  _result: SubagentResult,
  _context: FlowContext,
): Promise<void> {
  // S11: compare with ai-agent response in shadow mode
}
