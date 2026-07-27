import { describe, it, expect } from 'vitest'
import { isTransientLlmError } from './llmErrorClassifier.ts'

// R152 (2026-07-26) — os formatos vêm de _shared/llmProvider.ts (tags OpenAI/
// OpenAI_CLIENT_ERROR/Gemini + status) e _shared/fetchWithTimeout.ts (timed out).

describe('isTransientLlmError — TRANSITÓRIO (não sela shadow no 1º strike)', () => {
  it('OpenAI 5xx (availability)', () => {
    expect(isTransientLlmError('OpenAI 500: internal server error')).toBe(true)
    expect(isTransientLlmError('OpenAI 502: bad gateway')).toBe(true)
    expect(isTransientLlmError('OpenAI 503: The server is overloaded')).toBe(true)
  })

  it('Gemini 5xx (fallback também fora)', () => {
    expect(isTransientLlmError('Gemini 503: service unavailable')).toBe(true)
    expect(isTransientLlmError('Gemini 500: internal')).toBe(true)
  })

  it('429 rate-limit — vem taggeado CLIENT_ERROR mas é transitório', () => {
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 429: Rate limit reached for gpt-4.1')).toBe(true)
  })

  it('408 request timeout', () => {
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 408: request timeout')).toBe(true)
  })

  it('timeout do fetchWithTimeout (sem status HTTP)', () => {
    expect(isTransientLlmError('Request to https://api.openai.com/v1/chat/completions timed out after 30000ms')).toBe(true)
  })

  it('circuit breaker aberto', () => {
    expect(isTransientLlmError('No LLM available (both circuit breakers may be OPEN)')).toBe(true)
  })

  it('erros de rede do Deno fetch', () => {
    expect(isTransientLlmError('error sending request for url (https://api.openai.com/...)')).toBe(true)
    expect(isTransientLlmError('connection reset by peer')).toBe(true)
    expect(isTransientLlmError('fetch failed')).toBe(true)
  })
})

describe('isTransientLlmError — PERMANENTE (transbordo gracioso imediato)', () => {
  it('modelo inválido (o teste do D6: specialist_model=gpt-invalid)', () => {
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 404: The model `gpt-invalid-d6-test` does not exist')).toBe(false)
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 400: invalid model')).toBe(false)
  })

  it('auth/schema (falharia igual em todo turno)', () => {
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 401: Incorrect API key provided')).toBe(false)
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 400: Invalid schema for function search_products')).toBe(false)
  })

  it('status do provedor VENCE palavra de rede no corpo (400 com "timeout" no texto)', () => {
    expect(isTransientLlmError('OpenAI_CLIENT_ERROR 400: parameter timeout is invalid')).toBe(false)
  })

  it('exceção de lógica sem cara de rede', () => {
    expect(isTransientLlmError("Cannot read properties of undefined (reading 'map')")).toBe(false)
    expect(isTransientLlmError('hop_guard')).toBe(false)
  })

  it('vazio/null/undefined = permanente (conservador: transborda)', () => {
    expect(isTransientLlmError('')).toBe(false)
    expect(isTransientLlmError(null)).toBe(false)
    expect(isTransientLlmError(undefined)).toBe(false)
  })
})
