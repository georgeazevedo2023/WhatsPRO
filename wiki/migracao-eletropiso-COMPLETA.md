---
title: Migração Eletropiso COMPLETA — referência consolidada
tags: [migracao, eletropiso, completa, referencia, supabase-novo]
sources: [sessões 2026-05-05 + 2026-05-06]
updated: 2026-05-06
---

# Migração Eletropiso — referência consolidada

> Migração completa de Eletropiso do Supabase antigo (`euljumeflwtljegknawy`, org `qwxxtqdqletmetdnqmes`) para o novo (`prfcbfumyrrycsrcrvms`, org separada). Cutover live em 2026-05-06. **13 conversas + 1.341 mensagens + 7 atendentes + IA + crons funcionando no novo.**

## Endpoints novos

| Categoria | URL/identificador |
|---|---|
| **Project ref** | `prfcbfumyrrycsrcrvms` |
| **API URL** | `https://prfcbfumyrrycsrcrvms.supabase.co` |
| **Painel** | `https://supabase.com/dashboard/project/prfcbfumyrrycsrcrvms` |
| **DB host (pooler/direct)** | `db.prfcbfumyrrycsrcrvms.supabase.co:5432` |
| **Frontend produção** | `https://crm.wsmart.com.br` (cutover 2026-05-06) |
| **n8n webhook UAZAPI inbound** | `https://fluxwebhook.wsmart.com.br/webhook/eletropiso_2026` (mesmo cluster, sem mudança) |
| **Portainer redeploy webhook** | `https://app.wsmart.com.br/api/webhooks/34259f8a-9643-4963-90c4-bf2fed4cf786` |

## Credenciais novas (rotacionar pós-validação — todas expostas no histórico)

| Item | Valor (**rotacionar**) |
|---|---|
| DB password | `eletro2233K@@88` |
| Service Role JWT | (no chat — formato `eyJhbGci...`) |
| Personal Access Token | `sbp_64d3...e28f0` (truncado — valor original no chat da sessão de migração) |
| Publishable key (anon) | `sb_publishable_ayu87rwh94XQcMt1_1ka_w_hOQy8rZe` (pública por design — não rotacionar) |
| INTERNAL_FUNCTION_KEY | (32 bytes hex regenerada — `c22c5d69...e800`, valor completo no painel `Settings → Edge Functions → Secrets`) |

## Edge Functions deployadas no novo (41)

`activate-ia, admin-create-user, admin-delete-user, admin-update-user, aggregate-metrics, ai-agent, ai-agent-debounce, ai-agent-playground, analyze-summaries, assign-handoff, assistant-chat, auto-summarize, bio-public, cleanup-old-media, database-backup, db-cleanup-old-backups, db-retention-backup, e2e-scheduled, e2e-test, fire-outgoing-webhook, form-bot, form-public, go, group-reasons, guided-flow-builder, health-check, orchestrator, process-flow-followups, process-follow-ups, process-jobs, process-scheduled-messages, refresh-avatar, requeue-conversations, scrape-product, scrape-products-batch, send-shift-report, summarize-conversation, sync-conversations, transcribe-audio, uazapi-proxy, whatsapp-webhook`

NÃO deployadas (corretamente):
- `apply-env-secrets` — deletada do antigo na Sprint 5 P2-8 (órfã sem código no repo)

## Secrets das Edge Functions (8 custom + defaults Supabase)

| Nome | Onde está usado |
|---|---|
| `UAZAPI_SERVER_URL` | URL do servidor UAZAPI (`https://wsmart.uazapi.com`) |
| `UAZAPI_ADMIN_TOKEN` | Admin auth |
| `GROQ_API_KEY` | Llama (summaries) + Whisper (transcrição) |
| `GEMINI_API_KEY` | TTS + fallback LLM |
| `MISTRAL_API_KEY` | Fallback LLM |
| `OPENAI_API_KEY` | LLM principal (gpt-4.1-mini) |
| `ALLOWED_ORIGIN` | CORS dinâmico (`https://crm.wsmart.com.br`) |
| `INTERNAL_FUNCTION_KEY` | Auth interno entre fns |

Defaults Supabase (auto-providos): `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_ANON_KEY` (legacy), `SUPABASE_SERVICE_ROLE_KEY` (legacy), `SUPABASE_JWKS`, `SB_REGION`, `SB_EXECUTION_ID`, `DENO_DEPLOYMENT_ID`.

## Vault DB secrets (1)

| Nome | Valor |
|---|---|
| `SUPABASE_ANON_KEY` | publishable do novo (usado pelos crons via Bearer auth) |

## pg_cron jobs ativos no novo (15)

**SQL-only** (10):
- `cleanup-expired-summaries` (3 AM diário)
- `cleanup-rate-limit-log` (15min)
- `e2e-cleanup-old-runs` (3 AM)
- `cleanup-guided-sessions` (2 AM)
- `cleanup-assistant-cache` (1x/h, min 15)
- `db-size-monitor` (06:07 diário)
- `db-cleanup-weekly` (Dom 04:13)
- `db-cleanup-with-backup-weekly` (Dom 05:23)
- `db-backup-retention-monthly` (dia 1 03:17)
- `keep-alive-daily` (4 AM, INSERT na keep_alive — Free Forever)

**HTTP-based** (5):
- `process-flow-followups` (1x/h)
- `aggregate-metrics-hourly` (1x/h)
- `aggregate-metrics-daily-consolidation` (00:30)
- `platform-usage-snapshot` (06:11 diário, SQL)
- `e2e-automated-tests` (a cada 6h)

**NÃO recriado** (n8n cuida no cluster externo):
- `requeue-conversations` (D30 fila inteligente, 1min) — fluxo n8n atualizado pra apontar pro novo

## Schema final do novo

| Métrica | Valor |
|---|---|
| Migrations registradas | 164 (159 push + 5 antigo-MCP-only resgatadas) |
| Base tables | 91 |
| Views | 6 |
| RLS policies | 224 |
| Functions | 85+ |
| Indexes | 353 |
| Triggers | 41 |
| Storage buckets | 5 |

## Dados Eletropiso migrados (cross-check diff = 0)

| Categoria | Rows |
|---|---:|
| Auth users | 7 (super_admin × 1 + gerente × 1 + user × 5) |
| Instance + inbox + dept | 1+1+1 |
| Department members + inbox_users + user_instance_access | 6+6+7 |
| Contacts + lead_profiles | 15+13 |
| Conversations + messages | 17 + **1.341** |
| Lead score history + memory | 5+2 |
| AI agents + products + knowledge + validations + profiles | 1+7+13+**274**+4 |
| Kanban (boards + columns) | 1+8 |
| Lead databases (+ entries) | 1+5 |
| WhatsApp forms + fields | 6+25 |
| Flows + steps + triggers + states + events | 1+2+1+2+12 |
| Handoff queue events | 11 |
| Globais (system_settings + admin_audit_log + notifications + db_retention + platform_usage) | 13+17+7+7+4 |
| Storage objects | 4 (1 contact-avatar + 3 bio-images) |

**Total: ~1.944 rows + 4 storage objects.**

## n8n flows atualizados (manualmente pelo user)

| Flow | Mudança |
|---|---|
| `requeue-conversations` (cron 1min) | URL `euljumeflwtljegknawy` → `prfcbfumyrrycsrcrvms` + Bearer `sb_publishable_ayu87rwh...` (publishable nova) |
| `whatsapp-webhook` (UAZAPI inbound) | URL `euljumeflwtljegknawy` → `prfcbfumyrrycsrcrvms` |

## UAZAPI

Sem mudança — webhook da instância Eletropiso continua apontando pra `https://fluxwebhook.wsmart.com.br/webhook/eletropiso_2026` (n8n cluster mantido).

## Hotfixes pós-cutover (lições aprendidas)

| Hotfix | Causa raiz | Fix |
|---|---|---|
| **R97** | `auth.users.instance_id` ficou NULL ao migrar via SQL (omiti no INSERT) | `UPDATE auth.users SET instance_id = '00000000-0000-0000-0000-000000000000'` |
| **R98** | GRANTs ausentes em tabelas public (Lovable migrations puladas tinham GRANT implícito) | `GRANT ... TO anon, authenticated` em todas tabelas + DEFAULT PRIVILEGES |
| **R99** | 27 colunas faltando em 7 tabelas (Lovable ALTER TABLE skipped) | `ALTER TABLE ADD COLUMN IF NOT EXISTS` + UPDATE via dblink puxando valores reais |

Documentadas em `wiki/erros-e-licoes.md`.

## Commits da migração (em ordem)

```
1666060 fix(audit): Sprint 2 — 4 fixes frontend + CORS dinamico
e682971 fix(audit): Sprint 3 — P1-2 verify_jwt drift fechado
b3d8e02 docs(migracao): Onda 0 — inventario Eletropiso completo
92914ac docs(migracao): consolida 4 bloqueios da Onda 1 + 8 secrets
163dea7 fix(audit): Sprint 5 codigo — P2-7, P2-8, P2-10
2858d0e docs(migracao): Onda 1 shipped — schema novo replicado
1fedf59 docs(migracao): Onda 2 SHIPPED — 1944 rows via dblink
ebda665 docs(migracao): Onda 2 storage shipped + Onda 3 parcial
a182169 docs(migracao): Onda 3 SHIPPED — 8 secrets
5ce9a22 docs(migracao): Onda 4 SHIPPED — 41 edge fns deployadas
0ae5940 docs(migracao): Onda 5 SHIPPED — 15 pg_cron jobs no novo
a6b831c feat(migracao): cutover Eletropiso pro novo Supabase
6da8fc9 docs(migracao): Ondas 6+7 SHIPPED — cutover Eletropiso LIVE
e5dd178 fix(migracao): hotfix auth.users instance_id NULL (R97)
a13bf3d fix(migracao): hotfix 2 — GRANTs faltando (R98)
a37eaec fix(migracao): hotfix 3 — 27 colunas faltando (R99)
```

## Pendências pós-migração

### Operacionais (alta prioridade)
- [ ] Smoke E2E completo: mandar WhatsApp pro 558181696546, ver chegar no helpdesk, IA responder
- [ ] Validar 6 atendentes Eletropiso conseguem logar (senhas originais preservadas via bcrypt)
- [ ] **Pausar projeto antigo** `euljumeflwtljegknawy` (recuperável 30d) — só após smoke 100% OK
- [ ] Trocar `ADMIN_PASSWORD` do `.env.local` (`123456@` está exposto no chat) — login admin

### Rotação obrigatória de credenciais (todas expostas no chat/histórico Git)
- [ ] `GROQ_API_KEY` (https://console.groq.com/keys)
- [ ] `MISTRAL_API_KEY` (https://console.mistral.ai/api-keys/)
- [ ] `OPENAI_API_KEY` (https://platform.openai.com/api-keys)
- [ ] `UAZAPI_ADMIN_TOKEN` (painel UAZAPI)
- [ ] DB password antigo (rotacionar antes de pausar — não é estritamente necessário se vai pausar)
- [ ] DB password novo (`eletro2233K@@88`)
- [ ] Service Role JWT do novo (Settings → API → Rotate)
- [ ] Personal Access Token (`sbp_*`) do novo

**Não precisa rotacionar:**
- Publishable key (`sb_publishable_*`) — pública por design
- Bcrypt hashes dos atendentes — preservados, atendentes mantêm senhas originais

### Cleanup
- [ ] 13 conversas esperadas vs 17 no DB — verificar se 4 estão arquivadas/closed (filtros UI)
- [ ] Investigar 1 erro `process-flow-followups` 500 RLS detectado nos smoke tests (não-bloqueante)
- [ ] Repo local tem migrations duplicadas vs schema_migrations do novo (futuros `db push` vão reclamar)

## Frase pra retomar (próxima sessão)

```
continuar smoke E2E migracao eletropiso pos hotfix R99
```

## Wikis relacionadas

- [[wiki/migracao-eletropiso-handoff]] — handoff inicial (decisões + 8 ondas plano)
- [[wiki/migracao-eletropiso-inventario]] — Onda 0 inventário read-only do antigo
- [[wiki/auditoria-completa-2026-05-05]] — auditoria que precedeu a migração (6 sprints)
- [[wiki/erros-e-licoes]] — R97, R98, R99 documentados
- [[log.md]] — todos os passos cronológicos
