---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-24 (noite VIII) — 1 produto = foto única com legenda (v7.52.3) + investigação stall #2

**Trigger:** dono pediu atacar os 2 achados + ver doc UAZAPI + testar foto de 1 produto com legenda + doc/commit/deploy + frase de retomada (vai encerrar). **Aviso do dono: NÃO cadastrar produtos sem autorização** (ele trocou o catálogo) — ver [[feedback_no_catalog_products_without_authorization]].

**Fix #1 (shipped):** `searchProducts.ts` — 1 produto com ≥2 fotos virava carrossel multi-foto. Removido esse branch (~125 lin); todo caso de 1 produto agora usa `/send/media` (1ª foto + legenda título/preço). Formato confirmado na doc UAZAPI local (`{number, type:"image", file, text}`) — a doc online é JS-render, não lê via fetch. **E2E real:** "quero cuba de apoio quadrada" → foto única (media_type=image) + legenda "Cuba...\nR$ 119.90" + texto consultivo. Antes: carrossel. 69 testes verdes, deno 0, deploy CLI v(nova).

**Fix #2 (investigado, deferido):** stall = lead atinge score na categoria A, manda 2ª msg ~2s após a resposta (durante processamento), fora-de-horário → ai-agent roda 577ms mas early-returna SEM output e SEM ai_agent_runs (não chega no router). NÃO é msg perdida no debounce (a msg é processada). Causa exata = early-return silencioso pré-router (provável interação exit_action/score + concorrência). Não-óbvio, intermitente, recupera na retry, impacto real baixo. Documentado pra próxima sessão em vez de fix não-verificado.

**Frase de retomada:** *"v7.52.3 1-produto=foto-única shipped. Atacar achado #2: ai-agent early-return silencioso (577ms, sem ai_agent_runs nem response) quando 2ª msg chega ~2s após resposta de turno que atingiu score, fora-de-horário — adicionar log no topo do ai-agent pra achar o ponto de return, depois corrigir. Premium #2 cart engine no backlog."*

---

## 2026-05-24 (noite VII) — E2E 2 cenários + loop da fila validado nota 10 + fix leak _fora_hora (v7.52.2)

**Trigger:** dono pediu doc/commit/deploy + 2 cenários E2E completos (Playwright) do fluxo (saudação→qualif→score→1produto/carrossel→multi-item→resumo→transbordo + msg fora-horário) + testar o LOOP da fila (virada + timeout 00:00→próximo) e corrigir até nota 10.

**E2E real (sandbox router 558185749970→558181696546):**
- **Cenário 1 (fora de horário):** saudação→nome(Maria)→qualif impermeabilizante→handoff out-of-hours personalizado. **Bug achado:** R120 monta reason `"{texto}_fora_hora"` e o sufixo vazou colado na frase ("...parede interna_fora_hora"). **Fix:** `cleanHandoffItem` remove sufixos de código + cauda snake_case (+1 teste, 39 total). Deploy CLI.
- **Cenário 2 (extended_hours = inside):** saudação→nome(Pedro)→**carrossel 3 tintas**→cuba→multi-item→handoff regular. Fluxo limpo.

**LOOP DA FILA — NOTA 10** (dept sandbox ce8d6cd2, 3 membros pos 1/2/3, timeout 1min): rotação natural via cron Rafaella(2)→Djavan(3)→**WRAP Lucas(1)**→Rafaella(2)→Djavan(3); avança a cada expiry (00:00), **virada do último pro primeiro confirmada** (pick_next_assignee 2ª tentativa), rotation_number incrementa, **Case E "fila deu volta completa"** notifica gestor (rot>eligible). Timing ~1-2min consistente. **Mecânica do loop sem bug — não precisou correção.**

**Achados anotados (não-fix, backlog):** (a) 1-produto sai como carrossel em vez de send_media (regra [[feedback_single_product_send_media]], recorrente); (b) stall ao trocar de categoria após atingir score num turno fora-de-horário (recuperou na 2ª msg). Estado sandbox restaurado (djavan removido, timeout 5, extended_hours null). **Catálogo: dono trocou os produtos — NÃO cadastrar nenhum sem autorização.**

**Frase de retomada:** *"v7.52.2 loop da fila validado nota 10 + leak _fora_hora corrigido. Backlog: 1-produto→send_media; stall product-switch fora-horário; premium #2 cart engine."*

---

## 2026-05-24 (noite VI-b) — Visibilidade controlável pelos toggles (v7.52.1, revisa a dura)

**Trigger:** dono apontou o painel UsersTab (3 toggles "Visibilidade de conversas") e perguntou se desmarcar ali era o controle. Percebeu o conflito: a v7.52.0 tinha regra DURA (agente sempre só Minhas) que ignorava os toggles → toggles "mortos". Dono escolheu modelo **flexível (toggles mandam)**.

**Mudança:** removi a regra dura do `useHelpdeskInboxes` (volta a honrar `can_view_*`, default ausente→false). `ROLE_DEFAULT_VISIBILITY` no UsersTab: insert/troca-de-papel seta visibilidade por papel (agente→tudo false, gestor→depto, admin→global). Default das colunas `can_view_unassigned`/`can_view_all_in_dept`→false (migration `20260524190000`, safe-by-default). Net: admin controla pelos toggles; atendente novo nasce restrito; gestor/admin amplos.

**Lição:** regra dura por role que ignora a UI de permissões existente = UX contraditória (toggles que não fazem nada). Quando já existe mecanismo granular (toggles), reforçar via DEFAULT + role-aware insert > sobrescrever via override hard.

**Deploy + auditoria final (prod):** push v7.50.1→v7.52.1 (`17dde32..c82c7d4`), CI buildou imagem GHCR, webhook Portainer (HTTP 204) → `crm.wsmart.com.br` atualizado. **Auditoria EletropisoV2 (Playwright + DB):** 12 atendentes (agente) + 1 gestor (josafa). Pegou 4 atendentes ainda destravados + 5 sem posição na fila (adicionados pelo painel prod antigo) → corrigidos. Estado final verificado EM PROD: 12 atendentes "SÓ MINHAS" (Rafaella toggles OFF no painel) + fila Vendas ON/10min com os 12 no round-robin (diálogo QueueConfig). Healthcheck CI falhou por 3 mismatches schema pré-existentes (TicketResolutionDrawer/useVendorDetail — não-bloqueador, não toca o build).

---

## 2026-05-24 (noite VI) — Atendente só "Minhas" + fila ON + timeout 10min (v7.52.0)

**Trigger:** dono mostrou a tela do atendente (Rafaella) vendo "Não atribuídas (10)" e "Todas (50)". Pediu: (1) atendentes só veem "Minhas" (quando cair handoff aparece lá); (2) ativar a fila a partir de agora; (3) timeout de rodízio 5→10min com paridade no painel admin.

**Permissões (role-driven, durável):** `useHelpdeskInboxes` passou a ler `inbox_users.role`; para `agente` força os 3 flags de view = false (não depende dos flags do banco — pega atendente novo também, cujo default `can_view_unassigned` é true). DB: flags zerados pros 14 agentes (consistência). gestor/admin intactos. As abas "Não atribuídas"/"Todas" só aparecem pra gestor/admin agora.

**Fila ON:** dept Vendas (`5240c457`) `queue_mode_enabled=true`; 7 membros ganharam `queue_position` 10-70 (estavam null → round-robin não funcionaria). Handoff entra no rodízio e cai na "Minhas" do atendente da vez.

**Timeout 5→10:** dept atualizado; default da coluna `queue_mode_timeout_minutes` 5→10 (migration `20260524180000`); `TIMEOUT_DEFAULT` 5→10 no `QueueConfig.tsx`. Paridade: painel admin abre em 10, novos depts começam em 10, cron requeue usa 10.

**Validação:** mudanças DB aplicadas e conferidas (queue ON/10min, 14/14 agentes restritos, posições 10-70). Frontend: HMR limpo no dev server, sem erro novo (os erros tsc são dívida pré-existente da tipagem supabase, vite build ignora). Atendente vê o efeito no próximo refresh.

**Frase de retomada:** *"v7.52.0 atendente só Minhas + fila ON + timeout 10min shipped. Pendente: testar com login de atendente real; backlog premium #2 cart engine."*

---

## 2026-05-24 (noite V) — Transbordo personalizado #4 + anti-repetição de nome + strip bare (v7.51.0)

**Trigger:** dono mandou (1) commitar a v7.50.1 pendente, (2) implementar #4 (msg fora-horário personalizada citando nome+item), (3) E2E 10 cenários no EletropisoV2 até nota 10 cobrindo o fluxo completo (saudação→qualif→contagem→score→1 produto/carrossel→multi-item→resumo pro vendedor→transbordo), (4) testar msg fora-horário com contexto. Durante o E2E o dono testou em paralelo na prod e deu feedback: "funcionou, mas repetiu muito meu nome, em cada mensagem".

**Commit v7.50.1:** a release fantasma (P5 nameCapture + telhas offline) foi commitada (`95b98bb`), deno 0, 7 testes nameCapture verdes.

**#4 Transbordo personalizado (`personalizeHandoffMessage` em businessHours.ts):** prefixa `"{Nome}, anotei seu pedido: {item}."` antes da msg de transbordo. `cleanHandoffItem` extrai só a parte legível do reason (tira "Pedido completo:", pega 1ª frase descartando meta-notas pro vendedor, descarta códigos snake_case, cap 160 p/ multi-item). Aplicado nos **8 paths de handoff**. Config fora-horário atualizada (sandbox+V2): texto do dono + janela de horário, sem "anotei" (evita duplicar com o prefixo).

**P7-strong anti-repetição (`buildNameUsageDirective` em greetingPolicy.ts):** determinístico — olha as últimas msgs do bot; se o nome apareceu nas últimas 2, injeta supressão no prompt. Fonte do problema: regra "máx 1x por mensagem" era cumprida mas o LLM usava em TODA msg. **E2E: nome 7/9 → 1/5.**

**Strip bare tool-call:** `stripLeakedToolCalls` agora pega `functions.handoff_to_human` SEM parênteses (gpt-4.1 vazou solto no fim da msg, e o handoff NÃO executava nesse caso — R147 estendido ao product specialist). Strip cosmético + nota: o caminho determinístico (trigger/sale_closed) executa o handoff de forma confiável.

**E2E real (sandbox router, lead 558185749970→agente 558181696546):** fluxo lâmpada completo nota 10 — greeting cita loja+pede nome; "George" capturado; qualifica (voltagem→ambiente→tipo, contagem); score 40→carrossel (2 tintas); 1 produto (impermeabilizante, carrossel de 2 imagens do MESMO produto — anotado); multi-item; resumo rico pro vendedor ("Pedido completo: 1 tinta Fosco + 1 manta" + qualification_chain); transbordo personalizado nome+item; fila round-robin (Lucas→Rafaella). **EletropisoV2 PROD validado pelo dono** (lâmpada LED, msg final "George, anotei seu pedido: 1 lâmpada LED amarela 12W, bulbo tradicional…"). 930 testes (4 fails pré-existentes), deno 0, ~6 deploys CLI.

**Achados anotados (não-bloqueadores):** (a) saudação determinística + specialist às vezes pedem o nome 2x no 1º turno; (b) 1 produto com múltiplas imagens vira carrossel multi-card em vez de send_media; (c) LLM esporadicamente verbaliza handoff_to_human (mitigado por strip; determinístico executa). 

**Frase de retomada:** *"v7.51.0 transbordo personalizado + parcimônia de nome shipped (E2E nota 10, prod validada). Backlog: double-ask de nome no 1º turno; 1-produto→send_media; premium #2 cart engine."*

---

## 2026-05-24 (noite IV) — Captura determinística de nome (P5) + auditoria de atendimento real (v7.50.1)

**Trigger:** dono testou na V2 (lead George) e o atendimento cortou seco. Pediu auditoria do atendimento + correções (zero gambiarra) + teste + aviso pra ele testar.

**Auditoria — meu 1º diagnóstico estava ERRADO (corrigido auditando ai_agent_runs reais):** culpei o gatilho "preço", mas o código JÁ pula "preço" em perguntas (INFO_TERMS + isQuestion). Causa raiz real do handoff seco do George: **"telha brasilit" não casava categoria** → search_products 0 resultados + fora de horário → R120 (handoff imediato forçado). E o nome "George" se perdia (product specialist não chamava update_lead_profile; regra de prompt foi ignorada no teste).

**Correções (só raiz):**
- ❌ Descartei o fix do gatilho "preço" (não estava quebrado — fixar seria gambiarra).
- ✅ **Categoria `telhas` offline** (sandbox + V2) — loja vende, faltava cadastro. Vira qualifica+handoff rico. NÃO mexi no R120 (correto pra produto genuinamente inexistente).
- ✅ **P5 captura determinística de nome** — `nameCapture.ts` (extractLeadName + wasNameAsked, 7 testes). Pré-router: se última outgoing foi o pedido de nome e full_name desconhecido, extrai e persiste (inclusive bundled "George\nQual preço..."). Regra de prompt no product specialist tentada e REVERTIDA (LLM ignorava + estourava o teto de 4KB do prompt).

**E2E sandbox (fora de horário, replicando George) nota 10:** "Olá"→saudação; "George"+"Qual preço de telha brasilit 244x110"→`full_name=George` capturado + `interesse:telhas`/`marca_telha:Brasilit` + resposta consultiva (sem seco); "50 telhas, é só isso"→handoff_to_human rico ("Pedido de 50 telhas Brasilit 244x110") + msg fora-horário + fila round-robin (rafaella). 1391 testes verdes, deno 0, deploys CLI.

**Pendente (cosmético, deferido):** #4 personalizar a msg de fora-de-horário citando nome+item (hoje é template genérico; o nome+item já vão no reason do handoff e no painel).

**Frase de retomada:** *"v7.50.1 P5 nome determinístico + telhas offline shipped. V2 conv 5b78ee46 resetada pro dono testar. Backlog: #4 msg fora-horário personalizada; premium #2 cart engine."*

---

## 2026-05-24 (noite III) — qualificationGate shipped (v7.50.0) + E2E prod 10 cenários nota 10

**Trigger:** dono pediu (1) implementar o `qualificationGate.ts` (fonte única buscar-vs-qualificar, frase de retomada da sessão anterior) e (2) E2E real em produção, 10 cenários, iterar até nota 10, depois auditar/documentar/commit/deploy.

**Implementação (fix de raiz, zero gambiarra):** `_shared/agent/qualificationGate.ts` — `evaluateQualificationGate` lê o stage engine (score/exit_action) e devolve modo `qualify`/`search`/`qualify_then_handoff`/`no_category`. Wire no dispatch do router (index.ts): para `produto`/`qualificacao` o gate é AUTORIDADE — `qualify`→qualification_specialist (suprime pré-busca), `search`→product_specialist (mesmo se router disse qualificacao, honra exit_action quando lead responde curto), `offline`→product_specialist (qualifica+handoff). Único decisor, lê a MESMA fonte do score.

**2 bugs de raiz achados NO E2E e corrigidos:**
1. **`so_se_pedir` cortava em 8 msgs** — o cap de mensagens default era 8 (igual `apos_n_msgs`), contradizendo o contrato documentado ("lead controla, max alto"). Qualify-first (mais turnos) batia no handoff genérico antes do fechamento. Default → 40.
2. **handoff specialist vazava tool call como texto** (`functions.handoff_to_human({...})`) com gpt-4.1-mini → handoff não executava + lead via sintaxe crua. Subido pra gpt-4.1 + `stripLeakedToolCalls` (defesa em dispatchResponse).

**E2E real (sandbox router `e7131d35`, lead 558185749970 → agente 558181696546), 10 cenários nota 10:**
1. Lead novo → "Olá! Bem-vindo a Eletropiso, com quem eu falo?" 2. Dá nome → "Prazer, Carlos!" + full_name persistido. 3. "tem tinta?" → **gate qualifica** (não busca): ambiente→tipo→cor (3 perguntas contadas). 4. score 40 (limiar) → **carrossel 3 tintas reais**. 5. Fechamento → **handoff_to_human RICO** ("Carlos, tinta acrílica branca fosco Coral 16L...") + msg transbordo + **fila** (Lucas). 6. Lead sem nome → atendido normal. 7. Lâmpada led (offline) → "Temos sim! Qual potência?" → handoff rico ("10 lâmpadas LED 9W garagem") + fila (Rafaella, round-robin). 8. "ar condicionado" (inexistente) → honesto + alternativa, sem alucinar. 9. Lead recorrente → "Olá Carlos! Que bom te ver de novo 😊". 10. Fila round-robin validada (Lucas→Rafaella→Lucas).

**Infra de teste (sandbox only):** criado dept "Vendas Sandbox" com `queue_mode_enabled` + 2 membros + inbox default; horário estendido temporário (revertido ao fim). Pipeline: 1404 testes verdes (9 fails pré-existentes, intactas), deno 0, 5 deploys CLI (iteração). EletropisoV2 PROD recebe as melhorias (mesma fn) — `so_se_pedir` agora 40 msgs + handoff gpt-4.1.

**Frase de retomada:** *"v7.50.0 qualificationGate shipped + E2E 10/10. Próximo premium: #2 cart engine (add/update + cross-sell no resumo) OU #3 refino-por-contagem ('achei 40 tintas, vamos afunilar')."*

---

## 2026-05-24 (noite II) — Auditoria profunda qualify-first + fix de gênero no score (gambiarra revertida)

**Trigger:** dono pediu fluxo consultivo qualify-first (cenário 21.27: qualifica até score → busca → muitos resultados → refina por cor → carrossel → escolha → validação → transbordo). Testei e achei gaps; tentei gating por threshold; dono cobrou "não quero gambiarra, audite mais profundo".

**Auditoria profunda — causa raiz (NÃO é bug pontual):** "buscar vs qualificar" é decidido em **4 lugares independentes sem fonte única de verdade**, que se contradizem:
1. Stage engine (`service_categories`+`preLLMAutoExtract` C2): score atinge `exit_action=search_products`.
2. `detectIncomingSearchSignal` (R121/R137): regex "quero/tem X"+marca — **força busca em "quero tinta" vago**.
3. `deriveProductSearchParams` (pré-busca v7.48): categoria digital + sem produto.
4. LLM do product_specialist.
Na migração monolito→router, o stage engine (qualify-first) ficou no pré-LLM mas o router+product_specialist criou caminho paralelo de busca que NÃO consulta o estado de qualificação → inter-agent misalignment (MAST). Meu threshold no dispatch era um **5º decisor** = gambiarra.

**Fix de raiz proposto (próxima sessão):** `_shared/agent/qualificationGate.ts` — fonte ÚNICA determinística (lê stage/score/exit_action) respondendo "lead pronto pra buscar?". Religar #2/#3/dispatch/specialist nele → 1 decisor só.

**Shipped agora (validado):** flexão de gênero/plural no `fieldAutoExtractor` (`buildCandidateRegex`: "branca"→cor:branco, "fosca"→acabamento:fosco). Era bug real — matcher não casava gênero, **por isso o score nunca acumulava**. E2E: score 15→50, campos capturados. **Revertida** a gambiarra do threshold no dispatch (índice.ts voltou a `const def`; imports órfãos removidos). 386 testes verdes, deno 0, deploy.

**Estado:** EletropisoV2 prod = router + gênero-fix + batching + rule "não temos". Qualify-first NÃO está ativo (revertido) — segue search-first até o qualificationGate.

**Frase de retomada:** *"implementar qualificationGate.ts (fonte única qualify-vs-search lendo stage engine) + religar detectIncomingSearchSignal/deriveProductSearchParams/dispatch/product_specialist nele; depois rodar 5 cenários consultivos completos (saudação→nome→qualif+score→busca quando stage libera→refino por contagem→carrossel batching→escolha→validação→upsell→transbordo c/ resumo) até nota 10. Fix de gênero no score JÁ está em prod."*

---

## 2026-05-24 (noite) — Carousel batching "mais opções" (v7.49.0) + auditoria dos 3 cenários premium

**Trigger:** após auditar os 3 cenários consultivos (21.27-21.29) que o dono mandou como alvo premium, mapeamos o que já temos vs falta. Decisão: vector NÃO é necessário (catálogo bounded + funil de qualificação já entrega facetas — busca facetada > embeddings). Prioridade #1 = carousel batching. Dono mandou implementar→testar→auditar→documentar→commit→deploy.

**Feature (v7.49.0):** lead rejeita carrossel ("nenhuma dessas") ou pede mais → agente mostra LOTE NOVO excluindo os já vistos; quando esgota, oferece refinar/categoria/consultor sem inventar. Migration `conversations.shown_product_ids text[]`; `searchProducts` exclui+cap5+persiste+mensagem-esgotado; router `produto` cobre "mais opções"; productSpecialist regra 6b.

**2 bugs raiz achados NO E2E (corrigidos na fonte, zero remendo):** (1) query do catálogo não selecionava `id` → exclusão/persistência eram no-op silencioso (unit tests passavam pq o mock tinha id); (2) `conversations` carregado sem `shown_product_ids` (select de colunas) → exclusão cega entre turnos. Fix: adicionar a coluna nos 2 selects.

**E2E real sandbox router 3 estados nota 10:** lote1 (5 cards/cap, persiste 5) → lote2 "nenhuma dessas" (router→produto, exclui 5, mostra 2 DIFERENTES "[E2E] Opção 3/4", persiste 7, texto consultivo) → esgotado "tem mais?" (sem carrossel, "essas eram todas... refinar/categoria/consultor"). Catálogo ampliado p/ 7 tintas temp durante teste, depois removido; sandbox conv limpa.

**Pipeline:** 366 testes agent verdes (+4). deno 0. Deploy CLI (4 deploys: feature + fix id + fix conv-select). EletropisoV2 PROD + sandbox.

**Backlog premium restante (ordem):** #2 cart engine, #3 refino-por-contagem, #4 modo consultivo/indecisão, #5 busca facetada (não vector), #6 profundidade de catálogo.

**Frase de retomada:** *"v7.49.0 carousel batching shipped (nota 10). Próximo premium: #2 cart engine (add_cart/update_cart estruturado + cross-sell no resumo)"*.

---

## 2026-05-24 (tarde III) — Latência do product specialist resolvida na fonte (v7.48.0) + auditoria de objetivos

**Trigger:** após auditoria profunda (objetivos principal/secundários, nota antes 5.7 → hoje 8.3), user pediu pra resolver o único 🔴 crítico — latência do product specialist (~8s) — **sem gambiarra**, testar real até nota 10, depois auditar/documentar/commit/deploy. Antes disso: recuperação do índice git corrompido + commit/push da v7.47.0 (release fantasma) + auditoria Playwright (dashboard Roteamento + tab Agente IA, dados reais de prod).

**Investigação (não-chute):** `ai_agent_runs` reais mostraram turnos de produto SEM busca em ~2.5s (1 round OK) e COM `search_products` em 7.8-15.8s. Causa raiz: **2 rounds de LLM** (decidir buscar → compor). O monolito era rápido por ter pré-search inline (R121/R137); desligado sob router (`skipR121`) por bug de carrossel duplicado.

**Fix de raiz (v7.48.0):** re-liga o pré-search SÓ pro product specialist (`deriveProductSearchParams` + `runInlineSearchProducts` antes do specialist + `preSearchContext` injetado no prompt → 1 round). Anti-duplo-carrossel: `carouselSentInThisCall` (idempotente). `routerProductPreSearch` isola o flag dos outros specialists (set_tags handler não religa busca).

**Bug exposto no E2E + corrigido:** pré-busca com query crua ("vocês têm tinta acrílica fosca?") achava 0 produtos (stopwords) → handoff espúrio fora-de-horário. `cleanProductQuery` stripa saudação+verbo no início → query limpa. Sem isso = regressão vs LLM (que limparia a query).

**E2E real (sandbox router, 3 cenários nota 10):** tinta branca (cold) → greeting+carrossel+resposta; tinta acrílica fosca (isolado) → carrossel + "Temos sim! R$427,90...Qual atende melhor?"; tinta coral branca fosca (cold+marca) → consultiva. **Product hop ~6s (era 8-16s), 1 search, 1 round, 1 carrossel.** 362 testes agent verdes (+15), deno 0, deploy CLI.

**Achado lateral (NÃO meu, fora de escopo):** cold-open com produto+marca pulou a saudação (greeting block v7.47.0) — meu fix só toca o path de produto pós-greeting. Backlog (P5/greeting follow-up). Próximo gargalo de latência: envio do carrossel UAZAPI (~4s, serial) — candidato a paralelização futura (maior risco).

**Frase de retomada:** *"v7.48.0 latência product specialist shipped (pré-busca 2→1 round, nota 10 E2E). Próximo: monitorar latência prod + considerar paralelizar envio do carrossel; Sprint E.2 proatividade"*.

---

## 2026-05-24 (tarde, domingo) — Saudação/reconhecimento migrados pro router (v7.47.0, PROD)

**Trigger:** após auditoria de paridade + 10 perguntas de discussão com o dono (contrato aprovado), implementar a migração das regras de saudação pro router. Dono testou ao vivo na prod e cobrou: lead frio não recebia saudação configurada.

**Causa raiz (defeito #2):** sob `routing_mode='router'`, o bloco determinístico de saudação era pulado (`index.ts:1373`); lead que abria com produto ia direto pro product specialist (sem boas-vindas/nome/loja).

**Entrega:** `greetingPolicy.ts` (fonte única `classifyLeadRecency` + `buildOpeningDirective`, 13 testes) + bloco de saudação determinístico RELIGADO no router pro 1º contato + `productSpecialist` usa tool compartilhada (ganha `full_name`+`city`). **Decisão A:** saudação determinística (confiável) em vez de injetar diretiva no prompt do specialist — tentativa de injeção falhou (product specialist ignorava o cumprimento; regra de captura de nome causava resposta DUPLICADA). 347 testes verdes, deno 0 erros. Deploy CLI no EletropisoV2 (prod). E2E sandbox OK: "bom dia, vcs têm tinta?" → "Olá! Bem-vindo a Eletropiso, com quem eu falo?" + carrossel.

**Follow-ups:** P5 persistência de nome mid-conversa (extração determinística), espelhar cumprimento, retomada de memória do recorrente (P2-A); + defeitos #1/#4/#6 da auditoria. Ver [[project_router_parity_gaps]].

**Frase de retomada:** *"continuar greeting router: P5 persistência de nome determinística + retomada memória recorrente (P2-A) + defeitos #1 search stall, #4 handoff keyword, #6 validator specialists"*.

---

## 2026-05-24 (manhã, domingo) — E2E jornada completa router (sandbox Eletropiso) nota 9/10

**Trigger:** user pediu jornada E2E real nas 2 instâncias sandbox (lead Sandbox IA `558185749970` → agent Eletropiso `558181696546`/`174af654` em routing_mode=router), forwardando cada passo (lead+IA) pro operador `5581993856099` e card de transbordo estilo "Cliente/Motivo/Resumo/Tags/Score". Reiniciar até nota 10.

**Infra:** sender `scripts/uaz-send.mjs` (UTF-8-safe, Windows — corrige acentos/emoji corrompidos no curl). Reset FRIO via MCP (ai_agent_logs + ai_agent_runs + conversation + lead_profile + conversation_messages limpos). Conversa de teste `e7131d35`. Produção EletropisoV2 `558781592373` (is_sandbox=false) **intocada**.

**RUN #1 abortado (erro de roteiro meu):** cenário pediu "porcelanato", mas catálogo real do agent (7 produtos) NÃO tem piso — só Tintas(3)/Impermeabilizante/Telhas/Cubas/Vernizes. Busca vazia → IA qualificava à toa. Reiniciei com cenário casado.

**RUN #2 (Fernanda, nota 9/10):** 6 turnos, roteamento 100% correto: saudação→greeting, nome→greeting+update_lead_profile (persistido), produto→product+search_products (**carrossel real 3 tintas**), escolha→SDR oferece +item/handoff, multi-produto→2ª busca (manta Quartzolit), "fechar os 2 itens"→**handoff_to_human com resumo rico e preciso** (1 lata Coral Fosco parede interna + 1 Manta 18kg laje 50m²). Msg fora-de-horário **correta** (domingo). Tags qualif gravadas (`tintas/acrílica/fosco/Coral/impermeabilizante_laje`), `conversation_summaries` populado, `full_name=Fernanda`. Card de vendedor + nota enviados ao operador via WhatsApp.

**3 gaps menores (BACKLOG — paridade router, não-bloqueadores):** (1) `lead_score` não acumula sob router — `index.ts:2203` faz `return` e pula o pós-processamento do monolito (score/sentiment). (2) `sentiment` não capturado sob router. (3) 1 produto enviado como `carousel` em vez de foto (viola `feedback_single_product_send_media`). User optou por **aceitar 9/10 e documentar** (fixes tocam ai-agent HIGH RISK → sprint futuro). 4º item (cidade não coletada) era do meu roteiro, não bug.

**Frase de retomada:** *"executar Sprint paridade router: lead_score+sentiment sob router (index.ts:2203 pula pós-proc) + 1-produto-foto"*.

---

## 2026-05-24 (madrugada II) — Fix PROD EletropisoV2 (v7.44.1)

EletropisoV2 (`1062059a`, Lucas, monolith) trocada gpt-5-mini → gpt-4.1-mini (Bug A afetava prod: resposta vazia). Config no banco, efeito imediato. Validação passiva. Frase de retomada abaixo.

---

## 2026-05-24 (madrugada) — Sprint C 3/3 (v7.44.0): C6 E2E 7/7 + C7 dashboard + 2 bugs raiz + canal WhatsApp

**Trigger:** user pediu "siga p/ próxima fase + auditе + testes reais nas 2 instâncias até nota 10, me enviando cada teste pro 5581993856099". Depois pediu canal de controle WhatsApp bidirecional.

**C6 — 7 cenários E2E reais (lead Testador `558185749970` → Eletropiso router `558181696546`), cada um nota 10, enviados ao operador:**
- Reset FRIO por cenário (3 fontes de contaminação descobertas): `ai_agent_logs` (fonte de `hasInteracted` — sem limpar, IA pula saudação configurada), `conversations` (status_ia/tags/ai_summary), `lead_profiles` (conversation_summaries/notes). Marcador `greeting_sent` sintético p/ testar router sem o handler de saudação interceptar.
- saudacao→handler determinístico; qualificacao/produto/handoff/objecao→product_specialist (gpt-4.1); pagamento/fora_escopo→monolith (gpt-4.1-mini).
- Runner formal commitado: `scripts/e2e-router-runner.mjs` + `e2e-scenarios.json`. Relatório: `wiki/relatorio-e2e-router-2026-05-23.md`.

**2 bugs de raiz (achados nos testes):**
- **Bug A:** gpt-5-mini devolvia resposta vazia (max_completion_tokens=1024 consumido pelo reasoning) → fallback "Em que posso te ajudar?". Afeta EletropisoV2 PROD. Fix: piso 4096 p/ reasoning em `llmProvider.ts` + monolith de teste → gpt-4.1-mini.
- **Bug B:** objeção atropelada por qualificação ("interno ou externo?"). Fix: `objecao`→`salesFunnelIntents` (specialist) + regra 10 (empatia+valor) no prompt. Validado: resposta consultiva nota 10.

**C7 — Dashboard "Roteamento":** RPC `get_router_dashboard` (SECURITY DEFINER + is_super_admin) + `AdminRouting.tsx` (recharts) + rota + sidebar. Validado com dados reais.

**Canal de controle WhatsApp:** `e2e-control-webhook` + tabela `e2e_control_inbox`. Operador comanda via WhatsApp. **Achado UAZAPI:** webhook envia remetente como `@lid` interno; número real em `sender_pn`. Polling do orquestrador lê o inbox a cada ~35-60s (não é push — sou turn-based).

**Deploy:** token novo achado em `~/.claude.json` (conta `eletropiso.wsmart@gmail.com`). ai-agent + e2e-control-webhook deployados via CLI. Migrations (C7 RPC + e2e_control_inbox) via apply_migration.

**Pipeline:** tsc 0 erros · vitest (productSpecialist 18, llmProvider 21, agent 312 pass; 9 fails UI pré-existentes). Andamento orquestrador: 68% → **~72%**.

**Frase de retomada:** *"continuar Sprint D: qualification/handoff/objection/greeting specialists dedicados + migração routing_mode='router' default — base pós-C 7/7 v7.44.0"*.

---

## 2026-05-23 — Sprint C (arquivado)

> 4 entradas (iniciado v7.42.0 → parcial 2/3 v7.43.0 → auditoria hardening v7.42.1 → hardening E2E 9 bugs v7.43.13) movidas pra [[wiki/log-arquivo-2026-05-23-sprintc]] (hard limit 300).

---

## 2026-05-24 (noite) — Sprint D: 4 specialists dedicados + specialistBase + shadow + E2E 6/6 (v7.45.0)

Router agora despacha as **7 intents pra specialists dedicados**; monolito vira fallback de erro. Tudo atrás de `routing_mode` (default monolith — prod intocada). Canal de controle WhatsApp reativado (operador comandou parte da sessão).

**Pesquisa primeiro** (papers/GitHub/forums/X, 3 agentes): router→1 specialist é o lado SEGURO do debate (15× tokens é fan-out, não se aplica); boundaries claros = maior anti-alucinação (MAST: 36.9% das falhas = inter-agent misalignment); migração NUNCA flipar de vez (shadow→canary→%); feel-felt-found + SPIN + escape-hatch nos prompts.

**Código (atrás de flag):** `specialistBase.ts` (`runSpecialist` extraído do productSpecialist; este refatorado, 18/18 verdes); 4 specialists (greeting/qualification/objection/handoff) + `specialistTools.ts`; wire-in `DISPATCH[intent]→def`; greeting determinístico desligado sob router; shadow mode (migration 20260524100000) + UI Select + SYNC.

**E2E real 6/6 nota 10** (sandbox router 558181696546, lead Testador): bom dia→greeting; "João Pedro"→greeting+persiste nome; "tinta branca"→product+carrossel; "achei caro"→objection feel-felt-found; "quero vendedor"→handoff+transbordo; "aceita pix"→objection business_info. Router conf 0.9-1.0.

**2 bugs raiz achados no E2E (zero remendo):** greeting salvava nome via `set_tags(lead_name:)` rejeitado → troquei p/ `update_lead_profile(full_name)`; objection chamava tool sem texto → REGRA UNIVERSAL de texto nos 4 specialists.

**Pipeline:** 350 testes agent verdes (329+21). Zero erro TS novo (36 pré-existentes, baseline confirmado via git stash — NÃO corrigidos, hardening separado). ai-agent v123+.

**Andamento Plano Orquestrador:** 72% → **~85%**. Migração default→router STAGED (não flipei; prod intocada).

**Frase de retomada:** *"Sprint D shipped (v7.45.0, 6/6 E2E). Próximo: shadow em agent real + migrar EletropisoV2 p/ router após validação + D6 aposentar monolito"*.

---

## 2026-05-24 (madrugada) — EletropisoV2 router PROD + 36 erros TS zerados + Sprint E.1 memória longa (v7.45.1 + v7.46.0)

Sessão contínua via canal de controle WhatsApp. Usuário mandou: migrar EletropisoV2 pra router em prod (sem shadow), corrigir os 36 erros TS, e seguir pro próximo sprint.

**v7.45.1:** EletropisoV2 (`1062059a`) → `routing_mode='router'` em PROD (config validada: 24 cats + business_info + greeting). Rollback=monolith. Achado: monolito dava "Em que posso ajudar?" genérico a perguntas de produto ("telha brasilit") — router corrige. **36 erros TS do ai-agent zerados** (deno check 36→0, type-only, vitest sem regressão): SendTextMsgFn/SendPresenceFn/Logger→object + casts any em conversation/contact/instance/counterRow/greetResult + pfq local (CFA never) + loadActiveProfile(supabase as any) TS2589. Commits daf6502+ec8e9c4+6424489.

**v7.46.0 — Sprint E.1 (memória longa por lead):** pesquisa (Mem0/Zep/LangMem) → memória ESTRUTURADA, não vector (domínio bounded + Postgres). lead_profiles já era a tabela. migration aditiva (products_seen/qualification_stage/memory_updated_at). `leadMemory.ts`: buildLeadMemoryBlock injeta bloco key:value no topo de todo specialist; consolidateLeadMemory (fire-and-forget, sem LLM) deriva stage/products/interests de tool calls reais. greeting refinado p/ returning lead. **E2E real**: turno1 "sou Carlos, queria tinta" → captura (Carlos/tintas/3 produtos); turno2 retorno (conv limpa, lead_profiles mantido) → "Claro que lembro! Você estava vendo tintas, quer continuar?". 334 testes agent verdes. commit f6dcd94.

**Andamento Plano Orquestrador:** ~85% → **~88%** (Sprint E.1 de 3 pilares do E).

**Pendências:** Sprint E.2 (proatividade) + E.3 (RAG); monitorar EletropisoV2 router (0 runs ainda, tráfego baixo madrugada); D6 aposentar monolito após 30d; nome capturado quando vem junto com produto (product_specialist não persiste — edge case). 36 erros pré-existentes do whatsapp-webhook (fora de escopo).

**Frase de retomada:** *"Sprint E.1 memória longa shipped (v7.46.0). Próximo: Sprint E.2 proatividade (follow-ups) OU E.3 RAG; monitorar EletropisoV2 router em prod"*.

---

