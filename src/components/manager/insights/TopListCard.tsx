// R115 F3: card reutilizável de top-N (label + qty + bar opcional)
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LucideIcon } from 'lucide-react'
import type { TopListItem } from '@/hooks/useDashboardInsights'

interface TopListCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  items: TopListItem[]
  isLoading?: boolean
  emptyText?: string
  showPct?: boolean
  topN?: number
  formatLabel?: (label: string) => string
}

export default function TopListCard({
  title,
  description,
  icon: Icon,
  items,
  isLoading,
  emptyText = 'Sem dados no período',
  showPct = false,
  topN = 5,
  formatLabel,
}: TopListCardProps) {
  const visible = items.slice(0, topN)
  const max = visible.reduce((m, i) => Math.max(m, i.qty), 1)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
            <CardTitle className="text-sm font-display font-semibold">{title}</CardTitle>
          </div>
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((item, idx) => {
              const widthPct = (item.qty / max) * 100
              const display = formatLabel ? formatLabel(item.label) : item.label
              return (
                <li key={`${item.label}-${idx}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1 capitalize" title={display}>{display}</span>
                    <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                      {item.qty}
                      {showPct && item.pct != null && <span className="ml-1 text-[10px]">({item.pct}%)</span>}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary/40 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              )
            })}
            {items.length > topN && (
              <li className="pt-1 text-[10px] text-muted-foreground italic text-center">
                + {items.length - topN} outros
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
