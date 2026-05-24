import { describe, it, expect } from 'vitest'
import { evaluateQualificationGate } from './qualificationGate.ts'

// Agent vazio → cai no DEFAULT_SERVICE_CATEGORIES_V2:
//   tintas (digital): stage Identificação 0-30 exit=search_products; → limiar busca = 30
//   impermeabilizantes (digital): stage Triagem 0-60 exit=search_products; → limiar = 60
const DEFAULT_AGENT = { service_categories: null }

// Agent com categoria OFFLINE (loja vende, catálogo digital não tem inventory).
const OFFLINE_AGENT = {
  service_categories: {
    categories: [
      {
        id: 'lampadas',
        label: 'Lâmpadas',
        interesse_match: 'lampada|lâmpada|led',
        catalog_status: 'offline',
        stages: [
          {
            id: 'triagem', label: 'Triagem', min_score: 0, max_score: 100, exit_action: 'handoff',
            fields: [{ key: 'tipo', label: 'tipo', examples: 'led, fluorescente', score_value: 50, priority: 1 }],
            phrasing: 'Qual {label}? ({examples})',
          },
        ],
      },
    ],
    default: { stages: [
      { id: 'q', label: 'Q', min_score: 0, max_score: 100, exit_action: 'handoff',
        fields: [{ key: 'd', label: 'detalhe', examples: '', score_value: 50, priority: 1 }], phrasing: 'me conta {label}?' },
    ] },
  },
}

describe('evaluateQualificationGate', () => {
  describe('sem categoria resolvível', () => {
    it('ready=true mode=no_category quando texto não casa nenhuma categoria', () => {
      const v = evaluateQualificationGate({ tags: [], agent: DEFAULT_AGENT, incomingText: 'bom dia tudo bem?' })
      expect(v.readyToSearch).toBe(true)
      expect(v.mode).toBe('no_category')
      expect(v.category).toBeNull()
    })
  })

  describe('categoria digital (tintas, limiar=30)', () => {
    it('score 0 → ready=false mode=qualify (qualifica primeiro)', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:tinta'], agent: DEFAULT_AGENT, incomingText: 'vcs tem tinta?' })
      expect(v.readyToSearch).toBe(false)
      expect(v.mode).toBe('qualify')
      expect(v.categoryId).toBe('tintas')
      expect(v.searchReadyScore).toBe(30)
      expect(v.score).toBe(0)
    })

    it('score 15 (1 campo) → ainda qualify', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:tinta', 'ambiente:interno', 'lead_score:15'], agent: DEFAULT_AGENT })
      expect(v.readyToSearch).toBe(false)
      expect(v.mode).toBe('qualify')
      expect(v.score).toBe(15)
    })

    it('score 30 (limiar) → ready=true mode=search', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:tinta', 'ambiente:interno', 'cor:branco', 'lead_score:30'], agent: DEFAULT_AGENT })
      expect(v.readyToSearch).toBe(true)
      expect(v.mode).toBe('search')
      expect(v.score).toBe(30)
    })

    it('score acima do limiar → ready=true mode=search', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:tinta', 'lead_score:55'], agent: DEFAULT_AGENT })
      expect(v.readyToSearch).toBe(true)
      expect(v.mode).toBe('search')
    })

    it('resolve categoria pelo texto quando não há tag interesse:', () => {
      const v = evaluateQualificationGate({ tags: [], agent: DEFAULT_AGENT, incomingText: 'quero tinta branca' })
      expect(v.categoryId).toBe('tintas')
      expect(v.mode).toBe('qualify')
    })
  })

  describe('categoria digital com limiar maior (impermeabilizantes, limiar=60)', () => {
    it('score 30 ainda qualify (limiar é 60)', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:impermeabilizante', 'lead_score:30'], agent: DEFAULT_AGENT })
      expect(v.readyToSearch).toBe(false)
      expect(v.searchReadyScore).toBe(60)
    })
    it('score 60 → search', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:impermeabilizante', 'lead_score:60'], agent: DEFAULT_AGENT })
      expect(v.readyToSearch).toBe(true)
      expect(v.mode).toBe('search')
    })
  })

  describe('categoria offline (loja vende, catálogo não tem)', () => {
    it('nunca busca: ready=false mode=qualify_then_handoff mesmo com score alto', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:lampadas', 'lead_score:90'], agent: OFFLINE_AGENT, incomingText: 'tem lampada led?' })
      expect(v.readyToSearch).toBe(false)
      expect(v.mode).toBe('qualify_then_handoff')
      expect(v.catalogStatus).toBe('offline')
      expect(v.searchReadyScore).toBeNull()
    })

    it('resolve offline pelo texto (led)', () => {
      const v = evaluateQualificationGate({ tags: [], agent: OFFLINE_AGENT, incomingText: 'vcs tem lâmpada led?' })
      expect(v.categoryId).toBe('lampadas')
      expect(v.mode).toBe('qualify_then_handoff')
    })
  })

  describe('robustez', () => {
    it('tags null não quebra', () => {
      const v = evaluateQualificationGate({ tags: null, agent: DEFAULT_AGENT, incomingText: 'oi' })
      expect(v.mode).toBe('no_category')
    })
    it('agent null → usa default e qualifica tinta', () => {
      const v = evaluateQualificationGate({ tags: ['interesse:tinta'], agent: null })
      expect(v.categoryId).toBe('tintas')
      expect(v.mode).toBe('qualify')
    })
  })
})
