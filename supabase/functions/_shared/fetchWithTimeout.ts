/**
 * fetch() wrapper with AbortController timeout.
 * Default timeout: 30 seconds.
 *
 * Usage:
 *   import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
 *   const res = await fetchWithTimeout(url, { method: 'POST', body, headers }, 30000)
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request to ${typeof url === 'string' ? url.split('?')[0] : url} timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fire-and-forget fetch with timeout — logs errors instead of throwing.
 * Use for non-critical operations like typing indicators, realtime broadcasts.
 */
export function fetchFireAndForget(
  url: string | URL,
  init?: RequestInit,
  timeoutMs = 10000
): void {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  fetch(url, { ...init, signal: controller.signal })
    .catch((err) => {
      console.warn(`[fire-and-forget] ${typeof url === 'string' ? url.split('?')[0] : url} failed:`, err.message)
    })
    .finally(() => clearTimeout(timeout))
}
