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
            .select('role, can_view_all, can_view_unassigned, can_view_all_in_dept, inboxes(id, name, instance_id, webhook_outgoing_url)')
            .eq('user_id', user.id);
          if (!error && data) {
            const newPermissionsMap: Record<string, InboxPermissions> = {};
            inboxData = data
              .map((d: { inboxes: Inbox | null }) => {
                const inbox = (d as any).inboxes as Inbox | null;
                if (inbox) {
                  // Política (2026-05-24, pedido do dono): role 'agente' (atendente) só
                  // enxerga "Minhas" — NUNCA "Não atribuídas" nem "Todas", independente
                  // dos flags no banco. Garante o comportamento até pra atendentes novos
                  // (cujo default de can_view_unassigned no banco é true). 'gestor'/'admin'
                  // seguem honrando os flags granulares.
                  const isAgente = (d as any).role === 'agente';
                  newPermissionsMap[inbox.id] = {
                    canViewAll: isAgente ? false : ((d as any).can_view_all ?? false),
                    canViewUnassigned: isAgente ? false : ((d as any).can_view_unassigned ?? true),
                    canViewAllInDept: isAgente ? false : ((d as any).can_view_all_in_dept ?? true),
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
