import { describe, it, expect } from 'vitest'
import {
  replaceVars,
  buildIdentitySection,
  buildBusinessSection,
  buildLeadContextBlock,
  buildDynamicContext,
  buildFactsBlock,
  buildAgentPromptSections,
} from './promptSections.ts'

// ── replaceVars ──────────────────────────────────────────────────────

describe('replaceVars', () => {
  it('substitui todas as 6 variáveis quando agent tem todos os campos', () => {
    const txt = '{agent_name}-{personality}-{max_pre_search_questions}-{max_qualification_retries}-{max_enrichment_questions}-{max_discount_percent}'
    const r = replaceVars(txt, {
      name: 'Bot', personality: 'amigável',
      max_pre_search_questions: 5, max_qualification_retries: 4, max_enrichment_questions: 6,
      max_discount_percent: 15,
    })
    expect(r).toBe('Bot-amigável-5-4-6-15%')
  })

  it('aplica defaults quando agent vazio', () => {
    const r = replaceVars('{agent_name}-{personality}-{max_pre_search_questions}-{max_discount_percent}', {})
    expect(r).toBe('Assistente-Profissional, simpático e objetivo-3-NUNCA ofereça desconto')
  })

  it('substitui múltiplas ocorrências da mesma var (replace_all via regex /g)', () => {
    const r = replaceVars('{agent_name} disse para {agent_name}', { name: 'Bot' })
    expect(r).toBe('Bot disse para Bot')
  })

  it('preserva texto sem variáveis', () => {
    const r = replaceVars('texto puro sem placeholders', { name: 'Bot' })
    expect(r).toBe('texto puro sem placeholders')
  })
})

// ── buildIdentitySection ─────────────────────────────────────────────

describe('buildIdentitySection', () => {
  it('usa prompt_sections.identity quando definido', () => {
    const r = buildIdentitySection({
      name: 'Bot',
      prompt_sections: { identity: 'Você é {agent_name}, especial.' },
    })
    expect(r).toBe('Você é Bot, especial.')
  })

  it('fallback default sem prompt_sections', () => {
    const r = buildIdentitySection({ name: 'Bot', personality: 'CARISMÁTICO' })
    expect(r).toContain('Você é Bot')
    expect(r).toContain('CARISMÁTICO')
  })

  it('default usa "Profissional..." quando personality vazio', () => {
    const r = buildIdentitySection({ name: 'X' })
    expect(r).toContain('Profissional, simpático e objetivo')
  })
})

// ── buildBusinessSection ─────────────────────────────────────────────

describe('buildBusinessSection', () => {
  it('retorna msg "nada cadastrado" quando business_info ausente', () => {
    const r = buildBusinessSection({})
    expect(r).toContain('Nenhuma informação da empresa cadastrada')
    expect(r).toContain('faça handoff_to_human')
  })

  it('lista campos preenchidos + lista campos faltantes', () => {
    const r = buildBusinessSection({
      business_info: { hours: '8h-18h', address: 'Rua A' },
    })
    expect(r).toContain('Horário de funcionamento: 8h-18h')
    expect(r).toContain('Endereço: Rua A')
    expect(r).toContain('INFORMAÇÕES NÃO CADASTRADAS')
    expect(r).toContain('formas de pagamento')
    expect(r).toContain('entrega/frete')
    expect(r).toContain('REGRA ABSOLUTA')
  })

  it('quando tudo preenchido, não inclui bloco "NÃO CADASTRADAS"', () => {
    const r = buildBusinessSection({
      business_info: {
        hours: 'h', address: 'a', payment_methods: 'p', delivery_info: 'd', phone: 'tel', extra: 'ex',
      },
    })
    expect(r).not.toContain('INFORMAÇÕES NÃO CADASTRADAS')
    expect(r).toContain('REGRA ABSOLUTA')
  })

  it('phone e extra são opcionais e não geram "faltante" quando ausentes', () => {
    const r = buildBusinessSection({
      business_info: { hours: 'h', address: 'a', payment_methods: 'p', delivery_info: 'd' },
    })
    expect(r).not.toContain('INFORMAÇÕES NÃO CADASTRADAS')
  })
})

// ── buildLeadContextBlock ────────────────────────────────────────────

describe('buildLeadContextBlock', () => {
  it('recorrente: usa nome completo exato', () => {
    const r = buildLeadContextBlock({ isReturningLead: true, leadName: 'José Silva', leadContext: '' })
    expect(r).toContain('Lead RECORRENTE')
    expect(r).toContain('"José Silva"')
    expect(r).toContain('nunca encurte')
  })

  it('novo com nome: instrui usar primeiro nome', () => {
    const r = buildLeadContextBlock({ isReturningLead: false, leadName: 'Maria', leadContext: '' })
    expect(r).toContain('Lead NOVO')
    expect(r).toContain('"Maria"')
    expect(r).toContain('NÃO cumprimente de novo')
  })

  it('novo sem nome: instrui aguardar lead informar', () => {
    const r = buildLeadContextBlock({ isReturningLead: false, leadName: null, leadContext: '' })
    expect(r).toContain('Quando o lead informar seu nome')
    expect(r).toContain('PRIMEIRO NOME')
  })
})

// ── buildFactsBlock ──────────────────────────────────────────────────

describe('buildFactsBlock', () => {
  it('vazio quando sem tags', () => {
    expect(buildFactsBlock(null)).toBe('')
    expect(buildFactsBlock(undefined)).toBe('')
    expect(buildFactsBlock([])).toBe('')
  })

  it('vazio quando só tem meta-keys (ia, ia_cleared, lead_score, etc)', () => {
    const r = buildFactsBlock(['ia:active', 'lead_score:10', 'enrich_count:2', 'search_fail:1', 'motivo:compra'])
    expect(r).toBe('')
  })

  it('formata facts humanizando keys (underscore → espaço, primeira maiúscula)', () => {
    const r = buildFactsBlock(['interesse:tintas', 'material_pia:granito', 'ambiente:cozinha'])
    expect(r).toContain('Interesse = tintas')
    expect(r).toContain('Material pia = granito')
    expect(r).toContain('Ambiente = cozinha')
    expect(r).toContain('FATOS JA ESTABELECIDOS')
    expect(r).toContain('NAO PERGUNTE NEM CONFIRME')
  })

  it('separa facts por " | "', () => {
    const r = buildFactsBlock(['interesse:tintas', 'ambiente:cozinha'])
    expect(r).toContain('Interesse = tintas | Ambiente = cozinha')
  })

  it('ignora tags sem ":"', () => {
    const r = buildFactsBlock(['saudacao', 'interesse:x'])
    expect(r).toContain('Interesse = x')
    expect(r).not.toContain('saudacao')
  })

  it('ignora valores vazios e tags malformadas', () => {
    const r = buildFactsBlock([':valorsemkey', 'interesse:', 'ambiente:x'])
    expect(r).toContain('Ambiente = x')
    expect(r).not.toContain(':valorsemkey')
  })

  it('valor com ":" interno é preservado (slice por primeiro ":")', () => {
    const r = buildFactsBlock(['interesse:tinta:branca'])
    expect(r).toContain('Interesse = tinta:branca')
  })
})

// ── buildDynamicContext ──────────────────────────────────────────────

describe('buildDynamicContext', () => {
  it('inclui leadContext, campaignContext, limite, labels', () => {
    const r = buildDynamicContext({
      leadContext: '\nHistórico aqui',
      campaignContext: '\n<campaign_context>X</campaign_context>',
      leadMsgCount: 3, maxLeadMessages: 8,
      availableLabelNames: ['Quente', 'Frio'],
      currentLabelNames: ['Quente'],
      conversationTags: ['interesse:tintas'],
      blockedTopics: ['política'],
      blockedPhrases: ['palavrão'],
    })
    expect(r).toContain('Histórico aqui')
    expect(r).toContain('<campaign_context>X</campaign_context>')
    expect(r).toContain('LIMITE DE MENSAGENS: Este lead já enviou 3/8')
    expect(r).toContain('Quente, Frio')
    expect(r).toContain('Labels atuais: Quente')
    expect(r).toContain('Interesse = tintas')
    expect(r).toContain('PROIBIDOS: política')
    expect(r).toContain('PROIBIDAS: palavrão')
  })

  it('inclui aviso de "acelerar handoff" quando msgCount >= max-2', () => {
    const r = buildDynamicContext({
      leadContext: '', campaignContext: '',
      leadMsgCount: 7, maxLeadMessages: 8,
      availableLabelNames: [], currentLabelNames: [],
      conversationTags: null, blockedTopics: null, blockedPhrases: null,
    })
    expect(r).toContain('Acelere a qualificação e faça handoff proativamente')
  })

  it('NÃO inclui aviso quando msgCount baixo', () => {
    const r = buildDynamicContext({
      leadContext: '', campaignContext: '',
      leadMsgCount: 2, maxLeadMessages: 8,
      availableLabelNames: [], currentLabelNames: [],
      conversationTags: null, blockedTopics: null, blockedPhrases: null,
    })
    expect(r).not.toContain('Acelere a qualificação')
  })

  it('fallback de leadContext vazio insere "Nenhum histórico anterior"', () => {
    const r = buildDynamicContext({
      leadContext: '', campaignContext: '',
      leadMsgCount: 0, maxLeadMessages: 8,
      availableLabelNames: [], currentLabelNames: [],
      conversationTags: null, blockedTopics: null, blockedPhrases: null,
    })
    expect(r).toContain('Nenhum histórico anterior deste lead')
  })

  it('labels disponíveis vazias mostra "(nenhuma)"', () => {
    const r = buildDynamicContext({
      leadContext: '', campaignContext: '',
      leadMsgCount: 0, maxLeadMessages: 8,
      availableLabelNames: [], currentLabelNames: [],
      conversationTags: null, blockedTopics: null, blockedPhrases: null,
    })
    expect(r).toContain('Labels disponíveis: (nenhuma)')
  })
})

// ── buildAgentPromptSections (bundle) ────────────────────────────────

describe('buildAgentPromptSections', () => {
  it('retorna todas as 9 seções', () => {
    const r = buildAgentPromptSections({
      name: 'Bot',
      prompt_sections: {
        sdr_flow: '{agent_name}-SDR',
        product_rules: 'PROD',
        handoff_rules: 'HAND',
        tags_labels: 'TAGS',
        absolute_rules: 'ABS',
        objections: 'OBJ',
        additional: 'ADD',
      },
    })
    expect(r.identitySection).toContain('Você é Bot')
    expect(r.businessSection).toContain('Nenhuma informação')
    expect(r.sdrSection).toBe('Bot-SDR')
    expect(r.productSection).toBe('PROD')
    expect(r.handoffSection).toBe('HAND')
    expect(r.tagsSection).toBe('TAGS')
    expect(r.absoluteSection).toBe('ABS')
    expect(r.objectionsSection).toBe('OBJ')
    expect(r.additionalSection).toBe('ADD')
  })

  it('sections vazias quando prompt_sections ausente', () => {
    const r = buildAgentPromptSections({ name: 'X' })
    expect(r.sdrSection).toBe('')
    expect(r.productSection).toBe('')
    expect(r.additionalSection).toBe('')
  })
})
