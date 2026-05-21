/**
 * Sprint B5 Onda 1 — extração das 4 fontes de context text que injetam
 * <campaign_context>, <form_data>, <bio_context>, <funnel_context> no system
 * prompt, mais o bloco prioritário <profile_instructions> / <funnel_instructions>.
 *
 * Antes: linhas 1066-1170 do ai-agent/index.ts (105 lin in-line).
 * Depois: 1 chamada `buildContextDocuments()` retornando 2 strings.
 *
 * Sem mudança comportamental — strings são identicas char-a-char ao código
 * original. Testes garantem que cada caminho condicional bate.
 */

import type { ConversationTagsCarrier, FunnelData, Logger, ProfileData } from './context.ts'

type SupabaseLike = {
  from: (table: string) => any
}

export type BuildContextDocsInput = {
  conversation: ConversationTagsCarrier & Record<string, unknown>
  instanceId: string
  contactId: string | null | undefined
  funnelData: FunnelData | null
  profileData: ProfileData | null
}

export type BuildContextDocsOutput = {
  campaignContext: string
  funnelInstructionsSection: string
}

export async function buildContextDocuments(
  supabase: SupabaseLike,
  input: BuildContextDocsInput,
  log: Logger,
): Promise<BuildContextDocsOutput> {
  const tags: string[] = input.conversation.tags || []

  let campaignContext = ''
  campaignContext += await loadCampaignContext(supabase, tags, input.instanceId)
  campaignContext += await loadFormContext(supabase, tags, input.contactId, log)
  campaignContext += await loadBioContext(supabase, tags, log)

  const { campaignAppend, funnelInstructionsSection } = buildFunnelSections(
    input.funnelData,
    input.profileData,
    log,
  )
  campaignContext += campaignAppend

  return { campaignContext, funnelInstructionsSection }
}

// ── Campaign ─────────────────────────────────────────────────────────────

export async function loadCampaignContext(
  supabase: SupabaseLike,
  tags: string[],
  instanceId: string,
): Promise<string> {
  const campaignTag = tags.find((t) => t.startsWith('campanha:'))
  if (!campaignTag) return ''

  const campaignName = campaignTag.split(':').slice(1).join(':')
  const { data: campaignData } = await supabase
    .from('utm_campaigns')
    .select('name, campaign_type, ai_template, ai_custom_text, utm_source, utm_medium')
    .eq('instance_id', instanceId)
    .eq('name', campaignName)
    .maybeSingle()

  if (!campaignData) return ''

  const parts: string[] = [
    `\n\n<campaign_context>`,
    `Este lead chegou pela campanha "${campaignData.name}" (tipo: ${campaignData.campaign_type}).`,
    `Origem: ${campaignData.utm_source || 'direto'}${campaignData.utm_medium ? ` / ${campaignData.utm_medium}` : ''}`,
  ]
  if (campaignData.ai_template) parts.push(`Instrução da campanha: ${campaignData.ai_template}`)
  if (campaignData.ai_custom_text) parts.push(`Detalhes: ${campaignData.ai_custom_text}`)
  parts.push('Adapte seu atendimento ao contexto desta campanha.')
  parts.push('</campaign_context>')
  return parts.join('\n')
}

// ── Form data ────────────────────────────────────────────────────────────

export async function loadFormContext(
  supabase: SupabaseLike,
  tags: string[],
  contactId: string | null | undefined,
  log: Logger,
): Promise<string> {
  const formTag = tags.find((t) => t.startsWith('formulario:'))
  if (!formTag) return ''
  const formSlug = formTag.split(':').slice(1).join(':')

  try {
    const { data: submissions } = await supabase
      .from('form_submissions')
      .select('data, submitted_at, whatsapp_forms(name)')
      .eq('whatsapp_forms.slug', formSlug)
      .eq('contact_id', contactId)
      .order('submitted_at', { ascending: false })
      .limit(1)
    const sub = submissions?.[0]
    if (!sub?.data) return ''

    const formName = (sub as any).whatsapp_forms?.name || formSlug
    const entries = Object.entries(sub.data as Record<string, unknown>)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n')
    return `\n\n<form_data>\nEste lead preencheu o formulário "${formName}":\n${entries}\nNÃO pergunte novamente informações que já foram coletadas acima.\n</form_data>`
  } catch (err) {
    log.warn('Form data load error (non-critical)', { error: (err as Error).message })
    return ''
  }
}

// ── Bio link ─────────────────────────────────────────────────────────────

export async function loadBioContext(
  supabase: SupabaseLike,
  tags: string[],
  log: Logger,
): Promise<string> {
  const bioPageTag = tags.find((t) => t.startsWith('bio_page:'))
  if (!bioPageTag) return ''
  const bioSlug = bioPageTag.split(':').slice(1).join(':')

  try {
    const { data: bioPage } = await supabase
      .from('bio_pages')
      .select('title, slug, description')
      .eq('slug', bioSlug)
      .maybeSingle()
    if (!bioPage) return ''

    const bioParts: string[] = [
      `\n\n<bio_context>`,
      `Este lead chegou pela página Bio Link "${bioPage.title}".`,
    ]
    if (bioPage.description) bioParts.push(`Descrição da página: ${bioPage.description}`)
    bioParts.push('Adapte a conversa ao contexto da página bio.')
    bioParts.push('</bio_context>')
    return bioParts.join('\n')
  } catch (err) {
    log.warn('Bio context load error (non-critical)', { error: (err as Error).message })
    return ''
  }
}

// ── Funnel + Profile ─────────────────────────────────────────────────────

export function buildFunnelSections(
  funnelData: FunnelData | null,
  profileData: ProfileData | null,
  log: Logger,
): { campaignAppend: string; funnelInstructionsSection: string } {
  let campaignAppend = ''
  let funnelInstructionsSection = ''

  if (funnelData) {
    const fParts: string[] = [
      `\n\n<funnel_context>`,
      `Este lead está no funil "${funnelData.name}" (tipo: ${funnelData.type}).`,
    ]
    if (funnelData.ai_template) fParts.push(funnelData.ai_template)
    if (funnelData.ai_custom_text) fParts.push(funnelData.ai_custom_text)
    fParts.push('Adapte suas respostas ao objetivo do funil.')
    fParts.push('</funnel_context>')
    campaignAppend = fParts.join('\n')

    if (profileData?.prompt?.trim()) {
      funnelInstructionsSection = `\n\n<profile_instructions>\nROTEIRO OBRIGATÓRIO DO PERFIL — PRIORIDADE MÁXIMA:\nVocê DEVE seguir este roteiro à risca. Ele tem prioridade sobre qualquer instrução geral.\n\n${profileData.prompt}\n</profile_instructions>`
      log.info('Profile instructions injected', { profileId: profileData.id, funnelName: funnelData.name, promptLength: profileData.prompt.length })
    } else if (funnelData.funnel_prompt?.trim()) {
      funnelInstructionsSection = `\n\n<funnel_instructions>\nROTEIRO OBRIGATÓRIO DESTE FUNIL — PRIORIDADE MÁXIMA:\nVocê DEVE seguir este roteiro à risca. Ele tem prioridade sobre qualquer instrução geral.\n\n${funnelData.funnel_prompt}\n</funnel_instructions>`
      log.info('Funnel instructions injected (legacy)', { funnelName: funnelData.name, promptLength: funnelData.funnel_prompt.length })
    }
  } else if (profileData?.prompt?.trim()) {
    funnelInstructionsSection = `\n\n<profile_instructions>\nROTEIRO OBRIGATÓRIO DO PERFIL — PRIORIDADE MÁXIMA:\nVocê DEVE seguir este roteiro à risca. Ele tem prioridade sobre qualquer instrução geral.\n\n${profileData.prompt}\n</profile_instructions>`
    log.info('Default profile instructions injected (no funnel)', { profileId: profileData.id, promptLength: profileData.prompt.length })
  }

  return { campaignAppend, funnelInstructionsSection }
}
