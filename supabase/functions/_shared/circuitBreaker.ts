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

  constructor(name: string, opts: CircuitBreakerOptions = {}) {
    this.name = name
    this.threshold = opts.threshold ?? 3
    this.resetMs = opts.resetMs ?? 30_000
  }

  get isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if reset period has elapsed → transition to HALF_OPEN
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.state = 'HALF_OPEN'
        console.log(`[circuit-breaker:${this.name}] HALF_OPEN — allowing probe request`)
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
    if (this.isOpen) {
      console.warn(`[circuit-breaker:${this.name}] OPEN — rejecting request (${this.failures} failures, reset in ${Math.round((this.resetMs - (Date.now() - this.lastFailureTime)) / 1000)}s)`)
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
      console.log(`[circuit-breaker:${this.name}] Recovery confirmed — CLOSED`)
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
      console.error(`[circuit-breaker:${this.name}] OPEN after ${this.failures} failures — blocking requests for ${this.resetMs / 1000}s`)
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
