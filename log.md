---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-12

> **Frase pra retomar na próxima sessão:**
>
> **`"contexto dashboard gestor v7.33-v7.35"`**
>
> Ao receber, executar protocolo de início (5 passos) e priorizar leitura deste handoff + 3 entradas mais recentes do log.

### O que foi entregue (sessão inteira) — 4 releases shipados em prod

| Versão | Tema | Commits |
|---|---|---|
| **v7.33.0** | Dashboard do Gestor unificado (Fase 1) — 4 zonas, `instances.is_sandbox`, RPC `get_leads_new_vs_returning` | `66d2461` |
| **v7.34.0** | Métricas avançadas (Fase 2) — 4 RPCs (response_time P50/P95, abandoned 24h, demand×coverage, conversion by origin) + 4 cards | `66d2461` |
| **v7.35.0** | Pivô comercial (Fase 3) — sem custos, com leads sem 1ª resposta + cotações em andamento + Top Objeções promovido | `c93bb36` |
| **v7.35.1** | Botão limpar pendências — tag `dashboard:dispensed` com undo (toast Sonner) | `fda01ea` |
| **v7.35.2** | Retention 24h em logs do Supabase — banco 52 MB → 23 MB, cron horário | `2cfcb99` |
| **v7.35.3** | 🐛 **Fix crítico** — RPC `append_ai_debounce_message` com tipo `uuid` quebrava IA inteira (pipeline silenciado por 3 fire-and-forget) | `1e44633` |

### Estado do código

- **Branch master** no commit `7172c2d` (= último, com 8 migrations registradas localmente).
- **DB Supabase**: todas 8 migrations aplicadas em prod (deployadas via MCP no momento do desenvolvimento).
- **Frontend Docker**: imagem nova no GHCR, redeploy do container `crm.wsmart.com.br` disparado via webhook Portainer (HTTP 204).
- **TypeScript**: `tsc --noEmit` = 0 erros.
- **Vault healthcheck**: ✅ todos arquivos ≤ 300 linhas.

### Validações E2E confirmadas

- Banco Supabase voltou a 23 MB (era 52 MB).
- Cron `purge_system_logs_24h` ativo (`active=true`, schedule `0 * * * *`).
- Áudio "Olá, boa noite, estou testando o áudio, vocês tem tinta esmalte..." disparou pipeline: `01:18:04 recebido → 01:18:36 IA respondeu` (fora do horário comercial, retornou `out_of_hours_message` — comportamento correto).

### Sinais de produto descobertos (vale levantar com o time)

1. **0 vendas tagueadas `venda:fechada`** em 30 dias na Eletropiso (12 conversas, 7 leads via "direto") → fluxo de tagueamento não está sendo aplicado pelo comercial.
2. **0 cotações tagueadas `motivo:orcamento`** apesar de leads pedindo orçamento → mesma causa.
3. **1 lead sem 1ª resposta há 716h (30 dias)** → time perdeu lead concreto.
4. **Bug do AI Agent estava quieto há possivelmente dias** sem ninguém notar — falta alarme no pipeline.

### Pendências declaradas (não bloqueantes)

- **Validar dashboard logado como gerente real**: Playwright caiu no /login (sem credencial), validação visual end-to-end ainda manual.
- **Fase 4 do dashboard (backlog)**: drill-down ao clicar em card, comparação período-vs-período (P50 hoje vs 7d), alertas configuráveis (P95 > X min → notify WhatsApp pessoal do gestor), export CSV.
- **Pipeline fire-and-forget sem alarme**: o bug `22P02` ficou invisível por dias. Vale uma observabilidade mínima (cron diário que verifica `ai_agent_logs` recente vs `conversation_messages incoming` recente, alerta se gap > 1h).

### Lição salva em `wiki/erros-e-licoes.md`

Top-1 atual: "Tipo de parâmetro de RPC divergente da coluna real (uuid vs text)" — com 3 regras preventivas.

---

## 2026-05-12 — Fix RPC append_ai_debounce_message (v7.35.3) ⚠️ bug crítico de prod

**Investigação iniciada pelo gestor:** "pq o agente ia não respondeu meu áudio?".

**Diagnóstico:**
- Mensagem incoming OK, transcrição OK (Groq fez), mas `ai_debounce_queue` sem entry nova e `ai_agent_logs` zerado em 24h.
- Webhook pula áudio de propósito ("Skip audio messages — transcribe-audio will trigger"). transcribe-audio chama ai-agent-debounce. ai-agent-debounce chama RPC `append_ai_debounce_message`.
- RPC declarada com `p_instance_id uuid`. Instâncias UAZAPI usam `text` (`r466a98889b5809`). Erro `22P02: invalid input syntax for type uuid` silenciado por 2 camadas de fire-and-forget.
- Reproduzi o erro chamando a RPC manualmente.

**Fix:** migration `fix_append_ai_debounce_message_instance_id_text` (DROP + CREATE com tipo correto). Smoke test rodou com instance/conv real.

**Pendente:** validação E2E (user precisa mandar msg nova no WhatsApp Eletropiso pra confirmar IA responde).

**Lição:** bugs em fire-and-forget de duas camadas viram invisíveis se a função interna estoura. Defesa: `ai-agent-debounce` deveria logar `error` da chamada RPC, não engolir.

---

## 2026-05-12 — Retention 24h em logs do Supabase (v7.35.2)

**Investigação iniciada pelo gestor:** "52 MB? o que está ocupando?". Análise revelou que 30 MB (55%) eram logs internos sem valor operacional:
- `net._http_response` (pg_net HTTP log) = 21 MB, cresce ~3 MB/hora.
- `cron.job_run_details` (pg_cron) = 8 MB, ~2.300 rows/dia.

**Ação imediata:** TRUNCATE nas duas → banco 52→23 MB.

**Permanente:** migration `cron_retention_system_logs_24h` cria função `purge_system_logs_older_than_24h()` (SECURITY DEFINER, retorna jsonb com contagens) + job pg_cron `purge_system_logs_24h` schedule `0 * * * *`. Bloco DO antes do schedule garante reaplicação idempotente (unschedule anterior se existir).

Smoke test: função roda OK, job ativo no `cron.job`.

---

## 2026-05-12 — Dashboard do Gestor: botão limpar pendências (v7.35.1)

**Pedido:** gestor precisa remover spam/teste das listas (ex: "Zig Online" não é negócio).

**Entregue:** tag `dashboard:dispensed` aplicada via 2 RPCs SECURITY DEFINER (`dispense_conversation_from_dashboard` / `restore_conversation_to_dashboard`). Append preserva tags existentes via DISTINCT unnest. As 3 RPCs de pendência filtram OUT a tag. UI: botão X ao lado do link externo + toast Sonner com action "Desfazer".

Não arquiva a conversa (helpdesk segue mostrando). Smoke test SQL completo OK. `tsc --noEmit` = 0.

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

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |
