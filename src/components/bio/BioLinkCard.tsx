import { Copy, Edit2, ExternalLink, MoreVertical, Trash2, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import type { BioPage } from '@/types/bio'
import { buildBioPageUrl } from '@/hooks/useBioPages'

interface BioLinkCardProps {
  page: BioPage
  onEdit: (id: string) => void
  onDelete: (page: BioPage) => void
  onToggleStatus: (page: BioPage) => void
}

const STATUS_CONFIG = {
  active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  draft: { label: 'Rascunho', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  archived: { label: 'Arquivado', className: 'bg-muted text-muted-foreground border-border' },
}

const TEMPLATE_LABELS = {
  simples: 'Simples',
  shopping: 'Shopping',
  negocio: 'Negócio',
}

export function BioLinkCard({ page, onEdit, onDelete, onToggleStatus }: BioLinkCardProps) {
  const { toast } = useToast()
  const publicUrl = buildBioPageUrl(page.slug)
  const statusConfig = STATUS_CONFIG[page.status]

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl)
    toast({ description: 'Link copiado!' })
  }

  return (
    <div
      className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.99]"
      style={{ borderLeftWidth: 4, borderLeftColor: page.bg_color }}
      onClick={() => onEdit(page.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar mini */}
          <div
            className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: page.bg_color }}
          >
            {page.avatar_url ? (
              <img src={page.avatar_url} alt={page.title} className="w-full h-full rounded-lg object-contain" />
            ) : (
              page.title.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{page.title}</p>
            <p className="text-xs text-muted-foreground truncate">/bio/{page.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyUrl} title="Copiar link">
            <Copy size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(publicUrl, '_blank')}
            title="Abrir página"
          >
            <ExternalLink size={13} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical size={13} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(page.id)}>
                <Edit2 size={14} className="mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStatus(page)}>
                <Archive size={14} className="mr-2" />
                {page.status === 'archived' ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(page)}
              >
                <Trash2 size={14} className="mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {TEMPLATE_LABELS[page.template]}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {page.view_count.toLocaleString('pt-BR')} views
        </span>
      </div>
    </div>
  )
}
