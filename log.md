---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-17 (noite) — Bug 24 fix: auto-extract bypassava exit_action enforcement (v7.37.7)

User reportou print: T1 oi → T2 george → T3 "vcs tem trena?" → T4 profissional → T5 "5m" → **IA parou de responder**, sem handoff, sem coleta.

**Diagnóstico (do `ai_agent_logs`):**
- T3 auto-extract setou `tipo_ferramenta:trena` + `interesse:ferramentas_manuais` (score 15)
- T4 auto-extract setou `uso_ferramenta:profissional` (score subiu pra 30 = max do stage). Categoria `ferramentas_manuais` tem `exit_action: handoff` no stage `qualificacao`.
- LLM **não recebeu instrução** "AÇÃO chame handoff_to_human" (R83) → ficou sem direção → gerou texto vazio ("response_text": "") → lead viu silêncio.

**Root cause:** o `exit_action` enforcement (linha 2846, FIX 2026-04-29 do R83) só roda DENTRO do `set_tags` handler. Mas o **auto-extract (Bug 13 fix linha 1640)** pega fields DETERMINISTICAMENTE bypassando o handler. Score atingia max via auto-extract sem disparar a instrução de handoff → LLM gerava vazio.

**Fix v7.37.7 — extrair exit_action enforcement do set_tags handler e replicar no auto-extract path:**

1. Auto-extract agora calcula `scoreDelta` (mesmo `calculateScoreDelta` do set_tags handler) e adiciona `lead_score:N` à mergedTags.
2. Se `newScore >= stage.max_score && exit_action='handoff'`, seta flag `pendingExitActionHandoff` (mirror do `pendingSaleClosedHandoff` do Bug 18).
3. Novo bloco IMEDIATAMENTE após o auto-extract executa o handoff: `pickHandoffMessage` (respeita outside_hours), `runQueueAssignment`, broadcast, log `event=implicit_handoff, reason=exit_action_auto_extract`. Return early — LLM nem roda.

**Bug crítico de implementação (descoberto e corrigido na hora):** primeira tentativa colocou o bloco de execução ANTES do auto-extract (linha ~720, ao lado do `pendingSaleClosedHandoff`). Como o auto-extract roda na linha 1682, a flag estava sempre `null` quando o bloco era avaliado. Validação inicial falhou exatamente por isso (`pending_exit_handoff: true` no log mas IA continuou). Mover o bloco pra DEPOIS do auto-extract resolveu.

**Validação E2E (mesmo cenário do user — domingo, Eletropiso fechada):**
- T1 "oi" → greeting
- T2 "George" → "Joao, em que posso te ajudar hoje?" (Bug 19 ok)
- T3 "vcs tem trena?" → "Pra te ajudar, uso? (profissional ou doméstico)" (Bug 21 ok)
- T4 "profissional" → **handoff automático** com EXATAMENTE `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis."* ✅
- `status_ia=shadow`, tag `ia:shadow` aplicada, `lead_score:30` (= max do stage)

**Paridade com admin UI** (resposta ao pedido do user):

| Conceito | Onde no admin | Onde no DB | Onde no código backend |
|---|---|---|---|
| Categoria + regex `interesse_match` | `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` | `ai_agents.service_categories->>'categories'[].interesse_match` | `matchCategoryBySearchText` (`_shared/serviceCategories.ts:308`) |
| Stage min/max/exit_action | `ServiceCategoriesConfig.tsx:237-310` | `stages[].{min_score,max_score,exit_action}` | `getCurrentStage` (`_shared/serviceCategories.ts`) |
| Fields + priority + score_value | mesmo arquivo, `Field` editor | `stages[].fields[].{key,score_value,priority}` | `flattenCategoryFields` + `autoExtractFields` (`_shared/fieldAutoExtractor.ts`) |
| `handoff_message` + `_outside_hours` | `GeneralConfig.tsx` / agente | `ai_agents.handoff_message{,_outside_hours}` | `pickHandoffMessage` (`ai-agent/index.ts:85`) |
| Score enforcement (R83 / Bug 24) | implícito — admin não vê esse path | derivado | `set_tags` handler linha 2846 **+** auto-extract linha 1682 (este fix) |

**Por que não funcionava antes:**
- Admin define `exit_action: handoff` no max_score do stage — config OK no DB.
- `set_tags` handler injetava instrução pro LLM (R83 OK desde 2026-04-29).
- MAS o auto-extract (shipado 2026-05-17 manhã como Bug 13 fix) preencheu fields determinísticamente sem passar pelo handler. **Ninguém escreveu o enforcement no auto-extract**. Resultado: lead bate qualif completa em deterministic, LLM no próximo turno fica sem direção, gera vazio.

**Regra preventiva (registrar em wiki/erros-e-licoes):** sempre que um caminho determinístico pré-LLM persistir tags (auto-extract, regex detectors), DEVE replicar o pipeline de score + exit_action enforcement do `set_tags` handler. Não bastam tags persistidas — o sinal de "stage completo" precisa ser propagado para todos os paths. Considerar centralizar em helper compartilhado tipo `applyTagsWithScoreEnforcement()` (refactor backlog).

**Backlog Bug 23 ainda aberto:** LLM em enrichment improvisa fields fora do schema. Mantido pra 2026-05-18.

Arquivos: `ai-agent/index.ts` (~30 linhas no auto-extract path + ~35 no bloco de execução pendingExitActionHandoff). Deploy 2 vezes (primeira tentativa com bug de ordem). Screenshot: `wiki/validacoes/bug24_validado.png`.

---

## 2026-05-17 (noite-inicio) — Bug 21+22 fix: validator BLOCK ignorava outside_hours + transbordo prematuro (v7.37.6)

User mandou print: lead "boa tarde" → "george" → "voces tem trena?" → IA respondeu *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno."* — duas falhas:

**Bug 21:** transbordo prematuro. Categoria `ferramentas_manuais` tem 2 fields obrigatórios (`tipo_ferramenta`, `uso_ferramenta`). Auto-extract pegou só `trena` (tipo). Faltava `uso_ferramenta` (profissional/doméstico). Mesmo assim handoff disparou. Vendedor recebe lead sem qualif → perde tempo perguntando o óbvio.

**Bug 22:** msg REGULAR enviada em vez de `_outside_hours` (domingo, Eletropiso fechada) — regressão do que Bug 16 v7.37.3 fixou. Root cause: NÃO foi pelo handoff_to_human tool (sem log de event=handoff). Foi pelo **validator BLOCK path** (linha 3344 antiga). Esse path usava `agent.handoff_message` direto, sem checar `outside_hours` — 4º caminho que escapou do Bug 16 fix.

**Fix v7.37.6 — validator BLOCK reescrito:**
1. **Bug 22:** `pickHandoffMessage({agent,profileData,funnelData,outsideHours})` helper agora aplicado no validator BLOCK path. Adiciona também log `event='handoff', reason='validator_block'` (antes invisível).
2. **Bug 21:** se `qualificationContext` contém "PRÓXIMA PERGUNTA OBRIGATÓRIA" (ou seja, qualif ainda incompleta), validator BLOCK NÃO transborda — em vez disso envia a "FRASE EXATA SUGERIDA" extraída do qualif context. Lead continua sendo qualificado. Log `event='response_sent', metadata.source='validator_block_qualif_fallback'`.

**Validação E2E (mesmo cenário do user — Sandbox UAZAPI → Eletropiso prod, domingo fechado):**
- T1 "oi" → greeting padrão
- T2 "sou o Joao" → "Joao, em que posso te ajudar hoje?" (Bug 19 ✅ sem chutar produto)
- T3 "voces tem trena?" → **"Pra te ajudar, uso? (profissional ou doméstico)"** — PERGUNTA o uso ✅ (era esse o bug)
- T4 "profissional" → IA pergunta comprimento (LLM improvisou — bug paralelo backlog: LLM inventa fields fora do schema)
- T5 "5 metros, fechar" → IA pergunta tipo de trabalho (enrichment, search_fail:1 — trena não cadastrada)
- T6 "quero falar com vendedor agora" → IA enviou EXATAMENTE `handoff_message_outside_hours` ("...assim que estivermos disponíveis...") + `status_ia=shadow` + `ia:shadow` tag ✅

**Regra preventiva:** TODO path que decide transbordo (`handoff_to_human` tool, auto-handoff, deferred trigger, **validator BLOCK**, futuros) DEVE consultar `pickHandoffMessage` para escolher regular vs outside_hours. Centralizar em helper compartilhado evita 5º caminho escapar. Buscar grep `agent.handoff_message ||` periodicamente — qualquer uso direto sem o helper é red flag.

Arquivos: `ai-agent/index.ts` (~60 linhas no validator BLOCK path: guard qualif + helper). tsc=77 (igual ao pre-fix, sem regressão). Deploy ai-agent. Screenshots: `wiki/validacoes/bug21_22_validado.png`.

**Backlog Bug 23 (achado nesta sessão):** LLM em enrichment improvisa pergunta sobre field NÃO cadastrado (ex: "comprimento" pra trena). Resultado: pergunta off-script, dado coletado vira `tipo_ferramenta:trena_5m` em vez de field próprio. Investigar: 2026-05-18 — *"limitar improvisação LLM em enrichment / schema dinâmico"*.

---

## 2026-05-17 (fim tarde) — Bug 19 fix: IA alucina interesse:CAT sem o lead pedir (v7.37.5)

User mandou print: lead disse "boa tarde" + "George" (só nome) → IA respondeu "George, para qual material você está procurando a porta? Temos opções em madeira, PVC ou alumínio." LLM alucinou produto "porta" sem o lead mencionar nada.

**Root cause:** o handler `set_tags` (ai-agent:2712) não validava se `interesse:CAT` cravado pelo LLM tinha CONEXÃO com o que o lead falou. Quando input é trivial ("oi", "George"), o LLM chuta uma categoria pra "ter algo a perguntar". Sem guard, tag `interesse:porta` foi aceita + entrou no qualificationContext + LLM perguntou material da porta. Auto-extract (Bug 13) NÃO foi o culpado (regex `porta|portas` não bate em "George"/"boa tarde").

**Fix v7.37.5:**
1. **Guard determinístico no handler `set_tags`:** quando LLM tenta cravar `interesse:CAT`, validar que o regex `interesse_match` da categoria bate em pelo menos uma msg incoming do lead nesta sessão (contextMessages + incomingText atual). Se não bater, rejeitar + log `interesse_hallucination_blocked`.
2. **Regra hardcoded no prompt:** "NUNCA ASSUMIR PRODUTO/CATEGORIA (Bug 19): PROIBIDO chamar set_tags com interesse:X ou perguntar sobre produto se lead AINDA NÃO mencionou. Se lead só enviou saudação/nome, pergunte 'No que posso te ajudar?' — JAMAIS assuma."
3. **Migration:** event `interesse_hallucination_blocked` adicionado ao CHECK constraint de `ai_agent_logs` (lição R114 — insert silencioso). Também `auto_field_extracted` (já em uso, faltava no constraint).

**Validação E2E 5 cenários (Playwright + Sandbox UAZAPI):**
- C1 trivial ("oi" → "Pedro"): IA "Pedro, em que produto ou material posso te ajudar?" ✅ sem chute, tag `motivo:compra` só
- C2 "quero comprar tinta": sale_closed_detected disparou handoff prematuro (achado paralelo Bug 20 — sale_closed regex muito agressivo). Mas Bug 19 ok: sem `interesse:` alucinado
- C3 "vcs tem tinta?": IA qualificou ambiente. Guard PERMITIU `interesse:tinta` (regex bate). ✅
- C4 "vcs vendem cama de casal?": excluded reply ("Infelizmente não trabalhamos com cama..."). ✅
- C5 "bom dia" → "preciso de um material": "Qual material de construção você está procurando?" — pergunta genérica sem chutar. ✅

**Regra preventiva:** todo handler que persiste estado controlado por LLM (tags, profile, kanban move) precisa validar contra EVIDÊNCIA no histórico do lead, não confiar apenas no que o LLM mandar. LLM em input trivial CHUTA pra "ter o que fazer" — defesas determinísticas existem pra isso.

Arquivos: `ai-agent/index.ts` (+~30 linhas guard + 1 regra prompt), `migrations/20260517170000_ai_agent_logs_interesse_hallucination_event.sql`. Deploy ai-agent. Screenshots em `wiki/validacoes/`.

**Backlog Bug 20 (achado nos testes):** regex `sale_closed` em `saleClosedDetection.ts` casa "quero comprar X" mesmo SEM qualificação prévia. Lead deveria pelo menos ter passado por algumas qualif antes de virar venda fechada. Frase: *"investigar bug 20 sale_closed regex agressivo 2026-05-18"*.

---

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
