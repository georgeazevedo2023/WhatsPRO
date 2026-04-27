# M19 S4 — Fichas Individuais do Dashboard do Gestor: Research

**Pesquisado em:** 2026-04-13
**Domínio:** Dashboard de Gestão — React, Supabase views, Recharts, React Query
**Confiança:** HIGH (baseado em código real do projeto)

---

## Resumo

O S4 precisa criar 4 fichas/painéis de detalhe (Vendedor, Agente IA, Transbordo, Origem) e um sistema de Metas configuráveis por instância, tudo dentro de `/dashboard/gestao`. A base de dados do S2 já existe, mas há **gaps importantes** que exigem novas views ou extensão das existentes antes de construir as fichas.

**Ponto crítico descoberto:** A `v_handoff_details` filtra por `event = 'handoff_to_human'`, mas o ai-agent insere `event: 'handoff'`. A view retornará sempre zero linhas em produção — precisa de correção antes da Ficha Transbordo.

**Recomendação principal:** Criar um Sprint T0 de correção de infraestrutura (corrigir event name na view + adicionar tabela de metas) antes de construir as fichas de UI.

---

## 1. Views Disponíveis — Campos e Gaps

### v_lead_metrics
Campos expostos: `lead_id`, `instance_id`, `full_name`, `origin`, `current_score`, `average_ticket`, `tags`, `metadata`, `total_conversations`, `first_contact_at`, `last_contact_at`, `handoff_count`, `resolved_count`, `lead_created_at`

**Uso para S4:**
- Ficha Origem: `origin`, `average_ticket`, `current_score` — suficiente para ticket médio por canal
- O campo `metadata` contém `track_id`, `track_source` (UAZAPI) — mas NÃO contém `utm_source`/`utm_medium` diretamente no lead_profile
- Para ROI por canal precisa fazer JOIN com `utm_campaigns` via `origin` ou `utm_visits.contact_id`

**Gaps:**
- Sem `utm_source`/`utm_medium`/`utm_campaign` desnormalizados no lead — exige query separada via `utm_visits + utm_campaigns`
- Sem `conversion_value` (ticket real de conversão) — `average_ticket` é estimativa manual

### v_vendor_activity
Campos: `instance_id`, `seller_id`, `activity_date`, `conversations_handled`, `resolved_count`, `pending_count`, `avg_resolution_minutes`, `unique_contacts`

**Uso para S4 — Ficha Vendedor:**
- Tem: conversas, resolvidas, tempo de resolução
- Falta: NPS por vendedor, ticket médio por vendedor, taxa de conversão por vendedor
- NPS por vendedor requer: JOIN `poll_responses → poll_messages → conversations.assigned_to` — possível mas custoso
- Ticket médio por vendedor: `AVG(lead_profiles.average_ticket)` via contacts atendidos

**Gaps para Ficha Vendedor completa:**
- Nenhuma view cruza seller + NPS — nova query necessária
- Nenhuma view cruza seller + average_ticket — nova query necessária

### v_handoff_details
Campos: `instance_id`, `conversation_id`, `seller_id`, `handoff_at`, `conversation_started_at`, `minutes_before_handoff`, `handoff_reason`, `handoff_trigger`, `minutes_to_resolve_after_handoff`, `conversation_status`

**BUG CRÍTICO:** A view filtra `WHERE al.event = 'handoff_to_human'`, mas o ai-agent insere `event: 'handoff'` (linha 2282 do index.ts). A view retorna zero linhas em produção.

**Campos ausentes para Ficha Transbordo:**
- `evitavel` (boolean): não existe — precisa ser derivado de regra (ex: `handoff_trigger IN ('lead_asked','greeting_trigger')` → necessário; `handoff_trigger = 'auto_after_n_msgs'` → evitável)
- `lead_desistiu` (bool): não existe — pode ser derivado de `conversation_status = 'abandoned'` se existir, ou por ausência de resposta do lead após handoff
- `tempo_pickup`: não existe — seria o tempo entre `handoff_at` e o primeiro `conversation_messages` do vendedor após o handoff
- `conversao_pos_transbordo`: presente via `minutes_to_resolve_after_handoff` + `conversation_status = 'resolved'`

**Correções necessárias na migration S4:**
1. Corrigir o filtro da view: `WHERE al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger')`
2. Adicionar campo `evitavel` calculado na view (via CASE sobre `handoff_trigger`)
3. `tempo_pickup` requer subquery em `conversation_messages` — complexo, melhor deixar para o lado JS

### v_agent_performance
Campos: `instance_id`, `activity_date`, `responses_sent`, `handoffs`, `errors`, `shadow_events`, `shadow_skipped`, `total_tokens`, `avg_response_latency_ms`, `cost_usd_approx`

**Uso para S4 — Ficha Agente IA:**
- Tem: custo, latência, handoffs, tokens, cobertura (via cálculo)
- Falta: produtos/marcas mais buscados — NÃO são logados como eventos em `ai_agent_logs`
- Falta: follow-up stats — `follow_up_executions` existe mas não está na view

**Gaps para Ficha Agente IA:**
- Produtos/marcas buscados não são persistidos com evento próprio — apenas logados via `log.info()` (não vai para DB). Para S4, precisaria: (a) criar evento `search_products` no ai_agent_logs com `metadata: {query, results_count, brand}`, OU (b) aceitar que esta métrica não estará disponível
- Follow-up stats: tabela `follow_up_executions` existe (campos: `status`, `conversation_id`, `sent_at`, `replied_at`) — JOIN com `conversations → inboxes.instance_id` daria a taxa de resposta a follow-ups

### v_conversion_funnel
Campos: `instance_id`, `event_date`, `stage`, `unique_leads`, `total_events`

Suficiente para o funil macro. Não há campo de canal/origem por etapa — não serve diretamente para Ficha Origem com breakdown UTM.

### v_ia_vs_vendor
Campos: `instance_id`, `activity_date`, `ia_responses`, `ia_handoffs`, `ia_coverage_pct`, `ia_avg_latency_ms`, `ia_cost_usd`, `vendor_conversations`, `vendor_resolved`, `vendor_avg_resolution_minutes`, `vendor_active_sellers`

Boa visão geral. Falta breakdown de custo por conversa e custo por handoff (calculável no JS).

---

## 2. Padrões S3 a Reutilizar

### Hook: `useManagerMetrics` (`src/hooks/useManagerMetrics.ts`)
- Padrão: `useQuery` com `Promise.all` para consultas paralelas às 6 views
- Parâmetros: `instanceId: string | null`, `periodDays = 30`
- Interfaces exportadas: `ManagerKPIs`, `LeadsByOrigin`, `TrendDay`, `SellerRankData`, `FunnelStageData`, `IAvsVendorData`, `ManagerMetrics`
- `queryKey: ['manager-metrics', instanceId, periodDays]`
- `staleTime: 60_000`

**Para S4:** Criar hooks específicos por ficha (`useVendorDetail`, `useAgentDetail`, `useHandoffDetail`, `useOriginMetrics`) — não sobrecarregar o hook central.

### Hook: `useUserProfiles` (`src/hooks/useUserProfiles.ts`)
- Busca `user_profiles` com filtro por `userIds`
- Retorna `profiles`, `profilesMap`, `namesMap` (id → string)
- Padrão canônico para resolver seller_id → nome: `namesMap[seller.sellerId]`
- Usa `useSupabaseQuery` interno (não `useQuery` do React Query)

### Componentes Manager (`src/components/manager/`)
| Componente | O que faz | Reutilizar em S4 |
|---|---|---|
| `ManagerFilters` | Select instância + período | Direto — passar como prop |
| `ManagerKPICards` | Grid 6 StatsCard | Template para KPIs de cada ficha |
| `SellerRankingChart` | Lista ordenada com barra progress | Template para ranking em Ficha Vendedor |
| `LeadsTrendChart` | Recharts LineChart | Template para evolução temporal |
| `LeadsByOriginChart` | Recharts PieChart | Template para Ficha Origem |
| `ManagerConversionFunnel` | Barras horizontais customizadas | Template para Ficha Transbordo (motivos) |
| `IAvsVendorComparison` | Grid 3-colunas comparativo | Template para Ficha Agente IA |

### StatsCard (`src/components/dashboard/StatsCard.tsx`)
- Props: `title`, `value`, `icon`, `description`, `trend?: {value, positive}`, `className`
- Suporta `trend` com seta (+X% vs ontem)

### LazySection (`src/components/dashboard/LazySection.tsx`)
- IntersectionObserver para lazy render
- Props: `height` (padrão 280px), `className`
- Usar em todas as fichas para performance

### Biblioteca de Charts: **Recharts**
- `LineChart`, `BarChart`, `PieChart`, `Cell`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer`
- Já instalado — não instalar nada novo
- Cores do projeto: verde `hsl(142 70% 45%)`, roxo `hsl(262 83% 58%)`, amarelo `hsl(43 96% 56%)`

### Padrão de Loading:
```tsx
// Em ManagerDashboard.tsx — padrão a seguir
{isLoading ? (
  <Skeleton className="h-24 rounded-xl" />
) : metrics ? (
  <Component data={metrics.xxx} />
) : null}
```

---

## 3. Roteamento — Como Adicionar as 4 Fichas

### Estado atual do App.tsx
```tsx
// Linha 266 — única rota de gestão
<Route path="gestao" element={<CrmRoute>...<ManagerDashboard /></CrmRoute>} />
```

### Como adicionar sub-rotas de fichas
**Abordagem recomendada:** rotas filhas aninhadas + lazy import (padrão do projeto)

```tsx
// No App.tsx — adicionar após a linha 266:
const VendorDetailPage   = lazy(() => import("./pages/dashboard/gestao/VendorDetailPage"));
const AgentDetailPage    = lazy(() => import("./pages/dashboard/gestao/AgentDetailPage"));
const HandoffDetailPage  = lazy(() => import("./pages/dashboard/gestao/HandoffDetailPage"));
const OriginMetricsPage  = lazy(() => import("./pages/dashboard/gestao/OriginMetricsPage"));

// Dentro do bloco /dashboard:
<Route path="gestao" element={<CrmRoute>...<ManagerDashboard /></CrmRoute>} />
<Route path="gestao/vendedor/:sellerId" element={<CrmRoute><ErrorBoundary section="Ficha Vendedor"><Suspense fallback={<PageLoader />}><VendorDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/agente" element={<CrmRoute><ErrorBoundary section="Ficha Agente IA"><Suspense fallback={<PageLoader />}><AgentDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/transbordo" element={<CrmRoute><ErrorBoundary section="Painel Transbordo"><Suspense fallback={<PageLoader />}><HandoffDetailPage /></Suspense></ErrorBoundary></CrmRoute>} />
<Route path="gestao/origem" element={<CrmRoute><ErrorBoundary section="Métricas Origem"><Suspense fallback={<PageLoader />}><OriginMetricsPage /></Suspense></ErrorBoundary></CrmRoute>} />
```

**Estrutura de diretórios sugerida:**
```
src/pages/dashboard/gestao/
  VendorDetailPage.tsx      # Ficha do vendedor (:sellerId)
  AgentDetailPage.tsx       # Ficha do Agente IA
  HandoffDetailPage.tsx     # Painel Transbordo
  OriginMetricsPage.tsx     # Métricas de Origem
src/components/gestao/
  VendorKPICards.tsx
  VendorNPSChart.tsx
  HandoffMotivosList.tsx
  HandoffEvitavelChart.tsx
  OriginROITable.tsx
  OriginUTMBreakdown.tsx
  AgentFollowUpStats.tsx
  AgentCostChart.tsx
  GoalProgressBar.tsx       # reutilizável em todas as fichas
src/hooks/
  useVendorDetail.ts
  useAgentDetail.ts
  useHandoffMetrics.ts
  useOriginMetrics.ts
  useInstanceGoals.ts       # para metas
```

**Proteção:** Todas as rotas novas usam `CrmRoute` (mesmo wrapper de `/dashboard/gestao`) — acesso para `super_admin` e `gerente`.

---

## 4. Sidebar — Como Adicionar Sub-items ao Collapsible Gestao

### Estado atual (Sidebar.tsx linha 546-556)
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
  </>
)}
```

### O que adicionar
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
    {renderSubItem('/dashboard/gestao/agente', 'Ficha Agente IA', Bot)}
    {renderSubItem('/dashboard/gestao/transbordo', 'Transbordo', ArrowRightLeft)}
    {renderSubItem('/dashboard/gestao/origem', 'Métricas Origem', Globe)}
  </>
)}
```

**Notas:**
- Ficha Vendedor NÃO aparece no menu (acesso via drill-down no SellerRankingChart do dashboard)
- Ícones a importar: `Bot` (já importado), `ArrowRightLeft` (importar de lucide), `Globe` (importar)
- O `renderSubItem` usa `isActive(path)` — match exato. Para `/dashboard/gestao/vendedor/:sellerId` não precisa de item de menu
- `isGestaoActive` já cobre todos os sub-paths porque usa `location.pathname.startsWith('/dashboard/gestao')`

---

## 5. Metas Configuráveis — Estado Atual e O que Criar

### Estado atual
**Não existe nenhuma tabela de metas no projeto.** Pesquisa por `nps_target`, `response_time_target`, `conversion_target`, `instance_goals`, `instance_settings`, `goals` retornou zero resultados em todas as migrations.

A tabela `instances` tem apenas: `id`, `name`, `token`, `status`, `owner_jid`, `profile_pic_url`, `disabled`, `use_orchestrator`, `created_at`, `updated_at`.

### O que criar (nova migration S4)
```sql
-- Tabela: instance_goals
-- Metas configuráveis por instância, por tipo de KPI
CREATE TABLE public.instance_goals (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  TEXT         NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  metric_key   TEXT         NOT NULL,  -- 'conversion_rate', 'nps_avg', 'response_time_min', 'handoff_rate', 'ia_cost_usd', 'avg_ticket'
  target_value NUMERIC      NOT NULL,
  period       TEXT         NOT NULL DEFAULT 'monthly',  -- 'daily', 'weekly', 'monthly'
  created_by   UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (instance_id, metric_key, period)
);
```

**Possíveis metric_key values (MVP):**
- `conversion_rate` — % leads que chegam em conversão (meta: ex 15%)
- `nps_avg` — NPS médio (meta: ex 4.5)
- `handoff_rate` — % de handoffs por IA (meta: ex 30%)
- `response_time_min` — tempo médio de resolução em minutos (meta: ex 60)
- `ia_cost_usd` — custo mensal estimado (meta: ex $5.00)
- `avg_ticket` — ticket médio em R$ (meta: ex 250)

**RLS sugerida:** apenas `super_admin` pode escrever. `gerente` pode ler (via inbox_users join).

**UI de configuração:** painel simples dentro de cada ficha ou página dedicada `gestao/metas`. Usar `GoalProgressBar` component reutilizável que recebe `current`, `target`, `label`.

---

## 6. Handoff Fields — O que Existe vs o que Falta

### Resumo da situação

| Campo necessário | Existe na view? | Como obter |
|---|---|---|
| `handoff_reason` | Sim (`al.metadata->>'reason'`) | Disponível |
| `handoff_trigger` | Sim (`al.metadata->>'trigger'`) | Disponível |
| `minutes_before_handoff` | Sim | Disponível |
| `minutes_to_resolve_after_handoff` | Sim (quando resolved) | Disponível |
| `conversation_status` | Sim | Disponível |
| `evitavel` | NÃO | Derivar: `CASE WHEN handoff_trigger IN ('lead_asked', 'buy_confirm') THEN false ELSE true END` |
| `lead_desistiu` | NÃO | `conversation_status = 'open'` após 48h sem resposta — requer cron ou cálculo JS |
| `tempo_pickup` | NÃO | `MIN(cm.created_at) - al.created_at` onde `cm.direction='outgoing' AND cm.created_at > al.created_at` — subquery pesada |
| `conversao_pos_transbordo` | Parcial | `resolved + minutes_to_resolve` existem; falta flag binário `is_converted` |

### BUG CRÍTICO a corrigir antes de tudo

A view `v_handoff_details` filtra `WHERE al.event = 'handoff_to_human'` mas o ai-agent **insere `event: 'handoff'`** (linha 2282 do index.ts). A view retorna sempre vazia.

**Correção na migration S4:**
```sql
CREATE OR REPLACE VIEW v_handoff_details WITH (security_barrier = true) AS
SELECT
  ib.instance_id,
  al.conversation_id,
  conv.assigned_to       AS seller_id,
  al.created_at          AS handoff_at,
  conv.created_at        AS conversation_started_at,
  ROUND(EXTRACT(EPOCH FROM (al.created_at - conv.created_at)) / 60, 1) AS minutes_before_handoff,
  al.metadata->>'reason'   AS handoff_reason,
  al.metadata->>'trigger'  AS handoff_trigger,
  CASE
    WHEN al.metadata->>'trigger' IN ('lead_asked', 'buy_confirm', 'lead_request')
    THEN false
    ELSE true
  END                                                                   AS evitavel,
  CASE
    WHEN conv.status = 'resolved'
    THEN ROUND(EXTRACT(EPOCH FROM (conv.updated_at - al.created_at)) / 60, 1)
  END                                                                   AS minutes_to_resolve_after_handoff,
  conv.status            AS conversation_status,
  CASE WHEN conv.status = 'resolved' THEN true ELSE false END          AS converteu
FROM ai_agent_logs al
JOIN conversations conv ON conv.id = al.conversation_id
JOIN inboxes ib ON ib.id = conv.inbox_id
-- CORRIGIDO: event pode ser 'handoff' ou 'handoff_to_human'
WHERE al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger');
```

**`tempo_pickup`** — calcular no lado JS/hook (não na view): após carregar os handoffs, fazer segunda query em `conversation_messages` para obter o primeiro `outgoing` posterior ao `handoff_at` de cada conversa. Alternativa: nova view materializada (fora do escopo MVP).

---

## 7. UTMs — Campos Disponíveis

### Estrutura de dados UTM

O projeto tem 3 pontos de captura de UTM:

1. **`utm_campaigns`** — tabela de campanhas criadas no admin
   - Campos: `instance_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
   - Já existe com todas as dimensões UTM padrão

2. **`utm_visits`** — registro de cliques em links UTM
   - Campos: `campaign_id`, `ref_code`, `contact_id` (após match), `status`, `metadata` (JSONB com dados de device)
   - JOIN: `utm_visits → utm_campaigns → instance_id`

3. **`lead_profiles.metadata`** — JSONB adicionado no S2 (migration `20260417000001_s2_schema.sql`)
   - Campos armazenados: `track_id`, `track_source` (origem UAZAPI), `track_updated_at`
   - NÃO armazena `utm_source`/`utm_medium` — esses ficam na `utm_campaigns`

4. **`lead_profiles.origin`** — TEXT com valores: `'bio'`, `'campanha'`, `'formulario'`, `'direto'`, `'whatsapp'`

### Para Ficha Origem / ROI por Canal

A query para ROI por canal requer:
```sql
-- Leads por canal com ticket médio
SELECT
  COALESCE(lp.origin, 'direto')        AS canal,
  uc.utm_source,
  uc.utm_medium,
  COUNT(DISTINCT lp.id)                AS total_leads,
  AVG(lp.average_ticket)               AS avg_ticket,
  COUNT(DISTINCT CASE WHEN lp.current_score >= 70 THEN lp.id END) AS leads_qualificados
FROM lead_profiles lp
LEFT JOIN contacts ct ON ct.id = lp.contact_id
LEFT JOIN utm_visits uv ON uv.contact_id = ct.id
LEFT JOIN utm_campaigns uc ON uc.id = uv.campaign_id
JOIN conversations conv ON conv.contact_id = ct.id
JOIN inboxes ib ON ib.id = conv.inbox_id
WHERE ib.instance_id = $1
  AND lp.created_at >= $2
GROUP BY COALESCE(lp.origin, 'direto'), uc.utm_source, uc.utm_medium
```

Isso pode ser feito no hook `useOriginMetrics` via Supabase query (sem view separada no MVP).

**Limitação:** `average_ticket` em `lead_profiles` é um campo preenchido manualmente pelo AI agent via `update_lead_profile`. Pode estar vazio para muitos leads. Para conversões reais de receita, o projeto ainda não tem esse dado estruturado.

---

## 8. Recomendações — Abordagem por Ficha

### T0 — Infraestrutura (pré-requisito de tudo)
1. **Migration**: corrigir `v_handoff_details` (event name bug)
2. **Migration**: criar tabela `instance_goals`
3. **Sem essa task, Ficha Transbordo fica com dados zerados**

### T1 — Ficha Vendedor (`/dashboard/gestao/vendedor/:sellerId`)
**Dados disponíveis:** `v_vendor_activity` já tem conversations, resolved, pending, avg_resolution_minutes
**Dados a computar:** NPS (JOIN poll_responses), ticket médio (JOIN lead_profiles)
**Abordagem:**
- Hook `useVendorDetail(sellerId, instanceId, periodDays)` — duas queries paralelas: `v_vendor_activity` filtrada por `seller_id` + NPS via subquery
- Usar `useUserProfiles({userIds: [sellerId]})` para o nome
- Chart: evolução diária (LineChart), KPI cards de NPS/conversão/ticket
- Navegação: acessado via click em linha do `SellerRankingChart` (`navigate('/dashboard/gestao/vendedor/' + seller.sellerId)`)
- Metas: buscar `instance_goals WHERE metric_key IN ('nps_avg', 'response_time_min')`

### T2 — Ficha Agente IA (`/dashboard/gestao/agente`)
**Dados disponíveis:** `v_agent_performance` tem custo, tokens, latência, handoffs, erros
**Dados a computar:** follow-up stats (via `follow_up_executions`), cobertura diária
**Dados ausentes:** produtos/marcas buscados — NÃO estão logados no DB. Decisão: omitir no MVP ou criar evento `search_products_logged` na function (HIGH RISK — toca ai-agent/index.ts)
**Abordagem:**
- Hook `useAgentDetail(instanceId, periodDays)` — `v_agent_performance` + follow_up_executions
- Gráficos: custo acumulado por dia (AreaChart), latência média por dia (LineChart)
- Cards: custo total, custo/conversa, cobertura IA, handoff rate, taxa resposta follow-up

### T3 — Painel Transbordo (`/dashboard/gestao/transbordo`)
**Pré-requisito:** T0 (correção da view)
**Dados disponíveis após T0:** `handoff_reason`, `handoff_trigger`, `evitavel`, `converteu`, `minutes_before_handoff`
**Dados ausentes:** `tempo_pickup` — computar no JS após carregar os handoffs
**Abordagem:**
- Hook `useHandoffMetrics(instanceId, periodDays)` — `v_handoff_details` + agrupamento JS por motivo/trigger
- Gráfico: treemap ou barras horizontais de motivos
- Gráfico: pizza evitável vs necessário
- Tabela: últimos handoffs com motivo, vendedor, status
- Card: % conversão pós-transbordo (`converteu = true` / total)

### T4 — Métricas Origem (`/dashboard/gestao/origem`)
**Dados disponíveis:** `lead_profiles.origin`, `utm_campaigns.*`, `utm_visits.contact_id`
**Abordagem:**
- Hook `useOriginMetrics(instanceId, periodDays)` — query ad-hoc (sem view) via Supabase JS
- Tabela: canal, total leads, leads qualificados, ticket médio, % conversão
- PieChart: distribuição de leads por canal (reutilizar LeadsByOriginChart)
- Para UTM breakdown: `GROUP BY utm_source, utm_medium` — só para leads com match em utm_visits

### T5 — Metas Configuráveis
- CRUD simples: `instance_goals` (GET + UPSERT)
- UI: formulário dentro de modal em cada ficha ou página dedicada `gestao/metas`
- Componente `GoalProgressBar` reutilizável: `{current, target, label, unit?}`
- Integrar em cada ficha: buscar metas do instanceId e comparar com valor atual

---

## 9. Gaps e Riscos

| Item | Risco | Mitigação |
|---|---|---|
| BUG event name `handoff` vs `handoff_to_human` | ALTO — v_handoff_details vazia | Corrigir view em T0 antes de qualquer UI |
| Produtos/marcas buscados não logados | MÉDIO — feature S4 incompleta | Omitir no MVP; logar em future sprint (requer toque em HIGH RISK ai-agent) |
| `lead_profiles.average_ticket` pode estar vazio | MÉDIO — Ficha Origem incompleta | Mostrar null como `—`, documentar limitação |
| `tempo_pickup` exige subquery pesada | BAIXO | Calcular no JS pós-fetch, aceitar N queries para detalhe |
| Tabela `instance_goals` nova requer deploy de migration | BAIXO | Migration simples, sem FK complexa |
| Ficha Vendedor com `:sellerId` na URL | BAIXO | Padrão já usado em CampaignDetail e FlowDetail |

---

## 10. Estimativa de Tasks

| Task | Esforço | Dependências |
|---|---|---|
| T0: Migration — corrigir v_handoff_details + criar instance_goals | P | Nenhuma |
| T1: Hook useVendorDetail + VendorDetailPage + VendorKPICards | M | T0 (metas) |
| T2: Hook useAgentDetail + AgentDetailPage + gráficos | M | T0 (metas) |
| T3: Hook useHandoffMetrics + HandoffDetailPage + correção S4 | M | T0 (view correta) |
| T4: Hook useOriginMetrics + OriginMetricsPage + tabela UTM | M | Nenhuma |
| T5: GoalProgressBar + CRUD instance_goals + integração nas fichas | G | T0 (tabela) |
| T6: Sidebar — adicionar sub-items + App.tsx — rotas lazy | P | T1-T4 (pages criadas) |
| T7: Click-to-drill-down no SellerRankingChart | P | T1 (rota definida) |

Legenda: P = Pequeno (< 2h), M = Médio (2-4h), G = Grande (4-8h)

---

## Sources

- `supabase/migrations/20260417000002_s2_views.sql` — definição completa das 6 views
- `supabase/migrations/20260417000001_s2_schema.sql` — metadata JSONB, current_score, conversion_funnel_events
- `supabase/migrations/20260323100000_utm_campaigns.sql` — estrutura completa utm_campaigns + utm_visits
- `src/hooks/useManagerMetrics.ts` — hook central S3 com padrões React Query
- `src/hooks/useUserProfiles.ts` — padrão para seller_id → nome
- `src/components/manager/*.tsx` — todos os 7 componentes S3
- `src/pages/dashboard/ManagerDashboard.tsx` — página principal S3
- `src/components/dashboard/Sidebar.tsx` — collapsible Gestao atual + renderSubItem/renderCollapsible helpers
- `src/App.tsx` — rotas existentes + CrmRoute wrapper
- `supabase/functions/ai-agent/index.ts` — confirmação do bug event='handoff' (linha 2282)
- `supabase/functions/whatsapp-webhook/index.ts` — como track_id/track_source são persistidos em metadata

---

## RESEARCH COMPLETE
