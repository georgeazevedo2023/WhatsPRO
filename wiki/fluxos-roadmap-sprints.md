---
title: Fluxos v3.0 — Roadmap de Sprints (Fatias Verticais)
tags: [roadmap, sprints, implementacao, orquestrador, fluxos]
sources: [4-agentes-paralelos-2026-04-11]
updated: 2026-04-12
---

# Fluxos v3.0 — Roadmap de Sprints

> 12 sprints em 4 camadas. Cada sprint = fatia vertical funcional e demonstrável.
> Princípio: George pode demonstrar o resultado de CADA sprint sem esperar o próximo.
> Docs: [[wiki/fluxos-visao-arquitetura]] | [[wiki/fluxos-banco-dados]]

---

## Visão Geral — 12 Sprints em 4 Camadas

| Sprint | Tema | O que funciona ao terminar | Complexidade |
|--------|------|---------------------------|--------------|
| **S1** ✅ | Database + Tipos | 14 tabelas no banco, seed, tipos TypeScript gerados | P |
| **S2** ✅ | Orchestrator Skeleton | Orquestrador com feature flag `USE_ORCHESTRATOR` — sem breaking change | M |
| **S3** ✅ | Flow CRUD Admin UI | `/flows` com listagem, criação, publicação | M |
| **S4** ✅ | Flow Triggers Engine | Mensagem "oi" ativa flow correto, estado salvo no banco | M |
| **S5** ✅ | Memory + Greeting | Lead novo é saudado, nome coletado e persistido entre msgs | M |
| **S6** | Qualification | Lead responde perguntas, `smart_fill`, `post_action` avança | G |
| **S7** | Intent Detector | "qro tinta" → `produto` com confidence 0.95, 3 camadas | M |
| **S8** | Sales + Support | Carrossel de produtos; FAQ sem LLM, handoff se confidence<0.8 | M |
| **S9** | Validator + Metrics + Shadow | Prompt leak bloqueado; timing por camada; shadow sem resposta | M |
| **S10** | Templates + Survey/Followup/Handoff | Template "Vitrine" instala com 1 clique e funciona no WhatsApp | G |
| **S11** | Conversa Guiada + FlowEditor | IA monta fluxo em chat; todos os 13 params editáveis | G |
| **S12** | Métricas + E2E + Migração | Dashboard exportável; score E2E; toggle por instância | M |

---

## Camada 1 — Foundation (S1-S3)

### S1: Database + Tipos TypeScript ✅ COMPLETO (2026-04-11, commit e084c87)
4 migrations aplicadas, seed SDR (2 steps + 3 triggers), `types.ts` 4943 linhas, 14/14 tabelas, `npx tsc --noEmit` exit 0 ✅ — detalhes em [[wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2]].

### S2: Orchestrator Skeleton + Feature Flag ✅ COMPLETO (2026-04-11, commit 367b4b0)
7 arquivos orchestrator criados (types, flowResolver, stateManager, contextBuilder, services/stubs, subagents/stubs, index), fork whatsapp-webhook (2 call sites), `USE_ORCHESTRATOR='false'` ✅ — 6 bugs corrigidos pós-auditoria (commit 7bb2f8e, 6.5→9.2), R29-R31 em [[wiki/erros-e-licoes]] — detalhes em [[wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2]].

### S3: Flow CRUD Admin UI ✅ COMPLETO (2026-04-11, commit 9862f2d)

**Entregáveis entregues:**
- 5 páginas: FlowsPage (listagem+busca+tabs) | FlowNewPage (seleção modo) | FlowWizard (4 etapas) | FlowTemplatesPage (12 templates+preview) | FlowDetail (editor inline 4 tabs)
- 3 componentes: FlowCard | FlowModeBadge | TriggerFormSheet (16 tipos em 4 grupos)
- 2 hooks: useFlows (7 mutations + generateSlug) | useFlowTriggers (4 mutations)
- App.tsx: 5 rotas registradas. Sidebar.tsx: item "Fluxos" collapsible adicionado
- 4 bugs corrigidos: B1 rotas inexistentes | B2 sem nav | B3 useState→useEffect | B4 path errado

**Critério:** `/dashboard/flows` acessível, wizard funcional, george cria flow+2 gatilhos em <5min ✅

---

## Camada 2 — Flow Engine (S4-S6)

### S4: Flow Triggers Engine ✅ COMPLETO (2026-04-12, commit 75b1cb9)

**Entregáveis:**
- `flowResolver.ts`: checkCooldown real (query flow_events), checkActivation (always ok, outros stub), normalizeText (remove acentos), isLeadCreated flag
- `stateManager.ts`: ON CONFLICT DO NOTHING → zero race condition, message_count increment, completed_steps append, completed_at
- `index.ts`: handleAdvance real (fetchNextStep por position), resolveLeadId corrigido (join conversations→inboxes→lead_profiles)
- `contextBuilder.ts`: from('lead_profiles') + join contacts, subagent_type (era step_type)
- `types.ts`: sync completo com schema (completed_steps, instance_id, conversation_id, StepData rico)
- **5 bugs de schema corrigidos**: conversations.lead_id | conversations.instance_id | from('leads') | step_type×2

**E2E:** "oi" → `flow_state.status=active`, `flow_step_id=<greeting>`, `message_count=1` ✅

**Race condition:** resolvida via `uq_flow_states_active_lead_flow` (unique index já existia) + `INSERT ON CONFLICT DO NOTHING RETURNING` — sem migration adicional necessária.

**Critério:** `SELECT * FROM flow_states WHERE lead_id = $LEAD` retorna 1 row `status=active` após "oi" ✅ validado via curl.

### S5: Memory Service + Greeting Subagent ✅ COMPLETO (2026-04-12, commit 935fb3f)

**`services/memory.ts`:** `loadMemory` (short+long) | `saveShortMemory` (RPC `upsert_lead_short_memory`, TTL 1h) | `upsertLongMemory` (RPC `upsert_lead_long_memory` — fix B#2 PostgREST) | `saveLeadName`

**`subagents/greeting.ts` — P0 (6 sub-params):** 4 casos: B=retornante (sessionsCount>0+nome→known_lead_message) | C=novo com nome→greeting personalizado | D=sem nome→ask_name+waiting_for:'name' | A=coleta nome→extractName (patterns BR + heurística ≤40chars)

**`services/index.ts`:** Memory real. `detectIntents`/`validateResponse`/`trackMetrics` stubs (S7/S8/S9).

**3 bugs corrigidos:** B#1 getStepType lia `step_type` (undefined) | B#2 PostgREST onConflict falha (R36) | B#3 `step_data:{}` sobrescreve DEFAULT banco (R37+R38). Migration `20260415000001`.

**E2E validado:** sessions_count++ | greeting+UAZAPI | pede nome | extrai nome ASCII → full_name+long_memory.profile ✅

### S6: Qualification Subagent *(maior sprint — complexidade G)*
**`subagents/qualification.ts` — P1 (10 sub-params):**
- `extractFieldValue()` — 16 tipos (text, email, phone, cpf, cnpj, date, boolean, select, multi_select, scale_1_5, scale_1_10, nps, currency_brl, url, address, custom)
- `smart_fill`: pula perguntas já em `long_memory.profile` (com `smart_fill_max_age_days=90`)
- `mode: adaptive` → LLM escolhe próxima pergunta; `mode: fixed` → sequência
- `fallback_retries` esgotados → `status: 'handoff'`
- `post_action: next_step | handoff | tag_and_close`

**DT1 Resolvido:** `lead_profiles.custom_fields JSONB` — coluna já existe (migration 20260322135030, `DEFAULT '{}'`). Sem migration adicional em S6.
- `qualification.ts` escreve: `UPDATE lead_profiles SET custom_fields = custom_fields || $answers WHERE id = $lead_id`
- `smart_fill` lê: `lead_profiles.custom_fields[field_name]` + verifica `smart_fill_max_age_days`

---

## Camada 3 — Intelligence (S7-S9)

### S7: Intent Detector (3 Camadas)
**`services/intentDetector.ts`** — L1 Normalização (~5ms, 100%: abbrevs+dedup) → L2 Fuzzy/Levenshtein+Soundex (~12ms, 100%: threshold 1/2/3 por tamanho) → L3 LLM semântico (~200ms, só quando confidence L2 < 0.70)
**13 intents por prioridade:** cancelamento > pessoa > reclamacao > suporte > produto > orcamento > status > agendamento > faq > promocao > b2b > continuacao > generico

**Bypass crítico:** `cancelamento` → optout LGPD imediato | `pessoa` → handoff | `produto` → sales direto (sem qualificação)

**Target:** L3 ativado em ≤20% das msgs. Custo: ~R$0,20/dia (100 conversas).

### S8: Sales + Support Subagents
**`subagents/sales.ts` — P2 (8 sub-params):**
- `single_product_mode` → `send/media` (1 produto) vs `send/carousel` (2+)
- Persiste `step_data.products_shown[]` — não repete no carrossel
- `recommendation_mode: exact | smart | upsell`
- **Regra obrigatória:** `broadcastEvent()` após todo insert de media/carousel

**`subagents/support.ts`:**
- pgvector similaridade vs `knowledge_base` (tabela existente)
- confidence ≥ 0.80 → resposta direta (0 tokens) | 0.50-0.79 → LLM | < 0.50 → handoff

### S9: Validator + Metrics + Shadow ON
**`services/validator.ts` — 10 checks automáticos (0 tokens cada):**
`size_ok` | `language_match` | `no_prompt_leak` | `price_accurate` | `no_repetition` | `no_greeting_repeat` | `name_frequency_ok` | `emoji_count_ok` | `no_markdown_artifacts` | `no_pii_exposure`
3 falhas consecutivas → `action: handoff_human` automático

**`services/metrics.ts`:** `start(flowStateId)` / `end(breakdown, cost)` → salva `timing_breakdown` + `cost_breakdown` em `flow_events`

**Shadow Mode (`flows.mode = 'shadow'`):** Msgs → STT → Memory → Shadow Analyzer (batch 5min, R$0,016/batch) → `shadow_extractions` → FIM. **IA não responde**.
⚠ Banner obrigatório no helpdesk: "MODO SHADOW ATIVO — IA não está respondendo"

---

## Camada 4 — Completion (S10-S12)

### S10: Templates + Survey + Followup + Handoff
**`src/data/flowTemplates.ts` — 12 templates (4 MVPs):** T1 Vitrine (greeting→qualification→sales→survey→handoff) | T2 SDR BANT (score threshold, fora_perfil→fecha) | T3 Suporte (diagnostic+NPS) | T4 Pós-Venda (D+7 followup+NPS)
**RPC atômica:** `install_flow_template(instance_id, flow, steps[], triggers[])` — rollback automático

**`subagents/survey.ts`:** UAZAPI `/send/menu` — ⚠ verificar limite de botões ANTES. Fuzzy match para resposta texto vs opções.
**`subagents/followup.ts`:** `flow_followups` + `process-follow-ups` cron (verificar se cron já existe antes de S10)
**`subagents/handoff.ts`:** `flow_states.status = 'handoff'` → webhook para para redirecionar. Briefing automático de contexto para atendente.

### S11: Conversa Guiada + FlowEditor Completo
**Edge function `guided-flow-builder`:** Chat admin → GPT-4.1-mini → JSON FlowTemplate → preview Realtime. Sugestões proativas: `has_catalog=true` → carrossel; bio page → gatilho.
**Migration:** `20260416000001_guided_sessions.sql` — tabela `guided_sessions` (messages JSONB, draft_flow JSONB, expires_at — 24h, cron de cleanup via DT5)
**FlowEditor — 5 tabs:** Identidade | Gatilhos | Subagentes | Inteligência | Publicar. Toggle de modo + drag-and-drop de steps com `position` atômico.

### S12: Métricas + E2E + Migração Gradual
**Dashboard `/flows/:id/metrics`:** KPI cards (iniciados/conclusão/handoff/custo), timing breakdown (pizza), top 10 intents, funil. Botão "Compartilhar" → link público 30 dias — **diferencial George mostrar a clientes**.
**Migration:** `20260416000002_flow_report_shares.sql` — tabela `flow_report_shares` (token TEXT UNIQUE, flow_id, expires_at — 30 dias, is_active BOOL)

**5 cenários E2E obrigatórios:** novo_lead_saudacao | lead_qualificado_vendas | intent_produto_bypass | timeout_followup | shadow_mode_extracao. Score 0-100.

**Migração por instância — `instances.use_orchestrator BOOL DEFAULT false`:**
```
Checklist: tem flow publicado? ✓ | triggers ativos? ✓ | testou shadow 24h? ⚠ | E2E score ≥80? ○
→ whatsapp-webhook: if (instance.use_orchestrator) callOrchestrator() else callAiAgent()
```
**Rollback automático:** 3 falhas em 5min → `use_orchestrator = false` + fallback para ai-agent.
**⚠ ai-agent/index.ts NÃO é modificado em nenhum sprint** — routing fica exclusivamente no webhook.

---

## Decisões Técnicas Identificadas nos Sprints

| ID | Decisão | Sprint | Status |
|----|---------|--------|--------|
| DT1 | `custom_fields` em `lead_profiles` JSONB ou `lead_memory.long.profile`? | Antes S6 | ✅ Decidido: `lead_profiles.custom_fields` — coluna já existe (migration 20260322135030) |
| DT2 | UAZAPI `/send/menu` — verificar limite real de botões | Antes S10 | ✅ Decidido: 2–12 opções, max 100 chars cada (validado em uazapi-proxy.ts linha 523) |
| DT3 | `process-follow-ups` cron — verificar se já existe | Antes S10 | ✅ Decidido: existe (`supabase/functions/process-follow-ups/index.ts`, cron 1h). S10 reutiliza + adiciona `flow_followups` |
| DT4 | E2E usa `instance_e2e_sandbox` dedicada — NUNCA instância real | S12 | Definido |
| DT5 | `guided_sessions` expira após 24h via cron | S11 | Definido |

---

## Riscos Top 5

| Risco | Sprint | Mitigação |
|-------|--------|-----------|
| Race condition `createFlowState` (2 msgs em 200ms) | S4 | RPC atômica + ON CONFLICT DO NOTHING |
| UAZAPI `/send/menu` limite botões < 12 | S10 | Verificar ref antes; fallback lista texto |
| LLM Guided Builder gera JSON inválido | S11 | Zod validation + retry + fallback formulário |
| Feature flag ativa instância errada | S12 | Confirmação com nome digitado (GitHub style) |
| Shadow ativo em prod sem saber | S9+ | Banner persistente no helpdesk + admin |

---

## Cobertura Auditada

| Componente | Sprints que cobrem | Status |
|-----------|-------------------|--------|
| 14 tabelas banco | S1 (apply) + S4-S12 (use) | ✅ 100% |
| 13 parâmetros P0-P12 | S5(P0) S6(P1) S8(P2) S9(P3,P5) S7(P6) S10(P4,P8) S11(P7,P9-P12) | ✅ 100% |
| 8 subagentes | S5(greeting) S6(qualification) S8(sales,support) S10(survey,followup,handoff) S11(custom) | ✅ 100% |
| 5 serviços | S5(memory) S7(intentDetector) S9(validator,metrics,shadow) | ✅ 100% |
| Feature flag | S2(skeleton) S12(por instância) | ✅ G4 coberto |
| Contratos TypeScript + Admin UI | S4(types.ts) S5(subagents) S6(QualificationConfig) · S3(CRUD) S10(templates) S11(editor) S12(métricas) | ✅ coberto |
