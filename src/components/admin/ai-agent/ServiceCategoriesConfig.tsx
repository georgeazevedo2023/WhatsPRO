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

import { useMemo, useRef, useState } from 'react';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  Pencil,
  MessageSquare,
  Sliders,
  Target,
  LogOut,
  Sparkles,
  Wrench,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  SearchX,
} from 'lucide-react';

import { useUiMode, type UiMode } from './service-categories/useUiMode';
import { regexToCsv, csvToRegex, isSimpleAlternation } from './service-categories/regexCsvConvert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  type ServiceCategoriesConfig as ServiceCategoriesConfigType,
  type ServiceCategory,
  type DefaultCategory,
  type Stage,
  type QualificationField,
  type ExitAction,
  type CatalogStatus,
  EXIT_ACTION_OPTIONS,
  CATALOG_STATUS_OPTIONS,
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

/**
 * Erro REAL (bloqueante) num stage — exclui `scoreCap` que é só warning de score-cap proposital.
 * Usado pelo banner vermelho "Corrija os erros antes de salvar".
 */
function stageHasBlockingError(s: StageErrors): boolean {
  return !!(s.id || s.range || s.overlap || s.phrasing || Object.keys(s.fields).length > 0);
}

function categoryHasErrors(errs: CategoryErrors): boolean {
  return !!(
    errs.id ||
    errs.regex ||
    Object.values(errs.stages).some(stageHasBlockingError)
  );
}

function defaultHasErrors(errs: DefaultErrors): boolean {
  return Object.values(errs.stages).some(stageHasBlockingError);
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
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function SortableFieldRow({ field, index, errors, onChange, onRemove, uiMode, initialSlugs }: FieldRowProps) {
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
      className="rounded-lg border bg-background p-4 space-y-3"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {uiMode === 'advanced' && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Identificador interno
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Auto-gerado a partir do nome da pergunta. Não precisa editar.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              value={field.key}
              onChange={(e) => onChange(index, { key: slugify(e.target.value) })}
              placeholder="acabamento"
              className="h-9 font-mono text-sm"
            />
            {errors?.key && <p className="text-destructive text-xs">{errors.key}</p>}
          </div>
        )}
        <div className={uiMode === 'simple' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Nome da pergunta
          </Label>
          <Input
            value={field.label}
            onChange={(e) => {
              const newLabel = e.target.value;
              const patch: Partial<QualificationField> = { label: newLabel };
              // F2.3 guardrail: só auto-slugify em modo Iniciante E se a key NÃO existia no carregamento inicial
              if (uiMode === 'simple' && !initialSlugs.has(field.key)) {
                patch.key = slugify(newLabel) || field.key;
              }
              onChange(index, patch);
            }}
            placeholder="cor, acabamento, ambiente..."
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Exemplos de resposta esperada
          </Label>
          <Input
            value={field.examples}
            onChange={(e) => onChange(index, { examples: e.target.value })}
            placeholder="fosco, acetinado, brilho"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Peso da pergunta
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Quanto essa resposta vale na qualificação. Maior peso = mais importante.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          {uiMode === 'simple' ? (
            <ScoreWeightRadio
              value={field.score_value}
              onChange={(v) => onChange(index, { score_value: v })}
            />
          ) : (
            <Input
              type="number"
              min={0}
              max={100}
              value={Number.isFinite(field.score_value) ? field.score_value : 0}
              onChange={(e) => onChange(index, { score_value: parseInt(e.target.value, 10) || 0 })}
              className="h-9 text-sm"
            />
          )}
          {errors?.score_value && (
            <p className="text-destructive text-xs">{errors.score_value}</p>
          )}
        </div>
        {uiMode === 'advanced' && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Priority
            </Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={Number.isFinite(field.priority) ? field.priority : 1}
              onChange={(e) => onChange(index, { priority: parseInt(e.target.value, 10) || 1 })}
              className="h-9 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ScoreWeightRadio — substitui input number por 3 opções pré-definidas em modo Iniciante.
 * Mapeamento: leve=5, médio=10, importante=20. Score arbitrário em modo Avançado.
 */
function ScoreWeightRadio({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const presets = [
    { label: 'Leve', value: 5 },
    { label: 'Médio', value: 10 },
    { label: 'Importante', value: 20 },
  ];
  // Valor atual mais próximo de algum preset?
  const closest = presets.reduce((best, p) =>
    Math.abs(p.value - value) < Math.abs(best.value - value) ? p : best,
    presets[0],
  );
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {presets.map((p) => (
        <Button
          key={p.value}
          type="button"
          variant={p.value === closest.value ? 'default' : 'outline'}
          size="sm"
          className="h-9 text-sm"
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
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
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function FieldList({ fields, fieldErrors, onFieldsChange, uiMode, initialSlugs }: FieldListProps) {
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
                  uiMode={uiMode}
                  initialSlugs={initialSlugs}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addField}>
        <Plus className="h-3.5 w-3.5" />
        Adicionar pergunta
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
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
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
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
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function StageCard({ stage, index, errors, onChange, onRemove, uiMode, initialSlugs }: StageCardProps) {
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
            <Badge variant="outline" className="text-xs font-mono shrink-0">
              Etapa {index + 1}
            </Badge>
            <CardTitle className="text-base truncate">
              {stage.label || stage.id || 'Nova Etapa'}
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
        <div className={uiMode === 'simple' ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
          {uiMode === 'advanced' && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                Identificador interno
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Auto-gerado a partir do nome. Não precisa editar.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                value={stage.id}
                onChange={(e) => onChange({ id: slugify(e.target.value) })}
                placeholder="identificacao"
                className="h-9 font-mono text-sm"
              />
              {errors?.id && <p className="text-destructive text-xs">{errors.id}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Nome desta etapa
            </Label>
            <Input
              value={stage.label}
              onChange={(e) => {
                const newLabel = e.target.value;
                const patch: Partial<Stage> = { label: newLabel };
                if (uiMode === 'simple' && !initialSlugs.has(stage.id)) {
                  patch.id = slugify(newLabel) || stage.id;
                }
                onChange(patch);
              }}
              placeholder="Identificação"
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Score Range */}
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5 font-medium">
            <Activity className="h-4 w-4" />
            Quando avançar para próxima etapa?
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Pontos que o lead acumula. Quando atingir o limite máximo, dispara a ação configurada abaixo.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Começa em
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Number.isFinite(stage.min_score) ? stage.min_score : 0}
                  onChange={(e) => onChange({ min_score: parseInt(e.target.value, 10) || 0 })}
                  className="h-9 text-sm pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pts</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Termina em
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Number.isFinite(stage.max_score) ? stage.max_score : 0}
                  onChange={(e) => onChange({ max_score: parseInt(e.target.value, 10) || 0 })}
                  className="h-9 text-sm pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pts</span>
              </div>
            </div>
          </div>
          {errors?.range && <p className="text-destructive text-xs">{errors.range}</p>}
          {errors?.overlap && <p className="text-destructive text-xs">{errors.overlap}</p>}
        </div>

        {/* Exit Action */}
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5 font-medium">
            <LogOut className="h-4 w-4" />
            O que a IA faz quando termina esta etapa?
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Decide se a IA continua perguntando, busca produto ou transfere para vendedor humano.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Select
            value={stage.exit_action}
            onValueChange={(v) => onChange({ exit_action: v as ExitAction })}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXIT_ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  <div className="flex flex-col py-1">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fields */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Perguntas desta etapa
            </Label>
            <span className="text-xs text-muted-foreground">
              Total: <strong className="text-foreground">{totalFieldScore} pts</strong>
              {range > 0 && <> de {range}</>}
            </span>
          </div>
          <FieldList
            fields={stage.fields}
            fieldErrors={fieldErrors}
            onFieldsChange={onFieldsChange}
            uiMode={uiMode}
            initialSlugs={initialSlugs}
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
          <Label className="text-sm flex items-center gap-1.5 font-medium">
            <Pencil className="h-4 w-4" />
            Texto da pergunta
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {`Modelo da pergunta. Clique nas tags abaixo para inserir [Nome da pergunta] = ${'{label}'} ou [Exemplos] = ${'{examples}'}.`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Textarea
            value={stage.phrasing}
            onChange={(e) => onChange({ phrasing: e.target.value })}
            placeholder="Para encontrar a melhor opção, qual {label}? ({examples})"
            className="min-h-[60px] text-sm resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Inserir:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onChange({ phrasing: stage.phrasing + '{label}' })}
            >
              <Plus className="h-3 w-3" />
              Nome da pergunta
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onChange({ phrasing: stage.phrasing + '{examples}' })}
            >
              <Plus className="h-3 w-3" />
              Exemplos
            </Button>
          </div>
          {errors?.phrasing && <p className="text-destructive text-xs">{errors.phrasing}</p>}
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
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function StageList({ stages, stageErrors, onChange, uiMode, initialSlugs }: StageListProps) {
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
              uiMode={uiMode}
              initialSlugs={initialSlugs}
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
            Adicionar etapa
          </Button>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CategoryTile + CategoryEditor — tile no grid + editor no Sheet (drawer)
// ────────────────────────────────────────────────────────────────────────────

// Paleta determinística para avatares — hash do label → cor consistente
const AVATAR_PALETTE = [
  { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-500/30' },
  { bg: 'bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-500/30' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', ring: 'ring-indigo-500/30' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-700 dark:text-fuchsia-300', ring: 'ring-fuchsia-500/30' },
];

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(label: string): string {
  const cleaned = (label || '').trim();
  if (!cleaned) return '·';
  const words = cleaned.split(/\s+/).filter(w => w.length > 0 && !['de', 'da', 'do', 'e'].includes(w.toLowerCase()));
  if (words.length === 0) return cleaned.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ────────────────────────────────────────────────────────────────────────────
// CategoryTile — visual compacto usado no grid (clique abre Sheet com editor)
// ────────────────────────────────────────────────────────────────────────────

interface CategoryTileProps {
  category: ServiceCategory;
  errors: CategoryErrors;
  onClick: () => void;
  uiMode: UiMode;
}

function CategoryTile({ category, errors, onClick, uiMode }: CategoryTileProps) {
  const hasErrors = categoryHasErrors(errors);
  const stagesCount = category.stages.length;
  const fieldsCount = category.stages.reduce((acc, s) => acc + s.fields.length, 0);
  const matchPreview = uiMode === 'simple'
    ? regexToCsv(category.interesse_match)
    : category.interesse_match;
  const palette = paletteFor(category.label || category.id || 'x');
  const initials = getInitials(category.label || category.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left w-full rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        hasErrors ? 'border-destructive/60' : 'border-border'
      }`}
    >
      {/* Indicador lateral de erro */}
      {hasErrors && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" aria-hidden />
      )}

      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        {/* Header: avatar colorido + nome + pencil hover */}
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          <div className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-semibold text-[11px] sm:text-sm ring-1 ${palette.bg} ${palette.text} ${palette.ring}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate leading-tight">
              {category.label || category.id || 'Nova categoria'}
            </div>
            {matchPreview ? (
              <div className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1 sm:line-clamp-2 mt-0.5 sm:mt-1">
                <span className="opacity-60">ativa em:</span>{' '}
                <span className="text-foreground/80">{matchPreview}</span>
              </div>
            ) : (
              <div className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5 sm:mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Sem palavra-chave
              </div>
            )}
          </div>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
        </div>

        {/* Mini funil — dots por etapa, cor por exit_action */}
        {stagesCount > 0 && (
          <div className="flex items-center gap-1">
            {category.stages.map((stage, i) => (
              <div
                key={i}
                className={`h-1 sm:h-1.5 flex-1 rounded-full ${exitActionColor(stage.exit_action)} opacity-70 group-hover:opacity-100 transition-opacity`}
                title={`${stage.label || stage.id} → ${exitActionLabel(stage.exit_action)}`}
              />
            ))}
          </div>
        )}

        {/* Footer: counts */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            <strong className="text-foreground/90">{stagesCount}</strong>
            <span className="hidden sm:inline">etapa{stagesCount !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">et</span>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <strong className="text-foreground/90">{fieldsCount}</strong>
            <span className="hidden sm:inline">pergunta{fieldsCount !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">perg</span>
          </span>
          {hasErrors && (
            <Badge variant="destructive" className="text-[9px] gap-1 h-5 ml-auto">
              <AlertCircle className="h-3 w-3" /> Corrigir
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CategoryEditor — conteúdo completo do editor (renderizado dentro do Sheet)
// ────────────────────────────────────────────────────────────────────────────

interface CategoryEditorProps {
  category: ServiceCategory;
  errors: CategoryErrors;
  onChange: (patch: Partial<ServiceCategory>) => void;
  onStagesChange: (stages: Stage[]) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function CategoryEditor({
  category,
  errors,
  onChange,
  onStagesChange,
  onDuplicate,
  onRemove,
  uiMode,
  initialSlugs,
}: CategoryEditorProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const stageErrors = errors.stages ?? {};

  return (
    <>
      <div className="space-y-5">
            {/* Identidade da categoria */}
            <div className={uiMode === 'simple' ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
              {uiMode === 'advanced' && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    Identificador interno
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Auto-gerado a partir do nome. Não precisa editar.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    value={category.id}
                    onChange={(e) => onChange({ id: slugify(e.target.value) })}
                    placeholder="tintas"
                    className="h-9 font-mono text-sm"
                  />
                  {errors.id && <p className="text-destructive text-xs">{errors.id}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5 font-medium">
                  <Target className="h-4 w-4" />
                  Nome do tipo de produto
                </Label>
                <Input
                  value={category.label}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    const patch: Partial<ServiceCategory> = { label: newLabel };
                    if (uiMode === 'simple' && !initialSlugs.has(category.id)) {
                      patch.id = slugify(newLabel) || category.id;
                    }
                    onChange(patch);
                  }}
                  placeholder="Tintas e Vernizes"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5 font-medium">
                <MessageSquare className="h-4 w-4" />
                Como o cliente costuma chamar?
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Quando o cliente usar uma dessas palavras na conversa, esta categoria é ativada.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              {uiMode === 'simple' && !isSimpleAlternation(category.interesse_match) ? (
                <div className="space-y-1.5">
                  <Input
                    value={category.interesse_match}
                    onChange={(e) => onChange({ interesse_match: e.target.value })}
                    placeholder="tinta|esmalte|verniz"
                    className="h-9 font-mono text-sm"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    Regex avançada detectada — edite no modo Avançado para ver o regex puro.
                  </p>
                </div>
              ) : uiMode === 'simple' ? (
                <>
                  <Input
                    value={regexToCsv(category.interesse_match)}
                    onChange={(e) => onChange({ interesse_match: csvToRegex(e.target.value) })}
                    placeholder="tinta, esmalte, verniz"
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separe palavras por vírgula. A IA aceita qualquer uma delas.
                  </p>
                </>
              ) : (
                <Input
                  value={category.interesse_match}
                  onChange={(e) => onChange({ interesse_match: e.target.value })}
                  placeholder="tinta|esmalte|verniz"
                  className="h-9 font-mono text-sm"
                />
              )}
              {errors.regex && <p className="text-destructive text-xs">{errors.regex}</p>}
            </div>

            {/* R121 (2026-05-19): catalog_status — sinaliza disponibilidade do inventory.
                'digital' = tem produtos cadastrados em ai_agent_products (com foto).
                'offline' = vendemos mas nao cadastramos. Bot qualifica + handoff sem dizer "nao temos".
                'none'    = reservado. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Disponibilidade do catalogo
              </Label>
              <Select
                value={(category as any).catalog_status || 'digital'}
                onValueChange={(v) => onChange({ catalog_status: v as CatalogStatus })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Como o bot trata buscas nesta categoria. <strong>Digital</strong>: mostra produtos do catalogo com foto. <strong>Vendemos sem catalogo</strong>: qualifica e transfere ao vendedor com contexto rico (sem dizer que nao temos).
              </p>
            </div>

            {/* Funil visual */}
            <FunnelPreviewBar stages={category.stages} />

            {/* Aviso: nenhum stage terminal */}
            {errors.noExitTerminal && (
              <p className="text-amber-600 dark:text-amber-400 text-xs flex items-start gap-1 px-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {errors.noExitTerminal}
              </p>
            )}

            {/* Lista de stages */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                Etapas do funil
              </Label>
              <StageList
                stages={category.stages}
                stageErrors={stageErrors}
                onChange={onStagesChange}
                uiMode={uiMode}
                initialSlugs={initialSlugs}
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
                <Copy className="h-3.5 w-3.5" /> Duplicar categoria
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
      </div>

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
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DefaultCategoryTile + DefaultCategoryEditor — fallback (row + Sheet)
// ────────────────────────────────────────────────────────────────────────────

interface DefaultCategoryTileProps {
  defaultCat: DefaultCategory;
  errors: DefaultErrors;
  onClick: () => void;
}

function DefaultCategoryTile({ defaultCat, errors, onClick }: DefaultCategoryTileProps) {
  const hasErrors = defaultHasErrors(errors);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left w-full rounded-lg border bg-primary/[0.03] transition-all hover:shadow-md hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        hasErrors ? 'border-destructive/60' : 'border-primary/30'
      }`}
    >
      <div className="p-3 sm:p-4 flex items-center gap-3 flex-wrap">
        <div className="rounded-md p-1.5 bg-primary/10 text-primary shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm flex items-center gap-1.5">
            Padrão (fallback)
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Usado quando nenhuma categoria matcha. Recomendado: 1 stage simples com exit_action = "Transferir".
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Sempre ativo · não removível
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {hasErrors && (
            <Badge variant="destructive" className="text-[9px] gap-1 h-5">
              <AlertCircle className="h-3 w-3" /> Erros
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] h-5">
            {defaultCat.stages.length} etapa{defaultCat.stages.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
    </button>
  );
}

interface DefaultCategoryEditorProps {
  defaultCat: DefaultCategory;
  errors: DefaultErrors;
  onStagesChange: (stages: Stage[]) => void;
  uiMode: UiMode;
  initialSlugs: Set<string>;
}

function DefaultCategoryEditor({
  defaultCat,
  errors,
  onStagesChange,
  uiMode,
  initialSlugs,
}: DefaultCategoryEditorProps) {
  const stageErrors = errors.stages ?? {};

  return (
    <div className="space-y-5">
      <FunnelPreviewBar stages={defaultCat.stages} />
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          Etapas do funil padrão
        </Label>
        <StageList
          stages={defaultCat.stages}
          stageErrors={stageErrors}
          onChange={onStagesChange}
          uiMode={uiMode}
          initialSlugs={initialSlugs}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

interface ServiceCategoriesConfigProps {
  config: ServiceCategoriesConfigType | null;
  onChange: (config: ServiceCategoriesConfigType) => void;
}

type CategorySort = 'order' | 'name_asc' | 'most_stages' | 'most_questions' | 'errors_first';
const PAGE_SIZE = 12;

export function ServiceCategoriesConfig({ config, onChange }: ServiceCategoriesConfigProps) {
  const safeConfig = useMemo(() => ensureConfig(config), [config]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingDefault, setEditingDefault] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [uiMode, setUiMode] = useUiMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<CategorySort>('order');
  const [page, setPage] = useState(0);

  // F2.3 Guardrail: capturar slugs presentes no carregamento inicial.
  // Auto-slugify NUNCA regrava esses, mesmo em modo Iniciante.
  // Razão: slugs são referenciados em qualification_data de leads existentes
  // e em matchers de _shared/serviceCategories.ts. Mudar = quebrar histórico.
  const initialSlugsRef = useRef<Set<string>>(new Set());
  const [initialSlugsCaptured, setInitialSlugsCaptured] = useState(false);
  if (!initialSlugsCaptured && config) {
    const slugs = new Set<string>();
    for (const cat of safeConfig.categories) {
      slugs.add(cat.id);
      for (const stage of cat.stages) {
        slugs.add(stage.id);
        for (const f of stage.fields) slugs.add(f.key);
      }
    }
    for (const stage of safeConfig.default.stages) {
      slugs.add(stage.id);
      for (const f of stage.fields) slugs.add(f.key);
    }
    initialSlugsRef.current = slugs;
    setInitialSlugsCaptured(true);
  }

  // Validation
  const allCategoryIds = safeConfig.categories.map((c) => c.id);
  const categoryErrors = safeConfig.categories.map((c) => validateCategory(c, allCategoryIds));
  const defaultErrors = validateDefault(safeConfig.default);
  const blockedBySelfErrors = hasAnyError(categoryErrors, defaultErrors);

  const emit = (next: ServiceCategoriesConfigType) => {
    onChange(next);
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
    setEditingIdx(safeConfig.categories.length);
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
    setEditingIdx(idx + 1);
  };

  const removeCategory = (idx: number) => {
    const next: ServiceCategoriesConfigType = {
      ...safeConfig,
      categories: safeConfig.categories.filter((_, i) => i !== idx),
    };
    emit(next);
    setEditingIdx(null);
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
    setEditingIdx(null);
    setEditingDefault(false);
  };

  const editingCategory = editingIdx !== null ? safeConfig.categories[editingIdx] : null;
  const editingCategoryErrors = editingIdx !== null ? categoryErrors[editingIdx] : null;

  // ─── Filter + Sort + Paginate ───
  // Preservo índice original (origIdx) pra clicar e abrir o editor certo
  const indexedCategories = useMemo(
    () => safeConfig.categories.map((cat, origIdx) => ({ cat, origIdx, err: categoryErrors[origIdx] })),
    [safeConfig.categories, categoryErrors]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return indexedCategories;
    return indexedCategories.filter(({ cat }) => {
      const hay = `${cat.label} ${cat.id} ${cat.interesse_match}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [indexedCategories, normalizedQuery]);

  const sortedCategories = useMemo(() => {
    const arr = [...filteredCategories];
    switch (sortMode) {
      case 'name_asc':
        arr.sort((a, b) => (a.cat.label || '').localeCompare(b.cat.label || ''));
        break;
      case 'most_stages':
        arr.sort((a, b) => b.cat.stages.length - a.cat.stages.length);
        break;
      case 'most_questions': {
        const count = (c: ServiceCategory) => c.stages.reduce((acc, s) => acc + s.fields.length, 0);
        arr.sort((a, b) => count(b.cat) - count(a.cat));
        break;
      }
      case 'errors_first':
        arr.sort((a, b) => Number(categoryHasErrors(b.err)) - Number(categoryHasErrors(a.err)));
        break;
      // 'order' = original
    }
    return arr;
  }, [filteredCategories, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedCategories = sortedCategories.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page quando filtros mudam e zeram lista
  if (page !== safePage) {
    // ajusta sem rerender extra (state set é OK aqui pq é raro)
    setTimeout(() => setPage(safePage), 0);
  }

  // ─── Stats ───
  const totalCategories = safeConfig.categories.length;
  const totalQuestions = safeConfig.categories.reduce(
    (acc, c) => acc + c.stages.reduce((a, s) => a + s.fields.length, 0),
    0
  );
  const totalStages = safeConfig.categories.reduce((acc, c) => acc + c.stages.length, 0);
  const categoriesWithErrors = categoryErrors.filter(categoryHasErrors).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da seção */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Categorias de atendimento
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm text-xs">
                      Cada categoria tem etapas com pontuação. Conforme o lead responde,
                      acumula score e progride entre etapas. Ao fim de cada etapa,
                      a IA executa a ação configurada (buscar produtos, enriquecer, transferir).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription className="text-sm">
                Configure as perguntas que a IA faz para qualificar o lead, por tipo de produto.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {blockedBySelfErrors && (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertCircle className="h-3 w-3" /> Corrija os erros antes de salvar
                </Badge>
              )}
              <Tabs value={uiMode} onValueChange={(v) => setUiMode(v as UiMode)}>
                <TabsList className="h-9">
                  <TabsTrigger value="simple" className="gap-1.5 text-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Iniciante
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="gap-1.5 text-sm">
                    <Wrench className="h-3.5 w-3.5" />
                    Avançado
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats bar — 4 cols sempre, compacto */}
      {totalCategories > 0 && (
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-border bg-card px-2 py-2 sm:px-3 sm:py-2.5">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Categorias</div>
            <div className="text-base sm:text-lg font-bold text-foreground flex items-baseline gap-1">
              {totalCategories}
              <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary/60" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-2 py-2 sm:px-3 sm:py-2.5">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Etapas</div>
            <div className="text-base sm:text-lg font-bold text-foreground flex items-baseline gap-1">
              {totalStages}
              <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500/60" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-2 py-2 sm:px-3 sm:py-2.5">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Perguntas</div>
            <div className="text-base sm:text-lg font-bold text-foreground flex items-baseline gap-1">
              {totalQuestions}
              <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-sky-500/60" />
            </div>
          </div>
          <div className={`rounded-lg border px-2 py-2 sm:px-3 sm:py-2.5 ${categoriesWithErrors > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Pendentes</div>
            <div className={`text-base sm:text-lg font-bold flex items-baseline gap-1 ${categoriesWithErrors > 0 ? 'text-destructive' : 'text-foreground/60'}`}>
              {categoriesWithErrors}
              <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: search + sort + add — compact mobile */}
      {totalCategories > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Buscar..."
              className="h-9 pl-8 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setPage(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={sortMode} onValueChange={(v) => { setSortMode(v as CategorySort); setPage(0); }}>
            <SelectTrigger className="h-9 w-[44px] sm:w-[180px] gap-1.5 px-2 sm:px-3">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue className="hidden sm:inline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Ordem original</SelectItem>
              <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
              <SelectItem value="most_stages">Mais etapas</SelectItem>
              <SelectItem value="most_questions">Mais perguntas</SelectItem>
              <SelectItem value="errors_first">Com pendências primeiro</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addCategory} size="sm" className="h-9 gap-1.5 shrink-0 px-2 sm:px-3">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova categoria</span>
          </Button>
        </div>
      )}

      {/* Resumo do filtro */}
      {totalCategories > 0 && (normalizedQuery || sortMode !== 'order') && (
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>
            Mostrando <strong className="text-foreground">{sortedCategories.length}</strong>
            {' de '}<strong className="text-foreground">{totalCategories}</strong>
          </span>
          {(normalizedQuery || sortMode !== 'order') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => { setSearchQuery(''); setSortMode('order'); setPage(0); }}
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Grid de categorias */}
      {totalCategories === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-12 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Nenhuma categoria configurada</p>
          <p className="text-xs text-muted-foreground mb-4">
            Só o fallback "Padrão" abaixo será usado.
          </p>
          <Button size="sm" onClick={addCategory} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar primeira categoria
          </Button>
        </div>
      ) : sortedCategories.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-12 text-center">
          <SearchX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Nenhuma categoria encontrada</p>
          <p className="text-xs text-muted-foreground mb-4">
            Não há resultados para "<strong className="text-foreground">{searchQuery}</strong>"
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSearchQuery(''); setSortMode('order'); setPage(0); }}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pagedCategories.map(({ cat, origIdx, err }) => (
              <CategoryTile
                key={`${cat.id}-${origIdx}`}
                category={cat}
                errors={err}
                onClick={() => setEditingIdx(origIdx)}
                uiMode={uiMode}
              />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="text-xs text-muted-foreground">
                Página <strong className="text-foreground">{safePage + 1}</strong> de{' '}
                <strong className="text-foreground">{totalPages}</strong>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Default fallback — row destacada */}
      <DefaultCategoryTile
        defaultCat={safeConfig.default}
        errors={defaultErrors}
        onClick={() => setEditingDefault(true)}
      />

      {/* Sheet — editor de categoria normal */}
      <Sheet
        open={editingIdx !== null}
        onOpenChange={(open) => {
          if (!open) setEditingIdx(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
        >
          {editingCategory && editingCategoryErrors && (
            <>
              <SheetHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-primary" />
                  {editingCategory.label || editingCategory.id || 'Nova categoria'}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Configure as etapas, perguntas e ação de saída desta categoria.
                </SheetDescription>
              </SheetHeader>
              <div className="p-6">
                <CategoryEditor
                  category={editingCategory}
                  errors={editingCategoryErrors}
                  onChange={(patch) => updateCategory(editingIdx!, patch)}
                  onStagesChange={(stages) => updateCategoryStages(editingIdx!, stages)}
                  onDuplicate={() => duplicateCategory(editingIdx!)}
                  onRemove={() => removeCategory(editingIdx!)}
                  uiMode={uiMode}
                  initialSlugs={initialSlugsRef.current}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet — editor do fallback Padrão */}
      <Sheet
        open={editingDefault}
        onOpenChange={(open) => {
          if (!open) setEditingDefault(false);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
        >
          <SheetHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" />
              Padrão (fallback)
            </SheetTitle>
            <SheetDescription className="text-xs">
              Usado quando nenhuma categoria matcha o lead. Recomendado: 1 etapa simples com ação "Transferir".
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <DefaultCategoryEditor
              defaultCat={safeConfig.default}
              errors={defaultErrors}
              onStagesChange={updateDefaultStages}
              uiMode={uiMode}
              initialSlugs={initialSlugsRef.current}
            />
          </div>
        </SheetContent>
      </Sheet>

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
