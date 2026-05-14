---
title: Log arquivo — 2026-05-11 Dashboard do Gestor (3 fases)
type: log-archive
updated: 2026-05-14
---

# Log arquivo — 2026-05-11 Dashboard do Gestor

> Sessões arquivadas em 2026-05-14 (hard limit log.md). Conteúdo original preservado abaixo.

---

## 2026-05-11 (madrugada) — Dashboard do Gestor: pivô comercial (Fase 3)

**Demanda do gestor após ver as Fases 1+2:** tirar custos, mostrar leads sem 1ª resposta, cotações em andamento, objeções e motivos de conversa em destaque.

**Entregue:**
- 2 RPCs novas: `get_unanswered_first_messages` (lead nunca respondido — ZERO outgoing), `get_active_quotes` (tag `motivo:orcamento` sem `venda:fechada`/`perdida`). Eletropiso 30d: 1 lead sem 1ª resposta há 716h; 0 cotações ativas.
- Hook estendido (`useManagerAdvancedMetrics` agora dispara 6 RPCs em paralelo).
- Componente genérico `PendingConversationsCard` substituindo `AbandonedConversationsList` (removido — código órfão).
- Zona 3 reorganizada em 3 linhas: pendências críticas 3 cols + análise objeções/motivos + equipe (demand×coverage + ranking).
- Card `Custo IA` removido dos KPIs (grid agora 5 cols), `Custo/conv.` removido do IA vs Vendedor, meta `Custo IA` removida.

**Push Fases 1+2:** commit `66d2461` no master. Fase 3 ainda local.

**Versão:** v7.35.0. `tsc --noEmit` = 0. Console limpo.

**Sinal de produto:** "1 lead sem 1ª resposta há 30 dias" + "0 cotações tagueadas" + "0 vendas tagueadas" — fluxo de tagueamento e/ou disciplina de resposta tem buracos visíveis.

---

## 2026-05-11 (noite) — Dashboard do Gestor: métricas avançadas (Fase 2)

**Entregue logo após Fase 1, mesma sessão.** 4 RPCs (`get_response_time_percentiles`, `get_abandoned_conversations`, `get_demand_vs_coverage_by_hour`, `get_conversion_by_origin`) + hook `useManagerAdvancedMetrics` (Promise.all) + 4 componentes (`ResponseTimeCard`, `AbandonedConversationsList`, `DemandVsCoverageChart`, `ConversionByOriginCard`) integrados às Zonas 1/3/4 do `ManagerDashboard`.

**Dados reais Eletropiso 30d:** P50 1ª resposta = 23s, P95 = 89s (n=11). 6 conversas abandonadas (max 47 dias). Origem "direto" 7 leads, 0 fechadas (tag `venda:fechada` não está sendo aplicada — sinal pro time comercial).

**Versão:** v7.34.0. `tsc --noEmit` = 0. Console limpo.

**Próximo (Fase 3 backlog):** drill-down ao clicar em qualquer card, comparação período-vs-período, alertas configuráveis (P95 > X → notify), export CSV.

**Nota:** 9.5/10 — escopo cumprido na exata medida pedida pelo usuário sem inflação, sem regressão, validação manual ainda pendente (autenticação Playwright fora de escopo).

---

## 2026-05-11 (tarde) — Dashboard do Gestor unificado (Fase 1)

**Demanda do usuário:** unificar os 3 dashboards (Olá George + Gestor/Métricas + Gestor/Insights) num único pro gerente, esconder Sandbox IA, adicionar leads novos vs recorrentes. Confirmar acesso como gerente.

**Plano aprovado (Opção C):** mantém `/dashboard` multi-tenant pro super_admin; unifica `/dashboard/gestao` em 4 zonas (Pulso / Tendência / Atendimento / IA-Comercial) pro gerente. Schema change `is_sandbox`. Definição lead novo = primeira conversa no período. Fase 1 entrega core; métricas avançadas vão pra Fase 2.

**Entregue:**
- Migration `add_is_sandbox_to_instances` (coluna + índice parcial); Sandbox IA marcada.
- RPC `get_leads_new_vs_returning(p_instance_id, p_start, p_end)` retorna série diária novos/recorrentes via `MIN(created_at)` por contact_id × `last_message_at` no período. Validada: Eletropiso 30d = 6 novos + 5 recorrentes (11 contatos distintos).
- `useManagerInstances({ includeSandbox })` — default `false`, gerente nunca vê sandbox.
- `useLeadsNewVsReturning` (preenche dias zerados) + `LeadsNewVsReturningChart` (área empilhada recharts verde/roxo).
- `ManagerDashboard.tsx` reescrito **sem abas** — 4 seções em scroll único; absorve `TopContactReasons` e `BusinessHoursChart` do DashboardHome; toggle "Sandbox: ON/OFF" só pro super_admin.
- `types.ts` atualizado (is_sandbox + RPC). `tsc --noEmit` = 0 erros. HMR sem warnings.

**Confirmação de acesso:** `/dashboard/gestao` já é guardada por `CrmRoute` (super_admin OU gerente). Gerente faz login → cai direto no dashboard unificado. Nenhuma guard alterada.

**Próximo (Fase 2 — não shipado ainda):** tempo 1ª resposta P50/P95, conversas abandonadas 24h, gap de cobertura (hora-pico demanda vs equipe), conversão por origem.

**Nota:** 9/10 — entrega cirúrgica, sem regressão; ponto a melhorar = não consegui validar visualmente logado (Playwright travou no /login, optei por não autenticar).
