/**
 * leadHelper — Shared lead creation utilities.
 * Eliminates duplicated FIELD_MAP and lead upsert logic across
 * form-public, form-bot, and bio-public edge functions.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Standard field_key → lead_profiles column mapping.
 * Used by form-public, form-bot, and bio-public.
 */
export const FORM_FIELD_MAP: Record<string, string> = {
  nome: 'full_name',
  nome_completo: 'full_name',
  full_name: 'full_name',
  email: 'email',
  cpf: 'cpf',
  cidade: 'city',
  city: 'city',
  estado: 'state',
  state: 'state',
  empresa: 'company',
  company: 'company',
  cargo: 'role',
  role: 'role',
}

/** Phone-related keys to exclude from custom_fields */
const PHONE_KEYS = new Set(['telefone', 'phone', 'whatsapp'])

/**
 * Normalizes a phone string to a WhatsApp JID.
 * Strips non-digits and appends @s.whatsapp.net.
 */
export function phoneToJid(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  return `${clean}@s.whatsapp.net`
}

/**
 * Upserts a contact from a phone number.
 * Uses ON CONFLICT jid to avoid race conditions.
 */
export async function upsertContactFromPhone(
  supabase: SupabaseClient,
  phone: string,
  name?: string | null,
): Promise<{ id: string; jid: string } | null> {
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length < 10 || cleanPhone.length > 15) return null

  const jid = phoneToJid(cleanPhone)
  const row: Record<string, unknown> = { jid, phone: cleanPhone }
  if (name) row.name = name

  const { data, error } = await supabase
    .from('contacts')
    .upsert(row, { onConflict: 'jid', ignoreDuplicates: false })
    .select('id')
    .single()

  if (error || !data) return null
  return { id: data.id as string, jid }
}

/**
 * Maps raw form data to lead_profiles columns + custom_fields.
 * Returns { leadData, customFields } ready for upsert.
 */
export function mapFormDataToLead(
  contactId: string,
  data: Record<string, unknown>,
  origin?: string,
): { leadData: Record<string, unknown>; customFields: Record<string, unknown> } {
  const leadData: Record<string, unknown> = { contact_id: contactId }
  const customFields: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const col = FORM_FIELD_MAP[key.toLowerCase()]
    if (col) {
      leadData[col] = value
    } else if (!PHONE_KEYS.has(key.toLowerCase())) {
      customFields[key] = value
    }
  }

  if (Object.keys(customFields).length > 0) {
    leadData.custom_fields = customFields
  }

  // Set origin without overwriting existing value (handled by COALESCE in SQL or app logic)
  if (origin) {
    leadData.origin = origin
  }

  return { leadData, customFields }
}

/**
 * Upserts a lead_profile from form data.
 * Sets first_contact_at only if not already set (via SQL COALESCE).
 * Does NOT overwrite origin if already set.
 */
export async function upsertLeadFromFormData(
  supabase: SupabaseClient,
  contactId: string,
  data: Record<string, unknown>,
  origin?: string,
): Promise<void> {
  const { leadData } = mapFormDataToLead(contactId, data, origin)
  leadData.first_contact_at = new Date().toISOString()

  // Check if lead already exists to avoid overwriting origin/first_contact_at
  const { data: existing } = await supabase
    .from('lead_profiles')
    .select('id, origin, first_contact_at')
    .eq('contact_id', contactId)
    .maybeSingle()

  if (existing) {
    // Don't overwrite existing origin
    if (existing.origin) delete leadData.origin
    // Don't overwrite existing first_contact_at
    if (existing.first_contact_at) delete leadData.first_contact_at
  }

  await supabase.from('lead_profiles').upsert(leadData, { onConflict: 'contact_id' })
}
