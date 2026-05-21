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

### v7.40.0 (2026-05-21) — Sprint B1: extração `hardcodedRules` (-90% prompt)

**Sprint B1 do plano orquestrador.** Decomposição do monolito `hardcodedRules` (24 bullets / 9.348 chars no prompt principal) em 4 helpers determinísticos/dedicados. **Redução medida: -89,98% no inline (9.348 → 937 chars)** = ~-2.100 tokens por turno.

**5 agentes paralelos + 1 auditor** (sessão 2026-05-21 manhã):
- Agent 1 → `_shared/promptRules.ts` (NOVO): exporta `buildPromptRulesString()` com 5 regras de tom (LEIA toda msg, NUNCA repita pergunta, NUNCA ECOAR, primeiro nome, profissão→set_tags). 937 chars. 3/3 tests.
- Agent 2 → `_shared/responseValidator.ts` (NOVO): exporta `validateLLMResponse(text, ctx)` cobrindo 7 regras determinísticas (anti-negative_phrases, anti_internal_error, anti_internal_leak, anti_echo_opener, anti_recumprimento, name_overuse, hallucinated_price). 185 lin. **Modo telemetria** nesta sprint (só `log.warn`). 19/19 tests.
- Agent 3 → `_shared/searchGuard.ts` (estendido): nova função `detectIncomingSearchSignal({ text, knownBrands })` cobre R121 ("tem X?") e marca→search imediato. +91 lin. 28/28 tests (15 antigos + 13 novos). **Não wirado nesta sprint** (Edit 3 = ALTO RISCO, fica pro Sprint B5 após split).
- Agent 4 → `_shared/handoffGuard.ts` (estendido): `shouldBlockHandoffForPayment` + `mentionsPaymentTopic`. +87 lin. 23/23 tests (8 antigos + 15 novos). **Wirado** em `case 'handoff_to_human'`.
- Agent 5 → wire plan em `/tmp/B1_WIRE_PLAN.md` (4 edits, 7 riscos mapeados).
- Auditor (Agent 6 — pós-edit): verificou 5 destinos + 5 wire points. **Veredito: PASS COM RESSALVAS** (ressalvas esperadas pelo plano).

**Wire aplicado em `ai-agent/index.ts`:**
1. Import dos 4 helpers novos (linhas 19-25)
2. Declaração `const hardcodedRules = ...` REMOVIDA (era 25 linhas / 9.3 KB)
3. `systemPrompt` array agora usa `buildPromptRulesString()` (linha ~2008)
4. `case 'handoff_to_human'` chama `shouldBlockHandoffForPayment` ANTES da lógica (linha ~3676) — bloqueia handoff quando lead pergunta sobre pagamento (PIX/desconto/parcelamento/boleto/cartão) e devolve mensagem pro LLM responder com business_info
5. `validateLLMResponse` chamado em modo telemetria antes do validator LLM (linha ~3997-4016)
6. `validatorAgent.ts` prompt estendido com 4 regras órfãs (INTERNO leak, erro interno, eco genérico, recumprimento mid-convo) — cobre as 7 violações no LLM validator também

**Pipeline:**
- `npx tsc --noEmit`: ✅ 0 erros
- `npx vitest run`: ✅ 913 pass / 9 fail pré-existentes (idêntico a Sprint A — FormBuilder + useForms + excludedProducts não-relacionados). **+50 testes novos do B1 todos pass.**
- Deploy de edge fns: **PENDENTE de aprovação do user** (não foi feito automaticamente)

**Riscos / follow-up:**
- Edit 3 (searchGuard PRÉ-LLM wire) pulado: requer duplicar ~70 linhas de search inline. Fica pro Sprint B5 após split do `index.ts`. R121/brand→search continuam ativas via `evaluateSearchGuard` (R126) + prompt principal.
- `responseValidator` em telemetria por 1-2 semanas pra coletar volume real antes de virar enforcement.
- B2/B3/B4/B5 (Sprint B restante) ainda pendentes.

**Arquivos tocados (10):** 4 novos + 4 estendidos + 1 modificado + 1 ai-agent/index.ts.

---

### Plano Orquestrador 2026-05-21 (meta — documentação)

Plano completo da transição monolito→orquestrador+specialists documentado em 2 wikis (parte 1 visão+Sprint B, parte 2 Sprint C+D+métricas). Sem código novo — só planejamento detalhado com medições reais.

**Medições:** prompt assembled HOJE = 280-310 linhas / 26 KB. Target Sprint B = 150 lin. Target Sprint C+D = router 25 lin + specialist 30-70 lin.

**3 Sprints (6 semanas):**
- Sprint B: B1 extrair hardcodedRules (9.3 KB → 5-8 lin no prompt + validator/guards), B2 strict mode 9 tools, B3 sub_agents→agent_profiles reader, B4 varredura curto-circuitos R134, B5 split index.ts em 6 fases
- Sprint C: Router gpt-5-nano + product_specialist POC com feature flag routing_mode, E2E sandbox comparativo
- Sprint D: qualification/handoff/objection/greeting specialists + migração 100%

**Artefatos:** [[wiki/plano-orquestrador-subagentes]] + [[wiki/plano-orquestrador-subagentes-part2]]

---

### v7.39.0 + Auditoria 360° + Plano Orquestrador (2026-05-21) — arquivado

> Movido para [[wiki/changelog/2026-05-part8]] em 2026-05-21 (hard limit 300 linhas). Conteúdo: Sprint A da auditoria (7 P0s fechados + I2 + I3, ai-agent v74), Auditoria 360° 5 ondas (veredito 5.9/10), Plano Orquestrador (3 sprints / 6 semanas).

---

### v7.38.8 (2026-05-21) — R133+R134: regex overlap tintas↔impermeabilizantes + loop R129 (caso Branca)

**Queixa do user:** print Branca (558781754008) — IA respondeu "Posso te ajudar com **tintas e vernizes**, impermeabilizantes e mantas e caixas d'água..." (lead nunca pediu tinta) e repetiu a MESMA pergunta 2x.

**Auditoria via SQL confirmou:**
- Tag conv: `multi_interesse_pending:tintas,impermeabilizantes,caixas_dagua` (3 cats — `tintas` fantasma)
- `ai_agent_logs` mostrou 2 `response_sent` idênticos com `source: r129_multi_interesse_ask`
- Único overlap do banco todo: termo `impermeabilizante` aparecia em ambas regex `tintas` E `impermeabilizantes` (3 agents Eletropiso afetados)

**R133 (regex overlap):**
- Migration `20260521120000_R133_remove_impermeabilizante_from_tintas_regex.sql` faz UPDATE jsonb em `ai_agents.service_categories` removendo `|impermeabilizante` da regex `tintas` (3 agents atualizados, idempotente)
- Seed default em `_shared/serviceCategories.ts:95` corrigido (`tinta|esmalte|verniz|~~impermeabilizante~~` → `tinta|esmalte|verniz`) — novos tenants nascem corretos
- 6 testes novos em `serviceCategories.test.ts` (125/125 PASS) cobrindo: matchCategory direto, matchCategoryBySearchText, matchAllCategoriesBySearchText com seed default + config Eletropiso realista

**R134 (loop R129):**
- `ai-agent/index.ts:1771` guarda `!alreadyHasMultiPending` adicionada antes do bloco curto-circuito R129 — quando tag já existe, deixa LLM processar resposta do lead via `buildQualificationContext` em vez de re-enviar mesma pergunta
- `buildQualificationContext` reforçado com regras explícitas pra LLM lidar com resposta do lead à pergunta multi: (a) escolha clara → set_tags 1 valor, (b) "ambos" → escolhe 1ª categoria + diz "vou começar com X", (c) vago → primeira da lista

**Cleanup manual:** tag corrompida `multi_interesse_pending:tintas,...` removida da conv Branca (176f7c6f). Tags `interesse:tintas` + `ambiente:interno` (também erradas) limpas. Próxima msg da lead vai re-processar do zero com regex corrigida.

**Arquivos:**
- `supabase/migrations/20260521120000_R133_*.sql` (UPDATE jsonb idempotente)
- `supabase/functions/_shared/serviceCategories.ts` (seed regex)
- `supabase/functions/_shared/serviceCategories.test.ts` (+6 testes; 125/125)
- `supabase/functions/ai-agent/index.ts` (guarda R134 + qualificationContext reforçado)

**Deploy:** `npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓

---

### v7.38.7 (2026-05-21) — R132: IA ignorou transcrição de áudio (Edson, EletropisoV2)

**Lead Edson (558781302237) mandou "Bom dia" → "Edson" → áudio "Você tem a quartisolite rejunto pra piscina?" → IA respondeu pergunta genérica "Edson, em que tipo de material...".** Logs mostraram `incoming_text="Edson"` + `incoming_has_audio=false` — ai-agent processou só o texto, ignorou a transcrição que já estava populada na tabela.

**Causa raiz (família Camada 3 — 4º incidente):** o pipeline áudio é assíncrono. Texto entra no debounce queue imediato; áudio passa por transcribe-audio (~5-10s extra) e chega tarde demais — vira queue paralelo órfão, ou marca `processed=false` mas é pulado. Bug `ai-agent/index.ts:308-322` lia só `m.content` do queue, e como `content=""` pra áudio (transcrição vive em coluna separada `conversation_messages.transcription`), `.filter(Boolean)` removia a mensagem áudio inteira do contexto do LLM.

**Mesma família que:** R126 Camada 3 (msgs chegando durante processamento — Guttemberg), C8 multi-msg combined (saudação+intent), R50 race debounce (backlog).

**Fix B (re-leitura DB antes do LLM):**
- Novo `_shared/incomingMessagesLoader.ts` (110 lin) — helper testável com 4 funções puras (`buildIncomingFromDbRows`, `buildIncomingFromQueue`, `calcLowerBoundTs`, `loadIncomingMessages`).
- Estratégia: usar `queuedMessages[0].timestamp - 2s` como lower-bound, query `conversation_messages WHERE direction='incoming'` no intervalo, priorizar `transcription` sobre `content`. Quando DB retorna ≥1 row útil, substitui `incomingMessages` inteiro pelo array normalizado; senão fallback pro queue (comportamento pré-R132).
- Log estruturado `R132 db-vs-queue divergence resolved` registra quando DB enriquece resultado (auditoria/debug).

**Arquivos:**
- `supabase/functions/_shared/incomingMessagesLoader.ts` (helper, 110 lin)
- `supabase/functions/_shared/incomingMessagesLoader.test.ts` (14 testes — Edson repro, áudio+texto combinados, fallback DB error, empty queue, exceções)
- `supabase/functions/ai-agent/index.ts` (import + integração no bloco 308-322, ~30 lin com log)

**Pipeline:** typecheck 0 erros. Vitest 849 pass / +14 novos / 9 falhas pré-existentes (URL imports Deno + FormBuilder/useForms intocadas).

**Deploy:** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v64 ACTIVE.

**Lição R132.** Pipeline assíncrono multi-canal (texto+áudio, texto+imagem-OCR-future, etc.) precisa de defesa em profundidade no consumidor final, não confiar que o queue produzido pelos webhooks captura 100% do estado real. **Re-ler a fonte de verdade (tabela) antes da decisão crítica** é o padrão que cobre toda a família Camada 3.

---

### v7.38.6 (2026-05-21) — R131: phrasing curto na 2ª+ pergunta do stage (sem "Para encontrar a melhor opção" repetido)

**Queixa do user:** print do helpdesk Eletropiso mostrando IA repetindo "Para encontrar a melhor opção, qual X?" 3x seguidas (ambiente, tipo, cor) na qualif de tintas — soa robótico.

**Causa:** `formatPhrasing(stage.phrasing, field)` em `_shared/serviceCategories.ts` aplicava o MESMO template do stage pra cada field. Stage `identificacao` da categoria `tintas` tem 1 só `phrasing` ("Para encontrar a melhor opção, qual {label}? ({examples})"), então cada slot reusa o preâmbulo.

**Fix híbrido (não mexe em DB nem comportamento do LLM, só no formatter):** `formatPhrasing` aceita 3º parâmetro `answeredCountInStage` (default 0). Se `>= 1`, substitui o template pela variante curta `"Qual {label}? ({examples})"` (ou `"Qual {label}?"` quando sem examples). Mantém determinismo (LLM continua copiando phrasing literal), só varia a abertura.

**Resultado caso Eletropiso:**
- 1ª: "Para encontrar a melhor opção, qual ambiente? (interno ou externo)"
- 2ª: "Qual tipo de tinta? (acrílica, esmalte sintético, epóxi)"
- 3ª: "Qual cor? (branco, cinza, etc.)"

**Arquivos:**
- `supabase/functions/_shared/serviceCategories.ts` (+8 lin no `formatPhrasing`)
- `supabase/functions/_shared/serviceCategories.test.ts` (+4 testes R131; 120/120 passam)
- `supabase/functions/ai-agent/index.ts` (3 call sites passam `answeredCountInStage`: linhas ~1687, ~2182, ~3407)

**Considerada e rejeitada:** opção "deixar LLM reformular" — desfaria determinismo conquistado em R124-R130. Híbrido cosmético é o trade-off certo.

---

### v7.38.5 (2026-05-21) — R127/R128/R129/R130: multi-categoria, loop "ambiente da janela", sale_closed false positive

**4 bugs descobertos por E2E real (10 jornadas via Sandbox UAZAPI → EletropisoV2). 9/10 PASS.**

**R127 — loop "Para qual ambiente você precisa da janela?":** lead pediu porta+janela, `mergeTags` fazia REPLACE-by-key silencioso (`interesse:portas` sobrescrito por `interesse:janelas`), depois LLM inventava field `ambiente_janela` que não existe na categoria janelas. Fix: `_shared/setTagsValidator.ts` (14 testes) rejeita 2+ valores em mesma key; caso especial `interesse:` devolve instrução pra LLM perguntar ao lead qual começar.

**R128 — `sale_closed_detected` false positive em "quero comprar":** regex `\bquero\s+(comprar|levar|fechar)\b` em `saleClosedDetection.ts` pegava INTENÇÃO de compra no início da conversa como SALE CLOSED. Resultado: handoff prematuro com `venda:fechada` + `ia:shadow` antes de qualquer qualif. Fix: removido o padrão ("bora comprar" idem); só "bora fechar", "fechei", "combinado", "comprovante", "pix" disparam agora.

**R129 — auto-extract escolhe 1ª categoria silenciosamente em multi:** `matchCategoryBySearchText` retorna PRIMEIRO match. Lead diz "porta + janela" → setou só `interesse:portas`, ignorou janela. Fix: novo `matchAllCategoriesBySearchText` + curto-circuita o LLM se 2+ categorias detectadas: envia direto "Posso te ajudar com X e Y. Por qual prefere começar?" + seta tag `multi_interesse_pending:CSV`.

**R130 — após escolha lead, LLM improvisa field inválido:** depois do `set_tags(interesse:NEW)`, qualificationContext do prompt fica stale → LLM perguntava "ambiente da janela" mesmo sem field existir (chegou a usar `send_poll` com opções inventadas "sala/cozinha/quarto/banheiro" pra janelas!). Fix: flag `pendingForcedNextQuestion` setada no handler set_tags; após LLM gerar resposta, se LLM divergiu (não menciona o phrasing OU usou send_poll), OVERRIDE com a frase exata da próxima pergunta da categoria nova.

**Arquivos:**
- `supabase/functions/_shared/setTagsValidator.ts` (helper testável + 14 testes)
- `supabase/functions/_shared/saleClosedDetection.ts` (remove `\bquero\s+(comprar|levar|fechar)\b`)
- `supabase/functions/_shared/serviceCategories.ts` (`matchAllCategoriesBySearchText` + `multi_interesse_pending` em BASE_VALID_TAG_KEYS)
- `supabase/functions/ai-agent/index.ts` (~80 lin: integração 4 fixes + flag override pós-LLM)
- Migration `20260521003000_*` adiciona `set_tags_duplicate_keys_rejected` ao CHECK constraint

**E2E real (10 cenários sandbox 558185749970 → 558781592373):**
- C1 ✅ "bom dia" → greeting + para
- C2 ✅ "porta alumínio" → qualif portas (R126 Camada 2)
- C3 ✅ "oi/Maria/comprar material" → sem sale_closed false positive (R128)
- C4 ✅ "porta+janela alumínio" → "Posso te ajudar com portas e janelas..." (R127+R129)
- C5 ✅ "janela primeiro" → "Pra encontrar a janela certa, material?" (R130 override)
- C6 ✅ "tinta acrílica branca pra parede" → qualif + handoff outside hours
- C7 ✅ "qual o preço?" → não chuta carrossel (R126)
- C8 ⚠️ "oi tudo bem? + vaso sanitário" → LLM ignorou 2ª parte (Camada 3 backlog)
- C9 ✅ "tinta, fechadura e torneira" → R129 com 3 categorias
- C10 ✅ "bom dia! comprar fechadura digital" → qualif fechaduras (R128 não disparou)

**Pipeline:** typecheck 0 erros. searchGuard 15 + setTagsValidator 14 + handoffGuard 8 = 37 testes novos.

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
