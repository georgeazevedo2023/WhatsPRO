import { describe, it, expect, vi } from 'vitest'

import { assignLabel, moveKanban, updateLeadProfile, dispatchCrmTool } from './crmTools.ts'
import type { CrmToolsCtx } from './crmTools.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

// Supabase mock genérico fluent builder + result programável por tabela/op.
type Step = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  filters: Array<[string, any]>
  payload?: any
  modifier?: string
}

function makeSupabase(handlers: Partial<Record<string, (step: Step) => any>>) {
  const calls: Step[] = []
  const supabase: any = {
    from(table: string) {
      const state: Step = { table, op: 'select', filters: [] }
      const builder: any = {
        select(_cols: string) {
          builder._isSelect = true
          return builder
        },
        eq(col: string, val: any) {
          state.filters.push([col, val])
          return builder
        },
        ilike(col: string, val: any) {
          state.filters.push([col, val])
          return builder
        },
        async maybeSingle() {
          state.op = 'select'
          state.modifier = 'maybeSingle'
          calls.push({ ...state })
          const handler = handlers[`${table}.maybeSingle`]
          return handler ? handler({ ...state }) : { data: null, error: null }
        },
        async single() {
          state.op = 'select'
          state.modifier = 'single'
          calls.push({ ...state })
          const handler = handlers[`${table}.single`]
          return handler ? handler({ ...state }) : { data: null, error: null }
        },
        insert(payload: any) {
          state.op = 'insert'
          state.payload = payload
          calls.push({ ...state })
          // Allow chaining `.select().single()` after insert (kanban auto-create case)
          const insertResult: any = {
            select(_c: string) {
              return {
                async single() {
                  const handler = handlers[`${table}.insert.single`]
                  return handler ? handler({ ...state }) : { data: null, error: null }
                },
              }
            },
            then(resolve: any) {
              const handler = handlers[`${table}.insert`]
              const result = handler ? handler({ ...state }) : { data: null, error: null }
              return Promise.resolve(result).then(resolve)
            },
          }
          return insertResult
        },
        update(payload: any) {
          state.op = 'update'
          state.payload = payload
          return {
            eq(col: string, val: any) {
              state.filters.push([col, val])
              calls.push({ ...state })
              const handler = handlers[`${table}.update`]
              return Promise.resolve(handler ? handler({ ...state }) : { data: null, error: null })
            },
          }
        },
        delete() {
          state.op = 'delete'
          return {
            eq(col: string, val: any) {
              state.filters.push([col, val])
              calls.push({ ...state })
              const handler = handlers[`${table}.delete`]
              return Promise.resolve(handler ? handler({ ...state }) : { data: null, error: null })
            },
          }
        },
        async upsert(payload: any, _opts?: any) {
          state.op = 'upsert'
          state.payload = payload
          calls.push({ ...state })
          const handler = handlers[`${table}.upsert`]
          return handler ? handler({ ...state }) : { data: null, error: null }
        },
      }
      return builder
    },
  }
  return { supabase, calls }
}

function baseCtx(supabase: any, overrides: Partial<CrmToolsCtx> = {}): CrmToolsCtx {
  return {
    supabase,
    agent_id: 'agt-1',
    conversation: { inbox_id: 'inb-1' },
    conversation_id: 'conv-1',
    contact: { id: 'contact-1', name: 'Pedro', phone: '5581987654321' },
    instance_id: 'inst-1',
    leadProfile: null,
    availableLabelNames: ['VIP', 'Frio', 'Quente'],
    ...overrides,
  }
}

// =============================================================================
// assign_label
// =============================================================================

describe('assignLabel', () => {
  it('retorna erro se label_name vazio', async () => {
    const { supabase } = makeSupabase({})
    const res = await assignLabel({}, baseCtx(supabase), makeLog())
    expect(res).toContain('não informado')
  })

  it('retorna disponíveis quando label não encontrada', async () => {
    const { supabase } = makeSupabase({
      'labels.maybeSingle': () => ({ data: null, error: null }),
    })
    const res = await assignLabel({ label_name: 'Inexistente' }, baseCtx(supabase), makeLog())
    expect(res).toContain('não encontrada')
    expect(res).toContain('VIP')
    expect(res).toContain('Frio')
  })

  it('happy path — delete existentes + insert + log', async () => {
    const { supabase, calls } = makeSupabase({
      'labels.maybeSingle': () => ({ data: { id: 'lbl-1', name: 'VIP' }, error: null }),
      'conversation_labels.delete': () => ({ data: null, error: null }),
      'conversation_labels.insert': () => ({ data: null, error: null }),
      'ai_agent_logs.insert': () => ({ data: null, error: null }),
    })
    const res = await assignLabel({ label_name: 'vip' }, baseCtx(supabase), makeLog())
    expect(res).toBe('Etiqueta "VIP" atribuída.')
    const tables = calls.map((c) => `${c.table}.${c.op}`)
    expect(tables).toContain('conversation_labels.delete')
    expect(tables).toContain('conversation_labels.insert')
    expect(tables).toContain('ai_agent_logs.insert')
  })

  it('escapa wildcards % e _ no ilike (prevent injection)', async () => {
    const { supabase, calls } = makeSupabase({
      'labels.maybeSingle': () => ({ data: { id: 'lbl-1', name: 'VIP' }, error: null }),
      'conversation_labels.delete': () => ({ data: null, error: null }),
      'conversation_labels.insert': () => ({ data: null, error: null }),
      'ai_agent_logs.insert': () => ({ data: null, error: null }),
    })
    await assignLabel({ label_name: '50%_off' }, baseCtx(supabase), makeLog())
    const labelsCall = calls.find((c) => c.table === 'labels')!
    const ilikeFilter = labelsCall.filters.find(([col]) => col === 'name')!
    expect(ilikeFilter[1]).toBe('50\\%\\_off')
  })

  it('propaga erro do insert', async () => {
    const { supabase } = makeSupabase({
      'labels.maybeSingle': () => ({ data: { id: 'lbl-1', name: 'VIP' }, error: null }),
      'conversation_labels.delete': () => ({ data: null, error: null }),
      'conversation_labels.insert': () => ({ data: null, error: { message: 'unique violation' } }),
    })
    const res = await assignLabel({ label_name: 'VIP' }, baseCtx(supabase), makeLog())
    expect(res).toContain('Erro ao atribuir etiqueta')
    expect(res).toContain('unique violation')
  })
})

// =============================================================================
// move_kanban
// =============================================================================

describe('moveKanban', () => {
  it('retorna erro se column_name vazio', async () => {
    const { supabase } = makeSupabase({})
    const res = await moveKanban({}, baseCtx(supabase), makeLog())
    expect(res).toContain('não informado')
  })

  it('retorna erro quando instância não tem board', async () => {
    const { supabase } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: null, error: null }),
    })
    const res = await moveKanban({ column_name: 'Lead' }, baseCtx(supabase), makeLog())
    expect(res).toContain('Nenhum quadro Kanban')
  })

  it('retorna erro quando coluna não existe', async () => {
    const { supabase } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: { id: 'brd-1' }, error: null }),
      'kanban_columns.maybeSingle': () => ({ data: null, error: null }),
    })
    const res = await moveKanban({ column_name: 'Inexistente' }, baseCtx(supabase), makeLog())
    expect(res).toContain('"Inexistente" não encontrada')
  })

  it('auto-cria card quando não existe pro contact', async () => {
    const { supabase, calls } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: { id: 'brd-1' }, error: null }),
      'kanban_columns.maybeSingle': () => ({ data: { id: 'col-1', name: 'Lead Frio' }, error: null }),
      'kanban_cards.maybeSingle': () => ({ data: null, error: null }),
      'kanban_cards.insert.single': () => ({
        data: { id: 'card-new', title: 'Pedro', column_id: 'col-1' },
        error: null,
      }),
      'ai_agent_logs.insert': () => ({ data: null, error: null }),
    })
    const res = await moveKanban({ column_name: 'Lead Frio' }, baseCtx(supabase), makeLog())
    expect(res).toBe('Card "Pedro" criado na coluna "Lead Frio".')
    const insertCall = calls.find((c) => c.table === 'kanban_cards' && c.op === 'insert')!
    expect(insertCall.payload.tags).toEqual(['lead', 'auto-criado'])
    expect(insertCall.payload.title).toBe('Pedro')
    const logCall = calls.find((c) => c.table === 'ai_agent_logs' && c.op === 'insert')!
    expect(logCall.payload.event).toBe('kanban_created')
  })

  it('usa phone quando contact.name vazio na auto-criação', async () => {
    const { supabase, calls } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: { id: 'brd-1' }, error: null }),
      'kanban_columns.maybeSingle': () => ({ data: { id: 'col-1', name: 'Lead' }, error: null }),
      'kanban_cards.maybeSingle': () => ({ data: null, error: null }),
      'kanban_cards.insert.single': () => ({
        data: { id: 'card-new', title: '5581987654321', column_id: 'col-1' },
        error: null,
      }),
      'ai_agent_logs.insert': () => ({ data: null, error: null }),
    })
    const ctx = baseCtx(supabase, { contact: { id: 'c1', name: null, phone: '5581987654321' } })
    await moveKanban({ column_name: 'Lead' }, ctx, makeLog())
    const insertCall = calls.find((c) => c.table === 'kanban_cards' && c.op === 'insert')!
    expect(insertCall.payload.title).toBe('5581987654321')
  })

  it('retorna idempotência quando card já está na coluna alvo', async () => {
    const { supabase, calls } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: { id: 'brd-1' }, error: null }),
      'kanban_columns.maybeSingle': () => ({ data: { id: 'col-1', name: 'Quente' }, error: null }),
      'kanban_cards.maybeSingle': () => ({
        data: { id: 'card-1', title: 'Pedro', column_id: 'col-1' },
        error: null,
      }),
    })
    const res = await moveKanban({ column_name: 'Quente' }, baseCtx(supabase), makeLog())
    expect(res).toContain('já está na coluna')
    const updateCalls = calls.filter((c) => c.table === 'kanban_cards' && c.op === 'update')
    expect(updateCalls.length).toBe(0)
  })

  it('move card existente + log kanban_moved', async () => {
    const { supabase, calls } = makeSupabase({
      'kanban_boards.maybeSingle': () => ({ data: { id: 'brd-1' }, error: null }),
      'kanban_columns.maybeSingle': () => ({ data: { id: 'col-2', name: 'Quente' }, error: null }),
      'kanban_cards.maybeSingle': () => ({
        data: { id: 'card-1', title: 'Pedro', column_id: 'col-1' },
        error: null,
      }),
      'kanban_cards.update': () => ({ data: null, error: null }),
      'ai_agent_logs.insert': () => ({ data: null, error: null }),
    })
    const res = await moveKanban({ column_name: 'Quente' }, baseCtx(supabase), makeLog())
    expect(res).toBe('Card "Pedro" movido para "Quente".')
    const updateCall = calls.find((c) => c.table === 'kanban_cards' && c.op === 'update')!
    expect(updateCall.payload).toEqual({ column_id: 'col-2' })
    const logCall = calls.find((c) => c.table === 'ai_agent_logs' && c.op === 'insert')!
    expect(logCall.payload.event).toBe('kanban_moved')
  })
})

// =============================================================================
// update_lead_profile
// =============================================================================

describe('updateLeadProfile', () => {
  it('dedup nome duplicado "PedroPedro" → "Pedro"', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    const res = await updateLeadProfile({ full_name: 'PedroPedro' }, baseCtx(supabase), makeLog())
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(upsertCall.payload.full_name).toBe('Pedro')
    // First-name reminder for LLM
    expect(res).toContain('"Pedro"')
  })

  it('não toca em nome quando não duplicado', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    await updateLeadProfile({ full_name: 'João Silva' }, baseCtx(supabase), makeLog())
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(upsertCall.payload.full_name).toBe('João Silva')
  })

  // 2026-05-26: o dedup antigo (length>=4, cada metade>=2) comia nomes curtos e
  // apelidos reduplicados lowercase. Agora exige cada metade >= 3 chars.
  it.each(['João', 'Ana', 'lulu', 'bibi', 'dudu', 'Nono', 'Lili'])(
    'NÃO trunca nome curto/apelido "%s"',
    async (name) => {
      const { supabase, calls } = makeSupabase({
        'lead_profiles.upsert': () => ({ data: null, error: null }),
      })
      await updateLeadProfile({ full_name: name }, baseCtx(supabase), makeLog())
      const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
      expect(upsertCall.payload.full_name).toBe(name)
    },
  )

  it('ainda colapsa doubling longo case-insensitive "georgeGeorge" → "george"', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    await updateLeadProfile({ full_name: 'georgeGeorge' }, baseCtx(supabase), makeLog())
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(upsertCall.payload.full_name).toBe('george')
  })

  it('merge objections com existentes sem duplicar', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    const ctx = baseCtx(supabase, { leadProfile: { objections: ['preço alto', 'sem urgência'] } })
    await updateLeadProfile({ objections: ['preço alto', 'frete'] }, ctx, makeLog())
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(upsertCall.payload.objections).toEqual(['preço alto', 'sem urgência', 'frete'])
  })

  it('grava todos os campos opcionais quando presentes', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    await updateLeadProfile(
      {
        city: 'Recife',
        interests: ['tintas', 'piso'],
        notes: 'cliente recorrente',
        reason: 'reforma sala',
        average_ticket: 2500,
      },
      baseCtx(supabase),
      makeLog(),
    )
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(upsertCall.payload.city).toBe('Recife')
    expect(upsertCall.payload.interests).toEqual(['tintas', 'piso'])
    expect(upsertCall.payload.notes).toBe('cliente recorrente')
    expect(upsertCall.payload.reason).toBe('reforma sala')
    expect(upsertCall.payload.average_ticket).toBe(2500)
    expect(upsertCall.payload.last_contact_at).toBeTruthy()
  })

  it('omite campos não informados (não persiste null)', async () => {
    const { supabase, calls } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    await updateLeadProfile({ city: 'Recife' }, baseCtx(supabase), makeLog())
    const upsertCall = calls.find((c) => c.table === 'lead_profiles' && c.op === 'upsert')!
    expect(Object.keys(upsertCall.payload).sort()).toEqual(
      ['city', 'contact_id', 'last_contact_at'].sort(),
    )
  })

  it('propaga erro do upsert', async () => {
    const { supabase } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: { message: 'check constraint' } }),
    })
    const res = await updateLeadProfile({ city: 'Recife' }, baseCtx(supabase), makeLog())
    expect(res).toContain('Erro ao atualizar perfil')
    expect(res).toContain('check constraint')
  })

  it('sem name persistido → resposta normal sem hint pro LLM', async () => {
    const { supabase } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    const res = await updateLeadProfile({ city: 'Recife' }, baseCtx(supabase), makeLog())
    expect(res).toContain('Perfil atualizado')
    expect(res).not.toContain('IMPORTANTE')
  })
})

// =============================================================================
// dispatcher
// =============================================================================

describe('dispatchCrmTool', () => {
  it('roteia assign_label, move_kanban, update_lead_profile', async () => {
    const { supabase } = makeSupabase({
      'lead_profiles.upsert': () => ({ data: null, error: null }),
    })
    const res = await dispatchCrmTool('update_lead_profile', { city: 'X' }, baseCtx(supabase), makeLog())
    expect(res).toContain('Perfil atualizado')
  })

  it('retorna null pra name desconhecido (caller cai pro próximo handler)', async () => {
    const { supabase } = makeSupabase({})
    const res = await dispatchCrmTool('search_products', {}, baseCtx(supabase), makeLog())
    expect(res).toBeNull()
  })
})
