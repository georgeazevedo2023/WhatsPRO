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

### v7.41.0 (2026-05-22) — Sprint B5 Onda 3a: extrai media tools (send_carousel + send_media + send_poll)

Primeira sub-onda do split do `executeTool` switch (~1500 lin total). Onda 3a ataca os 3 handlers de envio de mídia — sem mutação de tags, sem cascata, baixo risco. Valida o padrão de extração de tools antes de atacar search_products (3c) e set_tags (3d).

**Mudanças:**
- Novo `_shared/agent/tools/mediaTools.ts` — 3 funções (`sendCarousel`, `sendMedia`, `sendPoll`) + dispatcher `dispatchMediaTool(name, args, ctx, log)`. Helper privado `safeBtnId` (copiado do index.ts).
- Cada handler retorna `string` (mesmo contrato do switch original) — mensagem que vai pro próximo turno do LLM.
- `MediaToolsCtx` interface: supabase + agent + conversation/contact/instance + uazapiUrl + callback broadcastEvent.
- `ai-agent/index.ts`: 3 cases (`send_carousel`, `send_media`, `send_poll`, ~155 lin in-line) → 1 case com chamada única ao dispatcher (~20 lin). index.ts: 4032 → **3900 lin** (-132). Acumulado B5: **-644 lin** desde 4544 inicial.
- +19 testes (mediaTools.test.ts): valida ausência product_ids, limite 10, retry 4 variantes, multi-foto/single-product, sendMedia 4 paths, sendPoll validação + selectable_count, dispatcher routing.

**Equivalência semântica:** strings/logs idênticos ao original (`Carrossel enviado com X fotos ao lead!`, `Mídia enviada com legenda`, `Enquete enviada: "Q" com N opcoes`). `generateCarouselCopies` (Groq AI) preservado via import shared.

**Pipeline:** tsc 0 · vitest **1086 pass (+19 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v84→v85 ACTIVE.

**Próximas sub-ondas da Onda 3:**
- 3b — assign_label + move_kanban + update_lead_profile (~140 lin)
- 3c — search_products (~650 lin, vira product_specialist no Sprint C)
- 3d — set_tags + handoff_to_human (~545 lin, HIGH RISK, vira qualif+handoff specialists)

---

### v7.40.9 (2026-05-22) — Fix Bug #7: short-circuits R129+R136 preservam fields ricos da msg original

Bug encontrado em validação E2E em prod (lead "porta de ENTRADA e janela pra OBRA NOVA" → sistema perdia "entrada" + "obra nova"). R129/R136 short-circuited ANTES do autoExtract, persistindo só a tag pending e descartando o resto da mensagem. Lead voltava na sequência e LLM re-perguntava o que já tinha sido dito.

**Fix em `_shared/agent/preLLMShortCircuits.ts`:**
- Novo helper privado `extractRichFieldsFromCategories(text, matchedCats, existingTags)` itera pelas categorias detectadas, chama `autoExtractFields` na union dos fields de cada uma, dedupe por key.
- R129: antes do INSERT, computa `richFields` e adiciona às tags persistidas (junto da `multi_interesse_pending`).
- R136: idem — filtra `multiItem.items.matchedCategoryId` → categorias correspondentes → extract.
- Log `auto_field_extracted` agora carrega `rich_extracted` no metadata.
- +5 testes cobrindo: R129 extrai subtipo + material + tipo_janela, R129 não duplica tag existente, R136 extrai ambiente + acabamento de lista mista, agent sem fields ricos não falha, guard R134 preservado.

**Pipeline:** tsc 0 · vitest **1067 pass (+5 novos)** / 9 fail pré-existentes. Deploy ai-agent v83→v84 ACTIVE.

**Bug encontrado durante validação E2E em prod** (sessão 2026-05-22, conversa Eletropiso V2 #5b78ee46). Esse é o 1º fix originado de teste em prod — antes os fixes só vinham de incidentes reportados por leads.

---

### v7.40.8 (2026-05-21) — Sprint B5 Onda 2c-ii: extrai autoExtract + exit_action handoff + R121 inline search

Última peça HIGH RISK da Onda 2c. Três blocos in-line (autoExtract+score+flags, Bug 24 handoff dispatcher, R121 inline search) extraídos para 2 módulos testáveis. Closure pesada `runQueueAssignment` agora passada como callback explícito — desbloqueia o caminho pro Sprint C (specialists não vão precisar acessar a closure interna).

**Mudanças:**
- Novo `_shared/agent/preLLMAutoExtract.ts` — `runPreLLMAutoExtract(ctx, log)` retorna `{ pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }`. Faz: resolução de categoria, R121 "tem X?" trigger, autoExtract de fields, score progressivo, setup das flags de exit_action. DB writes (tags + log `auto_field_extracted`) preservados. Sem IO de mensagem.
- Novo `_shared/agent/exitActionDispatcher.ts` — 2 funções:
  - `dispatchExitActionHandoff(ctx, pending, log)` retorna `{ dispatched, response }`. Quando `pendingExitActionHandoff` setado: runQueueAssignment + sendTextMsg + DB updates (status_ia=SHADOW, dept) + broadcast + log `implicit_handoff` + Response 200. Skip em status_ia=SHADOW.
  - `runInlineSearchProducts(ctx, pending, log)` retorna `{ inlineSearchContext, toolCall }`. Quando `pendingExitActionSearch` setado: executeToolSafe + log `tool_called` + monta string `[INTERNO]`. Skip em SHADOW. Erros não propagam (log.error).
- Callbacks injetados via ctx: `sendTextMsg`, `broadcastEvent`, `executeToolSafe`, `runQueueAssignment`, `pickHandoffMessage`. Closure interna do `runQueueAssignment` (linha 689) intocada — só passa pelo prop.
- `ai-agent/index.ts:1502-1673` (~170 lin in-line) → 3 chamadas curtas (~30 lin). index.ts: 4153 → **4032 lin** (-121). Acumulado B5: **-512 lin** desde 4544 inicial.
- +26 testes: 17 preLLMAutoExtract (guards, R121 digital/offline/shadow/produto-recebido, autoExtract+score, exit_action handoff atingindo max stage2, search C2 fallback skip em offline, interesse: tag reuso, log pending_exit_handoff), 9 exitActionDispatcher (happy path, status_ia=shadow skip, dept profile > funnel, outside_hours, response body, inline search happy, shadow skip, executeToolSafe throw).

**Equivalência semântica:** strings/logs idênticos ao original (`exit_action_auto_extract`, `r121_auto_extract_inline`, `Bug 24: exit_action=handoff disparado via auto-extract`, fronteira `[min, max)` de stage preservada). Bug 24 v1 (handoff via auto-extract) e v5 (C2 search) shippeados em ondas anteriores continuam ativos.

**Pipeline:** tsc 0 · vitest **1062 pass (+26 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v82→v83 ACTIVE via CLI.

**Próximo:** Onda 3 (toolExecution switch ~1500 lin) — vai subdividir em 3-4 mini-ondas por capacidade (search_products, set_tags+score, send_carousel, handoff/escalations). É o pré-req real do Sprint C — aqui se define o boundary dos specialists.

---

### v7.40.7 (2026-05-21) — Sprint B5 Onda 2c-i: extrai R136 + R129 short-circuits pré-LLM

Continuação do split. Onda 2c-i isola os 2 curto-circuitos determinísticos que rodam ANTES do LLM e respondem direto ao lead (multi-item misto + multi-categoria sem interesse). Cada um persiste tag de pending, envia mensagem via UAZAPI, registra log e retorna `Response`. Fallback (send falha) mantém a tag persistida e deixa cair pro LLM.

**Mudanças:**
- Novo `_shared/agent/preLLMShortCircuits.ts` — função `runPreLLMShortCircuits(ctx, log)` orquestradora dos 2 paths (R136 vence R129 quando ambos batem). Helper privado `persistAndBroadcastReply` (insert msg outgoing + broadcast + log response_sent) encapsula o trecho duplicado entre os dois disparos.
- `ai-agent/index.ts:1486-1609` (124 lin in-line) → 9 lin de chamada + tratamento de retorno (`{ shortCircuited, response, suppressAutoExtractForMulti }`).
- index.ts: 4265 → **4153 lin** (-112). Acumulado B5: **-391 lin** desde 4544 inicial.
- Cleanup: removidos imports órfãos (`detectMultiItem`, `buildHorizontalQuestion`, `HORIZONTAL_QUALIF_PENDING_TAG`, `matchAllCategoriesBySearchText`) — agora consumidos só dentro do módulo extraído.
- +13 testes (`preLLMShortCircuits.test.ts`): guards de entrada, fluxo feliz R136 + R129, fallback no `sendTextMsg`, guards `alreadyHasHorizontalPending`/`interesseValue`/`alreadyHasMultiPending`, ordem R136 > R129, monta texto "A, B e C" com 3 categorias.

**Equivalência semântica:** strings de output idênticas char-a-char (`Posso te ajudar com X e Y. Por qual prefere começar?` + pergunta horizontal vinda de `buildHorizontalQuestion`). Logs `auto_field_extracted` + `response_sent` com mesmos campos `source` (`r136_multi_item_horizontal`, `r136_multi_item_horizontal_ask`, `r129_multi_interesse_detected`, `r129_multi_interesse_ask`).

**Pipeline:** tsc 0 · vitest **1036 pass (+13 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v81→v82 ACTIVE via CLI (verify_jwt=false preservado).

**Próximo (2c-ii, HIGH RISK):** auto-extract + score progressivo + exit_action=handoff direto (Bug 24) + R121 inline search. ~180 lin com closure `runQueueAssignment` capturada. Sessão dedicada.

---

### v7.40.6 (2026-05-21) — Sprint B5 Onda 2b: extrai buildQualificationContext

Continua o split. Onda 2b extrai a função `buildQualificationContext` (R134/R135/R136/R129/R131 acoplados) — ~127 lin puras movidas pra `_shared/agent/qualificationContext.ts`.

**Mudanças:**
- Novo `_shared/agent/qualificationContext.ts` — função pura recebendo currentTags + agentCfg + recentMessages, retornando string do bloco prompt. Cobre 4 caminhos: (1) R136 horizontalPending → handoff multi-item, (2) R129/R134 multi_interesse_pending → pergunta qual começar, (3) qualif stage normal com R131 phrasing + R135 anti-loop, (4) fallback vazio.
- `ai-agent/index.ts:1460-1578` (~120 lin in-line) → 1 linha de comentário. index.ts: 4390 → **4265 lin** (-125). Acumulado B5: -279 lin (4544 inicial).
- +15 testes cobrindo prioridade R136 > R129, fallback id quando label inexistente, DEFAULT_SERVICE_CATEGORIES_V2 (tinta casa em 'tinta|esmalte|verniz'), nudge R135 anti-loop.

**Pipeline:** tsc 0 · vitest **1023 pass (+15 novos)** / 9 fail pré-existentes. Deploy ai-agent v80→v81 ACTIVE.

---

### v7.40.5 (2026-05-21) — Sprint B5 Onda 2a: extrai promptSections puras

Continuação do split estrutural do `ai-agent/index.ts`. Onda 2a extrai as 9 prompt sections in-line + leadContextBlock + dynamicContext (com R121 facts block humanizado) — bloco PURO sem side effect.

**Mudanças:**
- Novo `_shared/agent/promptSections.ts` (5 funções puras + bundle): `replaceVars`, `buildIdentitySection`, `buildBusinessSection`, `buildLeadContextBlock`, `buildDynamicContext`, `buildFactsBlock`, `buildAgentPromptSections`.
- `ai-agent/index.ts:1431-1515` (~85 lin in-line) → 3 chamadas (`buildAgentPromptSections`, `buildLeadContextBlock`, `buildDynamicContext`).
- index.ts: 4454 → **4390 lin** (-64). Acumulado da B5: -154 lin.
- +28 testes (META_KEYS_FACTS humanização, business missing fields, lead recorrente vs novo, dynamic context com aviso de aceleração, etc.).

**Pipeline:** tsc 0 erros · vitest **1008 pass (+28 novos)** / 9 fail pré-existentes. Deploy ai-agent v79→v80 ACTIVE.

**Onda 2 sub-dividida:** o plano original previa Onda 2 inteira (600 lin). Após leitura, decidi sub-dividir em 2a (sections puras, ✅), 2b (buildQualificationContext função, ~127 lin pura, próxima), 2c (pre-LLM decisions com side effects, ~400 lin HIGH RISK — vai pra sessão dedicada).

---

### v7.40.4 (2026-05-21) — Sprint B5 Onda 0+1: extrai loadContextDocuments

Início do split estrutural do `ai-agent/index.ts` (4544 lin) — pré-requisito do Sprint C (router + specialists). Onda 1 extrai as 4 fontes de context text (campaign + form + bio + funnel + profile/funnel_instructions) que estavam in-line nas linhas 1066-1170.

**Mudanças:**
- Nova pasta `_shared/agent/` com:
  - `context.ts` (tipos compartilhados: Logger, FunnelData, ProfileData, ConversationTagsCarrier — vão crescer ondas futuras).
  - `contextDocuments.ts` (5 funções puras: `loadCampaignContext`, `loadFormContext`, `loadBioContext`, `buildFunnelSections`, orchestrador `buildContextDocuments`). +22 testes.
- `ai-agent/index.ts`: 105 linhas in-line → 13 linhas de chamada única. -90 lin no total (4544 → 4454).
- Strings de output **idênticas char-a-char** ao código original — testes confirmam cada caminho condicional (sem campanha, sem profile, profile vs funnel_prompt, etc.).

**Pipeline:** tsc 0 erros · vitest **980 pass (+22 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v78→v79 ACTIVE.

**Sprint B5 wave-based:** Onda 0+1 ✅. Próximas ondas (sessões futuras): Onda 2 buildSystemPrompt (~600 lin), Onda 3 toolExecution (~1500 lin — alto risco, vai subdividir), Onda 4 llmCallLoop, Onda 5 dispatchResponse.

**Target final:** index.ts ~1200-1500 lin (originalmente o plano falava em <300, mas pro tamanho real isso é irrealista sem 8+ ondas). O importante é deixar o terreno pronto pra Sprint C extrair 1 specialist com diff de ~300 lin, não 1000+.

---

### v7.40.3 (2026-05-21) — Sprint B3 arquivado

> Movido para [[wiki/changelog/2026-05-part9]] em 2026-05-21 (hard limit 300 lin). Conteúdo: reader sub_agents → agent_profiles unificado via loadActiveProfile + migration backfill 3 agentes + trigger DB ensure_default_agent_profile.

---

### v7.40.2 (2026-05-21) — Sprint B2 arquivado

> Movido para [[wiki/changelog/2026-05-part9]] em 2026-05-21. Conteúdo: strict mode em 9 tool schemas OpenAI (alucinação args ~3% → <0,1%).

---

### v7.40.1 (2026-05-21) — Sprint B1.5 arquivado

> Movido para [[wiki/changelog/2026-05-part9]] em 2026-05-21. Conteúdo: fix R135 (anti-loop qualif) + R136 (multi-item horizontal Paloma) — detector + helper + branch buildQualificationContext.

### v7.40.0 + Plano Orquestrador (2026-05-21) — arquivado

> Movido para [[wiki/changelog/2026-05-part8]] em 2026-05-21 (hard limit 300). Conteúdo: Sprint B1 extração hardcodedRules (-90% prompt, 5 agentes paralelos + auditor, ai-agent v75) + meta-entrada Plano Orquestrador (3 sprints / 6 semanas).

---

### v7.39.0 + Auditoria 360° + Plano Orquestrador (2026-05-21) — arquivado

> Movido para [[wiki/changelog/2026-05-part8]] em 2026-05-21 (hard limit 300 linhas). Conteúdo: Sprint A da auditoria (7 P0s fechados + I2 + I3, ai-agent v74), Auditoria 360° 5 ondas (veredito 5.9/10), Plano Orquestrador (3 sprints / 6 semanas).

---

### v7.38.8 (2026-05-21) — R133+R134 arquivado

Regex overlap tintas↔impermeabilizantes + loop R129 (caso Branca). Detalhe em [[wiki/changelog/2026-05-part8]].

---

### v7.38.7 (2026-05-21) — R132 arquivado

IA ignorou transcrição de áudio (Edson, EletropisoV2). Fix re-leitura DB antes do LLM via `_shared/incomingMessagesLoader.ts`. Detalhe em [[wiki/changelog/2026-05-part8]] · [[wiki/erros-e-licoes#R132]].

---

### v7.38.6 (2026-05-21) — R131 arquivado

Phrasing curto na 2ª+ pergunta do stage (sem repetir "Para encontrar a melhor opção"). Fix híbrido em `formatPhrasing(_, _, answeredCountInStage)`. Detalhe em [[wiki/changelog/2026-05-part8]].

---

### v7.38.5 (2026-05-21) — R127/R128/R129/R130: multi-categoria, loop "ambiente da janela", sale_closed false positive

**R127-R130 arquivados.** 4 bugs descobertos por E2E real, 9/10 PASS. Detalhe em [[wiki/changelog/2026-05-part8]] · [[wiki/erros/historico-2026-05-part3]].

**Deploy:** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v63 ACTIVE.

**Lição.** Cada feature toggleável/categórica precisa de teste E2E real explorando combinações (multi-categoria, intenção indireta, mensagens curtas, mensagens combinadas). Prompt reinforcement não é suficiente — LLM ignora regras textuais quando padrão visual da conversa sugere outra coisa. Defesa determinística no backend (helpers testáveis + override pós-LLM) é a única forma confiável.

---

### v7.38.4 (2026-05-20) — Fix R126: `search_products({query:"material"})` cross-categoria

**Bug em prod (Guttemberg, Eletropiso 558781592373, conv `529f51f8`).** Lead pediu "Porta em alumínio e janela em alumínio, só uma de 139" → IA enviou **carrossel de Telha de PVC** R$62. Categoria errada absoluta (lead pediu porta/janela, recebeu telha).

**Causa raiz — 3 falhas em cascata:**
1. **Gap debounce.** Msg1 "Olá gostaria de saber mais informações sobre um material" entrou na queue, processou greeting, e nesse meio tempo a msg2 "Porta alumínio…" chegou e entrou em queue SEPARADA. LLM viu só msg1.
2. **Query genérica escapa do guard de categoria.** LLM chamou `search_products({query: "material"})`. Bug 27 fix tenta deduzir categoria via `matchCategoryBySearchText("material")` mas nenhuma das 24 regex casa "material" → `expectedCategory=null` → `filterProductsByExpectedCategory` vira no-op.
3. **Catálogo embrionário.** EletropisoV2 tem só 1 produto digital cadastrado (Telha PVC) com "material" na descrição. ILIKE `%material%` → carrossel cross-categoria. Categorias `portas`/`janelas` estão configuradas como `catalog_status:offline` mas LLM-driven search nunca checa isso.

**Fix v7.38.4 (Camadas 1+2):**
- **Novo `_shared/searchGuard.ts`** com `evaluateSearchGuard()` — guard determinístico ANTES da query DB:
  - Recusa query genérica (`material|produto|item|coisa|preço|valor`, accent/case-insensitive) sem `expectedCategoryId` → devolve instrução pro LLM pedir categoria.
  - Recusa quando `expectedCategoryStatus === 'offline'` → devolve instrução pra qualificar + handoff (mesma rota do auto-extract `r121_auto_extract_inline`).
- **`ai-agent/index.ts`** integra o helper logo após o cálculo de `expectedCategory` (linha ~2204) com log estruturado `search_guard_blocked`.
- **Migration `20260520210000_ai_agent_logs_search_guard_blocked_event`** adiciona event ao CHECK constraint pra evitar R88 (silent INSERT fail).

**Arquivos:**
- `supabase/functions/_shared/searchGuard.ts` (helper testável, 96 lin)
- `supabase/functions/_shared/searchGuard.test.ts` (15 cenários incluindo repro Guttemberg)
- `supabase/functions/ai-agent/index.ts` (import + integração, ~25 lin)
- `supabase/migrations/20260520210000_ai_agent_logs_search_guard_blocked_event.sql`

**Camada 3 — backlog.** Gap debounce real (msgs novas chegando entre greeting e LLM) tracked como sprint separado. Frase: *"continuar Camada 3 R126 — merge msgs queue antes LLM 2026-05-20"*.

**Lição R126.** Tool call do LLM com payload genérico DEVE ser recusado pelo backend quando não há categoria semântica derivável — LLM em input ambíguo "chuta", defesa é determinística no handler, não no prompt. Catálogo embrionário (<5 produtos digitais) é alto risco de cross-categoria; admin deveria marcar agente como "handoff-first" até atingir threshold (D27 sugere).

**Testes.** 15/15 PASS em `searchGuard.test.ts`. Suite geral: 817 pass / 9 falhas pré-existentes (FormBuilder, mesmo padrão R124/R125 — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v62 ACTIVE, `verify_jwt:false`.

---

### v7.38.3 (2026-05-20) — Fix R125: badge "Em fila" aparecia com Modo Fila OFF

**Bug em prod (Eletropiso 558781592373, conv `5227cd44` do dinho).** Departamento Vendas com `queue_mode_enabled=false` (gestor-de-chão Lucas como default_assignee), mas helpdesk mostrava badge `⏱ Em fila — Lucas (2:10)` na conversa. Atendente confuso — "se desliguei a fila, por que aparece fila?".

**Causa raiz.** `_shared/handoffQueue.ts` criava registro em `handoff_queue_events` com `status='active'` e `expires_at = now() + 5min` em **todo** handoff, mesmo no Modo OFF. O hook `useActiveQueueEvents.ts:69` renderiza o badge sempre que existe row ativa — sem olhar `dept.queue_mode_enabled`. Resultado: countdown aparecia mesmo em dept onde fila não roda.

**Fix.**
- `_shared/handoffQueue.ts`: bloco INSERT/UPDATE de queue_event agora roda só se `dept.queue_mode_enabled === true`. No Modo OFF, faz UPDATE só em `conversations.assigned_to` (comportamento esperado: gestor recebe direto, sem countdown). Adicionalmente, no Modo OFF cancela qualquer event ativo herdado (transição ON→OFF deixava órfãos).
- `src/components/admin/queue/QueueConfig.tsx`: `handleSave` cancela events ativos do dept quando toggle salva OFF — defense-in-depth, não depende de novo handoff acontecer pra limpar UI.

**Arquivos:**
- `supabase/functions/_shared/handoffQueue.ts` — bloco event sob `if (dept.queue_mode_enabled)`
- `supabase/functions/_shared/__tests__/handoffQueue.test.ts` — `queue_event_id` agora `null` em OFF + novo teste `R125 — Modo OFF não chama insert`
- `src/components/admin/queue/QueueConfig.tsx` — cancela events ativos ao salvar OFF

**Limpeza em prod.** 1 queue_event órfão do dinho cancelado via SQL (`UPDATE handoff_queue_events SET status='cancelled' WHERE id='693eb2a2...'`). Badge sumiu imediato via postgres_changes do hook.

**Lição R125.** UI que sinaliza "feature ativa" não pode renderizar com base só no shape do dado (row existe) — precisa olhar a configuração que governa a feature (`queue_mode_enabled` do dept). Backend que cria row em código compartilhado deve respeitar o flag do contexto. **Regra preventiva**: toda feature toggleável precisa testar "se flag=OFF, o usuário vê algum vestígio?". Se sim, é vazamento de estado.

**Testes.** 21/21 PASS em `handoffQueue.test.ts`. Suite geral: 802 pass / 9 falhas pré-existentes (FormBuilder/useForms/excludedProducts/detection ESM — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent && deploy assign-handoff --project-ref prfcbfumyrrycsrcrvms` ✓.

---

### v7.38.2 (2026-05-20) — Fix R124: handoff_to_human bloqueado eternamente após search_fail

**Bug (prod Eletropiso 558781592373, conv `04baffce`).** Lead Carla pediu valor de arandela → IA buscou (0 resultados → tag `search_fail:1`) → pediu refinamento → lead disse "Quero saber os valores" → IA tentou `handoff_to_human` **2 vezes** mas guard "REGRA BUSCA OBRIGATÓRIA" bloqueou as duas. Conversa ficou "Não atribuída", IA Ativa, sem mensagem de transbordo, sem atribuir Lucas (default_assignee). Loop infinito até gerar atrito manual.

**Causa raiz** (`supabase/functions/ai-agent/index.ts:3562-3575` antigo). O guard checava `toolCallsLog.some(t => t.name === 'search_products')` — mas `toolCallsLog` é resetado a cada invocação da edge function. A busca da Carla foi feita no turn 1, gravou `search_fail:1` na tag, mas no turn 4 (quando ela voltou pedindo valor) o `toolCallsLog` voltou vazio. Como ela tinha `produto:arandela` nas tags, o guard bloqueava **pra sempre**.

**Fix.** Extraído pra `_shared/handoffGuard.ts` (testável). Nova condição: `hasSearched = thisRound OR tags contém search_fail:N`. Se busca prévia já falhou, libera handoff (faz sentido: agente já tentou, não há porque insistir em search).

**Arquivos:**
- `supabase/functions/_shared/handoffGuard.ts` (44 lin, novo) — `evaluateHandoffGuard()` + const da msg
- `supabase/functions/_shared/handoffGuard.test.ts` (69 lin, novo) — 8 testes (inclui repro EXATO da Carla)
- `supabase/functions/ai-agent/index.ts:3562-3575` — usa helper

**Lição R124.** Quando guardrail depende de estado da rodada atual (`toolCallsLog`), mas o estado durável vive na tag (`search_fail:N`), o guard precisa olhar **ambos**. Cada invocação do ai-agent é stateless — tags são a única memória persistente entre turnos. Antes de bloquear via guard, sempre checar: "se isso disparar 1000 vezes em loop, o lead consegue sair?" Se a única forma de destravar é uma ação que o LLM já tentou e falhou, é bug.

**Testes.** 8/8 PASS no `handoffGuard.test.ts`. Suite geral: 801 pass / 9 falhas pré-existentes (excludedProducts text, useForms mocks, FormBuilder, *Detection — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ via scoop CLI (npx falhou com SmartScreen ApplicationFailedException).

---

### v7.38.1 + v7.38.0 + v7.37.21 (2026-05-20) — R123 toggle IA + D36 permissões + prefixo `*Nome*` (arquivado)

> Movido para [[wiki/changelog/2026-05-part7]] em 2026-05-21 (hard limit 300 linhas).

---

## 📦 Histórico arquivado

Releases anteriores foram movidas para [[wiki/changelog/]] para manter este arquivo dentro do hard limit de 300 linhas (D31). Arquivos mais recentes:

- [[wiki/changelog/2026-05-part8]] — v7.39.0 Sprint A + Auditoria 360° + Plano Orquestrador (release 2026-05-21)
- [[wiki/changelog/2026-05-part7]] — v7.38.0 a v7.38.1 + v7.37.21 (release 2026-05-20)
- [[wiki/changelog/2026-05-part6]] — v7.37.20 a v7.36.5 (release 2026-05-19 → 2026-05-17)
- [[wiki/changelog/2026-05-part5]] — v7.36.4 a v7.35.1 (release 2026-05-17 → 2026-05-11)
- [[wiki/changelog/]] — diretório completo (partes mais antigas)
