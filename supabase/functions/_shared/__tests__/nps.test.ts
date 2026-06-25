import { describe, it, expect } from 'vitest'
import {
  buildNpsOptions,
  parseNpsScore,
  isLowScore,
  scoreLabel,
  buildManagerAlertText,
  NUMERIC_0_10_OPTIONS,
  DEFAULT_CATEGORICAL_OPTIONS,
} from '../nps.ts'

describe('buildNpsOptions', () => {
  it('numeric_0_10 → 11 opções "0".."10"', () => {
    expect(buildNpsOptions('numeric_0_10')).toEqual(NUMERIC_0_10_OPTIONS)
    expect(buildNpsOptions('numeric_0_10').length).toBe(11)
  })
  it('numeric cabe no limite de 12 opções da UAZAPI', () => {
    expect(buildNpsOptions('numeric_0_10').length).toBeLessThanOrEqual(12)
  })
  it('categorical usa as opções do agente quando válidas', () => {
    expect(buildNpsOptions('categorical', ['Ótimo', 'Ruim'])).toEqual(['Ótimo', 'Ruim'])
  })
  it('categorical cai no default quando opções faltam/insuficientes', () => {
    expect(buildNpsOptions('categorical', [])).toEqual(DEFAULT_CATEGORICAL_OPTIONS)
    expect(buildNpsOptions('categorical', ['só uma'])).toEqual(DEFAULT_CATEGORICAL_OPTIONS)
    expect(buildNpsOptions('categorical', null)).toEqual(DEFAULT_CATEGORICAL_OPTIONS)
  })
})

describe('parseNpsScore', () => {
  it('numeric: "8" → 8', () => {
    expect(parseNpsScore(['8'], 'numeric_0_10')).toBe(8)
  })
  it('numeric: "0" e "10" nas bordas', () => {
    expect(parseNpsScore(['0'], 'numeric_0_10')).toBe(0)
    expect(parseNpsScore(['10'], 'numeric_0_10')).toBe(10)
  })
  it('numeric: fora do range/ inválido → null', () => {
    expect(parseNpsScore(['11'], 'numeric_0_10')).toBeNull()
    expect(parseNpsScore(['abc'], 'numeric_0_10')).toBeNull()
    expect(parseNpsScore([], 'numeric_0_10')).toBeNull()
  })
  it('categorical: mapeia Excelente=5 .. Pessimo=1 (acento-insensível)', () => {
    expect(parseNpsScore(['Excelente'], 'categorical')).toBe(5)
    expect(parseNpsScore(['Péssimo'], 'categorical')).toBe(1)
    expect(parseNpsScore(['Regular'], 'categorical')).toBe(3)
  })
  it('categorical: opção desconhecida → null', () => {
    expect(parseNpsScore(['Talvez'], 'categorical')).toBeNull()
  })
})

describe('isLowScore (threshold do alerta)', () => {
  it('numeric <5: 0..4 são baixas; 5..10 não', () => {
    for (const n of [0, 1, 2, 3, 4]) expect(isLowScore([String(n)], 'numeric_0_10', 5)).toBe(true)
    for (const n of [5, 6, 7, 8, 9, 10]) expect(isLowScore([String(n)], 'numeric_0_10', 5)).toBe(false)
  })
  it('numeric: threshold configurável (≤6 detrator clássico via threshold=7)', () => {
    expect(isLowScore(['6'], 'numeric_0_10', 7)).toBe(true)
    expect(isLowScore(['7'], 'numeric_0_10', 7)).toBe(false)
  })
  it('categorical: Ruim/Pessimo/Péssimo são baixas; Bom/Excelente não', () => {
    expect(isLowScore(['Ruim'], 'categorical', 5)).toBe(true)
    expect(isLowScore(['Pessimo'], 'categorical', 5)).toBe(true)
    expect(isLowScore(['Péssimo'], 'categorical', 5)).toBe(true)
    expect(isLowScore(['Bom'], 'categorical', 5)).toBe(false)
    expect(isLowScore(['Excelente'], 'categorical', 5)).toBe(false)
  })
  it('voto vazio → não é nota baixa', () => {
    expect(isLowScore([], 'numeric_0_10', 5)).toBe(false)
    expect(isLowScore(null, 'categorical', 5)).toBe(false)
  })
})

describe('scoreLabel', () => {
  it('numeric → "N/10"', () => {
    expect(scoreLabel(['3'], 'numeric_0_10')).toBe('3/10')
  })
  it('categorical → a própria opção', () => {
    expect(scoreLabel(['Ruim'], 'categorical')).toBe('Ruim')
  })
})

describe('buildManagerAlertText', () => {
  it('inclui nota, cliente+telefone, atendente e resumo', () => {
    const t = buildManagerAlertText({
      scoreLabel: '3/10',
      customerName: 'João Silva',
      customerPhone: '+5587999990000',
      attendantName: 'Jussara',
      summary: 'Cliente queria mangueira; não fechou.',
    })
    expect(t).toContain('🔴 NPS baixo (3/10)')
    expect(t).toContain('João Silva')
    expect(t).toContain('+5587999990000')
    expect(t).toContain('Jussara')
    expect(t).toContain('Cliente queria mangueira')
  })
  it('degrada sem nome/telefone/resumo sem quebrar', () => {
    const t = buildManagerAlertText({
      scoreLabel: 'Ruim',
      customerName: null,
      customerPhone: null,
      attendantName: null,
      summary: null,
    })
    expect(t).toContain('Ruim')
    expect(t).toContain('sem nome')
  })
})
