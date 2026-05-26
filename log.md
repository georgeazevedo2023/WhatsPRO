---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-26 — "Catálogo é minoria": nunca negar + handoff determinístico + skeleton/sessão-zumbi (v7.55.0)

**Trigger:** dono mandou auditar (1) skeleton infinito no Helpdesk e (2) IA dizendo "No momento não encontrei a caixa-d'água de 1000 litros" — viola regra: catálogo cadastrado é MINORIA, maioria é estoque físico; correto = coletar info + transbordar, nunca negar. "prossiga teste commit audite deploy".

**Auditoria #1 (skeleton):** sessão zumbi — JWT expira, refresh token inválido (`400 Invalid Refresh Token`). A query REST do supabase-js trava ANTES do fetch (resolução de sessão async); o `AbortController` de 10s só aborta o fetch (que nem começou) → `finally` nunca roda → skeleton eterno + console limpo. Reproduzido via Playwright (login real, Daniel Reis carrega ok com sessão fresca → bug é condicional).

**Auditoria #2 (não encontrei):** 3 causas-raiz reais — (a) validador determinístico (`responseValidator`, tem `'nao encontrei'`) estava telemetria-only desde Sprint B1; (b) **caminho do router NÃO passava por validador** (`index.ts:2430` retorna o specialist ANTES do bloco de validação; `specialistBase` não validava); (c) PATH C do `searchProducts` mandava "pergunte se aceita opção diferente" (moldura errada). Evidência em `ai_agent_runs` (Gabriel Lucas: product specialist gpt-4.1, search 0 → PATH C → LLM verbalizou "não encontrei").

**Fixes (5):** validador religado+enforcement no `specialistBase` (backstop sanitiza negação/erro/leak, preserva handoff) · `NO_DENIAL_RULE` + reframe PATH A/C + regras 4/7 do product specialist · `ChatPanel` timeout wall-clock (`Promise.race`) · `AuthContext.getSession` timeout 8s+signOut · `HANDOFF_PATTERNS` ampliados.

**Gap exposto no E2E (e corrigido):** sob router a conversa fragmenta entre product/qualification/greeting → item ausente do catálogo NUNCA transbordava (lead pendurado em "já busco..."). Fix determinístico: `handleZeroResults` grava `seller_handoff_pending`; pré-router força handoff specialist + seta `pendingHandoffTrigger` → `dispatchResponse` step 22 EXECUTA o handoff (fila+shadow+msg). Validado E2E: status_ia=shadow + assigned_to + "Carlos, anotei seu pedido: ...tinta Suvinil 18L. Vou conectar você com nosso vendedor". Bug "não encontrei" eliminado em 8 turnos.

**Pipeline:** deno check 0 · 423 testes do agente verdes (1 fail pré-existente: productSpecialist.test.ts loader ESM `https:`) · ~5 deploys CLI (PROD compartilhada). **Aprendizado:** sandbox agent tem config própria (caixas_dagua offline; Tintas qualify-first) → reproduzir o caso exato exige escolher produto/categoria certo; validei o mecanismo de handoff forçado setando a tag direto.

**v7.55.1 (mesma sessão) — brand-filter RESOLVIDO:** lead pedia "tinta Suvinil" e recebia Coral (marca se perdia no qualify-first). Fix 2 camadas: `deriveProductSearchParams` injeta marca durável na query + guard explícito em `searchProducts` antes do auto-send (lead pediu marca e nenhum produto a contém → zera+brandNotFound→coleta+handoff). E2E nota 10: Suvinil→0 (não mostra Coral)→coleta→handoff executa. 36 testes searchProducts (+1).

**v7.55.2 (mesma sessão):** (1) transbordo humanizado — `cleanHandoffItem` rejeita reason 3ª pessoa/interno → lead recebe só ponte ("Pedro, anotei tudo aqui…"), nunca "Lead quer…"; resumo rico vai em `private_note` ("📋 Resumo do pedido (interno)") nos 2 caminhos de handoff + painel Transbordo. (2) conversa persiste ao trocar de aba via `?conv=` na URL (HelpDesk.tsx) — validado por reload no Playwright. +2 testes anti-vazamento.

**Frase de retomada:** *"v7.55.0→v7.55.2 shipped (catálogo-é-minoria + handoff determinístico + brand-filter + transbordo humanizado/nota interna + persistência da conversa na URL + skeleton/sessão-zumbi). Monitorar EletropisoV2 router PROD. Backlog premium: #4 modo consultivo, #5 busca facetada. Nota lateral: template handoff_message do agente ainda é configurável (owner pode deixar mais quente no admin)."*

---

## 2026-05-26 — Premium #3 refino-por-contagem SHIPPED + E2E progressivo provado (v7.54.0)

**Trigger:** dono pediu explicação do #3 → confirmou que já temos contadores de interação/pergunta com paridade admin → mandou implementar seguindo o molde.

**Feature:** busca devolve MUITOS resultados → faz UMA pergunta que estreita (contagem = sinal INTERNO). `searchProducts.ts` pós-busca: `products.length > refine_results_threshold` (default 6) E faceta discriminante não preenchida → diretiva [INTERNO] pedindo a PRÓXIMA faceta (ambiente→cor→acabamento→marca; logística ignorada); senão carrossel. Progressivo + loop-free. Complementa o qualificationGate (narrows por score pré-busca). **SYNC RULE completa:** migração `refine_results_threshold int default 6` + types + RulesConfig (0=desliga) + ALLOWED_FIELDS + validationSchemas + backend. Guardrail [[feedback_no_internal_count_or_jargon_to_lead]] embutido.

**Bug pego no E2E:** 1º design (guard `anyDiscriminatingFilled`, 1 pergunta só) era redundante com o gate → corrigi pra PROGRESSIVO. Esqueci de redeployar após a correção → 1º E2E falhou (v172 antigo); redeploy resolveu. Lição: após corrigir, redeploy ANTES de re-testar.

**E2E real sandbox (threshold=1 temporário, 3 tintas):** gate qualificou ambiente→tipo→cor por score; ao buscar (3>1), refino perguntou **"acabamento fosco/acetinado/brilho?"** → depois **marca** (progressivo), **zero número/jargão vazado**, terminando ao esgotar facetas. `deno check` 0, 35 testes searchProducts (+5). Deploy CLI. Sandbox restaurado (threshold=6, limpa). Nota: com catálogo pequeno + threshold default 6 o refino raramente dispara (gate já narrows); valor cresce com catálogo grande — threshold=1 foi só pra demonstrar.

**Frase de retomada:** *"v7.54.0 refino-por-contagem shipped (E2E progressivo provado). Backlog premium: #4 modo consultivo/indecisão, #5 busca facetada (overlap com #3)."*

---

## 2026-05-26 — Fix R121 stopword (Opção A): query natural não zera mais a busca (v7.53.2)

**Trigger:** dono mandou implementar a Opção A do achado da v7.53.1 ("quero a cuba…" → 0 resultados → handoff espúrio) e testar até nota 10.

**Auditoria fina (rastreei o código, confirmei o mecanismo exato):** `deriveProductSearchParams` (path B, `productSpecialist.ts:355`) monta `query = interesse + cleanProductQuery(incomingText)`. `cleanProductQuery` só removia, NO INÍCIO, saudação + verbo INTERROGATIVO (`tem/têm/vende/fazem/trabalham com`) — **a família de DESEJO (`quero/queria/preciso/gostaria/procuro`) faltava**. Com a categoria "pias" prefixada, "quero" virava palavra do meio → `searchProducts.ts:315` (ILIKE da frase inteira) dá 0 → AND-fallback (`words.every`, linha 345) exige TODAS as palavras no produto → "quero" não está → 0 → handoff fora-horário.

**Fix Opção A (2 camadas, fonte):** **(1)** `cleanProductQuery` ganhou a família de desejo + "ver" opcional + artigo ("quero a cuba…"→"cuba…"). **(2)** novo `SEARCH_INTENT_STOP_WORDS` + `filterSearchIntentTerms` (`qualificationStopWords.ts`) — o AND-fallback dropa palavras de intenção/filler (quero/uma/vocês/preço/saber…) antes do `.every()` (DIFERENTE de `QUALIFICATION_STOP_WORDS` que tem cor/material — esses são termos de busca válidos). Defesa em profundidade: camada 1 limpa a query da pré-busca; camada 2 protege QUALQUER caminho (LLM, R121) no core da busca.

**Validação:** `deno check` 0 · **437 agent + 5 stopwords + 9 novos verdes** · full suite 9 fails pré-existentes (zero overlap). Deploy CLI ai-agent. **E2E real sandbox router 2/2 PASS:** "quero a cuba de apoio quadrada" → query limpa "pias cuba de apoio quadrada" → **foto** (era 0+handoff); "queria ver tinta branca" → query "tinta branca" → **carrossel 3 tintas**.

**Follow-up (mesmo dia, doc UAZAPI):** dono apontou que carrossel de 1 card não existe → 1 produto TEM que ser send/media. Verifiquei o openapi: `/send/media` `required:[number,type,file]`+caption → nosso envio conforme ✅; `/send/carousel` NÃO declara mínimo (no v7.49.0 um carrossel de 2 renderizou) → "3" não é da doc. Dono manteve **2→carrossel**. Corrigida a string interna "Carrossel com 1 produto" mesmo mandando foto (`searchProducts.ts:819` `mediaType`='foto' p/ qualquer 1 produto — risco real: LLM falaria "veja o carrossel" com 1 foto). deno 0, 30 testes verdes, deploy CLI.
**Frase de retomada:** *"v7.53.2 fix R121 stopword + string foto/carrossel shipped (E2E 2/2). Regra de mídia: 1 produto→send/media, 2+→carrossel (dono manteve 2→carrossel; doc não exige min 3). Backlog: premium #3 refino-por-contagem com [[feedback_no_internal_count_or_jargon_to_lead]]."*

---

## 2026-05-26 — 3 fixes de polish (nome truncado / 1-produto-carrossel / double-ask) + E2E 3/3 (v7.53.1)

**Trigger:** auditar fundo + corrigir + testar real nas 2 instâncias até nota 10 os 3 achados da v7.53.0. Sessão PARALELA (takeover, abaixo) — toquei só em `ai-agent/index.ts` + `_shared/agent/{llmCallLoop,specialistBase,tools/mediaTools,tools/crmTools}` (+ testes).

**Causas raiz (3 Explore agents + verificação MANUAL, não chute):** **#1** rodei os 2 regexes determinísticos contra "João" — **nenhum trunca** → "Jo" é geração do LLM (`index.ts:1403` já admitia); footgun lateral: dedup `crmTools` comia apelido lowercase ("dudu"→"du"). **#2** `mediaTools.ts:77` `sendCarousel`(1 produto+≥2 fotos)→carrossel multi-card (v7.52.3 cobriu só `searchProducts`). **#3** `greetingSpecialist.ts:42` repede nome; `specialistBase` não sabia que o greeting determinístico já pediu o nome neste turno.

**Fixes (zero gambiarra):** #1 restauração determinística no `llmCallLoop` (prefixo isolado do 1º nome→nome cheio; `\bJo\b` não pega "Jorge") + `leadFirstName` nos 2 call sites + dedup exige metade ≥3 chars + case-insensitive. #2 `sendCarousel`(1 produto)→`sendMedia` (idempotente) + `sendMedia` ganhou `broadcastEvent` (faltava). #3 flag `greetingSentThisTurn`→`specialistBase` injeta diretiva anti-recumprimento/anti-repedido (genérica). **Validação:** `deno check` 0 · 428 agent verdes (+12) · full suite 9 fails pré-existentes (zero overlap). Deploy CLI ai-agent v169 (prod compartilhada). **E2E real sandbox router (cold reset + poll DB) 3/3 PASS:** #3 greeting redireciona sem repedir nome; #1 "Prazer, João!" + `full_name=João`; #2 cuba (10 fotos)→`media_type=image`, não carrossel.

**Achado backlog (fora de escopo):** pré-busca R121 (`categoria + texto cru`) com stopword "quero" quebra o AND-fallback (`words.every`) → 0 resultados → handoff espúrio; `cleanSearchQuery` só tira pontuação (fix futuro: `cleanProductQuery` no R121 inline). **Frase de retomada:** *"v7.53.1 3 fixes polish shipped (E2E 3/3). Backlog: (a) R121 inline stopword→handoff espúrio (cleanProductQuery); (b) premium #3 refino-por-contagem com [[feedback_no_internal_count_or_jargon_to_lead]]."*

---

## 2026-05-26 — Takeover pelo celular pausa a IA (fromMe + !wasSentByApi → shadow), commit 35c8b8e

**Trigger:** dono relatou o problema real — quando o atendente pega o celular e responde o lead direto, a IA continua respondendo e atrapalha vendedor e lead. Discussão de cenário das 3 direções (incoming / outgoing helpdesk / fromMe celular). Dono colou o fluxo n8n atual e escolheu Opção A (flip → shadow) + implementar agora. **Rodava processo paralelo** → toquei só em `whatsapp-webhook/index.ts` + `_shared/aiRuntime.ts(.test)`, sem encostar em `ai-agent/index.ts`/`agent/*`.

**Achado de raiz:** a premissa documentada no código (`whatsapp-webhook:1361`, `aiRuntime:133`) de que **"n8n filtra wasSentByApi"** é FALSA — o fluxo `eletropiso_2026` só tem Webhook→HTTP Request repassando `$json.body` cru, sem filtro. O webhook ignorava `message.wasSentByApi`. Logo, takeover humano nunca pausava a IA: `fromMe` bloqueia ai-agent, mas `status_ia='ligada'` (não shadow) também bloqueia a extração → mensagem só gravada, IA seguia respondendo a próxima do lead.

**Fix na fonte:** novo helper determinístico `shouldPauseAiForHumanTakeover({fromMe,wasSentByApi,statusIa})` (true só se `fromMe && !wasSentByApi && ligada`); webhook lê `wasSentByApi`, flipa `ligada→shadow` + broadcast pro Helpdesk; `shouldTriggerShadowFromWebhook` ganhou guard `wasSentByApi===true→false` (não extrai eco da própria API). Shadow = IA cala mas segue extraindo memória (`ai-agent:1194-1349` retorna sem enviar). **8 testes novos, 30/30 verdes**, zero erro TS novo (4 erros deno são dívida pré-existente: `instance.user_id`, `.catch` PromiseLike — fora do diff). Deploy CLI prod `whatsapp-webhook`.

**Achados anotados (não-fix):** (1) religar IA é manual (toggle Helpdesk / reabertura) — falta regra automática "religar após X h de silêncio do vendedor"; (2) n8n repassa o eco das próprias mensagens da IA (`fromMe:true,wasSentByApi:true`) → dedup por external_id provavelmente não pega (IA grava `ai_agent_<ts>` vs messageid real) → possível linha `outgoing` duplicada. Memória: [[project_human_takeover_phone_pause_ai]].

**Frase de retomada:** *"Takeover pelo celular SHIPPED (commit 35c8b8e, deploy prod). Validar E2E real: vendedor responde pelo celular → IA cala. Investigar achado: eco da IA criando outgoing duplicado (n8n sem filtro). Depois: regra auto-religar IA pós-silêncio?"*

---

## 2026-05-25 (tarde) — Cart Engine premium #2: pedido estruturado + transbordo itemizado (v7.53.0)

**Trigger:** dono pediu explicação do premium #2 (formato de discussão), escolheu Opção A (carrinho em JSONB na conversa, sempre-ligado), aprovou escopo "tudo Fases 1-4 + sandbox E2E". Mapeei os pontos de integração com Explore agent antes de codar (plano aprovado).

**Implementação:** migration `conversations.cart_items JSONB` (padrão runtime do shown_product_ids; sem SYNC RULE, sem regen de types — via cast). `_shared/agent/cart.ts` helpers puros (normalize/merge/applyUpdate/subtotal/formatCartSummary itemizado/formatCartOneLine). **Design final `set_cart`** (1 tool, substitui o pedido pela lista completa, idempotente) em specialistTools + `tools/cartTools.ts`. Plugada no product specialist (6→7 tools) + regras 8/9/9b. **Transbordo itemizado:** handoff_to_human + exit_action inline + via deferida (dispatchResponse) anexam resumo itemizado+total ao reason do vendedor + linha compacta personalizada (nome+itens) pro lead.

**E2E real dirigido por mim (UAZAPI lead 558185749970→agente sandbox 558181696546, polling DB) — NOTA 10:** saudação→qualif(ambiente)→produto(send_media)→"quero 2 latas"(set_cart [tinta:2])→"adiciona 1 rolo"(set_cart [tinta:2,rolo:1], SEM dobrar)→"tira o rolo"(set_cart [tinta:2])→"é só isso, passa pro vendedor"(handoff_to_human). Vendedor (Rafaella, round-robin) recebeu reason "🛒 Pedido (2 itens): • 2x Tinta...Coral — R$ 1584,00"; lead recebeu "João, anotei seu pedido: 2x Tinta...".

**3 bugs achados NO E2E e corrigidos na fonte (zero gambiarra):** (1) **502** — objeto aninhado de `add_to_cart` sem `additionalProperties:false` (OpenAI strict exige em aninhado; llmProvider só injeta na raiz) → 400→retry→502; (2) **double-count + race** — semântica ADD/merge + 2 cart calls paralelas num turno → item perdido. Fix de RAIZ: pivô pra **SET** (set_cart substitui, alinha com o modelo que re-declara o pedido inteiro) + cart tools em `sideEffectTools` (sequencial); (3) handoff via via deferida não tinha o carrinho → inject também lá. 18 cart + 415 agent verdes, deno 0, ~5 deploys CLI iterativos. Sandbox revertido (extended_hours→null, conversa limpa).

**Decisão (contagem/jargão pro lead):** dono perguntou se o agente pode vazar "achei 40 produtos" / "afunilar" ao lead, ou se resolver já. **Auditei o código:** NÃO existe esse risco hoje — falha de busca já é blindada (`[INTERNO — NÃO mostre]`, "lead NUNCA deve saber que falhou", proibido "não temos"); sucesso já vem com teto (≤5 do carrossel, `MÚLTIPLOS PRODUTOS (N)` é contagem pequena, não "40"). O "achei 40/afunilar" só nasceria AO construir o #3. **Sem fix agora** (não há bug ativo; regra fora de contexto incharia o prompt). Guardrail gravado em [[feedback_no_internal_count_or_jargon_to_lead]] pra entrar embutido no #3 (contagem = sinal interno; lead recebe pergunta consultiva natural, zero jargão). Residual aceitável: LLM pode dizer "encontrei 3 opções" (número pequeno, soa natural).

**Frase de retomada:** *"v7.53.0 Cart Engine SHIPPED + E2E nota 10 (set_cart, transbordo itemizado em prod). Próximo premium #3 refino-por-contagem JÁ com o guardrail [[feedback_no_internal_count_or_jargon_to_lead]] embutido (contagem=sinal interno, sem jargão); depois #4 modo consultivo, #5 busca facetada. Achado cosmético: nome às vezes trunca 'João'→'Jo' no 1º uso do greeting."*

---

## 2026-05-25 (tarde) — Fix crash mobile "removeChild" no Atendimento (lang="en" → pt-BR)

**Trigger:** dono mandou 3 screenshots — desktop OK, mas no Chrome Android o Helpdesk quebrava com Error Boundary "Erro em Atendimento: Falha ao executar 'removeChild' em 'Node'". Pediu auditoria profunda.

**Causa raiz (NÃO era bug nosso):** `index.html` declarava `<html lang="en">` (resíduo do scaffold Lovable) num app 100% pt-BR. Chrome mobile vê o mismatch idioma-conteúdo → **auto-traduz**, envolvendo nós de texto em `<font>` e trocando-os. React ainda referencia os nós antigos; na transição mobile lista→chat (`HelpDesk.tsx` `setMobileView('chat')`, swap condicional de blocos irmãos 565-594) o React chama `removeChild` no nó que o Translate já moveu → `DOMException` → capturado pelo boundary `App.tsx:234`. Issue canônico facebook/react#11538. Desktop não quebra (não auto-traduz + não desmonta subárvore ao navegar).

**Fix na fonte:** `<html lang="pt-BR">` (mata o gatilho da tradução) + `<meta name="google" content="notranslate">` (defensivo). Zero mudança no render do React — o padrão condicional é idiomático e correto. Bônus: a11y (leitor de tela) + SEO. Reproduzido e validado com React 18.3.1 real via Playwright (com mutação `<font>` = crash idêntico; sem = limpo). **Shipped** (commit `d7bf315`): build CI ok → redeploy Portainer (204) → prod servindo `lang="pt-BR"` verificado via curl.

**Follow-up — CI schema-parity verde de novo (commit `05566b9`):** o "Vault & Schema Healthcheck" estava vermelho (3 mismatches, pré-existentes ao removeChild). Auditados contra `information_schema` de prod: (1) `conversations.board_id/column_id` = **falso-positivo do checker** (a query real é `kanban_cards`, que tem ambas; o regex atravessava outro `.from(` entre `.from()` e `.select()` → corrigido p/ não cruzar); (2) `poll_responses.conversation_id` **não existe** → trocado p/ `contact_id` (NPS do vendedor voltava 400→sempre 0); (3) `v_lead_metrics.avg_ticket` é `average_ticket` → corrigido (ticket médio voltava 400→sempre 0). Os 2 KPIs do painel do vendedor voltaram a calcular. CI verde + build + redeploy. **Só 2 arquivos tocados, add por nome (sem `-A`/`--amend`)** — respeito à sessão paralela do cart engine rodando junto.

---

## 2026-05-25 — Fix achado #2 early-return silencioso na fonte + observability + badge "fora de horário" (v7.52.4)

**Trigger:** dono pediu (1) abrir localhost + ler vault/doc + status; (2) atacar o achado #2 (early-return silencioso, frase de retomada), **auditando antes**; (3) no meio, via screenshot, perguntou por que o badge mostrava "Alberto (pausado)" se logado como Alberto ele não estava pausado; (4) "faça os dois". Deploy escolhido: **direto em prod**.

**Auditoria (achado #2):** mapeei todos os early-returns entre as linhas 127–2182 do `ai-agent/index.ts` (router/`logRouterRun`→`ai_agent_runs` só roda a partir de ~2182, então qualquer return antes = sintoma exato: rápido, sem `ai_agent_runs`, sem resposta). **Causa raiz: `duplicate_response_guard` (~1508).** Ele existe pra barrar retry do debounce, mas só perguntava "mandei resposta real nos últimos 15s?" — sem distinguir retry (mesmo input) de **follow-up novo**. Lead manda 2ª msg 2s após o bot responder → debounce processa lote separado → guard acha a resposta do turno anterior nos 15s → **descarta silenciosamente**. Bate 577ms (só queries), sem `ai_agent_runs` (pré-router), e — crucial — **não grava nem `ai_agent_logs`** (só `log.info`), por isso a sessão anterior não achou rastro. **Achado secundário:** o prefixo `ai_oof_` no filtro do guard é **código morto** (grep no repo: só aparece na linha do filtro, nunca é atribuído) → msg de fora-horário contava como resposta real (origem do "fora-de-horário" no cenário).

**Fix na fonte:** guard agora pega `created_at` da última resposta real + `created_at` da última msg incoming; bloqueia **só** se `lastResponseAt >= lastIncomingAt` (já respondemos a entrada mais recente → retry). Se há msg do lead mais nova → processa (follow-up). Robusto pro cenário "msg chega depois da resposta". **Observability:** `recordEarlyReturn(reason, extra)` persiste em `ai_agent_logs` (`event='early_return'`) nos returns silenciosos pré-router (duplicate_guard/greeting_rpc_error/greeting_duplicate). Migration `20260525000000` adiciona o event ao CHECK (R88).

**Badge fila (UX):** descoberto que "(pausado)" no badge vem de `handoff_queue_events.paused_at`, setado SÓ pelo cron `requeue-conversations` Case B (horário fechou) — **NÃO** é a pausa pessoal do atendente (`department_members.queue_paused` / botão header). Colisão de palavra confundia o gestor. `ConversationItem.tsx`: badge fora-horário agora é ícone de relógio + "(fora de horário)" + tooltip. Removido import `Pause` órfão.

**Validação + deploy:** `deno check ai-agent/index.ts` limpo. Vitest 1398 pass / 9 fails **pré-existentes** (FormBuilder, useForms, e testes `_shared` de detecção que importam módulos Deno — vitest não resolve; zero overlap com os 3 arquivos tocados). Migration aplicada em prod (`prfcbfumyrrycsrcrvms`) e constraint conferido (`has_early_return=true`). **ai-agent deployado via CLI** (token em `~/.claude.json`; MCP proibido por causa dos imports `_shared`). Commit `5884681` + push → CI rebuilda o frontend (badge). Deploy escolhido: direto em prod (sem E2E na sandbox).

**Frase de retomada:** *"v7.52.4 SHIPPED (guard na fonte + observability early_return + badge fora-de-horário; migration+edge fn+front em prod). Depois: validar `ai_agent_logs event=early_return` aparecendo em prod (próximo follow-up real) + premium #2 cart engine."*

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

## 2026-05-24 (noite II) — Auditoria qualify-first + fix de gênero no score (superada por v7.50.0)

> Auditoria que originou o `qualificationGate` (4 decisores rivais buscar-vs-qualificar sem fonte única → MAST) + fix de gênero/plural no `fieldAutoExtractor` (branca→cor:branco; score parou de travar). Tudo capturado no v7.50.0 (noite III) abaixo.

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

## 2026-05-24 (tarde/manhã) — v7.48.0 latência + v7.47.0 saudação router + E2E jornada 9/10 (arquivado)

> Detalhe em CHANGELOG + git. v7.48.0: latência product specialist (2 rounds→1 via pré-busca `runInlineSearchProducts`+`preSearchContext`, ~6s). v7.47.0: saudação/reconhecimento migrados pro router (`greetingPolicy.ts` fonte única, bloco determinístico religado, decisão A). E2E jornada router 6 turnos nota 9/10; gaps em [[project_router_parity_gaps]].

---

## 2026-05-24 (madrugada) — Sprint C 3/3 (v7.44.0) + fix PROD EletropisoV2 (v7.44.1) (arquivado)

> Movido pra [[wiki/log-arquivo-2026-05-23-sprintc]] (hard limit 300). C6 E2E 7/7 + C7 dashboard Roteamento + 2 bugs raiz (gpt-5-mini resposta vazia, objeção atropelada por qualif) + canal de controle WhatsApp; v7.44.1 EletropisoV2 gpt-5-mini→gpt-4.1-mini.

---

## 2026-05-23 — Sprint C (arquivado)

> 4 entradas (iniciado v7.42.0 → parcial 2/3 v7.43.0 → auditoria hardening v7.42.1 → hardening E2E 9 bugs v7.43.13) movidas pra [[wiki/log-arquivo-2026-05-23-sprintc]] (hard limit 300).

---

## 2026-05-24 (noite+madrugada) — Sprint D + EletropisoV2 router PROD + E.1 memória longa (arquivado)

> Movido pra [[wiki/log-arquivo-2026-05-24-sprintd-e1]] (hard limit 300). v7.45.0 (router despacha 7 intents pra specialists dedicados + specialistBase + shadow + E2E 6/6, 72%→~85%); v7.45.1 (EletropisoV2→router PROD + 36 erros TS zerados); v7.46.0 (Sprint E.1 memória longa estruturada por lead).

---

