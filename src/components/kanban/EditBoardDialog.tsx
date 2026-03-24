import { useState, useEffect } from 'react';
import type { Inbox } from '@/types';
import type { TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Lock } from 'lucide-react';
import { ColumnsTab } from './ColumnsTab';
import { FieldsTab } from './FieldsTab';
import { EntitiesTab } from './EntitiesTab';
import { AccessTab } from './AccessTab';

export interface KanbanBoard {
  id: string;
  name: string;
  description: string | null;
  visibility: 'shared' | 'private';
  inbox_id: string | null;
  instance_id: string | null;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  automation_enabled: boolean;
  automation_message: string | null;
}

export interface KanbanField {
  id: string;
  name: string;
  field_type: 'text' | 'currency' | 'date' | 'select' | 'entity_select';
  options: string[] | null;
  position: number;
  is_primary: boolean;
  required: boolean;
  show_on_card: boolean;
  entity_id?: string | null;
}


export interface BoardMember {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  full_name: string | null;
  email: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export interface KanbanEntity {
  id: string;
  name: string;
  position: number;
  values: KanbanEntityValue[];
}

export interface KanbanEntityValue {
  id: string;
  label: string;
  position: number;
}

interface EditBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: KanbanBoard;
  inboxes: Inbox[];
  onSaved: () => void;
}

export const COLUMN_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Texto Curto' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'entity_select', label: 'Entidade' },
];

export function EditBoardDialog({ open, onOpenChange, board, inboxes, onSaved }: EditBoardDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [visibility, setVisibility] = useState<'shared' | 'private'>(board.visibility);
  const [inboxId, setInboxId] = useState<string>(board.inbox_id || 'none');
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [fields, setFields] = useState<KanbanField[]>([]);
  const [entities, setEntities] = useState<KanbanEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Access tab state
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'editor' | 'viewer'>('editor');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [inboxMemberCount, setInboxMemberCount] = useState<number>(0);
  const [inboxName, setInboxName] = useState<string>('');

  useEffect(() => {
    if (open && board.id) {
      loadBoardData();
    }
  }, [open, board.id]);

  const loadBoardData = async () => {
    setLoading(true);
    const [colRes, fieldRes] = await Promise.all([
      supabase.from('kanban_columns').select('*').eq('board_id', board.id).order('position'),
      supabase.from('kanban_fields').select('*').eq('board_id', board.id).order('position'),
    ]);
    if (colRes.data) setColumns(colRes.data as KanbanColumn[]);
    if (fieldRes.data) {
      setFields(fieldRes.data.map(f => ({
        ...f,
        options: f.options ? (f.options as string[]) : null,
        show_on_card: f.show_on_card ?? false,
        entity_id: f.entity_id ?? null,
      })) as KanbanField[]);
    }

    // Load access data + entities
    await Promise.all([loadMembers(), loadAllUsers(), loadInboxInfo(), loadEntities()]);
    setLoading(false);
  };

  const loadEntities = async () => {
    const { data: entitiesData } = await supabase
      .from('kanban_entities')
      .select('*')
      .eq('board_id', board.id)
      .order('position');

    if (!entitiesData || entitiesData.length === 0) {
      setEntities([]);
      return;
    }

    const entityIds = entitiesData.map(e => e.id);
    const { data: valuesData } = await supabase
      .from('kanban_entity_values')
      .select('*')
      .in('entity_id', entityIds)
      .order('position');

    const valuesMap: Record<string, KanbanEntityValue[]> = {};
    (valuesData || []).forEach(v => {
      if (!valuesMap[v.entity_id]) valuesMap[v.entity_id] = [];
      valuesMap[v.entity_id].push({ id: v.id, label: v.label, position: v.position });
    });

    setEntities(entitiesData.map(e => ({
      id: e.id,
      name: e.name,
      position: e.position,
      values: valuesMap[e.id] || [],
    })));
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from('kanban_board_members')
      .select('id, user_id, role')
      .eq('board_id', board.id);

    if (!data || data.length === 0) { setMembers([]); return; }

    const userIds = data.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap: Record<string, UserProfile> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    setMembers(data.map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role as 'editor' | 'viewer',
      full_name: profileMap[m.user_id]?.full_name || null,
      email: profileMap[m.user_id]?.email || '',
    })));
  };

  const loadAllUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .order('full_name');
    setAllUsers((data || []) as UserProfile[]);
  };

  const loadInboxInfo = async () => {
    if (!board.inbox_id) return;
    const [inboxRes, membersRes] = await Promise.all([
      supabase.from('inboxes').select('name').eq('id', board.inbox_id).single(),
      supabase.from('inbox_users').select('id', { count: 'exact', head: true }).eq('inbox_id', board.inbox_id),
    ]);
    if (inboxRes.data) setInboxName(inboxRes.data.name);
    setInboxMemberCount(membersRes.count ?? 0);
  };

  // ── Columns ──────────────────────────────────────────────
  const addColumn = () => {
    const newCol: KanbanColumn = {
      id: `new_${Date.now()}`,
      name: 'Nova Coluna',
      color: COLUMN_COLORS[columns.length % COLUMN_COLORS.length],
      position: columns.length,
      automation_enabled: false,
      automation_message: null,
    };
    setColumns(prev => [...prev, newCol]);
  };

  const updateColumn = (id: string, patch: Partial<KanbanColumn>) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const removeColumn = (id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
  };

  const moveColumn = (id: string, dir: 'up' | 'down') => {
    setColumns(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  // ── Fields ───────────────────────────────────────────────
  const addField = () => {
    const newField: KanbanField = {
      id: `new_${Date.now()}`,
      name: 'Novo Campo',
      field_type: 'text',
      options: null,
      position: fields.length,
      is_primary: fields.length === 0,
      required: false,
      show_on_card: false,
      entity_id: null,
    };
    setFields(prev => [...prev, newField]);
  };

  const updateField = (id: string, patch: Partial<KanbanField>) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) return { ...f, ...patch };
      if (patch.is_primary && f.id !== id) return { ...f, is_primary: false };
      return f;
    }));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const moveField = (id: string, dir: 'up' | 'down') => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  // ── Entities ─────────────────────────────────────────────
  const addEntity = () => {
    setEntities(prev => [...prev, {
      id: `new_${Date.now()}`,
      name: 'Nova Entidade',
      position: prev.length,
      values: [],
    }]);
  };

  const updateEntity = (id: string, name: string) => {
    setEntities(prev => prev.map(e => e.id === id ? { ...e, name } : e));
  };

  const removeEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    // Clear entity_id from fields referencing this entity
    setFields(prev => prev.map(f => f.entity_id === id ? { ...f, entity_id: null, field_type: 'text' as const } : f));
  };

  const addEntityValue = (entityId: string) => {
    setEntities(prev => prev.map(e => {
      if (e.id !== entityId) return e;
      return {
        ...e,
        values: [...e.values, { id: `new_${Date.now()}`, label: '', position: e.values.length }],
      };
    }));
  };

  const updateEntityValue = (entityId: string, valueId: string, label: string) => {
    setEntities(prev => prev.map(e => {
      if (e.id !== entityId) return e;
      return {
        ...e,
        values: e.values.map(v => v.id === valueId ? { ...v, label } : v),
      };
    }));
  };

  const removeEntityValue = (entityId: string, valueId: string) => {
    setEntities(prev => prev.map(e => {
      if (e.id !== entityId) return e;
      return { ...e, values: e.values.filter(v => v.id !== valueId) };
    }));
  };

  // ── Members ──────────────────────────────────────────────
  const filteredUsers = allUsers.filter(u => {
    const alreadyMember = members.some(m => m.user_id === u.id);
    if (alreadyMember) return false;
    const q = userSearch.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleAddMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);

    const { error } = await supabase.from('kanban_board_members').insert({
      board_id: board.id,
      user_id: selectedUser.id,
      role: newMemberRole,
    });

    setAddingMember(false);
    if (error) {
      toast.error('Erro ao adicionar membro');
      return;
    }

    toast.success(`${selectedUser.full_name || selectedUser.email} adicionado(a)!`);
    setSelectedUser(null);
    setUserSearch('');
    loadMembers();
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const { error } = await supabase.from('kanban_board_members').delete().eq('id', memberId);
    if (error) { toast.error('Erro ao remover membro'); return; }
    toast.success(`${memberName} removido(a)`);
    loadMembers();
  };

  const handleUpdateMemberRole = async (memberId: string, role: 'editor' | 'viewer') => {
    const { error } = await supabase.from('kanban_board_members').update({ role }).eq('id', memberId);
    if (error) { toast.error('Erro ao atualizar papel'); return; }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const selectedInbox = inboxId !== 'none' ? inboxes.find(i => i.id === inboxId) : null;

    const { error: boardErr } = await supabase
      .from('kanban_boards')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        inbox_id: selectedInbox?.id || null,
        instance_id: selectedInbox?.instance_id || null,
      })
      .eq('id', board.id);

    if (boardErr) {
      toast.error('Erro ao salvar quadro');
      setSaving(false);
      return;
    }

    // Sync columns
    const existingColIds = columns.filter(c => !c.id.startsWith('new_')).map(c => c.id);
    const { data: dbCols } = await supabase.from('kanban_columns').select('id').eq('board_id', board.id);
    const dbColIds = (dbCols || []).map((c) => c.id);
    const toDelete = dbColIds.filter((id: string) => !existingColIds.includes(id));
    if (toDelete.length > 0) await supabase.from('kanban_columns').delete().in('id', toDelete);

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const isNew = col.id.startsWith('new_');
      if (isNew) {
        await supabase.from('kanban_columns').insert({ board_id: board.id, name: col.name, color: col.color, position: i, automation_enabled: col.automation_enabled, automation_message: col.automation_message });
      } else {
        await supabase.from('kanban_columns').update({ name: col.name, color: col.color, position: i, automation_enabled: col.automation_enabled, automation_message: col.automation_message }).eq('id', col.id);
      }
    }

    // Sync entities — get map of temp IDs to real UUIDs
    const entityIdMap = await saveEntities();

    // Sync fields (after entities so we can resolve IDs)
    const existingFieldIds = fields.filter(f => !f.id.startsWith('new_')).map(f => f.id);
    const { data: dbFields } = await supabase.from('kanban_fields').select('id').eq('board_id', board.id);
    const dbFieldIds = (dbFields || []).map((f) => f.id);
    const fieldsToDelete = dbFieldIds.filter((id: string) => !existingFieldIds.includes(id));
    if (fieldsToDelete.length > 0) await supabase.from('kanban_fields').delete().in('id', fieldsToDelete);

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const isNew = field.id.startsWith('new_');
      // Resolve entity_id using the map (handles temp IDs created in same session)
      const resolvedEntityId = field.field_type === 'entity_select' && field.entity_id
        ? (entityIdMap[field.entity_id] || field.entity_id)
        : null;
      const payload: TablesInsert<'kanban_fields'> = {
        board_id: board.id,
        name: field.name,
        field_type: field.field_type,
        options: field.field_type === 'select' ? field.options : null,
        position: i,
        is_primary: field.is_primary,
        required: field.required,
        show_on_card: field.show_on_card,
        entity_id: resolvedEntityId,
      };
      if (isNew) {
        await supabase.from('kanban_fields').insert(payload);
      } else {
        await supabase.from('kanban_fields').update(payload).eq('id', field.id);
      }
    }

    setSaving(false);
    toast.success('Quadro salvo com sucesso!');
    onSaved();
    onOpenChange(false);
  };

  const saveEntities = async (): Promise<Record<string, string>> => {
    // Get existing entity IDs from DB
    const { data: dbEntities } = await supabase.from('kanban_entities').select('id').eq('board_id', board.id);
    const dbEntityIds = (dbEntities || []).map((e) => e.id);
    const currentEntityIds = entities.filter(e => !e.id.startsWith('new_')).map(e => e.id);
    const entitiesToDelete = dbEntityIds.filter((id: string) => !currentEntityIds.includes(id));
    if (entitiesToDelete.length > 0) {
      await supabase.from('kanban_entity_values').delete().in('entity_id', entitiesToDelete);
      await supabase.from('kanban_entities').delete().in('id', entitiesToDelete);
    }

    // Map old temp IDs to real IDs for entity_id references in fields
    const entityIdMap: Record<string, string> = {};

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const isNew = entity.id.startsWith('new_');
      let realEntityId = entity.id;

      if (isNew) {
        const { data: inserted } = await supabase.from('kanban_entities').insert({
          board_id: board.id,
          name: entity.name,
          position: i,
        }).select('id').single();
        if (inserted) {
          realEntityId = inserted.id;
          entityIdMap[entity.id] = realEntityId;
        }
      } else {
        await supabase.from('kanban_entities').update({ name: entity.name, position: i }).eq('id', entity.id);
      }

      // Sync values
      const { data: dbValues } = await supabase.from('kanban_entity_values').select('id').eq('entity_id', realEntityId);
      const dbValueIds = (dbValues || []).map((v) => v.id);
      const currentValueIds = entity.values.filter(v => !v.id.startsWith('new_')).map(v => v.id);
      const valuesToDelete = dbValueIds.filter((id: string) => !currentValueIds.includes(id));
      if (valuesToDelete.length > 0) await supabase.from('kanban_entity_values').delete().in('id', valuesToDelete);

      for (let j = 0; j < entity.values.length; j++) {
        const val = entity.values[j];
        if (!val.label.trim()) continue;
        if (val.id.startsWith('new_')) {
          await supabase.from('kanban_entity_values').insert({
            entity_id: realEntityId,
            label: val.label.trim(),
            position: j,
          });
        } else {
          await supabase.from('kanban_entity_values').update({ label: val.label.trim(), position: j }).eq('id', val.id);
        }
      }
    }

    // Update fields UI state (async, not relied upon for save logic)
    setFields(prev => prev.map(f => {
      if (f.entity_id && entityIdMap[f.entity_id]) {
        return { ...f, entity_id: entityIdMap[f.entity_id] };
      }
      return f;
    }));

    return entityIdMap;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    return email[0].toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Quadro</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="colunas">Colunas</TabsTrigger>
            <TabsTrigger value="campos">Campos</TabsTrigger>
            <TabsTrigger value="entidades">Entidades</TabsTrigger>
            <TabsTrigger value="acesso">Acesso</TabsTrigger>
          </TabsList>

          {/* ── Aba Geral ── */}
          <TabsContent value="geral" className="space-y-4 mt-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label>Nome do Quadro *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Privacidade dos Leads</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('shared')}
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all ${
                    visibility === 'shared'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-medium">Compartilhado</span>
                  <span className="text-[10px] opacity-70 leading-tight">Todos os membros veem todos os leads. Ideal para equipes colaborativas.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all ${
                    visibility === 'private'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <Lock className="w-5 h-5" />
                  <span className="text-xs font-medium">Individual</span>
                  <span className="text-[10px] opacity-70 leading-tight">Cada atendente vê só seus leads. Ideal para corretores, vendedores autônomos.</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Caixa de Entrada WhatsApp <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={inboxId} onValueChange={setInboxId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem conexão WhatsApp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conexão WhatsApp</SelectItem>
                  {inboxes.map(inbox => (
                    <SelectItem key={inbox.id} value={inbox.id}>{inbox.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Vincula uma caixa de atendimento para habilitar automações de mensagem por etapa.</p>
            </div>
          </TabsContent>

          <TabsContent value="colunas" className="flex flex-col flex-1 min-h-0 mt-4">
            <ColumnsTab
              columns={columns}
              loading={loading}
              addColumn={addColumn}
              updateColumn={updateColumn}
              removeColumn={removeColumn}
              moveColumn={moveColumn}
            />
          </TabsContent>

          <TabsContent value="campos" className="flex flex-col flex-1 min-h-0 mt-4">
            <FieldsTab
              fields={fields}
              entities={entities}
              loading={loading}
              addField={addField}
              updateField={updateField}
              removeField={removeField}
              moveField={moveField}
            />
          </TabsContent>

          <TabsContent value="entidades" className="flex flex-col flex-1 min-h-0 mt-4">
            <EntitiesTab
              entities={entities}
              loading={loading}
              addEntity={addEntity}
              updateEntity={updateEntity}
              removeEntity={removeEntity}
              addEntityValue={addEntityValue}
              updateEntityValue={updateEntityValue}
              removeEntityValue={removeEntityValue}
            />
          </TabsContent>

          <TabsContent value="acesso" className="flex flex-col flex-1 min-h-0 mt-4 space-y-4 overflow-y-auto">
            <AccessTab
              visibility={visibility}
              boardInboxId={board.inbox_id}
              members={members}
              allUsers={allUsers}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              newMemberRole={newMemberRole}
              setNewMemberRole={setNewMemberRole}
              addingMember={addingMember}
              inboxMemberCount={inboxMemberCount}
              inboxName={inboxName}
              filteredUsers={filteredUsers}
              handleAddMember={handleAddMember}
              handleRemoveMember={handleRemoveMember}
              handleUpdateMemberRole={handleUpdateMemberRole}
              getInitials={getInitials}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
