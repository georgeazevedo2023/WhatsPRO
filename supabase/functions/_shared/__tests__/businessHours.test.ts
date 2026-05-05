import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isOutsideBusinessHours } from '../businessHours.ts'

// Para fixar dia/hora de Sao Paulo independentemente do TZ da maquina
// usamos vi.setSystemTime com um instante UTC que, convertido para
// America/Sao_Paulo (UTC-3 sem DST desde 2019), produz a wall-clock
// que queremos. Ex: UTC 15:00 -> BRT 12:00 (terca, se 2026-05-05).
//
// Toolkit: 2026-05-05 = terca (tue), 2026-05-03 = domingo (sun).

function setSPNow(isoUtc: string) {
  vi.setSystemTime(new Date(isoUtc))
}

const WEEKLY_8_18 = {
  mon: { open: true, start: '08:00', end: '18:00' },
  tue: { open: true, start: '08:00', end: '18:00' },
  wed: { open: true, start: '08:00', end: '18:00' },
  thu: { open: true, start: '08:00', end: '18:00' },
  fri: { open: true, start: '08:00', end: '18:00' },
  sat: { open: false },
  sun: { open: false },
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isOutsideBusinessHours — sem config', () => {
  it('null retorna false (24/7)', () => {
    setSPNow('2026-05-05T03:00:00Z') // BRT 00:00 terca
    expect(isOutsideBusinessHours(null)).toBe(false)
    expect(isOutsideBusinessHours(undefined)).toBe(false)
  })

  it('objeto vazio retorna false', () => {
    setSPNow('2026-05-05T03:00:00Z')
    expect(isOutsideBusinessHours({})).toBe(false)
  })

  it('array invalido retorna false', () => {
    // Defesa contra payload malformado vindo do banco
    setSPNow('2026-05-05T03:00:00Z')
    expect(isOutsideBusinessHours([] as never)).toBe(false)
  })
})

describe('isOutsideBusinessHours — extended_hours_until override', () => {
  it('extended futuro forca dentro mesmo fora do horario', () => {
    setSPNow('2026-05-05T05:00:00Z') // BRT 02:00 terca (madrugada)
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(isOutsideBusinessHours(WEEKLY_8_18, future)).toBe(false)
  })

  it('extended passado e ignorado', () => {
    setSPNow('2026-05-05T05:00:00Z') // madrugada terca
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(isOutsideBusinessHours(WEEKLY_8_18, past)).toBe(true)
  })

  it('extended invalido (string nao parseavel) e ignorado', () => {
    setSPNow('2026-05-05T05:00:00Z')
    expect(isOutsideBusinessHours(WEEKLY_8_18, 'not-a-date')).toBe(true)
  })

  it('extended null/undefined nao afeta', () => {
    setSPNow('2026-05-05T15:00:00Z') // BRT 12:00 terca - dentro
    expect(isOutsideBusinessHours(WEEKLY_8_18, null)).toBe(false)
    expect(isOutsideBusinessHours(WEEKLY_8_18, undefined)).toBe(false)
  })
})

describe('isOutsideBusinessHours — formato weekly', () => {
  it('terca 12:00 BRT esta dentro de 08-18', () => {
    setSPNow('2026-05-05T15:00:00Z') // BRT 12:00 terca
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(false)
  })

  it('terca 06:00 BRT (antes do start) esta fora', () => {
    setSPNow('2026-05-05T09:00:00Z') // BRT 06:00 terca
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(true)
  })

  it('terca 20:00 BRT (depois do end) esta fora', () => {
    setSPNow('2026-05-05T23:00:00Z') // BRT 20:00 terca
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(true)
  })

  it('terca exato 18:00 BRT esta fora (>= end)', () => {
    setSPNow('2026-05-05T21:00:00Z') // BRT 18:00 terca
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(true)
  })

  it('terca exato 08:00 BRT esta dentro (>= start)', () => {
    setSPNow('2026-05-05T11:00:00Z') // BRT 08:00 terca
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(false)
  })

  it('domingo (open:false) esta fora mesmo no meio do dia', () => {
    setSPNow('2026-05-03T15:00:00Z') // BRT 12:00 domingo
    expect(isOutsideBusinessHours(WEEKLY_8_18)).toBe(true)
  })

  it('open:true sem start/end e considerado dentro', () => {
    setSPNow('2026-05-05T15:00:00Z')
    const wh = { tue: { open: true } }
    expect(isOutsideBusinessHours(wh)).toBe(false)
  })

  it('faixa invertida (22-06) tratada como atravessa meia-noite', () => {
    // checkTimeRange: startMin > endMin => fora se < start E >= end
    // 12:00 BRT esta dentro? start=22, end=06 -> startMin=1320, endMin=360
    // current=720. 720 < 1320 (true) E 720 >= 360 (true) -> fora=true
    setSPNow('2026-05-05T15:00:00Z') // BRT 12:00 terca
    const wh = { tue: { open: true, start: '22:00', end: '06:00' } }
    expect(isOutsideBusinessHours(wh)).toBe(true)
    // BRT 23:00 esta dentro: 1380 >= 1320 (nao < start)
    setSPNow('2026-05-06T02:00:00Z') // BRT 23:00 terca
    expect(isOutsideBusinessHours(wh)).toBe(false)
  })
})

describe('isOutsideBusinessHours — formato legacy', () => {
  it('legacy { start, end } funciona em qualquer dia', () => {
    setSPNow('2026-05-05T15:00:00Z') // BRT 12:00 terca
    expect(isOutsideBusinessHours({ start: '08:00', end: '18:00' })).toBe(false)
    setSPNow('2026-05-05T23:00:00Z') // BRT 20:00 terca
    expect(isOutsideBusinessHours({ start: '08:00', end: '18:00' })).toBe(true)
  })

  it('legacy aplica mesmo no domingo', () => {
    setSPNow('2026-05-03T15:00:00Z') // domingo BRT 12:00
    // weekly fields sao ausentes -> cai no legacy
    expect(isOutsideBusinessHours({ start: '08:00', end: '18:00' })).toBe(false)
  })
})
