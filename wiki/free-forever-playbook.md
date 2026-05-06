---
title: Free Forever Playbook — Como nunca sair do plano grátis Supabase
tags: [free-tier, monitoring, retention, cron, n8n, escalation, orphan-traffic]
sources: [supabase/migrations/20260505*.sql, db_retention_policies, snapshot_platform_usage]
updated: 2026-05-05
---

# Free Forever Playbook

> Plano operacional pra manter o projeto em plano grátis Supabase **com folga permanente** — nunca passar de 70% de qualquer dimensão. Se passar de 60% em alguma coisa, ação automática + notificação. Se chegar em 70%, escalação manual.

## 1. Limites e tetos definidos

| Recurso | Limite Free | Teto 70% | Alerta 60% | Onde medir |
|---|---:|---:|---:|---|
| **DB size** | 500 MB | 350 MB | 300 MB | `pg_database_size()` (auto) |
| **Storage** | 1 GB | 717 MB | 614 MB | `SUM(metadata->>'size')` (auto) |
| **MAU** | 50.000 | 35.000 | 30.000 | `auth.users.last_sign_in_at` (auto) |
| **Edge invocations/mês** | 500.000 | 350.000 | 300.000 | Supabase dashboard (manual) |
| **Bandwidth/mês** | 5 GB | 3.5 GB | 3 GB | Supabase dashboard (manual) |
| **Realtime msgs/mês** | 2.000.000 | 1.4M | 1.2M | Supabase dashboard (manual) |
| **Disk IO/dia** | sem nº fixo | qualquer alerta email | 1 alerta em 7d | Email Supabase + heuristic interno |

## 2. As 4 Camadas de Defesa

### Camada 1 — Alívio imediato (✅ shipped 2026-05-05)
Cron pesado migrado pra n8n na VPS Hetzner; VACUUM FULL recuperou bloat.

| Ação | Estado |
|---|---|
| Cron `handoff-queue-requeue` (1min) → n8n na WSMARTvps | ✅ desschedulado |
| VACUUM FULL `net._http_response` | ✅ −2.7 MB |
| Drop indexes trgm | ❌ pulado conscientemente (700 KB não vale o risco) |

> n8n workflow: `https://flux.wsmart.com.br/workflow/8QULMsbBRemVeFz7xQqI5`. Trigger Schedule 1 min → HTTP POST `requeue-conversations` com Bearer `sb_publishable_*`. **Não salva execuções de sucesso** (saveDataSuccessExecution: none) pra não inchar banco do n8n.

### Camada 2 — Retention automática (✅ shipped 2026-05-05)
Apaga logs antigos **automaticamente** todo domingo (jobs 9 e 10).

| Tabela | Retention | Backup JSONL? | Cron |
|---|:-:|:-:|---|
| `ai_debounce_queue` (processed=true) | 1d | ❌ | jobid 9 |
| `instance_connection_logs` | 30d | ❌ | jobid 9 |
| `ai_agent_logs` | 30d | ❌ | jobid 9 |
| `flow_events` | 60d | ❌ | jobid 9 |
| `shadow_metrics` | 180d | ❌ | jobid 9 |
| `conversation_messages` | 120d (apenas resolved) | ✅ | jobid 10 |
| `handoff_queue_events` | 90d | ❌ | jobid 9 |

Tabelas-núcleo (whitelist `is_table_protected()`) NUNCA são tocadas: `lead_profiles`, `contacts`, `ai_agents`, `conversations`, `inboxes`, `instances`, `departments`, `kanban_*`, `campaigns`, `forms`, `funnels`, `automation_rules`, `agent_profiles`, `flows`, `db_*`, `notifications`, `user_*`.

### Camada 3 — Monitoring proativo aos 60% (✅ shipped 2026-05-05)

Cron `platform-usage-snapshot` (jobid 13, 06:11 UTC diário) executa SQL puro — **não usa pg_net/HTTP** então não pesa em IO budget.

A função `snapshot_platform_usage()`:
1. Lê db_size, storage, mau (tudo via SQL)
2. Calcula % vs limite Free
3. Lê `db_to_fn_calls_24h` + `db_to_fn_error_pct_24h` de `net._http_response` (sentinel R96)
4. Persiste em `platform_usage_history` (com índice em `measured_at`)
5. Determina nível:

| Nível | Faixa do maior pct | Ação |
|---|---|---|
| 🟢 green | <50% | nada — operação normal |
| 🟡 yellow | 50-60% | nada automático — atenção mensal |
| 🟠 orange | 60-70% | **notification para super_admins** |
| 🔴 red | 70-85% | **notification + investigação imediata** |
| 🚨 critical | ≥85% | **notification + ação obrigatória** |

6. Dedupe: notificação não duplica em < 20h pro mesmo level.

> **Sentinel R96 (2026-05-05):** se DB→fn tem ≥10 chamadas/24h E ≥50% retornaram 4xx/5xx, eleva alert pra `yellow` mesmo se db/storage/mau estão verdes — sintoma forte de R92 voltando ou config quebrada. Notificação dedicada `db_to_fn_health_alert`. **Limitação:** não vê tráfego externo (n8n) — pra esse, ver §5 abaixo.

### Camada 4 — Este playbook (✅ shipped 2026-05-05)

## 3. Playbook por nível

### 🟢 Verde (<50%) — operação normal
- ✅ Não fazer nada
- ✅ Revisar mensalmente (5 min) o dashboard Supabase pra bandwidth + realtime

### 🟡 Amarelo (50-60%) — atenção
- 🔍 Olhar `platform_usage_history` últimos 7 dias: tendência crescente?
- 🔍 Identificar **qual dimensão** está em alerta (`highest_dim`)
- 🔍 Determinar se é crescimento orgânico (OK) ou bloat (corrigir)

### 🟠 Laranja (60-70%) — agir agora

#### Se for **db_size**:
1. Rodar audit:
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size, n_live_tup
   FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
   ```
2. Identificar **tabela que cresceu mais**
3. Se for `conversation_messages` → policy 6 já cuida (120d com backup). Investigar se está rodando OK.
4. Se for outra → considerar criar nova retention policy

#### Se for **storage**:
1. Auditar: `SELECT bucket_id, SUM((metadata->>'size')::bigint) FROM storage.objects GROUP BY 1`
2. Identificar bucket inflado
3. Imagens grandes: comprimir antes de upload (configurar webp/quality 80)
4. Buckets esquecidos: deletar arquivos antigos manualmente

#### Se for **mau**:
1. Improvável — limite é 50K. Se chegar lá, projeto cresceu e plano Pro vale.

#### Se for **edge invocations** (visível só no dashboard):
1. Migrar `process-flow-followups` (cron jobid 3) pro n8n
2. Migrar `aggregate-metrics-hourly` (cron jobid 4) pro n8n
3. Migrar `cleanup-assistant-cache` (cron jobid 6) pro n8n

### 🔴 Vermelho (70-85%) — investigação imediata

Mesmas ações do laranja **+ uma das duas**:

1. **Habilitar retention agressiva**: reduzir dias-de-retenção das policies (ex: `flow_events` 60d → 30d, `conversation_messages` 120d → 60d).
2. **Migrar mais workload pro n8n na VPS** (já paga, capacidade ociosa).

### 🚨 Critical (≥85%) — emergência

1. **Cliente de produção?** considerar upgrade pra Pro ($25/mês).
2. **Self-host parcial**: Postgres na VPS Hetzner, mantém Supabase só pra Auth/Storage/Edge/Realtime.
3. **Truncate emergencial** (último recurso): `DELETE FROM <log_table> WHERE created_at < now() - interval '7 days'`.

## 4. Cadência operacional

| Frequência | O quê | Auto/manual |
|---|---|---|
| **Diária** | snapshot_platform_usage() (cron jobid 13, 06:11 UTC) | auto |
| **Diária** | Notificações pra super_admins se >= 60% | auto |
| **Semanal** | apply_all_retention_policies (cron jobid 9, dom 04:13 UTC) | auto |
| **Semanal** | apply policies COM backup JSONL (cron jobid 10, dom 05:23 UTC) | auto |
| **Mensal** | Ler dashboard Supabase: bandwidth, realtime, edge invocations | manual (5 min) |
| **Mensal** | Revisar `platform_usage_history` últimos 30 dias | manual (10 min) |
| **Trimestral** | Auditoria completa: novas tabelas crescendo? Indexes não usados? | manual (30 min) |

### Query mensal de revisão

```sql
SELECT
  date_trunc('day', measured_at)::date AS dia,
  ROUND(AVG(db_pct), 2) AS db_pct,
  ROUND(AVG(storage_pct), 2) AS storage_pct,
  ROUND(AVG(mau_pct), 2) AS mau_pct,
  MODE() WITHIN GROUP (ORDER BY alert_level) AS level
FROM platform_usage_history
WHERE measured_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

## 5. Auditoria de tráfego órfão (R96 — chamadores externos invisíveis)

> Workflows externos (n8n WSMARTvps, IoT, browser direto) batem no gateway `*.supabase.co/functions/v1/*` **sem passar por `net._http_response`**. O monitoring DB não vê. Único lugar onde aparecem: dashboard Supabase → Edge Functions → Logs. Auditoria mensal obrigatória.

### Sintomas

- 4xx/5xx repetitivo com `function_id: null` → workflow externo em fn fantasma (deletada/renomeada)
- 401 cron-like (10s/60s/5min) → workflow externo com auth quebrado (R92-like)
- 200 com execution_time_ms sempre ~0 ou timeout → workflow mal configurado

### SOP mensal — checklist (5 min)

1. `mcp__supabase__get_logs service=edge-function` (ou dashboard > Functions > Logs, filtrar `status_code != 2xx`)
2. Agrupar por path. Pra cada fn com >100 invocações 4xx em 24h:
   - `function_id: null` → fn fantasma. Desabilitar workflow no n8n.
   - 401 com `function_id` válido → token rotacionado. Atualizar workflow.
   - Cruzar com `SELECT jobid, jobname FROM cron.job` — se não estiver lá, é externo.
3. Cross-check com snapshot: `SELECT measured_at::date, db_to_fn_calls_24h, db_to_fn_error_pct_24h FROM platform_usage_history ORDER BY measured_at DESC LIMIT 7`. Se erro alto há dias → fix imediato.

### Snapshot histórico

| Data | Órfão | Inv/dia | Ação |
|---|---|---:|---|
| 2026-05-05 | `event-processor` 404 (10s) — fn nunca existiu | 8.640 | n8n cleanup pendente |
| 2026-05-05 | `process-jobs` 401 (60s) — auth pós-R92, job_queue vazio 30d | 1.440 | n8n cleanup pendente |

Total descoberto 2026-05-05: ~302k/mês = ~60% do limite Free Tier — **maior gap silencioso**. Preferir pg_cron interno a workflow externo (single source of truth, vault rotation fixa em 1 lugar).

## 6. Escalation se este plano não for suficiente

Se em 1 ano de uso real algum recurso passar de 70% **com o playbook em dia**, sinaliza que o tráfego está subindo e o plano grátis pode estar realmente apertado. Próximas opções:

1. **Pro Plan ($25/mês)** — 8 GB DB, 100 GB storage, 2M edge calls, etc. Quase sempre vale quando atinge esse ponto.
2. **Self-host Postgres na VPS** — apenas o banco. Mantém Supabase pra Auth/Storage/Edge/Realtime. Custo: 0 adicional (VPS já paga).
3. **Hybrid**: mantem Free Supabase pra Auth/Storage, banco principal vai pra Postgres self-hosted.

> Plano grátis é viável até atingir **~50 atendentes ativos + ~200 leads/dia** com este playbook ligado. Acima disso, Pro vale.

## 7. Links

- [[wiki/decisoes-chave]] — D24/D25 (retention), D30 (fila), R74/R77 (whitelist + vault)
- [[wiki/erros-e-licoes]] — R92 (vault rotation), R74 (is_table_protected), **R96 (chamadores externos invisíveis)**
- [[wiki/casos-de-uso/admin-detalhado]] — Painel Admin / Retention page
- [[CLAUDE.md]] — Regras de ouro
- Supabase dashboard: https://supabase.com/dashboard/project/euljumeflwtljegknawy
- n8n VPS: https://flux.wsmart.com.br
- Workflow D30: https://flux.wsmart.com.br/workflow/8QULMsbBRemVeFz7xQqI5
