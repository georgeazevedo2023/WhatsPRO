---
title: Log Arquivo 2026-05-14 — Bugs AI Agent + retention
type: log-arquivo
---

# Log arquivado: 2026-05-14

> Entradas movidas de `log.md` em 2026-05-17 pra manter root sub-300 linhas.

## 2026-05-14 (manhã) — Fix bugs 8+11 AI Agent: cross-category leak + fallback genérico (v7.36.6)

Bugs 8-11 descobertos em 2026-05-13 madrugada++ ("produto fora do catálogo"). Diagnóstico + fix + 2 E2E prod via webhook POST.

- **Bug 8** (cross-category leak): fuzzy `pg_trgm` retornava "Sol e Chuva" tinta pra query "chuveiro". Auto-tag sobrescrevia `interesse:` silente via `mergeTags`.
- **Bug 11** (fallback genérico): `phrasingDiscipline` em `ai-agent/index.ts:1797` tinha exemplo literal hardcoded "sala, cozinha, quarto ou banheiro" — LLM copiava como exemplos reais.
- **Bug 12 bonus** (não fixado, tracked): LLM crava `interesse:hidraulica` pra chuveiro (categoria inexistente). Mitigado pelo fallback chain.

**Fix shipado:** helper `filterProductsByExpectedCategory` + chain `args.category → interesse tag → searchText`. Filtro 2x no `search_products`. Guard contra overwrite. `buildEnrichmentInstructions` com fallback chain pra category.

**Validação E2E Eletropiso:** Lead 1 (4 turns) qualificação coerente. Lead 2 (1 turn direto) — antes: "(exemplos: sala, cozinha, quarto ou banheiro)" → agora: "Pra te ajudar com o chuveiro certo, qual o tipo você prefere?". Bug 9 (alucinação) sumiu junto. Bug 10 (Olá!) não reproduziu.

tsc=0. Vitest 109/109. Detalhe completo `CHANGELOG v7.36.6`. Frase de retomada: *"continuar bug 12 LLM interesse invalido 2026-05-15"*.

---

## 2026-05-14 — Fix loop de fila + retention notifications (v7.36.5, banco 116 MB → 35 MB)

Gestor reparou que banco saltou de ~50→116 MB em 9h via Dashboard do Gestor. Investigação: 22.682 `handoff_queue_events.status='active'` numa única conversa sandbox + 136.521 `notifications` tipo `handoff_queue_full_rotation` acumuladas em 9h. Causa: cron criava events em loop quando eu fazia reset `status_ia='active'` pra refazer testes; sem constraint DB-level, acumulou silente.

**Fix 3 camadas (todas em prod):**
1. Migration `d30_one_active_event_per_conversation`: EXCLUDE constraint (1 active/conv) + `btree_gist`.
2. `_shared/handoffQueue.ts`: `assignHandoff` agora reusa event ativo (UPDATE) em vez de INSERT duplicado.
3. `requeue-conversations/index.ts`: `notifyGestores` dedup por (tipo, conversa) <6h.
4. Migration `notifications_retention_policy`: cron horário `purge_notifications_hourly` (full_rotation 6h, lidas 7d, não-lidas 30d). Jobid 36 ativo.

**Cleanup:** DELETE events + notifs zumbis + VACUUM FULL nas duas tabelas. Banco voltou pra 35 MB.

**Deploys:** `requeue-conversations` + `ai-agent` + `assign-handoff`. Lição em [[wiki/erros-e-licoes]].

**Próximo handoff:** *"feature retention check 2026-05-15"* — auditar TODAS as tabelas de evento (`ai_agent_logs`, `automation_events`, `audit_logs`) buscando outras sem retention.

---

