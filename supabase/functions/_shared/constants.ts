/**
 * Shared constants for Edge Functions
 * Eliminates magic strings for status_ia and other common values
 */

export const STATUS_IA = {
  LIGADA: 'ligada',
  DESLIGADA: 'desligada',
  SHADOW: 'shadow',
} as const

export type StatusIA = typeof STATUS_IA[keyof typeof STATUS_IA]

// ── AI Agent: defaults de modelo (Onda 1 da auditoria 2026-06-12) ──────────
// Fonte única — antes cada default vivia inline ('gpt-4.1' em 5 pontos do
// index.ts, 'gpt-4.1-nano' em 2 do validatorAgent, e o llmProvider divergia
// entre gpt-5-mini e gpt-4.1-mini conforme o caminho).
export const DEFAULT_LLM_MODEL = 'gpt-4.1-mini'
export const DEFAULT_SPECIALIST_MODEL = 'gpt-4.1'
export const DEFAULT_ROUTER_MODEL = 'gpt-4.1-mini'
export const DEFAULT_VALIDATOR_MODEL = 'gpt-4.1-nano'

// ── AI Agent: caps de handoff (contrato em RULES/qualificationGate) ────────
// 'so_se_pedir' = lead controla → teto alto (40, R146); 'apos_n_msgs' = 8.
export const HANDOFF_CAP_DEFAULTS = { apos_n_msgs: 8, so_se_pedir: 40 } as const
export const DEFAULT_MAX_LEAD_INTERACTIONS = 15

// ── AI Agent: markers duráveis de handoff ativo ────────────────────────────
// Escritos via mergeTags({ [KEY]: 'true' }) e lidos pelo gate de silêncio
// (v7.76). Typo entre escritor e leitor desliga o gate — daí a fonte única.
// ── AI Agent: tags internas de fluxo (Onda 2 da auditoria 2026-06-12) ──────
// Chaves de tag que são estado de máquina (nunca FATO do lead) e por isso não
// devem aparecer em prompt/memória "humanizados". Fonte única — antes 4 cópias
// (productSpecialist, handoffSpecialist, leadMemory, promptSections) divergiam
// silenciosamente: tag interna nova exigia lembrar de todos os sites. Cada site
// pode COMPOR com exclusões próprias (ex.: leadMemory soma marca_citada).
export const INTERNAL_TAG_KEYS = [
  'ia',
  'lead_score',
  'multi_interesse_pending',
  'qualif_horizontal',
  'search_fail',
  'ia_cleared',
] as const

export const HANDOFF_CREATED_KEY = 'handoff_created'
export const HUMAN_ASSIGNED_KEY = 'human_assigned'
export const HANDOFF_CREATED_TAG = `${HANDOFF_CREATED_KEY}:true`
export const HUMAN_ASSIGNED_TAG = `${HUMAN_ASSIGNED_KEY}:true`
export const hasActiveHandoffMarker = (tags: string[] | null | undefined): boolean =>
  (tags || []).some((t) => t === HANDOFF_CREATED_TAG || t === HUMAN_ASSIGNED_TAG)
