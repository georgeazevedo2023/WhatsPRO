import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useFlowSteps,
  useCreateFlowStep,
  useUpdateFlowStep,
  useDeleteFlowStep,
  useReorderFlowSteps,
} from '@/hooks/useFlowSteps'
import { StepConfigForm } from './StepConfigForm'
import {
  SUBAGENT_TYPE_LABELS,
  SUBAGENT_TYPE_DESCRIPTIONS,
  type FlowStep,
  type SubagentType,
} from '@/types/flows'

// ── Sortable item ────────────────────────────────────────────────────────────

function SortableStep({
  step,
  onEdit,
  onDelete,
}: {
  step: FlowStep
  onEdit: (step: FlowStep) => void
  onDelete: (step: FlowStep) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Position badge */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono font-medium">
        {step.position + 1}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{step.name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {SUBAGENT_TYPE_LABELS[step.subagent_type as SubagentType] ?? step.subagent_type}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(step)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive"
          onClick={() => onDelete(step)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Add Step Dialog ──────────────────────────────────────────────────────────

function AddStepDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (type: SubagentType, name: string) => void
}) {
  const [selectedType, setSelectedType] = useState<SubagentType>('greeting')
  const [stepName, setStepName] = useState('')

  const handleAdd = () => {
    onAdd(selectedType, stepName || SUBAGENT_TYPE_LABELS[selectedType])
    setStepName('')
    setSelectedType('greeting')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar step</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo de subagente</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SUBAGENT_TYPE_LABELS) as SubagentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`rounded-lg border-2 p-2.5 text-left text-sm transition-colors ${
                    selectedType === type
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium text-xs">{SUBAGENT_TYPE_LABELS[type]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {SUBAGENT_TYPE_DESCRIPTIONS[type]}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome do step (opcional)</Label>
            <Input
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              placeholder={SUBAGENT_TYPE_LABELS[selectedType]}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

interface FlowStepsPanelProps {
  flowId: string
}

export function FlowStepsPanel({ flowId }: FlowStepsPanelProps) {
  const { data: steps = [], isLoading } = useFlowSteps(flowId)
  const createStep = useCreateFlowStep()
  const updateStep = useUpdateFlowStep()
  const deleteStep = useDeleteFlowStep()
  const reorderSteps = useReorderFlowSteps()

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({})

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex((s) => s.id === active.id)
    const newIndex = steps.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(steps, oldIndex, newIndex)

    reorderSteps.mutate({
      flowId,
      order: reordered.map((s, i) => ({ id: s.id, position: i })),
    })
  }

  const handleAdd = (type: SubagentType, name: string) => {
    const nextPosition = steps.length
    createStep.mutate({
      flow_id: flowId,
      subagent_type: type,
      name,
      position: nextPosition,
      step_config: {},
      exit_rules: [],
    })
  }

  const handleEdit = (step: FlowStep) => {
    setEditingStep(step)
    setEditConfig((step.step_config as Record<string, unknown>) ?? {})
  }

  const handleSaveEdit = () => {
    if (!editingStep) return
    updateStep.mutate({
      id: editingStep.id,
      flowId,
      step_config: editConfig,
    })
    setEditingStep(null)
  }

  const handleDelete = (step: FlowStep) => {
    if (window.confirm(`Remover step "${step.name}"?`)) {
      deleteStep.mutate({ id: step.id, flowId })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar step
        </Button>
      </div>

      {/* Step list com drag-and-drop */}
      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">Nenhum step configurado</p>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar primeiro step
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {steps.map((step) => (
                <SortableStep
                  key={step.id}
                  step={step}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add dialog */}
      <AddStepDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAdd}
      />

      {/* Edit sheet */}
      <Sheet
        open={!!editingStep}
        onOpenChange={(open) => {
          if (!open) setEditingStep(null)
        }}
      >
        <SheetContent className="w-[420px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar: {editingStep?.name}</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            {editingStep && (
              <StepConfigForm
                subagentType={editingStep.subagent_type as SubagentType}
                config={editConfig}
                onChange={setEditConfig}
              />
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateStep.isPending}>
              {updateStep.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
