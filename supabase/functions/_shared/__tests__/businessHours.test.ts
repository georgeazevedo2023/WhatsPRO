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

// =====================================================================
// B31 (2026-05-17): formatBusinessHours + enrichOutsideHoursMessage
// =====================================================================
import { formatBusinessHours, enrichOutsideHoursMessage } from '../businessHours.ts'

describe('formatBusinessHours', () => {
  it('agrupa Seg-Sex com mesmo horário', () => {
    const wh = {
      mon: { open: true, start: '08:00', end: '18:00' },
      tue: { open: true, start: '08:00', end: '18:00' },
      wed: { open: true, start: '08:00', end: '18:00' },
      thu: { open: true, start: '08:00', end: '18:00' },
      fri: { open: true, start: '08:00', end: '18:00' },
      sat: { open: true, start: '08:00', end: '12:00' },
      sun: { open: false },
    }
    expect(formatBusinessHours(wh)).toBe('Seg-Sex 8h-18h, Sáb 8h-12h')
  })

  it('domingo fechado fica implícito', () => {
    const wh = {
      mon: { open: true, start: '09:00', end: '19:00' },
      tue: { open: true, start: '09:00', end: '19:00' },
      wed: { open: true, start: '09:00', end: '19:00' },
      thu: { open: true, start: '09:00', end: '19:00' },
      fri: { open: true, start: '09:00', end: '19:00' },
      sat: { open: true, start: '09:00', end: '19:00' },
      sun: { open: false },
    }
    expect(formatBusinessHours(wh)).toBe('Seg-Sáb 9h-19h')
  })

  it('dias não-consecutivos viram lista', () => {
    const wh = {
      mon: { open: true, start: '10:00', end: '16:00' },
      tue: { open: false },
      wed: { open: true, start: '10:00', end: '16:00' },
      thu: { open: false },
      fri: { open: true, start: '10:00', end: '16:00' },
      sat: { open: false },
      sun: { open: false },
    }
    expect(formatBusinessHours(wh)).toBe('Seg 10h-16h, Qua 10h-16h, Sex 10h-16h')
  })

  it('null / inválido retorna null (24/7)', () => {
    expect(formatBusinessHours(null)).toBeNull()
    expect(formatBusinessHours(undefined)).toBeNull()
    expect(formatBusinessHours({})).toBeNull()
  })

  it('minutos quebrados aparecem (8h30)', () => {
    const wh = {
      mon: { open: true, start: '08:30', end: '17:30' },
    }
    expect(formatBusinessHours(wh)).toBe('Seg 8h30-17h30')
  })
})

describe('enrichOutsideHoursMessage', () => {
  const wh = {
    mon: { open: true, start: '08:00', end: '18:00' },
    tue: { open: true, start: '08:00', end: '18:00' },
    wed: { open: true, start: '08:00', end: '18:00' },
    thu: { open: true, start: '08:00', end: '18:00' },
    fri: { open: true, start: '08:00', end: '18:00' },
    sat: { open: true, start: '08:00', end: '12:00' },
    sun: { open: false },
  }

  it('injeta horários quando msg é genérica', () => {
    const msg = 'Anotei seu pedido e retornaremos em breve.'
    expect(enrichOutsideHoursMessage(msg, wh))
      .toBe('Estamos fora do horário (Seg-Sex 8h-18h, Sáb 8h-12h). Anotei seu pedido e retornaremos em breve.')
  })

  it('não toca msg que já menciona horário (8h)', () => {
    const msg = 'Estamos fechados até 8h amanhã.'
    expect(enrichOutsideHoursMessage(msg, wh)).toBe(msg)
  })

  it('não toca msg que já menciona "horário"', () => {
    const msg = 'Fora do nosso horário de atendimento.'
    expect(enrichOutsideHoursMessage(msg, wh)).toBe(msg)
  })

  it('retorna msg original se business_hours null', () => {
    const msg = 'Mensagem qualquer.'
    expect(enrichOutsideHoursMessage(msg, null)).toBe(msg)
  })

  it('retorna msg vazia se input vazio', () => {
    expect(enrichOutsideHoursMessage('', wh)).toBe('')
  })
})

// #4 (2026-05-24): personalizeHandoffMessage — nome + item no transbordo
import { personalizeHandoffMessage } from '../businessHours.ts'

describe('personalizeHandoffMessage', () => {
  const base = 'No momento estamos fora do horário de atendimento. Nosso consultor dará prosseguimento. 😊'

  it('cita nome + item (caso George/telhas)', () => {
    const out = personalizeHandoffMessage(base, {
      leadName: 'George',
      itemSummary: 'Pedido de 50 telhas Brasilit 244x110',
    })
    expect(out).toBe(`George, anotei seu pedido: 50 telhas Brasilit 244x110. ${base}`)
  })

  it('usa só o primeiro nome', () => {
    const out = personalizeHandoffMessage(base, { leadName: 'Maria Silva', itemSummary: 'tinta acrílica branca' })
    expect(out.startsWith('Maria, anotei seu pedido: tinta acrílica branca.')).toBe(true)
    expect(out).not.toContain('Silva')
  })

  it('só nome (sem item) → "anotei tudo aqui"', () => {
    const out = personalizeHandoffMessage(base, { leadName: 'Carlos', itemSummary: null })
    expect(out).toBe(`Carlos, anotei tudo aqui. ${base}`)
  })

  it('só item (sem nome) → capitaliza Anotei', () => {
    const out = personalizeHandoffMessage(base, { leadName: null, itemSummary: '10 lâmpadas LED 9W' })
    expect(out).toBe(`Anotei seu pedido: 10 lâmpadas LED 9W. ${base}`)
  })

  it('no-op quando não há nome nem item', () => {
    expect(personalizeHandoffMessage(base, {})).toBe(base)
    expect(personalizeHandoffMessage(base, { leadName: '', itemSummary: '' })).toBe(base)
  })

  it('descarta código interno de reason (telha_fora_hora)', () => {
    const out = personalizeHandoffMessage(base, { leadName: 'João', itemSummary: 'telha_fora_hora' })
    expect(out).toBe(`João, anotei tudo aqui. ${base}`) // item ignorado, nome mantido
  })

  it('strip do sufixo de código COLADO na frase (caso E2E "interna_fora_hora")', () => {
    const reason = 'impermeabilizante manta líquida para laje externa 20m² + tinta acrílica branca para parede interna_fora_hora'
    const out = personalizeHandoffMessage(base, { leadName: 'Maria', itemSummary: reason })
    expect(out).not.toContain('_fora_hora')
    expect(out).toContain('parede interna')
    expect(out).toContain('manta líquida')
    expect(out.startsWith('Maria, anotei seu pedido:')).toBe(true)
  })

  it('strip de prefixo redundante "Pedido de"/"interesse em"', () => {
    expect(personalizeHandoffMessage(base, { itemSummary: 'interesse em porcelanato 60x60' }))
      .toBe(`Anotei seu pedido: porcelanato 60x60. ${base}`)
  })

  it('não duplica nome se a msg já começa com ele', () => {
    const msg = 'George, seu pedido foi anotado!'
    const out = personalizeHandoffMessage(msg, { leadName: 'George', itemSummary: 'tinta' })
    // não vira "George, ... George, ..."; só adiciona o ack sem repetir o nome
    expect(out.match(/George/g)?.length).toBe(1)
  })

  it('msg vazia retorna vazia', () => {
    expect(personalizeHandoffMessage('', { leadName: 'X', itemSummary: 'y' })).toBe('')
  })

  it('trunca item muito longo (cap 160)', () => {
    const longItem = 'a'.repeat(220)
    const out = personalizeHandoffMessage(base, { itemSummary: longItem })
    expect(out).toContain('…')
    expect(out.length).toBeLessThan(base.length + 185) // 160 do item + "Anotei seu pedido: …. "
  })

  it('strip "Pedido completo:" + descarta meta-nota pro vendedor (caso E2E multi-item)', () => {
    const reason =
      'Pedido completo: 1 tinta acrílica Fosco Standard 16L Branco Coral e 1 manta líquida 18Kg Quartzolit. Lead já confirmou que é só isso.'
    const out = personalizeHandoffMessage(base, { leadName: 'Carlos', itemSummary: reason })
    // mantém os 2 itens do orçamento
    expect(out).toContain('1 tinta acrílica Fosco Standard 16L Branco Coral')
    expect(out).toContain('1 manta líquida 18Kg Quartzolit')
    // sem "Pedido completo:" duplicado e sem a meta-nota do vendedor
    expect(out).not.toContain('Pedido completo:')
    expect(out).not.toContain('Lead já confirmou')
    expect(out.startsWith('Carlos, anotei seu pedido: 1 tinta acrílica')).toBe(true)
  })
})
