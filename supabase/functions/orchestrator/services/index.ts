// =============================================================================
// Services — Interface pública dos serviços do Orchestrator.
// Memory (S5 — REAL), IntentDetector (S7 — REAL), Validator (S8 — stub),
// Metrics (S9 — stub), Shadow (S11 — stub)
// =============================================================================

import type { FlowContext, SubagentResult } from '../types.ts'
import {
  loadMemory as _loadMemory,
  saveShortMemory as _saveShortMemory,
} from './memory.ts'
import { detectIntents as _detectIntents } from './intentDetector.ts'

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

// ── Validator Service (S8) ────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean
  corrected_text?: string
  issues?: string[]
}

/**
 * Valida e corrige resposta do subagente antes de enviar ao lead.
 * S2: stub — aprova tudo.
 * S8: regras de tom, tamanho, emojis, PII, alucinações.
 */
export async function validateResponse(
  _responseText: string,
  _context: FlowContext,
): Promise<ValidationResult> {
  return { passed: true }
}

// ── Metrics Service (S9) ──────────────────────────────────────────────────────

/**
 * Incrementa counters de uso do fluxo.
 * S2: no-op.
 * S9: upsert em flow_metrics (messages_sent, subagent_calls, etc.)
 */
export async function trackMetrics(
  _flowId: string,
  _event: string,
  _value?: number,
): Promise<void> {
  // S9: INSERT OR INCREMENT
}

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
