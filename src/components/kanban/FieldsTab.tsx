import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import type { KanbanField, KanbanEntity } from './EditBoardDialog';
import { FIELD_TYPES } from './EditBoardDialog';

interface FieldsTabProps {
  fields: KanbanField[];
  entities: KanbanEntity[];
  loading: boolean;
  addField: () => void;
  updateField: (id: string, patch: Partial<KanbanField>) => void;
  removeField: (id: string) => void;
  moveField: (id: string, dir: 'up' | 'down') => void;
}

export function FieldsTab({ fields, entities, loading, addField, updateField, removeField, moveField }: FieldsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Campos do formulário de cada lead</p>
        <Button size="sm" variant="outline" onClick={addField} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>}
        {!loading && fields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum campo. Clique em Adicionar para começar.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                value={field.name}
                onChange={e => updateField(field.id, { name: e.target.value })}
                placeholder="Nome do campo"
                className="h-8 text-sm flex-1"
              />
              <Select value={field.field_type} onValueChange={v => {
                const patch: Partial<KanbanField> = { field_type: v as KanbanField['field_type'] };
                if (v !== 'entity_select') patch.entity_id = null;
                if (v !== 'select') patch.options = null;
                updateField(field.id, patch);
              }}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveField(field.id, 'up')} disabled={idx === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveField(field.id, 'down')} disabled={idx === fields.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => removeField(field.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            {field.field_type === 'select' && (
              <div className="pl-6">
                <Input
                  value={field.options?.join(', ') || ''}
                  onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="Opção 1, Opção 2, Opção 3"
                  className="h-7 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Separe as opções por vírgula</p>
              </div>
            )}
            {field.field_type === 'entity_select' && (
              <div className="pl-6">
                <Select
                  value={field.entity_id || 'none'}
                  onValueChange={v => updateField(field.id, { entity_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar entidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">— Selecionar entidade —</SelectItem>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.name} ({e.values.length} valores)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {entities.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Crie entidades na aba <strong>Entidades</strong> antes de usar este tipo.
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 pl-6">
              <div className="flex items-center gap-2">
                <Switch
                  id={`primary_${field.id}`}
                  checked={field.is_primary}
                  onCheckedChange={v => updateField(field.id, { is_primary: v })}
                />
                <Label htmlFor={`primary_${field.id}`} className="text-xs font-medium">Título do card</Label>
              </div>
              {!field.is_primary && (
                <div className="flex items-center gap-2">
                  <Switch
                    id={`show_on_card_${field.id}`}
                    checked={field.show_on_card}
                    onCheckedChange={v => updateField(field.id, { show_on_card: v })}
                  />
                  <Label htmlFor={`show_on_card_${field.id}`} className="text-xs">Exibir no card</Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id={`required_${field.id}`}
                  checked={field.required}
                  onCheckedChange={v => updateField(field.id, { required: v })}
                />
                <Label htmlFor={`required_${field.id}`} className="text-xs">Obrigatório</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
