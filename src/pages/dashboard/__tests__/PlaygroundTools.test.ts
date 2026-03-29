/**
 * Tests for tool execution — imports from REAL shared module.
 */
import {
  validateSetTags,
  validateLeadProfileUpdate,
  normalizeCarouselProductIds,
} from '../../../../supabase/functions/_shared/agentHelpers.ts'

describe('validateSetTags', () => {
  it('1. empty tags', () => {
    expect(validateSetTags([]).message).toBe('Nenhuma tag informada.')
    expect(validateSetTags(null).message).toBe('Nenhuma tag informada.')
  })

  it('2. valid tags', () => {
    const r = validateSetTags(['motivo:compra', 'interesse:tinta'])
    expect(r.valid).toEqual(['motivo:compra', 'interesse:tinta'])
    expect(r.invalid).toEqual([])
    expect(r.message).toContain('motivo:compra')
  })

  it('3. mixed valid + invalid tags', () => {
    const r = validateSetTags(['motivo:compra', 'invalido', 'interesse:tinta'])
    expect(r.valid).toHaveLength(2)
    expect(r.invalid).toEqual(['invalido'])
    expect(r.message).toContain('AVISO')
  })

  it('4. all invalid tags', () => {
    const r = validateSetTags(['foo', 'bar'])
    expect(r.valid).toEqual([])
    expect(r.invalid).toEqual(['foo', 'bar'])
    expect(r.message).toContain('AVISO')
  })
})

describe('validateLeadProfileUpdate', () => {
  it('5. empty args', () => {
    expect(validateLeadProfileUpdate({})).toBe('Nenhum campo informado.')
  })

  it('6. all fields', () => {
    const r = validateLeadProfileUpdate({ full_name: 'Carlos', city: 'Recife', interests: ['tinta'], reason: 'compra', average_ticket: 500, objections: ['preco'], notes: 'vip' })
    expect(r).toContain('nome=Carlos')
    expect(r).toContain('cidade=Recife')
    expect(r).toContain('interesses=tinta')
    expect(r).toContain('motivo=compra')
    expect(r).toContain('ticket=R$500')
    expect(r).toContain('objeções=preco')
    expect(r).toContain('notas=vip')
  })

  it('7. partial fields', () => {
    const r = validateLeadProfileUpdate({ full_name: 'Ana' })
    expect(r).toBe('Lead atualizado: nome=Ana')
  })
})

describe('normalizeCarouselProductIds', () => {
  it('8. array input passes through', () => {
    expect(normalizeCarouselProductIds(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('9. string input wrapped in array', () => {
    expect(normalizeCarouselProductIds('Tinta Coral')).toEqual(['Tinta Coral'])
  })

  it('10. null/undefined returns empty', () => {
    expect(normalizeCarouselProductIds(null)).toEqual([])
    expect(normalizeCarouselProductIds(undefined)).toEqual([])
  })

  it('11. number input converted to string', () => {
    expect(normalizeCarouselProductIds(123)).toEqual(['123'])
  })
})
