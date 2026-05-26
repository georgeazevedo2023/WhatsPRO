---
title: Changelog
type: changelog
updated: 2026-05-21
audited_at: 2026-05-21
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.53.0 (2026-05-25) — Cart Engine (premium #2): pedido estruturado + resumo itemizado no transbordo

Premium #2 do backlog consultivo. Antes o pedido multi-item vivia como texto livre raspado pro reason do handoff — frágil (sem subtotal, sem edição, sem cross-sell). Agora há um **motor de pedido estruturado** por conversa. SDR: monta o pedido e entrega itemizado ao vendedor; **sem checkout/pagamento** (isso é o M11 separado).

- **Schema:** `conversations.cart_items JSONB` (migration `20260525120000`) — `[{product_id,name,qty,unit_price,added_at}]`. Estado runtime da conversa, padrão do `shown_product_ids` (não dispara SYNC RULE; acessado via cast, sem regen de types — como o shown_product_ids).
- **Helpers puros** (`_shared/agent/cart.ts`, 18 testes): `mergeCartItems` (soma itens iguais por id/nome), `applyCartUpdate` (set_qty/remove/clear), `cartSubtotal`, `formatCartSummary` (itemizado + total) e `formatCartOneLine` (compacto pro lead).
- **Tools novas (strict)** `add_to_cart` / `update_cart` em `specialistTools.ts`; dispatch `dispatchCartTool` (`tools/cartTools.ts`) lê/escreve `cart_items` e devolve o resumo pro LLM ecoar. Plugadas no product specialist (8 tools agora) + regras de prompt 8/9/9b (montar / fechar / cross-sell determinístico, sem inventar produto).
- **Transbordo itemizado:** quando o carrinho não está vazio, `handoff_to_human` (e o exit_action inline) usam a linha compacta no texto ao lead e **anexam o resumo itemizado + total** ao reason que o vendedor recebe (e em `ai_agent_logs.metadata`).
- **Validação:** 18 testes cart + 415 agent verdes, `deno check` 0. Deployado (sandbox + EletropisoV2, função compartilhada; aditivo — handoff idêntico ao anterior quando carrinho vazio). **E2E LLM multi-turno na sandbox: PENDENTE** (requer o celular do lead sandbox — feito junto com o dono).

---

### v7.52.4 (2026-05-25) — Fix achado #2 (early-return silencioso) na fonte + observability + badge "fora de horário"

Fecha o achado #2 deferido na v7.52.3: a 2ª msg do lead enviada ~2s após uma resposta caía no **`duplicate_response_guard`** e retornava **silenciosamente** (sem `ai_agent_runs`, sem resposta, sem rastro em tabela nenhuma — só `log.info`). Causa raiz confirmada por auditoria de código.

- **Fix na fonte (`ai-agent/index.ts`):** o guard existe pra barrar **retry do debounce** (mesmo input 2x), não follow-up legítimo. Antes bloqueava QUALQUER processamento dentro de 15s de uma resposta real → derrubava a 2ª msg. Agora só bloqueia se a última resposta real veio **depois** da mensagem de entrada mais recente do lead (= retry); se há msg do lead mais nova que a resposta → **processa** (follow-up genuíno). Achado secundário documentado: o prefixo `ai_oof_` no filtro era **código morto** (nunca atribuído) — origem do "fora-de-horário" no cenário.
- **Observability (`recordEarlyReturn` + migration `20260525000000`):** persiste o motivo de saída dos early-returns pré-router em `ai_agent_logs` (`event='early_return'` + `latency_ms` + metadata). Cobre duplicate_guard / greeting_rpc_error / greeting_duplicate (empty_response já gravava). Novo event adicionado ao CHECK constraint (evita R88, INSERT silencioso falho).
- **UX badge da fila (`ConversationItem.tsx`):** o badge "Em fila — {nome} (pausado)" colidia com o toggle pessoal "Pausar/Disponível" do atendente e confundia o gestor. O `paused_at` do `handoff_queue_events` é setado SÓ pelo cron `requeue-conversations` (Case B = **horário fechou**), não tem relação com a pausa do atendente. Agora mostra ícone de **relógio** + **"(fora de horário)"** + tooltip explicando que é o rodízio congelado fora-de-horário.

---

### v7.52.3 (2026-05-24) — 1 produto = foto única com legenda (send_media), não carrossel

Fecha o achado recorrente: 1 produto com ≥2 fotos virava **carrossel multi-foto** (parecia vários produtos). Regra do dono: **1 produto = `send/media` (1ª foto + legenda título/preço); 2+ produtos = carrossel**.

- **`searchProducts.ts`**: removido o branch "1 produto multi-foto → carrossel" (~125 lin). Agora todo caso de 1 produto cai no `send/media` com a 1ª imagem + legenda `"{título}\nR$ {preço}"` (formato confirmado na doc UAZAPI `/send/media`: `{number, type:"image", file, text}`). Import órfão `generateCarouselCopies` removido.
- **E2E real validado:** "quero cuba de apoio quadrada" → chega **foto única** (`media_type=image`) com legenda "Cuba de Apoio Quadrada Branco – Luzarte\nR$ 119.90" + texto consultivo. Antes vinha carrossel. 69 testes verdes, deno 0, deploy CLI.
- **Achado #2 deferido (não-fix):** stall ao mandar 2ª msg ~2s após resposta de um turno que atingiu score, fora-de-horário → ai-agent early-returna sem output (recupera na retry). Investigado: não é msg perdida no debounce (a msg É processada, 577ms, mas early-return silencioso pré-router). Causa exata exige mais tracing; impacto real baixo. Resume pra próxima sessão.

---

### v7.52.2 (2026-05-24) — Fix leak `_fora_hora` no transbordo + validação E2E (2 cenários + loop da fila)

E2E real (sandbox router) descobriu 1 leak: o handoff forçado fora-de-horário (R120) monta o reason como `"{texto}_fora_hora"` e o sufixo de código ficava COLADO na última palavra, vazando pro lead ("...parede interna**_fora_hora**"). `cleanHandoffItem` agora remove sufixos de código conhecidos (`_fora_hora`/`_sem_resultado`/`_offline`…) e qualquer cauda snake_case colada. +1 teste (39 total).

**Validação E2E (2 cenários):** (1) fora-de-horário → transbordo personalizado nome+item; (2) dentro do horário (extended) → saudação→nome→carrossel 3 tintas→1 produto→multi-item→resumo→handoff. **Loop da fila validado nota 10** (dept sandbox 3 membros, timeout 1min): avança a cada 00:00, **vira do último (pos3) pro primeiro (pos1)**, continua ciclando, alerta gestor "fila deu volta completa". Sem bug na mecânica do loop. Achados anotados (não-fix): 1-produto sai como carrossel (não send_media); stall ao trocar de categoria após score em turno fora-de-horário.

---

### v7.52.1 (2026-05-24) — Visibilidade do atendente vira controlável pelos toggles do admin (revisa v7.52.0)

Ajuste após o dono perguntar "pra atendente não ver não atribuídas/todas, é só desmarcar no painel?". A v7.52.0 tinha uma **regra dura** (role agente sempre só "Minhas", ignorando os toggles) — o que deixava os 3 toggles de "Visibilidade de conversas" do UsersTab **mortos** pra atendente. Modelo escolhido pelo dono: **os toggles mandam** (flexível).

- **Removida a regra dura** em `useHelpdeskInboxes` — volta a honrar os flags `can_view_*`. Default na ausência de valor agora é **false** (era true) → least privilege.
- **Defaults por papel no UsersTab** (`ROLE_DEFAULT_VISIBILITY`): ao adicionar/criar membro ou trocar papel, `agente`→tudo false (só Minhas), `gestor`→não-atribuídas+todas-no-depto, `admin`→global. Admin libera/restringe caso a caso pelos toggles depois.
- **Default das colunas** `inbox_users.can_view_unassigned`/`can_view_all_in_dept` → **false** (migration `20260524190000`, safe-by-default mesmo em inserts fora da UI). `can_view_all` já era false.
- Resultado: desmarcar (ou marcar) os toggles no painel admin controla de verdade o que o atendente vê; atendente novo já nasce restrito a "Minhas".

---

### v7.52.0 (2026-05-24) — Atendente só vê "Minhas" + fila ON (timeout 10min) + paridade UI

Pedido do dono (EletropisoV2 prod): atendentes não devem mais ver conversas não atribuídas/de outros; ativar a fila; subir o timeout de rodízio.

- **Atendente (role `agente`) só vê a aba "Minhas"** — `useHelpdeskInboxes` agora lê `role` e força `canViewUnassigned/canViewAllInDept/canViewAll = false` para `agente`, independente dos flags no banco (durável até pra atendentes novos, cujo default de `can_view_unassigned` é true). `gestor`/`admin` seguem honrando os flags granulares. DB: flags zerados pros 14 agentes existentes (consistência de dados). As tabs "Não atribuídas"/"Todas" somem; só gestor/admin as veem.
- **Fila ativada** no dept Vendas (EletropisoV2): `queue_mode_enabled=true`. Handoffs entram em round-robin entre os 7 atendentes (queue_position 10-70 atribuídas) e caem na aba "Minhas" de cada um.
- **Timeout de rodízio 5 → 10 min** — `departments.queue_mode_timeout_minutes=10` no dept + default da coluna 5→10 (migration `20260524180000`) + `TIMEOUT_DEFAULT` 5→10 no `QueueConfig.tsx` (paridade: o painel admin abre mostrando 10 e novos depts começam em 10).

---

### v7.51.0 (2026-05-24) — Transbordo personalizado (nome+item) + anti-repetição de nome + strip bare tool-call

Fecha o backlog #4 (msg fora-horário personalizada) e o feedback do dono ("o nome repete em toda mensagem"). E2E real prod (sandbox router + EletropisoV2): fluxo completo saudação→qualif→score→carrossel→multi-item→resumo→transbordo, nota 10.

- **#4 Transbordo personalizado** — `personalizeHandoffMessage` (novo, `businessHours.ts`, 11 testes): prefixa a msg de transbordo com `"{Nome}, anotei seu pedido: {item}."` citando o primeiro nome + o item/pedido. `cleanHandoffItem` extrai só a parte legível do `reason` (escrito pro vendedor): tira prefixo "Pedido completo:"/"Pedido de", pega só a 1ª frase (descarta meta-notas tipo "Lead já confirmou…"), descarta códigos snake_case ("telha_fora_hora"), cap 160 (cabe multi-item). Aplicado nos **8 paths de handoff** (handoff_to_human tool, set_tags inline E3, sale_closed, trigger, message-limit, validator, exit-action E2, exitActionDispatcher) — cada um threada `leadName` (+ `itemSummary` quando há reason rico). No-op gracioso sem nome/item.
- **Config msg fora-horário** (sandbox + EletropisoV2 prod): texto + janela de horário, sem "Anotei seu pedido" (que duplicava com o prefixo dinâmico).
- **P7-strong anti-repetição de nome** — `buildNameUsageDirective` (novo, `greetingPolicy.ts`, 6 testes): determinístico (olha msgs do bot no histórico); se o primeiro nome apareceu nas últimas 2 mensagens do bot, injeta diretiva de SUPRESSÃO no prompt do specialist. Resultado E2E: nome caiu de **7/9 → 1/5 mensagens** (concentrado em saudação/fechamento). Wire no `specialistBase` (vale pra todos os specialists).
- **Strip bare tool-call leak** — `stripLeakedToolCalls` agora pega `functions.NOME` SEM parênteses (gpt-4.1 vazou `functions.handoff_to_human` solto no fim da msg). O prefixo `functions.` é sinal forte. +1 teste.
- **E2E real:** sandbox router (lead 558185749970 → agente 558181696546) fluxo lâmpada completo + EletropisoV2 prod validado pelo dono ("George, anotei seu pedido: 1 lâmpada LED amarela 12W, bulbo tradicional, para quarto, 220V. No momento estamos fora…"). 930 testes (4 fails pré-existentes), deno 0, deploys CLI.

---

### v7.50.1 (2026-05-24) — Captura determinística de nome (P5) + auditoria de atendimento real

Auditoria de atendimento real V2 (George: "Olá"→"George"+"Qual preço de telha brasilit 244x110"→handoff seco). **Diagnóstico inicial errado** (culpei o gatilho "preço", mas o código já o pula em perguntas); a raiz real (achada nos `ai_agent_runs`): **"telha" não era categoria** → search 0 resultados + fora-de-horário → R120 handoff forçado; e o nome "George" se perdia (product specialist não chamava `update_lead_profile`).

- **P5 captura determinística de nome** — `nameCapture.ts` (`extractLeadName`+`wasNameAsked`, 7 testes). Pré-router: se a última msg do bot foi o pedido de nome e `full_name` é null, extrai e persiste o nome (inclusive bundled "George\nQual preço...") sem depender do LLM (regra de prompt era ignorada + estourava o teto de 4KB).
- **Categoria `telhas` (offline)** (sandbox+V2) — loja vende, faltava cadastro → qualifica+handoff rico (como piso cerâmico). R120 mantido (correto pra produto genuinamente inexistente). Fix do gatilho "preço" **descartado** (não estava quebrado — zero gambiarra).
- **E2E sandbox (fora-de-horário, replica George) nota 10:** nome capturado + telha reconhecida + consultivo; "50 telhas, é só isso"→handoff rico + msg fora-horário + fila. 1391 testes verdes.

---

### v7.50.0 (2026-05-24) — qualificationGate: fonte única buscar-vs-qualificar (qualify-first)

Fecha o último 🔴 arquitetural: "buscar ou qualificar primeiro?" estava em **4 decisores rivais sem fonte de verdade**. Agora há **1 decisor determinístico** (`_shared/agent/qualificationGate.ts`, 12 testes) que lê o MESMO stage engine do score: modos `qualify` (score < limiar→qualifica), `search` (score ≥ limiar→busca), `qualify_then_handoff` (offline), `no_category`.

- **Wire no dispatch do router** (`ai-agent/index.ts`): pra `produto`/`qualificacao` o gate é AUTORIDADE. `qualify`→qualification_specialist (acumula score, suprime pré-busca); `search`→product_specialist mesmo se router disse qualificacao (honra exit_action quando lead responde curto "branco"); `offline`→product (qualifica+handoff).
- **Fix R146:** `so_se_pedir` caía no cap de **8 msgs** (igual `apos_n_msgs`, contra o contrato "lead controla, max alto") → cortava fluxo consultivo. Default → **40**.
- **Fix R147:** handoff specialist gpt-4.1-mini vazava tool call como TEXTO (`functions.handoff_to_human({...})`) → handoff não executava + lead via sintaxe crua. → **gpt-4.1** + `stripLeakedToolCalls` (defesa, 5 testes).
- **E2E prod (sandbox router) 10 cenários nota 10:** novo/recorrente, dá/não nome, catálogo/offline/inexistente, qualif contada, handoff rico, msg transbordo, fila round-robin. 1404 testes verdes.

---

### v7.49.1 (2026-05-24) — Fix: score de qualificação não acumulava (flexão de gênero/plural)

O `fieldAutoExtractor` casava os `examples` com word-boundary EXATO → "branca" não casava o field cor ("branco"), "fosca" não casava acabamento ("fosco"). Resultado: campos de qualificação ditos pelo lead **não eram capturados e o `lead_score` nunca acumulava** (achado no E2E qualify-first). Fix: `buildCandidateRegex` flexiona a vogal final o/a + plural (`branc[oa]s?`, `fosc[oa]s?`); conservador (só mexe em terminação o/a; "coral"/"inox" intactos). E2E: score 15→50, ambiente/cor/acabamento capturados. 386 testes verdes.

**Nota:** tentativa de gating qualify-first por threshold no dispatch foi **revertida** (gambiarra — era um 5º decisor de "buscar vs qualificar"). Auditoria identificou a raiz: 4 decisores rivais sem fonte única. Fix de raiz = `qualificationGate.ts` (próxima sessão). Ver `log.md`.

---

### v7.49.0 (2026-05-24) — Carousel batching: "mais opções" / "nenhuma dessas" (lote novo sem repetir)

Premium gap #1 dos cenários consultivos (21.27-21.29): quando o lead rejeitava o carrossel ("nenhuma dessas") ou pedia mais, não havia 2º lote — repetia os mesmos ou travava. Agora o agente mostra um **lote NOVO excluindo os já vistos**, e quando esgota oferece refinar/categoria/consultor (sem inventar produto).

- **Migration** `conversations.shown_product_ids text[]` — rastreia produtos exibidos em carrosséis NESTA conversa.
- **`searchProducts.ts`**: exclui `shown_product_ids` dos resultados; **cap de 5 cards/lote** (`MAX_CARDS_PER_BATCH`, era até 10 — habilita o "lote 2" e evita despejar 10 de uma vez); persiste os IDs enviados (dedupe); quando a exclusão zera, retorna `[INTERNO]` instruindo o specialist a NÃO inventar e oferecer alternativas.
- **`router.ts`**: intent `produto` agora cobre "nenhuma dessas / tem outras? / quero ver mais / não gostei".
- **`productSpecialist.ts`**: regra 6b — em rejeição/pedido de mais, re-chama `search_products` (exclusão automática) ou, se esgotou, oferece refinar/categoria/consultor.
- **2 bugs raiz achados e corrigidos NO E2E (sem gambiarra):** (1) a query do catálogo não selecionava `id` → exclusão/persistência eram no-op silencioso; (2) o `conversations` era carregado sem `shown_product_ids` → exclusão não via os já-mostrados entre turnos. Ambos resolvidos na fonte (select + select).
- **E2E real sandbox router (3 estados, nota 10):** lote 1 "vcs têm tinta?" → carrossel de 5 (cap) + persiste 5; lote 2 "nenhuma dessas, tem outras?" → router→produto, exclui os 5, mostra **2 produtos DIFERENTES** + texto consultivo, persiste 5→7; esgotado "tem mais?" → SEM carrossel, "essas eram todas as opções, posso refinar por cor/tipo/marca, ver outra categoria ou chamar um consultor". (Catálogo de teste ampliado temporariamente p/ 7 tintas durante o E2E, depois removido.)
- **366 testes agent verdes** (+4 batching). deno check 0. Deploy CLI no ai-agent (EletropisoV2 PROD + sandbox).

---

### v7.48.0 (2026-05-24) — Latência do product specialist: pré-busca determinística (2 rounds → 1)

Fecha a única regressão real da auditoria de paridade: o product specialist gastava **~8-16s** em turnos com `search_products` (vs ~2.5s sem busca). Causa raiz medida nos `ai_agent_runs` reais: **2 rounds de LLM** (round 1 só pra "decidir" chamar a tool → executa busca + envia carrossel → round 2 pra compor). O monolito era rápido (1-3s) porque buscava ANTES do LLM (R121/R137 inline); esse pré-search foi **desligado sob router** (`skipR121`) por causa de um bug de carrossel duplicado.

- **Fix de raiz (não gambiarra):** re-liga o pré-search **para o product specialist**, injetando o resultado como `preSearchContext` no fim do prompt → o specialist compõe em **1 round**. Duplo carrossel é estruturalmente impossível: a flag `carouselSentInThisCall` (compartilhada via `executeToolSafe`) faz o `search_products` retornar "JÁ ENVIADO" se o LLM insistir.
- **`specialistBase.ts`** — novo campo `preSearchContext` no `SpecialistCtx`, injetado no system prompt (após memória + prompt base).
- **`productSpecialist.ts`** — `deriveProductSearchParams()` (cobertura > pendingExitActionSearch: deriva categoria por interesse-tag/texto, só DIGITAL, nunca quando lead já recebeu produtos) + `cleanProductQuery()`.
- **`index.ts`** — captura a busca decidida pré-LLM (`routerProductPreSearch`) só pro product specialist (mantém `pendingExitActionSearch` nulo pros demais → set_tags handler não religa busca); roda `runInlineSearchProducts` antes do specialist e passa `preSearchContext`.
- **Bug exposto + corrigido no E2E:** a pré-busca com query crua ("**vocês têm** tinta acrílica fosca?") achava 0 produtos (stopwords) → escalava pra handoff espúrio. `cleanProductQuery` stripa saudação + verbo interrogativo no início (família `stripLeadNameSuffix` R137/R138) → query limpa acha produto. Sem isso, seria regressão de qualidade vs o LLM (que limpa a query sozinho).
- **E2E real (sandbox Eletropiso router, 3 cenários, nota 10):** "vcs têm tinta branca?" (cold) → greeting + carrossel + resposta; "tinta acrílica fosca" (isolado) → carrossel + "Temos sim! ...R$427,90... Qual dessas opções atende melhor?"; "tinta coral branca fosca" (cold+marca) → carrossel + resposta consultiva. **Product hop ~6s (era ~8-16s), 1 search, 1 round LLM, 1 carrossel.**
- **362 testes agent verdes** (+15: 9 `deriveProductSearchParams` + 6 `cleanProductQuery`). deno check 0. Deploy CLI no ai-agent (afeta EletropisoV2 PROD + sandbox — ambos router).

---

### v7.47.0 (2026-05-24) — Saudação/reconhecimento migrados pro router (decisão A)

Fecha o defeito #2 da auditoria de paridade: sob `routing_mode='router'`, a saudação configurada era pulada (`index.ts:1373`) e o lead frio que abria com produto (ex.: "vcs têm tinta?") caía direto no product specialist — sem boas-vindas, sem citar a loja, sem pedir o nome. Validado ao vivo na prod (EletropisoV2 respondendo "Tudo bem? Me conta..." genérico).

- **Novo `_shared/agent/greetingPolicy.ts`** — fonte ÚNICA `classifyLeadRecency()` (novo/recorrente/ativo, 3 sinais) + `buildOpeningDirective()`. Monolith e router leem daqui (acabou o drift). 13 testes.
- **`index.ts`** — bloco de saudação determinístico RELIGADO no router pro 1º contato (antes só monolith). Garante a saudação configurada SEMPRE (cita "Eletropiso" + pede nome via `greeting_message`); se a msg trouxe produto, segue pro product specialist responder (saudação + produto). `shouldGreet`/`isReturningLead` agora derivam de `classifyLeadRecency` (fonte única).
- **`productSpecialist.ts`** — `update_lead_profile` trocada pela tool COMPARTILHADA (`specialistTools`): ganha `full_name` + `city` (antes só `name`, sem cidade — não conseguia salvar nome/cidade ditos junto com produto).
- **Decisão de arquitetura:** tentamos injetar "diretiva de abertura" no prompt do specialist, mas (a) o product specialist ignorava o cumprimento (fluxo de tool dominava) e (b) a regra "registre o nome além de responder" causava resposta DUPLICADA. Por isso a saudação é determinística (confiável) e o specialist fica com prompt limpo.
- **Validação E2E sandbox:** cold-open "bom dia, vcs têm tinta branca?" → "Olá! Bem-vindo a Eletropiso, com quem eu falo?" + carrossel + descrição (1 resposta, sem duplicar). 347 testes agent verdes, deno check 0 erros. Deploy CLI no EletropisoV2 (prod).
- **Follow-ups conhecidos:** persistência de nome mid-conversa (P5) ainda não confiável (LLM usa o nome no texto mas não chama a tool — precisa extração determinística); saudação não espelha "bom dia" (usa texto fixo configurado); retomada de memória do recorrente (P2-A) pendente. Demais defeitos da auditoria (#1 search stall, #4 handoff por keyword sem resumo, #6 validator nos specialists) seguem em backlog.

---

### v7.46.0 (2026-05-24) — Sprint E.1: memória longa por lead (injeção + consolidação)

Primeiro pilar do Sprint E (inteligência avançada). Lead que volta após dias é reconhecido com histórico. Decisão arquitetural fundamentada em pesquisa (Mem0 arXiv:2504.19413 + Zep arXiv:2501.13956 + LangMem): **memória ESTRUTURADA, não vector RAG** — domínio de vendas bounded + Postgres já presente = structured-facts vence em exatidão/custo/latência/RTBF. `lead_profiles` já era a tabela (full_name/interests/objections/conversation_summaries/...); faltava wiring.

- **Migration `20260524120000`** (aditiva): `lead_profiles.products_seen jsonb`, `qualification_stage text`, `memory_updated_at timestamptz` (validity timestamp, ideia Zep).
- **`leadMemory.ts` — `buildLeadMemoryBlock(leadProfile)`**: monta bloco compacto key:value (~150-250 tokens: Nome/Interesses/Estágio/Produtos vistos/Objeções/Orçamento/Resumo/Última visita) injetado no TOPO do system prompt de TODO specialist via `specialistBase`. Vazio pra lead novo. "Retrieval > ingestion": injeta poucos fatos relevantes, não o transcript. Anti-poisoning: só fatos semânticos, nunca regras procedurais.
- **`consolidateLeadMemory`** (fire-and-forget pós-resposta, SEM LLM): deriva `qualification_stage` das tags, extrai `products_seen` do toolCallsLog real (search/carousel/media), captura `interests` do tag `interesse:`, grava com merge+dedupe + `memory_updated_at`. Só fatos verificados (anti-poisoning). Não bloqueia o turno (resposta já enviada no dispatchResponse).
- **Resume de qualificação**: o bloco de memória diz "Qualificação parou em: X" + "não pergunte o que já sabe" → specialist não refaz campos. Greeting refinado pra returning lead (cumprimenta pelo nome + referencia interesse pra retomar).
- **E2E real**: turno 1 (lead "sou o Carlos, queria tinta branca") → product+carrossel, consolidação gravou products_seen (3 tintas) + stage=tintas. Turno 2 (retorno, conversa limpa, lead_profiles mantido) → bloco de memória injetado (prompt 1767→2765 chars), greeting reconheceu o lead.
- **334 testes agent verdes** (329 Sprint D + 5 leadMemory). deno check ai-agent: 0 erros. Tudo aditivo; isolamento tenant/lead via RLS existente do lead_profiles (risco #1 multi-agente: vazamento entre leads).

### v7.45.1 (2026-05-24) — EletropisoV2 → router em PROD + zera 36 erros TS

- **EletropisoV2 (`1062059a`) migrado pra `routing_mode='router'` em PROD** (a pedido do usuário, sem shadow). Config validada compatível (24 service_categories + business_info + greeting → os 5 specialists rodam). Código idêntico ao validado 6/6 no sandbox. Rollback instantâneo (`routing_mode='monolith'`). Monitoramento via dashboard Roteamento + `ai_agent_runs`. Evidência pró-migração: no histórico monolito, perguntas de produto ("telha brasilit") recebiam "Em que posso te ajudar?" genérico — router+product_specialist busca no catálogo.
- **36 erros TS pré-existentes do `ai-agent/index.ts` zerados (`deno check`: 36 → 0).** Type-only, zero runtime, vitest sem regressão (1318 pass / 9 fails pré-existentes). Fixes: `SendTextMsgFn`→`Promise<void|boolean>`; `SendPresenceFn`→union literal; `Logger.meta`→`object` (logger.ts + context.ts); casts `any` em conversation/contact/instance/counterRow/greetResult (selects nullable+shape); `pfq` local pro CFA never; `loadActiveProfile(supabase as any)` (TS2589); `wordByWordBroadProducts!`; `insert(payload as any)`. (whatsapp-webhook tem 4 erros pré-existentes próprios, fora de escopo.)

### v7.45.0 (2026-05-24) — Sprint D: 4 specialists dedicados + specialistBase + shadow mode + 6/6 E2E nota 10

Fecha a parte de código do Sprint D do plano orquestrador: o router agora despacha as **7 intents pra specialists dedicados** (não mais só o product). Monolito vira fallback de erro. Tudo atrás de `routing_mode` (default `monolith`, prod intocada). Andamento do plano: 72% → **~85%**.

- **`_shared/agent/specialistBase.ts` — contrato único.** Extraído do `productSpecialist` (~140 lin de boilerplate: LLM loop → log `ai_agent_runs` → `dispatchResponse`). `runSpecialist(ctx, def)` recebe um `SpecialistDef { name, intent, model, buildPrompt, toolDefs, disableHandoffGuard }`. `productSpecialist` refatorado pra delegar (18/18 testes seguem verdes, zero regressão). Cada novo specialist é só prompt + tools + boundary → zero drift.
- **4 specialists novos** (`greetingSpecialist`, `qualificationSpecialist`, `objectionSpecialist`, `handoffSpecialist`) + `specialistTools.ts` (tool defs canônicas compartilhadas). Prompt design fundamentado em pesquisa 2026 (OpenAI/Anthropic/MAST): role estreito, boundary explícito, regra-chave por último, instrução positiva + porquê, escape hatch anti-arg-inventado, **REGRA UNIVERSAL "sempre responda com texto; tool nunca substitui a resposta"**, feel-felt-found (objection), SPIN 1-pergunta (qualification).
- **Tabela de dispatch intent→specialist** (`index.ts`): saudacao+fora_escopo→greeting, qualificacao→qualification, produto→product, objecao+pagamento→objection, handoff→handoff. Whitelist declarada (best practice handoff targets). Greeting determinístico hardcoded **desligado sob `routing_mode='router'`** (greeting_specialist assume — plano D4).
- **Shadow mode** (`routing_mode='shadow'`, migration `20260524100000`): router classifica + loga em `ai_agent_runs`, mas o monolito responde o lead (zero efeito colateral — lite shadow, só o router roda; specialist não, pra não disparar tools reais). UI Select + SYNC. Best practice shadow→canary→% antes de migrar default.
- **2 bugs de raiz achados no E2E e corrigidos:** (A) greeting capturava nome via `set_tags(lead_name:)` → **rejeitado** pelo whitelist `VALID_KEYS` → trocado p/ `update_lead_profile(full_name)` (persiste de verdade). (B) objection chamava tools e **não emitia texto** (lead no silêncio) → regra universal de texto aplicada aos 4 specialists.
- **E2E real 6/6 nota 10** (sandbox router `558181696546`, lead Testador): bom dia→greeting, "meu nome é João Pedro"→greeting+persiste nome, "tinta branca pra sala"→product+carrossel, "achei caro/concorrente"→objection (feel-felt-found), "quero vendedor"→handoff (transbordo+fora-horário), "aceita pix/parcela?"→objection (business_info). Router conf 0.9-1.0 em todas.
- **350 testes agent verdes** (329 + 21 novos). Zero erro TS novo (36 pré-existentes, confirmado via baseline). ai-agent deployado (v123+).
- **Migração default→router: STAGED.** Default segue `monolith`; EletropisoV2 prod intocada. Migração real só após shadow limpo + go-ahead. Aposentar monolito (D6) fica p/ sprint futura após 30d estável.

### v7.44.1 (2026-05-24) — Fix PROD: EletropisoV2 gpt-5-mini → gpt-4.1-mini

EletropisoV2 (`1062059a`, instância nova do Lucas `558781592373`, monolith) estava em **gpt-5-mini** com `max_tokens=1024` — mesmo Bug A da v7.44.0 (reasoning consumia o teto → resposta vazia → fallback "Em que posso te ajudar?"). Trocada p/ **gpt-4.1-mini** (non-reasoning, rápido, confiável). Config no banco (efeito imediato; o piso 4096 de reasoning já estava deployado como defesa). Validação passiva na próxima msg real (não testei ao vivo p/ não interferir em cliente). Eletropiso antiga (agent desabilitado D35) segue em gpt-4.1-mini.

### v7.44.0 (2026-05-23/24) — Sprint C 3/3: C6 E2E 7/7 + C7 dashboard Roteamento + 2 bugs raiz + canal de controle WhatsApp

Fecha o Sprint C. Validação E2E real dos 7 intents do router (lead↔IA, instâncias reais), dashboard admin de roteamento, e 2 bugs de raiz achados nos testes. Andamento do plano orquestrador: 68% → **~72%**.

- **C6 — E2E 7/7 nota 10.** Runner formal `scripts/e2e-router-runner.mjs` + `scripts/e2e-scenarios.json` (gated por env, fora do CI). Cada cenário com reset frio do lead. Relatório: [[wiki/relatorio-e2e-router-2026-05-23]]. saudacao (handler determinístico), qualificacao/produto/handoff/objecao (router→product_specialist gpt-4.1), pagamento/fora_escopo (router→monolith gpt-4.1-mini).
- **C7 — Dashboard admin "Roteamento".** RPC `get_router_dashboard` (SECURITY DEFINER, guard `is_super_admin`) agrega `ai_agent_runs`: pizza de intents, latência P50/P95 por specialist, custo/modelo, hop loops, volume diário. Frontend `src/pages/dashboard/AdminRouting.tsx` (recharts) + rota `admin/routing` + item no Sidebar. Validado com dados reais.
- **Bug A (raiz) — gpt-5-mini devolvia resposta VAZIA → fallback "Em que posso te ajudar?".** `llmProvider.ts` passava `max_completion_tokens = agent.max_tokens (1024)` pra reasoning models; o raciocínio consumia o teto e a resposta saía vazia. **Afetava EletropisoV2 em PROD.** Fix: piso `Math.max(maxTokens, 4096)` p/ reasoning. Monolith do agent de teste migrado p/ `gpt-4.1-mini` (gpt-5-mini@4096 funcionava mas 15-25s, lento demais).
- **Bug B (raiz) — objeção atropelada por qualificação.** Monolith respondia "achei caro" com "interno ou externo?". Fix: `objecao` adicionada a `salesFunnelIntents` (roteia pro product_specialist) + **regra 10** de objeção no prompt do specialist (empatia + defesa de valor, sem desconto automático, pedido aberto). Validado E2E: "Entendo sua preocupação... rendimento/cobertura/durabilidade/garantia... PIX/12x... continuar ou ver outras opções?".
- **Canal de controle WhatsApp.** Edge function `e2e-control-webhook` (verify_jwt=false) + tabela `e2e_control_inbox`: operador comanda a sessão via WhatsApp (instância Testador). Achado UAZAPI: webhook manda remetente como `@lid` interno; número real está em `sender_pn`/`chatid`.
- **Pendência PROD:** EletropisoV2 (`1062059a`, gpt-5-mini monolith, max_tokens=1024) deve migrar p/ gpt-4.1-mini OU já recebeu o floor no deploy do ai-agent (mitiga vazio, mas fica lento). Recomendado migrar modelo.

### v7.43.1→v7.43.13 (2026-05-23) — Sprint C hardening: 9 bugs raiz + 6/6 cenários E2E nota 10

Sessão longa de validação E2E real (2 instâncias UAZAPI conversando entre si: Testador `558185749970` → Eletropiso sandbox `558181696546`). Fechou 9 bugs **de raiz** (zero remendos) + escolha de modelo por benchmark + decisão arquitetural do router pipeline.

- **Bug 4 — specialist falhava silenciosamente (502).** `set_tags` tool def usava `additionalProperties:{type:'string'}` (map) — viola OpenAI strict mode (deve ser `false`) E divergia do handler (espera `string[]`). OpenAI 400 → `callLLM` fazia fallback cego pro Gemini → Gemini 400 → 502. **Fix:** schema `set_tags` = array of strings (alinhado com monolith) + `callLLM` bloqueia fallback Gemini em erro 4xx (`OpenAI_CLIENT_ERROR`) + log explícito do erro OpenAI.
- **Bug 5 — gpt-5-mini queimava budget em reasoning, response vazio.** Resolvido pela escolha de modelo (abaixo).
- **Escolha de modelo por benchmark real.** 5 modelos × 5 cenários Eletropiso: gpt-4.1-mini, gpt-4.1, gpt-5.4, gpt-5.5, gpt-5-mini. Todos 50/50 com prompt v3. **Specialist = `gpt-4.1`** (full, non-reasoning): qualidade de redação 10/10, latência ~2s, custo ~$53/mês. Router = `gpt-4.1-mini`.
- **Prompt do specialist v1→v6.** Linguagem natural (não XML) + 9 situações explícitas + regra universal "toda tool vem com texto" + anti-loop + **regra 8 PEDIDO COMPLETO** (pergunta "mais algum item?" antes de escalar) + **regra 9 FECHAMENTO** (handoff com resumo do pedido) + qualificação de item offline antes de escalar.
- **Bug 6 — 2 carrosseis.** R121 inline search (pré-LLM) + product_specialist chamavam search em paralelo. **Fix raiz:** R121 desligado quando `routing_mode='router'`.
- **Bug 7 — produto vago classificado como qualificacao.** Router separava por "tem detalhes ou não" (ambíguo). **Fix:** menção a produto/categoria/marca = sempre `produto`; `qualificacao` só pra resposta de campo já perguntado.
- **Bug 8 — R129/R136 multi-interesse curto-circuitavam o router.** **Fix raiz:** desligados sob router.
- **Bug 9 — não qualificava item offline / não montava pedido.** Lead com produto escolhido + pede trena → escalava direto. **Fix:** prompt v5/v6 qualifica + monta pedido completo.
- **Bug 10a — qualificacao caía no monolith genérico** ("qual ferramenta?" ignorando "trena"). **Fix raiz:** intent `qualificacao` também roteia pro product_specialist.
- **Bug 10b — auto-extract handoff prematuro.** Curto-circuito pré-LLM escalava no meio do fluxo. **Fix raiz:** desligado sob router.
- **Bug 11 — handoff final genérico** ("Em que posso te ajudar?"). **Fix raiz:** product_specialist ganhou `handoff_to_human` (6 tools) + intent `handoff` roteia pro specialist + regra 9 (escala com resumo).
- **Bug 12 — handoffGuard bloqueava fechamento.** Guard exigia `search_products` no turno atual; no fechamento multi-turn a busca foi turnos antes. **Fix raiz:** `disableHandoffGuard` no product_specialist (ele controla fechamento via prompt regra 9; guard protege só o monolith).
- **3 remendos REMOVIDOS** (a pedido do user, anti-gambiarra): `priorToolsCalled` no prompt, `maxTokens 2048` override, fallback contextual de response vazio.

**Decisão arquitetural (raiz):** com apenas product_specialist no Sprint C, ele é **dono do funil de venda completo** (produto + qualificacao + handoff). Todos os curto-circuitos pré-LLM do monolith (R121, R129, R136, auto-extract handoff) ficam **desligados sob `routing_mode='router'`** — eliminam caminhos paralelos conflitantes em vez de patchar comunicação. Sprint D refina com qualification/handoff specialists dedicados.

- **Validação E2E real:** 6/6 cenários nota 10 (preço+marca, click "Eu quero", categoria offline, marca inexistente, multi-produto, handoff) + cenário 7 venda completa multi-turn (carrossel → upsell trena → qualificação → pedido completo 3 itens → fechamento via `handoff_to_human` com resumo).
- **Pipeline:** tsc 0 erros · vitest **331 pass** suite agent · deploy CLI ai-agent v104→**v116 ACTIVE**.

**Andamento plano orquestrador:** mantém **68%** (Sprint C parcial 2/3 agora sólido, sem gambiarras). Falta C6 E2E formal + C7 dashboard Roteamento.

### v7.43.0 (2026-05-23) — Sprint C parcial 2/3: product_specialist + hop guard + wire-in

**Primeiro specialist em prod (POC).** Wire-in do router pipeline atrás de feature flag `routing_mode='router'`. Default monolith preservado — zero impacto comportamental até admin ativar router em um agent.

- **`_shared/agent/productSpecialist.ts` (380 lin):** `runProductSpecialist(ctx)` orquestra prompt enxuto (~3 KB target) + LLM loop (reusa `llmCallLoop.ts` da Onda 4) + dispatch (reusa `dispatchResponse.ts` da Onda 5). Prompt builder dinâmico: persona + 7 rules + 5 tools strict (search_products, send_carousel, send_media, set_tags, update_lead_profile) + catalog_summary (marca offline) + facts_collected (filtra tags internas). Default model `gpt-5-mini`.
- **`_shared/agent/hopGuard.ts` (~100 lin):** `checkHopLimit(ctx)` consulta `ai_agent_runs` por turn_id; bloqueia se >= maxHops (default 2 = router + specialist). Defensivo: DB error → allow=true (não bloqueia pipeline por monitoring offline). `generateTurnId()` UUID v4.
- **Wire-in `ai-agent/index.ts`:** novo bloco ANTES do monolith. Se `agent.routing_mode === 'router'`: gera turn_id → checkHopLimit → classifyIntent → logRouterRun → dispatch por intent. Apenas `intent='produto'` tem specialist; outras intents fazem fallthrough pro monolith com log. Erro no router pipeline = fallback automático pro monolith.
- **Testes:** `productSpecialist.test.ts` 15 PASS (persona, offline flag, facts filter, tools strict, sizes) + `hopGuard.test.ts` 8 PASS (allow hop 0/1, block hop 2, custom maxHops, DB error defensive, UUID v4 valid).
- **Migração modelo Eletropiso V2:** `gpt-4.1-mini` → `gpt-5-mini` via UPDATE direto (bug #1 fechado em v7.42.1, agora seguro). Sandbox Agent já em gpt-5-mini.
- **Pipeline:** tsc 0 erros · vitest **1282 pass / 9 fails pré-existentes idênticos** (+23 novos) · deploy CLI ai-agent v103→**v104 ACTIVE**.

**Estado:** primeiro carro do orquestrador está montado. Falta ligar — admin precisa setar `routing_mode='router'` em algum agent pra validar E2E. POC ainda só cobre intent='produto'; outras 6 intents (saudacao/qualificacao/handoff/objecao/pagamento/fora_escopo) fazem fallback pro monolith.

**Andamento plano orquestrador:** 63% → **68%**.

### v7.42.1 (2026-05-23) — Auditoria pós-Sprint-C-parcial-1: fecha 3 gaps (A+B+C)

Auditoria honesta da v7.42.0 identificou 3 gaps; todos fechados nesta release. Sem nova feature visual pro lead — hardening que torna Sprint C4 viável.

- **Fix B (crítico):** `_shared/llmProvider.ts` ganhou helper `isReasoningModel(model)` (regex `^(gpt-5|o1|o3|o4)\b`) + branch reasoning-model-aware no `callOpenAI`: usa `max_completion_tokens` em vez de `max_tokens` + omite `temperature` (gpt-5/o-series rejeitam custom temp). Sem este fix, router gpt-5-nano sempre caía no catch silencioso → 100% fallback `qualificacao` em prod. Bug latente desde Sprint A I3 (2026-05-21). **21 testes novos** `llmProvider.test.ts` cobrindo família + edge cases (case-insensitive, prefix boundary).
- **Fix C (cobertura):** `router.test.ts` ganhou 2 testes pegos na auditoria: `confidence` retornado como string `"0.9"` → typeof number falha → fallback qualificacao; 2 JSON objects balanceados → parser pega substring entre `{` e `}` → JSON inválido → fallback. Total router: **23/23 PASS**.
- **Fix A (UX):** novo Select "Modo de Roteamento" na tab Setup do `AIAgentTab.tsx`, visível só pra super_admin. Opções Monolito (recomendado) / Router POC (experimental) com aviso visual amarelo ao escolher Router. Antes era editável só via SQL/MCP.
- **Pipeline:** tsc 0 erros · vitest **1259 pass / 9 fails pré-existentes idênticos** (+23 novos: 21 isReasoningModel + 2 router edge cases) · deploy CLI ai-agent v102→**v103 ACTIVE**.

**Estado:** Sprint C parcial 1 (router + DB) **agora está completo de verdade**. Router pode ser ativado por agent sem fallback silencioso. Próxima sessão (Sprint C4) começa do estado limpo.

### v7.42.0 (2026-05-23) — Sprint C parcial 1/3: Foundations + Router LLM (NOVO MARCO)

Início do Sprint C — router LLM + product_specialist POC. Esta entrega cobre C1+C2+C3 (foundations + router em isolamento). Prod intocada (default `routing_mode='monolith'`).

- **Migration C1:** tabela `ai_agent_runs` aplicada em prod (trace por hop do router → specialist). 11 colunas: conversation_id, agent_id, turn_id, hop_n, specialist (CHECK 9 valores), intent, confidence, model, tokens, latency_ms, tools_called, prompt_chars, metadata. 2 índices (conv+created DESC, agent+specialist+created DESC). RLS enabled (service_role only — dashboard Sprint C7 vai via RPC SECURITY DEFINER).
- **Migration C3:** coluna `ai_agents.routing_mode TEXT NOT NULL DEFAULT 'monolith' CHECK IN ('monolith','router')`. Index parcial WHERE routing_mode <> 'monolith' (dashboard "quantos agents em router?"). `'routing_mode'` adicionado em ALLOWED_FIELDS do AIAgentTab.tsx.
- **Router LLM:** `_shared/agent/router.ts` (~280 lin) exporta `classifyIntent(ctx)` + `logRouterRun(supabase, ...)` + constante `ROUTER_SYSTEM_PROMPT` (~800 chars XML-style). Modelo padrão `gpt-5-nano` (alvo <500ms, ~$0.0001/turno). Output JSON estrito com 7 intents (saudacao/qualificacao/produto/handoff/objecao/pagamento/fora_escopo).
- **Defesa em profundidade:** parser tolera JSON puro / markdown fence ```json``` / texto extra envolvente. Fallback determinístico pra `qualificacao` em 4 cenários: parse JSON falhou / intent inválido / confidence < 0.6 (override mesmo com intent válido) / LLM exception. Sempre retorna `RouterResult` válido — pipeline nunca quebra.
- **Testes:** `router.test.ts` **21 testes 100% PASS**: 7 intents × happy, defesa (5 fallbacks), construção prompt (system+user+tags+history), routerModel override, history truncado em 5, `logRouterRun` INSERT correto + non-fatal em DB failure.
- **types.ts regenerado** via MCP (project prfcbfumyrrycsrcrvms) — `ai_agent_runs` + `routing_mode` agora tipados.
- **Pipeline:** tsc 0 erros · vitest **1236 pass / 9 fails pré-existentes idênticos** (+21 novos) · deploy CLI ai-agent v101→**v102 ACTIVE**

**Próximos passos do Sprint C (próximas sessões):**
- **C4** — product_specialist (~60 lin, ~3 KB prompt) reusa tools/searchProducts.ts
- **C5** — hop guard anti-loop (max 2 hops)
- **C6** — E2E sandbox 10 cenários comparativos monolith vs router
- **C7** — dashboard admin "Roteamento" (intents/latência/custo/accuracy)

**Andamento plano orquestrador:** 60% → **63%** (Sprint C foundations + 1/4 do router work).

### v7.41.15 → v7.41.16 (2026-05-22) — Sprint B5 Ondas 4-5 (`llmCallLoop` + `dispatchResponse`, FIM DO SPLIT) (arquivada)

Últimas 2 ondas do Sprint B5: extrai `llmCallLoop` (-184 lin) e `dispatchResponse` (-188 lin) do monolito. **Sprint B5 FECHADO** (11 ondas, `ai-agent/index.ts` 4544→~2306 lin, -49.3%). 56%→**60%**. Detalhe em git + [[wiki/changelog/2026-05-part10]].

### v7.41.7 → v7.41.14 (2026-05-22) — Sessão maratona R140-R145 (arquivada)

8 versões atacando o crash Sandrielly: R140 (stack trace, o divisor) → R141 (TDZ `carouselSentInThisCall`, causa real) → R142 chain rica → R143 seed sem fields → R144 fuzzy auto-correct → R145 v3 dedup+startTime barrier. Detalhe em [[wiki/erros/familias-r-codes]] + git.

---

## 📦 Releases anteriores (v7.41.6 e abaixo) arquivadas

Detalhe em [[wiki/changelog/2026-05-part10]] + histórico git (hard limit 300 linhas). Inclui v7.41.6 (R138+R137 v2 sanitiza query PostgREST), v7.41.4 (R137 v1 revertido), v7.41.3→v7.41.0 (Sprint B5 ondas 3a-3d).

