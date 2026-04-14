---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-13 (M19-S5 IMPLEMENTADO — IA Conversacional)

### Sprint S5 implementado — 7 fases, ~13 arquivos

**P1: Migration aplicada em produção**
- `20260419000001_s5_assistant_tables.sql`
- Tabelas: `assistant_conversations` (histórico JSONB) + `assistant_cache` (dedup hash+TTL)
- RLS: user vê suas conversas, gerente/super_admin lê cache
- Trigger `set_updated_at`, cron cleanup cache a cada hora

**P2: assistantQueries.ts — 20 intents parametrizados**
- Cada intent usa PostgREST API (SEM SQL raw)
- Todas as queries filtram por `instance_id` (multi-tenant)
- Intents: leads_count, leads_by_origin, conversion_rate, top/worst_sellers, handoff_rate/reasons, agent_cost/efficiency, ia_vs_vendor, nps_average/by_seller, lead_score_distribution, hot_leads, funnel_stages, resolution_time, pending_conversations, daily_trend, goals_progress, seller_detail

**P3: Edge function assistant-chat**
- Auth: JWT + role check (super_admin/gerente) + instance access check
- Rate limit: 20 req/min via checkRateLimit
- Fluxo: Cache → NLU (gpt-4.1-mini, ~200 tokens) → Query → Format (gpt-4.1-mini, ~300 tokens)
- Cache: hash(message+instance_id), TTL 5min, upsert on conflict
- Conversas salvas em assistant_conversations (fire-and-forget)
- Config: verify_jwt=false em config.toml

**P4: useAssistantChat.ts**
- Hook React: messages state, loading, error, sendMessage, clearChat
- Lista conversas salvas via React Query
- Contexto automático por pathname
- Sugestões iniciais por página

**P5: Widget flutuante — 4 componentes**
- AssistantChatWidget: fixed bottom-6 right-6, toggle Ctrl+J, localStorage persist
- AssistantMessageBubble: bolha user/assistant, tabela inline, número destacado
- AssistantInput: Enter envia, Shift+Enter nova linha, auto-resize
- AssistantSuggestions: chips clicáveis
- Montado em DashboardLayout (desktop + mobile)

**P6: Página /dashboard/assistant**
- Sidebar esquerda: histórico de conversas
- Área principal: chat full-screen + sugestões
- Rota: CrmRoute (super_admin + gerente)
- Sidebar nav: sub-item "Assistente IA" com ícone Sparkles

**P7: Build + validação**
- tsc: 0 erros | npm run build: sucesso (10.53s)

### Auditoria S5 — 3 agentes paralelos, 6 bugs corrigidos

**Auditoria (code quality + edge fn + localStorage sync):**

**Bug 1 (CRITICAL — localStorage.setItem em render):** 5 páginas de gestão executavam `localStorage.setItem()` no corpo do render (anti-pattern React). Fix: movido para `useEffect([effectiveInstanceId])`.

**Bug 2 (CRITICAL — widget não reativo):** Widget lia localStorage apenas no mount. Mudança de instância no dashboard não atualizava widget. Fix: `CustomEvent('wp-instance-change')` disparado pelo dashboard, widget escuta via `addEventListener`.

**Bug 3 (CRITICAL — cache upsert R36):** `.upsert({ onConflict: 'instance_id,query_hash' })` falha — PostgREST não resolve constraint por nomes de colunas (regra R36). Fix: DELETE+INSERT sequencial (fire-and-forget).

**Bug 4 (HIGH — role check crash dual roles):** `.in('role', [...]).maybeSingle()` crashava se user tinha 2 roles (super_admin + gerente). Fix: `.limit(1)` antes de `.maybeSingle()`.

**Bug 5 (HIGH — leads_count limite 1000):** `data?.length` retornava máximo 1000 (default PostgREST). Fix: `{ count: 'exact', head: true }` retorna count real sem transferir dados.

**Bug 6 (MEDIUM — saveToConversation type):** `InstanceType<typeof Object>` é tipo sem sentido. Fix: `any` com lint ignore.

**Deploy v2:** Edge function `assistant-chat` redeployada com todos os fixes.
**Build:** tsc 0 erros | npm run build ok

---

## 2026-04-13 (M19-S5 PLANEJADO — IA Conversacional)

### Sprint S5 planejado — 7 fases, auditoria completa

**Pesquisa:**
- Exploração do codebase com 3 agentes paralelos: gestão (13 componentes, 6 hooks, 4 páginas), AI agent (35 edge functions, callLLM, shared utils), views SQL (6 views S2)
- Confirmado: callLLM funciona com `tools: []`, Ctrl+J livre, widget monta após Outlet

**Plano criado:** `.planning/m19-s5-PLAN.md` (v2 pós-auditoria)
- P1: Migration (assistant_conversations + assistant_cache + RLS + RPC)
- P2: assistantQueries.ts (20 intents parametrizados via PostgREST)
- P3: Edge function assistant-chat (NLU → query → formatação)
- P4: useAssistantChat.ts (hook React Query)
- P5: Widget flutuante (4 componentes, Ctrl+J, fixed bottom-right)
- P6: Página /dashboard/assistant (full-screen + histórico)
- P7: Build + testes + vault

**Auditoria (3 agentes paralelos):**
- Segurança: text-to-SQL REMOVIDO (HIGH RISK). Só queries parametrizadas.
- Viabilidade: callLLM OK, Ctrl+J OK, DashboardLayout OK
- Consistência: página movida para subfolder, imports @/, naming OK

**Decisões documentadas:** wiki/decisoes-chave.md (3 decisões S5)

---

## 2026-04-13 (M19-S4 COMPLETO — Fichas Individuais)

### Sprint S4 concluído — 7 planos, 20 commits, 27 novos arquivos

**Planos executados:**
- P1: Migration `20260418000001` — corrige v_handoff_details + v_agent_performance (event 'handoff') + cria instance_goals
- P2: Ficha Vendedor — useManagerInstances + useVendorDetail + VendorKPICards + VendorTrendChart + VendorDetailPage + drill-down SellerRankingChart
- P3: Ficha Agente IA — useAgentDetail + AgentKPICards + AgentCostChart + AgentFollowUpStats + AgentDetailPage
- P4: Painel Transbordo — useHandoffMetrics + HandoffKPICards + HandoffMotivosChart + HandoffEvitavelChart + HandoffRecentTable + HandoffDetailPage
- P5: Métricas de Origem — useOriginMetrics + OriginChannelTable + OriginUTMBreakdown + OriginMetricsPage
- P6: Metas Configuráveis — useInstanceGoals + GoalProgressBar + GoalsConfigModal + integração nas 5 páginas
- P7: Navegação — 4 rotas no App.tsx + 3 sub-items no Sidebar + build final ok

**Resultados:**
- 6 hooks novos (useManagerInstances + useVendorDetail + useAgentDetail + useHandoffMetrics + useOriginMetrics + useInstanceGoals)
- 13 componentes novos em src/components/gestao/
- 4 páginas em src/pages/dashboard/gestao/
- 1 migration SQL aplicada em produção
- tsc: 0 erros | npm run build: SUCCESS (6.36s)

---

## 2026-04-13 (M19-S4 Plano 2)

### feat(m19-s4-p2): Ficha do Vendedor (commits c0f9a17, 9e97453, de2380b)

**useManagerInstances.ts (novo):** Hook extraído inline de ManagerDashboard. queryKey `['manager-instances']` preservado. ManagerDashboard.tsx: substituído inline por import.

**useVendorDetail.ts (novo):** 3 queries paralelas via Promise.all — `v_vendor_activity` (atividade diária), `poll_messages` (NPS), `conversations` (pendentes/contacts). Interfaces `VendorKPIs`, `VendorTrendDay`, `VendorDetail`. Bug corrigido (Rule 1): `convIds` movido para escopo correto antes do bloco NPS.

**VendorKPICards.tsx (novo):** Grid 6 StatsCards — Conversas, Resolvidas, Taxa Resolução, Tempo Médio, NPS Médio, Ticket Médio. Padrão idêntico ao ManagerKPICards.

**VendorTrendChart.tsx (novo):** LineChart Recharts — Conversas (azul) + Resolvidas (verde), tooltip com tempo médio de resolução. Padrão idêntico ao LeadsTrendChart.

**VendorDetailPage.tsx (novo):** Header + botão Voltar + ManagerFilters + VendorKPICards + VendorTrendChart em LazySection. Auto-seleciona instância igual ao ManagerDashboard. Usa useUserProfiles para nome do vendedor.

**SellerRankingChart.tsx (editado):** drill-down onClick → `navigate('/dashboard/gestao/vendedor/' + seller.sellerId)`. Cursor pointer + hover bg-primary/10.

**App.tsx (editado):** Rota `gestao/vendedor/:sellerId` registrada como CrmRoute com VendorDetailPage lazy.

**tsc:** 0 erros.

---

## 2026-04-13 (M19-S4 Plano 1)

### feat(m19-s4-p1): Infraestrutura — Correção de Views + Tabela instance_goals (commit 4ea32fe)

**Migration:** `supabase/migrations/20260418000001_s4_fix_handoff_view_and_goals.sql` — aplicada em produção.

**Bug corrigido (v_handoff_details):** View filtrava `WHERE event = 'handoff_to_human'` mas ai-agent insere `event = 'handoff'` (linha 2282 index.ts). Resultado: ZERO linhas em produção. Corrigido para `IN ('handoff', 'handoff_to_human', 'handoff_trigger')`. Adicionados campos `evitavel` e `converteu` (boolean).

**Bug corrigido (v_agent_performance):** Mesmo problema no COUNT de handoffs. Corrigido para contar todos os 3 eventos.

**v_ia_vs_vendor recriada:** DROP CASCADE em v_agent_performance derrubou v_ia_vs_vendor automaticamente. Recriada na mesma migration.

**Tabela instance_goals criada:** id/instance_id/metric_key/target_value/period/created_by/created_at/updated_at. CHECK constraints em metric_key (6 valores) e period (3 valores). RLS com `is_super_admin()` (ALL) e `is_gerente()` (SELECT). Trigger `set_updated_at`.

**Desvios Rule 1 aplicados:**
1. `CREATE OR REPLACE VIEW` rejeitado (SQLSTATE 42P16) — colunas reordenadas. Solução: DROP+CREATE.
2. Policies `user_profiles.role` não existe — corrigido para `is_super_admin()/is_gerente()` (padrão do projeto).

**tsc:** 0 erros.

---

## 2026-04-13

### feat(m19-s3): Dashboard do Gestor — /dashboard/gestao (commit 4c834af)

**11 arquivos criados, tsc 0 erros.**

**Hook `useManagerMetrics`:** Promise.all em 6 views S2 (`v_lead_metrics`, `v_vendor_activity`, `v_agent_performance`, `v_conversion_funnel`, `v_ia_vs_vendor`, `poll_messages`). Todas as queries usam `as any` (views não tipadas no types.ts). NPS busca poll_responses somente se há polls no período.

**Componentes criados (`src/components/manager/`):**
- `ManagerFilters` — instância + período, reutiliza padrão DashboardFilters
- `ManagerKPICards` — 6 KPIs via StatsCard (leads novos, conversão, transbordo, NPS, custo IA, score médio)
- `LeadsTrendChart` — linha recharts leads + conversões por dia
- `LeadsByOriginChart` — pizza recharts por origem (bio/campanha/formulário/direto)
- `ManagerConversionFunnel` — barras shadow por etapa com taxa de drop entre etapas (distinto de FunnelConversionChart M16)
- `IAvsVendorComparison` — tabela comparativa 5 métricas IA vs vendedor
- `SellerRankingChart` — ranking com useUserProfiles para resolver seller_id → nome

**Página:** `ManagerDashboard` — auto-seleciona primeira instância, lazy loading com LazySection, empty state claro se sem instância/dados.

**Rota:** `/dashboard/gestao` com `CrmRoute` (super_admin + gerente). Sidebar: collapsible "Gestao" com ícone LineChart após Leads.

**Decisão de auditoria aplicada:** `ConversionFunnelChart` renomeado para `ManagerConversionFunnel` para evitar conflito com `FunnelConversionChart` (M16). KPI "Leads Novos" conta leads com ≥1 conversa na instância (limitação da view LEFT JOIN).

---

> Entradas de M19 S1+S2 (shadow, agregação, deploy) arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas de 2026-04-12 (agent fixes, clear context, discuss métricas) arquivadas em:
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
