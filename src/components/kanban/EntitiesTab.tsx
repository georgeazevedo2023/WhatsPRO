import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, X, Database } from 'lucide-react';
import type { KanbanEntity } from './EditBoardDialog';

interface EntitiesTabProps {
  entities: KanbanEntity[];
  loading: boolean;
  addEntity: () => void;
  updateEntity: (id: string, name: string) => void;
  removeEntity: (id: string) => void;
  addEntityValue: (entityId: string) => void;
  updateEntityValue: (entityId: string, valueId: string, label: string) => void;
  removeEntityValue: (entityId: string, valueId: string) => void;
}

export function EntitiesTab({
  entities, loading, addEntity, updateEntity, removeEntity,
  addEntityValue, updateEntityValue, removeEntityValue,
}: EntitiesTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">Tabelas de valores reutilizáveis (ex: Planos, Bancos, Pizzas)</p>
        <Button size="sm" variant="outline" onClick={addEntity} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>}
        {!loading && entities.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Database className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhuma entidade criada.</p>
            <p className="text-xs text-muted-foreground">
              Crie entidades como "Planos", "Bancos" ou "Produtos" para usar em campos do tipo <strong>Entidade</strong>.
            </p>
          </div>
        )}
        {entities.map(entity => (
          <div key={entity.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={entity.name}
                onChange={e => updateEntity(entity.id, e.target.value)}
                placeholder="Nome da entidade (ex: Planos)"
                className="h-8 text-sm flex-1 font-medium"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeEntity(entity.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="pl-6 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Valores:</p>
              {entity.values.map(val => (
                <div key={val.id} className="flex items-center gap-2">
                  <Input
                    value={val.label}
                    onChange={e => updateEntityValue(entity.id, val.id, e.target.value)}
                    placeholder="Ex: Ouro, Calabresa..."
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeEntityValue(entity.id, val.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-primary"
                onClick={() => addEntityValue(entity.id)}
              >
                <Plus className="w-3 h-3" /> Adicionar valor
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
