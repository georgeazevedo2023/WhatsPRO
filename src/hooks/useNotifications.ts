// M19 S8 Camada 2: hook minimal de notifications para super_admin
// Pollin a cada 60s; M19 S7 pode evoluir para realtime
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  read: boolean | null;
  created_at: string;
}

const POLL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (e) setError(e.message);
    else setItems((data || []) as AppNotification[]);
    setLoading(false);
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = items.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }, [user, items]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const unreadCount = items.filter(n => !n.read).length;

  return { items, unreadCount, loading, error, refetch: fetchNotifications, markAsRead, markAllRead };
}
