---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-13

### fix(m19-s2): aggregate-metrics — 3 bugs corrigidos + T7/T8 populados (commit 827fd17)

**Auditoria S2 com 3 agentes paralelos revelou:**

**Bug 1 (crítico — conversas zeradas):** `eq('inboxes.instance_id', instanceId)` via PostgREST não funciona — retornava array vazio. Corrigido para 2 passos: `inboxes→ids` + `conversations.in('inbox_id', ids)`.

**Bug 2:** `conversations.resolved_at` não existe. Corrigido para `updated_at` (proxy correto para `status='resolved'`).

**T7 — lead_score_history (estava sem populate):**
- `calculateScoreDelta(tags)`: +15 intencao:alta, +8 media, +30 conversao:comprou, -5 objecao:*, -20 motivo_perda:*
- `updateLeadScores()`: batch por instância → atualiza `lead_profiles.current_score` + insere em `lead_score_history`

**T8 — conversion_funnel_events (estava sem populate):**
- `detectFunnelStage(tags)`: qualification (intencao:|dado_pessoal:) → intention (intencao:alta|media) → conversion (conversao:*)
- `recordFunnelEvents()`: insere evento por conversa+stage sem duplicatas

**Deploy:** `aggregate-metrics` ✅ | commit 827fd17

**Regra nova registrada:** NUNCA mock data — sempre dados reais do DB.

---

### feat(m19-s2): Armazenamento & Agregação — schema, views, aggregate-metrics, cron (commits 755d86a+45756f4)

**Schema (T1+T6+T7+T8):**
- `shadow_metrics.seller_id` FK corrigida: `contacts` → `auth.users` (T1)
- `lead_profiles`: +`current_score INT DEFAULT 50` +`metadata JSONB` (T6+T7)
- Nova tabela `lead_score_history` (T7): histórico de variações de score
- Nova tabela `conversion_funnel_events` (T8): 4 etapas contact/qualification/intention/conversion

**Views SQL (T2):** 6 views com `security_barrier`:
- `v_lead_metrics`, `v_vendor_activity`, `v_handoff_details`
- `v_agent_performance`, `v_conversion_funnel`, `v_ia_vs_vendor`
- Bug: `conversations.resolved_at` não existe → corrigido para `updated_at` onde `status='resolved'`

**Edge Function `aggregate-metrics` (T3+T4):**
- `mode=daily`: `shadow_extractions` → `shadow_metrics` daily (fallback: `ai_agent_logs`)
- `mode=daily_consolidation`: agrega diários em weekly/monthly
- Trata erro por instância (não falha tudo se uma instância falhar)

**Webhook T6:** extrai `trackId`/`trackSource` do payload UAZAPI → `lead_profiles.metadata` (fire-and-forget)

**Cron T5:** `aggregate-metrics-hourly` (`0 * * * *`) + `aggregate-metrics-daily-consolidation` (`30 0 * * *`)

**Deploy:** `aggregate-metrics` ✅ + `whatsapp-webhook` ✅ | Migrations: 3 aplicadas ✅ | tsc 0 erros ✅

---

### deploy(m19-s1): ai-agent + whatsapp-webhook em produção (commits 2db9299 + fbb7c2d)

- **ai-agent** deployado: shadow bilateral, tags expandidas (+12 VALID_KEYS), extract_shadow_data, isTrivialMessage (importada de _shared)
- **whatsapp-webhook** deployado: roteamento `fromMe:true` → shadow sem debounce
- Dedup isTrivialMessage: inline removida de index.ts, importa de `_shared/aiRuntime.ts` (canônica, inclui 'ok entendi')
- tsc 0 erros ✅ | 436 testes passando ✅

### feat(m19-s1): Shadow Bilateral — Coleta de Dados do Vendedor (commit 2db9299)

**M19 Sprint 1 — Shadow Inteligente (Coleta)** — 8 tasks, 4 agentes paralelos.

**T1 — shouldTriggerShadowFromWebhook + routing (webhook)**
- Nova função em `aiRuntime.ts`: `fromMe:true` + `status_ia='shadow'` + não-audio + conteúdo ≥5 chars → `true`
- Webhook: após bloco principal, if shadow vendor → chama `ai-agent` diretamente com `shadow_only:true` (sem debounce)

**T2 — Shadow bilateral (ai-agent):** Extrai `shadow_only`, `vendor_message` do body. Contexto das últimas 5 msgs.

**T3 — Tags lead expandidas**: `concorrente:*`, `intencao:*`, `motivo_perda:*`, `conversao:*`, `dado_pessoal:*`

**T4 — Tags vendedor**: `vendedor_tom`, `vendedor_desconto`, `vendedor_upsell`, `vendedor_followup`, `venda_status`, `pagamento`

**T5 — extract_shadow_data**: INSERT INTO shadow_extractions (7 dimensões, batch_id por run)

**T6 — isTrivialMessage**: pré-filtro len<5/emoji/trivial → pula LLM + loga shadow_skipped_trivial

**T7 — Logging**: shadow_extraction_lead vs shadow_extraction_vendor com tags_set/is_vendor metadata

**T8 — 22 testes** (7 novos + 15 regressão ✅)

---

> Entradas de 2026-04-12 (agent fixes, clear context, discuss métricas) arquivadas em:
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
