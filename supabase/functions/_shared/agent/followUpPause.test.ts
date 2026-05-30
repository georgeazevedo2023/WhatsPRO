import { describe, expect, it } from 'vitest'
import { areFollowUpsPaused, shouldProcessFollowUpCandidate } from './followUpPause.ts'

describe('followUpPause', () => {
  it('nao pausa quando tags estao ausentes', () => {
    expect(areFollowUpsPaused(null)).toBe(false)
    expect(areFollowUpsPaused(undefined)).toBe(false)
    expect(shouldProcessFollowUpCandidate({ tags: [] })).toBe(true)
  })

  it('pausa quando followups_paused:true existe', () => {
    expect(areFollowUpsPaused(['interesse:porcelanato', 'followups_paused:true'])).toBe(true)
    expect(shouldProcessFollowUpCandidate({ tags: ['followups_paused:true'] })).toBe(false)
  })

  it('nao pausa com valor false ou outra chave parecida', () => {
    expect(areFollowUpsPaused(['followups_paused:false'])).toBe(false)
    expect(areFollowUpsPaused(['followups_paused_at:true'])).toBe(false)
  })
})
