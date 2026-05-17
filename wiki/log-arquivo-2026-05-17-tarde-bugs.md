---
title: Log Arquivo 2026-05-17 tarde — Bugs 13/15b/16/17/18 + validação E2E
type: log-arquivo
---

# Log arquivado: 2026-05-17 (tarde-noite)

> Entradas movidas de `log.md` em 2026-05-17 (hard limit).
> Cobre v7.37.0 → v7.37.4 + sessão E2E validação dos bugs 17+18.

## 2026-05-17 (tarde) — Validação E2E REAL PROD bugs 17+18 via Playwright + UAZAPI

Sessão de validação dos fixes shipados ontem (v7.37.4). Diferente do teste de ontem (POST direto na edge fn), hoje rodou pelo path 100% real: Sandbox UAZAPI emite WhatsApp → bate em Eletropiso prod → ai-agent processa → resposta volta via WhatsApp → helpdesk reflete em tempo real (observado via Playwright).

**Setup:**
- Emissor: `558185749970` (Sandbox IA, token sandbox)
- Receptor: `558181696546` (Eletropiso prod, business_hours definido → domingo = fechado)
- Conv: `d317ef4b-6dfb-4944-aa24-af9872630cca` (Wsmart Digital, estava em `ia_cleared` desde 2026-05-11 → estado limpo pra teste fresco)
- Playwright: `crm.wsmart.com.br` logado george.azevedo2023@gmail.com, conv aberta em tempo real

**Jornada (6 turnos):**
1. `oi` → "Olá! Bem-vindo a Eletropiso, com quem eu falo?" (greeting padrão sistema)
2. `sou a Maria` → "Maria, em que tipo de material..." (vocativo, sem "Olá")
3. `quero tinta acrilica fosco branca` → "Para encontrar a melhor opção, qual ambiente?" (auto-extract → pediu próximo field, sem nome, sem "Olá")
4. `interno, eh pro quarto` → "Para encontrar a melhor opção, qual cor?" (sem nome, sem "Olá")
5. `branca` → "Confira nossas opções:" + carrossel + "Maria, a Tinta Acrílica Fosco Standard 16L..." (vocativo com contexto, sem "Olá")
6. `perfeito, quero a Coral mesmo, quero fechar` → **handoff automático**

**Bug 17 — 0 recumprimentos em 5 turnos pós-greeting:** ✅ validado.

**Bug 18 — handoff automático venda fechada:** ✅ todos os sinais confirmados:
- `ai_agent_logs.event='sale_closed_detected'` (detection_type=fechado) — 16:35:38
- `ai_agent_logs.event='brand_mentioned'` (coral) — 16:35:39
- `ai_agent_logs.event='implicit_handoff'` com `reason=sale_closed`, `sale_type=fechado`, `outside_hours=true`, `queue.assignee_name=Djavan`, `queue.reason=reused_previous` — 16:35:47
- Mensagem enviada: EXATAMENTE `handoff_message_outside_hours` da Eletropiso ("Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis. Foi um prazer atender! 😊")
- `conversations.status_ia=shadow`, `assigned_to=Djavan`, `lead_msg_count=0`
- Tags acumuladas (11): motivo:compra, interesse:tinta, acabamento:fosco, tipo_tinta:acrílica, produto:tinta_acrílica_fosco_branca, ambiente:interno, cor:branca, lead_score:15, **venda:fechada**, marca_citada:coral, **ia:shadow**

**Latência por turno:** ~20-30s (debounce 5s + LLM 5-15s + UAZAPI send + webhook roundtrip).

**Screenshots:** `wiki/validacoes/helpdesk_initial.png`, `wiki/validacoes/conv_wsmart_initial.png`, `wiki/validacoes/conv_T1_resposta.png`, `wiki/validacoes/conv_T5_bug17_validado.png`, `wiki/validacoes/conv_T7_bug18_validado.png`.

**Frase de retomada:** *"auditar outros .select silentes 2026-05-18"* (próximo item do backlog).

---

## 2026-05-17 (noite+) — Bugs 17+18 fix: handoff auto em venda fechada + anti-recumprimento (v7.37.4)

Jornada E2E de 8 turnos (Maria: bom dia → nome → tinta acrílica → ambiente → cor → marca → "quero fechar" → vendedor) revelou 2 falhas.

**Bug 18 (CRÍTICO):** lead disse "quero fechar" → IA detectou `sale_closed_detected`, tageou `venda:fechada`, mas **respondeu vazio** e não disparou handoff. Lead só foi atendido após pedir vendedor explicitamente. Causa: handler em `ai-agent:447` só marcava tag — esperava o LLM chamar handoff_to_human no flow normal, mas LLM gerava texto vazio.

**Fix 18:** novo flag `pendingSaleClosedHandoff`; após load de profile/funnel/runQueueAssignment (~linha 681), bloco novo executa handoff completo (pickHandoffMessage + runQueueAssignment + sendTextMsg + log `implicit_handoff` com reason='sale_closed' + return early). Idempotente: pula se já em SHADOW ou shadow_only.

**Bug 17:** LLM cumprimentava de novo no meio da conv ("Olá, Maria! A tinta..."). Fix: nova regra hardcoded "NUNCA RECUMPRIMENTAR" com exemplo ERRADO/CERTO.

**Validação E2E:** POST "isso mesmo, quero comprar" na conv Maria → `sale_closed_detected` + `implicit_handoff` event + EXATAMENTE `handoff_message_outside_hours` enviada + jussara atribuída (cursor Alberto→jussara) + status_ia=shadow.

**Regra preventiva:** sinais de intenção alta (venda fechada, sentimento negativo) → handoff automático em código, não esperar LLM decidir.

tsc=0. Deploy ai-agent. Frase de retomada: *"validar bugs 17+18 prod 2026-05-18"*

---

## 2026-05-17 (noite) — Bug 16 fix: 3 paths handoff sem outside_hours + handoff prematuro (v7.37.3)

User reportou print: lead "vcs tem trena?" → IA fez handoff prematuro com `handoff_message` regular (domingo fechado, deveria ser `_outside_hours`). Audit revelou 3 paths em `ai-agent/index.ts` que ignoravam horário comercial (linhas 688, 837, 3468) — apenas o tool LLM `handoff_to_human` (linha 2872) checava. E o path 837 nem logava em `ai_agent_logs`.

**Fixes:**
- Helper top-level `pickHandoffMessage({ agent, profileData, funnelData, outsideHours, fallbacks })` com priority Profile > Funnel > Agent.
- Aplicado nos 4 paths (3 quebrados + tool LLM refatorado).
- Log `event='implicit_handoff'` adicionado no path 837 (auto-handoff por message limit).
- `buildQualificationContext` reforçado: removido `exit_action=` do header + nova regra absoluta "🚫 PROIBIDO chamar handoff_to_human ENQUANTO houver PRÓXIMA PERGUNTA OBRIGATÓRIA. Categoria com `exit_action=handoff` ainda exige qualificar TODOS fields antes."

**Validação E2E prod, 4 turnos (domingo, Eletropiso fechada):**
- T3 ("vcs tem trena?") → IA pergunta `uso_ferramenta` (qualif correta) — NÃO faz handoff prematuro.
- T4 ("profissional. quero falar com um vendedor") → handoff_trigger=vendedor disparou + IA enviou EXATAMENTE a `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor dará prosseguimento assim que estivermos disponíveis..."*. Lucas atribuído pela fila.

**Regra preventiva:** todo caminho de handoff (manual, auto, tool-driven) DEVE consultar `isOutsideBusinessHours` + toggle antes da msg. Centralizar em helper.

tsc=0. Deploy ai-agent. Frase de retomada: *"validar bug 16 prod real 2026-05-18"*

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

## 2026-05-14 — Bugs AI Agent (v7.36.5/v7.36.6) — arquivado

Entradas detalhadas (fix bugs 8+11 cross-category leak + fix loop fila/retention notifications) movidas pra [[wiki/log-arquivo-2026-05-14-bugs]].

---

## 2026-05-13 → 2026-05-12 — Releases v7.35.1 → v7.36.4 (arquivado)

Bugs 6+7 (encoding + handler upsell), bugs 8-11 descobertos. v7.36.0-7.36.2 (IA 24/7, button-reply, auto-extract). Detalhes em [[wiki/log-arquivo-2026-05-13-bugs-iniciais]] e [[wiki/log-arquivo-2026-05-12-a-13]].
