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

### v7.50.0 (2026-05-24) — qualificationGate: fonte única buscar-vs-qualificar (fluxo consultivo qualify-first)

Fecha o último 🔴 arquitetural: a decisão "buscar produto ou qualificar primeiro?" estava em **4 decisores rivais sem fonte de verdade** (stage engine, detectIncomingSearchSignal/R121, deriveProductSearchParams, LLM). Sob router, o product specialist criava caminho de busca paralelo que ignorava o estado de qualificação → "tem porcelanato?" caía em busca/qualif confusa. Agora há **1 decisor determinístico**.

- **`_shared/agent/qualificationGate.ts`** (novo, 12 testes): `evaluateQualificationGate` lê o MESMO stage engine que governa o score e responde se o lead está pronto pra buscar. Modos: `qualify` (digital, score < limiar de busca → qualifica), `search` (score >= limiar → busca), `qualify_then_handoff` (offline → qualifica + handoff, nunca busca), `no_category` (respeita o router). NUNCA lança (degrade → ready).
- **Wire no dispatch do router** (`ai-agent/index.ts`): para intents `produto`/`qualificacao`, o gate é a AUTORIDADE. `qualify` → redireciona pro qualification_specialist (pergunta o próximo campo, acumula score, suprime pré-busca). `search` → força product_specialist mesmo que o router tenha dito 'qualificacao' (honra `exit_action=search_products` do stage quando o lead responde curto tipo "branco"). `offline` → product_specialist (qualifica + handoff).
- **Fix de raiz exposto pelo qualify-first:** `so_se_pedir` (handoff_rule default) caía no cap de **8 mensagens** — IGUAL ao `apos_n_msgs`, contradizendo o contrato documentado ("lead controla, max muito alto"). Fluxos consultivos (qualify-first = +turnos) eram cortados por handoff genérico antes do fechamento. Default sobe pra **40** (safety net alto, configurável).
- **Fix handoff specialist:** era gpt-4.1-mini, que **vazou a tool call como TEXTO** (`functions.handoff_to_human({...})` na mensagem) em vez de invocá-la → handoff não acontecia + lead via sintaxe crua. Subido pra **gpt-4.1** (chama tools com confiança). Defesa: `stripLeakedToolCalls` em dispatchResponse remove vazamento residual (no-op em texto legítimo; 5 testes).
- **E2E real em produção (sandbox router), 10 cenários nota 10:** lead novo/recorrente + saudação nova/retorno; dá nome/não dá; produto no catálogo (qualify-first 3 perguntas→carrossel); produto offline (lâmpada led → qualifica+handoff rico); produto inexistente (honesto+alternativa); transbordo com relatório rico ao vendedor; mensagem de transbordo; fila (round-robin Lucas→Rafaella). 1404 testes verdes, deno 0.

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

### v7.41.16 (2026-05-22 noite IV) — Sprint B5 Onda 5: extrai `dispatchResponse` (FIM DO SPLIT B5)

Última extração do Sprint B5: steps 15.5-22 + final log/Response 200 do `ai-agent/index.ts` pra `_shared/agent/dispatchResponse.ts`.

- **Arquivo novo:** `_shared/agent/dispatchResponse.ts` (348 lin) — handoff detection (HANDOFF_PATTERNS copiado pra escopo do módulo), TTS decision tree, save msg + update conv + broadcast, response_sent log, lead_profile upsert, deferred handoff trigger, Response 200 build.
- **Testes novos:** `dispatchResponse.test.ts` (**15 testes, 100% PASS**): happy text/audio paths, TTS fallback, audio split, incomingHasAudio flag, hadExplicitHandoffInLoop skip, broadcast SHADOW, implicit handoff detection (+ negative lookbehind test "não vou te encaminhar"), deferred trigger paths (objection detection + skip quando já houve explícito), summary com products/sentiment/outcome/tools, slice -10 nas conversation_summaries.
- **index.ts: 2494 → 2306 lin (-188 nesta onda).** Acumulado Sprint B5: **-2238 lin desde 4544 (-49.3%)**. Imports limpos: removidos `splitAudioAndText` (só usado no bloco extraído) + `HANDOFF_PATTERNS` const local.
- **Sprint B5 FECHADO** com 11 ondas: 0+1, 2a, 2b, 2c-i, 2c-ii, 3a, 3b, 3c, 3d, 4, 5. `ai-agent/index.ts` virou orquestrador de ~2300 lin (de 4544).
- **Pipeline:** tsc 0 erros · vitest **1215 pass / 9 fails pré-existentes idênticos** (+15 novos) · deploy CLI ai-agent v100→**v101 ACTIVE**

**Andamento plano orquestrador:** 56% → **60%** (Sprint B5 100% completo). Próximo marco: **Sprint C — Router LLM + product_specialist POC** (~2-3 semanas).

### v7.41.15 (2026-05-22 noite III) — Sprint B5 Onda 4: extrai `llmCallLoop`

Extração do loop principal de function calling do monolito `ai-agent/index.ts` pra `_shared/agent/llmCallLoop.ts`. Inclui setup (geminiContents→llmMessages), while loop (LLM call → tool execution seq/parallel → handoff guard → MAX_TOOL_ROUNDS safety → retry backoff → 502 em 3 falhas → pending Qs injection + follow-up call), e post-LLM cleanup (dedup nome + greeting strip Bug 17 v2).

- **Arquivo novo:** `_shared/agent/llmCallLoop.ts` (327 lin) com `runLlmCallLoop(ctx)` + interface `LlmCallLoopCtx`/`LlmCallLoopResult`
- **Testes novos:** `llmCallLoop.test.ts` (16 testes, todos PASS): happy paths, tool calls seq/parallel, handoff break, handoff guard block (bug latente do monolito preservado linha-a-linha), MAX_TOOL_ROUNDS, retry/backoff, error 502, pending Qs (injection + follow-up), dedup nome, greeting strip, token ceiling
- **index.ts:** 2678 → 2494 lin (**-184 lin nesta onda**). Acumulado Sprint B5: **-2050 lin desde 4544 (-45.1%)**. Imports limpos: removidos `appendToolResults`, `LLMMessage`, `evaluateHandoffGuard`, `HANDOFF_GUARD_BLOCKED_MSG` (todos só usados no bloco extraído). Adicionado import único `runLlmCallLoop`.
- **`executeToolSafe` permanece em `ai-agent/index.ts`** (também usado por R121 inline + R137 wire + set_tags handler — keeping evita refator cross-cutting). Injetado via ctx.
- **`toolCallsLog` ref mutável** compartilhada entre pre-LLM (R121/R137) e loop — padrão idêntico ao de setTagsAndHandoff/searchProducts.
- **Validator + question mark guard** stayed em index.ts mas saíram do wrapper `while`: antes da Onda 4 ficavam dentro do loop com `break` final; agora rodam linearmente após o helper.
- **Pipeline:** tsc 0 erros · vitest **1200 pass / 9 fails pré-existentes idênticos** (+16 novos) · deploy CLI ai-agent v99→**v100 ACTIVE**

**Andamento plano orquestrador:** 53% → **56%** (Onda 4 fechada). Próximas:
- Onda 5 — `dispatchResponse` (~240 lin) — última do split B5
- Sprint C — Router LLM + product_specialist POC (~2-3 semanas, marco)

### v7.41.7 → v7.41.14 (2026-05-22 noite II) — Sessão maratona R140-R145

**8 versões em ~6 horas** atacando bug Sandrielly definitivamente. ai-agent v89→v99 ACTIVE.

| Versão | R# | Resultado |
|---|---|---|
| v7.41.7 | R139 (regex) + **R140 (stack trace)** | R140 foi o divisor — sem ele eu chutava |
| v7.41.8 | **R141 TDZ** | causa REAL do crash: `let carouselSentInThisCall` em linha 1928 referenciado por `executeTool` em linha 1751 → ReferenceError pré-LLM. Movido pra linha 497 |
| v7.41.9 | R142 chain rica | buildQualificationChain inclui ambiente/cor/voltagem/volume |
| v7.41.10 | R143 seed sem fields | preLLMAutoExtract persiste interesse:CAT mesmo se extracted=[] (caso Jessica) |
| v7.41.11 | R144 fuzzy I2 | auto-correct singular↔plural/regex/levenshtein-1 antes de bloquear |
| v7.41.12 | R145 v1 dedup | falso-positivo (60s window) — SUPERSEDIDA |
| v7.41.13 | R145 v2 + ia_cleared | ainda bloqueava (placeholder) — SUPERSEDIDA |
| v7.41.14 | **R145 v3** | + startTime barrier → finalmente correto |

**Lição central:** R140 (observability) deveria ter sido v7.41.5 não v7.41.7. Stack trace persistido em `ai_agent_logs.error` revelou TDZ em 1 query — sem isso eu testei 2 hipóteses erradas (vírgula, regex unicode).

**Doc cleanup (commit 5082784):**
- Nova wiki `wiki/erros/familias-r-codes.md` (205 lin) agrupa ~140 R# em 10 famílias
- `regras-preventivas.md`: + R137-R145, status [RESOLVIDA]/[SUPERSEDIDA], fix R86/R87 duplicados
- index.md: pointer pra famílias

**Pipeline final:** tsc 0 · vitest 1184 pass / 9 fails pré-existentes · ai-agent v99 ACTIVE · 8 camadas determinísticas protegendo qualif→handoff.

**Frase de retomada próxima sessão:** *"continuar Sprint B5 Onda 4 llmCallLoop após valida cenários Jessica/Wsmart em prod"*.

---

### v7.41.6 (2026-05-22) — R138 + R137 v2: sanitiza query antes de PostgREST + 6 integration tests reais

Versão definitiva do fix Sandrielly, depois de **v7.41.4 quebrar em prod** (search crashou ao rodar inline com query ruidosa contendo vírgulas) e **v7.41.5 reverter** (volta loop original).

**Causa raiz descoberta em prod (`ai_agent_logs` da conv 5b78ee46-b861):**
- R137 wire (v7.41.4) construía query `"iquine por quanto esta a tinta pintalar da , de 3,6l? com george"` direto do texto do lead.
- `searchProducts.ts:277` passa essa query pra `.or('title.ilike.%VALUE%,description.ilike.%VALUE%,...')` da PostgREST.
- `escapeLike` em `agentHelpers.ts:172` só escapa `%`, `_`, `\` — **NÃO escapa `,`**.
- Vírgula no `VALUE` quebra parser PostgREST `.or()` (`,` é o separator). 400 Bad Request → throw → `executeToolSafe` retorna *"Erro interno ao executar search_products"* → LLM perde caminho viável → handoff sem qualif.
- Bug é pré-existente (qualquer query LLM com vírgula crashava), mas R137 expôs ao construir query bruta.

**Fix em 2 camadas (defesa profunda):**
- **Camada 1 — `searchProducts.ts`**: novo helper exportado `cleanSearchQuery(raw)` strip de `, ; : " ' ? ! ( ) [ ] { }` → espaço + colapsa whitespace. Aplicado no entry: `args.query` e `args.category` sanitizados ANTES de qualquer uso. Protege contra LLM mandando vírgulas (rare) E callers internos (R137 wire) passando texto bruto.
- **Camada 2 — `preLLMAutoExtract.ts`**: R137 wire re-adicionado COM sanitização:
  - `stripLeadNameSuffix(query)` remove `com X`, `meu nome é X`, `sou X` do final
  - `cleanSearchQuery(stripped)` strip punctuation
  - `buildSearchQuery(...)` combina com tags existentes
  - `cleanSearchQuery(combined)` 2ª passada (defesa)
  - Skip se query < 2 chars após cleanup

**Testes integration NOVOS (`r137-integration.test.ts`, 6 cenários):**
1. Sandrielly EXATO inside hours catálogo vazio → R137 dispara + search sem crash + PATH A enrichment
2. Sandrielly EXATO outside hours catálogo vazio → R137 dispara + search sem crash + R120 handoff
3. "Quanto custa a Coral fosca?" (marca isolada sem verbo) → R137 brand_mentioned + search limpo
4. "Preciso de tinta acrílica fosca" (R121 verboso) → R121 inline > R137 + search limpo
5. "Boa tarde, tudo bem?" (saudação pura) → no_signal, R137 NÃO dispara
6. REGRESSÃO: query EXATA do log prod 22:13:09 não causa crash em `.or()`

**Supabase mock realístico** que rejeita malformed `.or()` exatamente como PostgREST 400 — se code passar vírgula/parênteses/"?" pro filter, teste falha.

**Vitest:** +6 integration scenarios + 8 unit tests cleanSearchQuery + 2 sanitization tests = **+16 testes novos**. Suite total: 1165 pass / 9 fail pré-existentes idênticos. tsc 0.

**Deploy:** ai-agent v89→**v90 (revert R137 v7.41.4)**→**v91 ACTIVE (R138+R137 v2)** via CLI. SHA `f869b307...` novo. verify_jwt:false preservado.

**Lição aprendida (autocrítica honesta):**
- v7.41.4 testou R137 isoladamente em `preLLMAutoExtract.test.ts`, mas NÃO exercitou o caminho real `runInlineSearchProducts → dispatchSearchTool → searchProducts → .or() do PostgREST`. Mocks de teste eram limpos demais.
- Bug pré-existente do `escapeLike` ficou latente desde sempre — só apareceu quando R137 passou query ruidosa.
- v7.41.6 introduziu mock de supabase que **simula a rejeição PostgREST**, garantindo que regressão futura é detectada antes de prod.

**Frase de retomada:** *"executar B5 Onda 4 llmCallLoop"*.

---

### v7.41.4 (2026-05-22) — R137 v1 (REVERTIDO — bug crash em prod)

Primeira tentativa do R137 wire. Crashou em prod no caso Sandrielly (1 ocorrência). Causa: query bruta com vírgulas/`?` quebrou PostgREST `.or()`. Reverteu na v7.41.5, re-implementado correto na v7.41.6.

---

## 📦 Releases anteriores (v7.41.3 e abaixo — Sprint B5 ondas 3a-3d) arquivadas em 2026-05-23

Movidas pra [[wiki/changelog/2026-05-part10]] (hard limit 300 linhas). Conteúdo: v7.41.3 (Onda 3d set_tags+handoff), v7.41.2 (Onda 3c searchProducts), v7.41.1 (Onda 3b crmTools), v7.41.0 (Onda 3a mediaTools).

