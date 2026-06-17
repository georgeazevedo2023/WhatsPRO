---
title: Auditoria de Pendências — 2026-06-17 (pós v7.94.0)
tags: [auditoria, backlog, pendencias, divida-tecnica, seguranca]
sources: [workflow 5 agentes (doc+código+backlog+followups), advisor live, SQL prfcbfumyrrycsrcrvms]
updated: 2026-06-17
audited_at: 2026-06-17
---

# O que falta fazer no WhatsPRO (auditoria 2026-06-17)

> Auditoria ampla (workflow: doc-health + backlog + código/dívida + follow-ups v7.94.0 → síntese), verificada contra código (grep/wc), DB e advisor ao vivo — **não confiou no texto das docs**. Atualiza o backlog de [[wiki/auditoria-estrutura-2026-06-14]].

## Resumo

**Código são, documentação desalinhada.** Build verde (vitest 1926/0, 0 erros TS, vault ≤300 lin), v7.94.0 (trava `human_handling_at`) viva em prod com **0 regressão** (RULE 1/RULE 2 = 0 vazamentos). O que falta: (a) **doc-drift** (números de progresso divergentes, RULES.md aponta Validator aposentado); (b) **dívida schema/segurança** (S9 RLS Helpdesk, RLS `USING(true) TO public`, schema órfão Fluxos v3.0); (c) **1 bug novo** (BioLinksPage hooks). **Nenhum P0 de prod.** Doc-drift do orquestrador/roadmap/RULES e o particionamento do CHANGELOG **já corrigidos nesta sessão**.

## Tabela priorizada

| Pri | Item | Área | Esforço | Evidência | Ação |
|---|---|---|---|---|---|
| **P1** | **BUG Rules-of-Hooks**: `BioLinksPage.tsx` early-return ANTES de 14 hooks → crash ("rendered fewer hooks") p/ não-superadmin | code | quick | `BioLinksPage.tsx:36-59` (tb `KnowledgeConfig.tsx:217`, `AnyFeatureRoute.tsx:26`) | Mover return p/ depois dos hooks. Único lint que é bug real. |
| **P1** | **S9 — RLS Helpdesk só frontend (R73)**: `can_view_unassigned`/`can_view_all_in_dept` não enforçados no backend → atendente burla via API direta | security | medium | `roadmap.md` status "—"; sem migration; aberto ~2 meses | Enforçar em `can_view_conversation` (RLS) cruzando `department_members`+flags. **Maior risco real.** |
| **P1** | **RLS `USING(true) TO public`** em 4 tabelas (`ai_agent_validations`, `ai_debounce_queue`, `follow_up_executions`, `scrape_jobs`) | security | quick | advisor 8× rls_policy_always_true; `pg_policies` qual='true'+public | Migration `TO service_role`; checar GRANT a anon. |
| **P1** | **MEMORY.md acima do limite** (26.6KB vs 24.4KB, piorando) → índice truncado no load | doc | quick | `wc -c`; ~42 entradas >200 char | Encurtar entradas; condensar handoffs `SUPERADO`. |
| ~~P1~~ | ~~CLAUDE.md header 88% vs tabela 98%; roadmap 68%; RULES.md passo 2 = Validator morto~~ | doc | — | — | ✅ **FEITO 2026-06-17** (header→~98%, roadmap→~98%, RULES.md→responseSanitizer) |
| ~~P2~~ | ~~CHANGELOG.md em 300 (bloqueia próximo commit)~~ | doc | — | — | ✅ **FEITO** (condensado v7.75/76/77 → headroom; frontmatter bump) |
| **P2** | **Schema órfão Fluxos v3.0 no DB** (v7.90.0 só removeu runtime): 8-9 tabelas `flow_*`+`guided_sessions`+RPC+col `instances.use_orchestrator`; **cron jobid 13 morto-vivo** | db | medium | `to_regclass` flow_*≠null; cron jobid 13 ativo; 0 rows | Migration DROP + unschedule. Regen `types.ts` = HIGH RISK, com OK. |
| **P2** | **Edge fn `process-jobs` morta+quebrada**: ACTIVE, 0 callers, chama RPCs `claim_jobs`/`complete_job` inexistentes | code | quick | `list_edge_functions` ACTIVE; `pg_proc`=[]; webhook:1298 comenta | [DONO] delete do deploy (padrão v7.90.0). |
| **P2** | **migration 20260617120000 (v7.94.0) viva mas NÃO registrada** em `schema_migrations` (aplicada via execute_sql) | db | quick | última registrada = 20260617121601 (v7.93) | Registrar (INSERT/repair). Baixo risco. |
| **P2** | **types.ts drift**: `media_send_telemetry`, `e2e_control_inbox` no DB, ausentes do types.ts | db | quick | `information_schema` ambas; types.ts grep=0 | `supabase gen types`+commit; add gen+diff ao CI. |
| **P2** | **Docs 2º nível com contagens stale**: ARCHITECTURE/AGENTS "36 edge fns" (real 45), ai-agent "~2600 lin" (real 3349); listam Validator vivo | doc | medium | `ls` functions=45; `wc -l` index.ts=3349 | Pass de coerência; idealmente gerar contagens no healthcheck. |
| **P2** | **Wikis 2º nível AI Agent stale** (5 arq, 2026-04-30): router+specialists+qualificationGate+memória shipados depois; `ai-agent-validator-prompt` descreve Validator vivo | doc | large | `casos-de-uso/ai-agent-*` updated 04-30 | Refazer p/ refletir router. Priorizar o validator-prompt. |
| **P2** | **`handoff-fila-detalhado.md` stale (05-05)**: anterior a runaway/abandono/inatividade/pausa/trava → regra de rotação provavelmente errada | doc | medium | wiki anterior a v7.56/58/65/93/94 | Atualizar seção rotação/handoff. |
| **P2** | **17 fns search_path mutável + 6 security_definer_view + 6 rls_enabled_no_policy + 3 public_bucket_allows_listing** | db | medium | advisor live | Migration `SET search_path`; revisar listing dos 3 buckets. |
| **P2** | **Follow-up v7.94.0 — blindar detector de lock**: confirmar que broadcast/Disparador ecoam `wasSentByApi=true` (senão falso-lock em massa) | followup | quick | lock=`fromMe && !wasSentByApi` (webhook:688, aiRuntime:193); 0 incidentes | Amostrar 1-2 echoes do Disparador. **NÃO usa external_id — colisão já descartada.** |
| **P2** | **[DONO] Rede de segurança do "congela indefinidamente"**: lock sem timeout; 9 das 14 travas já >2h (nenhuma >24h) | followup | medium | CLAUDE.md "congela indefinidamente, sem rede" | Monitorar estoque; se crescer, reabrir (auto-libera após N dias OU cutuca gestor). |
| **P2** | **45 edge fns runtime com 0 testes co-located**; parse `sender_pn`/`@lid`, `shouldLockHumanHandling` sem teste | test | large | webhook 1499/uazapi-proxy 1021/ai-agent 3349 | Extrair parse p/ `_shared/` puro + vitest. |
| **P2** | **Camada de dados dupla no front**: ~158 `supabase.from()` em 47 componentes + React Query; `useSupabaseQuery` @deprecated | code | large | UsersTab 11×, EditBoardDialog 24× | Lint `no-restricted-imports` + migrar incremental. |
| **P2** | **God files sem teto**: `ServiceCategoriesConfig.tsx` 2170, `whatsapp-webhook` 1499, `searchProducts` 1150 | code | large | `wc -l` (excl. types.ts gerado) | Teto SUAVE >700 lin no healthcheck. ai-agent encolhe com D6. |
| **P2** | **D6 — aposentar monolito ai-agent** (gate ~23/06): 3/3 agentes em `router`, mas default do schema = `monolith`, setup caro roda e é descartado | backlog | large | SQL routing_mode={router:3}; index.ts:3107 | Aguardar gate. Flipar default → bifurcar antes do setup → remover branch+toolDefs+prompt → deletar validatorAgent. **Maior alavanca de dívida.** |
| **P3** | **Lint debt 219 erros src/** (190 no-explicit-any, 107 unused); gate eslint informativo | code | large | `eslint .`=219; pior useManagerMetrics.ts (29) | Incremental por pasta (tipar views SQL mata o maior cluster). |
| **P3** | **`group-reasons` provavelmente morta** (substituída por auto-summarize) | code | quick | grep=1 label; sem invoke | [DONO] delete. |
| **P3** | **index.md / decisoes-chave stale**: index updated 05-11 (v7.32 máx); não citam router/human_handling | doc | medium | `index.md:4`; grep v7.9x=0 | Revisar referências; bump. |
| **P3** | **5 wikilinks quebrados** + `.gitignore` só `/*.png` + `bun.lock*` trackados stale | doc/code | quick | `m14-bio-link`/`plano-enquetes-polls`/`log-arquivo-...`/`novos-modulos`/`sessao3-handoff` | Corrigir alvos; `.gitignore` `/*.{png,jpg,jpeg,webp,gif}`; `git rm bun.lock*`. |
| **P3** | **B4 — varredura R134 idempotência** (hardening) | test | medium | R134 em 20 arq, sem auditoria de fechamento | Auditar INSERT paths (mensagens, handoff_queue_events, ai_agent_runs) p/ ON CONFLICT. |
| **P3** | **Sprint E.2 (proatividade) + E.3 (RAG)** | backlog | large | `process-follow-ups` sem cron; RAG inexistente | Não-bloqueador. Confirmar se process-follow-ups não é resíduo antes de reativar. |

## Riscos abertos (podem morder em prod)

1. **S9 / RLS Helpdesk só frontend (P1)** — único vetor multi-tenant concreto aberto (~2 meses). Atendente lê conversas fora do escopo via API.
2. **RLS `USING(true) TO public` (P1)** — se houver GRANT a `anon`, vira leitura via REST sem auth.
3. **BioLinksPage hooks (P1)** — crash de render p/ qualquer não-superadmin em `/bio-links`.
4. **Falso-lock por broadcast (P2)** — se UAZAPI omitir `wasSentByApi` num eco de Disparador, disparo em massa travaria a fila. 0 incidentes hoje, premissa não amostrada.
5. **"Congela indefinidamente" sem rede [DONO] (P2)** — conversa esquecida fica shadow+fora-da-fila pra sempre.

## O que NÃO falta (verificado são)

- **Trava v7.94.0** em prod: 0 eventos de fila + 0 IA-sends após a trava em 14 convs.
- **Testes**: vitest 1926/0 (3 skips esperados); nenhuma suíte falha no load.
- **TS/build**: 0 erros; CI quality-gate (tsc+vitest duros) prova bloqueio.
- **Já FECHADOS**: `escalate-stale-handoffs` com auth; SECURITY DEFINER anon=16; detector de lock usa `wasSentByApi` (não external_id).
- **TODO/FIXME real ≈ 0** (counts altos = homonímia "TODO/TODOS" em PT).
