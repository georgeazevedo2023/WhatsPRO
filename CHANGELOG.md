---
title: Changelog
type: changelog
updated: 2026-05-11
audited_at: 2026-05-11
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.35.1 (2026-05-12) — Dashboard do Gestor: botão limpar pendências

**Demanda:** gestor precisa tirar itens irrelevantes (spam tipo "Zig Online", testes) das listas de pendência sem mexer no helpdesk em si.

**DB:**
- Migration `rpc_dispense_dashboard_conversation` cria 2 RPCs `SECURITY DEFINER`:
  - `dispense_conversation_from_dashboard(conversation_id)` — append tag `dashboard:dispensed` (preserva resto do array via `DISTINCT unnest`, segue regra `NEVER empty tags`).
  - `restore_conversation_to_dashboard(conversation_id)` — `array_remove` da mesma tag.
- As 3 RPCs de pendência (`get_unanswered_first_messages`, `get_abandoned_conversations`, `get_active_quotes`) ganham `AND NOT ('dashboard:dispensed' = ANY(c.tags))`.

**Frontend:**
- `PendingConversationsCard` ganha botão **X** ao lado do link externo em cada item — tooltip "Remover da lista (spam, teste, já resolvida)".
- Toast com botão **"Desfazer"** (Sonner action) chama `restore_conversation_to_dashboard` e re-invalida queries.
- Toast verde no sucesso, vermelho em erro. Estados isolados por item.
- `useQueryClient().invalidateQueries({ queryKey: ['manager-advanced'] })` força re-fetch das 3 RPCs após dispense/undo.

**Não afeta:** helpdesk segue mostrando a conversa normalmente. Conversa não é arquivada nem alterada operacionalmente — só ganha tag de UI.

**Verificação:** smoke test SQL completo (dispense → tag aparece → query filtra → restore → tag removida). `tsc --noEmit` = 0. Console limpo.

---

### v7.35.0 (2026-05-11) — Dashboard do Gestor: pivô comercial (Fase 3)

**Contexto:** gestor pediu para ver foco comercial em vez de custo IA. Demandas: tirar custos, adicionar lista de leads sem 1ª resposta, cotações em andamento, top objeções e motivos de conversa em destaque.

**Removido:**
- Card `Custo IA` dos KPIs (ManagerKPICards) — grid agora 5 colunas.
- Linha `Custo/conv.` do `IAvsVendorComparison`.
- Barra de meta `Custo IA` no painel de goals.

**DB — 2 RPCs novas (migrations `rpc_unanswered_first_messages` + `rpc_active_quotes`):**
- `get_unanswered_first_messages(instance, days_lookback)` — conversas com ≥1 incoming e ZERO outgoing. Diferente de `get_abandoned_conversations` (que olha última msg). Validada Eletropiso: 1 lead esperando há 716h.
- `get_active_quotes(instance)` — conversas com tag `motivo:orcamento` sem `venda:fechada` nem `venda:perdida`. Retorna contato + horas desde última msg. Validada: 0 ativas (consistente com 0 cotações no período).

**Frontend:**
- `useManagerAdvancedMetrics` agora retorna `unanswered` e `activeQuotes` (Promise.all com 6 RPCs).
- Novo componente genérico `PendingConversationsCard` (substitui `AbandonedConversationsList`, que foi removido) — reutilizável para 3 widgets de pendência com badges de severidade.
- Reorganização da **Zona 3 Atendimento** em 3 linhas:
  1. Pendências críticas (grid 3 cols): Sem 1ª resposta · Sem resposta +24h · Cotações em andamento.
  2. Análise (grid 2 cols): Top objeções (promovido do InsightsTab) + Motivos de conversa (`TopContactReasons` com agrupamento por AI).
  3. Equipe (grid 2 cols): Demanda vs Cobertura + Ranking de vendedores.
- `useDashboardInsights` adicionado ao `ManagerDashboard` (deduplica com `InsightsTab` via React Query).

**Verificação:** `tsc --noEmit` = 0 erros, HMR sem warnings, console limpo no redirect `/login`. Commit anterior (Fases 1+2) deployado em `66d2461`.

---

### v7.34.0 (2026-05-11) — Dashboard do Gestor: métricas avançadas (Fase 2)

**Contexto:** Fase 1 (v7.33.0) unificou as superfícies. Fase 2 adiciona as 4 métricas que o gestor precisa pra agir, não só ver: quanto a equipe demora, quem ficou pendurado, em que horário a casa some, qual canal converte.

**DB — 4 RPCs novas (migration `rpc_manager_phase2_advanced_metrics`):**

- `get_response_time_percentiles(instance, start, end)` — P50/P95 em segundos do tempo entre a 1ª msg incoming e a 1ª outgoing de cada conversa no período. Validada Eletropiso 30d: P50 = 23s, P95 = 89s, n = 11.
- `get_abandoned_conversations(instance, hours_threshold default 24)` — última msg da conversa é incoming + mais antiga que threshold. Retorna contato + horas esperando. Validada: 6 conversas abandonadas, max 1132h (~47 dias).
- `get_demand_vs_coverage_by_hour(instance, start, end)` — buckets 0-23 (TZ `America/Sao_Paulo`) com `demand` (incoming) e `coverage` (outgoing). Identifica gap de cobertura.
- `get_conversion_by_origin(instance, start, end)` — por `v_lead_metrics.origin`, total de leads × leads com tag `venda:fechada` × taxa %. Tags em jsonb, suporta `?` operator E array contains.

Todas `STABLE SECURITY INVOKER`, grant `authenticated`, search_path locked. types.ts atualizado com as 4 assinaturas.

**Frontend:**

- `useManagerAdvancedMetrics(instanceId, periodDays, abandonedHoursThreshold)` — `Promise.all` das 4 RPCs, retorna `{responseTime, abandoned, hours, conversionByOrigin}` com normalização Number().
- `ResponseTimeCard` — 2 colunas (P50 + P95) com `fmt()` adaptativo (s/m/h) e `tone()` por faixa (verde <1min, âmbar <30min, vermelho ≥30min).
- `AbandonedConversationsList` — lista top 8 com link direto pra conversa no helpdesk, badge de severidade por tempo (<48h amber, <168h orange, >7d red). Empty state celebra equipe em dia.
- `DemandVsCoverageChart` — ComposedChart recharts: barras rosé pra demanda (lead) + linha sky pra cobertura (casa) + badges destacando hora-pico de cada série.
- `ConversionByOriginCard` — tabela compacta `Origem | Leads | Fechadas | Conv.%` com `tone()` por taxa.
- `ManagerDashboard.tsx` integra os 4 componentes nas zonas:
  - **Zona 1** (Pulso) ganha `ResponseTimeCard` abaixo dos KPIs.
  - **Zona 3** (Atendimento) ganha grid 2×1 com `AbandonedConversationsList` + `DemandVsCoverageChart` no topo.
  - **Zona 4** (IA & Comercial) substitui o lado direito do funil por `ConversionByOriginCard`; `IAvsVendorComparison` ganha linha própria abaixo.

**Verificação:** `tsc --noEmit` = 0 erros. HMR sem warnings. Console limpo no redirect `/login`. RPCs validadas com dados reais Eletropiso.

---

### v7.33.0 (2026-05-11) — Dashboard do Gestor unificado (Fase 1)

**Contexto:** gestor tinha 3 superfícies separadas (`/dashboard` "Olá George" + `/dashboard/gestao` Métricas + Insights) e Sandbox IA poluía métricas de produção (11.955 participantes da sandbox somavam com Eletropiso). Faltava segmentação leads novos vs recorrentes.

**DB:**
- Migration `add_is_sandbox_to_instances`: coluna `is_sandbox boolean NOT NULL DEFAULT false` em `instances` + índice parcial. Sandbox IA (`rb84e079eeab167`) marcada.
- RPC `get_leads_new_vs_returning(p_instance_id, p_start, p_end)`: série diária. Novo = primeira conversa do contato (`MIN(conversations.created_at)` por inbox da instância) caiu no período. Recorrente = contato existia antes do período e voltou. `SECURITY INVOKER`, grant para `authenticated`.

**Frontend:**
- `useManagerInstances({ includeSandbox })` (default `false`) — exclui sandbox do dropdown.
- `useLeadsNewVsReturning` — chama RPC, preenche dias zerados, retorna `{series, totals}`.
- `LeadsNewVsReturningChart` — área empilhada (recharts) verde/roxo + badges com totais no header.
- `ManagerDashboard.tsx` **reescrito sem abas**, 4 zonas em scroll único:
  1. **Pulso do período** — KPIs (6 cards) + barras de meta opcionais.
  2. **Tendência & volume** — Novos/Recorrentes + Tendência + Origem + Horário das Conversas (absorvido do DashboardHome).
  3. **Atendimento** — Principais motivos de contato (absorvido) + Ranking vendedores.
  4. **IA & comercial** — Funil + IA vs Vendedor + InsightsTab inteiro (13 widgets de vendas/produtos/marcas/objeções).
- Toggle **"Sandbox: ON/OFF"** no header — só pro super_admin; gerente nunca vê.
- `types.ts` ganha `is_sandbox` em `instances.Row/Insert/Update` + assinatura da RPC.

**Acesso:** rota `/dashboard/gestao` já guardada por `CrmRoute` (super_admin OU gerente). Gerente loga → cai direto no unificado. Nenhuma guard alterada.

**Não inclui (Fase 2):** tempo 1ª resposta P50/P95, conversas abandonadas 24h, gap cobertura, conversão por origem.

**Verificação:** `tsc --noEmit` = 0 erros, HMR sem warnings, console limpo no `/login` (redirect). RPC validada: Eletropiso 30d retornou 6 novos + 5 recorrentes (bate com 11 contatos distintos da query de sanidade).

---

## Releases anteriores

- [[wiki/changelog/2026-05-part3]] — v7.32.0 a v7.32.6 (Notif handoff WhatsApp + helpdesk polish + áudios)
- [[wiki/changelog/2026-05-part2b]] — v7.21.0 a v7.24.0 (D30 Sprints A+B+C+D)
- [[wiki/changelog/2026-05-part2a]] e [[wiki/changelog/2026-05-part1]] — outras entradas de maio
- [[wiki/changelog/2026-04-part2b]] e anteriores — abril 2026
- [[wiki/changelog/2026-pre-04-part3b]] e anteriores — pré-abril
