import { describe, it, expect, vi } from 'vitest'
import {
  dispatchExitActionHandoff,
  runInlineSearchProducts,
} from './exitActionDispatcher.ts'
import type {
  DispatchExitActionHandoffCtx,
  RunInlineSearchCtx,
} from './exitActionDispatcher.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function makeSupabaseSpy() {
  const calls: Array<{ table: string; op: string; payload: any; filter?: any }> = []
  const supabase: any = {
    from(table: string) {
      return {
        update(payload: any) {
          calls.push({ table, op: 'update', payload })
          return {
            eq(_col: string, val: any) {
              calls[calls.length - 1].filter = val
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  return { supabase, calls }
}

// ────────────────────────────────────────────────────────────────────
// dispatchExitActionHandoff
// ────────────────────────────────────────────────────────────────────

function baseHandoffCtx(overrides: Partial<DispatchExitActionHandoffCtx> = {}): DispatchExitActionHandoffCtx {
  const { supabase } = makeSupabaseSpy()
  return {
    supabase,
    conversation: { id: 'conv-1', inbox_id: 'inb-1', tags: ['interesse:tintas'], status_ia: 'active' },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    agent: {
      notify_outside_hours_on_handoff: false,
      business_hours: null,
      extended_hours_until: null,
      handoff_message: 'Vou te conectar com nosso vendedor.',
    },
    profileData: null,
    funnelData: null,
    startTime: Date.now() - 50,
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    sendTextMsg: vi.fn(async () => undefined),
    broadcastEvent: vi.fn(),
    runQueueAssignment: vi.fn(async (template: string) => ({
      result: { assigned_user_id: 'user-99', assignee_name: 'Lucas', reason: 'assigned' },
      finalMessage: template.replace('{assignee}', 'Lucas'),
    })),
    pickHandoffMessage: vi.fn(({ agent }) => agent.handoff_message || 'fallback'),
    ...overrides,
  }
}

describe('dispatchExitActionHandoff', () => {
  it('happy path: dispara queue, envia msg, atualiza conv, retorna Response', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseHandoffCtx({ supabase: spy.supabase })
    const r = await dispatchExitActionHandoff(
      ctx,
      { reason: 'tintas > acabamento fosco, marca Coral', queueMotivo: 'Tintas — acabamento, marca' },
      makeLog(),
    )

    expect(r.dispatched).toBe(true)
    expect(r.response).not.toBeNull()
    expect(r.response!.status).toBe(200)

    // sendTextMsg + broadcast + msg insert
    expect(ctx.sendTextMsg).toHaveBeenCalledTimes(1)
    expect(ctx.broadcastEvent).toHaveBeenCalledTimes(1)
    expect(ctx.runQueueAssignment).toHaveBeenCalledTimes(1)
    expect(ctx.pickHandoffMessage).toHaveBeenCalledTimes(1)

    // Insert msg + Update conv + Log
    const msgInsert = spy.calls.find((c) => c.table === 'conversation_messages' && c.op === 'insert')
    expect(msgInsert).toBeTruthy()
    expect(msgInsert!.payload.direction).toBe('outgoing')

    const convUpdate = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(convUpdate).toBeTruthy()
    expect(convUpdate!.payload.status_ia).toBe('shadow')
    expect(convUpdate!.payload.lead_msg_count).toBe(0)
    expect(convUpdate!.payload.tags).toContain('ia:shadow')
    expect(convUpdate!.payload.tags).toContain('followups_paused:true')
    expect(convUpdate!.payload.tags).toContain('handoff_created:true')

    const logInsert = spy.calls.find(
      (c) => c.table === 'ai_agent_logs' && c.op === 'insert',
    )
    expect(logInsert!.payload.event).toBe('implicit_handoff')
    expect(logInsert!.payload.metadata.reason).toBe('exit_action_auto_extract')
    expect(logInsert!.payload.metadata.exit_reason).toContain('acabamento fosco')
  })

  it('NÃO dispara quando status_ia=shadow', async () => {
    const ctx = baseHandoffCtx({
      conversation: { tags: [], status_ia: 'shadow', inbox_id: 'inb-1' },
    })
    const r = await dispatchExitActionHandoff(
      ctx,
      { reason: 'r', queueMotivo: 'q' },
      makeLog(),
    )
    expect(r.dispatched).toBe(false)
    expect(r.response).toBeNull()
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
    expect(ctx.runQueueAssignment).not.toHaveBeenCalled()
  })

  it('usa profileData.handoff_department_id quando presente', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseHandoffCtx({
      supabase: spy.supabase,
      profileData: { handoff_department_id: 'dept-profile-A' },
      funnelData: { handoff_department_id: 'dept-funnel-B' },
    })
    await dispatchExitActionHandoff(ctx, { reason: 'r', queueMotivo: 'q' }, makeLog())
    const convUpdate = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(convUpdate!.payload.department_id).toBe('dept-profile-A') // profile > funnel
  })

  it('usa funnelData.handoff_department_id como fallback', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseHandoffCtx({
      supabase: spy.supabase,
      profileData: null,
      funnelData: { handoff_department_id: 'dept-funnel-B' },
    })
    await dispatchExitActionHandoff(ctx, { reason: 'r', queueMotivo: 'q' }, makeLog())
    const convUpdate = spy.calls.find((c) => c.table === 'conversations' && c.op === 'update')
    expect(convUpdate!.payload.department_id).toBe('dept-funnel-B')
  })

  it('respeita notify_outside_hours_on_handoff=true quando fora de horário', async () => {
    const ctx = baseHandoffCtx({
      agent: {
        notify_outside_hours_on_handoff: true,
        business_hours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: null, close: null },
          sunday: { open: null, close: null },
        },
        extended_hours_until: null,
        handoff_message: 'msg',
        handoff_message_outside_hours: 'fora do horário, retornamos amanhã',
        timezone: 'America/Sao_Paulo',
      },
    })
    await dispatchExitActionHandoff(ctx, { reason: 'r', queueMotivo: 'q' }, makeLog())
    expect(ctx.pickHandoffMessage).toHaveBeenCalledWith(
      expect.objectContaining({ outsideHours: expect.any(Boolean) }),
    )
  })

  it('response body contém handoff:true e reason:exit_action_auto_extract', async () => {
    const ctx = baseHandoffCtx()
    const r = await dispatchExitActionHandoff(
      ctx,
      { reason: 'r', queueMotivo: 'q' },
      makeLog(),
    )
    const body = await r.response!.json()
    expect(body.ok).toBe(true)
    expect(body.handoff).toBe(true)
    expect(body.reason).toBe('exit_action_auto_extract')
    expect(body.queue.assigned_user_id).toBe('user-99')
  })
})

// ────────────────────────────────────────────────────────────────────
// runInlineSearchProducts
// ────────────────────────────────────────────────────────────────────

function baseSearchCtx(overrides: Partial<RunInlineSearchCtx> = {}): RunInlineSearchCtx {
  const { supabase } = makeSupabaseSpy()
  return {
    supabase,
    conversation: { status_ia: 'active' },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    executeToolSafe: vi.fn(async () => 'Encontrei 3 produtos: Coral fosco branco 18L, Suvinil fosco azul 3.6L, ...'),
    ...overrides,
  }
}

describe('runInlineSearchProducts', () => {
  it('executa search, monta inlineSearchContext + toolCall', async () => {
    const spy = makeSupabaseSpy()
    const ctx = baseSearchCtx({ supabase: spy.supabase })
    const r = await runInlineSearchProducts(
      ctx,
      { query: 'tinta Coral fosca branco', category: 'tintas' },
      makeLog(),
    )

    expect(r.toolCall).not.toBeNull()
    expect(r.toolCall!.name).toBe('search_products')
    expect(r.toolCall!.result).toContain('Coral')
    expect(r.inlineSearchContext).toContain('[INTERNO')
    expect(r.inlineSearchContext).toContain('Query: tinta Coral fosca branco')
    expect(r.inlineSearchContext).toContain('Coral fosco branco')
    expect(ctx.executeToolSafe).toHaveBeenCalledWith('search_products', {
      query: 'tinta Coral fosca branco',
      category: 'tintas',
    })

    const logInsert = spy.calls.find((c) => c.table === 'ai_agent_logs' && c.op === 'insert')
    expect(logInsert!.payload.event).toBe('tool_called')
    expect(logInsert!.payload.metadata.source).toBe('r121_auto_extract_inline')
  })

  it('NÃO executa quando status_ia=shadow', async () => {
    const ctx = baseSearchCtx({ conversation: { status_ia: 'shadow' } })
    const r = await runInlineSearchProducts(
      ctx,
      { query: 'tinta', category: 'tintas' },
      makeLog(),
    )
    expect(r.inlineSearchContext).toBe('')
    expect(r.toolCall).toBeNull()
    expect(ctx.executeToolSafe).not.toHaveBeenCalled()
  })

  it('captura erro do executeToolSafe (non-fatal)', async () => {
    const ctx = baseSearchCtx({
      executeToolSafe: vi.fn(async () => {
        throw new Error('postgrest 500')
      }),
    })
    const log = makeLog()
    const r = await runInlineSearchProducts(
      ctx,
      { query: 'tinta', category: 'tintas' },
      log,
    )
    expect(r.inlineSearchContext).toBe('')
    expect(r.toolCall).toBeNull()
    expect(log.error).toHaveBeenCalledWith(
      'R121 inline search failed (non-fatal)',
      expect.objectContaining({ error: 'postgrest 500' }),
    )
  })
})
