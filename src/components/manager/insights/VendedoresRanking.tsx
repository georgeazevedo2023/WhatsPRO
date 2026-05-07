// R115 F3: ranking de vendedores por venda fechada
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Award } from 'lucide-react'
import type { VendasPorVendedorItem } from '@/hooks/useDashboardInsights'

interface VendedoresRankingProps {
  items: VendasPorVendedorItem[]
  isLoading?: boolean
}

export default function VendedoresRanking({ items, isLoading }: VendedoresRankingProps) {
  const max = items.reduce((m, i) => Math.max(m, i.vendas), 1)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-display font-semibold">Vendas por vendedor</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Conversas com tag <code className="text-[10px]">venda:fechada</code> agrupadas por atribuído
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Sem vendas fechadas no período
          </p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 8).map((item, idx) => {
              const widthPct = (item.vendas / max) * 100
              return (
                <li key={item.seller_id || `none-${idx}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1" title={item.seller_name}>
                      {idx === 0 && '🥇 '}
                      {idx === 1 && '🥈 '}
                      {idx === 2 && '🥉 '}
                      {item.seller_name}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                      {item.vendas}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary/40 overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${widthPct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
