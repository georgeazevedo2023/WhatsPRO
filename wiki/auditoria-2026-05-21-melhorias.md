---
title: Auditoria 2026-05-21 — 30 Melhorias Gerais + 20 Melhorias de Inteligência
tags: [auditoria, melhorias, roadmap, ai-agent, db, prompts, paridade, inteligencia]
sources: [auditoria-2026-05-21-veredito, auditoria-2026-05-21-db, auditoria-2026-05-21-ai-agent, auditoria-2026-05-21-prompts, auditoria-2026-05-21-paridade, auditoria-2026-05-21-research]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Melhorias Priorizadas — Auditoria 2026-05-21

> Saída sintetizada das 5 ondas (DB, AI Agent, Prompts, Paridade, Research). Veredito completo em [[wiki/auditoria-2026-05-21-veredito]]. Cada item: prioridade (P0-P3), esforço (S=horas, M=dias, L=semanas), impacto (1-5).

**Legenda:** P0 = bloqueador / risco prod imediato · P1 = recidiva provável / dívida ativa · P2 = qualidade / paridade · P3 = polish / cosmético

---

## Parte A — 30 Melhorias Gerais (DB, paridade, infra, projeto)

### 🔴 P0 — fix urgente (8)

| # | Melhoria | Esforço | Impacto | Origem |
|---|---|---|---|---|
| **1** | Resolver dois CHECK constraints rivais em `ai_agent_logs.event` — DROP `ai_agent_logs_event_check`, deixar só `chk_ai_agent_logs_event` com lista canônica. Observabilidade R126/R127 está cega. | S | 5 | DB-P0 |
| **2** | Migration `EXCLUDE USING gist (conversation_id WITH =) WHERE (status='active')` em `handoff_queue_events` — promessa pós-incidente 9h. | S | 5 | DB-P0 |
| **3** | Criar cron `purge_notifications_older` (full_rotation 6h, lidas 7d, não-lidas 30d). Promessa não cumprida. | S | 5 | DB-P0 |
| **4** | Migrar leitor `sub_agents` → `agent_profiles` em `ai-agent/index.ts:1532` e `ai-agent-playground:67`. Drop coluna após 1 sprint. | M | 4 | Paridade-P0 |
| **5** | Confirmar status `known_brands` — coluna existe? Adicionar migration + UI ou remover do `brandDetection.ts`. Hoje silenciosamente cai no fallback. | S | 4 | Paridade-P0 |
| **6** | Migrar `requeue-conversations:225/234/240` de `out_of_hours_message` (legado) para `handoff_message_outside_hours` + `enrichOutsideHoursMessage`. Drop coluna após 30d. | S | 4 | Paridade-P0 |
| **7** | Commitar migrations retroativas D34 (`conversations.resolved_at`) e D35 (`service_categories.catalog_status`). `supabase db diff` + arquivos `.sql`. | S | 4 | DB-P1 (drift) |
| **8** | Adicionar 8 tabelas novas (`user_feature_permissions`, `business_hours_exceptions`, `handoff_queue_events`, etc) na whitelist `is_table_protected()`. | S | 3 | DB-P2 |

### 🟠 P1 — recidiva provável (10)

| # | Melhoria | Esforço | Impacto | Origem |
|---|---|---|---|---|
| **9** | Auditoria sistemática de curto-circuitos sem guarda anti-loop — varrer cada `if (cond) { set_tags/handoff/queue }` no `index.ts` e adicionar `!jaGravou` (R134 generaliza). | M | 5 | AI-P1 |
| **10** | Adicionar audit log em `UPDATE ai_agents` via RPC `update_ai_agent_with_audit(diff jsonb)` — debug pós-incidente. | M | 4 | Paridade-P1 |
| **11** | Adicionar UI editor de `tts_fallback_providers` em `VoiceConfig.tsx` (drag-drop). Hoje read-only no DB direto. | M | 3 | Paridade-P1 |
| **12** | Resolver `extraction_address_enabled` write-only — ou adicionar reader em ai-agent ou remover do ALLOWED_FIELDS. | S | 2 | Paridade-P1 |
| **13** | Drop column `handoff_negative_sentiment` (dead field) + remover do ALLOWED_FIELDS. | S | 2 | Paridade-P1 |
| **14** | Unificar `openai_api_key` no doSave padrão do AIAgentTab (remover save path divergente em BrainConfig). | S | 3 | Paridade-P1 |
| **15** | Atualizar `wiki/banco-de-dados.md` — regenerar via MCP `list_tables`, corrigir projeto ativo (`prfcbfumyrrycsrcrvms` vs `wspro_v2` stale). | S | 3 | DB-P1 |
| **16** | Índices compostos faltando: `conversation_messages(conversation_id, created_at DESC)`, `notifications(user_id, read, created_at DESC)`, `handoff_queue_events(department_id, status)`. | S | 4 | DB-P1 |
| **17** | Ligar `dry_run=false + enabled=true` na policy id=8 de `handoff_queue_events` (90d retention). Sem isso trail engorda eternamente. | S | 3 | DB-P1 |
| **18** | CHECK constraint `conversations.tags` formato `key:value` — `bool_and(t ~ '^[a-z_]+:.+$')`. Defesa contra LLM cravando lixo. | S | 3 | DB-P1 |

### 🟡 P2 — qualidade / paridade (8)

| # | Melhoria | Esforço | Impacto | Origem |
|---|---|---|---|---|
| **19** | Auditar `verify_jwt` de TODAS as edge functions vs `config.toml` (R-incidente 2026-05-17). Toda divergência = redeploy CLI. | S | 4 | DB-P2 |
| **20** | Expandir D36 com features `manage_prompt`, `manage_brain`, `manage_handoff_rules`, `manage_voice`, `manage_agents` (delete agent). | M | 3 | Paridade-P2 |
| **21** | Centralizar defaults em `_shared/agentDefaults.ts` — fonte única para NicheTemplates + UI placeholders + backend fallback. Resolve drift N4. | M | 4 | Paridade-P2 |
| **22** | Confirmar views `v_*` com `SECURITY INVOKER` (Postgres 15+) — risco multi-tenant leak. | S | 4 | DB-P2 |
| **23** | Drop tabelas mortas (`keep_alive`, `intent_detections`, `media_library`, `playground_*`, `validator_logs`, `lead_memory`, `pending_responses`) após confirmação `n_live_tup=0`. | M | 2 | DB-P1 |
| **24** | Atualizar CHECK `chk_conversations_status` se sprints novos adicionarem status (`arquivada`, `bloqueada`, `aguardando-cliente`). Doc regra preventiva. | S | 2 | DB-P1 |
| **25** | Subscrever Realtime em `agent_products` + `agent_knowledge` no UI Admin — KnowledgeConfig/CatalogConfig hoje precisa refresh manual. | M | 3 | Paridade-P3 |
| **26** | Dashboard saúde cron no admin (cards "X jobs falharam nas últimas 24h") — `cron.job_run_details`. | M | 3 | DB-P3 |

### 🟢 P3 — polish (4)

| # | Melhoria | Esforço | Impacto | Origem |
|---|---|---|---|---|
| **27** | Comentários R-numerados no `index.ts` (200+ ocorrências) — mover datas/contexto pra git log + wiki. Reduz ruído visual. | M | 1 | AI-P3 |
| **28** | Padronizar UX de save: ou auto-save em todo Config OU botão "Salvar" explícito. QueueConfig é divergente. | M | 2 | Paridade-P3 |
| **29** | `BrainConfig` mascarar `openai_api_key` por default (não auto-load em memória). Trocar coluna por reference `system_settings.OPENAI_API_KEY`. | M | 3 | Paridade-P2 |
| **30** | Confirmar índices em padrão EAV `kanban_card_data(card_id, field_id)` + `kanban_entity_values(entity_id, field_id)` — escala mil cards. | S | 2 | DB-P3 |

---

## Parte B — 20 Melhorias de Inteligência (AI Agent / LLM / Orquestração)

> Foco em **inteligência**: tornar o agente mais preciso, menos prompt-dependente, mais escalável. Baseado em Onda 5 (research 2026) + Ondas 2/3 (gaps técnicos). Modelo alvo: **gpt-5-mini** (custo-neutro vs atual, instruction following melhor).

### 🔴 P0 inteligência (4)

| # | Melhoria | Esforço | Impacto | Justificativa |
|---|---|---|---|---|
| **I1** | **Ligar `strict: true` + `additionalProperties: false` em todas as 9 tool schemas** em `_shared/openai.ts`. Sem isso, args alucinados (R125) continuam. Failure rate cai pra <0.1%. | S | 5 | Research §4 — best practice 2026 padrão |
| **I2** | **Transformar `set_tags.interesse` em enum dinâmica** derivada de `service_categories[].id` por agente. Resolve Bug 12 (LLM crava `interesse:hidraulica` em agente sem essa categoria). | M | 5 | Research §4 + R125-R127 |
| **I3** | **Migrar `gpt-4.1-mini` → `gpt-5-mini`** em `_shared/openai.ts`. Custo neutro ($6.00 vs $6.40/mês em 10k msgs), structured outputs nativos, instruction following melhor. 1 linha + smoke test. | S | 5 | Research §1 |
| **I4** | **Extrair `hardcodedRules` (9.3 KB) → `_shared/promptRules.ts` testável**. Categorizar 25 bullets em (a) cosmética/voz → mantém no prompt, (b) política → vai pra validator, (c) anti-alucinação → vai pra guard. Meta: prompt < 4 KB. | L | 5 | AI-P0 + Prompts §6 |

### 🟠 P1 inteligência (8)

| # | Melhoria | Esforço | Impacto | Justificativa |
|---|---|---|---|---|
| **I5** | **Refatorar prompt em blocos XML** (`<persona>`, `<rules>`, `<tools_usage>`, `<examples>`, `<context>`) com regras críticas no **fim** (efeito recency). Hoje tudo é markdown solto. | M | 4 | Research §3 |
| **I6** | **Validação server-side de tool args** (Pydantic-style em TS) ANTES de executar — pega R126/R133 cross-categoria com query genérica + args fora de enum. Estende lógica de `setTagsValidator`. | M | 5 | Research §4 |
| **I7** | **Tabela `lead_memory` (facts JSONB)** — nome, interesse, marca preferida, objeção persistidos fora do prompt. Reduz tokens por turn e melhora consistência multi-sessão. | M | 4 | Research §6 |
| **I8** | **Rolling summary `conversation_summary`** atualizado a cada 10 msgs (1 LLM call extra, ~$0.001/turno). Sessões de 3 dias deixam de "renascer" o lead. | M | 4 | Research §6 |
| **I9** | **Few-shot examples curados (3-5) na nova prompt_section `examples`** — JSON estruturado `[{lead, expected_response, reason}]`. LLM aprende padrão sem cross-pollution. Bonus: A/B test de prompt viável. | M | 4 | Prompts §6 + Research §3 |
| **I10** | **Substituir exemplos literais cross-domain** (`Lorenzetti, Hydra` em prompt de tinta) por placeholders interpolados (`{category_label}`, `{stage_examples}`) montados em runtime da categoria detectada. | M | 4 | Prompts P1-P3 |
| **I11** | **Tabela `system_settings.detector_patterns` JSONB** pros regex `saleClosed/objection/brand/payment/clientType` — hoje editar exige deploy edge. R128 prova risco. | M | 3 | Prompts melhoria #4 |
| **I12** | **Audit log `ai_agent_audit_log`** com `rules_triggered[], tools_called[], tags_applied[], guards_blocked[]` por turn. Dashboard "LLM seguiu vs ignorou regra X". | M | 4 | Research §5 |

### 🟡 P2 inteligência (5)

| # | Melhoria | Esforço | Impacto | Justificativa |
|---|---|---|---|---|
| **I13** | **POC Router Pattern** — `gpt-5-nano` (latência <300ms) classifica intent (greeting/qualif/search/handoff/objection) → dispatch pra specialist. Manter guards TS atuais como camada determinística. Meta: prompt do specialist < 2 KB cada. | L | 5 | Research §2 |
| **I14** | **Specialist `product_search`** — primeiro subagente: prompt curto (~1 KB), tool subset (`search_products`, `send_carousel`, `send_media`), guard `searchGuard` reaproveitado. Reduz alucinação cross-categoria. | L | 4 | Research §2 |
| **I15** | **Specialist `handoff`** — segundo subagente: prompt curto, decide pickHandoffMessage + outside_hours + queue assign. Manter `handoffGuard` reaproveitado. | L | 4 | Research §2 |
| **I16** | **Parallel tool calls** onde aplicável — `search_products` + `get_lead_history` simultâneos cortam ~1s em ~30% dos turnos. | S | 3 | Research §4 |
| **I17** | **Memoizar `VALID_KEYS`, `service_categories`, `agent_profile` por agent_id+versão** (hash-key no edge function). Reduz CPU + custo de re-cálculo por turn. | S | 3 | AI-P2 |

### 🟢 P3 inteligência (3)

| # | Melhoria | Esforço | Impacto | Justificativa |
|---|---|---|---|---|
| **I18** | **Avaliar Guardrails AI / NeMo Guardrails** (camada output declarativa YAML, latência 100-300ms) — substitui guards ad-hoc por declaração padronizada. POC de 3 dias. | M | 3 | Research §5 |
| **I19** | **Split `index.ts` em módulos por fase** — `phase1-detectors.ts`, `phase2-pre-llm.ts`, `phase3-llm-call.ts`, `phase4-post-llm.ts`, `phase5-handoff.ts`. Reduz superfície HIGH RISK por PR. | L | 4 | AI-P0 |
| **I20** | **Sprint Agente Consultivo** (já aberta em memory `project_sprint_agente_consultivo`) — detectar quando lead demonstra desconhecimento técnico ("a melhor que vc tiver", "n sei qual") e EXPLICAR antes de perguntar termo cru. UX consultiva ≠ transacional. | L | 4 | Memory + caso Eletropiso pós-R131 |

---

## Recomendação operacional — Próximas 2 sprints

### Sprint A (1 semana) — fechar P0s acumulados
**Goal:** zerar dívida crítica antes de feature nova.

- **Dia 1:** #1, #2, #3 (3 migrations DB urgentes) + #7 (commitar D34/D35 retroativo)
- **Dia 2:** #4, #5, #6 (3 paths divergentes UI/backend)
- **Dia 3-4:** **I1, I2, I3** (strict mode + enum + migração gpt-5-mini) — 3 ganhos enormes com esforço pequeno
- **Dia 5:** #9 (varredura curto-circuitos R134) + smoke E2E

### Sprint B (1 semana) — refator estrutural
**Goal:** parar de inflar `index.ts`/prompt, começar a baixar dívida arquitetural.

- **Dia 1-2:** **I4** (extrair `hardcodedRules`) + **I5** (XML blocks) + **I10** (placeholders cross-domain)
- **Dia 3:** **I6** (validação server-side tool args) + #10 (audit log UPDATE ai_agents)
- **Dia 4-5:** **I7** + **I8** (memória longa: `lead_memory` + `conversation_summary`)

### Sprint C+ (2-4 semanas) — orquestrador
**Goal:** sair do monolito.

- **I13** (Router POC com gpt-5-nano) + **I14** (specialist `product_search`)
- Medir latência/precisão vs monolito em 50 conversas
- Se ROI confirmado: **I15** (`handoff` specialist) + **I19** (split index.ts em fases)

---

## Métricas de saída esperadas (90 dias)

| Métrica | Hoje | Target 90d |
|---|---|---|
| Prompt assembled (KB) | 20-30 | **<8** |
| `index.ts` linhas | 4.407 | **<2.000** |
| Incidentes/14d | 10 | **<3** |
| LLM args alucinados | ~3% | **<0.1%** (strict mode) |
| Custo OpenAI/10k msgs | $6.40 | **$6.00** (gpt-5-mini) |
| Cobertura audit log regras | 0% | **100%** |
| Sessões >24h com contexto preservado | 0% | **100%** |
| Tabelas mortas no schema | 7-9 | **0** |

---

## Links

- [[wiki/auditoria-2026-05-21-veredito]] — síntese + notas oficiais
- [[wiki/auditoria-2026-05-21-db]] — detalhe DB (4 P0)
- [[wiki/auditoria-2026-05-21-ai-agent]] — detalhe AI Agent (6 dimensões)
- [[wiki/auditoria-2026-05-21-prompts]] — detalhe prompts (24 regras hardcoded)
- [[wiki/auditoria-2026-05-21-paridade]] — detalhe paridade (15 findings)
- [[wiki/auditoria-2026-05-21-research]] — best practices 2026 + GPT-5-mini

**Frase de retomada:** *"executar Sprint A da auditoria 2026-05-21"*.
