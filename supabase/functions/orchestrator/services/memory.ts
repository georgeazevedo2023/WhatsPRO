// =============================================================================
// Memory Service (S5)
// Gerencia memória curta (sessão, TTL 1h) e longa (permanente) do lead.
//
// Tabela: lead_memory
//   UNIQUE: uq_lead_memory_lead_type_scope (lead_id, memory_type, scope)
//   RPC:    upsert_lead_short_memory — merge + TTL automático
//
// Estrutura short:  { summary, products_shown[], intents[], session_start, message_count }
// Estrutura long:   { profile{}, sessions_count, first_contact, last_contact, notes[] }
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { MemorySnapshot } from './index.ts'

const supabase = createServiceClient()

// ── Carrega memória curta e longa do lead ─────────────────────────────────────
// Retorna objetos vazios se não há memória cadastrada ou se expirada.

export async function loadMemory(
  leadId: string,
  instanceId: string,
): Promise<MemorySnapshot> {
  const now = new Date().toISOString()

  const { data: rows } = await supabase
    .from('lead_memory')
    .select('memory_type, data')
    .eq('lead_id', leadId)
    .eq('instance_id', instanceId)
    .in('memory_type', ['short', 'long'])
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const short_memory: Record<string, unknown> = {}
  const long_memory: Record<string, unknown> = {}

  for (const row of rows ?? []) {
    if (row.memory_type === 'short') Object.assign(short_memory, row.data)
    if (row.memory_type === 'long') Object.assign(long_memory, row.data)
  }

  return { short_memory, long_memory }
}

// ── Salva/atualiza memória curta (TTL 1h via RPC upsert_lead_short_memory) ────
// Faz merge com a memória atual antes de salvar.

export async function saveShortMemory(
  leadId: string,
  instanceId: string,
  patch: Record<string, unknown>,
  scope = 'global',
  ttlSeconds = 3600,
): Promise<void> {
  // Busca current short memory para merge
  const { data: existing } = await supabase
    .from('lead_memory')
    .select('data')
    .eq('lead_id', leadId)
    .eq('memory_type', 'short')
    .eq('scope', scope)
    .maybeSingle()

  const currentData = (existing?.data as Record<string, unknown>) ?? {}
  const merged = { ...currentData, ...patch }

  const { error } = await supabase.rpc('upsert_lead_short_memory', {
    p_lead_id: leadId,
    p_instance_id: instanceId,
    p_scope: scope,
    p_data: merged,
    p_ttl_seconds: ttlSeconds,
  })

  if (error) {
    console.error('[memory] saveShortMemory error:', error.message)
  }
}

// ── Salva/atualiza memória longa (permanente) via RPC ────────────────────────
// Faz merge com dados existentes e chama upsert_lead_long_memory RPC.
// NÃO usa .upsert({ onConflict }) — PostgREST não consegue resolver a constraint
// pelo nome das colunas (bug B#2 S5). RPC faz INSERT … ON CONFLICT corretamente.

export async function upsertLongMemory(
  leadId: string,
  instanceId: string,
  patch: Record<string, unknown>,
  scope = 'global',
): Promise<void> {
  // Busca current long memory para merge
  const { data: existing } = await supabase
    .from('lead_memory')
    .select('data')
    .eq('lead_id', leadId)
    .eq('memory_type', 'long')
    .eq('scope', scope)
    .maybeSingle()

  const currentData = (existing?.data as Record<string, unknown>) ?? {}
  const merged = { ...currentData, ...patch }

  const { error } = await supabase.rpc('upsert_lead_long_memory', {
    p_lead_id: leadId,
    p_instance_id: instanceId,
    p_scope: scope,
    p_data: merged,
  })

  if (error) {
    console.error('[memory] upsertLongMemory error:', error.message)
  }
}

// ── Persiste nome do lead em lead_profiles.full_name ─────────────────────────

export async function saveLeadName(leadId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('lead_profiles')
    .update({ full_name: name })
    .eq('id', leadId)

  if (error) {
    console.error('[memory] saveLeadName error:', error.message)
  }
}
