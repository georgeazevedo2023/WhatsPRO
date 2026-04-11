import { Badge } from '@/components/ui/badge'
import type { FlowMode } from '@/types/flows'
import { cn } from '@/lib/utils'

interface FlowModeBadgeProps {
  mode: FlowMode | string
  className?: string
}

const MODE_CONFIG: Record<FlowMode, { label: string; className: string }> = {
  active: {
    label: 'IA Ativa',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  assistant: {
    label: 'Assistente',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  shadow: {
    label: 'Shadow',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  off: {
    label: 'Desligado',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
}

export function FlowModeBadge({ mode, className }: FlowModeBadgeProps) {
  const config = MODE_CONFIG[mode as FlowMode] ?? {
    label: mode,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
