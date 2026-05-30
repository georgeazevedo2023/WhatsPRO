import { describe, expect, it } from 'vitest'
import { evaluateProductQualificationFlow } from './productQualificationFlow.ts'
import {
  buildHandoffStateTags,
  inferProductQualificationAnswerTag,
  buildProductQualificationStateTags,
  latestTagValue,
  mergeProductQualificationStateTags,
  readProductQualificationState,
} from './productQualificationState.ts'

const AGENT = {
  service_categories: {
    categories: [
      {
        id: 'porcelanatos_revestimentos',
        label: 'Porcelanatos e Revestimentos',
        interesse_match: 'porcelanato|revestimento|piso',
        catalog_status: 'digital',
        stages: [
          {
            id: 'pre_busca',
            label: 'Pre busca',
            min_score: 0,
            max_score: 3,
            exit_action: 'search_products',
            phrasing: 'Qual {label}?',
            fields: [
              { key: 'aplicacao', label: 'aplicacao', examples: 'piso, parede', score_value: 1, priority: 1 },
              { key: 'ambiente', label: 'ambiente', examples: 'residencial, comercial', score_value: 1, priority: 2 },
              { key: 'formato', label: 'formato', examples: '120x120', score_value: 1, priority: 3 },
            ],
          },
          {
            id: 'sem_catalogo',
            label: 'Sem catalogo',
            min_score: 3,
            max_score: 5,
            exit_action: 'handoff',
            phrasing: 'Qual {label}?',
            fields: [
              { key: 'acabamento', label: 'acabamento', examples: 'brilhante, acetinado', score_value: 1, priority: 1 },
              { key: 'cor', label: 'cor', examples: 'bege, cinza', score_value: 1, priority: 2 },
            ],
          },
        ],
      },
    ],
    default: {
      stages: [
        {
          id: 'fallback',
          label: 'Fallback',
          min_score: 0,
          max_score: 100,
          exit_action: 'handoff',
          phrasing: 'Qual {label}?',
          fields: [
            { key: 'especificacao', label: 'especificacao', examples: '', score_value: 1, priority: 1 },
          ],
        },
      ],
    },
  },
}

describe('readProductQualificationState', () => {
  it('traduz tags legadas search_fail/enrich_count para contrato premium', () => {
    const state = readProductQualificationState([
      'interesse:porcelanato marmorizado',
      'search_fail:porcelanato marmorizado',
      'enrich_count:2',
    ])

    expect(state.catalogResult).toBe('empty')
    expect(state.questionsAfterEmpty).toBe(2)
    expect(state.physicalStockRequired).toBe(true)
    expect(state.followupsPaused).toBe(false)
  })

  it('prioriza tags premium explicitas sobre estado legado', () => {
    const state = readProductQualificationState([
      'search_fail:porcelanato',
      'enrich_count:2',
      'catalog_result:found',
      'questions_after_empty:1',
      'physical_stock_required:false',
      'flow_mode:search',
    ])

    expect(state.catalogResult).toBe('found')
    expect(state.questionsAfterEmpty).toBe(1)
    expect(state.physicalStockRequired).toBe(false)
    expect(state.flowMode).toBe('search')
  })

  it('detecta estado de handoff completo', () => {
    const state = readProductQualificationState([
      'handoff_created:true',
      'agent_status:inactive',
      'human_assigned:true',
      'seller_notified:true',
      'followups_paused:true',
    ])

    expect(state.handoffCreated).toBe(true)
    expect(state.agentInactive).toBe(true)
    expect(state.humanAssigned).toBe(true)
    expect(state.sellerNotified).toBe(true)
    expect(state.followupsPaused).toBe(true)
  })
})

describe('inferProductQualificationAnswerTag', () => {
  it('captura perfil premium em resposta curta do lead', () => {
    expect(inferProductQualificationAnswerTag('perfil', 'Mais sofisticada')).toEqual({ perfil: 'premium' })
  })

  it('captura atributos de torneira gourmet', () => {
    expect(inferProductQualificationAnswerTag('ambiente_torneira', 'Boa tarde, voces tem torneira gourmet?')).toBeNull()
    expect(inferProductQualificationAnswerTag('ambiente_torneira', 'Area gourmet')).toEqual({
      ambiente_torneira: 'area gourmet',
    })
    expect(inferProductQualificationAnswerTag('tipo_cuba', 'Cuba dupla')).toEqual({ tipo_cuba: 'dupla' })
    expect(inferProductQualificationAnswerTag('acabamento_torneira', 'Preto fosco')).toEqual({
      acabamento_torneira: 'preto fosco',
    })
  })

  it('captura formato e area de revestimento', () => {
    expect(inferProductQualificationAnswerTag('formato', 'Quero 120x120')).toEqual({ formato: '120x120' })
    expect(inferProductQualificationAnswerTag('area', 'Uns 90 metros')).toEqual({ area: '90m2' })
  })
})

describe('build/merge product qualification state tags', () => {
  it('gera tags premium a partir do verdict do fluxo', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:porcelanato',
        'aplicacao:piso',
        'ambiente:residencial',
        'formato:120x120',
      ],
      agent: AGENT,
      catalogResult: 'empty',
    })

    const stateTags = buildProductQualificationStateTags(verdict)

    expect(stateTags).toContain('catalog_result:empty')
    expect(stateTags).toContain('flow_mode:qualify_then_handoff')
    expect(stateTags).toContain('physical_stock_required:true')
    expect(stateTags).toContain('search_enabled:false')
    expect(stateTags).toContain('show_carousel:false')
  })

  it('merge substitui apenas tags de estado e preserva contexto do lead', () => {
    const merged = mergeProductQualificationStateTags(
      [
        'interesse:porcelanato',
        'aplicacao:piso',
        'catalog_result:found',
        'flow_mode:search',
        'lead_score:3',
      ],
      [
        'catalog_result:empty',
        'flow_mode:qualify_then_handoff',
        'physical_stock_required:true',
      ],
    )

    expect(merged).toContain('interesse:porcelanato')
    expect(merged).toContain('aplicacao:piso')
    expect(merged).toContain('lead_score:3')
    expect(merged).not.toContain('catalog_result:found')
    expect(merged).not.toContain('flow_mode:search')
    expect(merged).toContain('catalog_result:empty')
    expect(merged).toContain('flow_mode:qualify_then_handoff')
  })

  it('buildHandoffStateTags registra pausa explicita de follow-up', () => {
    expect(buildHandoffStateTags()).toEqual([
      'handoff_created:true',
      'agent_status:inactive',
      'human_assigned:true',
      'seller_notified:true',
      'followups_paused:true',
    ])
  })

  it('latestTagValue retorna o valor mais recente', () => {
    expect(latestTagValue(['catalog_result:found', 'catalog_result:empty'], 'catalog_result')).toBe('empty')
  })
})
