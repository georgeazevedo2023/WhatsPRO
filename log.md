---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-11

### Auditoria Vault + Fechamento de Gaps (6 gaps corrigidos)
- **Gap 1 — wikilink quebrado:** `plano-fluxos-unificados.md` não existe → corrigido para `fluxos-visao-arquitetura.md` em decisoes-chave.md
- **Gap 2 — roadmap.md desatualizado:** M18 Fluxos v3.0 adicionado como próximo milestone
- **Gap 3 — erros-e-licoes.md:** Regra R28 adicionada — `now()` proibido em índice parcial PostgreSQL (IMMUTABLE)
- **DT2 Resolvido:** UAZAPI `/send/menu` — 2-12 opções, max 100 chars (já validado em `uazapi-proxy.ts`)
- **DT3 Resolvido:** `process-follow-ups` já existe (cron 1h, `supabase/functions/process-follow-ups/`). S10 reutiliza + adiciona `flow_followups`
- **roadmap-sprints.md:** DT2 + DT3 marcados ✅. Todas as 5 DTs resolvidas.

### DT1 Resolvido — custom_fields em lead_profiles (não lead_memory)
- **Decisão:** `lead_profiles.custom_fields JSONB` para respostas de qualificação
- **Bonus:** Coluna já existe (migration `20260322135030`, `DEFAULT '{}'`) — S6 sem migration adicional
- **Escrita:** `UPDATE lead_profiles SET custom_fields = custom_fields || $answers`
- **Leitura smart_fill:** `lead_profiles.custom_fields[field_name]` + `smart_fill_max_age_days`
- **Razão:** dado de negócio (CRM, campanhas, helpdesk) ≠ memória de IA (volátil, resetável)
- **Roadmap:** DT1 marcado ✅ em fluxos-roadmap-sprints.md | decisoes-chave.md atualizado

### G5: Wireframes Admin Fluxos v3.0 — 5 telas em 5 arquivos wiki
- **Tipo:** Design UX — wireframes detalhados para implementacao frontend
- **Wikis criadas (5):** fluxos-wireframes-admin (indice) + listagem + wizard + guiada + editor
- **Telas especificadas:**
  - `/flows` listagem (card anatomy, 4 badges, shadow banner, filtros, estados)
  - `/flows/new` selecao de modo (3 cards: Formulario / Templates / Conversa Guiada)
  - Wizard 4 etapas (Identidade → Config → Gatilhos 16 tipos → Publicar)
  - Galeria 12 templates com drawer preview + warnings de compatibilidade
  - Conversa Guiada split-screen (chat 48% + preview 52%, 10 estados, 10 edge cases, `guided_sessions`)
  - FlowEditor 5 tabs (Identidade, Gatilhos, Subagentes c/ 8 forms dinamicos, Inteligencia, Publicar)
  - Dashboard metricas (KPIs, timing pizza, top intents, funil, share link 30 dias)
- **Decisoes implementadas:** formulario dinamico por subagente, config servicos contextual, 5 exit rule presets, shadow banner persistente
- **index.md atualizado:** +5 wikis wireframes. Total: 15 wikis fluxos.

### Deploy + Auditoria Supabase — Fluxos v3.0 (4 migrations, 14 tabelas, PG 17.6)
- **Projeto:** wspro_v2 (euljumeflwtljegknawy) — sa-east-1 — PostgreSQL 17.6 — ACTIVE_HEALTHY
- **Migrations aplicadas em ordem:** fluxos_v3_definition_tables → fluxos_v3_state_memory → fluxos_v3_shadow_tables → fluxos_v3_infra_tables
- **Auditoria pós-deploy — resultado PASS em todos:**
  - 14/14 tabelas criadas com colunas corretas ✅
  - 14/14 tabelas com RLS habilitado ✅
  - 42/42 policies (3 por tabela) criadas com nomes corretos ✅
  - 9 triggers updated_at confirmados ✅
  - Funções `cleanup_expired_lead_memory()` + `upsert_lead_short_memory()` criadas ✅
  - Índices parciais verificados: `WHERE status='active'` | `WHERE status='pending'` | `WHERE expires_at IS NULL` | `NULLS NOT DISTINCT` ✅
  - CHECK constraints testados com valores inválidos — todos bloquearam: `flows_mode_check` | `flow_triggers_priority_check` | `intent_detections_confidence_check` ✅
  - Sem dados de teste residuais ✅
- **Total no banco:** 97 índices criados nas 14 tabelas

### Auditoria G1+G2 + Correções — 13 fixes aplicados (4 arquivos)
- **BUG CRÍTICO corrigido (000001):** `idx_lead_memory_lookup` usava `now()` em predicado de índice parcial → violação IMMUTABLE do PostgreSQL → migration falharia. Corrigido: `WHERE expires_at IS NULL` (filtro `> now()` cabe na query, não no predicado).
- **I1 corrigido (000000):** 3 funções trigger redundantes (`update_flows_updated_at`, `update_flow_steps_updated_at`, `update_flow_triggers_updated_at`) removidas → substituídas por `public.update_updated_at_column()` compartilhada.
- **I2 corrigido (000003):** 4 políticas renomeadas `"sa_*"` → `"super_admins_manage_*"` | `TO authenticated` adicionado | `WITH CHECK` adicionado em super_admin | `auth.role()='service_role'` → `TO service_role USING(true)`.
- **I3 corrigido (000003):** Header mencionar `20260411145300` → `20260415000003`.
- **G2 wiki corrigido (roadmap-sprints.md):** Feature flag: progressão global→por instância documentada (S2 global dev, S12 por instância prod). Seed file marcado como CRIAR EM S1. `guided_sessions` + migration `000001_guided_sessions.sql` adicionados ao S11. `flow_report_shares` + migration `000002_flow_report_shares.sql` adicionados ao S12. Wiki comprimida de 219 → 197 linhas.
- **Verificação:** `wc -l` confirmou todas as violações da regra 200 linhas corrigidas.

### G2: Roadmap Sprints Fluxos v3.0 — 12 sprints em 4 camadas (fatias verticais)
- **Tipo:** Planejamento de implementação — roadmap detalhado por sprint
- **Método:** 4 agentes paralelos (S1-S3 Foundation | S4-S6 Flow Engine | S7-S9 Intelligence | S10-S12 Completion)
- **Wiki criada:** `wiki/fluxos-roadmap-sprints.md` (~220 linhas)
- **12 sprints divididos em 4 camadas:**
  - Foundation (S1-S3): DB+tipos, Orchestrator skeleton+feature flag, Flow CRUD admin UI
  - Flow Engine (S4-S6): Triggers engine+RPC atômica, Memory+Greeting, Qualification+smart_fill
  - Intelligence (S7-S9): Intent detector 3 camadas, Sales+Support subagents, Validator+Metrics+Shadow
  - Completion (S10-S12): Templates+Survey+Followup+Handoff, Conversa Guiada+FlowEditor, Métricas+E2E+Migração
- **Decisões técnicas pendentes (DT1-DT3):** custom_fields location | UAZAPI /send/menu button limit | process-follow-ups cron existe?
- **Top 5 riscos:** race condition createFlowState | UAZAPI botões limit | LLM JSON inválido | feature flag instância errada | shadow sem banner
- **Cobertura:** 14 tabelas ✅ | 13 params ✅ | 8 subagentes ✅ | 5 serviços ✅ | feature flag ✅ | contratos TS ✅
- **Princípio:** George pode demonstrar resultado de CADA sprint sem esperar o próximo (fatia vertical)
- **HIGH RISK protegido:** `ai-agent/index.ts` NÃO modificado em nenhum sprint — routing exclusivo no webhook

### G1: Schema Banco de Dados Fluxos v3.0 — 14 tabelas (49 FAILs corrigidos)
- **Tipo:** Design arquitetural — banco de dados
- **Método:** 4 agentes paralelos (flows/steps/triggers | states/events/memory | shadow tables | infra tables)
- **Wiki criada:** `wiki/fluxos-banco-dados.md` (199 linhas)
- **Migrations criadas (4):**
  - `20260415000000` — flows, flow_steps, flow_triggers (Grupo 1 — definição)
  - `20260415000001` — flow_states, flow_events, lead_memory (Grupo 2 — estado/memória)
  - `20260415000002` — shadow_extractions, shadow_metrics, pending_responses, flow_followups (Grupo 3 — shadow)
  - `20260415000003/20260411145300` — intent_detections, flow_security_events, validator_logs, media_library (Grupo 4 — infra)
- **Principais correções vs schema original (49 FAILs → 0):**
  - `instance_id TEXT` (não `inbox_id UUID`) em todas as 14 tabelas
  - `version INT` em flows + flow_steps (versionamento)
  - `mode TEXT` como coluna explícita em flows (não enterrado no config JSONB)
  - `exit_rules JSONB NOT NULL DEFAULT '[]'` como coluna em flow_steps
  - `priority + cooldown_minutes + activation` em flow_triggers
  - `step_data JSONB` estruturado em flow_states (qualification_answers, products_shown, etc.)
  - `dimension TEXT CHECK(7)` em shadow_extractions (não tabela sem enum)
  - `flow_followups` (não `follow_ups`) — evita colisão com follow_up_executions existente
  - 4 tabelas adicionadas: intent_detections, flow_security_events, validator_logs, media_library
  - timing_breakdown + cost_breakdown em flow_events
  - Memória curta/longa separada por memory_type em lead_memory



### Decisao: Fluxos Unificados v3.0 — Unificacao dos 17 Modulos
- **Tipo:** Decisao arquitetural — design phase
- **Wiki criada:** `wiki/plano-fluxos-unificados.md`
- **Arquivos atualizados:** index.md, decisoes-chave.md, log.md
- **Resumo:** Discussao com George sobre simplificacao radical da UX. Proposta: unificar 17 modulos em experiencia de "Fluxos" com 5 etapas (Gatilho → Condicao → Acao/Subagente → Transbordo → Metricas). 3 modos de criacao (Conversa Guiada com IA, Formulario, Templates). 12 templates pre-configurados. Parametros configuraveis (qualificacao, produtos, interacoes, tags). Agente Padrao vira "Default", subagentes herdam dele. Geracao visual exclusiva via Nano Banana (Gemini). Discussao de parametros em andamento.

### Shadow Mode: 7 Dimensoes + Objecoes Gestor + Follow-up Intelligence + Resgate
- **Tipo:** Discussao + documentacao — novo modo de operacao
- **Wiki criada:** `wiki/fluxos-shadow-mode.md` (~120 linhas)
- **Wikis atualizadas:** fluxos-visao-arquitetura.md (secoes 10-11 renumeradas, +4 modos operacao, +Shadow Analyzer), index.md
- **Decisao D17:** Shadow Mode = 4o modo de operacao (IA Ativa / IA Assistente / Shadow / Desligado)
- **7 dimensoes:** Lead, Vendedor, Objecao, Produto, Gestor, Resposta, Follow-up
- **Objecoes:** 7 tipos (preco 34%, decisao 28%, prazo 22%, concorrencia 18%, estoque 15%, qualidade 8%, desistencia 5%). Rastreia como cada vendedor supera + taxa + frases que convertem
- **Follow-up:** Deteccao auto por tipo objecao. Sugestao msg por IA. Escalada: D+0 badge → D+1 notifica → D+2 gestor → D+3 resgate automatico
- **Resposta pendente:** Escalada progressiva 5/15/30/60min. Prioridade por score (VIP mais rapido). Resgate automatico. Cobertura de intervalo/almoco
- **Horarios:** Deteccao automatica de almoco/pausa por padrao de resposta. Mapa de cobertura equipe. Sugestao de escala
- **5o servico:** Shadow Analyzer (extracao passiva)
- **Custo:** ~R$1,60/dia por vendedor (batch processing a cada 5min)
- **Totais:** 8 wikis fluxos, 5 servicos, 4 modos operacao, 17 decisoes

### DESIGN COMPLETO: 13 parametros (91 sub-params) + P12 Webhooks + Fechamento
- **Tipo:** Documentacao final — design phase completo
- **P12 Webhooks documentado:** 5 sub-params (incoming 7 fontes pre-config, outgoing 6 eventos, field_mapping auto, retry 3x, HMAC)
- **Status:** TODOS os 13 parametros discutidos em profundidade
- **Totais finais do design Fluxos v3.0:**
  - 13 parametros, 91 sub-parametros
  - 4 servicos (Memory, Audio, Validator, Metrics)
  - 8 subagentes (Greeting, Qualification, Sales, Support, Survey, Followup, Handoff, Custom)
  - 13 intents com 3 camadas detector
  - 12 templates de fluxo
  - 12+ templates Bio Link por segmento
  - 16 decisoes arquiteturais (D1-D16)
  - 7 wikis fluxos (~1000 linhas total)
- **Proximos passos:** Estrutura do banco → Roadmap sprints → Implementacao por fatias verticais

### Decisao D16: Forms ABSORVIDO + P10 UTM + P11 QR Code documentados + Orquestracao vault
- **Tipo:** Decisao arquitetural + documentacao + melhoria orquestracao
- **Decisao D16:** Formularios (P12) absorvido por P1 Qualificacao (+field_types, +collect_mode, +smart_fill) e P9 Bio Link (+lead_magnet, +standalone_form). 14 params → 13 params.
- **P10 UTM documentado:** 8 sub-params (multi_channel, short_url, ab_testing, attribution first/last/multi-touch)
- **P11 QR Code documentado:** 7 sub-params (style branded, multi_qr, companion_text, location_tag)
- **Orquestracao vault melhorada (7.5 → 9.0):**
  - log.md particionado: 847 → 106 linhas. Antigo em wiki/log-arquivo-2026-04-04-a-09.md
  - index.md reorganizado: flat → 3 categorias (Produto, Operacional, Fluxos v3.0)
  - CLAUDE.md atualizado: +ref Fluxos v3.0, +comandos "fluxos"/"parametros", +regras 13-16 (notas, limites, refs, log max)
  - RULES.md atualizado: +Protocolo de Documentacao e Notas (nota conteudo/orquestracao/vault, checklist auto, iniciativa proativa)
- **Total sistema:** 13 params, 89 sub-params, 7 wikis fluxos (962 linhas)


> Entradas anteriores arquivadas em `wiki/log-arquivo-2026-04-11-fluxos-design-b.md`

---
