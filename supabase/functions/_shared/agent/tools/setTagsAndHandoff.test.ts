import { describe, it, expect, vi } from 'vitest'

import {
  setTags,
  handoffToHuman,
  dispatchSetTagsHandoffTool,
} from './setTagsAndHandoff.ts'
import type { SetTagsAndHandoffCtx, PendingStateRefs } from './setTagsAndHandoff.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

// Supabase mock — programa por (table, operation). Builder fluent retorna
// promises encadeáveis pra suportar `.then()` (R118 marca_preferida log) +
// `.select().single()` (não usado aqui) + `.eq().single()` etc.
function makeSupabase(handlers: Record<string, (state: any) => any> = {}) {
  const calls: any[] = []
  const supabase: any = {
    from(table: string) {
      const state: any = { table, filters: [] }
      const fluent: any = {
        select(_: string) { state.select = _; return fluent },
        eq(col: string, val: any) { state.filters.push([col, val]); return fluent },
        ilike(col: string, val: any) { state.filters.push([col, val]); return fluent },
        async maybeSingle() {
          state.op = 'maybeSingle'; calls.push({ ...state })
          const h = handlers[`${table}.maybeSingle`]; return h ? h(state) : { data: null, error: null }
        },
        async single() {
          state.op = 'single'; calls.push({ ...state })
          const h = handlers[`${table}.single`]; return h ? h(state) : { data: null, error: null }
        },
        update(payload: any) {
          state.op = 'update'; state.payload = payload
          return {
            eq(col: string, val: any) {
              state.filters.push([col, val])
              calls.push({ ...state })
              const h = handlers[`${table}.update`]; return Promise.resolve(h ? h(state) : { data: null, error: null })
            },
          }
        },
        delete() {
          state.op = 'delete'
          return {
            eq(col: string, val: any) {
              state.filters.push([col, val]); calls.push({ ...state })
              const h = handlers[`${table}.delete`]; return Promise.resolve(h ? h(state) : { data: null, error: null })
            },
          }
        },
      }
      // insert + upsert também precisam suportar .then() chain
      fluent.insert = (payload: any) => {
        state.op = 'insert'; state.payload = payload
        calls.push({ ...state })
        const h = handlers[`${table}.insert`]
        const result = h ? h(state) : { data: null, error: null }
        return {
          then(resolve: any) { return Promise.resolve(result).then(resolve) },
          select() {
            return { single: async () => result }
          },
        }
      }
      fluent.upsert = (payload: any, _opts?: any) => {
        state.op = 'upsert'; state.payload = payload
        calls.push({ ...state })
        const h = handlers[`${table}.upsert`]
        const result = h ? h(state) : { data: null, error: null }
        return {
          then(resolve: any) { return Promise.resolve(result).then(resolve) },
        }
      }
      return fluent
    },
    async rpc(name: string, params: any) {
      calls.push({ table: `rpc:${name}`, op: 'rpc', payload: params })
      const h = handlers[`rpc:${name}`]
      const result = h ? h({ name, params }) : { data: null, error: null }
      // suporta .then() do fire-and-forget add_lead_score_event
      return {
        ...result,
        then(resolve: any) { return Promise.resolve(result).then(resolve) },
      }
    },
  }
  return { supabase, calls }
}

function basePendingState(): PendingStateRefs {
  return { exitActionHandoff: null, exitActionSearch: null, forcedNextQuestion: null }
}

function baseCtx(
  supabase: any,
  overrides: Partial<SetTagsAndHandoffCtx> = {},
): SetTagsAndHandoffCtx {
  return {
    supabase,
    agent: {
      service_categories: {
        categories: [
          {
            id: 'tintas', label: 'Tintas',
            interesse_match: 'tinta|esmalte|verniz',
            stages: [
              {
                id: 's1', label: 'Stage 1', min_score: 0, max_score: 30,
                phrasing: 'Que cor?', exit_action: 'enrichment',
                fields: [
                  { key: 'ambiente_tinta', label: 'ambiente', examples: 'sala, cozinha', score_value: 15, priority: 1 },
                  { key: 'cor_tinta', label: 'cor', examples: 'branca, azul', score_value: 15, priority: 2 },
                ],
              },
            ],
          },
        ],
        default: {
          stages: [{ id: 's1', label: 'Stage 1', min_score: 0, max_score: 100, phrasing: 'q', exit_action: 'enrichment', fields: [] }],
        },
      },
      business_hours: null,
      handoff_cooldown_minutes: 30,
      handoff_message: 'Vou te conectar com {handoff_assignee_name}.',
      notify_outside_hours_on_handoff: false, // mantém handoff_message normal
    },
    agent_id: 'agt-1',
    conversation: { tags: [], status_ia: 'ATIVA', inbox_id: 'inb-1' },
    conversation_id: 'conv-1',
    contact: { id: 'contact-1', name: 'Pedro' },
    incomingText: 'quero tinta',
    leadName: 'Pedro',
    contextMessages: [{ direction: 'incoming', content: 'quero tinta' }],
    availableLabels: [{ id: 'lbl-1', name: 'Atendimento Humano' }],
    profileData: null,
    funnelData: null,
    leadProfile: null,
    pendingState: basePendingState(),
    toolCallsLog: [],
    startTime: Date.now(),
    sendTextMsg: vi.fn(async () => {}),
    broadcastEvent: vi.fn(),
    pickHandoffMessage: vi.fn(() => 'Vou te conectar com {handoff_assignee_name}.'),
    runQueueAssignment: vi.fn(async (template: string) => ({
      result: {
        assigned_user_id: 'user-1', assignee_name: 'Lucas',
        queue_event_id: 'evt-1', timeout_minutes: 5, reason: 'direct',
      },
      finalMessage: template.replace('{handoff_assignee_name}', 'Lucas'),
    })),
    executeToolSafe: vi.fn(async () => 'mocked search result'),
    buildQualificationChain: vi.fn(
      (tags: string[], _pending: any, name: string | null) =>
        `${name || ''} > ${tags.filter((t) => !t.startsWith('lead_score:') && !t.startsWith('ia:')).join(',')}`,
    ),
    ...overrides,
  }
}

// =============================================================================
// set_tags — guards e validações
// =============================================================================

describe('setTags — guards e validações', () => {
  it('rawTags vazio → retorna msg', async () => {
    const { supabase } = makeSupabase()
    const res = await setTags({ tags: [] }, baseCtx(supabase), makeLog())
    expect(res).toBe('Nenhuma tag informada.')
  })

  it('R127 dup keys: 2 interesse: → bloqueia + log', async () => {
    const { supabase, calls } = makeSupabase()
    const res = await setTags(
      { tags: ['interesse:tintas', 'interesse:portas'] },
      baseCtx(supabase),
      makeLog(),
    )
    // R127 dup keys handler interno do validateSetTagsInput devolve msg específica
    expect(typeof res).toBe('string')
    expect(res.length).toBeGreaterThan(10)
    // logou evento
    const log = calls.find(
      (c) => c.table === 'ai_agent_logs' && c.payload?.event === 'set_tags_duplicate_keys_rejected',
    )
    expect(log).toBeTruthy()
  })

  it('I2: interesse:VALUE fora das categorias do agent → bloqueia', async () => {
    const { supabase, calls } = makeSupabase()
    const res = await setTags(
      { tags: ['interesse:hidraulica'] },
      baseCtx(supabase, { incomingText: 'quero hidraulica' }),
      makeLog(),
    )
    // hidraulica não existe no agent.service_categories_v2 (só tintas)
    expect(typeof res).toBe('string')
    const log = calls.find(
      (c) => c.table === 'ai_agent_logs' &&
        c.payload?.event === 'interesse_hallucination_blocked' &&
        c.payload?.metadata?.source === 'i2_category_id_check',
    )
    expect(log).toBeTruthy()
  })
})

// =============================================================================
// set_tags — pipeline normal (categoria válida + score progressivo)
// =============================================================================

describe('setTags — pipeline normal', () => {
  it('tag válida em categoria existente: merge tags + score', async () => {
    const { supabase, calls } = makeSupabase({
      'rpc:merge_conversation_tags': () => ({
        data: { tags: ['interesse:tintas', 'ambiente_tinta:sala', 'lead_score:15'] },
        error: null,
      }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], status_ia: 'ATIVA', inbox_id: 'inb-1' },
      contextMessages: [{ direction: 'incoming', content: 'quero tinta pra sala' }],
    })
    const res = await setTags({ tags: ['ambiente_tinta:sala'] }, ctx, makeLog())
    expect(res).toContain('Tags atualizadas')
    // RPC chamada
    const rpcCall = calls.find((c) => c.table === 'rpc:merge_conversation_tags')
    expect(rpcCall).toBeTruthy()
  })

  it('RPC merge falha → fallback in-memory + update direto', async () => {
    const { supabase, calls } = makeSupabase({
      'rpc:merge_conversation_tags': () => ({ data: null, error: { message: 'rpc not exists' } }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], status_ia: 'ATIVA', inbox_id: 'inb-1' },
      contextMessages: [{ direction: 'incoming', content: 'tinta sala' }],
    })
    const res = await setTags({ tags: ['ambiente_tinta:sala'] }, ctx, makeLog())
    expect(res).toContain('Tags atualizadas')
    const updateCall = calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(updateCall).toBeTruthy()
  })

  it('R129: lead escolhe interesse → multi_interesse_pending removida', async () => {
    const { supabase, calls } = makeSupabase({
      'rpc:merge_conversation_tags': () => ({
        data: { tags: ['interesse:tintas', 'multi_interesse_pending:tintas,portas'] },
        error: null,
      }),
    })
    const ctx = baseCtx(supabase, {
      conversation: {
        tags: ['multi_interesse_pending:tintas,portas'],
        status_ia: 'ATIVA',
        inbox_id: 'inb-1',
      },
      contextMessages: [{ direction: 'incoming', content: 'quero tinta' }],
    })
    await setTags({ tags: ['interesse:tintas'] }, ctx, makeLog())
    // Após o pipeline, multi_interesse_pending deve sair via update extra
    const cleanupUpdate = calls.find(
      (c) =>
        c.table === 'conversations' &&
        c.op === 'update' &&
        Array.isArray(c.payload?.tags) &&
        !c.payload.tags.some((t: string) => t.startsWith('multi_interesse_pending:')),
    )
    expect(cleanupUpdate).toBeTruthy()
  })
})

// =============================================================================
// set_tags — exit actions
// =============================================================================

describe('setTags — exit_action handoff (Bug 24 v4)', () => {
  it('score atinge max_score com exit_action=handoff → handoff INLINE disparado', async () => {
    const { supabase, calls } = makeSupabase({
      'rpc:merge_conversation_tags': () => ({
        data: { tags: ['interesse:tintas', 'ambiente_tinta:sala', 'cor_tinta:branca', 'lead_score:30'] },
        error: null,
      }),
    })
    const ctx = baseCtx(supabase, {
      agent: {
        service_categories: {
          categories: [
            {
              id: 'tintas', label: 'Tintas',
              interesse_match: 'tinta',
              stages: [
                {
                  id: 's1', label: 'Qualificação', min_score: 0, max_score: 30,
                  phrasing: 'Q?', exit_action: 'handoff',
                  fields: [
                    { key: 'ambiente_tinta', label: 'ambiente', examples: 'sala', score_value: 15, priority: 1 },
                    { key: 'cor_tinta', label: 'cor', examples: 'branca', score_value: 15, priority: 2 },
                  ],
                },
              ],
            },
          ],
          default: { stages: [{ id: 's1', label: 'd', min_score: 0, max_score: 100, phrasing: '', exit_action: 'enrichment', fields: [] }] },
        },
        business_hours: null, handoff_cooldown_minutes: 30, handoff_message: 'Vou te conectar com {handoff_assignee_name}.',
        notify_outside_hours_on_handoff: false,
      },
      // conversa já com score 15 (ambiente preenchido em turno anterior) — nova tag
      // cor_tinta:branca adiciona +15 = 30 → bate max_score → exit_action=handoff
      conversation: {
        tags: ['interesse:tintas', 'ambiente_tinta:sala', 'lead_score:15'],
        status_ia: 'ATIVA',
        inbox_id: 'inb-1',
      },
      contextMessages: [{ direction: 'incoming', content: 'branca' }],
    })
    const res = await setTags({ tags: ['cor_tinta:branca'] }, ctx, makeLog())
    expect(res).toContain('Handoff automático disparado')
    expect(ctx.sendTextMsg).toHaveBeenCalled()
    expect(ctx.runQueueAssignment).toHaveBeenCalled()
    // logou implicit_handoff
    const implLog = calls.find(
      (c) => c.table === 'ai_agent_logs' && c.payload?.event === 'implicit_handoff',
    )
    expect(implLog).toBeTruthy()
    // toolCallsLog tem pseudo handoff_to_human
    expect(ctx.toolCallsLog.some((tc) => tc.name === 'handoff_to_human')).toBe(true)
    // pendingState exitActionHandoff foi setado
    expect(ctx.pendingState.exitActionHandoff).toBeTruthy()
  })

  it('SHADOW mode → não dispara handoff inline (idempotência)', async () => {
    const { supabase } = makeSupabase({
      'rpc:merge_conversation_tags': () => ({
        data: { tags: ['interesse:tintas', 'lead_score:30'] },
        error: null,
      }),
    })
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], status_ia: 'SHADOW', inbox_id: 'inb-1' },
      contextMessages: [{ direction: 'incoming', content: 'sala' }],
    })
    await setTags({ tags: ['ambiente_tinta:sala'] }, ctx, makeLog())
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
    expect(ctx.pendingState.exitActionHandoff).toBeNull()
  })
})

// =============================================================================
// handoff_to_human
// =============================================================================

describe('handoffToHuman', () => {
  it('happy path: empathy false → manda 1 msg + atribui fila + label + log', async () => {
    const { supabase, calls } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas'], status_ia: 'ATIVA', inbox_id: 'inb-1' },
    })
    const res = await handoffToHuman({ reason: 'orçamento' }, ctx, makeLog())
    expect(res).toContain('Conversa transferida')
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(1)
    expect(ctx.runQueueAssignment).toHaveBeenCalled()
    const handoffLog = calls.find((c) => c.table === 'ai_agent_logs' && c.payload?.event === 'handoff')
    expect(handoffLog).toBeTruthy()
    // label "Atendimento Humano" aplicada
    const labelInsert = calls.find((c) => c.table === 'conversation_labels' && c.op === 'insert')
    expect(labelInsert).toBeTruthy()
    expect(labelInsert.payload.label_id).toBe('lbl-1')
  })

  it('reason negativo → manda empathy msg ANTES + handoff msg', async () => {
    const { supabase } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { tags: [], status_ia: 'ATIVA', inbox_id: 'inb-1' },
    })
    await handoffToHuman({ reason: 'frustração com atendimento' }, ctx, makeLog())
    // 2 sendTextMsg: empathy + handoff
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(2)
    const firstCall = (ctx.sendTextMsg as any).mock.calls[0][0]
    expect(firstCall).toContain('Peço desculpas')
    expect(firstCall).toContain('Pedro') // leadName injetado
  })

  it('payment topic → bloqueia handoff (Sprint B1 guard)', async () => {
    const { supabase, calls } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { tags: [], status_ia: 'ATIVA', inbox_id: 'inb-1' },
      incomingText: 'qual a forma de pagamento?',
    })
    const res = await handoffToHuman({ reason: 'pagamento' }, ctx, makeLog())
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
    expect(ctx.toolCallsLog.some((tc) => tc.result === 'blocked_payment_topic')).toBe(true)
  })

  it('qualification chain persiste em lead_profiles.notes se contém ">"', async () => {
    const { supabase, calls } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { tags: ['interesse:tintas', 'ambiente_tinta:sala'], status_ia: 'ATIVA', inbox_id: 'inb-1' },
      // buildQualificationChain mock retorna "Pedro > interesse:tintas,ambiente_tinta:sala"
    })
    await handoffToHuman({ reason: 'orçamento' }, ctx, makeLog())
    const upsert = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')
    expect(upsert).toBeTruthy()
    expect(upsert.payload.notes).toContain('Qualificação:')
  })
})

// =============================================================================
// dispatcher
// =============================================================================

describe('dispatchSetTagsHandoffTool', () => {
  it('roteia set_tags', async () => {
    const { supabase } = makeSupabase()
    const res = await dispatchSetTagsHandoffTool('set_tags', { tags: [] }, baseCtx(supabase), makeLog())
    expect(res).toBe('Nenhuma tag informada.')
  })

  it('roteia handoff_to_human', async () => {
    const { supabase } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { tags: [], status_ia: 'ATIVA', inbox_id: 'inb-1' },
    })
    const res = await dispatchSetTagsHandoffTool('handoff_to_human', { reason: 'orcamento' }, ctx, makeLog())
    expect(res).toContain('Conversa transferida')
  })

  it('retorna null pra name desconhecido', async () => {
    const { supabase } = makeSupabase()
    const res = await dispatchSetTagsHandoffTool('search_products', {}, baseCtx(supabase), makeLog())
    expect(res).toBeNull()
  })
})
