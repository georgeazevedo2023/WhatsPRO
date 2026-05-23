import { describe, it, expect, vi } from 'vitest'

// Mock Deno.env (llmProvider.ts lê no carregamento, importado transitivamente)
;(globalThis as any).Deno = {
  env: { get: vi.fn(() => '') },
}

const { buildProductSpecialistPrompt, getProductSpecialistToolDefs } = await import('./productSpecialist.ts')

describe('buildProductSpecialistPrompt', () => {
  it('inclui persona com nome do agent', () => {
    const p = buildProductSpecialistPrompt({
      agentName: 'Lucas (Eletropiso)',
      serviceCategories: [],
      collectedTags: [],
    })
    expect(p).toContain('Lucas (Eletropiso)')
    expect(p).toContain('<persona>')
    expect(p).toContain('especialista em PRODUTO')
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
    expect(p.length).toBeLessThan(4096) // 4 KB target
    expect(p.length).toBeGreaterThan(1000) // não tão pequeno que perdeu conteúdo
  })

  it('contém as 7 rules numeradas', () => {
    const p = buildProductSpecialistPrompt({ agentName: 'X', serviceCategories: [], collectedTags: [] })
    for (let i = 1; i <= 7; i++) {
      expect(p).toContain(`${i}.`)
    }
  })
})

describe('getProductSpecialistToolDefs', () => {
  it('retorna exatamente 5 tools', () => {
    const tools = getProductSpecialistToolDefs()
    expect(tools).toHaveLength(5)
  })

  it('todas com strict=true', () => {
    const tools = getProductSpecialistToolDefs()
    for (const t of tools) {
      expect(t.strict).toBe(true)
    }
  })

  it('nomes esperados (sem handoff_to_human, sem send_poll)', () => {
    const tools = getProductSpecialistToolDefs()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'search_products',
      'send_carousel',
      'send_media',
      'set_tags',
      'update_lead_profile',
    ].sort())
    // NÃO deve incluir handoff
    expect(names).not.toContain('handoff_to_human')
    expect(names).not.toContain('send_poll')
    expect(names).not.toContain('assign_label')
    expect(names).not.toContain('move_kanban')
  })

  it('search_products requer query + category', () => {
    const t = getProductSpecialistToolDefs().find((t) => t.name === 'search_products')!
    const params = t.parameters as any
    expect(params.required).toEqual(['query', 'category'])
  })

  it('set_tags tem additionalProperties string (strict)', () => {
    const t = getProductSpecialistToolDefs().find((t) => t.name === 'set_tags')!
    const params = t.parameters as any
    expect(params.properties.tags.additionalProperties.type).toBe('string')
  })
})
