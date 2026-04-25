---
title: M19 S8 — DB Monitoring & Auto-Cleanup
phase: M19 S8
status: APPROVED (decisões tomadas 2026-04-25)
created: 2026-04-25
updated: 2026-04-25
goal: Garantir que o banco nunca passe de 300 MB via 3 camadas (visibilidade + alertas + cleanup automático)
estimated_hours: 6-8h
risk_level: MEDIUM (Camada 3 envolve DELETE em produção)
---

## Decisões aprovadas (2026-04-25)

| # | Decisão | Resposta |
|---|---------|----------|
| 1 | Hard limit | **300 MB** (Free Plan Supabase tem 500 MB de margem) |
| 2 | NotificationBell escopo | Notificar **somente super_admin** (não atendentes/gerentes) |
| 3 | `conversation_messages` retenção | **120 dias** (mais recente que isso = mantém) |
| 4 | Backup JSONL antes de DELETE | **Seletivo:** ON por padrão só em `conversation_messages`. Outras tabelas: cleanup direto. Backup tem retenção de 1 ano. |



# M19 S8 — DB Monitoring & Auto-Cleanup

## Goal (visão de uma frase)

Banco **nunca** passa de 300 MB — combinando visibilidade no dashboard, alertas proativos via pg_cron, e limpeza automática de dados antigos.

## Estado atual (baseline 2026-04-25)

- **Tamanho:** 24 MB / 300 MB (12% do limite)
- **Maior tabela:** `conversation_messages` (1.94 MB)
- **Crescimento esperado:** baixo no curto prazo, alto se uso B2B escalar
- **Infra existente reaproveitada:** `notifications` table (M17 F5), pg_cron rodando, dashboard `/gestao` (M19 S3), NotificationBell (M19 S7)

## Fases

```
Camada 1 (visibilidade)  →  Camada 2 (alertas)  →  Camada 3 (cleanup)
   1-2h                       2-3h                    3h
```

Ordem importa: **não shipar Camada 3 sem Camada 1+2.** Limpeza sem visibilidade é cirurgia no escuro.

---

## Fase 1 — Camada 1: Visibilidade (KPI no Dashboard)

### O que entrega
Card de KPI no `/gestao` mostrando tamanho atual, % usado, top 5 tabelas, com semáforo verde/amarelo/vermelho.

### Tasks

| # | Task | Detalhe |
|---|------|---------|
| 1.1 | Migration: função SQL `get_db_size_summary()` | SECURITY DEFINER, retorna JSONB com `total_bytes`, `total_pretty`, `percent_used`, `status` ('green'/'yellow'/'red'/'critical'), `threshold_mb=200`, `top_tables[]` |
| 1.2 | RLS: só super_admin pode chamar | `GRANT EXECUTE TO authenticated` + check `is_super_admin(auth.uid())` no início da função |
| 1.3 | Hook `useDbSize` | Chama RPC, refetch a cada 5min (DB size não muda rápido), retorna `{ data, loading, error }` |
| 1.4 | Componente `DbSizeCard.tsx` | Card com: barra de progresso colorida, tamanho atual / limite, top 5 tabelas em lista compacta, badge "última verificação: há X min" |
| 1.5 | Inserir card em `Gestao.tsx` | Visível só para super_admin; posicionar próximo aos outros KPIs |
| 1.6 | Documentar no vault | wiki/casos-de-uso/dashboard-detalhado.md (subseção "Monitoramento de DB") |

### Thresholds (recalculados para limite de 300 MB)

| Status | Tamanho | % do limite | Cor | Ação |
|--------|---------|-------------|-----|------|
| green | < 150 MB | < 50% | 🟢 | nada |
| yellow | 150–224 MB | 50–75% | 🟡 | atenção |
| red | 225–269 MB | 75–90% | 🔴 | agir |
| critical | ≥ 270 MB | ≥ 90% | ⚠️ | urgente |

### Validação
- `npx tsc --noEmit` = 0 erros
- Card aparece para super_admin, **não aparece** para gerente/atendente
- Refetch automático a cada 5min funciona
- Mostra valor real (24 MB no momento)

---

## Fase 2 — Camada 2: Alertas Proativos

### O que entrega
Job pg_cron diário que detecta cruzamento de threshold e dispara notification. Sem spam (1 alerta por threshold).

### Tasks

| # | Task | Detalhe |
|---|------|---------|
| 2.1 | Migration: tabela `db_alert_state` | Singleton (id=1): `last_threshold_status TEXT`, `last_notified_at TIMESTAMPTZ`, `last_size_bytes BIGINT` |
| 2.2 | Migration: função `check_db_size_and_alert()` | (a) Calcula size atual; (b) compara com `last_threshold_status`; (c) se mudou para pior, INSERT notification + UPDATE state; (d) se voltou pra melhor, só UPDATE state (sem notification) |
| 2.3 | Migration: pg_cron schedule | `SELECT cron.schedule('db-size-monitor', '7 6 * * *', 'SELECT check_db_size_and_alert()')` — todo dia às 06:07 UTC (off-minute, off-peak) |
| 2.4 | Mensagens claras no notification | `title: "Banco em {status}"`, `body: "DB com X MB ({P}% do limite). Top consumidor: {tabela} ({Y MB})."`, `severity: warning/critical/urgent` |
| 2.5 | Linkar notification ao card da Camada 1 | Click na notification abre `/gestao` com scroll até DbSizeCard |
| 2.6 | Tests | E2E: simular size de 100 MB → notification "warning" criada; rerun → não duplica; size cai pra 50 MB → state reset; size sobe pra 150 MB → notification "critical" criada |
| 2.7 | Documentar no vault | wiki/casos-de-uso/dashboard-detalhado.md + wiki/decisoes-chave.md (D22 — política de monitoramento) |

### Lógica de dedup (importante)

```
size atual: 110 MB → status='yellow'
last_threshold_status='green' → CRUZOU pra pior → INSERT notification + UPDATE state to yellow

dia seguinte: 115 MB → status='yellow'
last_threshold_status='yellow' → NÃO mudou → silêncio

dia seguinte: 95 MB → status='green'
last_threshold_status='yellow' → MELHOROU → UPDATE state to green (sem notification — boa notícia não precisa de spam)

dia seguinte: 105 MB → status='yellow'
last_threshold_status='green' → CRUZOU pra pior de novo → INSERT notification
```

### Validação
- pg_cron rodando (`SELECT * FROM cron.job WHERE jobname='db-size-monitor'`)
- Notification criada após primeiro cruzamento
- Sem duplicatas em runs subsequentes
- NotificationBell mostra o sino vermelho quando há alerta

---

## Fase 3 — Camada 3: Auto-Cleanup com Retenção Configurável

### O que entrega
Sistema de retenção configurável por tabela: admin define "quantos dias manter" e job semanal limpa o que passou. **Tudo desabilitado por padrão** — admin precisa ativar manualmente cada política.

### Princípios de segurança

1. **Default OFF** — nenhuma política ativa após deploy. Admin liga uma a uma.
2. **Dry-run mode** — antes de habilitar pra valer, mostra "isso deletaria X registros de Y MB" sem executar.
3. **Backup opcional** — antes de DELETE, pode dumpar para Storage como JSONL (configurável).
4. **Tabelas-nucleo PROTEGIDAS** — nunca deletar de `lead_profiles`, `contacts`, `ai_agents`, `conversations`, `inboxes`, `instances`, `auth.*`. Whitelist explícita.
5. **Soft-delete primeiro** — `conversation_messages` marca `archived=true`, hard-delete só depois de outro período (ex: 30d archived → delete).
6. **Audit trail** — toda execução loga em `db_cleanup_log`: quando rodou, quantos registros, qual tabela, dry-run ou real.

### Tasks

| # | Task | Detalhe |
|---|------|---------|
| 3.1 | Migration: tabela `db_retention_policies` | `id, table_name, days_to_keep, condition_sql TEXT, enabled BOOLEAN DEFAULT false, dry_run BOOLEAN DEFAULT true, backup_before_delete BOOLEAN DEFAULT false, last_run_at, last_deleted_count, last_deleted_bytes, last_backup_path TEXT` |
| 3.2 | Migration: tabela `db_cleanup_log` | Histórico append-only de execuções: `policy_id, ran_at, deleted_count, deleted_bytes, was_dry_run, error_message` |
| 3.3 | Migration: seed de políticas SUGERIDAS (todas OFF) | conversation_messages 120d (status='resolvida') + **backup_before_delete=true**, flow_events 60d, ai_agent_logs 30d, shadow_metrics 180d, ai_debounce_queue 1d (processed=true), instance_connection_logs 30d |
| 3.4 | Migration: função `apply_retention_policy(policy_id INT)` | (a) Verifica se policy enabled; (b) calcula registros candidatos; (c) se dry_run=true: log sem delete; (d) se dry_run=false E backup_before_delete=true: chama edge function `db-backup-jsonl` antes; (e) DELETE + log; (f) UPDATE policy.last_run_at + last_backup_path |
| 3.4b | Edge function: `db-backup-jsonl` | Recebe `{table_name, condition, target_path}`, faz SELECT, gera JSONL gzipado, faz upload para Storage `db-backups/`, retorna path. Idempotente, atômico (só DELETE se backup ok). |
| 3.4c | Bucket Storage: `db-backups` (privado) | Migration cria bucket, RLS: só super_admin lê/baixa. Estrutura: `db-backups/YYYY/MM/{table}_{timestamp}.jsonl.gz` |
| 3.4d | Retenção dos próprios backups | pg_cron mensal apaga JSONL >365 dias do Storage. Função `cleanup_old_backups()` lista bucket, deleta arquivos antigos. |
| 3.5 | Migration: função `apply_all_retention_policies()` | Loop em policies WHERE enabled=true, chama apply_retention_policy para cada |
| 3.6 | Migration: pg_cron weekly | `SELECT cron.schedule('db-cleanup', '13 4 * * 0', 'SELECT apply_all_retention_policies()')` — domingo às 04:13 UTC (off-peak, off-minute) |
| 3.7 | Migration: whitelist de tabelas protegidas | Função interna `is_table_protected(name)` retorna true para core entities; toda apply_retention_policy começa checando whitelist |
| 3.8 | Admin UI: tab "Retenção" em Settings | Lista de policies, toggle enable/dry-run, input para days_to_keep, "Executar agora (dry-run)" button mostra preview, log de últimas 10 execuções |
| 3.9 | Integration com Camada 2 | Quando notification "critical" dispara, sugerir no body "considere ativar políticas de retenção em /admin/retention" |
| 3.10 | Tests | (a) policy enabled=true + dry_run=true: log mas não deleta; (b) policy enabled=true + dry_run=false: deleta + log; (c) tabela protegida: erro; (d) condition_sql inválido: erro graceful |
| 3.11 | Documentar no vault | wiki/casos-de-uso/db-retention-detalhado.md (novo wiki) + atualizar erros-e-licoes.md com R74 (whitelist obrigatória) |

### Políticas sugeridas (todas OFF por padrão; backup só onde marcado ✅)

| Tabela | Manter | Condição extra | Backup JSONL | Risco | Default ON? |
|--------|--------|----------------|--------------|-------|-------------|
| `ai_debounce_queue` | 1 dia | `processed=true` | ❌ | 🟢 baixo (fila volátil) | considerar ON após validação |
| `instance_connection_logs` | 30 dias | nenhuma | ❌ | 🟢 baixo (logs operacionais) | OFF (admin decide) |
| `ai_agent_logs` | 30 dias | nenhuma | ❌ | 🟡 médio (auditoria) | OFF |
| `flow_events` | 60 dias | nenhuma | ❌ | 🟡 médio (debug de orquestrador) | OFF |
| `shadow_metrics` | 180 dias | nenhuma | ❌ | 🟡 médio (analytics histórico) | OFF |
| `conversation_messages` | **120 dias** | `conversation.status='resolvida' AND last_message_at older than 120d` | ✅ **SIM** (default) | 🔴 alto (LGPD, suporte, contexto AI) | **OFF — exige decisão consciente do admin** |
| `assistant_cache` | 5 min (TTL) | já tem auto-clean | — | — | já existente |

### Validação

- Policy enabled=false: cron não toca
- Policy enabled=true + dry_run=true: log mostra "X linhas seriam deletadas"
- Policy enabled=true + dry_run=false: deleta + log
- Tentar policy em tabela protegida: erro `is_table_protected: cannot delete from core table`
- Camada 1 mostra redução de tamanho após primeira execução

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Auto-cleanup deleta dado importante | médio | alto | Default OFF + dry_run obrigatório antes de habilitar + whitelist de tabelas protegidas + audit trail |
| pg_cron job falha silenciosamente | baixo | médio | Log de execução em `db_cleanup_log`; alerta na Camada 2 se "última execução > 8 dias" |
| Notification spam | baixo | médio | Lógica de dedup por `last_threshold_status` (1 alerta por cruzamento) |
| Função SQL com bug em condition_sql | médio | alto | Validar sintaxe no admin UI antes de salvar; dry_run pega no preview |
| LGPD: deletar dados de cliente sem consentimento | baixo | alto | Documentar política em ToS; conversation_messages requer flag explícito + condição `status='resolvida'` |
| pg_cron interfere com horário de pico | baixo | baixo | Schedules off-peak (06:07 UTC e 04:13 UTC domingo) |

## Plano de Rollback

| Camada | Rollback |
|--------|----------|
| 1 | Remover `DbSizeCard` da página `/gestao`; manter função SQL (sem custo) |
| 2 | `SELECT cron.unschedule('db-size-monitor')` + drop função; `db_alert_state` vira tabela morta (sem custo) |
| 3 | `SELECT cron.unschedule('db-cleanup')` + UPDATE all policies SET enabled=false; tabelas e funções permanecem (idempotente) |

Cada camada é independente — pode dar rollback em uma sem afetar as outras.

## Dependências

- Camada 2 depende de `notifications` table (existe — M17 F5)
- Camada 2 depende de NotificationBell no frontend (M19 S7 — **ainda não shipado!**)
  - **Decisão aprovada:** notificações só para super_admin. Implementar Bell mínimo apenas para super_admin junto com Camada 2 (escopo reduzido). Atendentes/gerentes não veem essas alertas. Quando M19 S7 shipar pra geral, Bell já existe — só amplia escopo.
- Camada 3 depende de UI de admin (Settings tab) — verificar se existe rota/componente

## Estimativa

| Fase | Trabalho | Risco | Tempo |
|------|----------|-------|-------|
| 1 | Migration + hook + card + integração | baixo | 1-2h |
| 2 | Migrations + pg_cron + dedup logic + tests | médio | 2-3h |
| 3 | 3 migrations + admin UI + 11 tasks + tests | alto | 3h+ |
| **Total** | | | **6-8h** |

## Decisões resolvidas ✅

1. ✅ **Hard limit:** 300 MB (Free Plan Supabase tem 500 MB de margem)
2. ✅ **NotificationBell:** mínimo super_admin-only junto com Camada 2
3. ✅ **conversation_messages retention:** 120 dias + soft-delete + condição `status='resolvida'`
4. ✅ **Backup JSONL:** seletivo — ON em `conversation_messages`, OFF nas demais. Retenção 1 ano.

## Critérios de Aceite

- [ ] DbSizeCard visível em `/gestao` para super_admin com semáforo correto
- [ ] pg_cron daily rodando + log de execução em `cron.job_run_details`
- [ ] Notification criada quando threshold cruza (testado com simulação)
- [ ] Dedup funciona (sem spam em runs sequenciais no mesmo threshold)
- [ ] Admin UI lista políticas com toggle + dry-run preview
- [ ] Whitelist bloqueia tentativa de retenção em tabela core
- [ ] Audit trail em `db_cleanup_log` com 100% das execuções
- [ ] Vault atualizado: 3 wikis + 2 entradas em erros-e-licoes + 1 decisão-chave
- [ ] tsc 0 erros + tests passando

---

## Links

- [[wiki/roadmap]] — M19 S8 a adicionar
- [[wiki/erros-e-licoes]] — R74 (whitelist) a adicionar
- [[wiki/decisoes-chave]] — D22 (política de monitoramento) a adicionar
