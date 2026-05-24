---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

