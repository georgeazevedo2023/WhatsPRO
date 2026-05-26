import { describe, it, expect, vi } from 'vitest'

// Mock Deno.env (llmProvider.ts lê no carregamento, importado transitivamente)
;(globalThis as any).Deno = {
  env: { get: vi.fn(() => '') },
}

const { buildProductSpecialistPrompt, getProductSpecialistToolDefs, deriveProductSearchParams, cleanProductQuery } = await import('./productSpecialist.ts')

describe('cleanProductQuery (latência: query da pré-busca sem ruído)', () => {
  it('remove saudação + verbo interrogativo do início', () => {
    expect(cleanProductQuery('bom dia! vocês têm tinta acrílica fosca?')).toBe('tinta acrílica fosca')
  })
  it('remove "vocês têm"', () => {
    expect(cleanProductQuery('vocês têm tinta branca?')).toBe('tinta branca')
  })
  it('remove "tem" simples', () => {
    expect(cleanProductQuery('tem manta líquida?')).toBe('manta líquida')
  })
  it('remove "vendem"', () => {
    expect(cleanProductQuery('vendem cimento?')).toBe('cimento')
  })
  it('preserva query já limpa', () => {
    expect(cleanProductQuery('tinta acrílica fosca')).toBe('tinta acrílica fosca')
  })
  it('não corrompe "trabalham com" no meio (só início)', () => {
    expect(cleanProductQuery('tinta que trabalham com')).toBe('tinta que trabalham com')
  })
})

// Categoria válida mínima (isValidConfig exige stages com fields/exit_action/phrasing).
function makeCategory(id: string, interesseMatch: string, catalogStatus: string) {
  return {
    id,
    label: id,
    interesse_match: interesseMatch,
    catalog_status: catalogStatus,
    stages: [
      {
        id: 's1', label: 'S1', min_score: 0, max_score: 100,
        exit_action: 'search_products',
        fields: [{ key: 'cor', label: 'cor', examples: 'branco', score_value: 10, priority: 1 }],
        phrasing: 'Qual {label}? ({examples})',
      },
    ],
  }
}
function makeAgentConfig(cats: any[]) {
  return {
    service_categories: {
      categories: cats,
      default: {
        stages: [
          {
            id: 'd1', label: 'D1', min_score: 0, max_score: 100,
            exit_action: 'handoff',
            fields: [{ key: 'x', label: 'x', examples: 'y', score_value: 10, priority: 1 }],
            phrasing: 'p',
          },
        ],
      },
    },
  }
}

describe('deriveProductSearchParams (latência: pré-busca 1-round)', () => {
  const digitalCfg = makeAgentConfig([makeCategory('tintas', 'tinta|esmalte|verniz', 'digital')])
  const offlineCfg = makeAgentConfig([makeCategory('ferramentas', 'trena|martelo|ferramenta', 'offline')])

  it('confia no pendingSearch quando pré-LLM já decidiu (R121/R137)', () => {
    const r = deriveProductSearchParams({
      incomingText: 'qualquer coisa',
      tags: [],
      agent: digitalCfg,
      pendingSearch: { query: 'Coral 18L', category: 'tintas' },
    })
    expect(r).toEqual({ query: 'Coral 18L', category: 'tintas' })
  })

  it('deriva busca de categoria digital a partir do TEXTO ("tinta branca")', () => {
    const r = deriveProductSearchParams({
      incomingText: 'vocês têm tinta branca?',
      tags: [],
      agent: digitalCfg,
    })
    expect(r).not.toBeNull()
    expect(r!.category).toBe('tintas')
    expect(r!.query.toLowerCase()).toContain('tinta')
  })

  it('deriva busca a partir da tag interesse:', () => {
    const r = deriveProductSearchParams({
      incomingText: 'a fosca',
      tags: ['interesse:tintas'],
      agent: digitalCfg,
    })
    expect(r).not.toBeNull()
    expect(r!.category).toBe('tintas')
  })

  it('NÃO pré-busca se o lead já recebeu produtos (produto: tag)', () => {
    const r = deriveProductSearchParams({
      incomingText: 'tinta branca',
      tags: ['interesse:tintas', 'produto:coral_18l'],
      agent: digitalCfg,
    })
    expect(r).toBeNull()
  })

  it('NÃO pré-busca em aguardando_upsell', () => {
    const r = deriveProductSearchParams({
      incomingText: 'tinta branca',
      tags: ['aguardando_upsell'],
      agent: digitalCfg,
    })
    expect(r).toBeNull()
  })

  it('NÃO pré-busca categoria OFFLINE (specialist qualifica, sem carrossel)', () => {
    const r = deriveProductSearchParams({
      incomingText: 'vocês têm trena?',
      tags: [],
      agent: offlineCfg,
    })
    expect(r).toBeNull()
  })

  it('retorna null quando nenhuma categoria casa', () => {
    const r = deriveProductSearchParams({
      incomingText: 'oi tudo bem',
      tags: [],
      agent: digitalCfg,
    })
    expect(r).toBeNull()
  })

  it('retorna null quando texto vazio e sem tags', () => {
    const r = deriveProductSearchParams({ incomingText: '', tags: [], agent: digitalCfg })
    expect(r).toBeNull()
  })

  it('pendingSearch tem prioridade mesmo com produto: tag', () => {
    // pré-LLM já decidiu buscar (caso raro mas explícito) — respeita a decisão.
    const r = deriveProductSearchParams({
      incomingText: 'x',
      tags: ['produto:y'],
      agent: digitalCfg,
      pendingSearch: { query: 'manta', category: 'impermeabilizantes' },
    })
    expect(r).toEqual({ query: 'manta', category: 'impermeabilizantes' })
  })
})

describe('buildProductSpecialistPrompt', () => {
  it('inclui persona com nome do agent', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'Lucas (Eletropiso)',
      serviceCategories: [],
      collectedTags: [],
    })
    expect(p).toContain('Lucas (Eletropiso)')
    expect(p).toContain('especialista em produto')
  })

  it('fallback agentName quando vazio', () => {
    const p = buildProductSpecialistPrompt({
      agentName: '',
      serviceCategories: [],
      collectedTags: [],
    })
    expect(p).toContain('consultor de vendas')
  })

  it('marca categorias offline com [OFFLINE]', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [
        { id: 'tintas', catalog_status: 'digital' },
        { id: 'portas', catalog_status: 'offline' },
        { id: 'janelas' }, // sem status = digital default
      ],
      collectedTags: [],
    })
    expect(p).toContain('- tintas\n')
    expect(p).toContain('- portas [OFFLINE]\n')
    expect(p).toContain('- janelas')
  })

  it('limita lista de categorias a 30', () => {
    const cats = Array.from({ length: 50 }, (_, i) => ({ id: `cat_${i}` }))
    const p = buildProductSpecialistPrompt({ agentName: 'X', serviceCategories: cats, collectedTags: [] })
    expect(p).toContain('cat_0')
    expect(p).toContain('cat_29')
    expect(p).not.toContain('cat_30')
  })

  it('humaniza facts collected — remove tags internas', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [],
      collectedTags: [
        'interesse:tintas',
        'cor:branco',
        'ia:ligada', // interna
        'lead_score:30', // interna
        'multi_interesse_pending:true', // interna
        'ambiente:sala',
      ],
    })
    expect(p).toContain('interesse:tintas')
    expect(p).toContain('cor:branco')
    expect(p).toContain('ambiente:sala')
    expect(p).not.toContain('ia:ligada')
    expect(p).not.toContain('lead_score')
    expect(p).not.toContain('multi_interesse_pending')
  })

  it('inclui business_info quando string', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [],
      collectedTags: [],
      businessInfo: 'Endereço: Rua A, 123. Horário: 8-18.',
    })
    expect(p).toContain('Endereço: Rua A')
  })

  it('inclui business_info quando object (JSON serializa)', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [],
      collectedTags: [],
      businessInfo: { phone: '11999990000', address: 'Rua B' },
    })
    expect(p).toContain('Rua B')
  })

  it('placeholder quando facts vazio', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [],
      collectedTags: [],
    })
    expect(p).toContain('nenhum fato coletado ainda')
  })

  it('tamanho razoável: <4 KB com catalog médio', () => {
    const cats = Array.from({ length: 24 }, (_, i) => ({
      id: `categoria_${i}`,
      catalog_status: i % 5 === 0 ? 'offline' : 'digital',
    }))
    const p = buildProductSpecialistPrompt({
      agentName: 'Eletropiso',
      serviceCategories: cats,
      collectedTags: ['interesse:tintas', 'cor:branco', 'ambiente:sala', 'marca_preferida:Coral'],
      businessInfo: 'Endereço: Av X, 1000. Tel: 11 9999-0000.',
    })
    // Premium #2 (2026-05-25): +regras 8/9/9b do cart engine (set_cart full-replace +
    // cross-sell) subiram o alvo de 4096→4600. Segue compacto e muito abaixo do global 8 KB.
    expect(p.length).toBeLessThan(4600)
    expect(p.length).toBeGreaterThan(1000) // não tão pequeno que perdeu conteúdo
  })

  it('contém as 7 situações numeradas (prompt v3)', () => {
    const p = buildProductSpecialistPrompt({ agentName: 'X', serviceCategories: [], collectedTags: [] })
    for (let i = 1; i <= 8; i++) {
      expect(p).toContain(`${i}.`)
    }
  })

  it('inclui regra universal de texto+tool no mesmo turno (prompt v5)', () => {
    const p = buildProductSpecialistPrompt({ agentName: 'X', serviceCategories: [], collectedTags: [] })
    expect(p).toContain('REGRA UNIVERSAL')
    expect(p).toContain('NUNCA chame tool sem texto')
  })

  it('Bug 9 fix (v7.43.11): inclui regra de PEDIDO COMPLETO + upsell context', () => {
    const p = buildProductSpecialistPrompt({ agentName: 'X', serviceCategories: [], collectedTags: [] })
    expect(p).toContain('PEDIDO COMPLETO')
    expect(p).toContain('mais algum item')
    expect(p).toContain('REGRA DE CONTEXTO')
    // offline agora qualifica antes de escalar (não handoff imediato)
    expect(p).toContain('1 pergunta de qualificação rápida do item')
  })

  it('Bug 6 fix raiz (v7.43.8): NÃO injeta seção priorToolsCalled (R121 desligado sob router)', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'X',
      serviceCategories: [],
      collectedTags: [],
    })
    // R121 inline está desabilitado quando routing_mode=router. Specialist é o único
    // caminho de search_products, então não precisa "saber" sobre tools prévias via prompt.
    expect(p).not.toContain('TOOLS JÁ EXECUTADAS')
  })
})

describe('getProductSpecialistToolDefs', () => {
  it('retorna exatamente 7 tools (premium #2: +set_cart)', () => {
    const tools = getProductSpecialistToolDefs()
    expect(tools).toHaveLength(7)
  })

  it('todas com strict=true', () => {
    const tools = getProductSpecialistToolDefs()
    for (const t of tools) {
      expect(t.strict).toBe(true)
    }
  })

  it('nomes esperados (inclui handoff_to_human p/ fechamento, sem send_poll/CRM)', () => {
    const tools = getProductSpecialistToolDefs()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'handoff_to_human',
      'search_products',
      'send_carousel',
      'send_media',
      'set_cart',
      'set_tags',
      'update_lead_profile',
    ].sort())
    // Bug 11 fix (v7.43.13): handoff_to_human agora INCLUÍDO (specialist fecha o ciclo)
    expect(names).toContain('handoff_to_human')
    // Continua SEM tools fora do escopo de venda
    expect(names).not.toContain('send_poll')
    expect(names).not.toContain('assign_label')
    expect(names).not.toContain('move_kanban')
  })

  it('search_products requer query + category', () => {
    const t = getProductSpecialistToolDefs().find((t) => t.name === 'search_products')!
    const params = t.parameters as any
    expect(params.required).toEqual(['query', 'category'])
  })

  it('set_tags usa array of strings "chave:valor" (alinhado com monolith + strict mode)', () => {
    const t = getProductSpecialistToolDefs().find((t) => t.name === 'set_tags')!
    const params = t.parameters as any
    // Bug 4 root cause: antes usava map object com `additionalProperties: { type: 'string' }`,
    // que viola OpenAI strict mode (precisa ser `false`). Schema correto: array de strings.
    expect(params.properties.tags.type).toBe('array')
    expect(params.properties.tags.items.type).toBe('string')
    // additionalProperties no objeto-pai será injetado como `false` pelo wrapper do callOpenAI.
    expect(params.properties.tags.additionalProperties).toBeUndefined()
  })
})
