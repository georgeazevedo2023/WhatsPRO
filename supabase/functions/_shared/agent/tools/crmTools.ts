/**
 * Sprint B5 Onda 3b — Tools de CRM.
 *
 * Extrai os 3 handlers do switch `executeTool` do ai-agent:
 *   - assignLabel: REPLACE etiqueta da conversa (ilike case-insensitive, 1 ativa)
 *   - moveKanban: move/cria card no quadro Kanban da instância
 *   - updateLeadProfile: upsert lead_profiles com merge de objections + dedup nome
 *
 * Cada handler retorna `string` com mensagem pra LLM (mesmo contrato do switch
 * original). Sem mudança de comportamento — equivalência semântica.
 */

import type { Logger } from '../context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface CrmToolsCtx {
  supabase: any
  agent_id: string
  conversation: { inbox_id?: string | null } & Record<string, any>
  conversation_id: string
  contact: { id: string; name?: string | null; phone?: string | null } & Record<string, any>
  instance_id: string
  leadProfile: { objections?: string[] | null } & Record<string, any> | null
  availableLabelNames: string[]
}

// =============================================================================
// assign_label
// =============================================================================

export async function assignLabel(
  args: Record<string, any>,
  ctx: CrmToolsCtx,
  _log: Logger,
): Promise<string> {
  const { label_name } = args
  if (!label_name) return 'Nome da etiqueta não informado.'

  // Use exact case-insensitive match to prevent partial matches
  // (e.g., "sale" matching "sales" or "wholesale")
  const { data: label } = await ctx.supabase
    .from('labels')
    .select('id, name')
    .eq('inbox_id', ctx.conversation.inbox_id)
    .ilike('name', label_name.replace(/%/g, '\\%').replace(/_/g, '\\_'))
    .maybeSingle()

  if (!label) {
    return `Etiqueta "${label_name}" não encontrada. Disponíveis: ${ctx.availableLabelNames.join(', ')}`
  }

  // Pipeline: replace existing labels (one stage at a time)
  await ctx.supabase.from('conversation_labels').delete().eq('conversation_id', ctx.conversation_id)
  const { error } = await ctx.supabase
    .from('conversation_labels')
    .insert({ conversation_id: ctx.conversation_id, label_id: label.id })

  if (error) return `Erro ao atribuir etiqueta: ${error.message}`

  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'label_assigned',
    metadata: { label_name: label.name, label_id: label.id },
  })

  return `Etiqueta "${label.name}" atribuída.`
}

// =============================================================================
// move_kanban
// =============================================================================

export async function moveKanban(
  args: Record<string, any>,
  ctx: CrmToolsCtx,
  _log: Logger,
): Promise<string> {
  const { column_name } = args
  if (!column_name) return 'Nome da coluna não informado.'

  const { data: board } = await ctx.supabase
    .from('kanban_boards')
    .select('id')
    .eq('instance_id', ctx.instance_id)
    .maybeSingle()

  if (!board) return 'Nenhum quadro Kanban vinculado a esta instância.'

  const { data: targetCol } = await ctx.supabase
    .from('kanban_columns')
    .select('id, name')
    .eq('board_id', board.id)
    .ilike('name', column_name)
    .maybeSingle()

  if (!targetCol) return `Coluna "${column_name}" não encontrada no Kanban.`

  // Find card by contact_id (direct FK, reliable)
  const { data: card } = await ctx.supabase
    .from('kanban_cards')
    .select('id, title, column_id')
    .eq('board_id', board.id)
    .eq('contact_id', ctx.contact.id)
    .maybeSingle()

  // Auto-create card if not found
  if (!card) {
    const { data: newCard } = await ctx.supabase
      .from('kanban_cards')
      .insert({
        board_id: board.id,
        column_id: targetCol.id,
        contact_id: ctx.contact.id,
        title: ctx.contact.name || ctx.contact.phone,
        created_by: ctx.agent_id,
        tags: ['lead', 'auto-criado'],
      })
      .select('id, title, column_id')
      .single()

    if (!newCard) return 'Erro ao criar card no Kanban.'

    await ctx.supabase.from('ai_agent_logs').insert({
      agent_id: ctx.agent_id,
      conversation_id: ctx.conversation_id,
      event: 'kanban_created',
      metadata: { card_id: newCard.id, column_name: targetCol.name, contact_id: ctx.contact.id },
    })

    return `Card "${newCard.title}" criado na coluna "${targetCol.name}".`
  }

  if (card.column_id === targetCol.id) return `Card já está na coluna "${targetCol.name}".`

  await ctx.supabase.from('kanban_cards').update({ column_id: targetCol.id }).eq('id', card.id)

  await ctx.supabase.from('ai_agent_logs').insert({
    agent_id: ctx.agent_id,
    conversation_id: ctx.conversation_id,
    event: 'kanban_moved',
    metadata: { card_id: card.id, column_name: targetCol.name, contact_id: ctx.contact.id },
  })

  return `Card "${card.title}" movido para "${targetCol.name}".`
}

// =============================================================================
// update_lead_profile
// =============================================================================

export async function updateLeadProfile(
  args: Record<string, any>,
  ctx: CrmToolsCtx,
  _log: Logger,
): Promise<string> {
  const updates: Record<string, any> = { last_contact_at: new Date().toISOString() }

  if (args.full_name) {
    // Colapsa nome dobrado pelo LLM ("PedroPedro" → "Pedro", "GeorgeGeorge" → "George").
    // Exige cada metade com >= 3 chars (length >= 6): o doubling do LLM repete o nome
    // INTEIRO, gerando string longa; nomes curtos e apelidos reduplicados ("João",
    // "Ana", "lulu", "bibi", "dudu") têm metades de 2 chars e eram comidos pela metade
    // ("dudu"→"du"). Comparação case-insensitive cobre "joãoJoão" sem novo falso-positivo
    // (um nome real que seja 2x um string de 3+ chars não existe na prática).
    let cleanName = args.full_name.trim()
    if (cleanName.length >= 6 && cleanName.length % 2 === 0) {
      const half = cleanName.length / 2
      if (cleanName.slice(0, half).toLowerCase() === cleanName.slice(half).toLowerCase()) {
        cleanName = cleanName.slice(0, half)
      }
    }
    updates.full_name = cleanName
  }
  if (args.city) updates.city = args.city
  if (args.interests?.length) updates.interests = args.interests
  if (args.notes) updates.notes = args.notes
  if (args.reason) updates.reason = args.reason
  if (args.average_ticket) updates.average_ticket = args.average_ticket
  if (args.objections?.length) {
    // Merge with existing objections (no duplicates)
    const existing: string[] = ctx.leadProfile?.objections || []
    const merged = [...new Set([...existing, ...args.objections])]
    updates.objections = merged
  }

  const { error } = await ctx.supabase
    .from('lead_profiles')
    .upsert({ contact_id: ctx.contact.id, ...updates }, { onConflict: 'contact_id' })

  // Note: contacts.name preserves WhatsApp pushname, full_name goes only in lead_profiles

  if (error) return `Erro ao atualizar perfil: ${error.message}`

  const saved = Object.entries(updates)
    .filter(([k]) => k !== 'last_contact_at')
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
    .join(', ')

  // If name was just saved, instruct LLM to use it in this response
  if (args.full_name && updates.full_name) {
    const firstName = updates.full_name.split(' ')[0]
    return `Perfil atualizado: ${saved}. IMPORTANTE: o lead acaba de informar o nome "${firstName}". Use "${firstName}" para se dirigir a ele nesta resposta.`
  }
  return `Perfil atualizado: ${saved}`
}

// =============================================================================
// API pública — dispatcher
// =============================================================================

/**
 * Despacha `name` ('assign_label' | 'move_kanban' | 'update_lead_profile') pro
 * handler apropriado. Retorna null se name não é tool de CRM (caller continua
 * com o próximo handler no switch original).
 */
export async function dispatchCrmTool(
  name: string,
  args: Record<string, any>,
  ctx: CrmToolsCtx,
  log: Logger,
): Promise<string | null> {
  switch (name) {
    case 'assign_label':
      return assignLabel(args, ctx, log)
    case 'move_kanban':
      return moveKanban(args, ctx, log)
    case 'update_lead_profile':
      return updateLeadProfile(args, ctx, log)
    default:
      return null
  }
}
