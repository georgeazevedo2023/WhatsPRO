import { describe, it, expect, vi } from 'vitest'
import {
  loadCampaignContext,
  loadFormContext,
  loadBioContext,
  buildFunnelSections,
  buildContextDocuments,
} from './contextDocuments.ts'
import type { FunnelData, ProfileData } from './context.ts'

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function builder(maybeSingleResult: any) {
  const b: any = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    order: vi.fn(() => b),
    limit: vi.fn(async () => maybeSingleResult),
    maybeSingle: vi.fn(async () => maybeSingleResult),
  }
  return b
}

function supabaseWith(handlers: Record<string, any>) {
  return {
    from: (table: string) => {
      if (handlers[table]) return builder(handlers[table])
      return builder({ data: null, error: null })
    },
  }
}

// ── loadCampaignContext ─────────────────────────────────────────────

describe('loadCampaignContext', () => {
  it('retorna string vazia quando sem tag campanha:', async () => {
    const r = await loadCampaignContext(supabaseWith({}) as any, ['outra:tag'], 'inst-1')
    expect(r).toBe('')
  })

  it('retorna string vazia quando campanha não existe no DB', async () => {
    const r = await loadCampaignContext(
      supabaseWith({ utm_campaigns: { data: null, error: null } }) as any,
      ['campanha:black-friday'],
      'inst-1',
    )
    expect(r).toBe('')
  })

  it('monta bloco com campos básicos quando campanha existe', async () => {
    const r = await loadCampaignContext(
      supabaseWith({
        utm_campaigns: {
          data: { name: 'Black Friday', campaign_type: 'promocional', utm_source: 'instagram', utm_medium: 'cpc', ai_template: null, ai_custom_text: null },
          error: null,
        },
      }) as any,
      ['campanha:black-friday'],
      'inst-1',
    )
    expect(r).toContain('<campaign_context>')
    expect(r).toContain('"Black Friday"')
    expect(r).toContain('Origem: instagram / cpc')
    expect(r).toContain('</campaign_context>')
  })

  it('inclui ai_template e ai_custom_text quando presentes', async () => {
    const r = await loadCampaignContext(
      supabaseWith({
        utm_campaigns: {
          data: { name: 'X', campaign_type: 't', utm_source: null, utm_medium: null, ai_template: 'TEMPLATE-X', ai_custom_text: 'TEXTO-Y' },
          error: null,
        },
      }) as any,
      ['campanha:X'],
      'inst-1',
    )
    expect(r).toContain('Instrução da campanha: TEMPLATE-X')
    expect(r).toContain('Detalhes: TEXTO-Y')
    expect(r).toContain('Origem: direto')
  })

  it('lida com slug contendo dois pontos', async () => {
    const r = await loadCampaignContext(
      supabaseWith({
        utm_campaigns: { data: { name: 'sub:campanha:nome', campaign_type: 't', utm_source: null, utm_medium: null }, error: null },
      }) as any,
      ['campanha:sub:campanha:nome'],
      'inst-1',
    )
    expect(r).toContain('"sub:campanha:nome"')
  })
})

// ── loadFormContext ─────────────────────────────────────────────────

describe('loadFormContext', () => {
  it('retorna vazio sem tag formulario:', async () => {
    const r = await loadFormContext(supabaseWith({}) as any, ['campanha:x'], 'c-1', makeLog())
    expect(r).toBe('')
  })

  it('monta bloco com entries quando submission existe', async () => {
    const r = await loadFormContext(
      supabaseWith({
        form_submissions: {
          data: [{ data: { nome: 'João', cidade: 'Recife' }, submitted_at: '2026-05-21', whatsapp_forms: { name: 'Cadastro' } }],
          error: null,
        },
      }) as any,
      ['formulario:cadastro'],
      'c-1',
      makeLog(),
    )
    expect(r).toContain('<form_data>')
    expect(r).toContain('"Cadastro"')
    expect(r).toContain('- nome: João')
    expect(r).toContain('- cidade: Recife')
    expect(r).toContain('NÃO pergunte novamente')
  })

  it('retorna vazio quando submissions array vazio', async () => {
    const r = await loadFormContext(
      supabaseWith({ form_submissions: { data: [], error: null } }) as any,
      ['formulario:cadastro'],
      'c-1',
      makeLog(),
    )
    expect(r).toBe('')
  })

  it('captura erro do DB e loga warn sem propagar', async () => {
    const log = makeLog()
    const bad = {
      from: () => {
        const b: any = {
          select: () => b,
          eq: () => b,
          order: () => b,
          limit: async () => { throw new Error('db down') },
        }
        return b
      },
    }
    const r = await loadFormContext(bad as any, ['formulario:x'], 'c-1', log)
    expect(r).toBe('')
    expect(log.warn).toHaveBeenCalledWith('Form data load error (non-critical)', expect.any(Object))
  })

  it('fallback de nome usa slug quando whatsapp_forms.name ausente', async () => {
    const r = await loadFormContext(
      supabaseWith({
        form_submissions: { data: [{ data: { campo: 'valor' }, submitted_at: '', whatsapp_forms: null }], error: null },
      }) as any,
      ['formulario:slug-cru'],
      'c-1',
      makeLog(),
    )
    expect(r).toContain('"slug-cru"')
  })
})

// ── loadBioContext ──────────────────────────────────────────────────

describe('loadBioContext', () => {
  it('retorna vazio sem tag bio_page:', async () => {
    const r = await loadBioContext(supabaseWith({}) as any, [], makeLog())
    expect(r).toBe('')
  })

  it('monta bloco com title quando bio_page existe', async () => {
    const r = await loadBioContext(
      supabaseWith({ bio_pages: { data: { title: 'Minha Bio', slug: 'minha-bio', description: null }, error: null } }) as any,
      ['bio_page:minha-bio'],
      makeLog(),
    )
    expect(r).toContain('<bio_context>')
    expect(r).toContain('"Minha Bio"')
    expect(r).not.toContain('Descrição da página:')
    expect(r).toContain('</bio_context>')
  })

  it('inclui description quando presente', async () => {
    const r = await loadBioContext(
      supabaseWith({ bio_pages: { data: { title: 'B', slug: 'b', description: 'DESC' }, error: null } }) as any,
      ['bio_page:b'],
      makeLog(),
    )
    expect(r).toContain('Descrição da página: DESC')
  })

  it('captura erro do DB e loga warn sem propagar', async () => {
    const log = makeLog()
    const bad = {
      from: () => {
        const b: any = {
          select: () => b,
          eq: () => b,
          maybeSingle: async () => { throw new Error('boom') },
        }
        return b
      },
    }
    const r = await loadBioContext(bad as any, ['bio_page:x'], log)
    expect(r).toBe('')
    expect(log.warn).toHaveBeenCalledWith('Bio context load error (non-critical)', expect.any(Object))
  })
})

// ── buildFunnelSections ─────────────────────────────────────────────

describe('buildFunnelSections', () => {
  it('retorna vazio em ambos quando nem funnel nem profile', () => {
    const r = buildFunnelSections(null, null, makeLog())
    expect(r.campaignAppend).toBe('')
    expect(r.funnelInstructionsSection).toBe('')
  })

  it('com funnel mas sem profile e sem funnel_prompt, monta só campaign block', () => {
    const fd: FunnelData = { name: 'F1', type: 'vendas', ai_template: 'TEMPL', ai_custom_text: 'CTX' }
    const r = buildFunnelSections(fd, null, makeLog())
    expect(r.campaignAppend).toContain('<funnel_context>')
    expect(r.campaignAppend).toContain('"F1"')
    expect(r.campaignAppend).toContain('TEMPL')
    expect(r.campaignAppend).toContain('CTX')
    expect(r.funnelInstructionsSection).toBe('')
  })

  it('com funnel + profile, profile ganha prioridade (vai pra funnelInstructions)', () => {
    const log = makeLog()
    const fd: FunnelData = { name: 'F1', type: 't', funnel_prompt: 'FUNNEL-PROMPT' }
    const pd: ProfileData = {
      id: 'p1', prompt: 'PROFILE-PROMPT',
      handoff_rule: null, handoff_max_messages: null,
      handoff_department_id: null, handoff_message: null,
    }
    const r = buildFunnelSections(fd, pd, log)
    expect(r.funnelInstructionsSection).toContain('<profile_instructions>')
    expect(r.funnelInstructionsSection).toContain('PROFILE-PROMPT')
    expect(r.funnelInstructionsSection).not.toContain('FUNNEL-PROMPT')
    expect(log.info).toHaveBeenCalledWith('Profile instructions injected', expect.any(Object))
  })

  it('com funnel + funnel_prompt mas sem profile, usa funnel_instructions (legacy)', () => {
    const log = makeLog()
    const fd: FunnelData = { name: 'F1', type: 't', funnel_prompt: 'FUNNEL-PROMPT' }
    const r = buildFunnelSections(fd, null, log)
    expect(r.funnelInstructionsSection).toContain('<funnel_instructions>')
    expect(r.funnelInstructionsSection).toContain('FUNNEL-PROMPT')
    expect(log.info).toHaveBeenCalledWith('Funnel instructions injected (legacy)', expect.any(Object))
  })

  it('com profile e sem funnel, monta profile_instructions e campaignAppend vazio', () => {
    const log = makeLog()
    const pd: ProfileData = {
      id: 'p1', prompt: 'P',
      handoff_rule: null, handoff_max_messages: null,
      handoff_department_id: null, handoff_message: null,
    }
    const r = buildFunnelSections(null, pd, log)
    expect(r.campaignAppend).toBe('')
    expect(r.funnelInstructionsSection).toContain('<profile_instructions>')
    expect(log.info).toHaveBeenCalledWith('Default profile instructions injected (no funnel)', expect.any(Object))
  })

  it('profile com prompt vazio é tratado como ausente', () => {
    const fd: FunnelData = { name: 'F', type: 't', funnel_prompt: 'FUNNEL' }
    const pd: ProfileData = {
      id: 'p1', prompt: '   ',
      handoff_rule: null, handoff_max_messages: null,
      handoff_department_id: null, handoff_message: null,
    }
    const r = buildFunnelSections(fd, pd, makeLog())
    expect(r.funnelInstructionsSection).toContain('<funnel_instructions>')
  })
})

// ── buildContextDocuments (orchestrator) ────────────────────────────

describe('buildContextDocuments', () => {
  it('agrega as 4 fontes em ordem (campaign + form + bio + funnel)', async () => {
    const supabase = supabaseWith({
      utm_campaigns: { data: { name: 'C', campaign_type: 't', utm_source: 's', utm_medium: 'm' }, error: null },
      form_submissions: { data: [{ data: { x: 1 }, submitted_at: '', whatsapp_forms: { name: 'F' } }], error: null },
      bio_pages: { data: { title: 'B', slug: 'b', description: null }, error: null },
    })
    const fd: FunnelData = { name: 'Fu', type: 't', funnel_prompt: 'P' }
    const r = await buildContextDocuments(
      supabase as any,
      {
        conversation: { tags: ['campanha:C', 'formulario:F', 'bio_page:b', 'funil:Fu'] },
        instanceId: 'inst-1',
        contactId: 'c-1',
        funnelData: fd,
        profileData: null,
      },
      makeLog(),
    )
    const ord = ['<campaign_context>', '<form_data>', '<bio_context>', '<funnel_context>']
    let lastIdx = -1
    for (const tag of ord) {
      const idx = r.campaignContext.indexOf(tag)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
    expect(r.funnelInstructionsSection).toContain('<funnel_instructions>')
  })

  it('retorna ambos vazios quando nenhuma tag/funnel/profile', async () => {
    const r = await buildContextDocuments(
      supabaseWith({}) as any,
      { conversation: { tags: [] }, instanceId: 'i', contactId: null, funnelData: null, profileData: null },
      makeLog(),
    )
    expect(r.campaignContext).toBe('')
    expect(r.funnelInstructionsSection).toBe('')
  })
})
