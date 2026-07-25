// =============================================================================
// dailyReport.ts — formatter PURO do "Resumo do dia" enviado aos gestores por
// WhatsApp (edge fn daily-manager-report). Zero imports (testável em vitest).
//
// Contrato de consistência (definições únicas — os números FECHAM entre si):
//   - atendimento  = conversa com ≥1 msg INCOMING no dia (janela America/Sao_Paulo)
//   - novo         = atendimento cujo contact foi criado no dia; recorrente = resto
//     (novos + recorrentes = atendimentos, por construção)
//   - histograma   = conversas INICIADAS por hora (hora da 1ª msg incoming do dia
//     de cada conversa) → a soma do gráfico = total de atendimentos
//   - no horário/fora = classificação por hora (ponto médio da hora vs business_hours)
// =============================================================================

export interface DailyReportData {
  day: string // 'YYYY-MM-DD'
  inbound_total: number
  inbound_by_hour: Record<string, number>
  conversations_total: number
  conversations_new: number
  conv_starts_by_hour: Record<string, number>
  ai_only: number
  handoffs_total: number
  handoff_first_response_minutes: number[]
  sales: number
  nps_votes: Array<{ score: number | null; options: string[] | null }>
  top_searches: Array<{ q: string; n: number }>
  top_brands: Array<{ b: string; n: number }>
}

// deno-lint-ignore no-explicit-any
type BusinessHours = Record<string, any> | null | undefined

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Dia da semana ('sun'..'sat') de uma data 'YYYY-MM-DD' — independente de fuso. */
export function weekdayKey(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return DAY_KEYS[d.getUTCDay()]
}

function parseHHMM(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/**
 * Classifica uma HORA cheia (0-23) como dentro/fora do horário comercial do dia.
 * Regra do ponto médio: a hora conta como "dentro" se HH:30 ∈ [start, end).
 * Sem config → 24/7 (sempre dentro). Dia fechado (open=false) → sempre fora.
 * Suporta formato weekly ({mon:{open,start,end},...}) e legacy ({start,end}).
 */
export function isHourInBusinessHours(
  businessHours: BusinessHours,
  dayKey: string,
  hour: number,
): boolean {
  if (!businessHours || typeof businessHours !== 'object' || Array.isArray(businessHours)) {
    return true
  }
  const mid = hour * 60 + 30
  const sched = businessHours[dayKey]
  if (sched && typeof sched === 'object') {
    if (sched.open === false) return false
    const start = parseHHMM(sched.start)
    const end = parseHHMM(sched.end)
    if (start === null || end === null) return true // open sem start/end → dentro
    return mid >= start && mid < end
  }
  // Legacy {start,end} sem dias
  const start = parseHHMM(businessHours.start)
  const end = parseHHMM(businessHours.end)
  if (start === null || end === null) return true
  return mid >= start && mid < end
}

export function median(nums: number[]): number | null {
  const s = nums.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b)
  if (s.length === 0) return null
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function bar(n: number, max: number): string {
  if (n <= 0 || max <= 0) return ''
  return '▓'.repeat(Math.max(1, Math.round((n / max) * 8)))
}

function cap(s: string): string {
  const t = (s || '').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/**
 * Slug canônico de marca ('la_fonte', 'hdl') → display ('La Fonte', 'HDL').
 * Slug de palavra ÚNICA com ≤3 chars vira sigla maiúscula (HDL, WEG, SIL);
 * multi-palavra capitaliza cada uma ('la_fonte' → 'La Fonte', não 'LA Fonte').
 */
export function brandDisplay(slug: string): string {
  const words = (slug || '').split('_').filter(Boolean)
  if (words.length === 1 && words[0].length <= 3) return words[0].toUpperCase()
  return words.map(cap).join(' ')
}

function fmtDayBR(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

/** Bucket do voto NPS (escala curta v7.97.1: Bom→8 / Regular→5 / Ruim→2). */
export function npsBucket(vote: { score: number | null; options: string[] | null }): 'Bom' | 'Regular' | 'Ruim' | null {
  if (typeof vote.score === 'number') {
    if (vote.score >= 8) return 'Bom'
    if (vote.score >= 4) return 'Regular'
    return 'Ruim'
  }
  const opt = (vote.options && vote.options[0]) || ''
  if (/bom/i.test(opt)) return 'Bom'
  if (/regular/i.test(opt)) return 'Regular'
  if (/ruim/i.test(opt)) return 'Ruim'
  return null
}

export interface BuildReportInput {
  title: string
  data: DailyReportData
  businessHours: BusinessHours
  /** Rótulo do corte, ex. "até 17h30". Se ausente → "dia completo". */
  cutoffLabel?: string | null
  footer?: string | null
}

export function buildDailyReportText(input: BuildReportInput): string {
  const { data, businessHours } = input
  const dayKey = weekdayKey(data.day)
  const returning = Math.max(0, data.conversations_total - data.conversations_new)

  // ── mensagens dentro/fora do horário (por hora)
  let inHours = 0
  let outHours = 0
  for (const [h, n] of Object.entries(data.inbound_by_hour || {})) {
    if (isHourInBusinessHours(businessHours, dayKey, parseInt(h, 10))) inHours += n
    else outHours += n
  }

  const lines: string[] = []
  lines.push(`📊 *Resumo do dia — ${input.title}*`)
  lines.push(`${fmtDayBR(data.day)} · ${input.cutoffLabel || 'dia completo'}`)
  lines.push('')

  const novoRec = data.conversations_total > 0
    ? ` (${data.conversations_new} novos · ${returning} recorrentes)`
    : ''
  lines.push(`👥 *Atendimentos:* ${data.conversations_total}${novoRec}`)

  const msgSplit = data.inbound_total > 0
    ? (outHours > 0 ? ` (${inHours} no horário · ${outHours} fora)` : ' (todas no horário)')
    : ''
  lines.push(`💬 *Mensagens recebidas:* ${data.inbound_total}${msgSplit}`)

  if (data.conversations_total > 0) {
    const pct = Math.round((data.ai_only / data.conversations_total) * 100)
    lines.push(`🤖 *Só com a IA (sem humano):* ${data.ai_only} de ${data.conversations_total} (${pct}%)`)
  }

  if (data.handoffs_total > 0) {
    const med = median(data.handoff_first_response_minutes || [])
    const answered = (data.handoff_first_response_minutes || []).length
    if (answered === 0) {
      lines.push(`🤝 *Transbordos:* ${data.handoffs_total} · ⚠️ nenhum respondido por humano ainda`)
    } else {
      const pend = data.handoffs_total - answered
      const pendTxt = pend > 0 ? ` · ⚠️ ${pend} sem resposta` : ''
      lines.push(`🤝 *Transbordos:* ${data.handoffs_total} · 1ª resposta humana em ${med}min${pendTxt}`)
    }
  } else {
    lines.push(`🤝 *Transbordos:* 0`)
  }

  lines.push(`💰 *Vendas detectadas:* ${data.sales}`)

  const buckets = { Bom: 0, Regular: 0, Ruim: 0 }
  for (const v of data.nps_votes || []) {
    const b = npsBucket(v)
    if (b) buckets[b]++
  }
  const totalVotes = buckets.Bom + buckets.Regular + buckets.Ruim
  if (totalVotes > 0) {
    const parts = (['Bom', 'Regular', 'Ruim'] as const)
      .filter((k) => buckets[k] > 0)
      .map((k) => `${buckets[k]} ${k}`)
    lines.push(`⭐ *NPS:* ${totalVotes} voto${totalVotes > 1 ? 's' : ''} (${parts.join(' · ')})`)
  }

  const searches = (data.top_searches || []).slice(0, 5)
  if (searches.length > 0) {
    lines.push('')
    lines.push('🛒 *Top produtos procurados:*')
    searches.forEach((s, i) => {
      lines.push(`${i + 1}. ${cap(s.q)} — ${s.n} busca${s.n > 1 ? 's' : ''}`)
    })
  }

  const brands = (data.top_brands || []).slice(0, 5)
  if (brands.length > 0) {
    lines.push('')
    lines.push(`🏷️ *Marcas citadas:* ${brands.map((x) => `${brandDisplay(x.b)} (${x.n})`).join(' · ')}`)
  }

  // ── histograma: conversas iniciadas por hora (faixa contínua min..max)
  const hourEntries = Object.entries(data.conv_starts_by_hour || {})
    .map(([h, n]) => ({ h: parseInt(h, 10), n }))
    .filter((x) => Number.isFinite(x.h) && x.n > 0)
    .sort((a, b) => a.h - b.h)
  if (hourEntries.length > 0) {
    const minH = hourEntries[0].h
    const maxH = hourEntries[hourEntries.length - 1].h
    const byHour = new Map(hourEntries.map((x) => [x.h, x.n]))
    const maxN = Math.max(...hourEntries.map((x) => x.n))
    lines.push('')
    lines.push('🕐 *Conversas iniciadas por hora:*')
    for (let h = minH; h <= maxH; h++) {
      const n = byHour.get(h) || 0
      const hh = String(h).padStart(2, '0')
      const fora = !isHourInBusinessHours(businessHours, dayKey, h) ? ' _(fora do horário)_' : ''
      lines.push(n > 0 ? `${hh}h ${bar(n, maxN)} ${n}${fora}` : `${hh}h 0${fora}`)
    }
  }

  lines.push('')
  lines.push(input.footer || '_Resumo automático WhatsPRO_')
  return lines.join('\n')
}
