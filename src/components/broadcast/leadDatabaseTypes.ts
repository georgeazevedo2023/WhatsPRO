// Tipos compartilhados das bases de leads do Disparador.
// Centralizados aqui para evitar drift entre os componentes de gestão
// (LeadDatabaseSelector, ManageLeadDatabaseDialog, Edit/MoveContactsDialog,
// página LeadDatabases).

export interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
  instance_id?: string | null;
}

export interface LeadEntry {
  id: string;
  phone: string;
  name: string | null;
  jid: string;
  source: string | null;
  group_name: string | null;
  is_verified: boolean | null;
  verified_name: string | null;
  verification_status: string | null;
}
