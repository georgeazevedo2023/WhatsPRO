---
title: Log Arquivo — M19 S3-S5 (2026-04-13)
tags: [log, arquivo, m19, s3, s4, s5]
updated: 2026-04-14
---

# Log Arquivo — M19 S3-S5 (2026-04-13)

> Entradas arquivadas de log.md para manter <200 linhas.

## 2026-04-13 (M19-S5 IMPLEMENTADO — IA Conversacional)

### Sprint S5 implementado — 7 fases, ~13 arquivos

**P1: Migration aplicada em produção**
- `20260419000001_s5_assistant_tables.sql`
- Tabelas: `assistant_conversations` (histórico JSONB) + `assistant_cache` (dedup hash+TTL)
- RLS: user vê suas conversas, gerente/super_admin lê cache
- Trigger `set_updated_at`, cron cleanup cache a cada hora

**P2: assistantQueries.ts — 20 intents parametrizados**
- Cada intent usa PostgREST API (SEM SQL raw)
- Todas as queries filtram por `instance_id` (multi-tenant)

**P3: Edge function assistant-chat** — Auth + Rate limit + Cache + NLU + Format (2x gpt-4.1-mini)

**P4: useAssistantChat.ts** — Hook React com messages, loading, sendMessage, clearChat

**P5: Widget flutuante** — 4 componentes, Ctrl+J toggle, fixed bottom-right

**P6: Página /dashboard/assistant** — Sidebar histórico + chat full-screen

**P7: Build** — tsc 0 erros | npm run build ok

### Auditoria S5 — 6 bugs corrigidos
B1: localStorage.setItem em render. B2: widget não reativo. B3: cache upsert R36. B4: role check crash dual roles. B5: leads_count limite 1000. B6: saveToConversation type.

---

## 2026-04-13 (M19-S4 COMPLETO — Fichas Individuais)

7 planos, 20 commits, 27 novos arquivos. P1: Migration views + goals. P2: Ficha Vendedor. P3: Ficha Agente IA. P4: Painel Transbordo. P5: Métricas Origem. P6: Metas Configuráveis. P7: Navegação (4 rotas + sidebar).

---

## 2026-04-13 (M19-S3 — Dashboard do Gestor)

11 arquivos, tsc 0 erros. useManagerMetrics (6 views), 7 componentes (Filters, KPIs, Charts, Funnel, IAvsVendor, Ranking), ManagerDashboard page, rota /dashboard/gestao.
