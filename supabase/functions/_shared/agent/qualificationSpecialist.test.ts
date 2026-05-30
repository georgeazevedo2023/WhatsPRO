import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const {
  buildPremiumQualificationContext,
  buildQualificationPrompt,
  buildQualificationSpecialistDef,
} = await import('./qualificationSpecialist.ts')

describe('buildQualificationPrompt', () => {
  it('inclui uma-pergunta-por-vez e escape hatch anti-arg-inventado', () => {
    const p = buildQualificationPrompt({ agentName: 'Lucas', qualificationContext: '' })
    expect(p).toContain('Lucas')
    expect(p).toContain('UMA pergunta')
    expect(p).toContain('NUNCA invente')
  })

  it('embute o contexto determinístico quando há próxima pergunta', () => {
    const p = buildQualificationPrompt({
      agentName: 'X',
      qualificationContext: 'PRÓXIMA PERGUNTA OBRIGATÓRIA: ambiente',
    })
    expect(p).toContain('PRÓXIMA PERGUNTA OBRIGATÓRIA: ambiente')
  })

  it('regra-chave (só qualifica) por último', () => {
    const p = buildQualificationPrompt({ agentName: 'X', qualificationContext: '' })
    expect(p).toContain('SOBRESCREVE TUDO')
  })
  it('embute contrato premium quando informado', () => {
    const p = buildQualificationPrompt({
      agentName: 'X',
      qualificationContext: 'PROXIMA PERGUNTA: acabamento',
      premiumQualificationContext: 'next_required_field: acabamento',
    })
    expect(p).toContain('CONTRATO PREMIUM DE QUALIFICACAO')
    expect(p).toContain('next_required_field: acabamento')
  })
})

describe('buildPremiumQualificationContext', () => {
  it('retorna vazio quando nao ha categoria resolvida', () => {
    const ctx = buildPremiumQualificationContext({
      tags: [],
      agent: { service_categories: null },
      incomingText: 'bom dia',
    })
    expect(ctx).toBe('')
  })

  it('gera contrato premium para catalogo vazio com proximo campo', () => {
    const ctx = buildPremiumQualificationContext({
      agent: {
        service_categories: {
          categories: [
            {
              id: 'torneiras_metais',
              label: 'Torneiras e Metais',
              interesse_match: 'torneira|misturador',
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
                    { key: 'aplicacao', label: 'aplicacao', examples: 'cozinha, area gourmet', score_value: 1, priority: 1 },
                    { key: 'instalacao', label: 'instalacao', examples: 'bancada, parede', score_value: 1, priority: 2 },
                    { key: 'modelo', label: 'modelo', examples: 'ducha flexivel', score_value: 1, priority: 3 },
                  ],
                },
                {
                  id: 'sem_catalogo',
                  label: 'Sem catalogo',
                  min_score: 3,
                  max_score: 6,
                  exit_action: 'handoff',
                  phrasing: 'Qual {label}?',
                  fields: [
                    { key: 'acabamento', label: 'acabamento', examples: 'cromado, preto fosco', score_value: 1, priority: 1 },
                    { key: 'tipo_cuba', label: 'tipo de cuba', examples: 'simples, dupla', score_value: 1, priority: 2 },
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
                fields: [{ key: 'especificacao', label: 'especificacao', examples: '', score_value: 1, priority: 1 }],
              },
            ],
          },
        },
      },
      tags: [
        'interesse:torneira gourmet',
        'aplicacao:cozinha',
        'instalacao:bancada',
        'modelo:ducha flexivel',
        'catalog_result:empty',
      ],
      incomingText: 'isso mesmo',
    })

    expect(ctx).toContain('flow_mode: qualify_then_handoff')
    expect(ctx).toContain('next_required_field: acabamento')
    expect(ctx).toContain('physical_stock_required: true')
    expect(ctx).toContain('Nunca confirme estoque')
    expect(ctx).toContain('Nunca diga "nao temos"')
  })
})

describe('buildQualificationSpecialistDef', () => {
  it('name=qualification, intent=qualificacao, tools set_tags+update_lead_profile (sem handoff/search)', () => {
    const def = buildQualificationSpecialistDef()
    expect(def.name).toBe('qualification')
    expect(def.intent).toBe('qualificacao')
    const names = def.toolDefs.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['set_tags', 'update_lead_profile']))
    expect(names).not.toContain('handoff_to_human')
    expect(names).not.toContain('search_products')
  })

  it('buildPrompt roda sem throw com contexto mínimo', () => {
    const def = buildQualificationSpecialistDef()
    const p = def.buildPrompt({
      agent: { name: 'Lucas' },
      conversation: { tags: [] },
      geminiContents: [{ role: 'user', parts: [{ text: 'queria tinta' }] }],
    } as any)
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(50)
  })
})
