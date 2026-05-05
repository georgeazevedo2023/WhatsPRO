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
