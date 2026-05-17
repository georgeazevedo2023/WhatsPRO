---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-17 (fim tarde) — Bug 15b fix: out_of_hours_message nunca enviada (v7.37.2)

User reportou que 2 conversas (George + Bug11 Test) tinham badge "Em fila — Slone/Djavan (pausado)" mas o lead NÃO recebeu a mensagem de fora do horário comercial. Audit revelou que `requeue-conversations/index.ts:101` fazia `.select('id, inbox_id, assigned_to')` sem incluir `contact_id`. No Case B (linha 211), a busca por contato virava `eq('id', '')` silente → UAZAPI nunca chamado → `out_of_hours_msg_sent` permanecia false. Pause funcionava, mas notificação ao lead nunca.

**Fix:** adicionar `contact_id` no select. Deploy `requeue-conversations` via Supabase CLI.

**Validação E2E:** UPDATE manual forçou 2 events de volta ao Case B. Próximo tick (~1min) → 2 INSERTs em `conversation_messages` com `external_id=queue_oof_*` ("Olá! 😊 Estamos fora do nosso horário..."). `out_of_hours_msg_sent=true` em ambos. Playwright confirmou na UI.

**Regra preventiva:** ao usar PostgREST/.select(), sempre incluir TODAS as colunas usadas downstream no mesmo handler. Coluna ausente vira undefined silente, sem erro do supabase-js.

**Frase de retomada:** *"auditar outros .select silentes 2026-05-18"*

---

## 2026-05-17 (tarde) — Bug 13 fix: auto-extract na 1ª msg + categoria mesas (v7.37.1)

User mandou print do Helpdesk: "perguntei se tinha mesa de plástico e IA voltou a perguntar material". Audit revelou que (a) categoria `mesas` não existia (das 23 da Eletropiso) e (b) auto-extract de fields era cego na 1ª msg do lead porque dependia de `interesse:` tag que só o LLM seta DEPOIS do auto-extract rodar.

**Fix duplo:**
1. UPDATE SQL adicionou categoria `mesas` (24 total) com fields `material_mesa`/`lugares_mesa`/`ambiente_mesa`, `exit_action=handoff`, `interesse_match: mesa|mesas`.
2. Novo helper `_shared/serviceCategories.ts::matchCategoryBySearchText` + fallback chain em `ai-agent/index.ts:1531` (HIGH RISK aprovado) — auto-extract agora resolve categoria via incomingText quando tag ausente E **seeda** `interesse:<categoria.id>` antes do LLM, eliminando colateralmente o Bug 12 (LLM cravando valor inválido).

**Validação E2E prod (conv 828e45b2 reseted):** POST "vcs tem mesa de plastico pra cozinha?" → tags `[interesse:mesas, material_mesa:plástico, ambiente_mesa:cozinha, motivo:compra]` (auto-extract via search_text). IA respondeu *"Pra te ajudar com a mesa certa, quantos lugares? (2, 4, 6 ou 8 lugares)"* — pulou material+ambiente já ditos. EXATAMENTE o flow que o user pediu.

**Casos sistemicamente afetados:** toda 1ª msg rica do lead — "tem tinta acrílica fosco branco?", "preciso chuveiro elétrico 220v", "quero furadeira 220v Bosch" etc.

Arquivos: `_shared/serviceCategories.ts` (+30), `_shared/serviceCategories.test.ts` (+87, 7 testes), `ai-agent/index.ts` (auto-extract block reescrito). tsc=0. Vitest 116/116 serviceCategories. Deploy ai-agent v? prod.

**Frase de retomada:** *"validar bug 13 outros casos 2026-05-18"*

---

## 2026-05-17 — D34: Reabertura de conv resolvida em janela 60d (v7.37.0)

User pediu pra testar "Finalizar → lead volta → desatribui Alberto, IA reassume, fila aciona, tageia novos interesses". Investigação revelou que o webhook criava conv NOVA quando status anterior era `resolvida` (`whatsapp-webhook:833` filtra apenas `aberta/pendente`), congelando tags e histórico.

**Solução shipada:**
- Migration `conversations_add_resolved_at` (coluna + backfill via `updated_at` + index parcial `(contact_id, resolved_at DESC)`).
- `TicketResolutionDrawer.handleSubmit` seta `resolved_at = NOW()` ao Finalizar.
- Helper puro `_shared/conversationReopen.ts` (`shouldReopenConversation`) decide reabertura. Webhook (`whatsapp-webhook:822+`) usa o helper depois do filtro original. Quando reabre: `status='aberta'`, `status_ia='ligada'`, `assigned_to=null`, tag `reaberta:YYYY-MM-DD` apendada, tags antigas preservadas. Spam não reabre.
- Greeting personalizado vem de graça — `hasEverInteracted` em `ai-agent:636` continua olhando `conversation_id`, que é a mesma agora → dispara `returning_greeting_message`.

**Validação E2E (Eletropiso prod, conv Bug11 Test 67bb8561):**
- POST 1 ("oi voltei, ainda tem aquele chuveiro?") → reabriu mesma conv id. Alberto desatribuiu. Tags `[motivo:compra, interesse:hidraulica, resultado:perdido, reaberta:2026-05-17]`. IA mandou *"Olá Bug 11 Test! Que bom te ver de novo 😊"* + qualif chuveiro.
- POST 2 ("desisti do chuveiro, quero furadeira pra concreto") → `set_tags` trocou `interesse:hidraulica` por `interesse:furadeira` (mergeTags por chave). IA perguntou "220v com fio ou 12v a bateria?" (campos da categoria furadeiras).
- Playwright confirmou: conv no topo de Atendendo, sem atendente atribuído, histórico inteiro visível na timeline.

**Arquivos:** migration `conversations_add_resolved_at`, `_shared/conversationReopen.ts` (novo), `_shared/conversationReopen.test.ts` (10 testes), `whatsapp-webhook/index.ts`, `TicketResolutionDrawer.tsx`, `types.ts`. tsc=0. Vitest novos 10/10.

**SYNC RULE:** itens 1+2+5+8 cumpridos. 3/4/6/7 N/A (feature transparente, sem config). Detalhe completo em `CHANGELOG.md v7.37.0` e `wiki/decisoes-chave D34`.

**Frase de retomada:** *"validar D34 reabertura playwright 2026-05-18"*

---

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

## 2026-05-13 (madrugada++) — Upsell determinístico + encoding (v7.36.4) + 4 bugs novos descobertos

### Bug 6 + Bug 7 (resolvidos, ver `CHANGELOG v7.36.4`)
Encoding do id de botão → `safeBtnId`. Handler upsell determinístico em `ai-agent/index.ts:269+` com `matchAll`. Defaults Eletropiso atualizados via SQL. Validado E2E via POST simulado (2 cliques + closing). Deploy ai-agent v32.

### Bugs 8-11 DESCOBERTOS na simulação "produto fora do catálogo" — PENDENTES
Simulei lead pedindo furadeira + chuveiro elétrico (categorias configuradas, sem produtos no catálogo). Quatro problemas:

- **Bug 8** (alto): `search_products` retorna produtos de **categoria diferente** quando não acha na específica. Lead pediu chuveiro → carrossel de tinta apareceu. Falta filtrar por `interesse:` detectado.
- **Bug 9** (alto): IA "alucinou" descrição misturando furadeira + tinta na mesma resposta. Consequência do bug 8 + LLM tentando juntar contexto.
- **Bug 10** (médio): Greeting inicial regrediu — só "Em que posso te ajudar?" sem "Olá!".
- **Bug 11** (médio): Em meio da qualificação, IA mandou resposta genérica "Para entender melhor suas necessidades..." — perdeu o fio do diálogo.

Fluxo bom (handoff_to_human disparou no final), fluxo intermediário ruim (carrosséis fora de contexto, alucinação de produtos misturados).

**Próxima sessão:** atacar bugs 8-11. Estimativa: ~45 min total (search_products filter + auto-tag validação + tests + re-simulação E2E).

**Frase de retomada:** *"fix bugs 8-11 search categoria 2026-05-14"*

---

## 2026-05-13 (madrugada+) — Bug 3 fixado de vez via `buttonOrListid` (v7.36.3)

Continuação do Bug 3 que ainda persistia depois das 8 variantes da v7.36.1. Gestor disse "audite e teste com Playwright". Eu fiz:

1. WebFetch na doc UAZAPI falhou (SPA, só title).
2. Playwright navegou em `docs.uazapi.com` → `performance.getEntriesByType('resource')` listou `/openapi-bundled.json`.
3. curl baixou; grep no schema `Message` → campo **`buttonOrListid`** (canônico UAZAPI v2). Ainda `convertOptions` (JSON com displayText).
4. Webhook ajustado pra capturar `buttonOrListid` em V0 (prioritário) + parse de `convertOptions`. Debug log removido.
5. Validação via **POST simulado direto** no webhook (sem precisar do user clicar): `content` gravou `"Eu quero! (Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva - Coral)"` no first try. Mensagem-teste deletada do DB pra não poluir histórico.
6. Deploy `whatsapp-webhook` v7.

**Lição (nova entrada em [[wiki/erros-e-licoes]]):** APIs sobre Baileys normalizam pra payload flat — testar com spec oficial antes de chutar fallbacks. Web SPA → Playwright + performance.getEntriesByType pra achar JSON real.

**Próximo handoff:** "validar button reply real 2026-05-13"

---

## 2026-05-13 e 2026-05-12 — Releases v7.35.1 → v7.36.2 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-12-a-13]] em 2026-05-17 (hard limit). Inclui v7.36.2 (auto-extract Bug 4 + carrossel CSS), v7.36.1 (carrossel button-reply + anti-eco), v7.36.0 (IA 24/7), handoff 2026-05-12, v7.35.3 (fix RPC uuid), v7.35.2 (retention logs), v7.35.1 (limpar pendências).

---

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-dashboard]] em 2026-05-14 (hard limit). Inclui Fase 1 (unificado), Fase 2 (métricas avançadas), Fase 3 (pivô comercial).

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |
