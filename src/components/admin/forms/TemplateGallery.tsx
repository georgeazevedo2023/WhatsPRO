import {
  Star,
  Gift,
  ThumbsUp,
  UserPlus,
  Calendar,
  HardHat,
  CalendarCheck,
  BarChart3,
  Stethoscope,
  Briefcase,
  Ticket,
  MessageSquareHeart,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormTemplate } from '@/types/forms'
import { FORM_TEMPLATES } from '@/types/forms'

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Star,
  Gift,
  ThumbsUp,
  UserPlus,
  Calendar,
  HardHat,
  CalendarCheck,
  BarChart3,
  Stethoscope,
  Briefcase,
  Ticket,
  MessageSquareHeart,
}

// Map text-{color}-400 → bg-{color}-400/10 for badge background
// color is a Tailwind class like 'text-yellow-400'
function colorToBgClass(textColorClass: string): string {
  // 'text-yellow-400' → 'bg-yellow-400/10'
  return textColorClass.replace(/^text-/, 'bg-').replace(/(\d+)$/, '$1/10')
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TemplateGalleryProps {
  onSelect: (template: FormTemplate) => void
  onBlank: () => void
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────
interface TemplateCardProps {
  template: FormTemplate
  onSelect: (template: FormTemplate) => void
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const Icon = ICON_MAP[template.icon] ?? Star
  const bgClass = colorToBgClass(template.color)

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Badge com ícone */}
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
          template.color,
          bgClass,
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        {template.name}
      </span>

      {/* Descrição */}
      <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
        {template.description}
      </p>

      {/* Rodapé */}
      <div className="mt-auto pt-1">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {template.fields.length} campo{template.fields.length !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  )
}

// ─── TemplateGallery ──────────────────────────────────────────────────────────
export function TemplateGallery({ onSelect, onBlank }: TemplateGalleryProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold">Escolha um Template</h3>
        <p className="text-sm text-muted-foreground">
          Selecione um modelo pré-configurado ou comece do zero.
        </p>
      </div>

      {/* Botão em branco */}
      <Button
        variant="outline"
        onClick={onBlank}
        className="w-full justify-start gap-2"
      >
        <PlusCircle className="h-4 w-4 text-primary" />
        Formulário em Branco
      </Button>

      {/* Grade de templates */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FORM_TEMPLATES.map((template) => (
          <TemplateCard key={template.type} template={template} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
