// =============================================================================
// dailyReport.ts — formatter PURO do "Resumo do dia" enviado aos gestores por
// WhatsApp (edge fn daily-manager-report). Zero imports (testável em vitest).
//
// v7.108.0: formato RICO aprovado pelo dono (2026-07-25) — comparação com o
// MESMO dia da semana anterior (varejo tem sazonalidade de dia-da-semana),
// "o que procuraram" por categoria, uso do painel e pontos de atenção
// automáticos. Os campos novos são OPCIONAIS: sem eles o layout legado é
// preservado (compat com chamadores antigos da RPC).
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
  // ── campos v4 (RPC rica) — opcionais pra compat com dados antigos ──
  /** Mesmas métricas-chave do MESMO dia da semana anterior (day - 7). */
  prev?: {
    day: string
    conversations_total: number
    conversations_new: number
    inbound_total: number
    handoffs_total: number
    sales: number
  }
  /** "O que procuraram": varredura por categoria (nº de msgs e conversas). */
  category_mentions?: Array<{ c: string; msgs: number; convs: number }>
  /** Enquetes NPS ENVIADAS no dia (nps_votes = votos recebidos). */
  nps_sent?: number
  /** Msgs outgoing com sender_id (respostas pelo PAINEL; celular = NULL). */
  human_panel_msgs?: number
  human_panel_convs?: number
}

/**
 * Categorias do "o que procuraram" — padrões POSIX aplicados pela RPC sobre
 * texto normalizado (lowercase, sem acento) com fronteira de palavra.
 * Fonte única: a edge fn passa esta lista como p_categories.
 */
export const REPORT_CATEGORIES: Array<{ n: string; p: string }> = [
  { n: 'Cerâmica/Piso/Porcelanato', p: '(ceramicas?|ceramicos?|porcelanatos?|pisos?|revestimentos?)' },
  { n: 'Tinta', p: '(tintas?|verniz|selador(es)?|massa corrida)' },
  { n: 'Telha', p: 'telhas?' },
  { n: 'Rejunte/Argamassa', p: '(rejuntes?|argamassas?)' },
  { n: 'Porta/Fechadura', p: '(portas?|fechaduras?)' },
  { n: 'Chuveiro/Torneira', p: '(chuveiros?|torneiras?|duchas?)' },
  { n: "Caixa d'água", p: '(caixas? d.?agua|caixa de agua)' },
  { n: 'Elétrica (fio/tomada/lâmpada)', p: '(fios?|cabos?|tomadas?|interruptor(es)?|disjuntor(es)?|lampadas?|led)' },
  { n: 'Hidráulica (cano/conexão/bomba)', p: '(canos?|tubos?|conexao|conexoes|mangueiras?|bombas?|registros?)' },
]

// deno-lint-ignore no-explicit-any
type BusinessHours = Record<string, any> | null | undefined

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Dia da semana ('sun'..'sat') de uma data 'YYYY-MM-DD' — independente de fuso. */
export function weekdayKey(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return DAY_KEYS[d.getUTCDay()]
}

function weekdayPt(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return DAY_PT[d.getUTCDay()]
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

/** 232 → '3h52' · 45 → '45min'. */
export function fmtMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '0min'
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Sufixo de comparação com o mesmo dia da semana anterior.
 * Ex.: ' ▼8% (sex ant.: 251)' · ' (sex ant.: 2)' quando a base é pequena (<10,
 * % vira ruído) · '' quando não há prev.
 */
function fmtDelta(cur: number, prevN: number | undefined, prevDay: string | undefined): string {
  if (prevN === undefined || prevN === null || !prevDay) return ''
  const label = `${weekdayPt(prevDay)} ant.: ${prevN}`
  if (prevN < 10) return ` (${label})`
  const pct = Math.round(((cur - prevN) / prevN) * 100)
  if (pct === 0) return ` = (${label})`
  return ` ${pct > 0 ? '▲' : '▼'}${Math.abs(pct)}% (${label})`
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
  const prev = data.prev
  const prevDay = prev?.day

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

  // ── atendimentos (+ delta e sub-linha no formato rico)
  if (prev) {
    lines.push(`👥 *Atendimentos:* ${data.conversations_total}${fmtDelta(data.conversations_total, prev.conversations_total, prevDay)}`)
    if (data.conversations_total > 0) {
      lines.push(`↳ ${data.conversations_new} novos · ${returning} recorrentes`)
    }
  } else {
    const novoRec = data.conversations_total > 0
      ? ` (${data.conversations_new} novos · ${returning} recorrentes)`
      : ''
    lines.push(`👥 *Atendimentos:* ${data.conversations_total}${novoRec}`)
  }

  // ── mensagens (+ delta e sub-linha no formato rico)
  if (prev) {
    lines.push(`💬 *Mensagens recebidas:* ${data.inbound_total}${fmtDelta(data.inbound_total, prev.inbound_total, prevDay)}`)
    if (outHours > 0) lines.push(`↳ ${inHours} no horário · ${outHours} fora`)
  } else {
    const msgSplit = data.inbound_total > 0
      ? (outHours > 0 ? ` (${inHours} no horário · ${outHours} fora)` : ' (todas no horário)')
      : ''
    lines.push(`💬 *Mensagens recebidas:* ${data.inbound_total}${msgSplit}`)
  }

  if (data.conversations_total > 0) {
    const pct = Math.round((data.ai_only / data.conversations_total) * 100)
    lines.push(`🤖 *Só com a IA (sem humano):* ${data.ai_only} de ${data.conversations_total} (${pct}%)`)
  }

  const answered = (data.handoff_first_response_minutes || []).length
  const med = median(data.handoff_first_response_minutes || [])
  const pend = data.handoffs_total - answered
  const handoffDelta = prev ? fmtDelta(data.handoffs_total, prev.handoffs_total, prevDay) : ''
  if (data.handoffs_total > 0) {
    if (answered === 0) {
      lines.push(`🤝 *Transbordos:* ${data.handoffs_total}${handoffDelta} · ⚠️ nenhum respondido por humano ainda`)
    } else {
      const pendTxt = pend > 0 ? ` · ⚠️ ${pend} sem resposta` : ''
      lines.push(`🤝 *Transbordos:* ${data.handoffs_total}${handoffDelta} · 1ª resposta humana em ${fmtMinutes(med as number)}${pendTxt}`)
    }
  } else {
    lines.push(`🤝 *Transbordos:* 0${handoffDelta}`)
  }

  lines.push(`💰 *Vendas detectadas:* ${data.sales}${prev ? ` (${weekdayPt(prevDay as string)} ant.: ${prev.sales})` : ''}`)

  // ── NPS: enviadas + votos (rico) ou só votos (legado)
  const buckets = { Bom: 0, Regular: 0, Ruim: 0 }
  for (const v of data.nps_votes || []) {
    const b = npsBucket(v)
    if (b) buckets[b]++
  }
  const totalVotes = buckets.Bom + buckets.Regular + buckets.Ruim
  const bucketTxt = (['Bom', 'Regular', 'Ruim'] as const)
    .filter((k) => buckets[k] > 0)
    .map((k) => `${buckets[k]} ${k}`)
    .join(' · ')
  if (typeof data.nps_sent === 'number') {
    const votos = totalVotes > 0
      ? `${totalVotes} voto${totalVotes > 1 ? 's' : ''} (${bucketTxt})`
      : '0 votos'
    lines.push(`⭐ *NPS:* ${data.nps_sent} enquete${data.nps_sent === 1 ? '' : 's'} enviada${data.nps_sent === 1 ? '' : 's'} · ${votos}`)
  } else if (totalVotes > 0) {
    lines.push(`⭐ *NPS:* ${totalVotes} voto${totalVotes > 1 ? 's' : ''} (${bucketTxt})`)
  }

  // ── "o que procuraram" por categoria (rico); fallback: top buscas (legado)
  const cats = (data.category_mentions || []).filter((c) => c.convs > 0).slice(0, 8)
  if (cats.length > 0) {
    lines.push('')
    lines.push('🛒 *O que procuraram* (nº de conversas):')
    cats.forEach((c, i) => lines.push(`${i + 1}. ${c.c} — ${c.convs}`))
  } else {
    const searches = (data.top_searches || []).slice(0, 5)
    if (searches.length > 0) {
      lines.push('')
      lines.push('🛒 *Top produtos procurados:*')
      searches.forEach((s, i) => {
        lines.push(`${i + 1}. ${cap(s.q)} — ${s.n} busca${s.n > 1 ? 's' : ''}`)
      })
    }
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

  // ── pontos de atenção (regras determinísticas; seção só aparece se ≥1 dispara)
  const attention: string[] = []
  if (med !== null && med > 60) {
    attention.push(`1ª resposta humana demorou: mediana ${fmtMinutes(med)}`)
  }
  if (data.handoffs_total > 0 && pend > 0) {
    attention.push(`${pend} transbordo${pend > 1 ? 's' : ''} sem resposta humana`)
  }
  if (answered > 0 && data.human_panel_msgs === 0) {
    attention.push('Respostas humanas vieram só do celular — sem medição por atendente no painel')
  }
  if (typeof data.nps_sent === 'number') {
    if (data.nps_sent === 0 && data.conversations_total > 0) {
      attention.push('Nenhuma enquete NPS disparou — a enquete sai ao Finalizar a conversa no painel')
    } else if (data.nps_sent > 0 && totalVotes === 0) {
      attention.push(`${data.nps_sent} enquete${data.nps_sent > 1 ? 's' : ''} NPS enviada${data.nps_sent > 1 ? 's' : ''} sem nenhum voto`)
    }
  }
  if (outHours >= 5) {
    attention.push(`${outHours} mensagens fora do horário — cliente chama com a loja fechada`)
  }
  if (attention.length > 0) {
    lines.push('')
    lines.push('⚠️ *Pontos de atenção:*')
    attention.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
  }

  lines.push('')
  lines.push(input.footer || '_Resumo automático WhatsPRO_')
  return lines.join('\n')
}
