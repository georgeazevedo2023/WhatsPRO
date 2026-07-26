---
title: AI Agent — O Cérebro (Router + 5 Specialists) e as 9 Ferramentas
tags: [ai-agent, router, specialists, llm, tools, qualification-gate, greeting-policy, handoff, d6, fallback-gracioso]
sources:
  - supabase/functions/_shared/agent/router.ts
  - supabase/functions/_shared/agent/routerPipeline.ts
  - supabase/functions/_shared/agent/hopGuard.ts
  - supabase/functions/_shared/agent/specialistBase.ts
  - supabase/functions/_shared/agent/specialistTools.ts
  - supabase/functions/_shared/agent/qualificationGate.ts
  - supabase/functions/_shared/agent/greetingPolicy.ts
  - supabase/functions/_shared/agent/responseSanitizer.ts
  - supabase/functions/_shared/constants.ts
  - supabase/functions/ai-agent/index.ts
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
updated: 2026-07-26
audited_at: 2026-07-26
---

# AI Agent — O Cérebro (Router + 5 Specialists) e as 9 Ferramentas

> Sub-wiki extraído de `ai-agent-detalhado.md`. Cobre o "como pensa" (router que classifica) e "como age" (specialists + ferramentas) do agente.

## 1. Visão geral — porteiro + 5 especialistas

**Didático:** imagine uma loja com um **recepcionista** na porta. Ele não vende nada — só ouve a primeira frase do cliente e decide para qual **balcão** mandar: "quer só dar oi", "ainda está pesquisando", "quer um produto específico", "está reclamando do preço", ou "quer falar com um vendedor de verdade". Cada balcão tem um especialista treinado só para aquele momento. Esse recepcionista é o **router**; os balcões são os **5 specialists**.

**Técnico:** o agente roda em pipeline de **2 saltos (hops)** — `routerPipeline.ts` chama `classifyIntent` (router LLM, hop 0) e despacha para um **specialist** (hop 1). Desde o **D6 (2026-07-25, `ai-agent` v277)** esse pipeline é o **único cérebro**: não há mais gate de modo nem mega-prompt alternativo. Todo agente — EletropisoV2 em prod incluído — passa por router + specialists em **todo** turno.

---

## 2. O router LLM — o recepcionista

**Didático:** o recepcionista é rápido e barato — ele não escreve a resposta, só decide o destino numa palavra. Se ele ficar em dúvida ou travar, ele tem uma regra de ouro: **na dúvida, manda qualificar** (o balcão que faz perguntas), porque qualificar nunca estraga a conversa.

**Técnico:** `classifyIntent` (router.ts) usa `ctx.routerModel || DEFAULT_ROUTER_MODEL`. O pipeline NÃO passa `routerModel`, então o modelo vivo é **`gpt-4.1-mini`** (`constants.ts:20`). O comentário no código confirma a troca: `gpt-5-nano` (reasoning) falhava o parse de JSON 100% em prod → trocado por gpt-4.1-mini (não-reasoning). Parâmetros: `temperature: 0.1`, `maxTokens: 150`, `tools: []`, prompt `ROUTER_SYSTEM_PROMPT` (~936 chars).

**As 7 intents** (`VALID_INTENTS`, router.ts:40-48): `saudacao`, `qualificacao`, `produto`, `handoff`, `objecao`, `pagamento`, `fora_escopo`. Quando há mais de uma, a prioridade do prompt é: **handoff > produto > pagamento > objecao > qualificacao > saudacao > fora_escopo**.

**Defesa em níveis** — todos caem em `qualificacao` (confidence 0.5, `fallback: true`):
1. JSON do LLM não parseia → `qualificacao`.
2. Intent fora de `VALID_INTENTS` → `qualificacao`.
3. `confidence < 0.6` E intent ≠ qualificacao → forçado a `qualificacao` (no código, não só no prompt).
4. A chamada LLM lança exceção → `qualificacao`.

**Hop guard** (`hopGuard.ts`): hop 0 = router, hop 1 = specialist, **máximo 2 hops** por `turn_id`. Consulta `ai_agent_runs`; se já há ≥2 linhas → bloqueia, loga `loop_detected` e o pipeline devolve `null` → **transbordo gracioso** (§7). Erro de DB → defensivo `allow: true`.

---

## 3. Dispatch — qual balcão atende qual intent

**Didático:** sete tipos de pedido, mas só **cinco balcões** — alguns balcões atendem dois tipos. Pagamento, por exemplo, é atendido pelo mesmo especialista de objeção (ele já carrega os preços e condições). E "fora do escopo" vai pro mesmo que cuida da saudação, que redireciona educadamente.

**Técnico** (`routerPipeline.ts:151-159`):

| Intent | Builder do specialist |
|---|---|
| `saudacao` | `buildGreetingSpecialistDef()` |
| `fora_escopo` | `buildGreetingSpecialistDef()` (redireciona; não há specialist dedicado) |
| `qualificacao` | `buildQualificationSpecialistDef(specialistModel)` |
| `produto` | `buildProductSpecialistDef(specialistModel)` |
| `objecao` | `buildObjectionSpecialistDef(specialistModel)` |
| `pagamento` | `buildObjectionSpecialistDef(specialistModel)` (reusa objeção) |
| `handoff` | `buildHandoffSpecialistDef(specialistModel)` |

`specialistModel = agent.specialist_model || DEFAULT_SPECIALIST_MODEL` (= `gpt-4.1`). O **greeting** fica deliberadamente no barato `gpt-4.1-mini` (definido dentro do próprio builder, NÃO recebe `specialistModel`).

**A intent do router NEM SEMPRE é honrada** — overrides determinísticos rodam antes de `runSpecialist`:
- **Loop de no-result/enriquecimento** (offline ou 0 resultado no catálogo): força produto/handoff ou devolve um `Response` determinístico (próxima pergunta de qualificação / "quer mais?" offline / handoff forçado).
- **qualificationGate** (para `produto`/`qualificacao`): fonte única "buscar vs qualificar" (ver §6).
- **Pós-nome com interesse premium semeado**: `saudacao` + nome conhecido + funil intocado → força qualification specialist.
- **exit_action=handoff** (Onda 2): se o motor determinístico concluiu a qualificação, força handoff specialist e arma `pendingHandoffTrigger`.

---

## 4. O contrato compartilhado — `specialistBase`

**Didático:** todo balcão segue o mesmo roteiro de bastidores: cumprimentar (se ainda não cumprimentou), lembrar do cliente, falar como gente (humanização), conhecer a loja (endereço/horário/pagamento), não repetir o nome toda hora. Cada especialista só escreve a parte que é "a cara dele"; o resto o sistema cola automaticamente em volta.

**Técnico:** cada specialist é só `{ name, intent, model, buildPrompt, toolDefs, disableHandoffGuard }` (`SpecialistDef`); `runSpecialist(ctx, def, hopN)` faz o resto. O system prompt é montado nesta ordem exata (`specialistBase.ts:260`):
1. `buildLeadMemoryBlock(leadProfile)` — memória longa do lead (topo).
2. `greetingDoneDirective` — anti double-ask se já saudou neste turno.
3. o `buildPrompt` do próprio specialist.
4. `buildHumanizationRules()` — **humanização é injetada pela base**, não em cada prompt (Onda 2).
5. `buildBusinessSection(agent)` — endereço/horário/pagamento/entrega + regra anti-alucinação.
6. `buildNameUsageDirective` — anti-repetição de nome determinística.
7. `ctx.exitActionDirective` — quando o motor concluiu qualif com `exit_action=handoff`.
8. `ctx.preSearchContext` — pré-busca determinística (último, fix de latência 1-round do produto).

**Pipeline:** `buildPrompt` → `runLlmCallLoop` (loop de function-calling com retry/backoff) → insere linha de hop em `ai_agent_runs` → sanitização (§5) → dispatch. Pós-dispatch: `consolidateLeadMemory` fire-and-forget. Erro 3× LLM → `errorResponse` propagado; o `routerPipeline` NÃO devolve esse erro ao lead — loga e retorna `null`, e o `index.ts` faz o **transbordo gracioso** (§7). Modelo default no `SpecialistDef`: `gpt-4.1` (full, não-reasoning).

---

## 5. Os 5 specialists

**Didático:** cada balcão sabe fazer uma coisa muito bem e tem ordem de **não invadir** o balcão do vizinho. O de saudação nunca busca produto; o de qualificação nunca transfere; o de objeção nunca dá desconto sozinho.

**Técnico:**

| Specialist | intent(s) | Modelo default | Ferramentas | `disableHandoffGuard` |
|---|---|---|---|---|
| greeting | `saudacao`, `fora_escopo` | **`gpt-4.1-mini`** | `set_tags`, `update_lead_profile` | false |
| qualification | `qualificacao` | `gpt-4.1` | `set_tags`, `update_lead_profile` | false |
| product | `produto` | `gpt-4.1` | `search_products`, `send_carousel`, `send_media`, `set_tags`, `update_lead_profile`, `set_cart`, `handoff_to_human` | **true** |
| objection | `objecao`, `pagamento` | `gpt-4.1` | `set_tags`, `update_lead_profile`, `handoff_to_human` | **true** |
| handoff | `handoff` | `gpt-4.1` | `handoff_to_human`, `send_poll` | **true** |

- **greeting** — abre a conversa: cumprimenta, captura nome, reconhece lead que volta, redireciona off-scope. Gate `hasResumableInterest` (só diz "você estava vendo X" se há interesse/produtos vistos reais — corrige a alucinação de tratar o nome de lead novo como recorrente). Espelha o cumprimento ("Bom dia!"→"Bom dia!").
- **qualification** — descoberta estilo SPIN, UMA pergunta por turno. Reusa `buildQualificationContext` ("PRÓXIMA PERGUNTA OBRIGATÓRIA": R131/R135/R134) + bloco do contrato premium de `evaluateProductQualificationFlow`/`readProductQualificationState`. Nunca busca/objeta/transfere.
- **product** — o specialist original (Sprint C4), prompt mais rico (~3 KB, 10+ regras numeradas). Monta o pedido multi-item completo e então transfere. Tem `getProductSpecialistToolDefs` próprio. Regra dura: **NUNCA negar existência de produto** ("catálogo é minoria, maioria é estoque físico"). Re-batching de carrossel no "mais opções". Pré-busca própria (`cleanProductQuery`, `deriveProductSearchParams`).
- **objection** — Feel-Felt-Found / ancoragem de valor. Também atende `pagamento` (carrega `business_info`). Nunca dá desconto sozinho; `priorObjectionCount` 2+ → handoff.
- **handoff** — fecha o ciclo da IA: UMA frase de confirmação + `handoff_to_human` com motivo COMPLETO. `send_poll` NPS opcional quando a conversa claramente terminou. Lógica de fila/departamento/fora-de-horário fica no handler `executeToolSafe`, não aqui.

> O handoff specialist **era** `gpt-4.1-mini`, mas foi promovido a `gpt-4.1` porque o mini vazava a chamada como texto puro (`functions.handoff_to_human({...})`) em vez de invocá-la — e o transbordo nunca acontecia.

---

## 6. A camada determinística (qualificationGate + greetingPolicy + sanitizer)

**Didático:** antes e depois do LLM existem **regras fixas, sem IA**, que protegem o lead. Elas decidem "agora é hora de buscar ou de perguntar?", como abrir a conversa, e limpam respostas perigosas (ex: a IA dizendo "não temos esse produto"). Detalhe completo em [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]].

**Técnico (alto nível):**
- `qualificationGate.ts` — fonte única "search vs qualify". `evaluateQualificationGate` devolve `mode`: `search` (força product specialist), `qualify` (força qualification, muitas vezes devolvendo a próxima pergunta determinística sem chamar o LLM), `qualify_then_handoff` (catálogo offline → qualifica breve e transfere), `no_category`. **Nunca lança**: em qualquer erro retorna `readyToSearch=true` para o lead não ficar preso em loop. Substituiu 4 decisores rivais que divergiam na migração monolito→router.
- `greetingPolicy.ts` — `classifyLeadRecency` → `novo`/`recorrente`/`ativo`; `buildOpeningDirective` injeta a diretiva de abertura no topo do prompt (ou só a P5 de registro de nome, se a saudação já foi feita deterministicamente no index.ts). `buildNameUsageDirective` suprime o nome se usado nas últimas 2 mensagens do bot.
- `responseSanitizer.ts` — **fonte única de validação de toda resposta que sai do agente**. Desde o D6 tem um único consumidor: `sanitizeSpecialistResponse` no `specialistBase.ts` (antes era compartilhado com o monolito). O **Validator LLM (`validatorAgent.validateResponse`) foi APOSENTADO do hot path** (Onda 2, 2026-06-12); `validatorAgent.ts` sobrevive só para `countMsgsSinceNameUse` e auditoria offline. O sanitizer roda o motor **determinístico** `validateLLMResponse` (regras/regex, apesar do "LLM" no nome). `sanitizeAgentResponse` nunca lança; aplica `SAFE_TEXT_RULES` (substitui texto inteiro: negação de produto / vazamento de erro / leak interno), `AUTO_FIX_RULES` (reescrita cirúrgica) e regras cosméticas (só telemetria).
- **Short-circuits pré-LLM: os do monolito foram REMOVIDOS no D6.** Até 2026-07-25 o `index.ts` chamava `runPreLLMShortCircuits` (R129/R136) e a pré-busca inline R121, ambos pulados quando o agente rodava em router; com o monolito aposentado, os dois caminhos saíram do código. Hoje quem roda pré-LLM é o `preLLMAutoExtract.ts` (auto-extração de campos, score, seed de `interesse:` R143, `pendingExitActionHandoff`/`pendingExitActionSearch`), e a **desambiguação multi-categoria** virou seed de `multi_interesse_pending` (v7.105.0, a foto de torneira que virava "cano") consumido pelo qualification specialist. `preLLMShortCircuits.ts` continua no repo, mas só como utilitário: `jsonResponse`, `persistAndBroadcastReply` e o tipo `PreLLMShortCircuitsCtx`, importados pelo `jobVacancy.ts`.

---

## 7. O que acontece quando algo falha (fallback gracioso)

**Didático:** até 2026-07-25 existia um **cérebro gigante antigo** (um prompt de ~17 KB) que fazia tudo sozinho e ficou como rede de segurança. Ele **foi aposentado** (D6). Hoje a rede de segurança não é outra IA — é o **transbordo digno**: se o recepcionista se confunde, ele manda o cliente pro balcão que faz perguntas (nunca é grosseiro nem some); se um balcão inteiro cai, a loja não pede desculpa técnica ao cliente — manda a mensagem de "vou te passar pro nosso atendente", coloca o lead na fila e avisa o vendedor. Na Eletropiso: o lead pergunta "tem porcelanato 60x60?" e o specialist de produto quebra → o lead recebe *"George, um de nossos atendentes vai te ajudar…"* e cai na fila com nota interna, em vez de um "Desculpe, erro interno".

**Técnico — 3 camadas, nesta ordem:**

**(a) O router LLM falhou → NÃO transborda.** `classifyIntent` (`router.ts`) nunca lança: JSON não parseia, intent fora de `VALID_INTENTS`, `confidence < 0.6` fora de qualificação, ou exceção da chamada → devolve intent `qualificacao` com `confidence 0.5` e `fallback: true`. O turno continua normal, com o qualification specialist (a intent mais segura: perguntar nunca estraga a conversa).

**(b) O specialist falhou → transbordo gracioso.** O `runRouterPipeline` devolve `response = null` em quatro situações: hop guard estourado (`loop_detected`), intent sem specialist mapeado, `errorResponse` do specialist (3× falha do LLM) ou qualquer exceção do pipeline. Ao receber `null`, o `ai-agent/index.ts` executa o transbordo (bloco D6, logo após a chamada do pipeline):

1. envia a `handoff_message` configurada do agente (via `pickHandoffMessage`, respeitando fora-de-horário);
2. `runQueueAssignment` → põe o lead na **fila** e notifica o vendedor;
3. `status_ia = SHADOW` + tag `ia:shadow` (a IA continua extraindo, nunca responde);
4. grava **nota interna**: *"⚠️ A IA não conseguiu processar este turno (falha interna do pipeline). Lead encaminhado para atendimento humano."*;
5. loga em `ai_agent_logs` com `event = 'implicit_handoff'` e `metadata.reason = 'router_fallback'`.

Regra da casa respeitada: **nunca expor erro interno ao lead**. Em 40h de prod pós-deploy (verificação de 2026-07-26) houve **zero `router_fallback`** em tráfego real — o único registro é o teste proposital de 2026-07-25.

**(c) Rollback do D6 não é mais um flag.** Não existe chave pra "voltar pro monolito": o caminho é **redeploy do `ai-agent` a partir do commit `36f0555`** (o pai do D6, último com o monolito) via CLI scoop — versão anterior em prod = **v276**, atual = **v277**.

> A coluna `ai_agents.routing_mode` continua no banco, mas está **INERTE desde 2026-07-25**: nenhum código a lê, o default do DB virou `router` e o seletor sumiu da UI (`src/components/admin/AIAgentTab.tsx`). Não confundir com `conversations.status_ia = 'shadow'`, que continua vivo e é outra coisa: **um humano assumiu o atendimento** (§7 de [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]]).

---

## 8. O vocabulário de ferramentas (tools)

**Didático:** o agente não só conversa — ele aciona **ferramentas**, como um vendedor com acesso ao estoque, ao sistema de etiquetas e ao CRM. O próprio LLM decide qual usar e quando; cada balcão (specialist) recebe só o molho de chaves que precisa.

**Técnico:** o **executor** `executeToolSafe` (`ai-agent/index.ts`) continua entendendo os 10 nomes abaixo, mas **as definições que o LLM enxerga não vivem mais no `index.ts`** — o D6 (2026-07-25) apagou de lá o bloco das 9 defs canônicas do monolito. Hoje elas vivem em `_shared/agent/specialistTools.ts` (compartilhadas) e em `productSpecialist.ts` (`getProductSpecialistToolDefs`), todas `strict: true` (toda key em `required[]`, opcionais como união `["TYPE","null"]`). Consequência prática: **`assign_label` e `move_kanban` ficaram sem def** — o handler segue no executor (e no `ai-agent-playground`), mas nenhum specialist oferece essas tools ao LLM, então na prática elas não são mais chamadas em produção.

1. **`search_products`** — busca no catálogo. Se acha produtos com foto, **envia o carrossel automaticamente** (a descrição manda NÃO chamar `send_carousel` depois). Args: `query, category, subcategory, min_price, max_price` (nullable).
2. **`send_carousel`** — carrossel de produtos com imagens + botões; usar com 2+ produtos COM imagem. Args: `product_ids` (títulos exatos, máx 10), `message` (nullable).
3. **`send_media`** — uma imagem/documento (foto de um produto específico). Args: `media_url`, `media_type` (image/video/document), `caption` (nullable).
4. **`assign_label`** — etiqueta a conversa para rastrear etapa do funil. Arg: `label_name`. **Só handler desde o D6** (nenhum specialist expõe a def).
5. **`set_tags`** — adiciona tags cumulativas `"chave:valor"` (ex: `motivo:compra`, `interesse:tinta`). Arg: `tags` (array).
6. **`move_kanban`** — move o card do CRM Kanban de coluna. Arg: `column_name`. **Só handler desde o D6** (nenhum specialist expõe a def).
7. **`update_lead_profile`** — salva dados do lead. Args: `full_name, city, interests, notes, reason, average_ticket, objections` (todos nullable e required).
8. **`handoff_to_human`** — transfere para humano (lead pede vendedor, mostra intenção de compra, ou frustração). Arg: `reason` (com resumo dos dados coletados).
9. **`send_poll`** — enquete nativa do WhatsApp com opções clicáveis; **NUNCA numerar opções**. Args: `question` (máx 255), `options` (2-12), `selectable_count` (1=única, 0=múltipla, null=1).

### Onde as defs vivem (nuance importante)

- `specialistTools.ts` define **5**: `setTagsToolDef`, `updateLeadProfileToolDef`, `handoffToHumanToolDef`, `sendPollToolDef` e `setCartToolDef`. Não guarda as tools de mídia/busca (`search_products`/`send_carousel`/`send_media`, que vivem em `productSpecialist.ts` via `getProductSpecialistToolDefs`) nem `assign_label`/`move_kanban` (sem def).
- `getProductSpecialistToolDefs()` devolve **7**: as 3 de produto + `set_tags` (cópia própria) + `updateLeadProfileToolDef` + `setCartToolDef` + `handoff_to_human`.
- **`set_cart`** é a tool do cart engine: define o pedido COMPLETO (substitui o pedido inteiro, idempotente — não duplica). Item = `{name, qty, product_id, unit_price}`; cada item declara `additionalProperties:false` (o llmProvider só injeta isso no root → senão OpenAI 400 → 502).
- Todas as defs compartilhadas são `strict: true`. Antes elas eram cópias 1:1 dos schemas do monolito (pra evitar drift); com o monolito aposentado, **`specialistTools.ts` virou a fonte canônica** — a régua de drift agora é o `executeToolSafe`. `updateLeadProfileToolDef` exige TODOS os campos (null quando desconhecido). Specialists escolhem um SUBSET mínimo (princípio strict: "tool overload é sobre sobreposição, não quantidade").

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral (visão das sub-funcionalidades)
- [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] — Camada determinística, SDR, Shadow Mode, handoff e fila
- [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] — Profiles, NPS, Knowledge Base, Voz, Prompt Studio, memória
- [[wiki/ai-agent]] — Referência técnica do AI Agent
