import { describe, it, expect, vi } from 'vitest'
import {
  JOB_VACANCY_TAG,
  buildJobVacancyReply,
  detectJobVacancy,
  tryJobVacancyShortCircuit,
} from './jobVacancy.ts'

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

describe('detectJobVacancy', () => {
  it('detecta sinais fortes de vaga de emprego', () => {
    expect(detectJobVacancy('vocês estão contratando?')).toBe(true)
    expect(detectJobVacancy('queria deixar meu currículo')).toBe(true)
    expect(detectJobVacancy('posso mandar meu curriculo?')).toBe(true)
    expect(detectJobVacancy('tem vaga de emprego aí?')).toBe(true)
    expect(detectJobVacancy('vocês têm alguma oportunidade de trabalho?')).toBe(true)
    expect(detectJobVacancy('queria trabalhar com vocês')).toBe(true)
    expect(detectJobVacancy('tão precisando de funcionário?')).toBe(true)
    expect(detectJobVacancy('como faço pro processo seletivo?')).toBe(true)
  })
  it('detecta "vaga" solto (sem contexto de vaga física)', () => {
    expect(detectJobVacancy('tem vaga?')).toBe(true)
    expect(detectJobVacancy('vocês têm vagas abertas?')).toBe(true)
  })
  it('NÃO confunde vaga física (garagem/estacionamento/demarcação) com emprego', () => {
    expect(detectJobVacancy('quero piso pra vaga de garagem')).toBe(false)
    expect(detectJobVacancy('tinta para demarcar vagas do estacionamento')).toBe(false)
    expect(detectJobVacancy('pintar as vagas de carros')).toBe(false)
  })
  it('NÃO dispara em conversa normal de venda', () => {
    expect(detectJobVacancy('quero uma porta de alumínio')).toBe(false)
    expect(detectJobVacancy('qual o preço da telha?')).toBe(false)
    expect(detectJobVacancy('oi, bom dia')).toBe(false)
    expect(detectJobVacancy('')).toBe(false)
    expect(detectJobVacancy(null)).toBe(false)
  })
})

describe('buildJobVacancyReply', () => {
  it('inclui o e-mail e a oferta de ajuda extra', () => {
    const msg = buildJobVacancyReply('rh@empresa.com')
    expect(msg).toContain('rh@empresa.com')
    expect(msg.toLowerCase()).toContain('algo mais')
  })
  it('usa só o primeiro nome quando conhecido', () => {
    expect(buildJobVacancyReply('rh@empresa.com', 'Maria Silva')).toMatch(/^Maria, /)
    expect(buildJobVacancyReply('rh@empresa.com', null)).toMatch(/^Que /)
  })
})

// ── tryJobVacancyShortCircuit (integração com mocks) ─────────────────────

function makeSupabase() {
  const updates: any[] = []
  const inserts: any[] = []
  const supabase: any = {
    from(table: string) {
      return {
        update(payload: any) {
          return {
            eq: (_c: string, _v: any) => {
              updates.push({ table, payload })
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        insert(payload: any) {
          inserts.push({ table, payload })
          return {
            select: () => ({ single: async () => ({ data: { id: 'msg-1', created_at: 'now' }, error: null }) }),
            then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
          }
        },
      }
    },
  }
  return { supabase, updates, inserts }
}

function baseCtx(supabase: any, overrides: Record<string, any> = {}): any {
  return {
    supabase,
    conversation: { inbox_id: 'inb-1', tags: [] },
    conversation_id: 'conv-1',
    agent_id: 'agt-1',
    agent: { business_info: { jobs_email: 'rh@empresa.com' } },
    incomingText: 'vocês estão contratando?',
    leadName: null,
    queuedMessages: [],
    startTime: 0,
    corsHeaders: {},
    sendTextMsg: vi.fn(async () => ({})),
    broadcastEvent: vi.fn(),
    ...overrides,
  }
}

describe('tryJobVacancyShortCircuit', () => {
  it('happy path: tagueia motivo:vaga_emprego + envia resposta com o e-mail', async () => {
    const { supabase, updates } = makeSupabase()
    const ctx = baseCtx(supabase)
    const res = await tryJobVacancyShortCircuit(ctx, makeLog())
    expect(res.handled).toBe(true)
    expect(updates[0].payload.tags).toContain(JOB_VACANCY_TAG)
    expect(ctx.sendTextMsg).toHaveBeenCalledWith(expect.stringContaining('rh@empresa.com'))
  })
  it('inerte sem jobs_email configurado', async () => {
    const { supabase } = makeSupabase()
    const ctx = baseCtx(supabase, { agent: { business_info: {} } })
    const res = await tryJobVacancyShortCircuit(ctx, makeLog())
    expect(res.handled).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })
  it('guard anti-loop: tag já presente → não re-dispara ("vou mandar o currículo")', async () => {
    const { supabase } = makeSupabase()
    const ctx = baseCtx(supabase, {
      conversation: { inbox_id: 'inb-1', tags: [JOB_VACANCY_TAG] },
      incomingText: 'ok, vou mandar o currículo',
    })
    const res = await tryJobVacancyShortCircuit(ctx, makeLog())
    expect(res.handled).toBe(false)
    expect(ctx.sendTextMsg).not.toHaveBeenCalled()
  })
  it('mensagem sem sinal de vaga → não dispara', async () => {
    const { supabase, updates } = makeSupabase()
    const ctx = baseCtx(supabase, { incomingText: 'quero uma telha brasilit' })
    const res = await tryJobVacancyShortCircuit(ctx, makeLog())
    expect(res.handled).toBe(false)
    expect(updates.length).toBe(0)
  })
  it('send falha → handled=false mas tag persiste (LLM assume sem loop)', async () => {
    const { supabase, updates } = makeSupabase()
    const ctx = baseCtx(supabase, { sendTextMsg: vi.fn(async () => { throw new Error('uazapi down') }) })
    const res = await tryJobVacancyShortCircuit(ctx, makeLog())
    expect(res.handled).toBe(false)
    expect(updates[0].payload.tags).toContain(JOB_VACANCY_TAG)
  })
})
