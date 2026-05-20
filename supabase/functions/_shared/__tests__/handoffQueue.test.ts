import { describe, it, expect, vi } from 'vitest'
import { assignHandoff, applyAssigneeNameTemplate } from '../handoffQueue.ts'

/**
 * Mock leve do Supabase client. Cada teste define o comportamento dos
 * builders chainable (.from().select().eq().maybeSingle() etc.).
 *
 * O builder retorna `this` em todos os chainables e .maybeSingle()/insert()
 * /update()/.eq() resolvem a Promise final.
 */
type Row = Record<string, unknown>
type QueryResult = { data?: Row | Row[] | null; error?: { message: string } | null }

interface FromMock {
  select: (cols?: string) => FromMock
  insert: (row: Row) => FromMock
  update: (row: Row) => FromMock
  eq: (col: string, val: unknown) => FromMock | Promise<QueryResult>
  in: (col: string, vals: unknown[]) => FromMock
  maybeSingle: () => Promise<QueryResult>
  single: () => Promise<QueryResult>
  then?: never
}

function makeBuilder(plan: {
  maybeSingle?: QueryResult
  single?: QueryResult
  /** Para `.eq(...).update(...)` quando nao chama .single/.maybeSingle */
  resolve?: QueryResult
}): FromMock {
  const b: FromMock = {
    select: vi.fn(() => b),
    insert: vi.fn(() => b),
    update: vi.fn(() => b),
    eq: vi.fn(() => b),
    in: vi.fn(() => b),
    maybeSingle: vi.fn(async () => plan.maybeSingle || { data: null, error: null }),
    single: vi.fn(async () => plan.single || { data: null, error: null }),
  }
  // Quando o caller faz `await client.from(...).update(...).eq(...)` direto
  // o eq precisa virar thenable. Reescrevo eq para retornar uma promise se
  // chamado depois de update().
  return b
}

function makeSupabase(handlers: {
  departments?: QueryResult
  member?: QueryResult
  rpcResult?: { data?: unknown; error?: { message: string } | null }
  insertEvent?: QueryResult
  updateConv?: QueryResult
  authUser?: { user?: { user_metadata?: Record<string, unknown>; email?: string } | null; error?: unknown }
}) {
  const fromCalls: string[] = []
  const supabase = {
    from(table: string) {
      fromCalls.push(table)
      if (table === 'departments') {
        const b = makeBuilder({ maybeSingle: handlers.departments || { data: null, error: null } })
        return b
      }
      if (table === 'department_members') {
        return makeBuilder({ maybeSingle: handlers.member || { data: null, error: null } })
      }
      if (table === 'handoff_queue_events') {
        return makeBuilder({ single: handlers.insertEvent || { data: { id: 'evt-1' }, error: null } })
      }
      if (table === 'conversations') {
        // .update().eq() — e o caller faz await disso. Implementamos eq
        // como funcao que retorna um thenable.
        const result = handlers.updateConv || { data: null, error: null }
        const b: Partial<FromMock> & { eq: (col: string, val: unknown) => Promise<QueryResult> } = {
          select: vi.fn(() => b as FromMock),
          insert: vi.fn(() => b as FromMock),
          update: vi.fn(() => b as FromMock),
          eq: vi.fn(async () => result),
          in: vi.fn(() => b as FromMock),
          maybeSingle: vi.fn(async () => result),
          single: vi.fn(async () => result),
        }
        return b as unknown as FromMock
      }
      return makeBuilder({})
    },
    rpc: vi.fn(async () => handlers.rpcResult || { data: null, error: null }),
    auth: {
      admin: {
        getUserById: vi.fn(async () =>
          handlers.authUser
            ? { data: handlers.authUser, error: handlers.authUser.error || null }
            : { data: { user: null }, error: null },
        ),
      },
    },
    _fromCalls: fromCalls,
  }
  return supabase
}

describe('assignHandoff — guards iniciais', () => {
  it('sem department_id retorna no_dept e nao toca em ninguem', async () => {
    const supabase = makeSupabase({})
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: null,
    })
    expect(r.reason).toBe('no_dept')
    expect(r.assigned_user_id).toBeNull()
    expect(supabase._fromCalls).toEqual([])
  })

  it('dept inexistente retorna no_dept', async () => {
    const supabase = makeSupabase({
      departments: { data: null, error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'dept-x',
    })
    expect(r.reason).toBe('no_dept')
  })
})

describe('assignHandoff — Modo OFF', () => {
  it('default_assignee_id presente -> queue_off_default e atribui', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: false, queue_mode_timeout_minutes: 5, default_assignee_id: 'user-default' },
        error: null,
      },
      authUser: { user: { user_metadata: { full_name: 'Lucas Silva' } } },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('queue_off_default')
    expect(r.assigned_user_id).toBe('user-default')
    expect(r.assignee_name).toBe('Lucas') // primeiro nome
    // R125: Modo OFF não cria handoff_queue_events (sem badge "Em fila" no UI)
    expect(r.queue_event_id).toBeNull()
    expect(r.timeout_minutes).toBe(5)
  })

  it('R125 — Modo OFF não chama insert em handoff_queue_events', async () => {
    const insertSpy = vi.fn()
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: false, queue_mode_timeout_minutes: 5, default_assignee_id: 'user-default' },
        error: null,
      },
      authUser: { user: { user_metadata: { full_name: 'Lucas Silva' } } },
    })
    // Intercepta o builder de handoff_queue_events pra detectar insert
    const originalFrom = supabase.from
    supabase.from = (table: string) => {
      const b = originalFrom(table)
      if (table === 'handoff_queue_events') {
        b.insert = vi.fn(() => { insertSpy(); return b })
      }
      return b
    }
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('queue_off_default')
    expect(r.queue_event_id).toBeNull()
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('sem default_assignee_id -> queue_off_no_default sem atribuir', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: false, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('queue_off_no_default')
    expect(r.assigned_user_id).toBeNull()
  })

  it('default_assignee_id em skip_user_ids -> queue_off_no_default', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: false, queue_mode_timeout_minutes: 5, default_assignee_id: 'user-skip' },
        error: null,
      },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      skip_user_ids: ['user-skip'],
    })
    expect(r.reason).toBe('queue_off_no_default')
    expect(r.assigned_user_id).toBeNull()
  })
})

describe('assignHandoff — Modo ON (round-robin)', () => {
  it('RPC retorna user -> queue_on_picked', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 7, default_assignee_id: null },
        error: null,
      },
      rpcResult: { data: 'user-rr', error: null },
      authUser: { user: { email: 'alberto@example.com' } },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('queue_on_picked')
    expect(r.assigned_user_id).toBe('user-rr')
    expect(r.assignee_name).toBe('alberto') // fallback email prefix
    expect(r.timeout_minutes).toBe(7)
    expect(supabase.rpc).toHaveBeenCalledWith('pick_next_assignee', {
      _department_id: 'd1',
      _skip_user_ids: [],
    })
  })

  it('RPC retorna null -> no_eligible', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      rpcResult: { data: null, error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('no_eligible')
    expect(r.assigned_user_id).toBeNull()
  })

  it('RPC erra -> reason error (caller faz fallback)', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      rpcResult: { data: null, error: { message: 'rpc failed' } },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('error')
    expect(r.assigned_user_id).toBeNull()
  })

  it('passa skip_user_ids no RPC', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      rpcResult: { data: 'user-other', error: null },
    })
    await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      skip_user_ids: ['skip-a', 'skip-b'],
    })
    expect(supabase.rpc).toHaveBeenCalledWith('pick_next_assignee', {
      _department_id: 'd1',
      _skip_user_ids: ['skip-a', 'skip-b'],
    })
  })
})

describe('assignHandoff — D-β (re-handoff)', () => {
  it('previous assignee elegivel -> reused_previous (NAO chama RPC)', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      member: { data: { user_id: 'user-prev', queue_paused: false, gestor_in_queue: false }, error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      previous_assignee_id: 'user-prev',
    })
    expect(r.reason).toBe('reused_previous')
    expect(r.assigned_user_id).toBe('user-prev')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('previous assignee pausado -> cai pra modo ON via RPC', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      member: { data: { user_id: 'user-prev', queue_paused: true, gestor_in_queue: false }, error: null },
      rpcResult: { data: 'user-next', error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      previous_assignee_id: 'user-prev',
    })
    expect(r.reason).toBe('queue_on_picked')
    expect(r.assigned_user_id).toBe('user-next')
  })

  it('previous assignee nao mais no dept (member null) -> cai pra fila', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: false, queue_mode_timeout_minutes: 5, default_assignee_id: 'user-default' },
        error: null,
      },
      member: { data: null, error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      previous_assignee_id: 'user-prev',
    })
    expect(r.reason).toBe('queue_off_default')
    expect(r.assigned_user_id).toBe('user-default')
    expect(r.queue_event_id).toBeNull() // R125
  })

  it('previous assignee em skip_user_ids -> ignora', async () => {
    const supabase = makeSupabase({
      departments: {
        data: { id: 'd1', queue_mode_enabled: true, queue_mode_timeout_minutes: 5, default_assignee_id: null },
        error: null,
      },
      rpcResult: { data: 'user-x', error: null },
    })
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
      previous_assignee_id: 'user-prev',
      skip_user_ids: ['user-prev'],
    })
    expect(r.reason).toBe('queue_on_picked')
  })
})

describe('assignHandoff — falhas', () => {
  it('exception em consulta de dept retorna error', async () => {
    const supabase = {
      from: () => {
        throw new Error('boom')
      },
      rpc: vi.fn(),
      auth: { admin: { getUserById: vi.fn() } },
    }
    const r = await assignHandoff({
      supabase,
      conversation_id: 'conv-1',
      department_id: 'd1',
    })
    expect(r.reason).toBe('error')
    expect(r.assigned_user_id).toBeNull()
  })
})

describe('applyAssigneeNameTemplate (D-γ)', () => {
  it('substitui {handoff_assignee_name} por nome', () => {
    const out = applyAssigneeNameTemplate('Vou te conectar com {handoff_assignee_name} agora.', 'Lucas')
    expect(out).toBe('Vou te conectar com Lucas agora.')
  })

  it('multiplas ocorrencias sao trocadas', () => {
    const out = applyAssigneeNameTemplate('{handoff_assignee_name} vai te ajudar. {handoff_assignee_name}.', 'Ana')
    expect(out).toBe('Ana vai te ajudar. Ana.')
  })

  it('nome null vira "consultor"', () => {
    const out = applyAssigneeNameTemplate('Vou te conectar com {handoff_assignee_name}.', null)
    expect(out).toBe('Vou te conectar com consultor.')
  })

  it('nome vazio/whitespace vira "consultor"', () => {
    expect(applyAssigneeNameTemplate('Oi {handoff_assignee_name}', '')).toBe('Oi consultor')
    expect(applyAssigneeNameTemplate('Oi {handoff_assignee_name}', '   ')).toBe('Oi consultor')
  })

  it('template vazio nao quebra', () => {
    expect(applyAssigneeNameTemplate('', 'Lucas')).toBe('')
  })

  it('template sem placeholder retorna identico', () => {
    expect(applyAssigneeNameTemplate('Texto livre', 'Lucas')).toBe('Texto livre')
  })
})
