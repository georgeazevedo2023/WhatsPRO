import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Inbox, Label } from '@/types';

interface InboxPermissions {
  canViewAll: boolean;
  canViewUnassigned: boolean;
  canViewAllInDept: boolean;
}

export function useHelpdeskInboxes(inboxParam: string | null, deptParam: string | null) {
  const { user, isSuperAdmin } = useAuth();
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [inboxesLoading, setInboxesLoading] = useState<boolean>(true);
  const [selectedInboxId, setSelectedInboxId] = useState<string>('');
  const [inboxLabels, setInboxLabels] = useState<Label[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<InboxPermissions>({ canViewAll: false, canViewUnassigned: true, canViewAllInDept: true });

  // Map of inbox_id -> permissions for non-super-admin users
  const permissionsMapRef = useRef<Record<string, InboxPermissions>>({});

  useEffect(() => {
    const fetchInboxes = async () => {
      if (!user) return;

      setInboxesLoading(true);
      let inboxData: Inbox[] = [];

      try {
        if (isSuperAdmin) {
          const { data, error } = await supabase
            .from('inboxes')
            .select('id, name, instance_id, webhook_outgoing_url')
            .order('name');
          if (!error && data) inboxData = data;
          // Super admin always has full permissions
          setUserPermissions({ canViewAll: true, canViewUnassigned: true, canViewAllInDept: true });
          permissionsMapRef.current = {};
        } else {
          const { data, error } = await supabase
            .from('inbox_users')
            .select('can_view_all, can_view_unassigned, can_view_all_in_dept, inboxes(id, name, instance_id, webhook_outgoing_url)')
            .eq('user_id', user.id);
          if (!error && data) {
            const newPermissionsMap: Record<string, InboxPermissions> = {};
            inboxData = data
              .map((d: { inboxes: Inbox | null }) => {
                const inbox = (d as any).inboxes as Inbox | null;
                if (inbox) {
                  // Os 3 flags são a fonte da verdade (controlados pelo admin nos toggles
                  // de "Visibilidade de conversas" do UsersTab). Default conservador: na
                  // ausência do valor, NÃO libera (só Minhas) — atendente novo nasce
                  // restrito e o admin libera caso a caso marcando a caixa.
                  newPermissionsMap[inbox.id] = {
                    canViewAll: (d as any).can_view_all ?? false,
                    canViewUnassigned: (d as any).can_view_unassigned ?? false,
                    canViewAllInDept: (d as any).can_view_all_in_dept ?? false,
                  };
                }
                return inbox;
              })
              .filter(Boolean) as Inbox[];
            permissionsMapRef.current = newPermissionsMap;
          }
        }

        setInboxes(inboxData);

        if (inboxData.length > 0) {
          const targetInbox = inboxParam && inboxData.some(ib => ib.id === inboxParam)
            ? inboxParam
            : inboxData[0].id;
          setSelectedInboxId(targetInbox);

          // Set permissions for the initially selected inbox (non-super-admin)
          if (!isSuperAdmin && permissionsMapRef.current[targetInbox]) {
            setUserPermissions(permissionsMapRef.current[targetInbox]);
          }

          // Only apply department filter from URL if explicitly requested (non-default dept)
          if (deptParam) {
            setDepartmentFilter(deptParam);
          } else {
            setDepartmentFilter(null);
          }
        } else {
          setSelectedInboxId('');
          setDepartmentFilter(null);
        }
      } finally {
        setInboxesLoading(false);
      }
    };
    fetchInboxes();
  }, [user, inboxParam, isSuperAdmin]);

  // Update permissions when selected inbox changes (for non-super-admin)
  useEffect(() => {
    if (isSuperAdmin) {
      setUserPermissions({ canViewAll: true, canViewUnassigned: true, canViewAllInDept: true });
      return;
    }
    if (selectedInboxId && permissionsMapRef.current[selectedInboxId]) {
      setUserPermissions(permissionsMapRef.current[selectedInboxId]);
    }
  }, [selectedInboxId, isSuperAdmin]);

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
    inboxesLoading,
    selectedInboxId,
    setSelectedInboxId,
    inboxLabels,
    fetchLabels,
    departmentFilter,
    setDepartmentFilter,
    userPermissions,
  };
}
