import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker } from './circuitBreaker.ts'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    vi.spyOn(console, 'warn').mockImplementation(vi.fn())
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts CLOSED', () => {
    const cb = new CircuitBreaker('test')
    expect(cb.isOpen).toBe(false)
  })

  it('opens after threshold failures', () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(false)
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
  })

  it('stays closed below threshold', () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(false)
  })

  it('resets to CLOSED on success after OPEN', () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
    cb.onSuccess()
    expect(cb.isOpen).toBe(false)
  })

  it('transitions to HALF_OPEN after resetMs', () => {
    const cb = new CircuitBreaker('test', { threshold: 3, resetMs: 5000 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
    vi.advanceTimersByTime(5000)
    // After resetMs elapses, isOpen returns false (HALF_OPEN allows probe)
    expect(cb.isOpen).toBe(false)
  })

  it('HALF_OPEN -> CLOSED on success', () => {
    const cb = new CircuitBreaker('test', { threshold: 3, resetMs: 5000 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    vi.advanceTimersByTime(5000)
    expect(cb.isOpen).toBe(false) // HALF_OPEN
    cb.onSuccess()
    expect(cb.isOpen).toBe(false) // CLOSED
  })

  it('HALF_OPEN -> OPEN on failure', () => {
    const cb = new CircuitBreaker('test', { threshold: 3, resetMs: 5000 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    vi.advanceTimersByTime(5000)
    expect(cb.isOpen).toBe(false) // HALF_OPEN probe allowed
    cb.onFailure() // probe fails — back to OPEN
    expect(cb.isOpen).toBe(true)
  })

  it('reset() forces CLOSED', () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
    cb.reset()
    expect(cb.isOpen).toBe(false)
  })

  it('call() returns result on success', async () => {
    const cb = new CircuitBreaker('test')
    const result = await cb.call(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('call() uses fallback when OPEN', async () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
    const result = await cb.call(
      async () => { throw new Error('should not be called') },
      async () => 'fallback'
    )
    expect(result).toBe('fallback')
  })

  it('call() throws when OPEN without fallback', async () => {
    const cb = new CircuitBreaker('test', { threshold: 3 })
    cb.onFailure()
    cb.onFailure()
    cb.onFailure()
    expect(cb.isOpen).toBe(true)
    await expect(
      cb.call(async () => { throw new Error('unreachable') })
    ).rejects.toThrow('Circuit breaker test is OPEN')
  })
})
