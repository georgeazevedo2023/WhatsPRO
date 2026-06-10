/** Lógica PURA do nome de exibição do lead no Helpdesk.
 *
 *  Arquitetura de DOIS nomes (decisão de design, ver crmTools.ts updateLeadProfile):
 *  - contacts.name        = pushname do WhatsApp, re-sincronizado a cada mensagem pelo
 *                           whatsapp-webhook → NUNCA sobrescrever (o webhook reverte).
 *  - lead_profiles.full_name = nome que o lead INFORMOU na conversa (extraído pela IA
 *                           via update_lead_profile) — mais confiável pra exibição.
 *
 *  Caso real (2026-06-10): lead com pushname "oi" se apresentou como "Jessica";
 *  a IA gravou em lead_profiles mas o header/lista mostravam "oi".
 */

export interface DisplayableContact {
  name?: string | null;
  phone?: string | null;
  lead_profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
}

/** full_name extraído pela IA, se houver. O embed do PostgREST vem como objeto
 *  (lead_profiles.contact_id é UNIQUE), mas trata array defensivamente. */
export function leadFullName(contact?: DisplayableContact | null): string | undefined {
  const lp = contact?.lead_profiles;
  const full = Array.isArray(lp) ? lp[0]?.full_name : lp?.full_name;
  return full?.trim() || undefined;
}

/** Prioridade de exibição: nome informado na conversa → pushname → telefone. */
export function contactDisplayName(contact?: DisplayableContact | null): string {
  return leadFullName(contact) || contact?.name?.trim() || contact?.phone || 'Desconhecido';
}
