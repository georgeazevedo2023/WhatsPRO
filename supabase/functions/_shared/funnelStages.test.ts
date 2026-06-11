import { describe, it, expect } from 'vitest'
import { deriveFunnelStages } from './funnelStages.ts'

const base = { tags: [] as string[], cartItems: null as unknown, assignedTo: null as string | null }

describe('deriveFunnelStages', () => {
  it('conversa sem sinais = só contact', () => {
    expect(deriveFunnelStages(base)).toEqual(['contact'])
  })

  it('interesse: ou lead_score: marcam qualification', () => {
    expect(deriveFunnelStages({ ...base, tags: ['interesse:tintas'] })).toContain('qualification')
    expect(deriveFunnelStages({ ...base, tags: ['lead_score:30'] })).toContain('qualification')
  })

  it('intencao:compra/orcamento e venda_status negociando/fechando marcam intention', () => {
    expect(deriveFunnelStages({ ...base, tags: ['intencao:compra'] })).toContain('intention')
    expect(deriveFunnelStages({ ...base, tags: ['intencao:orcamento'] })).toContain('intention')
    expect(deriveFunnelStages({ ...base, tags: ['venda_status:negociando'] })).toContain('intention')
    expect(deriveFunnelStages({ ...base, tags: ['venda_status:fechando'] })).toContain('intention')
  })

  it('intencao:informacao NÃO marca intention', () => {
    expect(deriveFunnelStages({ ...base, tags: ['intencao:informacao'] })).not.toContain('intention')
  })

  it('carrinho não-vazio marca intention', () => {
    expect(deriveFunnelStages({ ...base, cartItems: [{ sku: 'x' }] })).toContain('intention')
    expect(deriveFunnelStages({ ...base, cartItems: [] })).not.toContain('intention')
  })

  it('handoff via tag durável ou assigned_to', () => {
    expect(deriveFunnelStages({ ...base, tags: ['handoff_created:123'] })).toContain('handoff')
    expect(deriveFunnelStages({ ...base, tags: ['human_assigned:abc'] })).toContain('handoff')
    expect(deriveFunnelStages({ ...base, assignedTo: 'user-1' })).toContain('handoff')
  })

  it('conversion = resultado:venda (humano) ou venda:fechada (IA determinística)', () => {
    expect(deriveFunnelStages({ ...base, tags: ['resultado:venda'] })).toContain('conversion')
    expect(deriveFunnelStages({ ...base, tags: ['venda:fechada'] })).toContain('conversion')
    expect(deriveFunnelStages({ ...base, tags: ['resultado:perdido'] })).not.toContain('conversion')
    expect(deriveFunnelStages({ ...base, tags: ['venda_status:negociando'] })).not.toContain('conversion')
    // "fechando" é em-fechamento: intention, NÃO conversion
    expect(deriveFunnelStages({ ...base, tags: ['venda_status:fechando'] })).not.toContain('conversion')
    expect(deriveFunnelStages({ ...base, tags: ['venda_status:fechando'] })).toContain('intention')
  })

  it('normaliza espaço pós-dois-pontos e caixa ("intencao: compra" real de prod)', () => {
    expect(deriveFunnelStages({ ...base, tags: ['intencao: compra'] })).toContain('intention')
    expect(deriveFunnelStages({ ...base, tags: ['Resultado:VENDA'] })).toContain('conversion')
  })

  it('funil completo: lead da Van (porcelanato → carrinho → vendedor → venda)', () => {
    const stages = deriveFunnelStages({
      tags: ['interesse:revestimentos', 'lead_score:60', 'intencao:compra', 'handoff_created:1749', 'venda:fechada'],
      cartItems: [{ produto: 'porcelanato 60x60', qtd: 10 }],
      assignedTo: 'lucas-id',
    })
    expect(stages).toEqual(['contact', 'qualification', 'intention', 'handoff', 'conversion'])
  })

  it('tolera tags null/undefined e valores não-string', () => {
    expect(deriveFunnelStages({ tags: null, cartItems: null, assignedTo: null })).toEqual(['contact'])
    expect(deriveFunnelStages({ tags: [null as unknown as string, 'interesse:x'], cartItems: 'oi', assignedTo: undefined }))
      .toEqual(['contact', 'qualification'])
  })
})
