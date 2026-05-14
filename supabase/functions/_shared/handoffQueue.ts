/**
 * D30 — Atribuição automática de handoff via fila inteligente.
 *
 * Caller padrão: `ai-agent` (6 paths) e `assign-handoff` edge function (cron + helpdesk manual).
 *
 * Comportamento por modo do departamento (`departments.queue_mode_enabled`):
 *
 * | Modo | Quem é escolhido |
 * |---|---|
 * | OFF (default) | `default_assignee_id` do departamento (gestor-de-chão) |
 * | ON            | RPC atômico `pick_next_assignee` (round-robin com cursor) |
 *
 * D-β: se `previous_assignee_id` foi passado e está disponível
 * (membro do dept, `queue_paused=false`), reutiliza o mesmo atendente
 * antes de rodar a fila — preserva continuidade do atendimento.
 *
 * Side-effects (em ordem):
 *   1. INSERT em `handoff_queue_events` com `expires_at = now() + timeout`
 *   2. UPDATE `conversations.assigned_to` + `department_id` (se atendente foi escolhido)
 *
 * NÃO mexe em `status_ia`, `tags`, `lead_msg_count` — caller cuida disso
 * dentro do mesmo UPDATE (evita 2 UPDATEs sequenciais).
 *
 * NUNCA throw — em qualquer falha retorna `{ assigned_user_id: null, reason: '...' }`
 * para que o caller no ai-agent possa cair no fallback (comportamento atual).
 */

// deno-lint-ignore no-explicit-any
type SupabaseLike = any
type LoggerCtx = Record<string, unknown> | undefined
type Logger = { info: (msg: string, ctx?: LoggerCtx) => void; warn: (msg: string, ctx?: LoggerCtx) => void }

export type AssignHandoffOptions = {
  supabase: SupabaseLike
  conversation_id: string
  department_id: string | null
  previous_assignee_id?: string | null
  /** Atendentes a pular (ex.: que já recusaram timeout antes nessa conversa) */
  skip_user_ids?: string[]
  logger?: Logger
}

export type AssignHandoffResult = {
  assigned_user_id: string | null
  assignee_name: string | null
  queue_event_id: string | null
  timeout_minutes: number
  reason:
    | 'no_dept'              // D-α falhou — sem dept para resolver
    | 'no_eligible'          // dept existe mas RPC retornou NULL (todos pausados etc.)
    | 'reused_previous'      // D-β: mesmo atendente do handoff anterior
    | 'queue_off_default'    // Modo OFF → default_assignee_id
    | 'queue_off_no_default' // Modo OFF mas sem default_assignee_id (fallback no_eligible)
    | 'queue_on_picked'      // Modo ON → RPC escolheu próximo
    | 'error'                // exceção interna — caller faz fallback
}

const DEFAULT_TIMEOUT = 5

/**
 * Best-effort: nome de exibição do atendente.
 * `auth.users.raw_user_meta_data->>full_name` quando existe; senão `email`.
 * Retorna null em qualquer erro — caller usa "consultor" no template.
 */
async function lookupAssigneeName(
  supabase: SupabaseLike,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user) return null
    const meta = (data.user.user_metadata || {}) as Record<string, unknown>
    const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
    if (fullName) return fullName.split(/\s+/)[0] // primeiro nome só (UX)
    if (data.user.email) return data.user.email.split('@')[0]
    return null
  } catch {
    return null
  }
}

/** Verifica se o atendente do handoff anterior ainda é elegível (D-β). */
async function isPreviousAssigneeEligible(
  supabase: SupabaseLike,
  departmentId: string,
  userId: string,
  skipUserIds: string[],
): Promise<boolean> {
  if (skipUserIds.includes(userId)) return false
  try {
    const { data } = await supabase
      .from('department_members')
      .select('queue_paused, gestor_in_queue, user_id')
      .eq('department_id', departmentId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return false
    if (data.queue_paused) return false
    return true
  } catch {
    return false
  }
}

export async function assignHandoff(
  opts: AssignHandoffOptions,
): Promise<AssignHandoffResult> {
  const { supabase, conversation_id, department_id, logger } = opts
  const previousAssigneeId = opts.previous_assignee_id ?? null
  const skipUserIds = opts.skip_user_ids ?? []
  const log = logger || { info: () => {}, warn: () => {} }

  const baseResult: Pick<AssignHandoffResult, 'queue_event_id' | 'assignee_name' | 'timeout_minutes'> = {
    queue_event_id: null,
    assignee_name: null,
    timeout_minutes: DEFAULT_TIMEOUT,
  }

  if (!department_id) {
    return { ...baseResult, assigned_user_id: null, reason: 'no_dept' }
  }

  try {
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .select('id, queue_mode_enabled, queue_mode_timeout_minutes, default_assignee_id')
      .eq('id', department_id)
      .maybeSingle()

    if (deptErr || !dept) {
      log.warn('handoffQueue: dept not found', { department_id, error: deptErr?.message })
      return { ...baseResult, assigned_user_id: null, reason: 'no_dept' }
    }

    const timeoutMinutes = Number(dept.queue_mode_timeout_minutes) || DEFAULT_TIMEOUT

    let pickedUserId: string | null = null
    let reason: AssignHandoffResult['reason'] = 'no_eligible'

    // D-β: tentar reutilizar o último assignee se ainda elegível
    if (previousAssigneeId) {
      const eligible = await isPreviousAssigneeEligible(
        supabase, department_id, previousAssigneeId, skipUserIds,
      )
      if (eligible) {
        pickedUserId = previousAssigneeId
        reason = 'reused_previous'
        log.info('handoffQueue: reusing previous assignee (D-β)', { user_id: pickedUserId })
      }
    }

    // Se D-β não rolou: escolher pelo modo do departamento
    if (!pickedUserId) {
      if (dept.queue_mode_enabled) {
        // Modo ON: round-robin atômico
        const { data: rpcData, error: rpcErr } = await supabase.rpc('pick_next_assignee', {
          _department_id: department_id,
          _skip_user_ids: skipUserIds,
        })
        if (rpcErr) {
          log.warn('handoffQueue: pick_next_assignee RPC failed', { error: rpcErr.message })
          return { ...baseResult, timeout_minutes: timeoutMinutes, assigned_user_id: null, reason: 'error' }
        }
        pickedUserId = (rpcData as string | null) ?? null
        reason = pickedUserId ? 'queue_on_picked' : 'no_eligible'
      } else {
        // Modo OFF: tudo vai pro default_assignee
        if (dept.default_assignee_id && !skipUserIds.includes(dept.default_assignee_id)) {
          pickedUserId = dept.default_assignee_id
          reason = 'queue_off_default'
        } else {
          reason = 'queue_off_no_default'
        }
      }
    }

    if (!pickedUserId) {
      log.info('handoffQueue: no assignee picked', { department_id, reason })
      return { ...baseResult, timeout_minutes: timeoutMinutes, assigned_user_id: null, reason }
    }

    // Cria evento da fila + atualiza conversation.assigned_to
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString()

    // 2026-05-14 — Defesa contra loop: se já existe event active na conversa
    // (constraint EXCLUDE handoff_queue_events_one_active_per_conv), reusa em
    // vez de tentar inserir e ficar em erro. Caller que chama em sequência
    // (ex: ai-agent após reset de status_ia) não duplica fila.
    let event: { id: string } | null = null
    {
      const { data: existingActive } = await supabase
        .from('handoff_queue_events')
        .select('id, assigned_user_id, expires_at')
        .eq('conversation_id', conversation_id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingActive) {
        // Atualiza o existente: novo atendente + reset do expires_at
        const { data: updated, error: updErr } = await supabase
          .from('handoff_queue_events')
          .update({
            assigned_user_id: pickedUserId,
            previous_assignee_id: previousAssigneeId,
            expires_at: expiresAt,
            paused_at: null,
            out_of_hours_msg_sent: false,
          })
          .eq('id', existingActive.id)
          .select('id')
          .single()
        if (updErr) {
          log.warn('handoffQueue: failed to update existing active event', { error: updErr.message, event_id: existingActive.id })
        } else {
          event = updated
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('handoff_queue_events')
          .insert({
            conversation_id,
            department_id,
            previous_assignee_id: previousAssigneeId,
            assigned_user_id: pickedUserId,
            expires_at: expiresAt,
            status: 'active',
            rotation_number: 0,
          })
          .select('id')
          .single()
        if (insertErr) {
          log.warn('handoffQueue: failed to insert queue event', { error: insertErr.message })
        } else {
          event = inserted
        }
      }
    }

    // R95: setar department_id junto pra que o painel direito do helpdesk
    // mostre o departamento correto (sem isso, fica "Departamento: Nenhum"
    // mesmo com membros do dept atribuídos via fila).
    // F1.2: registra assigned_at pra que notify-vendor saiba quando o handoff aconteceu.
    const assignedAtIso = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('conversations')
      .update({ assigned_to: pickedUserId, department_id, assigned_at: assignedAtIso })
      .eq('id', conversation_id)

    if (updateErr) {
      log.warn('handoffQueue: failed to set assigned_to', { error: updateErr.message })
      // Mantém o evento inserido para auditoria; retorna error pra caller fazer fallback
      return {
        ...baseResult,
        timeout_minutes: timeoutMinutes,
        queue_event_id: event?.id ?? null,
        assigned_user_id: null,
        reason: 'error',
      }
    }

    // F2.2: dispara notify-vendor-assignment fire-and-forget. Falha não propaga.
    // Gap B: passa previous_assigned_to_id quando há reatribuição real (vendor diferente).
    try {
      // @ts-ignore -- Deno
      const baseUrl = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : null) || ''
      // @ts-ignore -- Deno
      const serviceKey = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : null) || ''
      if (baseUrl && serviceKey) {
        const previousIdForNotif = previousAssigneeId && previousAssigneeId !== pickedUserId
          ? previousAssigneeId
          : null
        // Não usa await — fire-and-forget
        fetch(`${baseUrl}/functions/v1/notify-vendor-assignment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            conversation_id,
            assigned_to_id: pickedUserId,
            previous_assigned_to_id: previousIdForNotif,
          }),
        }).catch((e) => {
          log.warn('handoffQueue: notify-vendor fetch failed', { error: (e as Error).message })
        })
      }
    } catch (e) {
      log.warn('handoffQueue: notify-vendor dispatch error', { error: (e as Error).message })
    }

    const assigneeName = await lookupAssigneeName(supabase, pickedUserId)

    log.info('handoffQueue: assigned', {
      conversation_id, department_id, user_id: pickedUserId, reason, queue_event_id: event?.id,
    })

    return {
      assigned_user_id: pickedUserId,
      assignee_name: assigneeName,
      queue_event_id: event?.id ?? null,
      timeout_minutes: timeoutMinutes,
      reason,
    }
  } catch (e) {
    log.warn('handoffQueue: unexpected error', { error: (e as Error).message })
    return { ...baseResult, assigned_user_id: null, reason: 'error' }
  }
}

/**
 * D-γ: substitui `{handoff_assignee_name}` no template do handoff.
 * Quando não há nome (no_dept, no_eligible, fallback), troca por "consultor"
 * para preservar a frase natural ("Vou te conectar com nosso consultor").
 */
export function applyAssigneeNameTemplate(
  template: string,
  assigneeName: string | null,
): string {
  if (!template) return template
  const safeName = (assigneeName && assigneeName.trim()) || 'consultor'
  return template.replace(/\{handoff_assignee_name\}/g, safeName)
}
