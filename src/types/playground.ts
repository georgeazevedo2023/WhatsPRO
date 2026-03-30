/**
 * Shared type definitions for the AI Agent Playground.
 * Created in Phase 04; E2e types added in Phase 05 (DT-05).
 */

/* ── E2E Test Result types ── */

/** Single step result from the e2e-test edge function (per D-05) */
export interface E2eResult {
  step: number;
  input: string;
  media_type: string;
  agent_response: string | null;
  agent_raw: Record<string, unknown> | null;
  tools_used: string[];
  tags: string[];
  status_ia: string | undefined;
  latency_ms: number;
  tokens: { input: number; output: number };
}

/** E2eLiveStep extends E2eResult with a UI status field for real-time display */
export interface E2eLiveStep extends E2eResult {
  status: 'pending' | 'running' | 'done' | 'error';
}
