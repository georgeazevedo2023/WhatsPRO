import { describe, it, expect } from 'vitest'
import { buildQualificationContext } from './qualificationContext.ts'
import { HORIZONTAL_QUALIF_PENDING_TAG } from '../horizontalQualif.ts'

// Minimal agent config compatible with serviceCategories defaults.
const MINIMAL_AGENT = {
  service_categories: {
    default: {
      label: 'Geral',
      interesse_match: '.*',
      stages: [],
      exit_action: 'handoff',
    },
    categories: [],
  },
}

describe('buildQualificationContext', () => {
  describe('R136 — horizontalPending', () => {
    it('retorna bloco HANDOFF MULTI-ITEM quando tag horizontal pending exata', () => {
      const r = buildQualificationContext([HORIZONTAL_QUALIF_PENDING_TAG], MINIMAL_AGENT)
      expect(r).toContain('[HANDOFF MULTI-ITEM')
      expect(r).toContain('handoff_to_human IMEDIATAMENTE')
      expect(r).toContain('PROIBIDO')
    })

    it('retorna bloco HANDOFF quando tag horizontal pending com sufixo', () => {
      const r = buildQualificationContext([`${HORIZONTAL_QUALIF_PENDING_TAG}:items=3`], MINIMAL_AGENT)
      expect(r).toContain('[HANDOFF MULTI-ITEM')
    })

    it('ignora tags sem prefixo horizontal', () => {
      const r = buildQualificationContext(['outra:tag'], MINIMAL_AGENT)
      expect(r).not.toContain('[HANDOFF MULTI-ITEM')
    })
  })

  describe('R129/R134 — multi_interesse_pending', () => {
    // Sem agentCfg válido, cai no DEFAULT_SERVICE_CATEGORIES_V2 (tintas, impermeabilizantes, caixas_dagua etc).
    // IDs desconhecidos fazem fallback `|| id` (em lowercase via .map).

    it('monta bloco MULTI-CATEGORIA com 2 ids desconhecidos (fallback id)', () => {
      const r = buildQualificationContext(['multi_interesse_pending:foo,bar'], {})
      expect(r).toContain('[QUALIFICAÇÃO MULTI-CATEGORIA')
      expect(r).toContain('LEAD PEDIU 2 CATEGORIAS')
      expect(r).toContain('foo, bar')
      expect(r).toContain('Posso te ajudar com foo e bar')
      expect(r).toContain('R134')
    })

    it('com 3+ categorias usa "X, Y e Z"', () => {
      const r = buildQualificationContext(['multi_interesse_pending:a,b,c'], {})
      expect(r).toContain('a, b, c')
      expect(r).toContain('a, b e c')
    })

    it('label do DEFAULT é usado em lowercase quando id casa (ex: tintas → "tintas e vernizes")', () => {
      const r = buildQualificationContext(['multi_interesse_pending:tintas,impermeabilizantes'], {})
      expect(r).toContain('tintas e vernizes')
      expect(r).toContain('impermeabilizantes e mantas')
    })

    it('ignora multi_interesse_pending com < 2 ids', () => {
      const r = buildQualificationContext(['multi_interesse_pending:tintas'], {})
      expect(r).toBe('')
    })

    it('multi vazio (csv "") cai pra qualif normal', () => {
      const r = buildQualificationContext(['multi_interesse_pending:'], {})
      expect(r).toBe('')
    })
  })

  describe('Qualif stage normal', () => {
    // Usa DEFAULT_SERVICE_CATEGORIES_V2 via agentCfg={}: categoria `tintas` casa
    // contra `interesse:tinta` (regex 'tinta|esmalte|verniz'). 3 stages, 6 fields.

    it('retorna vazio quando sem tag interesse', () => {
      const r = buildQualificationContext(['outra:tag'], {})
      expect(r).toBe('')
    })

    it('retorna vazio quando interesse não casa nenhuma categoria do DEFAULT', () => {
      const r = buildQualificationContext(['interesse:xyzunknown'], {})
      expect(r).toBe('')
    })

    it('monta bloco QUALIFICAÇÃO ATUAL com próxima pergunta = primeiro field do stage', () => {
      const r = buildQualificationContext(['interesse:tinta'], {})
      expect(r).toContain('[QUALIFICAÇÃO ATUAL')
      expect(r).toContain('Categoria detectada: Tintas e Vernizes')
      expect(r).toContain('PRÓXIMA PERGUNTA OBRIGATÓRIA: ambiente')
      expect(r).toContain('FRASE EXATA SUGERIDA')
      expect(r).toContain('R127')
    })

    it('R135 — anti-loop nudge substitui phrasing quando lead repetiu sem casar keywords', () => {
      // Sistema enviou pergunta sobre ambiente; lead respondeu "simples mesmo" (não casa interno/externo).
      const phrasing = 'Para encontrar a melhor opção, qual ambiente? (interno ou externo)'
      const recentMessages = [
        { direction: 'outgoing' as const, content: phrasing },
        { direction: 'incoming' as const, content: 'simples mesmo' },
      ]
      const r = buildQualificationContext(['interesse:tinta'], {}, recentMessages)
      // nudge anti-loop deve estar presente (não é literal "FRASE EXATA SUGERIDA" repetida)
      expect(r).toContain('[QUALIFICAÇÃO ATUAL')
      // O nudge contém "🗣️" mas troca o conteúdo
      expect(r).toContain('🗣️')
    })
  })

  describe('Edge cases', () => {
    it('lida com currentTags vazio', () => {
      const r = buildQualificationContext([], MINIMAL_AGENT)
      expect(r).toBe('')
    })

    it('lida com tags com itens não-string (filtra)', () => {
      const r = buildQualificationContext([null as any, undefined as any, 'interesse:xyzunknown'], {})
      // categoria não cadastrada → ''
      expect(r).toBe('')
    })

    it('priorizando R136 sobre R129 (quando ambos presentes)', () => {
      const r = buildQualificationContext(
        [HORIZONTAL_QUALIF_PENDING_TAG, 'multi_interesse_pending:tintas,caixas'],
        MINIMAL_AGENT,
      )
      expect(r).toContain('[HANDOFF MULTI-ITEM')
      expect(r).not.toContain('[QUALIFICAÇÃO MULTI-CATEGORIA')
    })
  })
})
