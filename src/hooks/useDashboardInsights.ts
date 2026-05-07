// R115 F3: hook que consulta as 13 RPCs do dashboard insights em paralelo.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface KpisResumo {
  total_conversas: number
  total_vendas: number
  total_cotacoes: number
  total_handoffs: number
  total_objecoes: number
  taxa_conversao_pct: number | null
  taxa_handoff_pct: number | null
}

export interface TopListItem {
  label: string
  qty: number
  pct?: number
  meta?: string
}

export interface SlaSemRespostaItem {
  conversation_id: string
  contact_name: string
  contact_phone: string
  primeira_msg: string
  minutos_sem_resposta: number
  status_ia: string
}

export interface VendasPorVendedorItem {
  seller_id: string | null
  seller_name: string
  vendas: number
}

export interface CotacoesData {
  total_cotacoes: number
  com_handoff: number
  fechadas: number
}

export interface ConversaoOrcamentoVenda {
  total_cotacoes: number
  fechadas: number
  taxa_conversao_pct: number | null
}

export interface DashboardInsights {
  kpis: KpisResumo | null
  produtos_citados: TopListItem[]
  marcas_citadas: TopListItem[]
  objecoes: TopListItem[]
  pagamentos: TopListItem[]
  tipos_cliente: TopListItem[]
  produtos_em_falta: TopListItem[]
  marcas_nao_trabalhadas: TopListItem[]
  excluded_match: TopListItem[]
  vendas_por_vendedor: VendasPorVendedorItem[]
  cotacoes: CotacoesData | null
  conversao: ConversaoOrcamentoVenda | null
  sla_sem_resposta: SlaSemRespostaItem[]
}

const EMPTY: DashboardInsights = {
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

export function useDashboardInsights(instanceId: string | null, periodDays = 30) {
  return useQuery({
    queryKey: ['dashboard-insights', instanceId, periodDays],
    enabled: !!instanceId,
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardInsights> => {
      if (!instanceId) return EMPTY
      const since = new Date(Date.now() - periodDays * 86400000).toISOString()
      const params = { p_instance_id: instanceId, p_since: since }

      const [
        kpisRes,
        produtosRes,
        marcasRes,
        objecoesRes,
        pagamentosRes,
        tiposRes,
        faltaRes,
        marcasNaoRes,
        excludedRes,
        vendedoresRes,
        cotacoesRes,
        conversaoRes,
        slaRes,
      ] = await Promise.all([
        supabase.rpc('dash_kpis_resumo', params),
        supabase.rpc('dash_top_produtos_citados', params),
        supabase.rpc('dash_top_marcas_citadas', params),
        supabase.rpc('dash_top_objecoes', params),
        supabase.rpc('dash_top_pagamentos', params),
        supabase.rpc('dash_top_tipos_cliente', params),
        supabase.rpc('dash_produtos_em_falta', params),
        supabase.rpc('dash_marcas_nao_trabalhadas', params),
        supabase.rpc('dash_excluded_match', params),
        supabase.rpc('dash_vendas_por_vendedor', params),
        supabase.rpc('dash_cotacoes', params),
        supabase.rpc('dash_conversao_orcamento_venda', params),
        supabase.rpc('dash_sla_sem_resposta', { p_instance_id: instanceId, p_threshold_in_minutes: 30 }),
      ])

      const mapTop = (rows: any[] | null, labelKey: string, withPct = false): TopListItem[] =>
        (rows || []).map(r => ({
          label: String(r[labelKey] ?? ''),
          qty: Number(r.qty ?? 0),
          pct: withPct ? Number(r.pct ?? 0) : undefined,
          meta: r.ultima_em ? String(r.ultima_em) : undefined,
        }))

      return {
        kpis: kpisRes.data?.[0] ?? null,
        produtos_citados: mapTop(produtosRes.data, 'query'),
        marcas_citadas: mapTop(marcasRes.data, 'marca'),
        objecoes: mapTop(objecoesRes.data, 'objecao'),
        pagamentos: mapTop(pagamentosRes.data, 'metodo', true),
        tipos_cliente: mapTop(tiposRes.data, 'profissao', true),
        produtos_em_falta: mapTop(faltaRes.data, 'query'),
        marcas_nao_trabalhadas: mapTop(marcasNaoRes.data, 'marca'),
        excluded_match: mapTop(excludedRes.data, 'keyword'),
        vendas_por_vendedor: (vendedoresRes.data ?? []) as VendasPorVendedorItem[],
        cotacoes: cotacoesRes.data?.[0] ?? null,
        conversao: conversaoRes.data?.[0] ?? null,
        sla_sem_resposta: (slaRes.data ?? []) as SlaSemRespostaItem[],
      }
    },
  })
}
