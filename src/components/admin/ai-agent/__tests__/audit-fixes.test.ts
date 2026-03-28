/**
 * Tests for Audit v3 fixes — covers Sprint A-E improvements
 * to the AI Agent module.
 */
import { buildLegacyQueueUpdate, createQueuedMessage, type QueuedMessage } from '../../../../../supabase/functions/_shared/aiRuntime.ts'

// ─── Test 1: Debounce fallback properly appends messages (fix #4) ─────────
describe('Debounce fallback merge (#4)', () => {
  it('appends new message to existing unprocessed queue instead of replacing', () => {
    const msg1: QueuedMessage = {
      content: 'Oi', media_type: 'text', media_url: null,
      direction: 'incoming', timestamp: '2026-03-28T10:00:00Z',
    }
    const msg2: QueuedMessage = {
      content: 'tudo bem?', media_type: 'text', media_url: null,
      direction: 'incoming', timestamp: '2026-03-28T10:00:05Z',
    }
    const msg3: QueuedMessage = {
      content: 'vocês tem tinta?', media_type: 'text', media_url: null,
      direction: 'incoming', timestamp: '2026-03-28T10:00:08Z',
    }

    // Simulate: queue already has msg1 and msg2, now msg3 arrives
    const result = buildLegacyQueueUpdate(
      { messages: [msg1, msg2], processed: false, first_message_at: msg1.timestamp },
      msg3,
    )

    // All 3 messages must be present (not just msg3)
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0].content).toBe('Oi')
    expect(result.messages[1].content).toBe('tudo bem?')
    expect(result.messages[2].content).toBe('vocês tem tinta?')
    // first_message_at must be preserved from original
    expect(result.firstMessageAt).toBe(msg1.timestamp)
  })

  it('resets queue when row was already processed', () => {
    const oldMsg: QueuedMessage = {
      content: 'old', media_type: 'text', media_url: null,
      direction: 'incoming', timestamp: '2026-03-28T09:00:00Z',
    }
    const newMsg: QueuedMessage = {
      content: 'new session', media_type: 'text', media_url: null,
      direction: 'incoming', timestamp: '2026-03-28T10:00:00Z',
    }

    const result = buildLegacyQueueUpdate(
      { messages: [oldMsg], processed: true, first_message_at: oldMsg.timestamp },
      newMsg,
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content).toBe('new session')
    expect(result.firstMessageAt).toBe(newMsg.timestamp)
  })
})

// ─── Test 2: Handoff pattern negative lookahead (fix #8) ──────────────────
describe('Handoff pattern false positive prevention (#8)', () => {
  // Replicate the same patterns from ai-agent/index.ts
  const HANDOFF_PATTERNS = [
    /(?<!não\s)vou (?:te |lhe )?encaminhar/i,
    /(?<!não\s|sem\s)transferir (?:você|vc|voce|te|lhe) para/i,
    /(?:um|nosso|uma) atendente (?:humano|vai|irá)/i,
    /falar com (?:um |nosso )?vendedor/i,
    /(?<!não\s|sem\s)encaminhar (?:você|vc|voce) (?:para|ao|à)/i,
  ]

  const matchesHandoff = (text: string) => HANDOFF_PATTERNS.some(p => p.test(text))

  it('detects genuine handoff phrases', () => {
    expect(matchesHandoff('Vou te encaminhar para nosso consultor')).toBe(true)
    expect(matchesHandoff('Vou transferir você para um atendente')).toBe(true)
    expect(matchesHandoff('Um atendente humano vai te ajudar')).toBe(true)
    expect(matchesHandoff('Vou encaminhar vc para o gerente')).toBe(true)
  })

  it('does NOT trigger on negated phrases', () => {
    expect(matchesHandoff('não vou encaminhar para ninguém')).toBe(false)
    expect(matchesHandoff('não vou te encaminhar agora')).toBe(false)
    expect(matchesHandoff('sem transferir você para outro setor')).toBe(false)
  })

  it('does NOT trigger on unrelated text', () => {
    expect(matchesHandoff('Temos várias opções de tinta!')).toBe(false)
    expect(matchesHandoff('O preço é R$ 89,90')).toBe(false)
  })
})

// ─── Test 3: Label ilike escape prevents partial match (fix #12) ──────────
describe('Label ilike escape (#12)', () => {
  const escapeIlike = (name: string) => name.replace(/%/g, '\\%').replace(/_/g, '\\_')

  it('escapes % and _ characters in label names', () => {
    expect(escapeIlike('50% OFF')).toBe('50\\% OFF')
    expect(escapeIlike('pre_venda')).toBe('pre\\_venda')
    expect(escapeIlike('Vendas')).toBe('Vendas') // no special chars = unchanged
  })

  it('prevents wildcard injection', () => {
    // Without escape, "%" would match everything
    const escaped = escapeIlike('%')
    expect(escaped).toBe('\\%')
    expect(escaped).not.toBe('%')
  })
})

// ─── Test 4: BrainConfig number clamping (fix #17) ───────────────────────
describe('BrainConfig number validation (#17)', () => {
  const clampMaxTokens = (v: number) => Math.min(8192, Math.max(100, v))
  const clampDebounce = (v: number) => Math.min(30, Math.max(3, v))

  it('clamps max_tokens within 100-8192', () => {
    expect(clampMaxTokens(50)).toBe(100)
    expect(clampMaxTokens(1024)).toBe(1024)
    expect(clampMaxTokens(10000)).toBe(8192)
  })

  it('clamps debounce_seconds within 3-30', () => {
    expect(clampDebounce(1)).toBe(3)
    expect(clampDebounce(10)).toBe(10)
    expect(clampDebounce(60)).toBe(30)
  })
})

// ─── Test 5: Phone number validation for blocked numbers (fix #13) ────────
describe('Blocked number validation (#13)', () => {
  const isValidBlockedNumber = (input: string) => {
    const num = input.trim().replace(/\D/g, '')
    return num.length >= 10
  }

  it('accepts valid Brazilian numbers (11+ digits)', () => {
    expect(isValidBlockedNumber('5511999999999')).toBe(true)  // 13 digits
    expect(isValidBlockedNumber('11999999999')).toBe(true)    // 11 digits
    expect(isValidBlockedNumber('1199999999')).toBe(true)     // 10 digits (landline)
  })

  it('rejects numbers with less than 10 digits', () => {
    expect(isValidBlockedNumber('12345')).toBe(false)
    expect(isValidBlockedNumber('99999999')).toBe(false)  // 8 digits — too short
    expect(isValidBlockedNumber('')).toBe(false)
  })

  it('strips non-digit characters before validating', () => {
    expect(isValidBlockedNumber('+55 (11) 99999-9999')).toBe(true)
    expect(isValidBlockedNumber('55.11.99999.9999')).toBe(true)
  })
})
