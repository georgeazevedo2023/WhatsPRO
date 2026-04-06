import type { Tables } from '@/integrations/supabase/types';

export interface LeadData {
  contact_id: string;
  phone: string;
  jid: string;
  name: string | null;
  profile_pic_url: string | null;
  ia_blocked_instances: string[];
  first_contact_at: string;
  display_name: string;
  lead_profile: Tables<'lead_profiles'> | null;
  conversations: Array<{ id: string }>;
  tags: string[];
  label_names: string[];
  last_contact_at: string | null;
  last_summary_reason: string | null;
  kanban_stage: string | null;
  kanban_color: string | null;
  kanban_board_id: string | null;
}

export interface ActionEvent {
  date: string;
  type: string;
  description: string;
}

export interface MediaFile {
  id: string;
  media_url: string;
  media_type: string;
  direction: string;
  created_at: string;
  content: string | null;
  transcription?: string | null;
}

export interface ExtractionField {
  key: string;
  label: string;
  enabled: boolean;
  section?: string;
}

export interface InstanceOption {
  id: string;
  name: string;
}

export const ORIGIN_OPTIONS = ['Instagram', 'Google', 'Google Ads', 'Tráfego Pago', 'Tráfego Direto', 'Indicação', 'WhatsApp', 'Outro'];
