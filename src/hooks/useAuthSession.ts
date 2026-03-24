import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Get the current access token from Supabase session.
 * Shows a toast and throws on expired/missing session.
 */
export const getAccessToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    toast.error('Sessão expirada');
    throw new Error('Sessão expirada');
  }
  return session.access_token;
};

/**
 * Get the current user ID from Supabase session.
 * Shows a toast and throws on expired/missing session.
 */
export const getSessionUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    toast.error('Sessão expirada');
    throw new Error('Sessão expirada');
  }
  return session.user.id;
};
