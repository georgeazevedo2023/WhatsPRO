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

// Tailwind color → gradient classes for the thumbnail header
const GRADIENT_MAP: Record<string, string> = {
  'text-yellow-400':  'from-yellow-500/20  to-yellow-400/5',
  'text-purple-400':  'from-purple-500/20  to-purple-400/5',
  'text-green-400':   'from-green-500/20   to-green-400/5',
  'text-blue-400':    'from-blue-500/20    to-blue-400/5',
  'text-teal-400':    'from-teal-500/20    to-teal-400/5',
  'text-orange-400':  'from-orange-500/20  to-orange-400/5',
  'text-pink-400':    'from-pink-500/20    to-pink-400/5',
  'text-indigo-400':  'from-indigo-500/20  to-indigo-400/5',
  'text-red-400':     'from-red-500/20     to-red-400/5',
  'text-cyan-400':    'from-cyan-500/20    to-cyan-400/5',
  'text-amber-400':   'from-amber-500/20   to-amber-400/5',
  'text-rose-400':    'from-rose-500/20    to-rose-400/5',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TemplateGalleryProps {
  onSelect: (template: FormTemplate) => void
  onBlank: () => void
}

// ─── BlankFormCard ────────────────────────────────────────────────────────────
function BlankFormCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-8 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[200px]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 transition-colors duration-200 group-hover:bg-primary/20">
        <PlusCircle className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">Formulário em Branco</p>
        <p className="text-xs text-muted-foreground mt-0.5">Comece do zero</p>
      </div>
    </button>
  )
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────
interface TemplateCardProps {
  template: FormTemplate
  onSelect: (template: FormTemplate) => void
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const Icon = ICON_MAP[template.icon] ?? Star
  const gradient = GRADIENT_MAP[template.color] ?? 'from-muted to-muted/5'

  // First 2 field labels (first line only, strip numbering/options)
  const examples = template.fields
    .slice(0, 2)
    .map((f) => f.label.split('\n')[0].replace(/^[0-9]+\)\s*/, ''))

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className="group flex flex-col rounded-xl border border-border bg-card text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
    >
      {/* Thumbnail area */}
      <div
        className={cn(
          'relative flex items-center justify-center w-full h-28 bg-gradient-to-br',
          gradient,
        )}
      >
        {template.thumbnail ? (
          <img
            src={template.thumbnail}
            alt={template.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className={cn('h-10 w-10 opacity-80', template.color)} />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4">
        {/* Badge + name */}
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold',
            template.color,
            GRADIENT_MAP[template.color]?.replace('from-', 'bg-').replace(' to-.*', '') ?? 'bg-muted',
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {template.name}
        </span>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {template.description}
        </p>

        {/* Example questions */}
        <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
          {examples.map((ex, i) => (
            <p key={i} className="text-xs text-muted-foreground/70 italic line-clamp-1">
              "{ex}"
            </p>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-1">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {template.fields.length} campo{template.fields.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── TemplateGallery ──────────────────────────────────────────────────────────
export function TemplateGallery({ onSelect, onBlank }: TemplateGalleryProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Escolha um Template</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Selecione um modelo pré-configurado ou comece do zero.
        </p>
      </div>

      {/* Grade de templates com blank como primeiro card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BlankFormCard onSelect={onBlank} />
        {FORM_TEMPLATES.map((template) => (
          <TemplateCard key={template.type} template={template} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
