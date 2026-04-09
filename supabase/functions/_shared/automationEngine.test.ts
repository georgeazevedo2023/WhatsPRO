import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Deno global (needed by automationEngine for Deno.env.get) ──────────
vi.stubGlobal('Deno', {
  env: {
    get: (key: string): string | undefined => {
      const envMap: Record<string, string> = {
        UAZAPI_SERVER_URL: 'https://test.uazapi.example.com',
      }
      return envMap[key] ?? undefined
    },
  },
})

// ── Mock esm.sh import (Node ESM loader can't fetch https:// URLs) ───────────
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: vi.fn((_url: string, _key: string) => ({})),
}))

// ── Mock logger to silence output during tests ───────────────────────────────
vi.mock('./logger.ts', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Import AFTER mocks are set up
import { executeAutomationRules, type TriggerData } from './automationEngine.ts'

// ── Supabase mock factory ────────────────────────────────────────────────────
// Builds a minimal mock that satisfies the chainable query pattern used in
// executeAutomationRules: .from().select().eq().eq().eq().order()
function mockSupabase(rules: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: rules, error: null }),
            }),
          }),
        }),
      }),
    }),
  } as ReturnType<typeof import('./supabaseClient.ts').createServiceClient>
}

function mockSupabaseError() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: null, error: { message: 'DB connection failed' } }),
            }),
          }),
        }),
      }),
    }),
  } as ReturnType<typeof import('./supabaseClient.ts').createServiceClient>
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('executeAutomationRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: empty rules → empty logs
  it('retorna array vazio quando não há regras para o funil', async () => {
    const logs = await executeAutomationRules(
      'funnel-uuid-001',
      'form_completed',
      {},
      null,
      mockSupabase([]),
    )
    expect(logs).toEqual([])
  })

  // Test 2: supabase error → empty logs (graceful handling)
  it('retorna array vazio quando supabase retorna erro', async () => {
    const logs = await executeAutomationRules(
      'funnel-uuid-001',
      'form_completed',
      {},
      null,
      mockSupabaseError(),
    )
    expect(logs).toEqual([])
  })

  // Test 3: form_completed + condition=always → action should fire
  // We verify triggered=true and condition_passed=true even if action_executed
  // may be false due to missing conversation_id (send_message skips without conv)
  it('dispara regra quando trigger_type=form_completed e condition=always', async () => {
    const rule = {
      id: 'rule-001',
      name: 'Mensagem de boas-vindas',
      trigger_type: 'form_completed',
      trigger_config: {},          // no sub-filters → always matches
      condition_type: 'always',
      condition_config: {},
      action_type: 'send_message',
      action_config: { message: 'Obrigado por preencher o formulário!' },
    }

    const logs = await executeAutomationRules(
      'funnel-uuid-002',
      'form_completed',
      {},
      null,                         // no conversationId → send_message returns skip
      mockSupabase([rule]),
    )

    expect(logs).toHaveLength(1)
    expect(logs[0].rule_id).toBe('rule-001')
    expect(logs[0].triggered).toBe(true)
    expect(logs[0].condition_passed).toBe(true)
    // send_message with no conversation → skips gracefully (no exception)
    expect(logs[0].error).toBeUndefined()
  })

  // Test 4: form_completed with trigger_config.form_slug that does NOT match
  it('não dispara regra quando trigger_config.form_slug não corresponde ao evento', async () => {
    const rule = {
      id: 'rule-002',
      name: 'Regra do formulário X',
      trigger_type: 'form_completed',
      trigger_config: { form_slug: 'sorteio-2026' },  // only matches this slug
      condition_type: 'always',
      condition_config: {},
      action_type: 'add_tag',
      action_config: { tag: 'origem:sorteio' },
    }

    const triggerData: TriggerData = { form_slug: 'captacao-leads' }  // different slug

    const logs = await executeAutomationRules(
      'funnel-uuid-003',
      'form_completed',
      triggerData,
      null,
      mockSupabase([rule]),
    )

    expect(logs).toHaveLength(1)
    expect(logs[0].triggered).toBe(false)
    expect(logs[0].condition_passed).toBe(false)
    expect(logs[0].action_executed).toBe(false)
  })

  // Test 5: condition_type=always → condition_passed must be true
  it('condition_type=always sempre retorna condition_passed=true', async () => {
    const rule = {
      id: 'rule-003',
      name: 'Regra sempre ativa',
      trigger_type: 'lead_created',
      trigger_config: {},
      condition_type: 'always',
      condition_config: {},
      action_type: 'activate_ai',
      action_config: {},
    }

    const logs = await executeAutomationRules(
      'funnel-uuid-004',
      'lead_created',
      {},
      'conv-uuid-001',
      // activate_ai needs to update conversations — mock needs extra chains
      // Use a more complete mock for this test
      {
        from: (table: string) => {
          if (table === 'automation_rules') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: () => Promise.resolve({ data: [rule], error: null }),
                    }),
                  }),
                }),
              }),
            }
          }
          // conversations table update mock (activate_ai)
          return {
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }
        },
      } as ReturnType<typeof import('./supabaseClient.ts').createServiceClient>,
    )

    expect(logs).toHaveLength(1)
    expect(logs[0].triggered).toBe(true)
    expect(logs[0].condition_passed).toBe(true)
    expect(logs[0].action_executed).toBe(true)
    expect(logs[0].action_result).toBe('ai_activated: status_ia=ligada')
  })

  // Test 6: multiple rules — only matching trigger_config fires
  it('executa somente regras cujo trigger_config corresponde ao evento', async () => {
    const ruleA = {
      id: 'rule-010',
      name: 'Regra coluna Qualificado',
      trigger_type: 'card_moved',
      trigger_config: { column_id: 'col-qualificado' },
      condition_type: 'always',
      condition_config: {},
      action_type: 'add_tag',
      action_config: { tag: 'etapa:qualificado' },
    }
    const ruleB = {
      id: 'rule-011',
      name: 'Regra coluna Fechado',
      trigger_type: 'card_moved',
      trigger_config: { column_id: 'col-fechado' },
      condition_type: 'always',
      condition_config: {},
      action_type: 'add_tag',
      action_config: { tag: 'etapa:fechado' },
    }

    const triggerData: TriggerData = { column_id: 'col-qualificado' }

    const logs = await executeAutomationRules(
      'funnel-uuid-005',
      'card_moved',
      triggerData,
      'conv-uuid-002',
      {
        from: (table: string) => {
          if (table === 'automation_rules') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: () => Promise.resolve({ data: [ruleA, ruleB], error: null }),
                    }),
                  }),
                }),
              }),
            }
          }
          // conversations mock for add_tag (select tags + update)
          if (table === 'conversations') {
            return {
              select: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { tags: [] }, error: null }),
                }),
              }),
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            }
          }
          return { select: vi.fn(), update: vi.fn() }
        },
      } as ReturnType<typeof import('./supabaseClient.ts').createServiceClient>,
    )

    expect(logs).toHaveLength(2)

    const logA = logs.find((l) => l.rule_id === 'rule-010')
    const logB = logs.find((l) => l.rule_id === 'rule-011')

    // Rule A: column matches → should execute
    expect(logA?.triggered).toBe(true)
    expect(logA?.condition_passed).toBe(true)
    expect(logA?.action_executed).toBe(true)

    // Rule B: column does NOT match → should not fire
    expect(logB?.triggered).toBe(false)
    expect(logB?.action_executed).toBe(false)
  })
})
