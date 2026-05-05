import { describe, it, expect } from 'vitest'
import { resolveHandoffDepartment } from '../handoffDepartment.ts'

describe('resolveHandoffDepartment (D-α cascade)', () => {
  it('profile dept ganha de funnel e inbox', () => {
    const r = resolveHandoffDepartment({
      profile: { handoff_department_id: 'dept-profile' },
      funnel: { handoff_department_id: 'dept-funnel' },
      inbox: { default_department_id: 'dept-inbox' },
    })
    expect(r).toEqual({ departmentId: 'dept-profile', source: 'profile' })
  })

  it('cai no funnel quando profile nao tem dept', () => {
    const r = resolveHandoffDepartment({
      profile: { handoff_department_id: null },
      funnel: { handoff_department_id: 'dept-funnel' },
      inbox: { default_department_id: 'dept-inbox' },
    })
    expect(r).toEqual({ departmentId: 'dept-funnel', source: 'funnel' })
  })

  it('cai no inbox quando profile e funnel sao null', () => {
    const r = resolveHandoffDepartment({
      profile: null,
      funnel: { handoff_department_id: null },
      inbox: { default_department_id: 'dept-inbox' },
    })
    expect(r).toEqual({ departmentId: 'dept-inbox', source: 'inbox' })
  })

  it('retorna none quando todos sao ausentes/null', () => {
    expect(resolveHandoffDepartment({})).toEqual({ departmentId: null, source: 'none' })
    expect(resolveHandoffDepartment({
      profile: null,
      funnel: null,
      inbox: null,
    })).toEqual({ departmentId: null, source: 'none' })
  })

  it('trata undefined nos campos como null', () => {
    const r = resolveHandoffDepartment({
      profile: { handoff_department_id: undefined },
      funnel: { handoff_department_id: undefined },
      inbox: { default_department_id: 'dept-inbox' },
    })
    expect(r.source).toBe('inbox')
  })

  it('string vazia em profile NAO bloqueia cascade', () => {
    // string vazia falsy -> cai pro proximo nivel (funnel)
    const r = resolveHandoffDepartment({
      profile: { handoff_department_id: '' },
      funnel: { handoff_department_id: 'dept-funnel' },
      inbox: null,
    })
    expect(r).toEqual({ departmentId: 'dept-funnel', source: 'funnel' })
  })
})
