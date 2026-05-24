import { describe, it, expect, vi } from 'vitest'

;(globalThis as any).Deno = { env: { get: vi.fn(() => '') } }

const { buildLeadMemoryBlock, consolidateLeadMemory } = await import('./leadMemory.ts')

describe('buildLeadMemoryBlock', () => {
  it('retorna vazio para lead novo (sem perfil)', () => {
    expect(buildLeadMemoryBlock(null)).toBe('')
    expect(buildLeadMemoryBlock(undefined)).toBe('')
    expect(buildLeadMemoryBlock({})).toBe('')
  })

  it('não injeta bloco quando só há "última visita hoje" (conversa em andamento)', () => {
    const p = buildLeadMemoryBlock({ last_contact_at: new Date().toISOString() })
    expect(p).toBe('')
  })

  it('monta bloco rico para lead que volta', () => {
    const p = buildLeadMemoryBlock({
      full_name: 'João Pedro',
      interests: ['tintas'],
      objections: ['preco'],
      average_ticket: 800,
      qualification_stage: 'tintas (ambiente, cor)',
      products_seen: ['Tinta Coral 18L', { title: 'Tinta Iquine' }],
      conversation_summaries: [{ summary: 'Lead pediu tinta branca pra sala.' }],
      last_contact_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    })
    expect(p).toContain('MEMÓRIA DO LEAD')
    expect(p).toContain('Nome: João Pedro')
    expect(p).toContain('Interesses: tintas')
    expect(p).toContain('Objeções levantadas: preco')
    expect(p).toContain('Qualificação parou em: tintas (ambiente, cor)')
    expect(p).toContain('Tinta Coral 18L')
    expect(p).toContain('Tinta Iquine')
    expect(p).toContain('Lead pediu tinta branca')
    expect(p).toContain('há 3 dias')
    expect(p).toContain('NÃO recite tudo')
  })
})

describe('consolidateLeadMemory', () => {
  it('grava products_seen do toolCallsLog + qualification_stage das tags', async () => {
    const updates: any[] = []
    const supabase = {
      from: () => ({ update: (patch: any) => ({ eq: () => { updates.push(patch); return Promise.resolve({ error: null }) } }) }),
    }
    await consolidateLeadMemory({
      supabase,
      contactId: 'c1',
      currentTags: ['interesse:tintas', 'ambiente:interno', 'cor:branco', 'ia:ligada'],
      toolCallsLog: [{ name: 'search_products', result: 'Carrossel ... ao lead: Tinta Coral 18L, Tinta Iquine' }],
      existingProductsSeen: ['Tinta Suvinil'],
      log: { info: () => {}, warn: () => {} },
    })
    expect(updates).toHaveLength(1)
    expect(updates[0].qualification_stage).toContain('tintas')
    expect(updates[0].products_seen).toContain('Tinta Coral 18L')
    expect(updates[0].products_seen).toContain('Tinta Suvinil') // merge com o existente
    expect(updates[0].memory_updated_at).toBeTruthy()
  })

  it('não faz UPDATE quando não há produto nem estágio', async () => {
    let called = false
    const supabase = { from: () => ({ update: () => { called = true; return { eq: () => Promise.resolve({ error: null }) } } }) }
    await consolidateLeadMemory({
      supabase, contactId: 'c1', currentTags: ['ia:ligada'], toolCallsLog: [],
      log: { info: () => {}, warn: () => {} },
    })
    expect(called).toBe(false)
  })
})
