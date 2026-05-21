/**
 * Sprint B3: Loader unificado de agent_profiles para AI Agent + Playground.
 *
 * Substitui a leitura legada de `ai_agents.sub_agents` (JSONB) por uma única
 * query em `agent_profiles`. Cascade: funnel.profile_id -> agent.is_default.
 *
 * Sem profile ativo -> retorna null (caller decide fallback).
 */

export type ProfileRow = {
  id: string
  prompt: string
  handoff_rule: string | null
  handoff_max_messages: number | null
  handoff_department_id: string | null
  handoff_message: string | null
}

export type LoadActiveProfileInput = {
  agentId: string
  funnelProfileId?: string | null
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => any
    }
  }
}

const PROFILE_COLS =
  'id, prompt, handoff_rule, handoff_max_messages, handoff_department_id, handoff_message'

export async function loadActiveProfile(
  supabase: SupabaseLike,
  input: LoadActiveProfileInput,
): Promise<ProfileRow | null> {
  try {
    if (input.funnelProfileId) {
      const { data } = await supabase
        .from('agent_profiles')
        .select(PROFILE_COLS)
        .eq('id', input.funnelProfileId)
        .eq('enabled', true)
        .maybeSingle()
      if (data) return data as ProfileRow
    }

    if (!input.agentId) return null

    const { data } = await supabase
      .from('agent_profiles')
      .select(PROFILE_COLS)
      .eq('agent_id', input.agentId)
      .eq('is_default', true)
      .eq('enabled', true)
      .maybeSingle()
    return (data as ProfileRow | null) ?? null
  } catch {
    return null
  }
}
