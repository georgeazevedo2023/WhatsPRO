import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SERVICE_CATEGORIES_V2,
  getCategoriesOrDefault,
  matchCategory,
  getCurrentStage,
  getNextField,
  getScoreFromTags,
  getExitAction,
  calculateScoreDelta,
  getQualificationFields,
  formatPhrasing,
  extractInteresseFromTags,
  type ServiceCategoriesConfig,
  type ServiceCategory,
  type Stage,
  type QualificationField,
} from './serviceCategories.ts'

const tintas = DEFAULT_SERVICE_CATEGORIES_V2.categories.find(c => c.id === 'tintas')!
const imperm = DEFAULT_SERVICE_CATEGORIES_V2.categories.find(c => c.id === 'impermeabilizantes')!
const fallback = DEFAULT_SERVICE_CATEGORIES_V2.default

// =============================================================================
// matchCategory
// =============================================================================
describe('matchCategory', () => {
  it('case 1 — "tinta" matcha categoria tintas', () => {
    expect(matchCategory('tinta', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('tintas')
  })

  it('case 2 — "verniz" matcha categoria tintas', () => {
    expect(matchCategory('verniz', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('tintas')
  })

  it('case 3 — "esmalte" matcha categoria tintas', () => {
    expect(matchCategory('esmalte', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('tintas')
  })

  it('case 4 — "impermeabilizante" matcha tintas (primeira regex que casa)', () => {
    // tintas.regex tambem inclui "impermeabilizante" -> primeira a casar vence
    const cat = matchCategory('impermeabilizante', DEFAULT_SERVICE_CATEGORIES_V2)
    expect(['tintas', 'impermeabilizantes']).toContain(cat?.id)
  })

  it('case 5 — "manta" matcha apenas categoria impermeabilizantes', () => {
    expect(matchCategory('manta', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('impermeabilizantes')
  })

  it('case 6 — "camiseta" nao matcha nada -> null', () => {
    expect(matchCategory('camiseta', DEFAULT_SERVICE_CATEGORIES_V2)).toBeNull()
  })

  it('case 7 — interesse vazio retorna null', () => {
    expect(matchCategory('', DEFAULT_SERVICE_CATEGORIES_V2)).toBeNull()
    expect(matchCategory('   ', DEFAULT_SERVICE_CATEGORIES_V2)).toBeNull()
    expect(matchCategory(null, DEFAULT_SERVICE_CATEGORIES_V2)).toBeNull()
    expect(matchCategory(undefined, DEFAULT_SERVICE_CATEGORIES_V2)).toBeNull()
  })

  it('case 8 — regex invalido em interesse_match nao crasha, ignora categoria', () => {
    const broken: ServiceCategoriesConfig = {
      categories: [
        {
          id: 'broken',
          label: 'Broken',
          interesse_match: '[unclosed',
          stages: [
            {
              id: 's1', label: 'S1', min_score: 0, max_score: 100, exit_action: 'handoff',
              fields: [{ key: 'a', label: 'a', examples: '', score_value: 50, priority: 1 }],
              phrasing: 'X',
            },
          ],
        },
        {
          id: 'tintas', label: 'Tintas', interesse_match: 'tinta',
          stages: [
            {
              id: 's1', label: 'S1', min_score: 0, max_score: 100, exit_action: 'handoff',
              fields: [{ key: 'a', label: 'a', examples: '', score_value: 50, priority: 1 }],
              phrasing: 'X',
            },
          ],
        },
      ],
      default: fallback,
    }
    expect(matchCategory('tinta', broken)?.id).toBe('tintas')
  })

  it('case-insensitive (regex tem flag i)', () => {
    expect(matchCategory('TINTA', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('tintas')
    expect(matchCategory('Tinta Acrílica', DEFAULT_SERVICE_CATEGORIES_V2)?.id).toBe('tintas')
  })
})

// =============================================================================
// getCurrentStage
// =============================================================================
describe('getCurrentStage', () => {
  it('case 9 — score 0 -> Identificação (Stage 1) em tintas', () => {
    expect(getCurrentStage(0, tintas, fallback).id).toBe('identificacao')
  })

  it('case 10 — score 20 -> Identificação em tintas', () => {
    expect(getCurrentStage(20, tintas, fallback).id).toBe('identificacao')
  })

  it('case 11 — score 30 (boundary) -> Detalhamento em tintas', () => {
    // Intervalo [30, 70) -> 30 cai em detalhamento
    expect(getCurrentStage(30, tintas, fallback).id).toBe('detalhamento')
  })

  it('case 12 — score 50 -> Detalhamento em tintas', () => {
    expect(getCurrentStage(50, tintas, fallback).id).toBe('detalhamento')
  })

  it('case 13 — score 70 (boundary) -> Fechamento em tintas', () => {
    // Intervalo [70, 100) -> 70 cai em fechamento
    expect(getCurrentStage(70, tintas, fallback).id).toBe('fechamento')
  })

  it('case 14 — score 100 (overflow no ultimo) -> Fechamento (clamp)', () => {
    expect(getCurrentStage(100, tintas, fallback).id).toBe('fechamento')
  })

  it('case 15 — score 150 (super-overflow) -> ultimo stage', () => {
    expect(getCurrentStage(150, tintas, fallback).id).toBe('fechamento')
  })

  it('case 16 — category=null -> usa fallback default (qualificacao_basica)', () => {
    expect(getCurrentStage(0, null, fallback).id).toBe('qualificacao_basica')
    expect(getCurrentStage(50, null, fallback).id).toBe('qualificacao_basica')
    expect(getCurrentStage(150, null, fallback).id).toBe('qualificacao_basica')
  })

  it('score negativo -> primeiro stage (clamp)', () => {
    expect(getCurrentStage(-10, tintas, fallback).id).toBe('identificacao')
  })

  it('NaN -> primeiro stage (defesa)', () => {
    expect(getCurrentStage(NaN, tintas, fallback).id).toBe('identificacao')
  })

  it('impermeabilizantes: score 30 -> triagem (intervalo 0-60)', () => {
    expect(getCurrentStage(30, imperm, fallback).id).toBe('triagem')
  })

  it('impermeabilizantes: score 60 (boundary) -> fechamento', () => {
    expect(getCurrentStage(60, imperm, fallback).id).toBe('fechamento')
  })
})

// =============================================================================
// getScoreFromTags
// =============================================================================
describe('getScoreFromTags', () => {
  it('case 17 — ["lead_score:45"] retorna 45', () => {
    expect(getScoreFromTags(['lead_score:45'])).toBe(45)
  })

  it('case 18 — sem tag lead_score retorna 0', () => {
    expect(getScoreFromTags(['interesse:tinta', 'cor:azul'])).toBe(0)
  })

  it('case 19 — "lead_score:abc" (invalido) retorna 0', () => {
    expect(getScoreFromTags(['lead_score:abc'])).toBe(0)
  })

  it('case 20 — multiplas tags -> ultima valida vence', () => {
    expect(getScoreFromTags(['lead_score:10', 'outras', 'lead_score:30'])).toBe(30)
  })

  it('tags=null/undefined -> 0', () => {
    expect(getScoreFromTags(null)).toBe(0)
    expect(getScoreFromTags(undefined)).toBe(0)
  })

  it('tags=[] -> 0', () => {
    expect(getScoreFromTags([])).toBe(0)
  })

  it('lead_score:0 retorna 0 (zero valido)', () => {
    expect(getScoreFromTags(['lead_score:0'])).toBe(0)
  })

  it('lead_score com espacos extras -> trim', () => {
    expect(getScoreFromTags(['lead_score:  45  '])).toBe(45)
  })

  it('lead_score negativo -> retorna negativo (caller decide clamp)', () => {
    expect(getScoreFromTags(['lead_score:-5'])).toBe(-5)
  })

  it('ignora tags nao-string', () => {
    // @ts-expect-error testando defesa contra runtime
    expect(getScoreFromTags([null, 123, 'lead_score:42'])).toBe(42)
  })
})

// =============================================================================
// getNextField
// =============================================================================
describe('getNextField', () => {
  const stage1 = tintas.stages[0] // identificacao: ambiente, cor

  it('case 21 — stage com [ambiente, cor], tags=[] -> ambiente (priority 1)', () => {
    expect(getNextField(stage1, [])?.key).toBe('ambiente')
  })

  it('case 22 — tags=["ambiente:externo"] -> cor (proximo)', () => {
    expect(getNextField(stage1, ['ambiente:externo'])?.key).toBe('cor')
  })

  it('case 23 — tags=[ambiente:x, cor:y] -> null (todos respondidos)', () => {
    expect(getNextField(stage1, ['ambiente:externo', 'cor:branco'])).toBeNull()
  })

  it('case 24 — stage 3 fields, 1 respondido -> proximo nao-respondido', () => {
    const stage3 = tintas.stages[2] // fechamento: quantidade, area
    expect(getNextField(stage3, ['quantidade:5L'])?.key).toBe('area')
  })

  it('stage=null -> null', () => {
    expect(getNextField(null, ['x:y'])).toBeNull()
  })

  it('stage sem fields -> null', () => {
    const empty: Stage = {
      id: 'x', label: 'X', min_score: 0, max_score: 100, exit_action: 'continue',
      fields: [], phrasing: '',
    }
    expect(getNextField(empty, [])).toBeNull()
  })

  it('tags=null -> retorna primeiro field', () => {
    expect(getNextField(stage1, null)?.key).toBe('ambiente')
  })

  it('tags com lixo (sem ":") sao ignoradas', () => {
    expect(getNextField(stage1, ['lixo', 'sem-colon'])?.key).toBe('ambiente')
  })

  it('tie-breaker: priority igual -> alfabetica por key', () => {
    const stage: Stage = {
      id: 's', label: 'S', min_score: 0, max_score: 100, exit_action: 'handoff',
      fields: [
        { key: 'beta',  label: 'b', examples: '', score_value: 10, priority: 1 },
        { key: 'alpha', label: 'a', examples: '', score_value: 10, priority: 1 },
      ],
      phrasing: '',
    }
    expect(getNextField(stage, [])?.key).toBe('alpha')
  })
})

// =============================================================================
// calculateScoreDelta
// =============================================================================
describe('calculateScoreDelta', () => {
  it('case 25 — ["ambiente:externo"] em tintas -> 15', () => {
    expect(calculateScoreDelta(['ambiente:externo'], tintas, fallback)).toBe(15)
  })

  it('case 26 — ["acabamento:fosco"] em tintas -> 20', () => {
    expect(calculateScoreDelta(['acabamento:fosco'], tintas, fallback)).toBe(20)
  })

  it('case 27 — ["key_inexistente:x"] -> 0', () => {
    expect(calculateScoreDelta(['nao_existe:x'], tintas, fallback)).toBe(0)
  })

  it('soma multiplos fields validos', () => {
    expect(calculateScoreDelta(['ambiente:int', 'cor:branco'], tintas, fallback)).toBe(30)
  })

  it('combina fields de stages diferentes (Stage 1 + Stage 3)', () => {
    expect(calculateScoreDelta(['ambiente:int', 'quantidade:5L'], tintas, fallback)).toBe(15 + 15)
  })

  it('addedTags=[] -> 0', () => {
    expect(calculateScoreDelta([], tintas, fallback)).toBe(0)
  })

  it('addedTags=null -> 0', () => {
    expect(calculateScoreDelta(null, tintas, fallback)).toBe(0)
  })

  it('category=null -> usa fallback (default)', () => {
    expect(calculateScoreDelta(['especificacao:detalhe'], null, fallback)).toBe(25)
  })

  it('tag duplicada conta uma vez', () => {
    expect(calculateScoreDelta(['ambiente:a', 'ambiente:b'], tintas, fallback)).toBe(15)
  })

  it('tags malformadas (sem ":") sao ignoradas', () => {
    expect(calculateScoreDelta(['lixo', 'ambiente:x'], tintas, fallback)).toBe(15)
  })

  it('em impermeabilizantes: ["area:30m2"] -> 30', () => {
    expect(calculateScoreDelta(['area:30m2'], imperm, fallback)).toBe(30)
  })
})

// =============================================================================
// getExitAction
// =============================================================================
describe('getExitAction', () => {
  it('case 28 — score 0 em tintas -> search_products (Stage 1)', () => {
    expect(getExitAction(0, tintas, fallback)).toBe('search_products')
  })

  it('case 29 — score 50 em tintas -> enrichment (Stage 2)', () => {
    expect(getExitAction(50, tintas, fallback)).toBe('enrichment')
  })

  it('case 30 — score 100 em tintas -> handoff (Stage 3)', () => {
    expect(getExitAction(100, tintas, fallback)).toBe('handoff')
  })

  it('category=null -> default exit (handoff)', () => {
    expect(getExitAction(50, null, fallback)).toBe('handoff')
  })

  it('em impermeabilizantes: score 30 -> search_products (triagem)', () => {
    expect(getExitAction(30, imperm, fallback)).toBe('search_products')
  })
})

// =============================================================================
// getCategoriesOrDefault — defesas e fallback v1
// =============================================================================
describe('getCategoriesOrDefault', () => {
  it('case 31 — null/undefined retorna DEFAULT v2', () => {
    expect(getCategoriesOrDefault({ service_categories: null })).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
    expect(getCategoriesOrDefault({ service_categories: undefined })).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
    expect(getCategoriesOrDefault(null)).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
    expect(getCategoriesOrDefault(undefined)).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('case 32 — schema v1 (qualification_fields[]) retorna DEFAULT v2', () => {
    const v1 = {
      categories: [
        {
          id: 'tintas', label: 'Tintas', interesse_match: 'tinta',
          qualification_fields: [
            { key: 'ambiente', label: 'ambiente', examples: '', ask_pre_search: true, priority: 1 },
          ],
          phrasing_pre_search: 'X',
          phrasing_enrichment: 'Y',
        },
      ],
      default: {
        qualification_fields: [],
        phrasing_pre_search: '',
        phrasing_enrichment: '',
      },
    }
    expect(getCategoriesOrDefault({ service_categories: v1 })).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('case 33 — schema quebrado (categories nao e array) -> DEFAULT', () => {
    expect(getCategoriesOrDefault({ service_categories: { categories: 'broken' } }))
      .toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('schema sem default -> DEFAULT', () => {
    expect(getCategoriesOrDefault({ service_categories: { categories: [] } }))
      .toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('stage com exit_action invalido -> DEFAULT', () => {
    const bad = {
      categories: [
        {
          id: 'x', label: 'X', interesse_match: 'x',
          stages: [
            {
              id: 's', label: 'S', min_score: 0, max_score: 100, exit_action: 'INVALID',
              fields: [], phrasing: '',
            },
          ],
        },
      ],
      default: DEFAULT_SERVICE_CATEGORIES_V2.default,
    }
    expect(getCategoriesOrDefault({ service_categories: bad })).toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('case 34 — config v2 valida customizada e preservada', () => {
    const custom: ServiceCategoriesConfig = {
      categories: [
        {
          id: 'clinica', label: 'Consultas', interesse_match: 'consulta|exame',
          stages: [
            {
              id: 's1', label: 'Triagem', min_score: 0, max_score: 100, exit_action: 'handoff',
              fields: [
                { key: 'especialidade', label: 'esp', examples: '', score_value: 50, priority: 1 },
              ],
              phrasing: 'Qual {label}?',
            },
          ],
        },
      ],
      default: DEFAULT_SERVICE_CATEGORIES_V2.default,
    }
    const out = getCategoriesOrDefault({ service_categories: custom })
    expect(out).toBe(custom)
    expect(out.categories[0].id).toBe('clinica')
  })

  it('config valida do seed v2 e preservada', () => {
    expect(getCategoriesOrDefault({ service_categories: DEFAULT_SERVICE_CATEGORIES_V2 }))
      .toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })
})

// =============================================================================
// LEGACY v1 compat shim — getQualificationFields
// =============================================================================
describe('getQualificationFields (legacy v1 compat)', () => {
  it('case 35 — askPreSearch=true em tintas retorna fields do PRIMEIRO stage', () => {
    const fields = getQualificationFields(tintas, fallback, true)
    expect(fields.map(f => f.key)).toEqual(['ambiente', 'cor'])
  })

  it('case 36 — askPreSearch=false em tintas retorna fields dos stages 2+', () => {
    const fields = getQualificationFields(tintas, fallback, false)
    expect(fields.map(f => f.key).sort())
      .toEqual(['acabamento', 'area', 'marca_preferida', 'quantidade'])
  })

  it('category=null com askPreSearch=true -> [] (default tem 1 stage so)', () => {
    expect(getQualificationFields(null, fallback, true)).toEqual([])
  })

  it('category=null com askPreSearch=false -> fields do default', () => {
    const fields = getQualificationFields(null, fallback, false)
    expect(fields.map(f => f.key))
      .toEqual(['especificacao', 'marca_preferida', 'quantidade'])
  })

  it('mantem ordenacao por priority', () => {
    const fields = getQualificationFields(tintas, fallback, true)
    for (let i = 1; i < fields.length; i++) {
      expect(fields[i].priority).toBeGreaterThanOrEqual(fields[i - 1].priority)
    }
  })

  it('nao muta o source ao ordenar', () => {
    const before = tintas.stages[0].fields.map(f => f.key).join(',')
    getQualificationFields(tintas, fallback, true)
    const after = tintas.stages[0].fields.map(f => f.key).join(',')
    expect(after).toBe(before)
  })
})

// =============================================================================
// formatPhrasing
// =============================================================================
describe('formatPhrasing', () => {
  const acabamento: QualificationField = {
    key: 'acabamento',
    label: 'acabamento',
    examples: 'fosco, brilho',
    score_value: 20,
    priority: 1,
  }

  it('case 37 — substitui {label} e {examples}', () => {
    expect(formatPhrasing('Sobre {label}, prefere {examples}?', acabamento))
      .toBe('Sobre acabamento, prefere fosco, brilho?')
  })

  it('substitui multiplas ocorrencias do mesmo placeholder', () => {
    expect(formatPhrasing('{label} e mais {label}', acabamento))
      .toBe('acabamento e mais acabamento')
  })

  it('template vazio retorna string vazia', () => {
    expect(formatPhrasing('', acabamento)).toBe('')
  })

  it('template sem placeholders retorna inalterado', () => {
    expect(formatPhrasing('texto fixo', acabamento)).toBe('texto fixo')
  })
})

// =============================================================================
// extractInteresseFromTags
// =============================================================================
describe('extractInteresseFromTags', () => {
  it('case 38 — extrai valor da tag interesse:X', () => {
    expect(extractInteresseFromTags(['motivo:compra', 'interesse:tinta', 'cidade:recife']))
      .toBe('tinta')
  })

  it('sem tag interesse -> string vazia', () => {
    expect(extractInteresseFromTags(['motivo:compra', 'cidade:recife'])).toBe('')
  })

  it('tags=null/undefined/[] -> string vazia', () => {
    expect(extractInteresseFromTags(null)).toBe('')
    expect(extractInteresseFromTags(undefined)).toBe('')
    expect(extractInteresseFromTags([])).toBe('')
  })

  it('preserva ":" no valor (interesse:tinta:acrilica -> tinta:acrilica)', () => {
    expect(extractInteresseFromTags(['interesse:tinta:acrilica'])).toBe('tinta:acrilica')
  })

  it('ignora tags nao-string', () => {
    // @ts-expect-error: testando defesa contra runtime
    expect(extractInteresseFromTags([null, 123, 'interesse:tinta'])).toBe('tinta')
  })
})

// =============================================================================
// DEFAULT_SERVICE_CATEGORIES_V2 — sanity
// =============================================================================
describe('DEFAULT_SERVICE_CATEGORIES_V2 sanity', () => {
  it('case 39 — config valida v2 (passa no isValidConfig)', () => {
    expect(getCategoriesOrDefault({ service_categories: DEFAULT_SERVICE_CATEGORIES_V2 }))
      .toBe(DEFAULT_SERVICE_CATEGORIES_V2)
  })

  it('contem categorias tintas e impermeabilizantes', () => {
    const ids = DEFAULT_SERVICE_CATEGORIES_V2.categories.map(c => c.id)
    expect(ids).toContain('tintas')
    expect(ids).toContain('impermeabilizantes')
  })

  it('tintas tem 3 stages: identificacao, detalhamento, fechamento', () => {
    expect(tintas.stages.map(s => s.id))
      .toEqual(['identificacao', 'detalhamento', 'fechamento'])
  })

  it('tintas stages somam 100 de score_value possivel', () => {
    const total = tintas.stages.reduce(
      (sum, s) => sum + s.fields.reduce((f, x) => f + x.score_value, 0),
      0,
    )
    expect(total).toBe(100)
  })

  it('impermeabilizantes tem 2 stages: triagem, fechamento', () => {
    expect(imperm.stages.map(s => s.id)).toEqual(['triagem', 'fechamento'])
  })

  it('case 40 — default tem 1 stage qualificacao_basica com exit_action handoff', () => {
    expect(fallback.stages).toHaveLength(1)
    expect(fallback.stages[0].id).toBe('qualificacao_basica')
    expect(fallback.stages[0].exit_action).toBe('handoff')
  })

  it('tintas: stage identificacao tem exit_action search_products', () => {
    expect(tintas.stages[0].exit_action).toBe('search_products')
  })

  it('tintas: stage detalhamento tem exit_action enrichment', () => {
    expect(tintas.stages[1].exit_action).toBe('enrichment')
  })

  it('tintas: stage fechamento tem exit_action handoff', () => {
    expect(tintas.stages[2].exit_action).toBe('handoff')
  })

  it('boundaries dos stages de tintas formam intervalo continuo (0-30, 30-70, 70-100)', () => {
    const s = tintas.stages
    expect(s[0].min_score).toBe(0)
    expect(s[0].max_score).toBe(30)
    expect(s[1].min_score).toBe(30)
    expect(s[1].max_score).toBe(70)
    expect(s[2].min_score).toBe(70)
    expect(s[2].max_score).toBe(100)
  })

  it('field "acabamento" preserva examples "fosco, acetinado, brilho, semibrilho"', () => {
    const stage = tintas.stages.find(s => s.id === 'detalhamento')!
    const field = stage.fields.find(f => f.key === 'acabamento')!
    expect(field.examples).toContain('fosco')
    expect(field.examples).toContain('brilho')
    expect(field.examples).toContain('acetinado')
  })

  it('field "ambiente" e perguntado pre-search (Stage Identificacao)', () => {
    const stage = tintas.stages.find(s => s.id === 'identificacao')!
    expect(stage.fields.some(f => f.key === 'ambiente')).toBe(true)
  })
})
