---
title: AI Agent — Fluxo SDR e Modo Sombra (Shadow)
tags: [ai-agent, sdr, qualificacao, qualification-gate, greeting-policy, shadow-mode, human-handling-lock, stages, score]
sources:
  - supabase/functions/_shared/agent/qualificationGate.ts
  - supabase/functions/_shared/agent/greetingPolicy.ts
  - supabase/functions/_shared/agent/qualificationSpecialist.ts
  - supabase/functions/_shared/agent/greetingSpecialist.ts
  - supabase/functions/_shared/agent/specialistBase.ts
  - supabase/functions/_shared/agent/responseSanitizer.ts
  - supabase/functions/_shared/agent/routerPipeline.ts
  - supabase/functions/_shared/agent/preLLMAutoExtract.ts
  - supabase/functions/ai-agent/index.ts
  - supabase/functions/whatsapp-webhook/index.ts
  - supabase/functions/_shared/handoffQueue.ts
updated: 2026-07-26
audited_at: 2026-07-26
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Fluxo SDR e Shadow Mode

> Como o agente decide **qualificar vs buscar** (qualificationGate), como abre a conversa e reconhece o lead que volta (greetingPolicy), como o **qualification specialist** conduz a descoberta consultiva, e como ele continua extraindo dados em silêncio depois do handoff (Shadow Mode + trava de atendimento humano v7.94.0).

---

## 1. Quem decide "qualificar vs buscar" — qualificationGate

**Didático.** Pense num bom vendedor de loja de tintas. Quando o cliente diz só "quero tinta", ele NÃO sai correndo pro estoque — pergunta pra qual ambiente, qual cor, antes de mostrar caixas. Mas se o cliente já chega dizendo "quero Coral branca 18L acabamento fosco", ele vai direto buscar. Antes, no WhatsPRO, quatro pedaços de código brigavam pra tomar essa decisão e se contradiziam. Hoje existe **um único juiz**: o `qualificationGate`.

**Técnico.** `_shared/agent/qualificationGate.ts` exporta `evaluateQualificationGate(input)`, fonte única de verdade pra "search vs qualify". Devolve um veredito `{ readyToSearch, mode, reason, category, categoryId, score, searchReadyScore, catalogStatus }` com `mode ∈ 'search' | 'qualify' | 'qualify_then_handoff' | 'no_category'`. Lê a MESMA engine de stages (`serviceCategories`) que governa o score; resolve a categoria via `matchCategory(interesse-tag)` e cai pra `matchCategoryBySearchText(incomingText)`.

Tabela de decisão determinística:

- **Sem categoria resolvida** → `readyToSearch=true`, `mode='no_category'` (nada a qualificar; deixa LLM/busca decidir).
- **`catalog_status !== 'digital'`** (offline/none) → `readyToSearch=false`, `mode='qualify_then_handoff'` — NUNCA busca; qualifica breve e transborda com contexto rico.
- **Categoria digital** — o limiar de busca = o `max_score` do PRIMEIRO stage (ordenado por `min_score`) cujo `exit_action === 'search_products'`. Se `score >= searchReadyScore` → `search`; senão → `qualify`.
- **Categoria digital SEM stage `search_products`** (config rara) → `qualify_then_handoff`.

Degradação graciosa explícita: **nunca lança exceção**; em qualquer erro devolve `readyToSearch=true` (`mode='no_category'`, reason `'erro na avaliação do gate — fallback ready'`) — um lead jamais fica preso em loop de qualificação.

Por que existe: substituiu 4 decisores rivais (engine de stages, `detectIncomingSearchSignal`/R121, `deriveProductSearchParams` e o LLM do product specialist) que divergiam durante a migração monolito→router (2026, concluída no D6). Consumidores hoje: o dispatch do router (`routerPipeline.ts`) — intent=`produto` não-pronto → redireciona ao qualification specialist e suprime a pré-busca — e o próprio `deriveProductSearchParams` (defesa: retorna null se não estiver pronto).

---

## 2. Abertura e reconhecimento — greetingPolicy

**Didático.** O cliente que aparece pela primeira vez merece um "Oi, aqui é da Eletropiso! Com quem eu falo?". Já quem voltou ontem não quer ouvir tudo de novo — quer "Oi de novo! Você estava vendo porcelanatos, quer continuar?". E o pior pecado é repetir o nome em TODA frase ("Sim, João... claro, João... certo, João"), o que soa robótico. O `greetingPolicy` resolve os três casos de forma determinística, sem depender do LLM "lembrar a regra".

**Técnico.** `_shared/agent/greetingPolicy.ts`:

- `classifyLeadRecency({hasInteracted, hasEverInteracted, fullName})` → `'novo' | 'recorrente' | 'ativo'`:
  - **`recorrente`** — tem nome confirmado + já interagiu + NÃO nas últimas 24h.
  - **`ativo`** — interagiu nas últimas 24h.
  - **`novo`** — primeiro contato, OU voltou SEM nome conhecido (P9 trata nome-desconhecido como novo).
- `buildOpeningDirective(input)` → string injetada no topo do system prompt do specialist, ou `null` quando não há nada a injetar. Se `greetingHandledExternally=true`, emite SÓ a diretiva de registro de nome (P5) e NENHUMA saudação (evita saudação dupla — a saudação de primeiro contato é feita deterministicamente no `index.ts`, "Decisão A").
  - `novo` → mensagem única obrigatória: saúda citando o nome da loja + pede o nome + então faz o trabalho (mesmo que o lead já tenha aberto com um produto).
  - `recorrente` → reconhece o lead, não repergunta o nome, referencia UM fato de memória pra retomar.
  - Sempre acrescenta a diretiva P5 de registro de nome quando `leadName` é desconhecido.
- `buildNameUsageDirective(geminiContents, fullName)` — anti-repetição DETERMINÍSTICO: varre as 2 últimas mensagens `role==='model'` (do bot) buscando o primeiro nome (regex com word-boundary); se usado recentemente, devolve diretiva de supressão, senão `null`. É deliberadamente determinístico porque a regra de prompt "máx 1x por mensagem" era insuficiente (o LLM repetia o nome em TODA mensagem).

---

## 3. O greeting specialist (intent `saudacao` / `fora_escopo`)

**Didático.** É o "recepcionista" da conversa: cumprimenta, captura o nome, reconhece quem volta e redireciona educadamente quem pede algo fora do escopo (uma vaga de emprego, p.ex.). Ele NUNCA qualifica, busca catálogo ou transborda — só abre a porta.

**Técnico.** `_shared/agent/greetingSpecialist.ts` (`buildGreetingSpecialistDef()`). É o único specialist no modelo barato **`gpt-4.1-mini`** (tarefa leve, baixa latência) — deliberadamente NÃO recebe `specialistModel`. Tools: `set_tags`, `update_lead_profile`. Atende `saudacao` e também `fora_escopo` (não há specialist dedicado pra fora-de-escopo; ele redireciona com cordialidade). Tem o gate `hasResumableInterest` (só diz "você estava vendo X" se existirem interests/products_seen reais — corrige a alucinação "Erick", onde o nome de um lead novo era tratado como retorno). Espelha a forma da saudação ("Bom dia!"→"Bom dia!") e persiste o nome via `update_lead_profile` a cada menção.

---

## 4. O qualification specialist (qualify-first consultivo)

**Didático.** É o pré-vendedor (SDR) que faz **uma pergunta por vez** até saber o suficiente. "Pra qual ambiente?" → "Qual cor?" → "Tem alguma marca preferida?". Não despeja três perguntas juntas nem inventa argumentos técnicos que o lead não pediu.

**Técnico.** `_shared/agent/qualificationSpecialist.ts` (`buildQualificationSpecialistDef(specialistModel)`), default `gpt-4.1`. Tools: `set_tags`, `update_lead_profile`. Descoberta estilo SPIN, UMA pergunta por turno. Reusa o contexto determinístico `buildQualificationContext` ("PRÓXIMA PERGUNTA OBRIGATÓRIA": frasing R131, anti-loop R135, idempotência R134) + um bloco de "contrato premium" de `evaluateProductQualificationFlow`/`readProductQualificationState` (category_id, flow_mode, score, next_required_field, search_enabled, etc.). NUNCA busca catálogo / trata objeção / transborda. Escape hatch anti-invenção-de-argumento mata o Bug 12.

**Quando o gate força este specialist:** para os intents `produto`/`qualificacao` o `qualificationGate` é a autoridade (acima da intent do router) — `mode='qualify'` força o qualification specialist (frequentemente devolvendo uma Response de pergunta determinística, sem nem chamar o LLM); `mode='qualify_then_handoff'` (offline) força este specialist com diretiva de enriquecimento. Há ainda o override pós-nome: `saudacao` + nome conhecido + funil intocado → força qualificação (interesse premium semeado).

---

## 5. Service Categories, stages e score

**Didático.** Cada nicho tem um "funil" próprio. Numa home center, tinta passa por Identificação → Detalhamento → Pronto-pra-handoff; numa clínica, consulta passa por Triagem → Agendamento. Conforme o lead responde, ele "ganha pontos" (score) e avança de etapa; ao bater o teto da etapa, dispara uma ação.

**Técnico.** Cada categoria tem campos com `score_value` e stages com `min_score`/`max_score`/`exit_action` (`search_products` | `enrichment` | `handoff` | `continue`). O score progressivo é mantido na tag `lead_score:<n>` (cap 100), via o mesmo `calculateScoreDelta` que o handler de `set_tags` usa. O gate (seção 1) lê o `max_score` do primeiro stage `search_products` como limiar de busca.

A pré-extração determinística cuida disso ANTES do LLM (`_shared/agent/preLLMAutoExtract.ts`, `runPreLLMAutoExtract`): resolve categoria, auto-extrai campos do texto de entrada (`autoExtractFields` em `flattenCategoryFields`, pulando chaves já presentes), semeia `interesse:<categoryId>` quando detecta categoria sem tag prévia (R143, pra o LLM não inventar interesse), soma o score e — ao bater o `max_score` do stage — arma `pendingExitActionHandoff` (`exit_action='handoff'`) ou `pendingExitActionSearch` (`exit_action='search_products'`, digital). Faz só updates de tag + um log estruturado; sem I/O de mensagem. `shouldQualifyPremiumBeforeSearch` é um gate hardcoded pras categorias `revestimentos`/`porcelanatos_revestimentos`/`torneiras`: qualifica antes de buscar se algum campo obrigatório ainda falta.

**Multi-item / multi-categoria (mudou no D6).** Até 2026-07-25 os short-circuits `preLLMShortCircuits.ts` (R136 lista mista categoria+órfão, R129 ≥2 categorias) rodavam antes do LLM — mas só no caminho do monolito; sob router eram pulados. Com o monolito aposentado eles saíram do fluxo: hoje o próprio `preLLMAutoExtract` semeia **`multi_interesse_pending:<cat1,cat2>`** quando `matchAllCategoriesBySearchText` casa ≥2 categorias, e o qualification specialist pergunta ao lead qual delas ("torneira ou cano?" — v7.105.0, o caso da foto de torneira que virava "cano"). O arquivo `preLLMShortCircuits.ts` segue no repo apenas como utilitário (`jsonResponse`, `persistAndBroadcastReply`, tipo `PreLLMShortCircuitsCtx`) reusado pelo `jobVacancy.ts`.

---

## 6. Sanitização determinística da resposta (sem validador LLM)

**Didático.** Depois que o specialist redige a resposta, um "revisor automático" passa o olho antes de enviar ao lead: corta negação de produto ("não temos essa caixa-d'água"), vazamento de erro interno e tool-call vazada como texto. Esse revisor NÃO é mais um segundo LLM (custo/latência) — é uma régua determinística.

**Técnico.** `_shared/agent/responseSanitizer.ts` → `sanitizeAgentResponse(text, ctx)` é a fonte única por onde passa TODA resposta enviada ao lead. Desde o D6 (2026-07-25) tem um único chamador: `sanitizeSpecialistResponse`, no `specialistBase.ts` — antes era compartilhado também com o fallback monolith do `index.ts`, que deixou de existir. O validador LLM (`validatorAgent.validateResponse`) foi **APOSENTADO do hot path** (auditoria Onda 2, 2026-06-12): `validatorAgent.ts` permanece no repo só pra `countMsgsSinceNameUse` e auditoria offline; nenhum turno de produção paga sua latência. A engine que de fato roda é a determinística `validateLLMResponse` (de `responseValidator.ts`) — regras/regex, não chamada de LLM, apesar do "LLM" no nome. Três tiers: `SAFE_TEXT_RULES` (substitui o texto inteiro por ponte segura), `AUTO_FIX_RULES` (reescrita cirúrgica via `autoFixHumanizationViolations`) e regras cosméticas (só telemetria). Nunca lança; em erro interno devolve o texto original.

---

## 7. Shadow Mode — IA ouvindo em silêncio

**Didático.** Depois que a IA transfere a conversa pro vendedor (handoff), ela não desliga: entra em **modo sombra**. Lê TODAS as mensagens (do lead e do vendedor) e **extrai dados automaticamente**, mas **não envia nada** ao lead. É o assistente invisível tomando notas. Quando o vendedor abre o perfil, cidade, interesses e objeções já estão lá — sem ninguém digitar.

**Técnico.** Shadow é acionado quando `conversation.status_ia === STATUS_IA.SHADOW` — nada a ver com o antigo `routing_mode='shadow'` de roteamento, que foi aposentado junto com o monolito no D6. O bloco SHADOW MODE do `ai-agent/index.ts` (linhas ~1879-2039) roda extração via LLM e **retorna sem enviar resposta** (`reason: 'shadow_mode'` / `'shadow_vendor'`). É bilateral: lado do lead (`status_ia='shadow'`) OU lado do vendedor (`shadow_only=true` do webhook → `isShadowVendor`). Mensagens triviais são pré-filtradas (`isTrivialMessage`) e pulam o LLM (`shadow_skipped_trivial`).

Dois prompts distintos: o de vendedor analisa o comportamento do vendedor (`set_tags` como `vendedor_tom`, `venda_status`, `pagamento` + `extract_shadow_data`); o de lead extrai dados do lead (`set_tags`, `update_lead_profile`, `extract_shadow_data`). O executor de tools em shadow trata só `set_tags`, `update_lead_profile`, `extract_shadow_data`.

**Nunca sobrescreve `full_name`** (duas camadas): o prompt de lead é instruído a `NÃO atualize full_name` quando já existe nome; e o executor só grava `full_name` se `args.full_name && !leadProfile?.full_name`, ainda passando por `sanitizeProfileName` (pra não confundir um interesse como "Garagem" com o nome). Isso evita que o vendedor dizer "Obrigado, Pedro!" sobrescreva o nome do lead.

**Atenção — Shadow NÃO libera follow-ups automaticamente** (`followUpPause.ts`): handoffs premium podem setar `followups_paused:true`; `areFollowUpsPaused` checa a tag e `shouldProcessFollowUpCandidate` exclui esses candidatos mesmo estando em shadow.

Em `index.ts` todo caminho de handoff/cap guarda `status_ia !== STATUS_IA.SHADOW` (R85) pra evitar handoff duplicado, e ao transbordar seta `status_ia: STATUS_IA.SHADOW` + tag `ia:shadow` + `broadcastEvent`.

---

## 8. Trava de atendimento humano (`human_handling_at`, v7.94.0)

**Didático.** O problema real: o vendedor responde pelo CELULAR, e antes o sistema não enxergava isso direito — a fila rotacionava o lead entre vários atendentes e a IA voltava a responder por cima do humano (~150 mensagens vazadas em 3 dias). A solução é uma **fonte de verdade durável**: assim que o vendedor manda a primeira resposta pelo celular, a conversa fica "travada" — a fila para de rodar e a IA cala (vira shadow) até alguém Finalizar ou Ativar IA.

**Técnico.** `conversations.human_handling_at` é a verdade durável de "humano atendendo", ao contrário do volátil `status_ia` e das tags `handoff_created`/`human_assigned` (que reabertura/abandono podem limpar).

- **Set** no `whatsapp-webhook/index.ts` (~1141-1160) quando `shouldLockHumanHandling({fromMe, wasSentByApi})` (`_shared/aiRuntime.ts`) é true — i.e. `fromMe === true && wasSentByApi === false` (vendedor respondeu pelo celular, não eco de API/IA/Helpdesk). Sinal confiável, SEM condição de `status_ia` (trava mesmo já estando shadow/desligada). Grava só uma vez (`.is('human_handling_at', null)`) e, no primeiro lock, sela o evento de fila ativo (`status='responded', resolved_reason='human_handling'`). Respostas pelo Helpdesk NÃO passam por aqui (setam `status_ia=desligada`; o `detectResponded` da fila as vê via `sender_id`).
- **Gate no ai-agent** (`index.ts` ~232-250): se `human_handling_at` setado e ainda não shadow, COAGE `status_ia → shadow` (e persiste) — a IA cai no Shadow Mode (extrai, nunca responde).
- **Fila não rotaciona enquanto travada** (RULE 1), em três pontos (defesa em profundidade): `assignHandoff` (`handoffQueue.ts` ~141-152) early-return `{ assigned_user_id: null, reason: 'human_handling' }`; `requeue-conversations` sela o evento; `escalate-stale-handoffs` faz `continue` (pula a escalação).
- Só **Finalizar / Ativar IA** (e limpar contexto) liberam a trava; senão congela indefinidamente (decisão do dono). Reassign manual do gestor faz bypass.

Existe ainda um gate durável mais antigo (2026-06-09, `index.ts` ~252-275): `hasActiveHandoffMarker(tags)` (handoff_created/human_assigned) também coage `status_ia → shadow`. É distinto da trava v7.94.0 justamente porque essas tags SÃO limpas na reabertura — razão pela qual `human_handling_at` foi criada.

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — Router + specialists + tools
- [[wiki/casos-de-uso/excluded-products-detalhado]] — produtos NÃO vendidos
- [[wiki/decisoes-chave]] — Service Categories, qualificationGate, trava humana
- [[wiki/erros-e-licoes]] — R79 (score reset), R85/R86 (shadow), R143
