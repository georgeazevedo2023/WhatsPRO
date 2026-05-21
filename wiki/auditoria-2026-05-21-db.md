---
title: Auditoria de Banco — 2026-05-21
tags: [auditoria, banco-de-dados, rls, schema, drift, concerns, db-2026-05-21]
sources: [supabase/migrations, types.ts, wiki/banco-de-dados.md, wiki/erros-e-licoes.md, wiki/decisoes-chave.md]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Auditoria DB — 2026-05-21

> Auditor crítico do schema, RLS, índices, constraints e drift entre `types.ts`/migrations/vault no projeto ATIVO `prfcbfumyrrycsrcrvms` (Eletropiso v2). Foco em PROBLEMAS, não inventário.
>
> **Aviso de método:** este agent thread não teve acesso direto às tools `mcp__supabase__*` (apenas Read/Bash/Grep/Glob/Write). Estatísticas "ao vivo" (row counts, pg_database_size, advisors) NÃO foram coletadas e ficam pendentes — ver seção *Pendências de coleta MCP* no final. Findings abaixo derivam de migrations (186), `types.ts` (89 tabelas + 6 views), e cross-grep em `src/` + `supabase/functions/`.

---

## 1. Schema overview

- **89 tabelas** + **6 views** (`v_agent_performance`, `v_conversion_funnel`, `v_handoff_details`, `v_ia_vs_vendor`, `v_lead_metrics`, `v_vendor_activity`) em `public`.
- **186 migrations** committadas; última `20260521120000_R133_remove_impermeabilizante_from_tintas_regex.sql`.
- Wiki `wiki/banco-de-dados.md` diz "Provedor: projeto `wspro_v2` (ref `euljumeflwtljegknawy`)" — **OBSOLETO**. Projeto ativo é `prfcbfumyrrycsrcrvms` desde a migração de instância 2026-05-19 (D35). Outro projeto `qwxxtqdqletmetdnqmes` (memory `reference_supabase_token.md`) é antigo/pausado.

---

## 2. Findings críticos

### [P0] Dois CHECK constraints rivais em `ai_agent_logs.event` — eventos novos bloqueados silenciosamente

**Onde:** `ai_agent_logs` — constraints `ai_agent_logs_event_check` (canônico, criado 2026-05-17 com 19 eventos) **E** `chk_ai_agent_logs_event` (ressuscitado em 2026-05-20/21 com 22 eventos).

**Impacto:** R88 de novo. As 3 migrations mais recentes (`20260520210000_search_guard_blocked`, `20260521003000_set_tags_duplicate`) só fazem DROP/ADD do `chk_` mas não tocam no `_event_check`. Resultado: o `_event_check` está VIVO com lista antiga e BLOQUEIA inserts dos eventos novos — `marca_preferida_hallucination_blocked`, `search_guard_blocked`, `set_tags_duplicate_keys_rejected`. Toda observabilidade desses fixes (R126, R127, Bug "marca preferida") está cega. Mesma família R114.

**Fix:** migration nova que `DROP CONSTRAINT IF EXISTS ai_agent_logs_event_check` + recria SÓ `chk_ai_agent_logs_event` com lista canônica de eventos. Documentar regra: "1 constraint, 1 nome, 1 fonte de verdade".

---

### [P0] `handoff_queue_events` SEM exclusion constraint DB-level (post-R114) + retention seed dry_run

**Onde:** `handoff_queue_events` em `20260504000006_handoff_queue_events.sql` — não tem `EXCLUDE USING gist (conversation_id) WHERE (status='active')`.

**Impacto:** o incidente 2026-05-14 (banco explodiu de 50 → 116 MB em 9h com 22.682 events `active` e 136.521 notifications `full_rotation`) foi resolvido em CÓDIGO (`assignHandoff` idempotente + dedup `notifyGestores`) mas a "última camada de defesa" prometida em [[wiki/erros-e-licoes]] *"DB constraint `EXCLUDE USING gist`"* **NÃO foi shipada**. `grep EXCLUDE USING gist supabase/migrations/*.sql` = vazio. Se aparecer race condition nova (cron + manual override + handoff), volta a acumular.

**Fix:** migration `EXCLUDE USING gist (conversation_id WITH =) WHERE (status='active')`. Pré-requisito: garantir 0 rows duplicadas antes do `ADD CONSTRAINT` (SELECT count agrupado).

**Bônus:** retention policy `id=8` para esta tabela está `enabled=false + dry_run=true` (seed em `20260505000001_handoff_queue_retention_policy.sql`). 90 dias de trail estão definidos mas o cron de cleanup nunca apaga nada. Em 9 meses pode passar GB.

---

### [P0] `notifications` SEM cron de retention (`purge_notifications_older`) — promessa não cumprida

**Onde:** `notifications` — incidente 2026-05-14 documenta "fix: 4. Retention cron horário `purge_notifications_older` (full_rotation 6h, lidas 7d, não-lidas 30d)".

**Impacto:** `grep purge_notifications supabase/migrations/*.sql` = vazio. Cron NÃO existe. Único cron de retention shipado é `purge_system_logs_24h` (`net._http_response` + `cron.job_run_details`). Próximo incidente operacional volta a inundar `notifications`. Trail vai engordar sem fim — tabela já chegou a 60 MB no incidente.

**Fix:** migration com `CREATE FUNCTION public.purge_notifications_older()` + `cron.schedule('purge_notifications_hourly', '0 * * * *', ...)`. Regra de 3 idades: `full_rotation` >6h, `read=true` >7d, `read=false` >30d.

---

### [P1] Drift severo entre vault `wiki/banco-de-dados.md` e DB real

**Onde:** `wiki/banco-de-dados.md` (audited_at: 2026-05-11).

**Impacto:** 10 dias parado. Não menciona tabelas que existem: `intent_detections`, `keep_alive`, `media_library`, `pending_responses`, `platform_usage_history`, `playground_evaluations`, `playground_test_suites`, `rate_limit_log`, `shadow_extractions`, `shadow_metrics`, `shift_report_configs`, `shift_report_logs`, `validator_logs`, `user_feature_permissions`, `business_hours_exceptions`, `scrape_jobs`, `follow_up_executions`. Wiki diz "60+ tabelas"; real é 89 + 6 views.

Wiki menciona projeto **antigo** `wspro_v2` (`euljumeflwtljegknawy`). Real é `prfcbfumyrrycsrcrvms`. Migration mais recente listada na wiki é "20260425000006" (4 meses de atraso aparente — na verdade só 26 dias, mas mesmo assim 30+ migrations não documentadas).

**Fix:** regen via Supabase MCP `list_tables` + atualizar `audited_at`. Adicionar seção "drift histórico" pra evitar nova divergência.

---

### [P1] Migration ausente para D34 (`conversations.resolved_at`) e D35 (`service_categories.catalog_status`)

**Onde:** D34 (2026-05-17) menciona migration `conversations_add_resolved_at`. D35 (2026-05-19) altera schema do JSONB `service_categories` em `ai_agents`.

**Impacto:** `grep resolved_at supabase/migrations/*.sql` retorna apenas resultados em `flow_states`, `flow_step_executions`, `handoff_queue_events` — **NUNCA em `conversations`**. A coluna existe no DB e em `types.ts` (`resolved_at: string | null`), o que sugere que foi aplicada via `mcp__supabase__apply_migration` SEM ser commitada ao repo `supabase/migrations/`. Mesmo problema para `catalog_status` (campo do JSONB seed atualizado in-memory).

Quem clona o repo e roda `supabase db reset` não tem essas alterações. Replicação dev local quebra.

**Fix:** rodar `supabase db diff` ou exportar via `pg_dump --schema-only` pra capturar a coluna + migrations atrasadas. Commitar arquivo `20260517000000_conversations_add_resolved_at.sql` retroativo. Seed de `service_categories` no `system_settings` precisa migration explícita.

---

### [P1] Tabelas potencialmente mortas (0 usos em `src/` + `supabase/functions/`)

**Onde:** as 7 tabelas abaixo aparecem em `types.ts` mas têm 0 `.from('NOME')` em código produtivo.

| Tabela | Usos `src/` | Usos `functions/` | Severidade |
|---|---|---|---|
| `keep_alive` | 0 | 0 | morta (cron próprio?) |
| `intent_detections` | 0 | 0 | morta — só em migration |
| `media_library` | 0 | 0 | morta — só em migration |
| `playground_evaluations` | 0 | 0 | morta — F1/F2 backlog M2? |
| `playground_test_suites` | 0 | 0 | morta — idem |
| `validator_logs` | 0 | 0 | morta — superseded por `ai_agent_validations`? |
| `platform_usage_history` | 0 | 1 (`aggregate-metrics`) | semi-morta |
| `lead_memory` | 0 | 0 | morta (foi substituída por `lead_short_memory`/`lead_long_memory`?) |
| `pending_responses` | 0 | 0 | morta — superseded por debounce queue |
| `flows` (singular, sem prefixo `flow_`) | 0 src/ + 0 fn | 0 (só em types/seed) | inativa |
| `shift_report_configs/logs` | 0 | 1 (`send-shift-report`) | viva mas só 1 cron |

**Impacto:** ocupam linha em `types.ts` (overhead de TS), rows armazenam dados sem leitor, podem ter RLS frouxa por desuso. `keep_alive` ainda tem RLS habilitada (`20260506014000_keep_alive_enable_rls.sql`) — ponto positivo.

**Fix:** confirmar via `mcp__supabase__execute_sql("SELECT pg_total_relation_size('TABLE')")` e `SELECT count(*) FROM TABLE`. Se 0 rows ou dados de teste antigos, planejar DROP TABLE em sprint dedicado. Adicionar à whitelist `is_table_protected` ao confirmar morte (R74).

---

### [P1] `chk_conversations_status` desatualizado — pode rejeitar status novos

**Onde:** `20260323000003_db_audit_indexes_fks_constraints.sql:209-213` — `CHECK (status IN ('aberta','pendente','resolvida'))`.

**Impacto:** se sprints futuros adicionarem status (ex: `arquivada`, `bloqueada`, `aguardando-cliente`), insert falha silencioso. Migration `20260325230000_remote_schema_backfill.sql` e D30 mencionam queries por `status` mas nenhuma sprint atualizou o CHECK. Risco baixo hoje, alto se alguém tentar adicionar status.

**Fix:** regra preventiva — toda alteração que introduzir novo valor enum-like em status precisa de migration `ALTER CHECK` + entrada em [[wiki/erros/regras-preventivas]].

---

### [P1] Constraints `priority` e tags sem validação

**Onde:** `conversations.priority` tem CHECK `('alta','media','baixa')`. `conversations.tags` é `TEXT[]` livre.

**Impacto:** tags são formato `key:value` em todo o código mas zero CHECK constraint enforça isso no DB. R124-R130 (incidentes de tag inválida — `interesse:hidraulica` em agente sem essa categoria) mostraram que LLM crava qualquer string. Validação hoje é só código (`set_tags_validator.ts` shipado em R127), DB aceita lixo.

**Fix:** considerar `CHECK ( array_length(tags, 1) IS NULL OR (SELECT bool_and(t ~ '^[a-z_]+:.+$') FROM unnest(tags) AS t) )`. Não bloqueia magic strings mas pelo menos exige formato `key:value`.

---

### [P1] RLS gap potencial — tabelas com `authenticated` overly-permissive

**Onde:** sem acesso a `get_advisors({type:"security"})`, mas grep nas RLS criadas mostra padrão recorrente:

```sql
CREATE POLICY xxx ON tbl FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'gerente')));
```

**Suspeitas (verificar com advisor):**
- `keep_alive` — RLS enabled (`20260506014000`) mas sem policy positiva explícita pode ter sido criada com policy default permissiva.
- `db_alert_state`, `db_cleanup_log`, `db_retention_policies` — comentário D22 diz "super_admin only", confirmar policy não permite gerente.
- `admin_audit_log` — append-only documentado mas RLS precisa garantir nenhum UPDATE/DELETE (não bater só em SELECT).

**Fix:** rodar `mcp__supabase__get_advisors({type:"security"})` no projeto novo + auditar cada RLS gap reportado. Priorizar tabelas com `pii` (lead_profiles, contacts, conversations).

---

### [P1] Índices faltando em padrões de query comuns

**Onde:** `ai_agent_logs(conversation_id)` JÁ tem (good, R26). Mas:

1. **`conversation_messages(conversation_id, created_at)`** — sort principal do helpdesk. Existem índices em `(sender_id, created_at)` e `(conversation_id)` separados; composto direcional `(conversation_id, created_at DESC)` reduz random I/O em conversas longas. **NÃO ENCONTRADO.**
2. **`notifications(user_id, read, created_at DESC)`** — query do sino do gestor. NÃO ENCONTRADO em migrations.
3. **`ai_debounce_queue(processed_at, expires_at)`** — `idx_debounce_queue_unprocessed (conversation_id, process_after) WHERE processed=false` resolve a leitura do timer, mas cron de cleanup precisa de `processed_at` indexado.
4. **`handoff_queue_events(department_id, status)`** — só existe `(expires_at) WHERE active` e `(assigned_user_id) WHERE active`. Query por dept pra dashboard escaneia tabela toda.
5. **`lead_profiles(contact_id)`** — FK 1:1, deveria ser UNIQUE NOT NULL com índice automático. Confirmar.

**Fix:** migration `add_missing_query_indexes_2026_05_21.sql` com `IF NOT EXISTS`. Ordem decrescente (`created_at DESC`) é mandatória pra evitar reverse scan.

---

### [P2] CORS / verify_jwt drift entre `config.toml` e edge functions

**Onde:** memory `feedback_verify_jwt_internal_functions.md` documenta regra; incidente 2026-05-17 (MCP deploy_edge_function quebrou prod com `verify_jwt:true`) reforça.

**Impacto:** não é DB direto, mas afeta RPCs internas. `ai-agent`, `ai-agent-debounce`, `whatsapp-webhook`, `transcribe-audio`, `requeue-conversations`, `assign-handoff`, `process-jobs`, `process-flow-followups`, `process-follow-ups`, `escalate-stale-handoffs`, `notify-vendor-assignment` PRECISAM `verify_jwt=false`. Qualquer um que esteja com `true` derruba o cron/webhook silenciosamente.

**Fix:** `mcp__supabase__list_edge_functions` → comparar cada `verify_jwt` ao `supabase/config.toml`. Toda divergência = redeploy CLI imediato.

---

### [P2] `is_table_protected()` whitelist desatualizada vs novas tabelas

**Onde:** `is_table_protected()` (`20260425000003_db_retention.sql`) tem 27 tabelas-núcleo whitelistadas. Mas 8 tabelas novas surgiram após (`user_feature_permissions`, `business_hours_exceptions`, `handoff_queue_events`, `e2e_test_batches`, `e2e_test_runs`, `notification_log`, `db_alert_state`, `db_cleanup_log`).

**Impacto:** se policy de retention auto-rodar com `dry_run=false` em tabela nova, pode apagar dados críticos (`user_feature_permissions` = permissões de atendentes; `business_hours_exceptions` = feriados configurados). Hoje todas estão `enabled=false` mas regra `feedback_no_secrets_in_committed_files` lembra que defesa profunda é o padrão.

**Fix:** auditar `is_table_protected` + adicionar 8 tabelas críticas. Documentar em [[wiki/erros/regras-preventivas]].

---

### [P2] Views (`v_*`) sem RLS — herdadas das tabelas base?

**Onde:** 6 views (`v_agent_performance`, `v_conversion_funnel`, `v_handoff_details`, `v_ia_vs_vendor`, `v_lead_metrics`, `v_vendor_activity`).

**Impacto:** Postgres views sem `SECURITY INVOKER` rodam com privilégios do criador (geralmente `postgres`/`supabase_admin`), bypassando RLS das tabelas base. Se as views forem expostas a `authenticated`, qualquer user enxerga dados de TODOS tenants.

**Fix:** confirmar via `SELECT viewname, viewowner, definition LIKE '%security%' FROM pg_views WHERE schemaname='public'`. Aplicar `ALTER VIEW ... SET (security_invoker = on)` (Postgres 15+).

---

### [P2] `instances.id` TEXT (R24) vs FKs UUID — heterogeneidade tipos

**Onde:** D24 documenta. `instances.id TEXT`; `inboxes.instance_id TEXT`; demais entidades (`conversations.inbox_id`, etc) usam `UUID`.

**Impacto:** funciona, mas RPCs que recebem `p_instance_id` precisam ser TEXT (R36) — qualquer migration que use UUID implícito quebra. Já bateu em 2026-05-12 (`fix_append_ai_debounce_message_instance_id_text.sql`).

**Fix:** documentar regra "instance_id é TEXT em TODA assinatura RPC e índice composto" no [[wiki/erros/regras-preventivas]]. Considerar evolução pra UUID em sprint dedicado (alto risco, exige re-sync UAZAPI).

---

### [P3] `cron.job` órfãos potenciais

**Onde:** sem `SELECT * FROM cron.job` ao vivo. Por grep, crons agendados em migrations:

| Cron | Migration | Schedule | Status esperado |
|---|---|---|---|
| `purge_system_logs_24h` | 20260512003437 | `0 * * * *` | ATIVO |
| `aggregate-metrics-hourly` | 20260417000003 | `0 * * * *` | ATIVO |
| `aggregate-metrics-daily-consolidation` | 20260417000003 | `30 0 * * *` | ATIVO |
| `handoff-queue-requeue` | 20260507000001 | `* * * * *` | ATIVO (D30) |
| `process-flow-followups` | 20260415000004 | `0 * * * *` | ATIVO |
| `e2e-automated-tests` | 20260329010000 | `0 */6 * * *` | ATIVO (M2 F4) |
| `e2e-cleanup-old-runs` | 20260329010000 | `0 3 * * *` | ATIVO |
| `db-size-monitor` | 20260425000002 | diário | ATIVO |
| `db-cleanup-weekly` | 20260425000003 | semanal | ATIVO |

**Impacto:** crons que rodam edge fns precisam `CRON_AUTH_KEY` válido + `verify_jwt:false` (feedback `feedback_verify_jwt_cron_functions.md`). Qualquer rotação de chave que esqueça o secret no Supabase Vault para silente — só percebe se rodar `mcp__supabase__execute_sql("SELECT * FROM cron.job_run_details WHERE status='failed' ORDER BY end_time DESC LIMIT 50")`.

**Fix:** dashboard saúde cron no admin (cards "X jobs falharam nas últimas 24h").

---

### [P3] `kanban_card_data`, `kanban_entity_values` — tabelas de extensão JSONB?

**Onde:** padrão "EAV" (entity-attribute-value) detectado em `kanban_fields` + `kanban_card_data` + `kanban_entity_values`.

**Impacto:** querys complexas (joins múltiplos por card). Sem `EXPLAIN ANALYZE` real impossível dizer, mas em escala (milhares de cards) o padrão tende a ser lento. Verificar índices em `kanban_card_data(card_id, field_id)` + `kanban_entity_values(entity_id, field_id)`.

---

## 3. Pendências de coleta MCP (não executadas)

Para fechar a auditoria com números reais, executar no projeto `prfcbfumyrrycsrcrvms`:

```sql
-- A. Tamanho do banco + top 10 tabelas
SELECT pg_size_pretty(pg_database_size(current_database()));
SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- B. Row counts top 10
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public'
ORDER BY n_live_tup DESC LIMIT 10;

-- C. Tabelas sem nenhuma RLS policy positiva
SELECT t.tablename FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname=t.schemaname AND p.tablename=t.tablename
WHERE t.schemaname='public' AND p.policyname IS NULL
  AND t.tablename IN (SELECT tablename FROM pg_tables WHERE rowsecurity = true);

-- D. CHECK constraints rivais
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.ai_agent_logs'::regclass AND contype='c';

-- E. Cron job_run_details — falhas últimas 24h
SELECT jobid, jobname, status, COUNT(*) FROM cron.job_run_details
WHERE start_time > now() - interval '24 hours'
GROUP BY 1,2,3 ORDER BY 4 DESC;

-- F. Tabelas com 0 rows (candidatos a dead tables)
SELECT relname FROM pg_stat_user_tables WHERE schemaname='public' AND n_live_tup = 0;
```

Depois rodar `mcp__supabase__get_advisors({type:"security"})` e `({type:"performance"})` — recomenda gap-list automática.

---

## 4. Nota final do DB

**6.5 / 10**

- **Acertos:** 89 tabelas bem estruturadas, RLS habilitada na maioria, FKs com `ON DELETE` corretos (R45), índices principais cobertos (R44 + scalability), retention pipeline existe (D22/D23), cron de saúde do banco rodando (M19 S8), separação clara entre helpdesk/CRM/AI/funis.
- **Pontos fracos:**
  - 2 constraints rivais em `ai_agent_logs` = R88 recorrente (P0).
  - Promessas pós-R114 do "banco explodindo 9h" não shipadas: `EXCLUDE USING gist` e `purge_notifications` (P0).
  - Vault `wiki/banco-de-dados.md` 10 dias stale + projeto antigo (P1).
  - Migrations de D34/D35 não commitadas (drift entre prod e repo) (P1).
  - 7-9 tabelas sem usuário no código (overhead + risco RLS frouxa) (P1).

Reduzir 1 ponto enquanto P0s não estiverem fechados. Subir pra 8+ quando o repo estiver consistente com o DB e MCP advisors retornarem 0 warnings.

---

## Links

- [[wiki/banco-de-dados]] — snapshot (precisa atualizar)
- [[wiki/erros-e-licoes]] — R114, R88, incidente 2026-05-14
- [[wiki/decisoes-chave]] — D22, D23, D25, D34, D35
- [[wiki/erros/regras-preventivas]] — R26, R44, R74
