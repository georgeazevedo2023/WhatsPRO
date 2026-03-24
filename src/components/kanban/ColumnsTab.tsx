import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import type { KanbanColumn } from './EditBoardDialog';
import { COLUMN_COLORS } from './EditBoardDialog';

interface ColumnsTabProps {
  columns: KanbanColumn[];
  loading: boolean;
  addColumn: () => void;
  updateColumn: (id: string, patch: Partial<KanbanColumn>) => void;
  removeColumn: (id: string) => void;
  moveColumn: (id: string, dir: 'up' | 'down') => void;
}

export function ColumnsTab({ columns, loading, addColumn, updateColumn, removeColumn, moveColumn }: ColumnsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Defina as etapas do seu funil</p>
        <Button size="sm" variant="outline" onClick={addColumn} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>}
        {!loading && columns.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma coluna. Clique em Adicionar para começar.</p>
        )}
        {columns.map((col, idx) => (
          <div key={col.id} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-card">
            <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
            <div className="shrink-0 mt-1">
              <div className="flex flex-wrap gap-1 w-24">
                {COLUMN_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-4 h-4 rounded-full transition-transform ${col.color === color ? 'ring-2 ring-offset-1 ring-foreground scale-125' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateColumn(col.id, { color })}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={col.name}
                onChange={e => updateColumn(col.id, { name: e.target.value })}
                placeholder="Nome da coluna"
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id={`auto_${col.id}`}
                  checked={col.automation_enabled}
                  onCheckedChange={v => updateColumn(col.id, { automation_enabled: v })}
                />
                <Label htmlFor={`auto_${col.id}`} className="text-xs">Mensagem automática ao mover</Label>
              </div>
              {col.automation_enabled && (
                <Textarea
                  value={col.automation_message || ''}
                  onChange={e => updateColumn(col.id, { automation_message: e.target.value })}
                  placeholder="Olá {{nome}}, seu status foi atualizado! Use {{campo:NOME}} para dados do lead."
                  rows={2}
                  className="text-xs"
                />
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveColumn(col.id, 'up')} disabled={idx === 0}>
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveColumn(col.id, 'down')} disabled={idx === columns.length - 1}>
                <ChevronDown className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeColumn(col.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
