import { describe, expect, it } from 'vitest'
import {
  evaluateProductQualificationFlow,
  evaluateQualifyReaskGuard,
  detectSpecificItemRequest,
  getReaskState,
  extractCollectedFields,
  fieldBaseName,
  getNextRequiredField,
  isFieldAnswered,
  resolveProductCategory,
} from './productQualificationFlow.ts'
import type { ServiceCategoriesConfig, Stage } from '../serviceCategories.ts'

const PREMIUM_AGENT = {
  service_categories: {
    categories: [
      {
        id: 'tintas',
        label: 'Tintas',
        interesse_match: 'tinta|tintas|suvinil|coral',
        catalog_status: 'digital',
        stages: [
          {
            id: 'pre_busca',
            label: 'Pre busca',
            min_score: 0,
            max_score: 5,
            exit_action: 'search_products',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'objetivo', label: 'objetivo', examples: 'obra nova, reforma', score_value: 1, priority: 1 },
              { key: 'ambiente', label: 'ambiente', examples: 'interno, externo', score_value: 1, priority: 2 },
              { key: 'aplicacao', label: 'aplicacao', examples: 'parede, teto, porta', score_value: 1, priority: 3 },
              { key: 'tipo_tinta', label: 'tipo de tinta', examples: 'acrilica, esmalte, epoxi', score_value: 1, priority: 4 },
              { key: 'cor', label: 'cor', examples: 'branca, cinza', score_value: 1, priority: 5 },
            ],
          },
          {
            id: 'perfil',
            label: 'Perfil',
            min_score: 5,
            max_score: 7,
            exit_action: 'enrichment',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'perfil', label: 'perfil', examples: 'economica, intermediaria, premium', score_value: 1, priority: 1 },
            ],
          },
        ],
      },
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
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'aplicacao', label: 'aplicacao', examples: 'piso, parede', score_value: 1, priority: 1 },
              { key: 'ambiente', label: 'ambiente', examples: 'residencial, comercial', score_value: 1, priority: 2 },
              { key: 'formato', label: 'formato', examples: '60x60, 90x90, 120x120', score_value: 1, priority: 3 },
            ],
          },
          {
            id: 'sem_catalogo',
            label: 'Sem catalogo',
            min_score: 3,
            max_score: 7,
            exit_action: 'handoff',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'acabamento', label: 'acabamento', examples: 'brilhante, acetinado', score_value: 1, priority: 1 },
              { key: 'cor', label: 'cor', examples: 'bege, cinza, branco', score_value: 1, priority: 2 },
              { key: 'local_aplicacao', label: 'local de aplicacao', examples: 'sala, cozinha', score_value: 1, priority: 3 },
              { key: 'area', label: 'area', examples: 'metros quadrados', score_value: 1, priority: 4 },
            ],
          },
        ],
      },
      {
        id: 'torneiras_metais',
        label: 'Torneiras e Metais',
        interesse_match: 'torneira|misturador|metal',
        catalog_status: 'digital',
        stages: [
          {
            id: 'pre_busca',
            label: 'Pre busca',
            min_score: 0,
            max_score: 3,
            exit_action: 'search_products',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'aplicacao', label: 'aplicacao', examples: 'cozinha, area gourmet', score_value: 1, priority: 1 },
              { key: 'instalacao', label: 'instalacao', examples: 'bancada, parede', score_value: 1, priority: 2 },
              { key: 'modelo', label: 'modelo', examples: 'ducha flexivel, bica alta', score_value: 1, priority: 3 },
            ],
          },
          {
            id: 'sem_catalogo',
            label: 'Sem catalogo',
            min_score: 3,
            max_score: 6,
            exit_action: 'handoff',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'acabamento', label: 'acabamento', examples: 'cromado, preto fosco, dourado', score_value: 1, priority: 1 },
              { key: 'tipo_cuba', label: 'tipo de cuba', examples: 'simples, dupla', score_value: 1, priority: 2 },
              { key: 'perfil', label: 'perfil', examples: 'custo-beneficio, premium', score_value: 1, priority: 3 },
            ],
          },
        ],
      },
      {
        id: 'categoria_offline',
        label: 'Categoria Offline',
        interesse_match: 'premium sem catalogo',
        catalog_status: 'offline',
        stages: [
          {
            id: 'triagem',
            label: 'Triagem',
            min_score: 0,
            max_score: 3,
            exit_action: 'handoff',
            phrasing: 'Qual {label}? ({examples})',
            fields: [
              { key: 'aplicacao', label: 'aplicacao', examples: 'piso, parede', score_value: 1, priority: 1 },
              { key: 'medida', label: 'medida', examples: '60x60, 120x120', score_value: 1, priority: 2 },
              { key: 'cor', label: 'cor', examples: 'bege, branco', score_value: 1, priority: 3 },
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
  } satisfies ServiceCategoriesConfig,
}

describe('productQualificationFlow pure helpers', () => {
  it('resolve categoria por texto quando ainda nao existe tag interesse', () => {
    const { category } = resolveProductCategory([], PREMIUM_AGENT, 'Boa tarde, voces tem torneira gourmet?')
    expect(category?.id).toBe('torneiras_metais')
  })

  it('ignora meta tags ao calcular campos coletados', () => {
    const fields = extractCollectedFields([
      'interesse:tinta',
      'lead_score:2',
      'ambiente:interno',
      'catalog_result:empty',
      'cor:branca',
    ])
    expect([...fields].sort()).toEqual(['ambiente', 'cor'])
  })

  it('retorna o proximo campo pela ordem de stages e prioridade', () => {
    const stages = PREMIUM_AGENT.service_categories.categories[2].stages as Stage[]
    const next = getNextRequiredField(stages, new Set(['aplicacao', 'instalacao']))
    expect(next?.key).toBe('modelo')
  })
})

describe('evaluateProductQualificationFlow - catalogo com produto', () => {
  it('cenario 21.33: tinta generica ainda qualifica antes de buscar', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: ['interesse:tinta'],
      agent: PREMIUM_AGENT,
      incomingText: 'voces tem tinta?',
    })

    expect(verdict.categoryId).toBe('tintas')
    expect(verdict.flowMode).toBe('qualify')
    expect(verdict.readyToSearch).toBe(false)
    expect(verdict.searchEnabled).toBe(false)
    expect(verdict.nextRequiredField?.key).toBe('objetivo')
  })

  it('cenario 21.33: depois do score minimo libera busca e carousel quando encontrou produtos', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:tinta',
        'objetivo:reforma',
        'ambiente:interno',
        'aplicacao:parede',
        'tipo_tinta:acrilica',
        'cor:branca',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'found',
    })

    expect(verdict.flowMode).toBe('search')
    expect(verdict.readyToSearch).toBe(true)
    expect(verdict.searchEnabled).toBe(true)
    expect(verdict.showCarousel).toBe(true)
    expect(verdict.nextRequiredField).toBeNull()
    expect(verdict.qualificationScore).toBe(5)
  })
})

describe('evaluateProductQualificationFlow - catalogo vazio ou ausente', () => {
  it('cenario 21.36: porcelanato com catalogo vazio continua qualificando sem busca/carrossel', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:porcelanato marmorizado',
        'aplicacao:piso',
        'ambiente:residencial',
        'formato:120x120',
        'catalog_result:empty',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'empty',
      maxQuestionsAfterEmpty: 2,
    })

    expect(verdict.categoryId).toBe('porcelanatos_revestimentos')
    expect(verdict.flowMode).toBe('qualify_then_handoff')
    expect(verdict.readyToSearch).toBe(false)
    expect(verdict.searchEnabled).toBe(false)
    expect(verdict.showCarousel).toBe(false)
    expect(verdict.physicalStockRequired).toBe(true)
    expect(verdict.neutralStockLanguage).toBe(true)
    expect(verdict.nextRequiredField?.key).toBe('acabamento')
  })

  it('cenario 21.36: SOB o cap pos-vazio, segue qualificando (proximo campo)', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:porcelanato marmorizado',
        'aplicacao:piso',
        'ambiente:residencial',
        'formato:120x120',
        'acabamento:brilhante',
        'cor:bege claro',
        'questions_after_empty:1',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'empty',
      maxQuestionsAfterEmpty: 2,
    })

    expect(verdict.flowMode).toBe('qualify_then_handoff')
    expect(verdict.readyToHandoff).toBe(false)
    expect(verdict.readyToSearch).toBe(false)
    expect(verdict.nextRequiredField?.key).toBe('local_aplicacao')
    expect(verdict.physicalStockRequired).toBe(true)
  })

  it('CONVERGE: ao bater o cap pos-vazio, transborda mesmo com campo faltando', () => {
    // Regressao do incidente 21.37 (torneira gourmet): antes, categorias premium
    // exigiam TODOS os campos -> com mismatch de chave nunca fechavam -> loop infinito.
    // Agora o cap garante terminacao: bateu o limite de perguntas -> handoff.
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:porcelanato marmorizado',
        'aplicacao:piso',
        'ambiente:residencial',
        'formato:120x120',
        'acabamento:brilhante',
        'cor:bege claro',
        'questions_after_empty:2',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'empty',
      maxQuestionsAfterEmpty: 2,
    })

    expect(verdict.flowMode).toBe('handoff')
    expect(verdict.readyToHandoff).toBe(true)
    expect(verdict.physicalStockRequired).toBe(true)
  })

  it('cenario 21.37: torneira gourmet pergunta acabamento apos busca vazia', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:torneira gourmet',
        'aplicacao:cozinha',
        'instalacao:bancada',
        'modelo:ducha flexivel',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'empty',
    })

    expect(verdict.categoryId).toBe('torneiras_metais')
    expect(verdict.flowMode).toBe('qualify_then_handoff')
    expect(verdict.nextRequiredField?.key).toBe('acabamento')
    expect(verdict.physicalStockRequired).toBe(true)
    expect(verdict.searchEnabled).toBe(false)
  })

  it('categoria offline nunca busca mesmo com score alto', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:premium sem catalogo',
        'aplicacao:piso',
        'medida:120x120',
        'cor:bege',
        'lead_score:90',
      ],
      agent: PREMIUM_AGENT,
      catalogResult: 'unknown',
    })

    expect(verdict.catalogStatus).toBe('offline')
    expect(verdict.readyToSearch).toBe(false)
    expect(verdict.searchEnabled).toBe(false)
    expect(verdict.showCarousel).toBe(false)
    expect(verdict.readyToHandoff).toBe(true)
    expect(verdict.physicalStockRequired).toBe(true)
  })
})

describe('evaluateProductQualificationFlow - defaults premium Eletropiso', () => {
  it('default resolve porcelanato e pede aplicacao primeiro', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [],
      agent: { service_categories: null },
      incomingText: 'Boa tarde, voces tem porcelanato marmorizado?',
    })

    expect(verdict.categoryId).toBe('porcelanatos_revestimentos')
    expect(verdict.flowMode).toBe('qualify')
    expect(verdict.nextRequiredField?.key).toBe('aplicacao')
    expect(verdict.readyToSearch).toBe(false)
  })

  it('default resolve torneira gourmet e no catalogo vazio pede acabamento', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:torneira gourmet',
        'aplicacao:cozinha',
        'instalacao:bancada',
        'modelo:ducha flexivel',
      ],
      agent: { service_categories: null },
      catalogResult: 'empty',
    })

    expect(verdict.categoryId).toBe('torneiras_metais')
    expect(verdict.flowMode).toBe('qualify_then_handoff')
    expect(verdict.nextRequiredField?.key).toBe('acabamento')
    expect(verdict.searchEnabled).toBe(false)
    expect(verdict.physicalStockRequired).toBe(true)
  })
})

describe('mismatch de chave: tag generica satisfaz field suffixado (fix 21.37)', () => {
  it('fieldBaseName extrai a base antes do ultimo _', () => {
    expect(fieldBaseName('ambiente_torneira')).toBe('ambiente')
    expect(fieldBaseName('tipo_portao')).toBe('tipo')
    expect(fieldBaseName('material_porta')).toBe('material')
    expect(fieldBaseName('cor')).toBe('cor')
  })

  it('isFieldAnswered casa key exato OU base generica', () => {
    expect(isFieldAnswered('ambiente_torneira', new Set(['ambiente']))).toBe(true)
    expect(isFieldAnswered('cor', new Set(['cor']))).toBe(true)
    expect(isFieldAnswered('marca_torneira', new Set(['ambiente']))).toBe(false)
    // nao confunde com outro key que so COMPARTILHA prefixo parcial
    expect(isFieldAnswered('marca_torneira', new Set(['marca_citada']))).toBe(false)
  })

  it('getNextRequiredField: tag generica ambiente fecha ambiente_torneira', () => {
    const stages = [{
      id: 'qualificacao', label: 'Q', min_score: 0, max_score: 30, exit_action: 'handoff', phrasing: '',
      fields: [
        { key: 'ambiente_torneira', label: 'ambiente', examples: '', score_value: 10, priority: 1 },
        { key: 'tipo_torneira', label: 'tipo', examples: '', score_value: 10, priority: 2 },
      ],
    }] as unknown as Stage[]
    // com ambiente generico, o proximo campo pulado vira tipo_torneira (nao repergunta ambiente)
    expect(getNextRequiredField(stages, new Set(['ambiente']))?.key).toBe('tipo_torneira')
    // com ambos cobertos por bases genericas, nao falta nada
    expect(getNextRequiredField(stages, new Set(['ambiente', 'tipo']))).toBeNull()
  })
})

describe('pedido_original é meta (fix 21.36 marmorizado)', () => {
  it('não conta pedido_original como campo de qualificação respondido', () => {
    const answered = extractCollectedFields([
      'interesse:porcelanatos_revestimentos',
      'pedido_original:porcelanato marmorizado',
      'aplicacao:piso',
    ])
    expect(answered.has('pedido_original')).toBe(false)
    expect(answered.has('aplicacao')).toBe(true)
  })

  it('com pedido_original presente, o próximo campo ainda é formato (não pulado)', () => {
    const verdict = evaluateProductQualificationFlow({
      tags: [
        'interesse:porcelanatos_revestimentos',
        'pedido_original:porcelanato marmorizado',
        'aplicacao:piso',
        'ambiente:residencial',
      ],
      agent: PREMIUM_AGENT,
      incomingText: 'residencial',
    })
    expect(verdict.nextRequiredField?.key).toBe('formato')
  })
})

describe('captura da resposta desacoplada do cap (fix 21.36 área)', () => {
  // No turno em que o cap de perguntas pós-vazio é atingido, o verdict CAPADO
  // retorna readyToHandoff=true e nextRequiredField=null — então a última resposta
  // do lead (ex.: "Uns 90 metros" → area) seria descartada antes do handoff. O
  // index.ts passou a inferir a resposta com um teto ALTO (uncapped) pra SEMPRE
  // capturar o atributo informado. Estes testes provam os dois lados.
  const tagsAllButArea = [
    'interesse:porcelanatos_revestimentos',
    'aplicacao:piso', 'ambiente:residencial', 'formato:120x120',
    'acabamento:brilhante', 'cor:bege', 'local_aplicacao:sala e cozinha integradas',
    'catalog_result:empty', 'enriching:1', 'questions_after_empty:4',
  ]

  it('verdict CAPADO no cap: readyToHandoff e nextRequiredField=null (area se perderia)', () => {
    const capped = evaluateProductQualificationFlow({
      tags: tagsAllButArea, agent: PREMIUM_AGENT, incomingText: 'Uns 90 metros',
      catalogResult: 'empty', maxQuestionsAfterEmpty: 4,
    })
    expect(capped.readyToHandoff).toBe(true)
    expect(capped.nextRequiredField).toBeNull()
  })

  it('verdict UNCAPPED ainda aponta area como próximo campo (a resposta é capturável)', () => {
    const uncapped = evaluateProductQualificationFlow({
      tags: tagsAllButArea, agent: PREMIUM_AGENT, incomingText: 'Uns 90 metros',
      catalogResult: 'empty', maxQuestionsAfterEmpty: 99,
    })
    expect(uncapped.nextRequiredField?.key).toBe('area')
  })
})

// =============================================================================
// Bug 1 (loop Dauana, 2026-06-01) — anti-loop do qualify digital pré-busca.
// =============================================================================

describe('detectSpecificItemRequest (Bug 1)', () => {
  it('pega "o da foto" / "esse da foto"', () => {
    expect(detectSpecificItemRequest('Eu preciso desse que está na foto')).toBe(true)
    expect(detectSpecificItemRequest('quero o da foto')).toBe(true)
    expect(detectSpecificItemRequest('esse da foto mesmo')).toBe(true)
  })
  it('pega "que formato é essa?"', () => {
    expect(detectSpecificItemRequest('Que formato é essa?')).toBe(true)
    expect(detectSpecificItemRequest('que tamanho é esse')).toBe(true)
  })
  it('não dispara em resposta normal de qualificação', () => {
    expect(detectSpecificItemRequest('60x60')).toBe(false)
    expect(detectSpecificItemRequest('residencial')).toBe(false)
    expect(detectSpecificItemRequest('é pra parede')).toBe(false)
    expect(detectSpecificItemRequest('')).toBe(false)
  })
})

describe('evaluateQualifyReaskGuard (Bug 1)', () => {
  const base = { lastAskedField: 'formato', currentField: 'formato', answerWasInferred: false, specificItemRequested: false, reaskCount: 0, maxRetries: 2 }

  it('item específico → handoff imediato (ignora contador)', () => {
    const v = evaluateQualifyReaskGuard({ ...base, specificItemRequested: true })
    expect(v.action).toBe('handoff')
  })
  it('lead respondeu (inferido) → ask + reseta contador', () => {
    const v = evaluateQualifyReaskGuard({ ...base, answerWasInferred: true, reaskCount: 1 })
    expect(v.action).toBe('ask')
    expect(v.nextReaskCount).toBe(0)
  })
  it('campo mudou → ask + reseta', () => {
    const v = evaluateQualifyReaskGuard({ ...base, lastAskedField: 'ambiente', currentField: 'formato', reaskCount: 1 })
    expect(v.action).toBe('ask')
    expect(v.nextReaskCount).toBe(0)
  })
  it('mesmo campo sem resposta, 1ª vez → ask (incrementa)', () => {
    const v = evaluateQualifyReaskGuard({ ...base, reaskCount: 0, maxRetries: 2 })
    expect(v.action).toBe('ask')
    expect(v.nextReaskCount).toBe(1)
  })
  it('mesmo campo sem resposta, atinge maxRetries → handoff', () => {
    const v = evaluateQualifyReaskGuard({ ...base, reaskCount: 1, maxRetries: 2 })
    expect(v.action).toBe('handoff')
    expect(v.nextReaskCount).toBe(2)
  })
  it('maxRetries=1 → handoff já na 1ª re-pergunta sem resposta', () => {
    const v = evaluateQualifyReaskGuard({ ...base, reaskCount: 0, maxRetries: 1 })
    expect(v.action).toBe('handoff')
    expect(v.nextReaskCount).toBe(1)
  })
})

describe('getReaskState (Bug 1)', () => {
  it('lê o contador da tag qualify_reask:<field>:<n>', () => {
    expect(getReaskState(['interesse:revestimentos', 'qualify_reask:formato:1'])).toEqual({ field: 'formato', count: 1 })
  })
  it('campo sem dígito → count 0', () => {
    expect(getReaskState(['qualify_reask:formato:x'])).toEqual({ field: 'formato', count: 0 })
  })
  it('sem tag → field null count 0', () => {
    expect(getReaskState(['interesse:tintas'])).toEqual({ field: null, count: 0 })
    expect(getReaskState(null)).toEqual({ field: null, count: 0 })
  })
})
