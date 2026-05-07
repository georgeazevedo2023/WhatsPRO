// R115 F3: aba Insights do ManagerDashboard — 13 widgets
import {
  ShoppingBag, Tag, AlertOctagon, CreditCard, HardHat,
  PackageX, BadgeX, Ban, FileSpreadsheet,
} from 'lucide-react'
import { useDashboardInsights } from '@/hooks/useDashboardInsights'
import TopListCard from './TopListCard'
import InsightsKpiRow from './InsightsKpiRow'
import SlaAlertList from './SlaAlertList'
import VendedoresRanking from './VendedoresRanking'

interface InsightsTabProps {
  instanceId: string | null
  periodDays: number
}

export default function InsightsTab({ instanceId, periodDays }: InsightsTabProps) {
  const { data, isLoading } = useDashboardInsights(instanceId, periodDays)

  const insights = data ?? {
    kpis: null,
    produtos_citados: [],
    marcas_citadas: [],
    objecoes: [],
    pagamentos: [],
    tipos_cliente: [],
    produtos_em_falta: [],
    marcas_nao_trabalhadas: [],
    excluded_match: [],
    vendas_por_vendedor: [],
    cotacoes: null,
    conversao: null,
    sla_sem_resposta: [],
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs principais */}
      <InsightsKpiRow
        kpis={insights.kpis}
        cotacoes={insights.cotacoes}
        conversao={insights.conversao}
        isLoading={isLoading}
      />

      {/* Linha 1: SLA + Vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SlaAlertList items={insights.sla_sem_resposta} isLoading={isLoading} />
        <VendedoresRanking items={insights.vendas_por_vendedor} isLoading={isLoading} />
      </div>

      {/* Linha 2: Top demandas (3 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <TopListCard
          title="Produtos mais perguntados"
          description="search_products do AI Agent"
          icon={ShoppingBag}
          items={insights.produtos_citados}
          isLoading={isLoading}
          topN={8}
        />
        <TopListCard
          title="Marcas mais citadas"
          description="Detectadas em msgs do lead"
          icon={Tag}
          items={insights.marcas_citadas}
          isLoading={isLoading}
        />
        <TopListCard
          title="Tipo de cliente"
          description="Profissão identificada (sou pintor, eletricista, etc)"
          icon={HardHat}
          items={insights.tipos_cliente}
          isLoading={isLoading}
          showPct
        />
      </div>

      {/* Linha 3: Comportamento + pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <TopListCard
          title="Top objeções"
          description="Motivos de hesitação detectados"
          icon={AlertOctagon}
          items={insights.objecoes}
          isLoading={isLoading}
          formatLabel={(s) => s.replace(/_/g, ' ')}
        />
        <TopListCard
          title="Forma de pagamento preferida"
          description="Intenção declarada (não consultas)"
          icon={CreditCard}
          items={insights.pagamentos}
          isLoading={isLoading}
          showPct
        />
        <TopListCard
          title="Produtos em falta"
          description="search_products que retornou vazio"
          icon={PackageX}
          items={insights.produtos_em_falta}
          isLoading={isLoading}
        />
      </div>

      {/* Linha 4: Catálogo gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <TopListCard
          title="Marcas não trabalhadas"
          description="Lead pediu, loja não tem"
          icon={BadgeX}
          items={insights.marcas_nao_trabalhadas}
          isLoading={isLoading}
        />
        <TopListCard
          title="Produtos fora de escopo"
          description="Match em excluded_products"
          icon={Ban}
          items={insights.excluded_match}
          isLoading={isLoading}
          formatLabel={(s) => s.replace(/_/g, ' ')}
        />
        <TopListCard
          title="Cotações"
          description={`${insights.cotacoes?.total_cotacoes ?? 0} pedidos · ${insights.cotacoes?.fechadas ?? 0} fecharam`}
          icon={FileSpreadsheet}
          items={
            insights.cotacoes
              ? [
                  { label: 'Total cotações', qty: insights.cotacoes.total_cotacoes },
                  { label: 'Foram pra atendente', qty: insights.cotacoes.com_handoff },
                  { label: 'Viraram venda', qty: insights.cotacoes.fechadas },
                ]
              : []
          }
          isLoading={isLoading}
          topN={3}
        />
      </div>
    </div>
  )
}
