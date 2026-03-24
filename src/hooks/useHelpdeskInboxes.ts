import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Inbox, Label } from '@/types';

export function useHelpdeskInboxes(inboxParam: string | null, deptParam: string | null) {
  const { user, isSuperAdmin } = useAuth();
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string>('');
  const [inboxLabels, setInboxLabels] = useState<Label[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchInboxes = async () => {
      if (!user) return;

      let inboxData: Inbox[] = [];

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('inboxes')
          .select('id, name, instance_id, webhook_outgoing_url')
          .order('name');
        if (!error && data) inboxData = data;
      } else {
        const { data, error } = await supabase
          .from('inbox_users')
          .select('inboxes(id, name, instance_id, webhook_outgoing_url)')
          .eq('user_id', user.id);
        if (!error && data) {
          inboxData = data
            .map((d: { inboxes: Inbox | null }) => d.inboxes)
            .filter(Boolean) as Inbox[];
        }
      }

      if (inboxData.length > 0) {
        setInboxes(inboxData);
        const targetInbox = inboxParam && inboxData.some(ib => ib.id === inboxParam)
          ? inboxParam
          : inboxData[0].id;
        setSelectedInboxId(targetInbox);
        // Only apply department filter from URL if explicitly requested (non-default dept)
        if (deptParam) {
          setDepartmentFilter(deptParam);
        } else {
          setDepartmentFilter(null);
        }
      }
    };
    fetchInboxes();
  }, [user, inboxParam, isSuperAdmin]);

  const fetchLabels = useCallback(async () => {
    if (!selectedInboxId) return;
    const { data } = await supabase
      .from('labels')
      .select('*')
      .eq('inbox_id', selectedInboxId)
      .order('name');
    setInboxLabels((data as Label[]) || []);
  }, [selectedInboxId]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return {
    inboxes,
    selectedInboxId,
    setSelectedInboxId,
    inboxLabels,
    fetchLabels,
    departmentFilter,
    setDepartmentFilter,
  };
}
