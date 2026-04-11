---
title: Fluxos v3.0 — Schema do Banco de Dados
tags: [banco, schema, migrations, fluxos, shadow-mode, memoria]
sources: [auditoria-schema-2026-04-11, 4-agentes-paralelos]
updated: 2026-04-11
---

# Fluxos v3.0 — Schema do Banco de Dados

> 14 tabelas em 4 grupos. 49 falhas corrigidas vs schema original (10 tabelas).
> Migrations: `supabase/migrations/20260415000000` a `20260415000002` + `20260415000001` (estado/memória)

---

## Ordem de Execução das Migrations

```
20260415000000  flows + flow_steps + flow_triggers          (Grupo 1 — PRIMEIRO)
20260415000001  flow_states + flow_events + lead_memory     (Grupo 2)
20260415000002  shadow_extractions + metrics + pending_responses + flow_followups  (Grupo 3)
20260415000003  intent_detections + flow_security_events + validator_logs + media_library (Grupo 4)
```
> `20260411145300_fluxos_v3_infra_tables.sql` = backup do Grupo 4. Usar 20260415000003 em produção.

---

## Padrões Aplicados em Todas as Tabelas

| Padrão | Regra |
|--------|-------|
| Tenant FK | `instance_id TEXT NOT NULL REFERENCES instances(id)` — NUNCA `inbox_id UUID` |
| PK | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| RLS | 3 policies: `super_admins` + `inbox_members` (via inboxes→inbox_users) + `service_role` |
| Timestamps | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Append-only | Tabelas de log/eventos: sem `updated_at`, sem trigger |

---

## Grupo 1 — Definição do Fluxo

### `flows` — Fluxo Unificado v3.0

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | — |
| instance_id | TEXT FK | Tenant |
| name, slug | TEXT | Identidade única por instância |
| **version** | INT DEFAULT 1 | Versionamento (lead não quebra se admin edita) |
| **published_at** | TIMESTAMPTZ | NULL = rascunho |
| **mode** | TEXT | 'active'\|'assistant'\|'shadow'\|'off' (D17) |
| template_id | TEXT | Um dos 12 templates pré-configurados |
| funnel_id | UUID FK | Vínculo opcional com funnels existente |
| is_default | BOOL | Fluxo padrão quando nenhum gatilho bate |
| **config** | JSONB | 13 parâmetros P0-P12 completos |
| status | TEXT | 'active'\|'paused'\|'archived' |

Indexes: `(instance_id)`, `(status)`, `(mode)`, `(published_at) WHERE NOT NULL`, `(instance_id, is_default) WHERE true`

### `flow_steps` — Etapas/Subagentes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| flow_id | UUID FK CASCADE | — |
| version | INT | Versiona junto com o fluxo |
| subagent_type | TEXT CHECK | greeting\|qualification\|sales\|support\|survey\|followup\|handoff\|custom |
| position | INT | Ordem de execução |
| **exit_rules** | JSONB `[]` | `[{trigger, value, message, action, params}]` — 8 destinos |
| step_config | JSONB `{}` | Config específica do subagente |

Indexes: `(flow_id, position)`, `(subagent_type)`, `(flow_id, is_active) WHERE true`

### `flow_triggers` — Gatilhos

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| flow_id | UUID FK CASCADE | — |
| instance_id | TEXT FK | Denorm para RLS direto sem join extra |
| trigger_type | TEXT CHECK | 16 tipos: bio_link, utm_campaign, qr_code, keyword, intent, tag_added, form_completed, poll_answered, webhook_received, schedule, lead_created, funnel_entered, card_moved, conversation_started, message_received, api |
| trigger_config | JSONB | Config específica (keywords, bio_page_id, utm_source, cron, ...) |
| **priority** | INT 1-100 | Maior = verificado primeiro. Resolve conflitos entre gatilhos |
| **cooldown_minutes** | INT | Mínimo entre ativações para o mesmo lead |
| **activation** | TEXT | 'always'\|'business_hours'\|'outside_hours'\|'custom' |
| fallback_flow_id | UUID FK | Fluxo acionado quando condições não batem |

Index crítico: `(instance_id, priority DESC) WHERE is_active = true` — caminho quente do engine

---

## Grupo 2 — Estado e Memória

### `flow_states` — Estado Ativo do Lead

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| flow_id | UUID FK CASCADE | — |
| flow_step_id | UUID FK SET NULL | Step atual |
| **flow_version** | INT | Versão do fluxo ao iniciar (preserva consistência) |
| instance_id | TEXT FK | Denorm para RLS |
| lead_id | UUID FK CASCADE | — |
| conversation_id | UUID FK SET NULL | — |
| status | TEXT | 'active'\|'completed'\|'handoff'\|'timeout'\|'abandoned' |
| **step_data** | JSONB | `{qualification_answers, products_shown, intent_history, message_count, total_message_count, last_subagent, context_vars}` |
| completed_steps | UUID[] | Steps já executados |
| started_at, last_activity_at | TIMESTAMPTZ | Ciclo de vida |

Partial unique index: `(lead_id, flow_id) WHERE status = 'active'` — 1 estado ativo por lead por fluxo

### `flow_events` — Log de Execução (append-only)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| flow_state_id | UUID FK CASCADE | — |
| flow_id, instance_id, lead_id | denorm | Para queries analíticas sem joins |
| event_type | TEXT CHECK | flow_started\|step_entered\|step_exited\|intent_detected\|handoff_triggered\|tool_called\|validator_flagged\|flow_completed\|flow_abandoned\|error |
| subagent_type | TEXT | Qual subagente executou |
| input, output | JSONB | Entrada e saída do step |
| **timing_breakdown** | JSONB | `{recognition_ms, memory_ms, llm_ms, validator_ms, tts_ms, total_ms}` |
| **cost_breakdown** | JSONB | `{input_tokens, output_tokens, llm_cost_brl, tts_cost_brl, total_cost_brl}` |

Indexes: `(instance_id, created_at DESC)`, `(flow_id, created_at DESC)`, partial `WHERE event_type = 'error'`

### `lead_memory` — Memória Curta + Longa

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| lead_id | UUID FK CASCADE | — |
| instance_id | TEXT FK | Denorm para RLS |
| **memory_type** | TEXT CHECK | 'short' (sessão, TTL 3600s) \| 'long' (permanente) |
| **scope** | TEXT | 'global' \| 'flow:{id}' \| 'step:{id}' |
| data | JSONB | short: `{summary, products_shown, intents, session_start}` / long: `{profile, purchases, preferences, sessions_count}` |
| ttl_seconds, expires_at | INT / TIMESTAMPTZ | Expiração para memória curta |
| tokens_saved | INT | Tokens economizados (métrica) |

Unique constraint: `(lead_id, memory_type, scope)` — permite upsert atômico
Funções helper: `cleanup_expired_lead_memory()`, `upsert_lead_short_memory(...)`

---

## Grupo 3 — Shadow / Monitoramento

### `shadow_extractions` — Extrações Shadow (append-only)

Batch 5min do Shadow Analyzer. 1 row por dimensão por conversa por batch. ~R$0,016/batch = ~R$1,60/dia/vendedor.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| conversation_id | UUID FK CASCADE | — |
| **dimension** | TEXT CHECK | lead\|seller\|objection\|product\|manager\|response\|followup |
| **batch_id** | UUID | Agrupa extrações do mesmo processamento |
| extracted_data | JSONB | Dados por dimensão (varia — ver [[wiki/fluxos-shadow-mode]]) |
| processing_cost_brl | DECIMAL(10,6) | Custo da extração |

Index composto: `(conversation_id, dimension, processed_at DESC)` — query mais crítica

### `shadow_metrics` — Métricas Agregadas

Upsert diário/semanal/mensal por vendedor ou instância. UNIQUE NULLS NOT DISTINCT `(instance_id, seller_id, period_type, period_date)`.

### `pending_responses` — Fila de Espera (D6)

Escalada progressiva: 5min badge (level 1) → 15min notifica vendedor (2) → 30min gestor (3) → 60min resgate automático (4) → 2h abandonado.

Partial unique: `(conversation_id) WHERE status = 'pending'` — 1 ativo por conversa

### `flow_followups` — Follow-ups Humanos (D7)

**Diferente de `follow_up_executions`** (cadências do AI Agent). Esta rastreia follow-ups humanos detectados pelo Shadow.

7 tipos: vou_pensar, ta_caro, consultar_parceiro, semana_que_vem, quando_chegar, compromisso, outros

score_decay_rate: 2pts/dia normal, 5pts/dia sem follow-up

---

## Grupo 4 — Infraestrutura (4 tabelas ausentes no schema original)

| Tabela | Tipo | Campos-chave |
|--------|------|--------------|
| `intent_detections` | append-only | `detected_intent CHECK(13 intents)`, `secondary_intents TEXT[]`, `detection_layer` (normalization\|fuzzy\|semantic), `confidence FLOAT 0-1`, `llm_used BOOL`, `processing_time_ms`, `matched_keywords TEXT[]`. TODO: particionar por `created_at` quando > 10M rows |
| `flow_security_events` | append-only | `event_type` (blocked_phrase\|rate_limit_exceeded\|bot_detected\|content_filtered\|data_protection\|abuse_escalated\|prompt_injection), `severity` (low\|medium\|high\|critical), `action_taken` (blocked\|warned\|escalated\|logged_only), `details JSONB` com GIN index. Partial index `WHERE auto_resolved = false` |
| `validator_logs` | append-only | `auto_checks JSONB` (size_ok, language_match, no_prompt_leak, price_check, no_repetition, passed_all), `llm_score INT 0-10`, `brand_voice_check JSONB`, `factcheck_catalog JSONB`, `final_action` (approved\|approved_with_changes\|rejected\|logged_only). GIN index em `auto_checks` |
| `media_library` | mutável | Cross-sistema (bio, carrossel, campanhas, forms, Nano Banana). `source` (upload\|catalog_sync\|nano_banana\|external_url), `nano_banana_type` (banner\|product\|promo\|avatar\|cover), GIN em `tags TEXT[]` + `used_in JSONB`. Única tabela do grupo com `updated_at` |

---

## Tabelas Existentes — Não Recriar

| Tabela | Criada em | Relação com Fluxos v3 |
|--------|-----------|----------------------|
| `funnels` | M16 | `flows.funnel_id → funnels.id` |
| `automation_rules` | M17 | Motor de automação existente |
| `follow_up_executions` | M17 | Cadências do AI Agent (≠ flow_followups) |

---

## Auditoria (2026-04-11)

Schema original: 10 tabelas, 49 FAILs, 26 WARNs → Schema corrigido: **14 tabelas, 0 FAILs**.
Principais correções: `instance_id TEXT` (não `inbox_id UUID`), `version` para fluxos, `exit_rules` como coluna, enum `dimension` em shadow_extractions, 4 tabelas de infra adicionadas, `step_data` estruturado, `mode` como coluna explícita.
