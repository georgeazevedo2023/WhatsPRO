import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, Layers, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { FLOW_TEMPLATES, TEMPLATE_CATEGORIES } from '@/data/flowTemplates'
import { TRIGGER_TYPE_LABELS } from '@/types/flows'
import type { FlowTemplate } from '@/data/flowTemplates'

export default function FlowTemplatesPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string>('todos')
  const [preview, setPreview] = useState<FlowTemplate | null>(null)

  const filtered = category === 'todos'
    ? FLOW_TEMPLATES
    : FLOW_TEMPLATES.filter((t) => t.category === category)

  const handleUseTemplate = (template: FlowTemplate) => {
    navigate(`/dashboard/flows/new/wizard?mode=form&template=${template.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1 text-muted-foreground"
            onClick={() => navigate('/dashboard/flows/new')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Escolher template</h1>
          <p className="text-muted-foreground mt-1">
            {FLOW_TEMPLATES.length} templates prontos para usar
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={category === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border bg-card p-4 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
              <p className="text-xs text-muted-foreground flex-1 mb-3">{template.description}</p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {template.steps_preview.length} steps
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {template.triggers_preview.length} gatilhos
                </span>
              </div>

              {template.compatibility_warnings?.length ? (
                <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded p-2 mb-3">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {template.compatibility_warnings[0]}
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setPreview(template)}
                >
                  Pré-visualizar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleUseTemplate(template)}
                >
                  Usar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Drawer */}
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-2xl">{preview?.icon}</span>
              {preview?.name}
            </SheetTitle>
            <SheetDescription>{preview?.description}</SheetDescription>
          </SheetHeader>

          {preview && (
            <div className="py-4 space-y-5">
              {/* Steps */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Steps incluídos
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {preview.steps_preview.map((step, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {i + 1}. {step}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Triggers */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> Gatilhos pré-configurados
                </h4>
                <div className="space-y-1.5">
                  {preview.triggers_preview.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {TRIGGER_TYPE_LABELS[t.type]}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {preview.compatibility_warnings?.length ? (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" /> Requisitos
                  </h4>
                  <ul className="space-y-1">
                    {preview.compatibility_warnings.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700 flex items-center gap-1.5">
                        <span>•</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button className="w-full" onClick={() => handleUseTemplate(preview)}>
                Usar este template
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
