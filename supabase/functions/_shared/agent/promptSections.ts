/**
 * Sprint B5 Onda 2a — extrai prompt sections puras (sem side effect).
 *
 * Antes: ai-agent/index.ts:1431-1515 (~85 lin in-line).
 * Depois: 5 funções puras testáveis. Zero IO, zero DB, zero broadcast.
 *
 * Inclui o "FATOS JÁ ESTABELECIDOS" block (R121 2026-05-19) que humaniza
 * a listagem de tags do lead — esconde meta-keys, formata chave→label
 * legível, evita reperguntar o que já foi dito.
 */

const META_KEYS_FACTS = new Set([
  'ia',
  'ia_cleared',
  'lead_score',
  'enrich_count',
  'search_fail',
  'aguardando_upsell',
  'produto',
  'motivo',
])

// ── Tipos ────────────────────────────────────────────────────────────────

export type AgentForPrompt = {
  name?: string | null
  personality?: string | null
  max_pre_search_questions?: number | null
  max_qualification_retries?: number | null
  max_enrichment_questions?: number | null
  max_discount_percent?: number | null
  business_info?: BusinessInfo | null
  prompt_sections?: Record<string, string> | null
  blocked_topics?: string[] | null
  blocked_phrases?: string[] | null
}

export type BusinessInfo = {
  hours?: string | null
  address?: string | null
  phone?: string | null
  payment_methods?: string | null
  delivery_info?: string | null
  extra?: string | null
}

export type LeadContextInput = {
  isReturningLead: boolean
  leadName: string | null
  leadContext: string  // texto já formatado vindo do loader
}

export type DynamicContextInput = {
  leadContext: string
  campaignContext: string
  leadMsgCount: number
  maxLeadMessages: number
  availableLabelNames: string[]
  currentLabelNames: string[]
  conversationTags: string[] | null | undefined
  blockedTopics: string[] | null | undefined
  blockedPhrases: string[] | null | undefined
}

// ── 1. replaceVars (template substitution) ───────────────────────────────

export function replaceVars(text: string, agent: AgentForPrompt): string {
  return text
    .replace(/\{agent_name\}/g, agent.name || 'Assistente')
    .replace(/\{personality\}/g, agent.personality || 'Profissional, simpático e objetivo')
    .replace(/\{max_pre_search_questions\}/g, String(agent.max_pre_search_questions || 3))
    .replace(/\{max_qualification_retries\}/g, String(agent.max_qualification_retries || 2))
    .replace(/\{max_enrichment_questions\}/g, String(agent.max_enrichment_questions || 2))
    .replace(
      /\{max_discount_percent\}/g,
      agent.max_discount_percent ? `${agent.max_discount_percent}%` : 'NUNCA ofereça desconto',
    )
}

// ── 2. Identity section ──────────────────────────────────────────────────

export function buildIdentitySection(agent: AgentForPrompt): string {
  const ps = agent.prompt_sections || {}
  const template = ps.identity
    || `Você é ${agent.name}, um assistente virtual de WhatsApp.\nPersonalidade: ${agent.personality || 'Profissional, simpático e objetivo'}`
  return replaceVars(template, agent)
}

// ── 3. Business section (auto-generated) ─────────────────────────────────

export function buildBusinessSection(agent: AgentForPrompt): string {
  const bi = agent.business_info
  if (!bi) {
    return 'Nenhuma informação da empresa cadastrada. Se o lead perguntar horário, endereço, formas de pagamento ou entrega: faça handoff_to_human.'
  }
  const parts: string[] = ['Informações da Empresa (SOMENTE estas informações foram cadastradas pelo admin):']
  if (bi.hours) parts.push(`- Horário de funcionamento: ${bi.hours}`)
  if (bi.address) parts.push(`- Endereço: ${bi.address}`)
  if (bi.phone) parts.push(`- Telefone: ${bi.phone}`)
  if (bi.payment_methods) parts.push(`- Formas de pagamento: ${bi.payment_methods}`)
  if (bi.delivery_info) parts.push(`- Entrega: ${bi.delivery_info}`)
  if (bi.extra) parts.push(`- Outras informações: ${bi.extra}`)

  const missing: string[] = []
  if (!bi.hours) missing.push('horário')
  if (!bi.address) missing.push('endereço')
  if (!bi.payment_methods) missing.push('formas de pagamento')
  if (!bi.delivery_info) missing.push('entrega/frete')
  if (missing.length > 0) {
    parts.push(`\nINFORMAÇÕES NÃO CADASTRADAS: ${missing.join(', ')}. Se o lead perguntar sobre esses temas, diga "Vou verificar com nosso consultor" e faça handoff_to_human. NUNCA invente informações sobre ${missing.join('/')}.`)
  }
  parts.push('\nREGRA ABSOLUTA: responda SOMENTE com as informações listadas acima. Se a informação NÃO está aqui, NÃO invente. Transfira para consultor.')
  return parts.join('\n')
}

// ── 4. Lead context block (returning vs new) ─────────────────────────────

export function buildLeadContextBlock(input: LeadContextInput): string {
  if (input.isReturningLead) {
    return `CONTEXTO: Lead RECORRENTE. Nome COMPLETO do lead: "${input.leadName}" — use EXATAMENTE assim, nunca encurte. Cumprimente pelo nome e vá direto ao ponto.`
  }
  const nameClause = input.leadName
    ? ` Chame o lead de "${input.leadName}".`
    : ' Quando o lead informar seu nome, use o PRIMEIRO NOME para se dirigir a ele.'
  return `CONTEXTO: Lead NOVO. A saudação já foi enviada separadamente. NÃO cumprimente de novo.${nameClause} Se informar nome, salve com update_lead_profile e vá DIRETO ao assunto.`
}

// ── 5. Dynamic context (lead history + labels + tags facts) ──────────────

export function buildDynamicContext(input: DynamicContextInput): string {
  const parts: Array<string | false | null | undefined> = [
    input.leadContext || '\nNenhum histórico anterior deste lead. Trate como NOVO cliente.',
    input.campaignContext,
    `\nLIMITE DE MENSAGENS: Este lead já enviou ${input.leadMsgCount || 0}/${input.maxLeadMessages} mensagens.`,
    input.leadMsgCount >= input.maxLeadMessages - 2 ? 'Acelere a qualificação e faça handoff proativamente.' : '',
    `\nLabels disponíveis: ${input.availableLabelNames.length > 0 ? input.availableLabelNames.join(', ') : '(nenhuma)'}`,
    input.currentLabelNames.length > 0 ? `Labels atuais: ${input.currentLabelNames.join(', ')}` : '',
    buildFactsBlock(input.conversationTags),
    input.blockedTopics?.length ? `\nTópicos PROIBIDOS: ${input.blockedTopics.join(', ')}` : '',
    input.blockedPhrases?.length ? `Frases PROIBIDAS: ${input.blockedPhrases.join(', ')}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

// ── 5.1 Facts block (R121 humanizado) ────────────────────────────────────

export function buildFactsBlock(tags: string[] | null | undefined): string {
  if (!tags?.length) return ''
  const facts: string[] = []
  for (const t of tags) {
    if (typeof t !== 'string') continue
    const idx = t.indexOf(':')
    if (idx <= 0) continue
    const k = t.slice(0, idx)
    const v = t.slice(idx + 1)
    if (META_KEYS_FACTS.has(k)) continue
    // Humanizar key: material_mesa -> Material mesa; interesse -> Interesse
    const labelKey = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')
    facts.push(`${labelKey} = ${v}`)
  }
  if (facts.length === 0) return ''
  return `\n[FATOS JA ESTABELECIDOS pelo lead nesta sessao — NAO PERGUNTE NEM CONFIRME O QUE ESTA AQUI]\n${facts.join(' | ')}\n(Use estes fatos diretamente. Se algum campo de qualificacao esta faltando, pergunte SO o que falta — sem reperguntar/confirmar o que ja foi dito acima.)`
}

// ── 6. Bundle: 6 prompt-section strings (do prompt_sections do agente) ───

export type AgentPromptSectionStrings = {
  identitySection: string
  businessSection: string
  sdrSection: string
  productSection: string
  handoffSection: string
  tagsSection: string
  absoluteSection: string
  objectionsSection: string
  additionalSection: string
}

export function buildAgentPromptSections(agent: AgentForPrompt): AgentPromptSectionStrings {
  const ps = agent.prompt_sections || {}
  return {
    identitySection: buildIdentitySection(agent),
    businessSection: buildBusinessSection(agent),
    sdrSection: replaceVars(ps.sdr_flow || '', agent),
    productSection: replaceVars(ps.product_rules || '', agent),
    handoffSection: replaceVars(ps.handoff_rules || '', agent),
    tagsSection: replaceVars(ps.tags_labels || '', agent),
    absoluteSection: replaceVars(ps.absolute_rules || '', agent),
    objectionsSection: replaceVars(ps.objections || '', agent),
    additionalSection: ps.additional || '',
  }
}
