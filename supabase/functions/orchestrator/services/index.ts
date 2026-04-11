// =============================================================================
// Services — Stubs S2
// Interface pública dos serviços do Orchestrator.
// S2: stubs que retornam dados vazios / passam direto.
// Implementações reais: Memory (S5), IntentDetector (S7), Validator (S8),
//                       Metrics (S9), Shadow (S11)
// =============================================================================

import type { FlowContext, SubagentResult } from '../types.ts'

// ── Memory Service (S5) ───────────────────────────────────────────────────────

export interface MemorySnapshot {
  short_memory: Record<string, unknown>
  long_memory: Record<string, unknown>
}

/**
 * Carrega memória curta e longa do lead.
 * S2: stub — retorna objetos vazios.
 * S5: lê lead_memory (short) e lead_long_memory (long).
 */
export async function loadMemory(_leadId: string): Promise<MemorySnapshot> {
  return { short_memory: {}, long_memory: {} }
}

/**
 * Salva memória curta após interação.
 * S2: no-op.
 */
export async function saveShortMemory(
  _leadId: string,
  _patch: Record<string, unknown>,
): Promise<void> {
  // S5: upsert em lead_memory
}

// ── Intent Detector Service (S7) ─────────────────────────────────────────────

export interface IntentResult {
  intents: string[]
  confidence: Record<string, number>
}

/**
 * Detecta intenções na mensagem do lead.
 * S2: stub — retorna array vazio.
 * S7: 3 camadas (keyword → regex → LLM) com normalização BR.
 */
export async function detectIntents(_messageText: string): Promise<IntentResult> {
  return { intents: [], confidence: {} }
}

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
