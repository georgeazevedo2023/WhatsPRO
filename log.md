---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

## 2026-05-13 (noite) — Auto-extração de fields + carrossel bonito (v7.36.2)

### Bug 4 — IA pergunta o que lead já disse na 1ª msg
- Lead: "Tem tinta acrílica fosco?" → IA depois pediu tipo+acabamento (violação regra 1339)
- Confirmado por SQL: `conversations.tags` só tinha `interesse:tinta`+`ambiente:interno`+`tipo_tinta:acrílica` (tarde, T9) — faltou `acabamento:fosco`, e tipo_tinta veio tarde demais
- Diagnóstico: **timing**. LLM não chamava set_tags antes do qualificationContext computar próxima pergunta.
- **Fix:** defesa em código — `_shared/fieldAutoExtractor.ts` scaneia `incomingText` cruzando com `examples` dos fields. Pré-popula tags ANTES de `buildQualificationContext`. Log em `ai_agent_logs.event='auto_field_extracted'`.
- **Plus:** reforço de prompt em hardcodedRules com exemplo concreto.

### Bug 5 — Carrossel feio no helpdesk
- Fix CSS: botões com fundo colorido (verde REPLY, azul URL, âmbar CALL), CornerDownLeft, card maior w-52, shadow.

### Testes
- 20 vitest novos em `fieldAutoExtractor.test.ts` — cobrem parseExamples, word boundary, acentos, negação (até 4 palavras entre gatilho e match), fields numéricos pulados, alreadySetKeys honrado, flattenCategoryFields.
- tsc 0 erros.

### Deploys
- `ai-agent` v30 via MCP (HIGH RISK, aprovado pelo gestor)
- Frontend: refresh

### Validação
- ❌ E2E **pendente** — gestor precisa refazer "Tem tinta acrílica fosco?" pra confirmar que IA pula tipo + acabamento

### Lição registrada
[[wiki/erros-e-licoes]] — entrada nova "Timing entre LLM e qualificationContext: extração proativa requer defesa em código, não só prompt"

### Próximo handoff
Frase: **"validação auto-extract field 2026-05-13"**

---

## 2026-05-13 (tarde) — Carrossel: botões + button-reply + anti-eco (v7.36.1)

3 bugs E2E: (1) Bug 3 IA parava após clique no carrossel — webhook tentou 8 variantes Baileys (não funcionou, ver v7.36.3 abaixo pra fix definitivo); (2) Bug 2A helpdesk não exibia botões — `MessageBubble:396` lê `btn.label || btn.text`; (3) Bug 1 anti-eco — nova regra hardcoded em `ai-agent:1339`. Deploys: webhook v6, ai-agent v29. Detalhe completo em `CHANGELOG v7.36.1`.

---

## 2026-05-13 — Agente atende 24/7 + toggle "Avisar fora do horário" (v7.36.0)

Removido o skip out-of-hours em `ai-agent/index.ts:235-286`. Novo campo `ai_agents.notify_outside_hours_on_handoff` (default true): ON → atendentes só no horário, transbordo fora usa `handoff_message_outside_hours`; OFF → atendentes 24/7. Modo Estendido (D30) inalterado. `out_of_hours_message` virou legado.

SYNC RULE 8 locais cumprida (DB, types, admin UI `BusinessHoursEditor` + Switch tooltip, ALLOWED_FIELDS, backend, prompt hint fora-do-horário, defaults, vault). Vitest 13/13. tsc 0. Detalhe completo em `CHANGELOG v7.36.0` + `wiki/decisoes-chave.md` (D32).

Deploy `ai-agent` v29 via MCP. Frase de retomada: **"deploy notify_outside_hours_on_handoff 2026-05-13"**

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-12

> **Frase pra retomar na próxima sessão:**
>
> **`"contexto dashboard gestor v7.33-v7.35"`**
>
> Ao receber, executar protocolo de início (5 passos) e priorizar leitura deste handoff + 3 entradas mais recentes do log.

### O que foi entregue (sessão inteira) — 4 releases shipados em prod

| Versão | Tema | Commits |
|---|---|---|
| **v7.33.0** | Dashboard do Gestor unificado (Fase 1) — 4 zonas, `instances.is_sandbox`, RPC `get_leads_new_vs_returning` | `66d2461` |
| **v7.34.0** | Métricas avançadas (Fase 2) — 4 RPCs (response_time P50/P95, abandoned 24h, demand×coverage, conversion by origin) + 4 cards | `66d2461` |
| **v7.35.0** | Pivô comercial (Fase 3) — sem custos, com leads sem 1ª resposta + cotações em andamento + Top Objeções promovido | `c93bb36` |
| **v7.35.1** | Botão limpar pendências — tag `dashboard:dispensed` com undo (toast Sonner) | `fda01ea` |
| **v7.35.2** | Retention 24h em logs do Supabase — banco 52 MB → 23 MB, cron horário | `2cfcb99` |
| **v7.35.3** | 🐛 **Fix crítico** — RPC `append_ai_debounce_message` com tipo `uuid` quebrava IA inteira (pipeline silenciado por 3 fire-and-forget) | `1e44633` |

### Estado do código

- **Branch master** no commit `7172c2d` (= último, com 8 migrations registradas localmente).
- **DB Supabase**: todas 8 migrations aplicadas em prod (deployadas via MCP no momento do desenvolvimento).
- **Frontend Docker**: imagem nova no GHCR, redeploy do container `crm.wsmart.com.br` disparado via webhook Portainer (HTTP 204).
- **TypeScript**: `tsc --noEmit` = 0 erros.
- **Vault healthcheck**: ✅ todos arquivos ≤ 300 linhas.

### Validações E2E confirmadas

- Banco Supabase voltou a 23 MB (era 52 MB).
- Cron `purge_system_logs_24h` ativo (`active=true`, schedule `0 * * * *`).
- Áudio "Olá, boa noite, estou testando o áudio, vocês tem tinta esmalte..." disparou pipeline: `01:18:04 recebido → 01:18:36 IA respondeu` (fora do horário comercial, retornou `out_of_hours_message` — comportamento correto).

### Sinais de produto descobertos (vale levantar com o time)

1. **0 vendas tagueadas `venda:fechada`** em 30 dias na Eletropiso (12 conversas, 7 leads via "direto") → fluxo de tagueamento não está sendo aplicado pelo comercial.
2. **0 cotações tagueadas `motivo:orcamento`** apesar de leads pedindo orçamento → mesma causa.
3. **1 lead sem 1ª resposta há 716h (30 dias)** → time perdeu lead concreto.
4. **Bug do AI Agent estava quieto há possivelmente dias** sem ninguém notar — falta alarme no pipeline.

### Pendências declaradas (não bloqueantes)

- **Validar dashboard logado como gerente real**: Playwright caiu no /login (sem credencial), validação visual end-to-end ainda manual.
- **Fase 4 do dashboard (backlog)**: drill-down ao clicar em card, comparação período-vs-período (P50 hoje vs 7d), alertas configuráveis (P95 > X min → notify WhatsApp pessoal do gestor), export CSV.
- **Pipeline fire-and-forget sem alarme**: o bug `22P02` ficou invisível por dias. Vale uma observabilidade mínima (cron diário que verifica `ai_agent_logs` recente vs `conversation_messages incoming` recente, alerta se gap > 1h).

### Lição salva em `wiki/erros-e-licoes.md`

Top-1 atual: "Tipo de parâmetro de RPC divergente da coluna real (uuid vs text)" — com 3 regras preventivas.

---

## 2026-05-12 — Fix RPC append_ai_debounce_message (v7.35.3) ⚠️ bug crítico de prod

**Investigação iniciada pelo gestor:** "pq o agente ia não respondeu meu áudio?".

**Diagnóstico:**
- Mensagem incoming OK, transcrição OK (Groq fez), mas `ai_debounce_queue` sem entry nova e `ai_agent_logs` zerado em 24h.
- Webhook pula áudio de propósito ("Skip audio messages — transcribe-audio will trigger"). transcribe-audio chama ai-agent-debounce. ai-agent-debounce chama RPC `append_ai_debounce_message`.
- RPC declarada com `p_instance_id uuid`. Instâncias UAZAPI usam `text` (`r466a98889b5809`). Erro `22P02: invalid input syntax for type uuid` silenciado por 2 camadas de fire-and-forget.
- Reproduzi o erro chamando a RPC manualmente.

**Fix:** migration `fix_append_ai_debounce_message_instance_id_text` (DROP + CREATE com tipo correto). Smoke test rodou com instance/conv real.

**Pendente:** validação E2E (user precisa mandar msg nova no WhatsApp Eletropiso pra confirmar IA responde).

**Lição:** bugs em fire-and-forget de duas camadas viram invisíveis se a função interna estoura. Defesa: `ai-agent-debounce` deveria logar `error` da chamada RPC, não engolir.

---

## 2026-05-12 — Retention 24h em logs do Supabase (v7.35.2)

**Investigação iniciada pelo gestor:** "52 MB? o que está ocupando?". Análise revelou que 30 MB (55%) eram logs internos sem valor operacional:
- `net._http_response` (pg_net HTTP log) = 21 MB, cresce ~3 MB/hora.
- `cron.job_run_details` (pg_cron) = 8 MB, ~2.300 rows/dia.

**Ação imediata:** TRUNCATE nas duas → banco 52→23 MB.

**Permanente:** migration `cron_retention_system_logs_24h` cria função `purge_system_logs_older_than_24h()` (SECURITY DEFINER, retorna jsonb com contagens) + job pg_cron `purge_system_logs_24h` schedule `0 * * * *`. Bloco DO antes do schedule garante reaplicação idempotente (unschedule anterior se existir).

Smoke test: função roda OK, job ativo no `cron.job`.

---

## 2026-05-12 — Dashboard do Gestor: botão limpar pendências (v7.35.1)

**Pedido:** gestor precisa remover spam/teste das listas (ex: "Zig Online" não é negócio).

**Entregue:** tag `dashboard:dispensed` aplicada via 2 RPCs SECURITY DEFINER (`dispense_conversation_from_dashboard` / `restore_conversation_to_dashboard`). Append preserva tags existentes via DISTINCT unnest. As 3 RPCs de pendência filtram OUT a tag. UI: botão X ao lado do link externo + toast Sonner com action "Desfazer".

Não arquiva a conversa (helpdesk segue mostrando). Smoke test SQL completo OK. `tsc --noEmit` = 0.

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
