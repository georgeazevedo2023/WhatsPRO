import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ColumnData } from '@/components/kanban/KanbanColumn';
import type { CardData } from '@/components/kanban/KanbanCardItem';
import type { KanbanField } from '@/components/kanban/DynamicFormField';

interface BoardData {
  id: string;
  name: string;
  description: string | null;
  visibility: 'shared' | 'private';
  inbox_id: string | null;
  instance_id: string | null;
  created_by: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface EntityValueOption {
  id: string;
  label: string;
}

/**
 * Custom hook that encapsulates all data fetching and state management
 * for a Kanban board. Extracted from KanbanBoard.tsx to reduce component size.
 */
export function useKanbanBoardData(boardId: string | undefined) {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isGerente } = useAuth();

  const [board, setBoard] = useState<BoardData | null>(null);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [fields, setFields] = useState<KanbanField[]>([]);
  const [entityValuesMap, setEntityValuesMap] = useState<Record<string, EntityValueOption[]>>({});
  const [entityValueLabels, setEntityValueLabels] = useState<Record<string, string>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [directMemberRole, setDirectMemberRole] = useState<'editor' | 'viewer' | null>(null);

  const canAddCard = isSuperAdmin || isGerente || directMemberRole === 'editor';

  useEffect(() => {
    if (boardId) loadAll();
  }, [boardId, user]);

  const loadAll = async () => {
    if (!boardId || !user) return;
    setLoading(true);

    try {
      const [boardRes, colRes, fieldRes, memberRes] = await Promise.all([
        supabase.from('kanban_boards').select('*').eq('id', boardId).single(),
        supabase.from('kanban_columns').select('*').eq('board_id', boardId).order('position'),
        supabase.from('kanban_fields').select('*').eq('board_id', boardId).order('position'),
        supabase.from('kanban_board_members').select('role').eq('board_id', boardId).eq('user_id', user.id).maybeSingle(),
      ]);

      if (boardRes.error || !boardRes.data) {
        toast.error('Quadro não encontrado');
        navigate('/dashboard/crm');
        return;
      }

      const boardData = boardRes.data as BoardData;
      setBoard(boardData);
      setColumns((colRes.data || []) as ColumnData[]);

      const parsedFields = (fieldRes.data || []).map(f => ({
        ...f,
        options: f.options ? (f.options as string[]) : null,
        show_on_card: f.show_on_card ?? false,
        entity_id: f.entity_id ?? null,
      })) as KanbanField[];
      setFields(parsedFields);

      if (memberRes.data) {
        setDirectMemberRole(memberRes.data.role as 'editor' | 'viewer');
      } else {
        setDirectMemberRole(null);
      }

      const evLabels = await loadEntityValues(boardData.id);
      await loadCards(boardData, parsedFields, evLabels);
      await loadTeamMembers(boardData);
    } catch (err) {
      console.error('[KanbanBoard] Error loading board:', err);
      toast.error('Erro ao carregar quadro');
    } finally {
      setLoading(false);
    }
  };

  const loadEntityValues = async (bId: string): Promise<Record<string, string>> => {
    const { data: entitiesData } = await supabase
      .from('kanban_entities')
      .select('id')
      .eq('board_id', bId);

    if (!entitiesData || entitiesData.length === 0) {
      setEntityValuesMap({});
      setEntityValueLabels({});
      return {};
    }

    const entityIds = entitiesData.map(e => e.id);
    const { data: valuesData } = await supabase
      .from('kanban_entity_values')
      .select('id, entity_id, label')
      .in('entity_id', entityIds)
      .order('position');

    const map: Record<string, EntityValueOption[]> = {};
    const labels: Record<string, string> = {};
    (valuesData || []).forEach(v => {
      if (!map[v.entity_id]) map[v.entity_id] = [];
      map[v.entity_id].push({ id: v.id, label: v.label });
      labels[v.id] = v.label;
    });

    setEntityValuesMap(map);
    setEntityValueLabels(labels);
    return labels;
  };

  const loadCards = async (boardData: BoardData, fieldsData: KanbanField[], evLabels?: Record<string, string>) => {
    if (!user) return;
    const labels = evLabels || entityValueLabels;

    let query = supabase
      .from('kanban_cards')
      .select('*, contacts(id, name, phone, profile_pic_url)')
      .eq('board_id', boardData.id)
      .order('position');

    if (boardData.visibility === 'private' && !isSuperAdmin) {
      query = query.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
    }

    const { data: rawCards } = await query;
    if (!rawCards) return;

    const cardIds = rawCards.map(c => c.id);
    const primaryField = fieldsData.find(f => f.is_primary);

    const allFieldsMap: Record<string, Record<string, string>> = {};
    if (cardIds.length > 0) {
      const { data: cardData } = await supabase
        .from('kanban_card_data')
        .select('card_id, field_id, value')
        .in('card_id', cardIds);
      (cardData || []).forEach(d => {
        if (!allFieldsMap[d.card_id]) allFieldsMap[d.card_id] = {};
        allFieldsMap[d.card_id][d.field_id] = d.value || '';
      });
    }

    const assigneeIds = [...new Set(rawCards.filter(c => c.assigned_to).map(c => c.assigned_to!))];
    let nameMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);
      (profiles || []).forEach(p => {
        nameMap[p.id] = p.full_name || p.email;
      });
    }

    const resolveDisplayValue = (field: KanbanField, rawValue: string): string => {
      if (field.field_type === 'entity_select' && rawValue) {
        return labels[rawValue] || rawValue;
      }
      return rawValue;
    };

    setCards(rawCards.map(c => {
      const cardFieldMap = allFieldsMap[c.id] || {};
      const fieldValuesArr = fieldsData
        .map(f => ({
          name: f.name,
          value: resolveDisplayValue(f, cardFieldMap[f.id] || ''),
          isPrimary: f.is_primary,
          showOnCard: f.show_on_card ?? false,
        }))
        .filter(fv => fv.value);

      const primaryRawValue = primaryField ? (cardFieldMap[primaryField.id] || '') : '';
      const primaryDisplayValue = primaryField ? resolveDisplayValue(primaryField, primaryRawValue) : undefined;

      return {
        id: c.id,
        title: c.title,
        column_id: c.column_id,
        board_id: c.board_id,
        assigned_to: c.assigned_to,
        tags: c.tags || [],
        position: c.position,
        notes: c.notes || null,
        contact_id: c.contact_id || null,
        contact_name: (c as Record<string, unknown>).contacts ? ((c as Record<string, unknown>).contacts as Record<string, unknown>)?.name as string || null : null,
        contact_phone: (c as Record<string, unknown>).contacts ? ((c as Record<string, unknown>).contacts as Record<string, unknown>)?.phone as string || null : null,
        contact_pic: (c as Record<string, unknown>).contacts ? ((c as Record<string, unknown>).contacts as Record<string, unknown>)?.profile_pic_url as string || null : null,
        assignedName: c.assigned_to ? nameMap[c.assigned_to] : undefined,
        primaryFieldValue: primaryDisplayValue || undefined,
        primaryFieldName: primaryField?.name,
        fieldValues: fieldValuesArr,
      };
    }));
  };

  const loadTeamMembers = async (boardData: BoardData) => {
    if (boardData.inbox_id) {
      const { data } = await supabase
        .from('inbox_users')
        .select('user_profiles(id, full_name, email)')
        .eq('inbox_id', boardData.inbox_id);
      const members = (data || [])
        .map((d: Record<string, unknown>) => d.user_profiles)
        .filter(Boolean) as TeamMember[];
      const unique = [...new Map(members.map(m => [m.id, m])).values()];
      setTeamMembers(unique);
    } else {
      const { data: memberRows } = await supabase
        .from('kanban_board_members')
        .select('user_id')
        .eq('board_id', boardData.id);

      const memberIds = (memberRows || []).map(r => r.user_id);
      if (memberIds.length === 0) {
        setTeamMembers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', memberIds)
        .order('full_name');

      setTeamMembers((profiles || []) as TeamMember[]);
    }
  };

  return {
    board, columns, cards, fields,
    entityValuesMap, entityValueLabels,
    teamMembers, loading, canAddCard,
    directMemberRole,
    setCards, setColumns, setFields,
    loadAll, loadCards,
  };
}

export type { BoardData, TeamMember, EntityValueOption };
