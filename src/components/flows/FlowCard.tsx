import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreVertical, Zap, Layers, Circle, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FlowModeBadge } from './FlowModeBadge'
import type { FlowWithCounts } from '@/types/flows'

interface FlowCardProps {
  flow: FlowWithCounts
  onPublish?: (id: string) => void
  onPause?: (id: string) => void
  onDuplicate?: (id: string) => void
  onArchive?: (id: string) => void
}

export function FlowCard({ flow, onPublish, onPause, onDuplicate, onArchive }: FlowCardProps) {
  const navigate = useNavigate()
  const isPublished = !!flow.published_at
  const isDraft = !isPublished || flow.status === 'paused'

  const publishedLabel = flow.published_at
    ? `Publicado ${formatDistanceToNow(new Date(flow.published_at), { addSuffix: true, locale: ptBR })}`
    : 'Rascunho'

  return (
    <div
      className={`relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        flow.mode === 'shadow' ? 'border-yellow-300 ring-1 ring-yellow-200' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <FlowModeBadge mode={flow.mode} />
          {isDraft && (
            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
              Rascunho
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Circle
            className={`h-2 w-2 fill-current ${isPublished && flow.status === 'active' ? 'text-green-500' : 'text-gray-300'}`}
          />
          <span className="text-xs text-muted-foreground">{publishedLabel}</span>
        </div>
      </div>

      {/* Title + description */}
      <h3 className="font-semibold text-sm mb-1 truncate">{flow.name}</h3>
      {flow.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{flow.description}</p>
      )}

      {/* Counters */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {flow.trigger_count} {flow.trigger_count === 1 ? 'gatilho' : 'gatilhos'}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {flow.step_count} {flow.step_count === 1 ? 'step' : 'steps'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => navigate(`/dashboard/flows/${flow.id}`)}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Editar
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/dashboard/flows/${flow.id}`)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate?.(flow.id)}>
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {flow.status !== 'active' || !isPublished ? (
              <DropdownMenuItem onClick={() => onPublish?.(flow.id)}>
                Publicar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onPause?.(flow.id)}>
                Pausar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onArchive?.(flow.id)}
            >
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
