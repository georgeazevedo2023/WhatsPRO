---
title: Plano de Implementação — Métricas & IA Conversacional (v2 — auditado)
tags: [plano, sprints, metricas, shadow, dashboard, ia-conversacional]
sources: [discussao-2026-04-12, agentes-planejamento, auditoria-2026-04-12]
updated: 2026-04-12
---

# Plano de Implementação — Métricas & IA Conversacional

> **v2 — Corrigido após auditoria.** Questões críticas resolvidas: FK seller_id, S5 dividido, HIGH RISK + SYNC RULE em S1, gaps de cobertura preenchidos.

## Visão Geral — 7 Sprints

| Sprint | Nome | Tasks | Dep. | Paralelo com |
|--------|------|-------|------|-------------|
| **S1** | Shadow Inteligente (Coleta) | T1-T8 | — | — |
| **S2** | Armazenamento & Agregação | T1-T8 | S1 parcial | — |
| **S3** | Dashboard do Gestor | T1-T10 | S2 | S4 |
| **S4** | Fichas Individuais | T1-T12 | S2 | S3 |
| **S5** | IA Conversacional | T1-T10 | S2-S4 | — |
| **S6** | NPS Automático | T1-T5 | S2 | S5 |
| **S7** | Alertas Proativos | T1-T5 | S2 | S5, S6 |

**S3 e S4 rodam em paralelo** (ambos dependem de S2, não entre si).
**S5, S6, S7** são independentes entre si — podem ser paralelos após S2.

---

## Sprint 1 — Shadow Inteligente (Coleta)

**Meta:** Shadow bilateral: extrai dados do lead E do vendedor.

**REGRA HIGH RISK:** `ai-agent/index.ts` é HIGH RISK per CLAUDE.md. Toda task requer: branch separada, testes E2E antes/depois, aprovação explícita do usuário.

**SYNC RULE:** Alteração no AI Agent → sincronizar: (1) DB, (2) types.ts, (3) Admin UI, (4) ALLOWED_FIELDS, (5) Backend, (6) Prompt, (7) defaults, (8) Docs.

| # | Task | Arquivos | Tam. |
|---|------|----------|------|
| T1 | Rotear `fromMe:true` para shadow: `shouldTriggerShadowFromWebhook()` em aiRuntime.ts + bloco condicional no webhook (sem debounce, payload `shadow_only:true`) | aiRuntime.ts, whatsapp-webhook | M |
| T2 | Refatorar shadow bilateral: 2 prompts distintos (`shadowPromptLead` + `shadowPromptVendor`), contexto das últimas 5 msgs, detecção `shadow_only:true` | ai-agent/index.ts (L707-801) | L |
| T3 | Tags expandidas lead: `objecao:*`, `concorrente:*`, `intencao:*`, `motivo_perda:*`, `conversao:*`, `dado_pessoal:*` | ai-agent/index.ts, agentHelpers.ts | M |
| T4 | Tags expandidas vendedor: `vendedor_tom:*`, `vendedor_desconto:*`, `vendedor_upsell:*`, `vendedor_followup:*`, `vendedor_alternativa:*`, `venda_status:*`, `pagamento:*` | ai-agent/index.ts | M |
| T5 | Gravar em `shadow_extractions` (tabela já existe, nunca populada): nova tool `extract_shadow_data` com 7 dimensões | ai-agent/index.ts | M |
| T6 | Pré-filtro msgs triviais: <5 chars, só emojis, "ok/sim/blz" → pular LLM, logar `shadow_skipped_trivial` | ai-agent/index.ts | S |
| T7 | Logging: eventos `shadow_extraction_lead` vs `shadow_extraction_vendor` com tokens, custo, tags setadas | ai-agent/index.ts | S |
| T8 | **Testes E2E obrigatórios** (HIGH RISK): regressão IA ligada + shadow lead + shadow vendedor + pré-filtro. Testar que `fromMe:true` em `status_ia=ligada` NÃO dispara shadow | test_e2e_agent.sh | M |

**Riscos:** LLM alucinando tags → validar contra vocabulário definido; volume `fromMe` → pré-filtro T6; `wasSentByApi` → verificar filtro n8n + check no webhook.

---

## Sprint 2 — Armazenamento & Agregação

**Meta:** Dados brutos → métricas consultáveis. Cron hourly + daily.

| # | Task | Arquivos | Tam. |
|---|------|----------|------|
| T1 | **Migration corretiva:** `ALTER shadow_metrics.seller_id` para referenciar `auth.users(id)` em vez de `contacts(id)` | migration | S |
| T2 | Views SQL com filtro `instance_id` obrigatório: `v_lead_metrics`, `v_vendor_activity`, `v_handoff_details`, `v_agent_performance`, `v_conversion_funnel`, `v_ia_vs_vendor` | migration | M |
| T3 | Edge Function `aggregate-metrics`: processa por instância, calcula daily para `shadow_metrics`. Fallback: usa `ai_agent_logs` se `shadow_extractions` vazia | functions/aggregate-metrics/ | L |
| T4 | Consolidação weekly/monthly: modo `daily_consolidation` agrega dailies | aggregate-metrics (mesmo) | M |
| T5 | pg_cron entries: hourly (`0 * * * *`) + daily (`30 0 * * *`) | migration | S |
| T6 | Capturar `track_id`/`track_source` do payload UAZAPI no webhook → salvar em `lead_profiles.metadata`. Capturar UTM params de bio/forms | whatsapp-webhook, aggregate-metrics | M |
| T7 | `lead_score_history` + `lead_profiles.current_score` persistido. Score alimentado por shadow (dados extraídos incrementam score) | migration, aggregate-metrics | M |
| T8 | **Funil de conversão por etapas:** tabela `conversion_funnel_events` (contato → qualificação → intenção → conversão). Shadow detecta transição entre etapas e insere evento com timestamp | migration, ai-agent shadow | M |

**Riscos:** Cron timeout 60s → paginar; FK seller_id corrigida em T1; multi-tenant em todas as views (T2).

---

## Sprint 3 — Dashboard do Gestor (paralelo com S4)

**Meta:** `/dashboard/gestao` com KPIs, gráficos e filtros. Reutilizar componentes de `Intelligence.tsx` onde possível.

| # | Task | Arquivos | Tam. |
|---|------|----------|------|
| T1 | Página + rota + sidebar collapsible "Gestão" com sub-items | ManagerDashboard.tsx, App.tsx, Sidebar.tsx | S |
| T2 | Filtros: período, vendedor, origem, tipo_cliente, instância. Reutilizar padrão `DashboardFilters.tsx` | ManagerFilters.tsx | M |
| T3 | Hook `useManagerMetrics` (Promise.all). Reutilizar patterns de `usePollMetrics.ts` | useManagerMetrics.ts | L |
| T4 | KPI Cards (6): leads novos, taxa conversão, taxa transbordo, NPS médio, custo IA, score médio leads | ManagerKPICards.tsx (reutilizar StatsCard) | S |
| T5 | Pizza: leads por origem | LeadsByOriginChart.tsx | S |
| T6 | Linha: tendência temporal (leads + conversões overlay) | LeadsTrendChart.tsx | S |
| T7 | Barras: ranking vendedores (conversão, tempo, NPS) | SellerRankingChart.tsx | M |
| T8 | **Funil de conversão visual:** contato → qualificação → intenção → conversão (BarChart horizontal com taxas entre etapas) | ConversionFunnelChart.tsx | M |
| T9 | **Comparativo IA vs Vendedor:** cards lado a lado (tempo resposta, conversão, custo, NPS, cobertura) | IAvsVendorComparison.tsx | M |
| T10 | Composição final + lazy loading + testes | ManagerDashboard.tsx, __tests__/ | M |

---

## Sprint 4 — Fichas Individuais (paralelo com S3)

**Rotas:** `/dashboard/gestao/vendedor/:userId`, `/agente-ia`, `/transbordo`, `/origens`

| # | Task | Tam. |
|---|------|------|
| T1-T3 | **Ficha vendedor:** KPIs (conversão, tempo resposta, tempo resolução, msgs até fechar, NPS, ticket médio, conversas simultâneas), histórico, evolução temporal, pontos fortes/fracos | L |
| T4-T5 | **Ficha agente IA:** eficiência, custo breakdown por modelo, validator scores, tools usage, follow-up stats (enviados, taxa reativação, tempo ideal, conteúdo que reativa, por estágio), produtos mais buscados, marcas mais pedidas | L |
| T6-T7 | **Painel transbordo:** motivos agregados, tempo pickup, **evitável vs necessário** (classificação por reason), **lead desistiu esperando** (pending_responses), **conversão pós-transbordo**, qualidade do transbordo (dados entregues ao vendedor) | L |
| T8-T9 | **Métricas origem:** ROI por canal, conversão por origem, volume, tendência, **UTM breakdown**, ticket médio por canal | M |
| T10 | Navegação entre fichas + sub-nav + links do dashboard | M |
| T11 | **Metas configuráveis** por instância: tempo resposta < Xmin, conversão > Y%, NPS > Z (admin configura, dashboard mostra vs real) | M |
| T12 | Testes | M |

---

## Sprint 5 — IA Conversacional (separado de NPS e Alertas)

**Meta:** Gestor pergunta em linguagem natural sobre seus dados.

**Decisões:** NLU + ~20 queries parametrizadas + fallback text-to-SQL restrito contra VIEWs. GPT-4.1-mini. Widget flutuante + página dedicada.

| # | Task | Tam. |
|---|------|------|
| T1 | VIEWs read-only para IA (8 views com `WHERE instance_id` obrigatório) + RLS | M |
| T2 | Biblioteca de queries parametrizadas (`assistantQueries.ts`): 20 intents | M |
| T3 | SQL Validator: whitelist VIEWs, anti-injection, `SELECT` only, timeout 5s, log auditoria | M |
| T4 | Edge Function `assistant-chat`: NLU → query → formatação. Rate limit 20/min | L |
| T5 | Tabelas: `assistant_conversations` + `assistant_cache` (hash+TTL) | S |
| T6 | Hook `useAssistantChat` (estado, loading, sugestões, histórico) | M |
| T7 | Widget flutuante: chat no canto inferior direito, Ctrl+J toggle, contexto da página atual | L |
| T8 | Página `/dashboard/assistant`: conversas longas + histórico lateral | M |
| T9 | Sugestões contextuais por página + follow-up após cada resposta | S |
| T10 | Testes (validator, queries, widget, segurança multi-tenant) | M |

---

## Sprint 6 — NPS Automático (independente)

**Meta:** Pesquisa de satisfação pós-atendimento vinculada ao vendedor.

| # | Task | Tam. |
|---|------|------|
| T1 | `npsDispatcher.ts`: disparo NPS após resolução de conversa com handoff. Delay configurável (`ai_agents.poll_nps_delay_minutes`). Usa `process-jobs` para agendar | M |
| T2 | Vínculo vendedor: `poll_messages` com `is_nps=true` + metadata `assigned_to`. Join por `conversation_id → conversations.assigned_to` | M |
| T3 | Auto-tags: `nps:4`, `nps_vendedor:nome` no lead. Alerta para nota ruim se `poll_nps_notify_on_bad=true` | S |
| T4 | View `v_nps_by_seller`: NPS médio por vendedor, evolução temporal, comentários | S |
| T5 | Testes: disparo correto, vínculo vendedor, alerta nota ruim | M |

---

## Sprint 7 — Alertas Proativos (independente)

**Meta:** Notificações automáticas para condições críticas.

| # | Task | Tam. |
|---|------|------|
| T1 | Edge Function `process-alerts` (cron 5min): 6 tipos de alerta. Reutiliza tabela `notifications` (já existe, M17) | L |
| T2 | Tipos: `lead_waiting` (>Xmin), `nps_dropping` (queda >1pt), `seller_underperforming` (<50% média), `followup_overdue` (>2d), `high_handoff_rate` (>40%), `hot_lead_unattended` (score>70, >30min) | M |
| T3 | `NotificationBell.tsx` no header: badge count, dropdown, marcar lidas. Supabase Realtime para updates instantâneos | M |
| T4 | Configuração de thresholds por instância: admin define limites, opção silenciar tipos | S |
| T5 | Testes: cada tipo dispara, não duplica, realtime funciona | M |

---

## Cobertura de Gaps (22/22 resolvidos pós-auditoria)

Críticos: FK seller_id (S2:T1), S5 dividido (S5+S6+S7), HIGH RISK testes (S1:T8), SYNC RULE (S1 header), multi-tenant views (S2:T2).

Gaps preenchidos: funil de conversão (S2:T8+S3:T8), comparativo IA vs vendedor (S3:T9), follow-up lead+vendedor (S4), tempo resolução+msgs até fechar+conversas simultâneas (S4:T1-T3), metas configuráveis (S4:T11), transbordo evitável/desistiu/conversão (S4:T6-T7), UTMs (S2:T6), NPS (S6), alertas (S7), track_id (S2:T6), reutilizar Intelligence.tsx (S3).

---

## Estrutura de Diretórios Final

```
src/components/
  manager/                           # S3+S4
    ManagerFilters.tsx, ManagerKPICards.tsx, ManagerSubNav.tsx
    ConversionFunnelChart.tsx, IAvsVendorComparison.tsx
    seller/, agent/, handoff/, origin/
  assistant/                         # S5
    AssistantChatWidget.tsx, AssistantMessage.tsx, AssistantInput.tsx
  dashboard/
    NotificationBell.tsx, NotificationPanel.tsx  # S7
src/hooks/
  useManagerMetrics.ts               # S3
  useSellerProfile.ts, useAIAgentMetrics.ts  # S4
  useHandoffMetrics.ts, useOriginMetrics.ts  # S4
  useAssistantChat.ts                # S5
  useNotifications.ts                # S7
src/pages/dashboard/
  ManagerDashboard.tsx               # S3
  SellerProfile.tsx, AIAgentMetrics.tsx  # S4
  HandoffPanel.tsx, OriginMetrics.tsx    # S4
  Assistant.tsx                      # S5
supabase/functions/
  aggregate-metrics/                 # S2
  assistant-chat/                    # S5
  process-alerts/                    # S7
  _shared/
    assistantQueries.ts, sqlValidator.ts  # S5
    npsDispatcher.ts                 # S6
```
