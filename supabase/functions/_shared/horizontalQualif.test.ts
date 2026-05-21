import { describe, it, expect } from 'vitest'
import {
  buildHorizontalQuestion,
  buildHorizontalHandoffReason,
  HORIZONTAL_QUALIF_PENDING_TAG,
} from './horizontalQualif.ts'

// Mock local do tipo MultiItemDetectorResult — o detector real (multiItemDetector.ts) está
// sendo criado em paralelo (Wave 1, task #8). Testes não dependem do runtime do detector.
type MultiItemDetectedItem = {
  raw: string
  quantity: number | null
  matchedCategoryId: string | null
  productHint: string
}
type MultiItemDetectorResult = {
  detected: boolean
  items: MultiItemDetectedItem[]
  mixed: boolean
  orphanCount: number
  reason: 'numbered_list' | 'comma_separated' | 'newline_separated' | null
}

// Caso real Paloma (R136): "1 massa PVA / 1 Latão de tinta branco neve / 15 lixas d'água N° 150"
function palomaDetector(): MultiItemDetectorResult {
  return {
    detected: true,
    mixed: true,
    orphanCount: 2,
    reason: 'newline_separated',
    items: [
      { raw: '1 massa PVA', quantity: 1, matchedCategoryId: null, productHint: 'massa PVA' },
      {
        raw: '1 Latão de tinta branco neve',
        quantity: 1,
        matchedCategoryId: 'tintas',
        productHint: 'Latão de tinta branco neve',
      },
      {
        raw: "15 lixas d'água N° 150",
        quantity: 15,
        matchedCategoryId: null,
        productHint: "lixas d'água N° 150",
      },
    ],
  }
}

describe('buildHorizontalQuestion', () => {
  it('mix tintas + orphans (Paloma): pergunta inclui ambiente e marca/tipo/qualidade + nome do lead', () => {
    const q = buildHorizontalQuestion({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: "1 massa PVA\n1 Latão de tinta branco neve\n15 lixas d'água N° 150",
    })
    expect(q.text.startsWith('Paloma,')).toBe(true)
    expect(q.text).toMatch(/ambiente/i)
    expect(q.text).toMatch(/marca/i)
    expect(q.text).toMatch(/tinta|qualidade/i)
    expect(q.pendingTag).toBe(HORIZONTAL_QUALIF_PENDING_TAG)
  })

  it('só orphans: pergunta genérica (ambiente + marca/tipo/qualidade)', () => {
    const det: MultiItemDetectorResult = {
      detected: true,
      mixed: false,
      orphanCount: 2,
      reason: 'comma_separated',
      items: [
        { raw: 'parafuso sextavado', quantity: 10, matchedCategoryId: null, productHint: 'parafuso sextavado' },
        { raw: 'arruela', quantity: 20, matchedCategoryId: null, productHint: 'arruela' },
      ],
    }
    const q = buildHorizontalQuestion({ detector: det, leadName: 'Carlos', originalText: 'parafuso, arruela' })
    expect(q.text).toMatch(/ambiente/i)
    expect(q.text).toMatch(/marca|tipo|qualidade/i)
    // não deve mencionar "tinta" especificamente quando só orphans
    expect(q.text.toLowerCase()).not.toContain('tipo de tinta')
  })

  it('portas/janelas: pergunta menciona material e tamanho', () => {
    const det: MultiItemDetectorResult = {
      detected: true,
      mixed: true,
      orphanCount: 1,
      reason: 'numbered_list',
      items: [
        { raw: '1 porta', quantity: 1, matchedCategoryId: 'portas', productHint: 'porta' },
        { raw: '2 dobradiças', quantity: 2, matchedCategoryId: null, productHint: 'dobradiças' },
      ],
    }
    const q = buildHorizontalQuestion({ detector: det, leadName: null, originalText: '1 porta\n2 dobradiças' })
    expect(q.text).toMatch(/material/i)
    expect(q.text).toMatch(/tamanho/i)
  })

  it('sem leadName: omite vírgula+nome', () => {
    const q = buildHorizontalQuestion({
      detector: palomaDetector(),
      leadName: null,
      originalText: 'x',
    })
    expect(q.text.startsWith('Anotei aqui.')).toBe(true)
    expect(q.text).not.toMatch(/^[A-Z][a-z]+,/)
  })

  it('tamanho da pergunta <= 250 chars', () => {
    const q = buildHorizontalQuestion({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: 'x',
    })
    expect(q.text.length).toBeLessThanOrEqual(250)
  })
})

describe('buildHorizontalHandoffReason', () => {
  it('repro Paloma: reason inclui nome, 3 linhas dos items, contexto e mensagem original', () => {
    const r = buildHorizontalHandoffReason({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: "1 massa PVA\n1 Latão de tinta branco neve\n15 lixas d'água N° 150",
      leadAnswerToHorizontal: 'interno, marca Suvinil, qualidade boa',
    })
    expect(r.reason).toContain('Paloma')
    expect(r.reason).toContain('1× massa PVA (sem categoria cadastrada)')
    expect(r.reason).toContain('1× Latão de tinta branco neve (categoria: tintas)')
    expect(r.reason).toContain("15× lixas d'água N° 150 (sem categoria cadastrada)")
    expect(r.reason).toContain('Contexto coletado:')
    expect(r.reason).toContain('Mensagem original:')
    expect(r.reason).toContain('Suvinil')
  })

  it('leadAnswerToHorizontal vazio: reason válido sem seção "Contexto coletado:"', () => {
    const r = buildHorizontalHandoffReason({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: 'algo',
      leadAnswerToHorizontal: '',
    })
    expect(r.reason).toContain('Paloma')
    expect(r.reason).not.toContain('Contexto coletado:')
    expect(r.reason).toContain('Mensagem original:')
  })

  it('truncamento: original_text gigante (1000 chars) preservado mas truncado em ~200', () => {
    const big = 'x'.repeat(1000)
    const r = buildHorizontalHandoffReason({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: big,
      leadAnswerToHorizontal: 'resposta',
    })
    // bloco da mensagem original não pode ter 1000 chars
    const idx = r.reason.indexOf('Mensagem original:')
    const tail = r.reason.slice(idx)
    expect(tail.length).toBeLessThanOrEqual(250)
    expect(tail).toContain('...')
  })

  it('sanitização: \\n\\n\\n excesso normalizado pra \\n', () => {
    const r = buildHorizontalHandoffReason({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: 'linha1\n\n\n\nlinha2',
      leadAnswerToHorizontal: 'ok\n\n\nfim',
    })
    expect(r.reason).not.toMatch(/\n{2,}(?!\s*Contexto|\s*Mensagem)/)
    // dentro do conteúdo sanitizado (entre os marcadores) não deve ter \n\n\n
    expect(r.reason).not.toContain('\n\n\n')
  })

  it('pendingTag é exatamente "qualif_horizontal:pending"', () => {
    expect(HORIZONTAL_QUALIF_PENDING_TAG).toBe('qualif_horizontal:pending')
    const q = buildHorizontalQuestion({
      detector: palomaDetector(),
      leadName: 'Paloma',
      originalText: 'x',
    })
    expect(q.pendingTag).toBe('qualif_horizontal:pending')
  })
})
