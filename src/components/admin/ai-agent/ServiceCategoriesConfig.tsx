/**
 * ServiceCategoriesConfig v2 — UI 3 níveis (Categoria → Stage → Field).
 *
 * Diferente da v1 (schema plano), cada categoria agora tem um funil composto
 * por stages com pontuação. Conforme o lead responde, acumula score e progride
 * entre stages. Ao fim de cada stage, IA executa `exit_action` (buscar produtos,
 * enriquecer, transferir ou continuar).
 *
 * Componente puro: recebe `config` e propaga via `onChange`. Não fala com
 * Supabase — quem orquestra persistência é o pai (AIAgentTab).
 */

import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  GripVertical,
  RotateCcw,
  HelpCircle,
  Lock,
  AlertCircle,
  Activity,
  ArrowRight,
} from 'lucide-react';

import {
  type ServiceCategoriesConfig as ServiceCategoriesConfigType,
  type ServiceCategory,
  type DefaultCategory,
  type Stage,
  type QualificationField,
  type ExitAction,
  EXIT_ACTION_OPTIONS,
  DEFAULT_SERVICE_CATEGORIES_V2,
} from '@/types/serviceCategories';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9_]+$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function isValidRegex(pattern: string): boolean {
  if (!pattern) return true;
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function formatPreview(template: string, field: QualificationField | undefined): string {
  if (!field) return template;
  return template
    .replace(/\{label\}/g, field.label || '')
    .replace(/\{examples\}/g, field.examples || '');
}

function makeUniqueId(base: string, existing: string[]): string {
  let candidate = slugify(base) || 'item';
  if (!existing.includes(candidate)) return candidate;
  let n = 2;
  while (existing.includes(`${candidate}_${n}`)) n += 1;
  return `${candidate}_${n}`;
}

function ensureConfig(config: ServiceCategoriesConfigType | null): ServiceCategoriesConfigType {
  if (!config) return DEFAULT_SERVICE_CATEGORIES_V2;
  return {
    categories: Array.isArray(config.categories) ? config.categories : [],
    default: config.default ?? DEFAULT_SERVICE_CATEGORIES_V2.default,
  };
}

function sumFieldScores(fields: QualificationField[]): number {
  return fields.reduce((acc, f) => acc + (Number.isFinite(f.score_value) ? f.score_value : 0), 0);
}

function stageRange(stage: Stage): number {
  return Math.max(0, stage.max_score - stage.min_score);
}

/**
 * Cor do segmento do funil em função do exit_action.
 * - search_products → azul (ação de busca)
 * - enrichment      → âmbar (perguntar mais)
 * - handoff         → verde (sucesso, vai pro humano)
 * - continue        → cinza (passagem)
 */
function exitActionColor(action: ExitAction): string {
  switch (action) {
    case 'search_products': return 'bg-blue-500';
    case 'enrichment':      return 'bg-amber-500';
    case 'handoff':         return 'bg-emerald-500';
    case 'continue':        return 'bg-slate-400';
  }
}

function exitActionTextColor(action: ExitAction): string {
  switch (action) {
    case 'search_products': return 'text-blue-700 dark:text-blue-300';
    case 'enrichment':      return 'text-amber-700 dark:text-amber-300';
    case 'handoff':         return 'text-emerald-700 dark:text-emerald-300';
    case 'continue':        return 'text-slate-600 dark:text-slate-400';
  }
}

function exitActionLabel(action: ExitAction): string {
  return EXIT_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────

interface FieldErrors {
  key?: string;
  score_value?: string;
}

interface StageErrors {
  id?: string;
  range?: string;
  overlap?: string;
  phrasing?: string;
  scoreCap?: string;
  fields: Record<number, FieldErrors>;
}

interface CategoryErrors {
  id?: string;
  regex?: string;
  noExitTerminal?: string;
  stages: Record<number, StageErrors>;
}

interface DefaultErrors {
  stages: Record<number, StageErrors>;
}

function validateStage(
  stage: Stage,
  index: number,
  allStages: Stage[],
  stageIdsInCategory: string[],
): StageErrors {
  const errors: StageErrors = { fields: {} };

  if (!stage.id || !SLUG_RE.test(stage.id)) {
    errors.id = 'Use letras minúsculas, números e _';
  } else if (stageIdsInCategory.filter((x) => x === stage.id).length > 1) {
    errors.id = 'ID já em uso por outro stage';
  }

  if (!Number.isFinite(stage.min_score) || !Number.isFinite(stage.max_score) || stage.min_score >= stage.max_score) {
    errors.range = 'min_score deve ser menor que max_score';
  }

  // Sobreposição com outros stages
  const overlapping = allStages.some((other, i) => {
    if (i === index) return false;
    if (!Number.isFinite(other.min_score) || !Number.isFinite(other.max_score)) return false;
    return stage.min_score < other.max_score && other.min_score < stage.max_score;
  });
  if (overlapping) errors.overlap = 'Range sobrepõe outro stage';

  if (!stage.phrasing.trim()) errors.phrasing = 'Phrasing obrigatório';

  // Score-cap: alerta (não bloqueante) se soma de fields > range
  const total = sumFieldScores(stage.fields);
  const range = stageRange(stage);
  if (range > 0 && total > range) {
    errors.scoreCap = `Soma dos scores (${total}) excede o range do stage (${range}). OK se for proposital (score-cap).`;
  }

  // Fields
  const seenKeys = new Set<string>();
  stage.fields.forEach((f, idx) => {
    const fieldErrs: FieldErrors = {};
    if (!f.key || !SLUG_RE.test(f.key)) {
      fieldErrs.key = 'Slug inválido (a-z0-9_)';
    } else if (seenKeys.has(f.key)) {
      fieldErrs.key = 'Chave duplicada neste stage';
    }
    seenKeys.add(f.key);
    if (!Number.isFinite(f.score_value) || f.score_value < 0) {
      fieldErrs.score_value = 'Score deve ser >= 0';
    }
    if (Object.keys(fieldErrs).length > 0) errors.fields[idx] = fieldErrs;
  });

  return errors;
}

function validateCategory(cat: ServiceCategory, allCategoryIds: string[]): CategoryErrors {
  const errors: CategoryErrors = { stages: {} };

  if (!cat.id || !SLUG_RE.test(cat.id)) {
    errors.id = 'Use letras minúsculas, números e _';
  } else if (allCategoryIds.filter((x) => x === cat.id).length > 1) {
    errors.id = 'ID já em uso por outra categoria';
  }
  if (cat.interesse_match && !isValidRegex(cat.interesse_match)) {
    errors.regex = 'Regex inválido';
  }

  const stageIds = cat.stages.map((s) => s.id);
  cat.stages.forEach((stage, idx) => {
    const stageErrs = validateStage(stage, idx, cat.stages, stageIds);
    if (
      stageErrs.id ||
      stageErrs.range ||
      stageErrs.overlap ||
      stageErrs.phrasing ||
      stageErrs.scoreCap ||
      Object.keys(stageErrs.fields).length > 0
    ) {
      errors.stages[idx] = stageErrs;
    }
  });

  // Pelo menos 1 stage com handoff ou search_products no caminho
  const hasTerminal = cat.stages.some(
    (s) => s.exit_action === 'handoff' || s.exit_action === 'search_products',
  );
  if (cat.stages.length > 0 && !hasTerminal) {
    errors.noExitTerminal =
      'Recomendado: pelo menos um stage com exit_action "Buscar produtos" ou "Transferir".';
  }

  return errors;
}

function validateDefault(def: DefaultCategory): DefaultErrors {
  const errors: DefaultErrors = { stages: {} };
  const stageIds = def.stages.map((s) => s.id);
  def.stages.forEach((stage, idx) => {
    const stageErrs = validateStage(stage, idx, def.stages, stageIds);
    if (
      stageErrs.id ||
      stageErrs.range ||
      stageErrs.overlap ||
      stageErrs.phrasing ||
      stageErrs.scoreCap ||
      Object.keys(stageErrs.fields).length > 0
    ) {
      errors.stages[idx] = stageErrs;
    }
  });
  return errors;
}

function categoryHasErrors(errs: CategoryErrors): boolean {
  return !!(errs.id || errs.regex || Object.keys(errs.stages).length > 0);
}

function defaultHasErrors(errs: DefaultErrors): boolean {
  return Object.keys(errs.stages).length > 0;
}

function hasAnyError(catErrs: CategoryErrors[], defErrs: DefaultErrors): boolean {
  return catErrs.some(categoryHasErrors) || defaultHasErrors(defErrs);
}

// ────────────────────────────────────────────────────────────────────────────
// FieldRow (sortable)
// ────────────────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: QualificationField;
  index: number;
  errors?: FieldErrors;
  onChange: (idx: number, patch: Partial<QualificationField>) => void;
  onRemove: (idx: number) => void;
}

function SortableFieldRow({ field, index, errors, onChange, onRemove }: FieldRowProps) {
  const sortableId = `field-${field.key || `idx-${index}`}-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-background p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
          #{field.priority}
        </Badge>
        <span className="text-xs font-mono text-muted-foreground truncate">
          {field.key || '(sem chave)'}
        </span>
        <Badge variant="secondary" className="text-[10px] gap-1 shrink-0 ml-auto">
          <Activity className="h-3 w-3" />
          {field.score_value} pts
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
          aria-label="Remover field"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Chave (slug)
          </Label>
          <Input
            value={field.key}
            onChange={(e) => onChange(index, { key: slugify(e.target.value) })}
            placeholder="acabamento"
            className="h-8 font-mono text-xs"
          />
          {errors?.key && <p className="text-destructive text-[11px]">{errors.key}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Label
          </Label>
          <Input
            value={field.label}
            onChange={(e) => onChange(index, { label: e.target.value })}
            placeholder="acabamento"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Exemplos
          </Label>
          <Input
            value={field.examples}
            onChange={(e) => onChange(index, { examples: e.target.value })}
            placeholder="fosco, acetinado, brilho"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            Score (pts)
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Pontos somados ao score do lead quando este campo é respondido.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={Number.isFinite(field.score_value) ? field.score_value : 0}
            onChange={(e) => onChange(index, { score_value: parseInt(e.target.value, 10) || 0 })}
            className="h-8 text-xs"
          />
          {errors?.score_value && (
            <p className="text-destructive text-[11px]">{errors.score_value}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Priority
          </Label>
          <Input
            type="number"
            min={1}
            max={99}
            value={Number.isFinite(field.priority) ? field.priority : 1}
            onChange={(e) => onChange(index, { priority: parseInt(e.target.value, 10) || 1 })}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FieldList — DnD wrapper
// ────────────────────────────────────────────────────────────────────────────

interface FieldListProps {
  fields: QualificationField[];
  fieldErrors: Record<number, FieldErrors>;
  onFieldsChange: (fields: QualificationField[]) => void;
}

function FieldList({ fields, fieldErrors, onFieldsChange }: FieldListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(
    () => fields.map((f, i) => `field-${f.key || `idx-${i}`}-${i}`),
    [fields],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      priority: i + 1,
    }));
    onFieldsChange(reordered);
  };

  const updateField = (idx: number, patch: Partial<QualificationField>) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onFieldsChange(next);
  };

  const removeField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, priority: i + 1 }));
    onFieldsChange(next);
  };

  const addField = () => {
    const nextPriority = fields.length + 1;
    let baseKey = 'campo';
    let counter = 1;
    while (fields.some((f) => f.key === baseKey)) {
      counter += 1;
      baseKey = `campo_${counter}`;
    }
    const next: QualificationField[] = [
      ...fields,
      {
        key: baseKey,
        label: '',
        examples: '',
        score_value: 10,
        priority: nextPriority,
      },
    ];
    onFieldsChange(next);
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">
          Nenhum campo configurado neste stage.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <SortableFieldRow
                  key={ids[idx]}
                  field={field}
                  index={idx}
                  errors={fieldErrors[idx]}
                  onChange={updateField}
                  onRemove={removeField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addField}>
        <Plus className="h-3.5 w-3.5" />
        Adicionar Field
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PhrasingPreview — mostra o phrasing renderizado com o primeiro field
// ────────────────────────────────────────────────────────────────────────────

interface PhrasingPreviewProps {
  template: string;
  fields: QualificationField[];
}

function PhrasingPreview({ template, fields }: PhrasingPreviewProps) {
  const previewField = fields[0];
  if (!previewField || !template) return null;
  const rendered = formatPreview(template, previewField);
  return (
    <div className="rounded-md bg-muted/40 border border-dashed px-3 py-2 mt-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        Preview ao vivo
      </p>
      <p className="text-xs text-foreground italic">"{rendered}"</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FunnelPreviewBar — barra horizontal mostrando todos os stages como segmentos
// ────────────────────────────────────────────────────────────────────────────

interface FunnelPreviewBarProps {
  stages: Stage[];
}

function FunnelPreviewBar({ stages }: FunnelPreviewBarProps) {
  if (stages.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center">
        <p className="text-[11px] text-muted-foreground italic">
          Adicione stages para ver o funil.
        </p>
      </div>
    );
  }

  // Ordena visualmente por min_score (não muta o array original)
  const ordered = [...stages].sort((a, b) => a.min_score - b.min_score);
  const minOverall = Math.min(...ordered.map((s) => s.min_score), 0);
  const maxOverall = Math.max(...ordered.map((s) => s.max_score), 100);
  const totalRange = Math.max(1, maxOverall - minOverall);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Activity className="h-3 w-3" />
        Funil de Score
      </div>
      <div className="flex w-full overflow-hidden rounded-md border h-9">
        {ordered.map((stage, idx) => {
          const width = (stageRange(stage) / totalRange) * 100;
          return (
            <TooltipProvider key={`${stage.id}-${idx}`} delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`${exitActionColor(stage.exit_action)} relative flex items-center justify-center text-white text-[10px] font-medium px-1 cursor-default border-r border-background/30 last:border-r-0`}
                    style={{ width: `${Math.max(width, 6)}%` }}
                  >
                    <span className="truncate drop-shadow-sm">
                      {stage.label || stage.id}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <div className="space-y-0.5">
                    <p className="font-medium">{stage.label || stage.id}</p>
                    <p>Score: {stage.min_score}–{stage.max_score}</p>
                    <p className={exitActionTextColor(stage.exit_action)}>
                      Saída: {exitActionLabel(stage.exit_action)}
                    </p>
                    <p className="text-muted-foreground">
                      {stage.fields.length} field{stage.fields.length !== 1 ? 's' : ''} · soma {sumFieldScores(stage.fields)} pts
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>{minOverall}</span>
        <span>{maxOverall}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StageCard — uma etapa do funil (aninhada dentro da categoria)
// ────────────────────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: Stage;
  index: number;
  errors?: StageErrors;
  onChange: (patch: Partial<Stage>) => void;
  onRemove: () => void;
}

function StageCard({ stage, index, errors, onChange, onRemove }: StageCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fieldErrors = errors?.fields ?? {};

  const onFieldsChange = (fields: QualificationField[]) => {
    onChange({ fields });
  };

  const totalFieldScore = sumFieldScores(stage.fields);
  const range = stageRange(stage);
  const stageHasErrors =
    !!errors &&
    (!!errors.id ||
      !!errors.range ||
      !!errors.overlap ||
      !!errors.phrasing ||
      Object.keys(errors.fields).length > 0);

  return (
    <Card className={`border-l-4 ${stageHasErrors ? 'border-l-destructive' : 'border-l-primary/40'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
              Stage {index + 1}
            </Badge>
            <CardTitle className="text-sm truncate">
              {stage.label || stage.id || 'Novo Stage'}
            </CardTitle>
            <Badge
              variant="secondary"
              className={`text-[10px] gap-1 shrink-0 ${exitActionTextColor(stage.exit_action)}`}
            >
              <ArrowRight className="h-3 w-3" />
              {exitActionLabel(stage.exit_action)}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmRemove(true)}
            aria-label="Remover stage"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Identidade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">ID (slug único no stage)</Label>
            <Input
              value={stage.id}
              onChange={(e) => onChange({ id: slugify(e.target.value) })}
              placeholder="identificacao"
              className="h-8 font-mono text-xs"
            />
            {errors?.id && <p className="text-destructive text-[11px]">{errors.id}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={stage.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Identificação"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Score Range */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            Range de Score
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  O lead entra neste stage quando atinge min_score. Ao alcançar max_score, dispara a ação de saída.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Min Score
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={Number.isFinite(stage.min_score) ? stage.min_score : 0}
                onChange={(e) => onChange({ min_score: parseInt(e.target.value, 10) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Max Score
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={Number.isFinite(stage.max_score) ? stage.max_score : 0}
                onChange={(e) => onChange({ max_score: parseInt(e.target.value, 10) || 0 })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {errors?.range && <p className="text-destructive text-[11px]">{errors.range}</p>}
          {errors?.overlap && <p className="text-destructive text-[11px]">{errors.overlap}</p>}
        </div>

        {/* Exit Action */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            Ação ao final do Stage (Exit Action)
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  O que a IA faz quando o lead atinge o teto de score deste stage.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Select
            value={stage.exit_action}
            onValueChange={(v) => onChange({ exit_action: v as ExitAction })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXIT_ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  <div className="flex flex-col py-0.5">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fields */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Qualification Fields</Label>
            <span className="text-[11px] text-muted-foreground">
              Total possível: <strong className="text-foreground">{totalFieldScore} pts</strong>
              {range > 0 && <> de {range}</>}
            </span>
          </div>
          <FieldList
            fields={stage.fields}
            fieldErrors={fieldErrors}
            onFieldsChange={onFieldsChange}
          />
          {errors?.scoreCap && (
            <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {errors.scoreCap}
            </p>
          )}
        </div>

        {/* Phrasing */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            Phrasing (template da pergunta)
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Use {'{label}'} e {'{examples}'} como placeholders. A IA pergunta cada field deste stage usando este template.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Textarea
            value={stage.phrasing}
            onChange={(e) => onChange({ phrasing: e.target.value })}
            placeholder="Para encontrar a melhor opção, qual {label}? ({examples})"
            className="min-h-[60px] text-xs resize-none"
          />
          {errors?.phrasing && <p className="text-destructive text-[11px]">{errors.phrasing}</p>}
          <PhrasingPreview template={stage.phrasing} fields={stage.fields} />
        </div>
      </CardContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover stage &quot;{stage.label || stage.id}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os fields, range e phrasing deste stage serão perdidos. Esta ação é local e
              só persiste após salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmRemove(false);
                onRemove();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StageList — lista de stages da categoria com botão "+ Stage"
// ────────────────────────────────────────────────────────────────────────────

interface StageListProps {
  stages: Stage[];
  stageErrors: Record<number, StageErrors>;
  onChange: (stages: Stage[]) => void;
}

function StageList({ stages, stageErrors, onChange }: StageListProps) {
  const updateStage = (idx: number, patch: Partial<Stage>) => {
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStage = (idx: number) => {
    onChange(stages.filter((_, i) => i !== idx));
  };

  const addStage = () => {
    const lastMax = stages.length > 0 ? Math.max(...stages.map((s) => s.max_score)) : 0;
    const ids = stages.map((s) => s.id);
    const newId = makeUniqueId('stage', ids);
    const fresh: Stage = {
      id: newId,
      label: 'Novo Stage',
      min_score: lastMax,
      max_score: Math.min(100, lastMax + 30),
      exit_action: 'continue',
      fields: [],
      phrasing: 'Para te ajudar melhor, qual {label}? ({examples})',
    };
    onChange([...stages, fresh]);
  };

  return (
    <div className="space-y-3">
      {stages.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-6 text-center">
          <p className="text-xs text-muted-foreground mb-3">
            Nenhum stage neste funil. Adicione pelo menos 1 stage com exit_action de
            "Buscar produtos" ou "Transferir".
          </p>
          <Button size="sm" type="button" onClick={addStage} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar primeiro stage
          </Button>
        </div>
      ) : (
        <>
          {stages.map((stage, idx) => (
            <StageCard
              key={`${stage.id}-${idx}`}
              stage={stage}
              index={idx}
              errors={stageErrors[idx]}
              onChange={(patch) => updateStage(idx, patch)}
              onRemove={() => removeStage(idx)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={addStage}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Stage
          </Button>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CategoryCard — uma categoria com seus stages
// ────────────────────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: ServiceCategory;
  errors: CategoryErrors;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ServiceCategory>) => void;
  onStagesChange: (stages: Stage[]) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function CategoryCard({
  category,
  errors,
  expanded,
  onToggle,
  onChange,
  onStagesChange,
  onDuplicate,
  onRemove,
}: CategoryCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const hasErrors = categoryHasErrors(errors);
  const stageErrors = errors.stages ?? {};
  const stagesCount = category.stages.length;
  const fieldsCount = category.stages.reduce((acc, s) => acc + s.fields.length, 0);

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className={hasErrors ? 'border-destructive/50' : ''}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-sm truncate">
                    {category.label || category.id || 'Nova categoria'}
                  </CardTitle>
                  <CardDescription className="text-[11px] font-mono truncate">
                    id: {category.id || '—'}
                    {category.interesse_match && (
                      <>
                        {' · '}match:{' '}
                        <span className="text-foreground">{category.interesse_match}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasErrors && (
                  <Badge variant="destructive" className="text-[9px] gap-1">
                    <AlertCircle className="h-3 w-3" /> Erros
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {stagesCount} stage{stagesCount !== 1 ? 's' : ''} · {fieldsCount} field
                  {fieldsCount !== 1 ? 's' : ''}
                </Badge>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-5">
            {/* Identidade da categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ID (slug único)</Label>
                <Input
                  value={category.id}
                  onChange={(e) => onChange({ id: slugify(e.target.value) })}
                  placeholder="tintas"
                  className="h-8 font-mono text-xs"
                />
                {errors.id && <p className="text-destructive text-[11px]">{errors.id}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={category.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="Tintas e Vernizes"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                Interesse Match (regex)
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Casa contra o valor da tag interesse:X do lead. Ex:
                      &quot;tinta|esmalte|verniz&quot;.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                value={category.interesse_match}
                onChange={(e) => onChange({ interesse_match: e.target.value })}
                placeholder="tinta|esmalte|verniz"
                className="h-8 font-mono text-xs"
              />
              {errors.regex && <p className="text-destructive text-[11px]">{errors.regex}</p>}
            </div>

            {/* Funil visual */}
            <FunnelPreviewBar stages={category.stages} />

            {/* Aviso: nenhum stage terminal */}
            {errors.noExitTerminal && (
              <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-start gap-1 px-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {errors.noExitTerminal}
              </p>
            )}

            {/* Lista de stages */}
            <div className="space-y-2">
              <Label className="text-xs">Stages do Funil</Label>
              <StageList
                stages={category.stages}
                stageErrors={stageErrors}
                onChange={onStagesChange}
              />
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onDuplicate}
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar Categoria
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover categoria &quot;{category.label || category.id}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os stages, fields, regex e phrasings desta categoria serão perdidos.
              O fallback (Padrão) continuará ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmRemove(false);
                onRemove();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DefaultCategoryCard — fallback (sem id, sem regex)
// ────────────────────────────────────────────────────────────────────────────

interface DefaultCategoryCardProps {
  defaultCat: DefaultCategory;
  errors: DefaultErrors;
  expanded: boolean;
  onToggle: () => void;
  onStagesChange: (stages: Stage[]) => void;
}

function DefaultCategoryCard({
  defaultCat,
  errors,
  expanded,
  onToggle,
  onStagesChange,
}: DefaultCategoryCardProps) {
  const hasErrors = defaultHasErrors(errors);
  const stageErrors = errors.stages ?? {};

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card
        className={`border-primary/30 bg-primary/[0.03] ${hasErrors ? 'border-destructive/50' : ''}`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Padrão (fallback)
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Usado quando nenhuma categoria matcha. Recomendado: 1 stage
                          simples com exit_action = "Transferir".
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Sempre ativo · não removível
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasErrors && (
                  <Badge variant="destructive" className="text-[9px] gap-1">
                    <AlertCircle className="h-3 w-3" /> Erros
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {defaultCat.stages.length} stage{defaultCat.stages.length !== 1 ? 's' : ''}
                </Badge>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-5">
            <FunnelPreviewBar stages={defaultCat.stages} />
            <div className="space-y-2">
              <Label className="text-xs">Stages do Funil de Fallback</Label>
              <StageList
                stages={defaultCat.stages}
                stageErrors={stageErrors}
                onChange={onStagesChange}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

interface ServiceCategoriesConfigProps {
  config: ServiceCategoriesConfigType | null;
  onChange: (config: ServiceCategoriesConfigType) => void;
}

export function ServiceCategoriesConfig({ config, onChange }: ServiceCategoriesConfigProps) {
  const safeConfig = useMemo(() => ensureConfig(config), [config]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [defaultExpanded, setDefaultExpanded] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Validation
  const allCategoryIds = safeConfig.categories.map((c) => c.id);
  const categoryErrors = safeConfig.categories.map((c) => validateCategory(c, allCategoryIds));
  const defaultErrors = validateDefault(safeConfig.default);
  const blockedBySelfErrors = hasAnyError(categoryErrors, defaultErrors);

  const emit = (next: ServiceCategoriesConfigType) => {
    onChange(next);
  };

  const toggleCategory = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateCategory = (idx: number, patch: Partial<ServiceCategory>) => {
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      categories: safeConfig.categories.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    };
    emit(next);
  };

  const updateCategoryStages = (idx: number, stages: Stage[]) => {
    updateCategory(idx, { stages });
  };

  const addCategory = () => {
    const newId = makeUniqueId('nova_categoria', allCategoryIds);
    const fresh: ServiceCategory = {
      id: newId,
      label: 'Nova Categoria',
      interesse_match: '',
      stages: [
        {
          id: 'identificacao',
          label: 'Identificação',
          min_score: 0,
          max_score: 50,
          exit_action: 'search_products',
          fields: [],
          phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
        },
      ],
    };
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      categories: [...safeConfig.categories, fresh],
    };
    emit(next);
    setExpandedIds((prev) => new Set(prev).add(newId));
  };

  const duplicateCategory = (idx: number) => {
    const src = safeConfig.categories[idx];
    if (!src) return;
    const newId = makeUniqueId(`${src.id}_copia`, allCategoryIds);
    const copy: ServiceCategory = {
      ...src,
      id: newId,
      label: `${src.label} (Cópia)`,
      stages: src.stages.map((s) => ({
        ...s,
        fields: s.fields.map((f) => ({ ...f })),
      })),
    };
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      categories: [
        ...safeConfig.categories.slice(0, idx + 1),
        copy,
        ...safeConfig.categories.slice(idx + 1),
      ],
    };
    emit(next);
    setExpandedIds((prev) => new Set(prev).add(newId));
  };

  const removeCategory = (idx: number) => {
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      categories: safeConfig.categories.filter((_, i) => i !== idx),
    };
    emit(next);
  };

  const updateDefaultStages = (stages: Stage[]) => {
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      default: { ...safeConfig.default, stages },
    };
    emit(next);
  };

  const restoreDefaults = () => {
    onChange(DEFAULT_SERVICE_CATEGORIES_V2);
    setExpandedIds(new Set());
    setDefaultExpanded(false);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho da seção */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Categorias de Atendimento
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm text-xs">
                      Cada categoria tem etapas (stages) com pontuação. À medida que o lead
                      responde, acumula score e progride entre etapas. Ao fim de cada etapa,
                      a IA executa a ação configurada (buscar produtos, enriquecer, transferir).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Configure perguntas escalonadas por score, por categoria de produto/serviço.
                Substitui regras hardcoded por nicho — funciona para qualquer mercado.
              </CardDescription>
            </div>
            {blockedBySelfErrors && (
              <Badge variant="destructive" className="gap-1.5">
                <AlertCircle className="h-3 w-3" /> Corrija os erros antes de salvar
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Categorias */}
      <div className="space-y-3">
        {safeConfig.categories.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Nenhuma categoria configurada — só o fallback abaixo será usado.
            </p>
            <Button size="sm" onClick={addCategory} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar primeira categoria
            </Button>
          </div>
        ) : (
          safeConfig.categories.map((cat, idx) => (
            <CategoryCard
              key={`${cat.id}-${idx}`}
              category={cat}
              errors={categoryErrors[idx]}
              expanded={expandedIds.has(cat.id)}
              onToggle={() => toggleCategory(cat.id)}
              onChange={(patch) => updateCategory(idx, patch)}
              onStagesChange={(stages) => updateCategoryStages(idx, stages)}
              onDuplicate={() => duplicateCategory(idx)}
              onRemove={() => removeCategory(idx)}
            />
          ))
        )}

        {safeConfig.categories.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={addCategory}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Categoria
          </Button>
        )}
      </div>

      {/* Default fallback */}
      <DefaultCategoryCard
        defaultCat={safeConfig.default}
        errors={defaultErrors}
        expanded={defaultExpanded}
        onToggle={() => setDefaultExpanded((v) => !v)}
        onStagesChange={updateDefaultStages}
      />

      {/* Footer */}
      <div className="flex justify-end pt-2 border-t">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setConfirmRestore(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>
      </div>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar configuração padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as categorias atuais e o fallback serão substituídos pela configuração
              padrão v2 (tintas, impermeabilizantes, default — todas com stages). Esta ação
              pode ser desfeita salvando manualmente o estado atual em outro lugar antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRestore(false);
                restoreDefaults();
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
