/**
 * Simple circuit breaker for external API calls (Gemini, Groq, Mistral).
 *
 * States:
 *   CLOSED  → requests flow normally, failures are counted
 *   OPEN    → requests are rejected immediately (fallback used)
 *   HALF    → one probe request allowed to test recovery
 *
 * Usage:
 *   import { CircuitBreaker } from '../_shared/circuitBreaker.ts'
 *   const geminiBreaker = new CircuitBreaker('gemini', { threshold: 3, resetMs: 30000 })
 *   const res = await geminiBreaker.call(() => fetch(url), () => fallbackResponse)
 */

import { createLogger } from './logger.ts'

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  threshold?: number
  /** Time in ms before attempting recovery (half-open) */
  resetMs?: number
}

export class CircuitBreaker {
  private state: BreakerState = 'CLOSED'
  private failures = 0
  private lastFailureTime = 0
  private readonly name: string
  private readonly threshold: number
  private readonly resetMs: number
  private readonly log: ReturnType<typeof createLogger>

  constructor(name: string, opts: CircuitBreakerOptions = {}) {
    this.name = name
    this.threshold = opts.threshold ?? 3
    this.resetMs = opts.resetMs ?? 30_000
    this.log = createLogger(`circuit-breaker:${name}`)
  }

  get isOpen(): boolean {
    return this.state === 'OPEN' && Date.now() - this.lastFailureTime < this.resetMs
  }

  /**
   * Checks current state and transitions OPEN → HALF_OPEN when reset period has elapsed.
   * Returns true if the circuit should block the request.
   */
  private checkState(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.state = 'HALF_OPEN'
        this.log.info('HALF_OPEN — allowing probe request')
        return false
      }
      return true
    }
    return false
  }

  /**
   * Execute fn() with circuit breaker protection.
   * If circuit is open, fallbackFn() is called immediately.
   */
  async call<T>(fn: () => Promise<T>, fallbackFn?: () => T | Promise<T>): Promise<T> {
    if (this.checkState()) {
      this.log.warn('OPEN — rejecting request', {
        failures: this.failures,
        resetInSeconds: Math.round((this.resetMs - (Date.now() - this.lastFailureTime)) / 1000),
      })
      if (fallbackFn) return fallbackFn()
      throw new Error(`Circuit breaker ${this.name} is OPEN`)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      if (fallbackFn && this.state === 'OPEN') return fallbackFn()
      throw err
    }
  }

  /**
   * Record a success — reset to CLOSED.
   */
  onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.log.info('Recovery confirmed — CLOSED')
    }
    this.failures = 0
    this.state = 'CLOSED'
  }

  /**
   * Record a failure — increment counter, possibly open circuit.
   */
  onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
      this.log.error('OPEN after threshold reached — blocking requests', {
        failures: this.failures,
        blockingForSeconds: this.resetMs / 1000,
      })
    }
  }

  /** Manually reset the breaker (e.g. on deploy) */
  reset(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }
}

// Shared instances — survive across requests in same Deno isolate
export const geminiBreaker = new CircuitBreaker('gemini', { threshold: 3, resetMs: 30_000 })
export const groqBreaker = new CircuitBreaker('groq', { threshold: 3, resetMs: 20_000 })
export const mistralBreaker = new CircuitBreaker('mistral', { threshold: 3, resetMs: 20_000 })
export const uazapiBreaker = new CircuitBreaker('uazapi', { threshold: 5, resetMs: 60_000 })
