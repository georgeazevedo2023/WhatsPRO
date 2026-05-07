// R115 F3: linha de KPIs principais derivados de dash_kpis_resumo + dash_cotacoes/conversao
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, ShoppingCart, FileText, UserCheck, AlertCircle, Percent } from 'lucide-react'
import type { KpisResumo, CotacoesData, ConversaoOrcamentoVenda } from '@/hooks/useDashboardInsights'

interface InsightsKpiRowProps {
  kpis: KpisResumo | null
  cotacoes: CotacoesData | null
  conversao: ConversaoOrcamentoVenda | null
  isLoading?: boolean
}

interface Kpi {
  label: string
  value: string | number
  icon: typeof TrendingUp
  hint?: string
  tone?: 'default' | 'success' | 'warning'
}

export default function InsightsKpiRow({ kpis, cotacoes, conversao, isLoading }: InsightsKpiRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  const items: Kpi[] = [
    { label: 'Conversas', value: kpis?.total_conversas ?? 0, icon: TrendingUp },
    { label: 'Vendas fechadas', value: kpis?.total_vendas ?? 0, icon: ShoppingCart, tone: 'success' },
    { label: 'Cotações', value: kpis?.total_cotacoes ?? cotacoes?.total_cotacoes ?? 0, icon: FileText },
    { label: 'Handoffs', value: kpis?.total_handoffs ?? 0, icon: UserCheck },
    { label: 'Objeções', value: kpis?.total_objecoes ?? 0, icon: AlertCircle, tone: 'warning' },
    {
      label: 'Conv. orçamento→venda',
      value: conversao?.taxa_conversao_pct != null ? `${conversao.taxa_conversao_pct}%` : '—',
      icon: Percent,
      hint: conversao ? `${conversao.fechadas}/${conversao.total_cotacoes}` : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map(it => {
        const Icon = it.icon
        const toneClass =
          it.tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
          it.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
          'text-primary'
        return (
          <Card key={it.label}>
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Icon className={`w-3 h-3 ${toneClass}`} />
                <span>{it.label}</span>
              </div>
              <div className={`text-lg font-display font-bold ${toneClass}`}>{it.value}</div>
              {it.hint && <div className="text-[10px] text-muted-foreground">{it.hint}</div>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
