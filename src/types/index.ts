// ── Instance ─────────────────────────────────────────────────────────
/** Superset of all Instance shapes used across the project.
 *  Components pick only the fields they need. */
export interface Instance {
  id: string;
  name: string;
  status?: string;
  token?: string;
  owner_jid?: string | null;
  profile_pic_url?: string | null;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  disabled?: boolean;
  user_profiles?: {
    full_name: string | null;
    email: string;
  };
}

// ── Inbox ────────────────────────────────────────────────────────────
export interface Inbox {
  id: string;
  name: string;
  instance_id: string;
  webhook_outgoing_url?: string | null;
  webhook_url?: string | null;
  created_by?: string;
  created_at?: string;
}

// ── Label ────────────────────────────────────────────────────────────
export interface Label {
  id: string;
  name: string;
  color: string;
  inbox_id: string;
}

// ── AI Summary ───────────────────────────────────────────────────────
export interface AiSummary {
  reason: string;
  summary: string;
  resolution: string;
  generated_at: string;
  message_count: number;
}

// ── Conversation ─────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  inbox_id: string;
  contact_id: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  department_id: string | null;
  is_read: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  ai_summary?: AiSummary | null;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    jid: string;
    profile_pic_url: string | null;
  };
  inbox?: {
    id: string;
    name: string;
    instance_id: string;
    webhook_outgoing_url?: string | null;
  };
  last_message?: string;
  department_name?: string;
}

// ── Message ──────────────────────────────────────────────────────────
export interface Message {
  id: string;
  conversation_id: string;
  direction: string;
  content: string | null;
  media_type: string;
  media_url: string | null;
  sender_id: string | null;
  external_id: string | null;
  created_at: string;
  transcription?: string | null;
}

// ── Department ──────────────────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  inbox_id: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentMember {
  id: string;
  department_id: string;
  user_id: string;
}

// ── User Role ───────────────────────────────────────────────────────
export type AppRole = 'super_admin' | 'gerente' | 'user';
export type InboxRole = 'admin' | 'agent';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Inbox User ──────────────────────────────────────────────────────
export interface InboxUser {
  id: string;
  inbox_id: string;
  user_id: string;
  role?: InboxRole;
}

// ── Conversation Label ──────────────────────────────────────────────
export interface ConversationLabel {
  id: string;
  conversation_id: string;
  label_id: string;
}

// ── Kanban ──────────────────────────────────────────────────────────
export interface KanbanBoard {
  id: string;
  name: string;
  inbox_id?: string | null;
  instance_id?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  name: string;
  color?: string | null;
  position: number;
  created_at?: string;
}

export interface KanbanCard {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  contact_id?: string | null;
  entity_id?: string | null;
  position: number;
  tags?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KanbanField {
  id: string;
  board_id: string;
  name: string;
  type: string;
  options?: Record<string, unknown> | null;
  position: number;
  created_at?: string;
}

// ── Lead Database ───────────────────────────────────────────────────
export interface LeadDatabase {
  id: string;
  name: string;
  instance_id?: string | null;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadDatabaseEntry {
  id: string;
  database_id: string;
  phone: string;
  name?: string | null;
  verified_name?: string | null;
  verification_status?: string | null;
  tags?: string[];
  created_at?: string;
}

// ── Global Search ───────────────────────────────────────────────────
export interface GlobalSearchResult {
  conversation_id: string;
  inbox_id: string;
  inbox_name: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  contact_profile_pic_url: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  last_message_at: string | null;
  is_read: boolean;
  match_type: 'contact_name' | 'phone' | 'message';
  message_snippet: string | null;
}

// ── UTM Campaign ────────────────────────────────────────────────────
export type CampaignType = 'venda' | 'suporte' | 'promocao' | 'evento' | 'recall' | 'fidelizacao';
export type CampaignStatus = 'active' | 'paused' | 'archived';

export type LandingMode = 'redirect' | 'form';

export interface UtmCampaign {
  id: string;
  instance_id: string;
  created_by: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term?: string | null;
  utm_content?: string | null;
  destination_phone: string;
  welcome_message: string;
  campaign_type: CampaignType;
  ai_template: string;
  ai_custom_text: string;
  landing_mode: LandingMode;
  form_slug?: string | null;
  kanban_board_id?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UtmVisit {
  id: string;
  campaign_id: string;
  ref_code: string;
  visitor_ip?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  contact_id?: string | null;
  conversation_id?: string | null;
  matched_at?: string | null;
  status: 'visited' | 'matched' | 'expired';
  visited_at: string;
  created_at: string;
}

export interface UtmCampaignWithMetrics extends UtmCampaign {
  total_visits: number;
  total_conversions: number;
  conversion_rate: number;
  instance_name?: string;
}

// ── Participant ──────────────────────────────────────────────────────
export interface Participant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name?: string;
  phoneNumber?: string;
}

// ── Group ────────────────────────────────────────────────────────────
export interface Group {
  id: string;
  name: string;
  size: number;
  participants: Participant[];
  pictureUrl?: string;
}
