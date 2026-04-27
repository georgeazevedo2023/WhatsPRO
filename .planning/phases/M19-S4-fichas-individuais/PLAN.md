# M19 S4 — Fichas Individuais do Dashboard do Gestor

**Sprint:** S4 do Milestone 19 (Metricas & IA Conversacional)
**Dependencias:** S2 (views SQL) + S3 (ManagerDashboard base)
**Resultado:** 4 fichas de detalhe + metas configuraveis em `/dashboard/gestao`
**Estimativa total:** ~7 planos, execucao sequencial (Plano 1 e obrigatorio antes de todos)

---

## Plano 1 — Infraestrutura: Correcao de View + Tabela de Metas

**Wave:** 1 (pre-requisito de todos os demais planos)
**Arquivos criados:**
- `supabase/migrations/20260418000001_s4_fix_handoff_view_and_goals.sql`

**Contexto:**
A view `v_handoff_details` do S2 filtra `WHERE al.event = 'handoff_to_human'`, mas o ai-agent insere `event: 'handoff'` (linha 2282 do index.ts). A view retorna ZERO linhas em producao. Alem disso, a tabela `instance_goals` nao existe e precisa ser criada para o sistema de metas.

### Task 1.1 — Migration: Corrigir v_handoff_details + criar instance_goals

**Arquivo:** `supabase/migrations/20260418000001_s4_fix_handoff_view_and_goals.sql`

**Acao:**

Criar migration SQL com duas partes:

**Parte A — Corrigir v_handoff_details:**

```sql
CREATE OR REPLACE VIEW v_handoff_details
  WITH (security_barrier = true)
AS
SELECT
  ib.instance_id,
  al.conversation_id,
  conv.assigned_to                                            AS seller_id,
  al.created_at                                               AS handoff_at,
  conv.created_at                                             AS conversation_started_at,
  ROUND(
    EXTRACT(EPOCH FROM (al.created_at - conv.created_at)) / 60, 1
  )                                                           AS minutes_before_handoff,
  al.metadata->>'reason'                                      AS handoff_reason,
  al.metadata->>'trigger'                                     AS handoff_trigger,
  -- NOVO: campo evitavel calculado
  CASE
    WHEN al.metadata->>'trigger' IN ('lead_asked', 'buy_confirm', 'lead_request')
    THEN false
    ELSE true
  END                                                         AS evitavel,
  CASE
    WHEN conv.status = 'resolved'
    THEN ROUND(
      EXTRACT(EPOCH FROM (conv.updated_at - al.created_at)) / 60, 1
    )
  END                                                         AS minutes_to_resolve_after_handoff,
  conv.status                                                 AS conversation_status,
  -- NOVO: campo converteu (resolved = considerado convertido)
  CASE WHEN conv.status = 'resolved' THEN true ELSE false END AS converteu
FROM ai_agent_logs al
JOIN conversations conv ON conv.id = al.conversation_id
JOIN inboxes ib ON ib.id = conv.inbox_id
-- CORRIGIDO: event pode ser 'handoff', 'handoff_to_human' ou 'handoff_trigger'
WHERE al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger');
```

**Parte B — Corrigir v_agent_performance (mesmo bug de event name):**

A view `v_agent_performance` tambem conta handoffs com `COUNT(CASE WHEN al.event = 'handoff_to_human' THEN 1 END)`. Corrigir para contar os mesmos events:

```sql
CREATE OR REPLACE VIEW v_agent_performance
  WITH (security_barrier = true)
AS
SELECT
  ag.instance_id,
  DATE(al.created_at)                                                              AS activity_date,
  COUNT(CASE WHEN al.event = 'response_sent' THEN 1 END)                          AS responses_sent,
  COUNT(CASE WHEN al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger') THEN 1 END) AS handoffs,
  COUNT(CASE WHEN al.event = 'error' THEN 1 END)                                  AS errors,
  COUNT(CASE WHEN al.event LIKE 'shadow_%' THEN 1 END)                            AS shadow_events,
  COUNT(CASE WHEN al.event = 'shadow_skipped_trivial' THEN 1 END)                 AS shadow_skipped,
  COALESCE(SUM(al.input_tokens + al.output_tokens), 0)                            AS total_tokens,
  ROUND(AVG(CASE WHEN al.event = 'response_sent' THEN al.latency_ms END)::NUMERIC, 0)
                                                                                   AS avg_response_latency_ms,
  ROUND(
    COALESCE(SUM(al.input_tokens * 0.0000004 + al.output_tokens * 0.0000016), 0)::NUMERIC, 6
  )                                                                                AS cost_usd_approx
FROM ai_agent_logs al
JOIN ai_agents ag ON ag.id = al.agent_id
GROUP BY ag.instance_id, DATE(al.created_at);
```

**Parte C — Criar tabela instance_goals:**

```sql
CREATE TABLE public.instance_goals (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  TEXT         NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  metric_key   TEXT         NOT NULL
    CHECK (metric_key IN ('conversion_rate', 'nps_avg', 'handoff_rate', 'response_time_min', 'ia_cost_usd', 'avg_ticket')),
  target_value NUMERIC      NOT NULL,
  period       TEXT         NOT NULL DEFAULT 'monthly'
    CHECK (period IN ('daily', 'weekly', 'monthly')),
  created_by   UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (instance_id, metric_key, period)
);

CREATE INDEX idx_instance_goals_instance ON public.instance_goals(instance_id);

-- RLS: super_admin pode tudo, gerente pode ler
ALTER TABLE public.instance_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages goals"
  ON public.instance_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Gerente reads goals"
  ON public.instance_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('super_admin', 'gerente')
    )
  );

-- Trigger updated_at
CREATE TRIGGER set_instance_goals_updated_at
  BEFORE UPDATE ON public.instance_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**Parte D — Corrigir v_ia_vs_vendor (depende de v_agent_performance):**

A view `v_ia_vs_vendor` herda de `v_agent_performance` via JOIN, entao a correcao da view base ja propaga. Nada adicional necessario.

**Verificacao:**

```bash
# 1. Aplicar migration localmente
npx supabase db reset  # ou aplicar migration via supabase migration up

# 2. Verificar que a view retorna dados (se houver ai_agent_logs com event='handoff')
# Em SQL: SELECT count(*) FROM v_handoff_details; -- deve ser > 0

# 3. Verificar tabela instance_goals existe
# Em SQL: SELECT * FROM instance_goals LIMIT 1; -- deve retornar 0 rows sem erro

# 4. tsc 0 erros (migration nao afeta TS, mas verificar que nada quebrou)
npx tsc --noEmit
```

**Criterio de conclusao:**
- Migration criada e aplicavel sem erros
- `v_handoff_details` retorna linhas para events `handoff` + `handoff_to_human` + `handoff_trigger`
- `v_handoff_details` tem campos `evitavel` (boolean) e `converteu` (boolean)
- `v_agent_performance` conta handoffs corretamente
- `instance_goals` existe com RLS, CHECK constraints e trigger updated_at
- `tsc --noEmit` = 0 erros

---

## Plano 2 — Ficha Vendedor (hook + pagina + drill-down)

**Wave:** 2 (depende de Plano 1 para metas)
**Arquivos criados:**
- `src/hooks/useManagerInstances.ts` (extraído de ManagerDashboard)
- `src/hooks/useVendorDetail.ts`
- `src/pages/dashboard/gestao/VendorDetailPage.tsx`
- `src/components/gestao/VendorKPICards.tsx`
- `src/components/gestao/VendorTrendChart.tsx`

**Arquivos editados:**
- `src/pages/dashboard/ManagerDashboard.tsx` (importar useManagerInstances do novo arquivo)
- `src/components/manager/SellerRankingChart.tsx` (adicionar drill-down click)

**Contexto:**
A ficha do vendedor e acessada via drill-down no `SellerRankingChart` do dashboard principal. Mostra KPIs individuais (conversas, resolucao, tempo medio, NPS, ticket medio) com evolucao temporal.

### Task 2.1 — Hook useVendorDetail

**Arquivo:** `src/hooks/useVendorDetail.ts`

**Acao:**

Criar hook `useVendorDetail(sellerId: string | null, instanceId: string | null, periodDays: number)` seguindo o padrao de `useManagerMetrics`:

```typescript
// Interfaces a exportar:
export interface VendorKPIs {
  conversations: number;
  resolved: number;
  resolutionRate: number;
  avgResolutionMin: number;
  npsAvg: number;
  avgTicket: number;
  pendingCount: number;
  uniqueContacts: number;
}

export interface VendorTrendDay {
  date: string;
  conversations: number;
  resolved: number;
  avgResolutionMin: number;
}

export interface VendorDetail {
  kpis: VendorKPIs;
  trend: VendorTrendDay[];
}
```

**Queries (Promise.all):**

1. `v_vendor_activity` filtrado por `seller_id` e `instance_id` e `activity_date >= since` — retorna linhas diarias. Agregar para KPIs e trend.

2. NPS por vendedor: buscar `poll_messages` com `is_nps=true` e `instance_id`, depois cruzar `poll_responses` com `conversations.assigned_to = sellerId`. Sequencia:
   - Buscar conversations do vendedor: `conversations.assigned_to = sellerId` com `inbox_id` em inboxes da instancia
   - Buscar poll_messages NPS nessas conversations
   - Buscar poll_responses para esses poll_messages
   - Calcular media NPS (mesmo padrao NPS_SCORES do useManagerMetrics)

3. Ticket medio: `v_lead_metrics` filtrado por instance_id, depois filtrar leads cujas conversations tem `assigned_to = sellerId`. Calcular `AVG(average_ticket)` no JS (pode ser null para muitos leads — mostrar `--` se < 3 leads com ticket).

**Parametros:** `useQuery` com `queryKey: ['vendor-detail', sellerId, instanceId, periodDays]`, `enabled: !!sellerId && !!instanceId`, `staleTime: 60_000`.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Hook exporta `VendorKPIs`, `VendorTrendDay`, `VendorDetail`
- Promise.all com 3 queries paralelas (vendor_activity + NPS + ticket medio)
- `enabled` = false quando sellerId ou instanceId sao null
- Sem `any` desnecessario (usar `as any` SOMENTE para views nao tipadas, com comentario)

### Task 2.2 — VendorKPICards + VendorTrendChart

**Arquivos:**
- `src/components/gestao/VendorKPICards.tsx`
- `src/components/gestao/VendorTrendChart.tsx`

**Acao:**

**VendorKPICards** — Grid de 6 StatsCards (reutilizar `StatsCard` de `src/components/dashboard/StatsCard.tsx`):

```
| Conversas | Resolvidas | Taxa Resolucao | Tempo Medio | NPS | Ticket Medio |
```

Props: `kpis: VendorKPIs`, `periodDays: number`. Seguir EXATAMENTE o padrao de `ManagerKPICards.tsx`:
- Usar `memo`
- Icones: `MessageSquare`, `CheckCircle2`, `Percent`, `Clock`, `Star`, `DollarSign`
- NPS: mostrar `--` se 0
- Ticket medio: mostrar `R$ X` ou `--` se 0

**VendorTrendChart** — LineChart (Recharts) com evolucao diaria:
- Eixo X: data
- Duas linhas: conversas (azul) e resolvidas (verde)
- Tooltip com os 3 valores (conversations, resolved, avgResolutionMin)
- Seguir padrao de `LeadsTrendChart.tsx` (mesma estrutura de Card + ResponsiveContainer + LineChart)
- Props: `data: VendorTrendDay[]`
- Empty state: "Nenhum dado ainda" (mesmo padrao de SellerRankingChart)

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- VendorKPICards renderiza 6 StatsCards com dados do vendedor
- VendorTrendChart renderiza LineChart com evolucao diaria
- Ambos com empty state quando dados vazios
- Sem dependencia de dados mock

### Task 2.3 — VendorDetailPage + drill-down no SellerRankingChart

**Arquivos:**
- `src/pages/dashboard/gestao/VendorDetailPage.tsx`
- `src/components/manager/SellerRankingChart.tsx` (editar)

**Acao:**

**VendorDetailPage:**

Criar pagina seguindo o layout de `ManagerDashboard.tsx`:

```tsx
// Importar:
import { useParams, useNavigate } from 'react-router-dom';
import { useVendorDetail } from '@/hooks/useVendorDetail';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import ManagerFilters from '@/components/manager/ManagerFilters';
import VendorKPICards from '@/components/gestao/VendorKPICards';
import VendorTrendChart from '@/components/gestao/VendorTrendChart';
import LazySection from '@/components/dashboard/LazySection';

// Logica:
// 1. `useParams<{ sellerId: string }>()` para obter sellerId da URL
// 2. `useUserProfiles({ userIds: [sellerId] })` para nome do vendedor
// 3. Reutilizar useManagerInstances (extrair de ManagerDashboard para um hook compartilhado ou copiar)
// 4. Filtros: instanceId + periodDays (mesmo ManagerFilters)
// 5. `useVendorDetail(sellerId, instanceId, periodDays)`

// Layout:
// - Header: icone User + "Ficha: {vendorName}" + botao Voltar (navigate(-1))
// - ManagerFilters (instancia + periodo)
// - VendorKPICards
// - VendorTrendChart (LazySection)
```

**NOTA:** O hook `useManagerInstances` esta definido inline dentro de `ManagerDashboard.tsx`. Extrair para `src/hooks/useManagerInstances.ts` como hook compartilhado, e importar em AMBOS os arquivos (ManagerDashboard e VendorDetailPage). Isso e uma mini-refatoracao necessaria.

**Arquivo extra:** `src/hooks/useManagerInstances.ts`

```typescript
// Mover de ManagerDashboard.tsx para arquivo proprio
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useManagerInstances() {
  return useQuery({
    queryKey: ['manager-instances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instances')
        .select('id, name, status')
        .eq('disabled', false)
        .order('name');
      return (data || []) as { id: string; name: string; status: string }[];
    },
    staleTime: 300_000,
  });
}
```

Atualizar `ManagerDashboard.tsx` para importar de `useManagerInstances` em vez de definir inline.

**SellerRankingChart — Adicionar drill-down:**

Editar `src/components/manager/SellerRankingChart.tsx`:
1. Adicionar `import { useNavigate } from 'react-router-dom';`
2. Dentro do componente: `const navigate = useNavigate();`
3. No `div` de cada seller, adicionar `onClick={() => navigate('/dashboard/gestao/vendedor/' + seller.sellerId)}` e `className="cursor-pointer hover:bg-primary/10 transition-colors"` (adicionar ao className existente)
4. Nao mudar a estrutura visual — apenas tornar clicavel

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- VendorDetailPage renderiza ficha completa do vendedor com KPIs e grafico
- `useManagerInstances` extraido como hook compartilhado
- ManagerDashboard continua funcionando normalmente apos refatoracao
- Click no SellerRankingChart navega para `/dashboard/gestao/vendedor/{id}`
- Pagina mostra nome do vendedor resolvido via useUserProfiles

---

## Plano 3 — Ficha Agente IA (hook + pagina + graficos)

**Wave:** 2 (paralelo com Plano 2, depende de Plano 1 para metas)
**Arquivos criados:**
- `src/hooks/useAgentDetail.ts`
- `src/pages/dashboard/gestao/AgentDetailPage.tsx`
- `src/components/gestao/AgentKPICards.tsx`
- `src/components/gestao/AgentCostChart.tsx`
- `src/components/gestao/AgentFollowUpStats.tsx`

**Contexto:**
A ficha do Agente IA mostra performance agregada: custo, latencia, cobertura, handoff rate, follow-up stats. Dados vem de `v_agent_performance` + `follow_up_executions`. Produtos/marcas buscados NAO estao logados no DB — omitir no MVP (tocar ai-agent e HIGH RISK).

### Task 3.1 — Hook useAgentDetail

**Arquivo:** `src/hooks/useAgentDetail.ts`

**Acao:**

Criar hook `useAgentDetail(instanceId: string | null, periodDays: number)`:

```typescript
export interface AgentKPIs {
  totalResponses: number;
  totalHandoffs: number;
  coveragePct: number;          // responses / (responses + handoffs) * 100
  avgLatencyMs: number;
  totalCostUsd: number;
  costPerConversation: number;  // totalCost / (responses + handoffs)
  totalErrors: number;
  shadowEvents: number;
  followUpsSent: number;
  followUpRepliedPct: number;   // replied / sent * 100
}

export interface AgentTrendDay {
  date: string;
  responses: number;
  handoffs: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AgentDetail {
  kpis: AgentKPIs;
  trend: AgentTrendDay[];
}
```

**Queries (Promise.all):**

1. `v_agent_performance` filtrado por `instance_id` e `activity_date >= since`:
   - Agregar para KPIs: SUM responses_sent, handoffs, errors, shadow_events, cost_usd_approx
   - Para trend: mapear por activity_date

2. `follow_up_executions` filtrado por `instance_id` e `sent_at >= since`:
   - Contar total de follow-ups enviados (`status` = 'sent' ou 'replied')
   - Contar quantos tiveram `status = 'replied'`
   - Calcular taxa de resposta

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Hook retorna AgentKPIs + trend diario
- Follow-up stats calculados corretamente
- Sem tocar ai-agent/index.ts (HIGH RISK)

### Task 3.2 — AgentKPICards + AgentCostChart + AgentFollowUpStats

**Arquivos:**
- `src/components/gestao/AgentKPICards.tsx`
- `src/components/gestao/AgentCostChart.tsx`
- `src/components/gestao/AgentFollowUpStats.tsx`

**Acao:**

**AgentKPICards** — Grid de 6 StatsCards (mesmo padrao ManagerKPICards):

```
| Respostas IA | Handoffs | Cobertura IA | Latencia Media | Custo Total | Custo/Conversa |
```

Props: `kpis: AgentKPIs`, `periodDays: number`. Icones: `Bot`, `ArrowRightLeft`, `Shield`, `Zap`, `DollarSign`, `Calculator`.

**AgentCostChart** — AreaChart (Recharts) com custo acumulado por dia:
- Eixo X: data
- Area preenchida (cor verde claro) com custo diario
- Linha de custo acumulado sobreposicao (opcional — ou usar apenas area diaria)
- Props: `data: AgentTrendDay[]`
- Tooltip: custo USD, responses, handoffs, latencia

**AgentFollowUpStats** — Card com 3 metricas:
- Follow-ups enviados (numero)
- Taxa de resposta (% com barra visual)
- Empty state se 0 follow-ups
- Props: `sent: number, repliedPct: number`
- Layout: Card com 2 valores inline + barra de progresso para taxa

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- 3 componentes renderizam corretamente com props tipadas
- AreaChart funcional com Recharts
- Follow-up stats com barra de progresso visual

### Task 3.3 — AgentDetailPage

**Arquivo:** `src/pages/dashboard/gestao/AgentDetailPage.tsx`

**Acao:**

Criar pagina seguindo layout de ManagerDashboard:

```
Header: icone Bot + "Ficha Agente IA" + Botao Voltar
ManagerFilters (instancia + periodo) — usar useManagerInstances compartilhado
AgentKPICards (6 cards)
Grid 2 colunas:
  - AgentCostChart (LazySection)
  - AgentFollowUpStats (LazySection)
```

- Importar e usar `useAgentDetail(instanceId, periodDays)`
- Seguir padrao de loading/skeleton de ManagerDashboard
- Botao Voltar: `navigate('/dashboard/gestao')`

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Pagina exibe metricas completas do agente IA
- Follow-up stats visivel
- Loading state com Skeleton
- Empty state se sem instancia selecionada

---

## Plano 4 — Painel Transbordo (hook + pagina + graficos)

**Wave:** 2 (paralelo com Planos 2 e 3, depende de Plano 1 para view corrigida)
**Arquivos criados:**
- `src/hooks/useHandoffMetrics.ts`
- `src/pages/dashboard/gestao/HandoffDetailPage.tsx`
- `src/components/gestao/HandoffKPICards.tsx`
- `src/components/gestao/HandoffMotivosChart.tsx`
- `src/components/gestao/HandoffEvitavelChart.tsx`
- `src/components/gestao/HandoffRecentTable.tsx`

**Contexto:**
O painel de transbordo depende criticamente da view `v_handoff_details` corrigida no Plano 1. Mostra motivos de transbordo, classificacao evitavel/necessario, conversao pos-transbordo, e lista de handoffs recentes.

### Task 4.1 — Hook useHandoffMetrics

**Arquivo:** `src/hooks/useHandoffMetrics.ts`

**Acao:**

Criar hook `useHandoffMetrics(instanceId: string | null, periodDays: number)`:

```typescript
export interface HandoffKPIs {
  totalHandoffs: number;
  evitavelCount: number;
  evitavelPct: number;
  necessarioCount: number;
  converteuCount: number;
  converteuPct: number;           // converteu / total * 100
  avgMinutesBeforeHandoff: number;
  avgMinutesToResolve: number;    // apenas resolvidos
}

export interface HandoffByMotivo {
  reason: string;
  count: number;
  pct: number;
}

export interface HandoffByTrigger {
  trigger: string;
  count: number;
  evitavelCount: number;
}

export interface HandoffRow {
  conversationId: string;
  sellerId: string | null;
  handoffAt: string;
  reason: string | null;
  trigger: string | null;
  evitavel: boolean;
  converteu: boolean;
  minutesBeforeHandoff: number | null;
  minutesToResolve: number | null;
  status: string;
}

export interface HandoffMetrics {
  kpis: HandoffKPIs;
  byMotivo: HandoffByMotivo[];
  byTrigger: HandoffByTrigger[];
  recentRows: HandoffRow[];
}
```

**Query unica:**

Buscar `v_handoff_details` filtrado por `instance_id` e `handoff_at >= since`. Toda a agregacao (KPIs, motivos, triggers) e feita no JS sobre o array retornado:

1. **KPIs:** contar total, evitavel=true, converteu=true, AVG minutes_before_handoff, AVG minutes_to_resolve_after_handoff (apenas onde != null)

2. **byMotivo:** `GROUP BY handoff_reason` no JS, calcular count e pct

3. **byTrigger:** `GROUP BY handoff_trigger` no JS, contar evitaveis por trigger

4. **recentRows:** ultimos 20 handoffs ordenados por handoff_at DESC, com todos os campos mapeados para a interface

**Parametros:** `queryKey: ['handoff-metrics', instanceId, periodDays]`, `staleTime: 60_000`.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Hook retorna HandoffMetrics com 4 sections
- Toda agregacao no JS (single query na view)
- Campos `evitavel` e `converteu` usados da view corrigida

### Task 4.2 — HandoffKPICards + HandoffMotivosChart + HandoffEvitavelChart

**Arquivos:**
- `src/components/gestao/HandoffKPICards.tsx`
- `src/components/gestao/HandoffMotivosChart.tsx`
- `src/components/gestao/HandoffEvitavelChart.tsx`

**Acao:**

**HandoffKPICards** — Grid de 5 StatsCards:

```
| Total Handoffs | Evitaveis (%) | Necessarios | Conversao Pos-Transbordo (%) | Tempo Medio ate Transbordo |
```

Props: `kpis: HandoffKPIs`, `periodDays: number`. Icones: `ArrowRightLeft`, `AlertTriangle`, `Shield`, `TrendingUp`, `Clock`.

**HandoffMotivosChart** — BarChart horizontal (Recharts):
- Barras horizontais com motivos de handoff ordenados por count DESC
- Props: `data: HandoffByMotivo[]`
- Formato: Card + CardHeader "Motivos de Transbordo" + ResponsiveContainer + BarChart (layout="vertical")
- Max 10 motivos. Label truncado com tooltip.
- Cores: cor unica (primary) com opacidade variavel

**HandoffEvitavelChart** — PieChart (Recharts):
- 2 fatias: "Evitavel" (vermelho) e "Necessario" (verde)
- Props: `evitavelCount: number, necessarioCount: number`
- Centro: label com total
- Mesmo padrao de Card + CardHeader do LeadsByOriginChart

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- 3 componentes funcionais com dados tipados
- BarChart horizontal com motivos
- PieChart com evitavel vs necessario
- Empty states quando dados vazios

### Task 4.3 — HandoffRecentTable + HandoffDetailPage

**Arquivos:**
- `src/components/gestao/HandoffRecentTable.tsx`
- `src/pages/dashboard/gestao/HandoffDetailPage.tsx`

**Acao:**

**HandoffRecentTable** — Tabela dos ultimos 20 handoffs:

Colunas:
- Data/Hora (handoff_at formatado)
- Motivo (reason — truncar se longo)
- Trigger
- Evitavel (badge verde "Necessario" ou badge vermelho "Evitavel")
- Converteu (badge "Sim" verde ou "Nao" cinza)
- Tempo antes (minutes_before_handoff formatado como Xmin ou Xh Ymin)
- Vendedor (seller_id resolvido via `useUserProfiles`)

Props: `rows: HandoffRow[]`. Usar `useUserProfiles` para resolver seller_ids.

Layout: Card + table HTML simples com classes Tailwind (nao usar lib de tabela — manter leve). Overflow horizontal para mobile.

**HandoffDetailPage:**

```
Header: icone ArrowRightLeft + "Painel de Transbordo" + Botao Voltar
ManagerFilters (instancia + periodo)
HandoffKPICards
Grid 2 colunas:
  - HandoffMotivosChart (LazySection)
  - HandoffEvitavelChart (LazySection)
HandoffRecentTable (LazySection)
```

Usar `useHandoffMetrics(instanceId, periodDays)`. Seguir padrao ManagerDashboard para loading/skeleton.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Tabela renderiza 20 linhas com todos os campos
- Badges de evitavel/converteu com cores corretas
- Pagina completa com KPIs + graficos + tabela
- Nomes dos vendedores resolvidos (nao UUIDs)

---

## Plano 5 — Metricas de Origem (hook + pagina + UTM breakdown)

**Wave:** 2 (paralelo com Planos 2-4, nao depende de Plano 1)
**Arquivos criados:**
- `src/hooks/useOriginMetrics.ts`
- `src/pages/dashboard/gestao/OriginMetricsPage.tsx`
- `src/components/gestao/OriginChannelTable.tsx`
- `src/components/gestao/OriginUTMBreakdown.tsx`

**Contexto:**
Metricas de origem mostram de onde vem os leads (bio, campanha, formulario, direto) com detalhamento UTM para leads vindos de campanhas. Dados vem de `v_lead_metrics` + `utm_visits` + `utm_campaigns` (queries ad-hoc, sem view dedicada).

### Task 5.1 — Hook useOriginMetrics

**Arquivo:** `src/hooks/useOriginMetrics.ts`

**Acao:**

Criar hook `useOriginMetrics(instanceId: string | null, periodDays: number)`:

```typescript
export interface OriginChannel {
  origin: string;           // 'bio' | 'campanha' | 'formulario' | 'direto' | etc.
  totalLeads: number;
  qualifiedLeads: number;   // current_score >= 70
  avgTicket: number | null;
  avgScore: number;
  conversionRate: number;   // qualified / total * 100
}

export interface UTMBreakdownRow {
  utmSource: string;
  utmMedium: string;
  campaignName: string;
  visits: number;
  matchedLeads: number;     // contact_id NOT NULL
  conversionPct: number;
}

export interface OriginMetricsData {
  channels: OriginChannel[];
  utmBreakdown: UTMBreakdownRow[];
  totalLeads: number;
}
```

**Queries (Promise.all):**

1. **Channels:** `v_lead_metrics` filtrado por `instance_id` e `lead_created_at >= since`.
   - No JS: agrupar por `origin` (coalesce null para 'direto')
   - Para cada origin: contar total, contar qualified (current_score >= 70), AVG average_ticket (ignorar null/0), AVG current_score
   - Ordenar por totalLeads DESC

2. **UTM Breakdown:** 3 queries encadeadas:
   - `utm_campaigns` filtrado por `instance_id` — obter todos os campaign ids e nomes
   - `utm_visits` filtrado por `campaign_id IN (ids)` e `visited_at >= since` — agrupar por campaign_id
   - Para cada campanha: total visits, matched visits (contact_id NOT NULL), pct = matched/total*100
   - Incluir `utm_source`, `utm_medium` do campaign
   - Ordenar por visits DESC, max 20 rows

**NOTA:** A query de UTM NAO usa view — e ad-hoc via Supabase client JS. Views sao apenas para dados com filtro `instance_id` direto. Aqui o join e: `utm_campaigns.instance_id → utm_visits.campaign_id`.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Hook retorna channels (por origin) + UTM breakdown
- Average ticket mostrado como null quando nao ha dados suficientes
- UTM data computado via join JS de duas queries

### Task 5.2 — OriginChannelTable + OriginUTMBreakdown

**Arquivos:**
- `src/components/gestao/OriginChannelTable.tsx`
- `src/components/gestao/OriginUTMBreakdown.tsx`

**Acao:**

**OriginChannelTable** — Tabela de canais de origem:

Colunas:
| Canal | Leads | Qualificados | % Conversao | Ticket Medio | Score Medio |

Props: `channels: OriginChannel[]`

- Canal: badge colorido por origin (bio=azul, campanha=roxo, formulario=verde, direto=cinza) — reutilizar cores do `LeadsByOriginChart`
- Ticket medio: `R$ X` ou `--` se null
- Score medio: barra visual 0-100 (div com width %)
- Layout: Card + table HTML com Tailwind

**OriginUTMBreakdown** — Tabela de UTMs:

Colunas:
| Campanha | Source | Medium | Visitas | Leads Capturados | % Conversao |

Props: `data: UTMBreakdownRow[]`

- Campanha: nome truncado
- Visitas: numero
- Leads capturados: `matchedLeads`
- % Conversao: `conversionPct` com badge colorido (verde > 10%, amarelo 5-10%, vermelho < 5%)
- Layout: Card + table HTML. Empty state: "Nenhuma campanha com UTM no periodo"

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Tabela de canais com badges coloridos
- Tabela de UTMs com dados reais (nao mock)
- Empty states em ambos

### Task 5.3 — OriginMetricsPage

**Arquivo:** `src/pages/dashboard/gestao/OriginMetricsPage.tsx`

**Acao:**

Criar pagina:

```
Header: icone Globe + "Metricas de Origem" + Botao Voltar
ManagerFilters (instancia + periodo) — usar useManagerInstances
PieChart de leads por origem (reutilizar LeadsByOriginChart — ja existe, passar channels convertidos para LeadsByOrigin[])
OriginChannelTable (LazySection)
OriginUTMBreakdown (LazySection)
```

Importar `LeadsByOriginChart` de `@/components/manager/LeadsByOriginChart` — ja aceita `data: LeadsByOrigin[]`. Converter `channels` para o formato: `{ origin: channel.origin, count: channel.totalLeads }`.

Usar `useOriginMetrics(instanceId, periodDays)`. Padrao de loading/skeleton.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Pagina exibe PieChart (reutilizado) + tabela canais + tabela UTMs
- Dados reais do banco
- Loading e empty states

---

## Plano 6 — Metas Configuraveis (CRUD + GoalProgressBar + integracao)

**Wave:** 3 (depende de Planos 2-5 para as fichas existirem, e Plano 1 para a tabela)
**Arquivos criados:**
- `src/hooks/useInstanceGoals.ts`
- `src/components/gestao/GoalProgressBar.tsx`
- `src/components/gestao/GoalsConfigModal.tsx`

**Contexto:**
Metas configuraveis permitem que o gestor defina targets por instancia (ex: conversao > 15%, NPS > 4.5). A `GoalProgressBar` e reutilizada em todas as fichas para mostrar progresso vs meta.

### Task 6.1 — Hook useInstanceGoals + GoalProgressBar

**Arquivos:**
- `src/hooks/useInstanceGoals.ts`
- `src/components/gestao/GoalProgressBar.tsx`

**Acao:**

**useInstanceGoals:**

```typescript
export interface InstanceGoal {
  id: string;
  instanceId: string;
  metricKey: string;
  targetValue: number;
  period: string;
  createdBy: string | null;
}

// Hook de leitura
export function useInstanceGoals(instanceId: string | null) {
  return useQuery({
    queryKey: ['instance-goals', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_goals' as any)
        .select('id, instance_id, metric_key, target_value, period, created_by')
        .eq('instance_id', instanceId!);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        instanceId: r.instance_id,
        metricKey: r.metric_key,
        targetValue: Number(r.target_value),
        period: r.period,
        createdBy: r.created_by,
      })) as InstanceGoal[];
    },
    staleTime: 120_000,
  });
}

// Mutation de upsert (para modal de config)
export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goal: { instanceId: string; metricKey: string; targetValue: number; period: string }) => {
      // UPSERT via .upsert() com onConflict
      // ATENCAO regra 36: PostgREST onConflict pode falhar se constraint name nao bater
      // Solucao: fazer select primeiro, se existe fazer update, senao insert
      const { data: existing } = await supabase
        .from('instance_goals' as any)
        .select('id')
        .eq('instance_id', goal.instanceId)
        .eq('metric_key', goal.metricKey)
        .eq('period', goal.period)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('instance_goals' as any)
          .update({ target_value: goal.targetValue, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('instance_goals' as any)
          .insert({
            instance_id: goal.instanceId,
            metric_key: goal.metricKey,
            target_value: goal.targetValue,
            period: goal.period,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-goals'] });
    },
  });
}
```

**GoalProgressBar:**

Componente reutilizavel:

```tsx
interface GoalProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;        // '%', '$', 'min', etc.
  invertColors?: boolean; // true quando menor e melhor (ex: tempo, custo)
}
```

Layout:
- Label em cima (ex: "Taxa de Conversao")
- Barra de progresso com largura = `min(current/target * 100, 100)%`
- Cor: verde se >= target (ou se invertColors e <= target), amarelo se 70-99%, vermelho se < 70%
- Texto: `{current}{unit} / {target}{unit}` ao lado da barra
- Se nao ha meta definida: nao renderizar (retorna null)

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Hook de leitura retorna metas da instancia
- Hook de upsert faz select+update/insert (evita problema R36 do PostgREST)
- GoalProgressBar renderiza barra colorida com progresso
- Componente retorna null se nao ha meta definida

### Task 6.2 — GoalsConfigModal + Integracao nas fichas

**Arquivos criados:**
- `src/components/gestao/GoalsConfigModal.tsx`

**Arquivos editados:**
- `src/pages/dashboard/gestao/VendorDetailPage.tsx`
- `src/pages/dashboard/gestao/AgentDetailPage.tsx`
- `src/pages/dashboard/gestao/HandoffDetailPage.tsx`
- `src/pages/dashboard/gestao/OriginMetricsPage.tsx`
- `src/pages/dashboard/ManagerDashboard.tsx`

**Acao:**

**GoalsConfigModal:**

Modal com formulario para configurar metas. Acessivel via botao "Configurar Metas" (icone Settings) no header de cada ficha/dashboard.

```tsx
interface GoalsConfigModalProps {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

- Usar Dialog do shadcn/ui (`@/components/ui/dialog`)
- Lista de 6 metric_keys com labels traduzidos:
  ```
  conversion_rate: "Taxa de Conversao (%)"
  nps_avg: "NPS Medio (1-5)"
  handoff_rate: "Taxa de Transbordo (%)"
  response_time_min: "Tempo Medio Resolucao (min)"
  ia_cost_usd: "Custo IA Mensal (USD)"
  avg_ticket: "Ticket Medio (R$)"
  ```
- Para cada metrica: Input numerico + Select de periodo (diario/semanal/mensal)
- Pre-preencher com valores existentes (de useInstanceGoals)
- Botao Salvar: chama useUpsertGoal para cada metrica com valor alterado
- Loading state durante save

**Integracao nas fichas:**

Em CADA pagina de ficha e no dashboard principal, adicionar:
1. `const { data: goals = [] } = useInstanceGoals(instanceId);`
2. Botao "Metas" no header (ao lado do botao Atualizar)
3. `GoalsConfigModal` controlado por estado local `goalsOpen`
4. GoalProgressBars ABAIXO dos KPI cards, para as metricas relevantes:

   - **ManagerDashboard:** todas as 6 metas
   - **VendorDetailPage:** `nps_avg`, `response_time_min` (as que fazem sentido por vendedor)
   - **AgentDetailPage:** `handoff_rate`, `ia_cost_usd`
   - **HandoffDetailPage:** `handoff_rate`
   - **OriginMetricsPage:** `conversion_rate`, `avg_ticket`

Cada GoalProgressBar recebe:
- `current`: valor atual do KPI (ja disponivel no hook de cada ficha)
- `target`: `goals.find(g => g.metricKey === 'xxx')?.targetValue`
- Se goal nao existe para aquela metrica, GoalProgressBar retorna null (nao mostra nada)

**Mapeamento de `current` por ficha:**

| Ficha | Metrica | current |
|-------|---------|---------|
| Dashboard | conversion_rate | metrics.kpis.conversionRate |
| Dashboard | nps_avg | metrics.kpis.npsAvg |
| Dashboard | handoff_rate | metrics.kpis.handoffRate |
| Dashboard | ia_cost_usd | metrics.kpis.iaCostUsd |
| Vendedor | nps_avg | vendorDetail.kpis.npsAvg |
| Vendedor | response_time_min | vendorDetail.kpis.avgResolutionMin |
| Agente IA | handoff_rate | agentDetail.kpis calculado (handoffs / (handoffs + responses) * 100) |
| Agente IA | ia_cost_usd | agentDetail.kpis.totalCostUsd |
| Transbordo | handoff_rate | handoffMetrics.kpis calculado |
| Origem | conversion_rate | calculado com channels |
| Origem | avg_ticket | media de channels.avgTicket |

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

**Criterio de conclusao:**
- Modal de configuracao funcional com save em todas as 6 metricas
- GoalProgressBars aparecem em todas as fichas (somente se meta definida)
- Cores corretas (verde/amarelo/vermelho) baseadas em progresso
- Sem dados mock — dados reais da tabela instance_goals

---

## Plano 7 — Navegacao: Rotas + Sidebar + Verificacao Final

**Wave:** 3 (depende de Planos 2-5 para paginas existirem)
**Arquivos editados:**
- `src/App.tsx`
- `src/components/dashboard/Sidebar.tsx`

**Contexto:**
Todas as paginas foram criadas nos planos anteriores. Agora falta registrar as rotas no App.tsx e adicionar os sub-items no menu lateral. Tambem inclui verificacao final de tsc e navegacao completa.

### Task 7.1 — Registrar rotas no App.tsx

**Arquivo:** `src/App.tsx`

**Acao:**

1. Adicionar lazy imports no topo (junto com os outros lazy imports, ~linha 64):

```typescript
const VendorDetailPage = lazy(() => import("./pages/dashboard/gestao/VendorDetailPage"));
const AgentDetailPage = lazy(() => import("./pages/dashboard/gestao/AgentDetailPage"));
const HandoffDetailPage = lazy(() => import("./pages/dashboard/gestao/HandoffDetailPage"));
const OriginMetricsPage = lazy(() => import("./pages/dashboard/gestao/OriginMetricsPage"));
```

2. Adicionar rotas LOGO APOS a rota de `gestao` existente (apos ~linha 266):

```tsx
<Route path="gestao/vendedor/:sellerId" element={<CrmRoute><ErrorBoundary section="Ficha Vendedor"><Suspense fallback={<PageLoader />}><VendorDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/agente" element={<CrmRoute><ErrorBoundary section="Ficha Agente IA"><Suspense fallback={<PageLoader />}><AgentDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/transbordo" element={<CrmRoute><ErrorBoundary section="Painel Transbordo"><Suspense fallback={<PageLoader />}><HandoffDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/origem" element={<CrmRoute><ErrorBoundary section="Metricas Origem"><Suspense fallback={<PageLoader />}><OriginMetricsPage /></Suspense></ErrorBoundary></CrmRoute>} />
```

**IMPORTANTE:** Todas usam `CrmRoute` (mesmo da rota `/gestao` existente). NAO criar wrapper novo.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

### Task 7.2 — Adicionar sub-items na Sidebar

**Arquivo:** `src/components/dashboard/Sidebar.tsx`

**Acao:**

1. Verificar quais ícones já estão importados e adicionar apenas os faltantes:
```bash
grep -n "Bot\|ArrowRightLeft\|Globe" src/components/dashboard/Sidebar.tsx
```
Se `Bot` aparecer no resultado → não duplicar. `ArrowRightLeft` e `Globe` provavelmente NÃO estão — adicionar ao bloco de imports lucide-react existente.

2. Localizar o bloco collapsible "Gestao" (~linha 546-556). Substituir:

```tsx
{(isSuperAdmin || isGerente) && renderCollapsible(
  LineChart,
  'Gestao',
  gestaoOpen,
  setGestaoOpen,
  isGestaoActive,
  '/dashboard/gestao',
  <>
    {renderSubItem('/dashboard/gestao', 'Dashboard', LineChart)}
    {renderSubItem('/dashboard/gestao/agente', 'Agente IA', Bot)}
    {renderSubItem('/dashboard/gestao/transbordo', 'Transbordo', ArrowRightLeft)}
    {renderSubItem('/dashboard/gestao/origem', 'Metricas Origem', Globe)}
  </>
)}
```

**NOTAS:**
- Ficha Vendedor NAO aparece no menu (acesso via drill-down no SellerRankingChart)
- `isGestaoActive` ja cobre todos os sub-paths porque usa `startsWith('/dashboard/gestao')`
- Verificar que `Bot` ja esta importado (usado no bloco AI Agent). Se sim, nao duplicar import.
- `ArrowRightLeft` e `Globe` provavelmente NAO estao importados — adicionar ao bloco de imports.

**Verificacao:**
```bash
npx tsc --noEmit  # 0 erros
```

### Task 7.3 — Verificacao final completa (T12 do wiki)

**Sobre testes:** S4 é frontend-only (sem edge functions). O projeto não tem runner de testes unitários de componentes React configurado (jest/vitest). T12 = verificação de build + navegação manual nas 4 fichas + tsc 0 erros. Testes automatizados de UI não se aplicam neste sprint.

**Acao:**

Executar sequencia completa de verificacao:

```bash
# 1. TypeScript sem erros
npx tsc --noEmit

# 2. Build sem erros
npm run build

# 3. Dev server funciona
npm run dev
# Navegar manualmente:
# - /dashboard/gestao (dashboard principal — deve funcionar como antes)
# - /dashboard/gestao/agente (ficha agente IA)
# - /dashboard/gestao/transbordo (painel transbordo)
# - /dashboard/gestao/origem (metricas origem)
# - Click em vendedor no ranking → /dashboard/gestao/vendedor/:id
# - Menu lateral deve mostrar 4 sub-items em "Gestao"
```

**Criterio de conclusao FINAL do Sprint S4:**

- [ ] Migration aplicavel sem erros (v_handoff_details corrigida + instance_goals)
- [ ] `tsc --noEmit` = 0 erros
- [ ] `npm run build` = 0 erros
- [ ] 4 paginas de ficha acessiveis via rotas
- [ ] Sidebar com 4 sub-items em Gestao (Dashboard, Agente IA, Transbordo, Metricas Origem)
- [ ] Drill-down do SellerRankingChart para ficha vendedor funciona
- [ ] GoalProgressBars aparecem em todas as fichas quando metas definidas
- [ ] GoalsConfigModal permite definir/editar metas
- [ ] Todos os dados sao reais (NUNCA mock)
- [ ] Empty states claros em todas as fichas
- [ ] Documentar no vault: log.md + wiki/roadmap.md + wiki/metricas-plano-implementacao.md (marcar S4 concluido) + wiki/decisoes-chave.md (se houver novas decisoes)
- [ ] Atualizar PRD.md com features do S4

---

## Resumo da Estrutura de Arquivos do Sprint

```
# Migration
supabase/migrations/20260418000001_s4_fix_handoff_view_and_goals.sql

# Hooks (5 novos + 1 extraido)
src/hooks/useManagerInstances.ts          # extraido de ManagerDashboard
src/hooks/useVendorDetail.ts              # ficha vendedor
src/hooks/useAgentDetail.ts               # ficha agente IA
src/hooks/useHandoffMetrics.ts            # painel transbordo
src/hooks/useOriginMetrics.ts             # metricas origem
src/hooks/useInstanceGoals.ts             # metas configuraveis

# Paginas (4 novas)
src/pages/dashboard/gestao/VendorDetailPage.tsx
src/pages/dashboard/gestao/AgentDetailPage.tsx
src/pages/dashboard/gestao/HandoffDetailPage.tsx
src/pages/dashboard/gestao/OriginMetricsPage.tsx

# Componentes (11 novos)
src/components/gestao/VendorKPICards.tsx
src/components/gestao/VendorTrendChart.tsx
src/components/gestao/AgentKPICards.tsx
src/components/gestao/AgentCostChart.tsx
src/components/gestao/AgentFollowUpStats.tsx
src/components/gestao/HandoffKPICards.tsx
src/components/gestao/HandoffMotivosChart.tsx
src/components/gestao/HandoffEvitavelChart.tsx
src/components/gestao/HandoffRecentTable.tsx
src/components/gestao/OriginChannelTable.tsx
src/components/gestao/OriginUTMBreakdown.tsx
src/components/gestao/GoalProgressBar.tsx
src/components/gestao/GoalsConfigModal.tsx

# Editados (3)
src/components/manager/SellerRankingChart.tsx   # drill-down click
src/pages/dashboard/ManagerDashboard.tsx         # extrair hook + goals
src/App.tsx                                       # 4 rotas
src/components/dashboard/Sidebar.tsx              # 3 sub-items
```

**Total:** 1 migration + 6 hooks + 4 paginas + 13 componentes + 4 editados = **28 arquivos**

---

## Ordem de Execucao

```
Plano 1 (Wave 1): Infraestrutura — migration SQL
  |
  +---> Plano 2 (Wave 2): Ficha Vendedor
  +---> Plano 3 (Wave 2): Ficha Agente IA
  +---> Plano 4 (Wave 2): Painel Transbordo
  +---> Plano 5 (Wave 2): Metricas Origem (pode comecar sem Plano 1)
  |
  +---> Plano 6 (Wave 3): Metas Configuraveis (depende de Planos 2-5)
  +---> Plano 7 (Wave 3): Navegacao + Verificacao Final
```

**Planos 2, 3, 4 e 5 podem ser executados em paralelo** (nao compartilham arquivos).
**Plano 6 depende de todos os anteriores** (edita todas as fichas).
**Plano 7 e o ultimo** (conecta tudo).
