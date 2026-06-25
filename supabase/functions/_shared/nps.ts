// =============================================================================
// nps.ts — NPS-on-finalize: lógica determinística PURA (sem rede/DB).
//
// Usado por:
//   - send-nps-poll/index.ts       (monta opções/payload da enquete)
//   - notify-manager-nps/index.ts  (texto do alerta ao gestor)
//   - whatsapp-webhook/index.ts     (parse do voto + detecção de nota baixa)
//
// Mantém paridade de score com src/hooks/usePollMetrics.ts (categórico 1-5).
// =============================================================================

export type NpsScale = 'categorical' | 'numeric_0_10'

export const NUMERIC_0_10_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
export const DEFAULT_CATEGORICAL_OPTIONS = ['Excelente', 'Bom', 'Regular', 'Ruim', 'Pessimo']
export const FOUND_PRODUCT_OPTIONS = ['Sim', 'Não']
export const FOUND_PRODUCT_AUTO_TAGS: Record<string, string> = {
  'Sim': 'encontrou_produto:sim',
  'Não': 'encontrou_produto:nao',
}

const CATEGORICAL_BAD = ['ruim', 'pessimo'] // normalizados (sem acento)
const CATEGORICAL_SCORE: Record<string, number> = { excelente: 5, bom: 4, regular: 3, ruim: 2, pessimo: 1 }

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Opções da enquete NPS conforme a escala configurada. */
export function buildNpsOptions(scale: NpsScale, categoricalOptions?: string[] | null): string[] {
  if (scale === 'numeric_0_10') return [...NUMERIC_0_10_OPTIONS]
  const opts = (categoricalOptions || []).filter((o) => typeof o === 'string' && o.trim().length > 0)
  return opts.length >= 2 ? opts : [...DEFAULT_CATEGORICAL_OPTIONS]
}

/**
 * Extrai um score numérico do voto.
 * - numeric_0_10: parseInt do 1º selecionado (0..10) ou null se fora do range.
 * - categorical: mapeia Excelente..Pessimo → 5..1 (null se não bater).
 */
export function parseNpsScore(selectedOptions: string[] | null | undefined, scale: NpsScale): number | null {
  const first = (selectedOptions || [])[0]
  if (first == null) return null
  if (scale === 'numeric_0_10') {
    const n = parseInt(String(first).trim(), 10)
    return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null
  }
  const s = CATEGORICAL_SCORE[norm(String(first))]
  return s ?? null
}

/**
 * O voto conta como "nota baixa" (dispara alerta ao gestor)?
 * - numeric_0_10: score < threshold (default 5 → barra 0,1,2,3,4).
 * - categorical: opção ∈ {Ruim, Pessimo} (acento-insensível).
 */
export function isLowScore(
  selectedOptions: string[] | null | undefined,
  scale: NpsScale,
  threshold: number,
): boolean {
  if (scale === 'numeric_0_10') {
    const score = parseNpsScore(selectedOptions, scale)
    return score !== null && score < threshold
  }
  const first = norm(String((selectedOptions || [])[0] ?? ''))
  return CATEGORICAL_BAD.includes(first)
}

/** Label legível do score pro alerta ("3/10" ou "Ruim"). */
export function scoreLabel(selectedOptions: string[] | null | undefined, scale: NpsScale): string {
  if (scale === 'numeric_0_10') {
    const n = parseNpsScore(selectedOptions, scale)
    return n !== null ? `${n}/10` : String((selectedOptions || [])[0] ?? '?')
  }
  return String((selectedOptions || [])[0] ?? '?')
}

export interface NpsAlertContext {
  scoreLabel: string
  customerName: string | null
  customerPhone: string | null
  attendantName: string | null
  summary: string | null
}

/** Texto rico do alerta ao gestor (nota baixa). Nome+número+atendente+resumo. */
export function buildManagerAlertText(c: NpsAlertContext): string {
  const lines = [`🔴 NPS baixo (${c.scoreLabel})`]
  lines.push(`Cliente: ${c.customerName || 'sem nome'}${c.customerPhone ? ` (${c.customerPhone})` : ''}`)
  if (c.attendantName) lines.push(`Atendente: ${c.attendantName}`)
  if (c.summary) lines.push(`Resumo: ${c.summary}`)
  lines.push('— acompanhe no painel. 📊')
  return lines.join('\n')
}
