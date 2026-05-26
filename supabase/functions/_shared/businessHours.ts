/**
 * D30: helper compartilhado para checar se agora está fora do horário comercial.
 * Replica a lógica inline do ai-agent (linhas 226-286) — quando refatorar a
 * checagem do ai-agent (Sprint H), trocar lá pra usar este helper.
 *
 * Suporta 3 estados:
 *   1. Modo Estendido ATIVO: `extended_hours_until > now()` → SEMPRE dentro do horário.
 *   2. Formato weekly: `{ "mon":{"open":true,"start":"08:00","end":"18:00"}, ... }`
 *   3. Formato legacy: `{ "start":"08:00", "end":"18:00" }`
 *
 * Quando `business_hours` é null/vazio → assume 24/7 (nunca fora).
 *
 * Timezone: America/Sao_Paulo (mesmo do ai-agent).
 */

// deno-lint-ignore no-explicit-any
type BusinessHours = Record<string, any> | null | undefined

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function checkTimeRange(currentMinutes: number, start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  // Normal range (08:00-18:00) → fora se currentMin antes de start OU >= end
  // Inverted range (22:00-06:00, atravessa meia-noite) → fora se >= end E < start
  return startMin < endMin
    ? (currentMinutes < startMin || currentMinutes >= endMin)
    : (currentMinutes < startMin && currentMinutes >= endMin)
}

export function isOutsideBusinessHours(
  businessHours: BusinessHours,
  extendedHoursUntil?: string | null,
): boolean {
  // Modo Estendido (D30): override
  if (extendedHoursUntil) {
    const ehDate = new Date(extendedHoursUntil)
    if (!isNaN(ehDate.getTime()) && ehDate.getTime() > Date.now()) {
      return false
    }
  }

  if (!businessHours || typeof businessHours !== 'object' || Array.isArray(businessHours)) {
    return false  // sem config → 24/7
  }

  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const currentMinutes = nowBR.getHours() * 60 + nowBR.getMinutes()
  const todayKey = DAY_KEYS[nowBR.getDay()]
  const todaySchedule = businessHours[todayKey]

  // Formato weekly
  if (todaySchedule && typeof todaySchedule === 'object') {
    if (!todaySchedule.open) return true
    if (todaySchedule.start && todaySchedule.end) {
      return checkTimeRange(currentMinutes, todaySchedule.start, todaySchedule.end)
    }
    return false  // open=true sem start/end → considera dentro
  }

  // Formato legacy
  if (businessHours.start && businessHours.end) {
    return checkTimeRange(currentMinutes, businessHours.start, businessHours.end)
  }

  return false
}

/**
 * Bug 31 (2026-05-17) — formata business_hours num texto humano BR-PT.
 *
 * Agrupa dias consecutivos com mesmo horário (Seg-Sex 8h-18h) e separa o
 * resto (Sáb 8h-12h). Domingo fechado fica implícito (não aparece).
 *
 * Retorna null se `business_hours` for null/inválido (significando 24/7).
 *
 * Exemplos:
 *   { mon-fri: 08-18, sat: 08-12, sun: closed } → "Seg-Sex 8h-18h, Sáb 8h-12h"
 *   { mon-sat: 09-19 } → "Seg-Sáb 9h-19h"
 *   { mon,wed,fri: 10-16 } → "Seg, Qua, Sex 10h-16h"
 *
 * Formato legacy {start,end} sem dias → "8h-18h" (assume todo dia).
 */
const DAY_SHORT: Record<string, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
}
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function formatHour(hhmm: string): string {
  const [hh, mm] = hhmm.split(':')
  return mm === '00' ? `${parseInt(hh, 10)}h` : `${parseInt(hh, 10)}h${mm}`
}

export function formatBusinessHours(businessHours: BusinessHours): string | null {
  if (!businessHours || typeof businessHours !== 'object' || Array.isArray(businessHours)) {
    return null
  }
  // Legacy {start,end}
  if (typeof businessHours.start === 'string' && typeof businessHours.end === 'string' && !DAY_ORDER.some(d => businessHours[d])) {
    return `${formatHour(businessHours.start)}-${formatHour(businessHours.end)}`
  }
  // Weekly
  const open = DAY_ORDER
    .map(d => ({ d, sch: businessHours[d] }))
    .filter(x => x.sch && typeof x.sch === 'object' && x.sch.open !== false && x.sch.start && x.sch.end)

  if (open.length === 0) return null

  // Group consecutive days with same hours
  const groups: { start: string; end: string; range: string }[] = []
  let cur: typeof groups[0] | null = null
  for (const { d, sch } of open) {
    const range = `${formatHour(sch.start)}-${formatHour(sch.end)}`
    const idx = DAY_ORDER.indexOf(d)
    if (cur && cur.range === range && DAY_ORDER.indexOf(cur.end) === idx - 1) {
      cur.end = d
    } else {
      if (cur) groups.push(cur)
      cur = { start: d, end: d, range }
    }
  }
  if (cur) groups.push(cur)

  return groups
    .map(g => {
      const days = g.start === g.end ? DAY_SHORT[g.start] : `${DAY_SHORT[g.start]}-${DAY_SHORT[g.end]}`
      return `${days} ${g.range}`
    })
    .join(', ')
}

/**
 * Bug 31 (2026-05-17) — enriquece mensagem de transbordo fora do horário
 * com os horários comerciais reais quando a mensagem não os menciona.
 *
 * Heurística: se a mensagem JÁ contém marcadores de horário (regex `\d{1,2}h`,
 * "horário", "segunda a", "seg-"), retorna como está (admin já incluiu).
 * Caso contrário, injeta um prefixo com a janela formatada.
 */
export function enrichOutsideHoursMessage(
  message: string,
  businessHours: BusinessHours,
): string {
  if (!message) return message
  // Já menciona horários? não toca
  if (/\d{1,2}h\b|horário|hor[áa]rios|segunda\s+a|seg-/i.test(message)) {
    return message
  }
  const hoursText = formatBusinessHours(businessHours)
  if (!hoursText) return message
  return `Estamos fora do horário (${hoursText}). ${message}`
}

/**
 * #4 (2026-05-24) — personaliza a mensagem de transbordo citando o PRIMEIRO NOME
 * do lead e o item/pedido que ele estava fechando, pra não soar como template frio.
 *
 * Ex.: msg base "No momento estamos fora do horário..." + leadName "George" +
 *   itemSummary "Pedido de 50 telhas Brasilit 244x110" →
 *   "George, anotei seu pedido: 50 telhas Brasilit 244x110. No momento estamos fora..."
 *
 * No-op gracioso quando não há nem nome nem item legível. Códigos internos de
 * reason (ex.: "telha_fora_hora") são ignorados — nunca viram texto pro lead.
 * Não duplica o nome se a mensagem base já começa com ele.
 */
export function personalizeHandoffMessage(
  message: string,
  opts: { leadName?: string | null; itemSummary?: string | null },
): string {
  if (!message) return message
  const name = (opts.leadName || '').trim().split(/\s+/)[0] || '' // só o primeiro nome
  const item = cleanHandoffItem(opts.itemSummary)
  if (!name && !item) return message // nada a personalizar

  const alreadyHasName =
    name && new RegExp(`^${escapeRegExp(name)}[,!?.\\s]`, 'i').test(message.trimStart())
  const namePart = name && !alreadyHasName ? `${name}, ` : ''
  let ackPart = ''
  if (item) {
    ackPart = namePart ? `anotei seu pedido: ${item}. ` : `Anotei seu pedido: ${item}. `
  } else if (namePart) {
    ackPart = 'anotei tudo aqui. '
  }
  const prefix = (namePart + ackPart).trim()
  return prefix ? `${prefix} ${message}` : message
}

/**
 * Normaliza o reason de handoff em item legível pro LEAD. O reason é escrito pro
 * VENDEDOR (rico, com prefixos tipo "Pedido completo:" e meta-notas tipo "Lead já
 * confirmou que é só isso") — aqui extraímos só a parte que faz sentido pro lead.
 */
function cleanHandoffItem(raw?: string | null): string {
  let s = (raw || '').trim()
  if (!s) return ''
  // reason interno tipo "telha_fora_hora" / "search_fail" (snake_case sem espaço) → não é item
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(s)) return ''
  // (2026-05-26) O reason muitas vezes é escrito em 3ª PESSOA pro vendedor
  // ("Lead quer cerâmica…", "Cliente busca…", "Pedido para o vendedor indicar…").
  // Isso JAMAIS pode virar texto pro lead — denuncia que é robô. Quando o reason
  // tem cara de narração/instrução interna, NÃO geramos "anotei seu pedido: …";
  // a mensagem fica só humanizada (nome + ponte). O resumo estruturado vai pro
  // vendedor via nota interna + painel Transbordo, não pro cliente.
  if (/^\s*(o |a )?(lead|cliente|contato|usu[áa]rio)\b/i.test(s)) return ''
  if (/\b(para o vendedor|pro vendedor|para o consultor|indicar (a )?op[çc][ãa]o|indique|confirmar (o )?pre[çc]o|estoque f[íi]sico|or[çc]amento pro|aguardando atendimento)\b/i.test(s)) return ''
  // 2026-05-24: o handoff forçado (R120 fora-de-horário/sem-resultado) monta o reason
  // como "{texto}_fora_hora" — o sufixo de código fica COLADO na última palavra e
  // vazava pro lead ("...parede interna_fora_hora"). Remove sufixos de código conhecidos
  // e qualquer cauda snake_case colada (sem espaço antes do "_").
  s = s.replace(/_(?:fora_hora|fora_horario|fora_de_hora|sem_resultado|offline|search_fail)\b/gi, ' ')
  s = s.replace(/\S*_[a-z]{3,}(?:_[a-z]{3,})+\b/gi, (m) => m.replace(/_[a-z]{3,}(?:_[a-z]{3,})+\b/i, ''))
  s = s.replace(/\s{2,}/g, ' ').trim()
  // remove prefixos redundantes ("Pedido completo:", "Pedido:", "Resumo:", "Pedido de"…)
  s = s.replace(
    /^(pedido(\s+(completo|de))?|resumo|or[çc]amento(\s+de)?|interesse em|consulta sobre|sobre)\s*[:\-–]?\s*/i,
    '',
  ).trim()
  // pega só a 1ª frase (o item) — descarta meta-notas pro vendedor ("Lead já confirmou…")
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0]
  if (firstSentence && firstSentence.trim().length >= 8) s = firstSentence.trim()
  s = s.replace(/[.!?]+$/, '').trim()
  // cap generoso (cabe pedido multi-item de 2-3 produtos), trunca só se exceder muito
  if (s.length > 160) s = s.slice(0, 160).trim() + '…'
  return s
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
