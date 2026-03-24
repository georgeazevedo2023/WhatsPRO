import type { Json } from '@/integrations/supabase/types';

export interface BroadcastLog {
  id: string;
  instance_id: string;
  instance_name: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  groups_targeted: number;
  recipients_targeted: number;
  recipients_success: number;
  recipients_failed: number;
  exclude_admins: boolean;
  random_delay: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  group_names: string[] | null;
  carousel_data: Json | null;
}

export type StatusFilter = 'all' | 'completed' | 'cancelled' | 'error';
export type MessageTypeFilter = 'all' | 'text' | 'image' | 'video' | 'audio' | 'document' | 'carousel';
export type TargetFilter = 'all' | 'groups' | 'leads';

export interface UniqueInstance {
  id: string;
  name: string;
}
