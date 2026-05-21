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

### v7.40.3 (2026-05-21) — Sprint B3: reader sub_agents → agent_profiles

Reader único pra perfil de atendimento. UI já tinha migrado na M17 F3 (2026-04-09); agora o `ai-agent` e o `ai-agent-playground` também. Pré-requisito do Sprint C — cada specialist futuro vai ter `agent_profiles` row própria.

**Mudanças:**
- Migration `20260521000001_sprint_b3_backfill_agent_profiles.sql`: backfill `agent_profiles` (4 rows × 2 agentes ativos = 8) + trigger AFTER INSERT em `ai_agents` cria default profile automático em novos agentes.
- Novo `_shared/profileReader.ts`: `loadActiveProfile(supabase, {agentId, funnelProfileId})` cascade funnel→default. 9 testes unitários.
- `ai-agent/index.ts`: substitui 24 lin de load manual (666-688) + 29 lin de reader legado (1532-1560) por chamadas ao helper. Telemetria `sub_agent` agora grava `profileData?.id || 'no_profile'`.
- `ai-agent-playground/index.ts:67`: usa helper compartilhado em vez de `buildSubAgentInstruction(agent.sub_agents)`.
- `buildSubAgentInstruction` em `agentHelpers.ts` continua exportado por 1 sprint (dívida pra B5 + drop coluna).

**Resultado:** -53 linhas no `ai-agent/index.ts`. 1 ponto de leitura de perfil em vez de 2 schemas competindo. `subAgentInstruction` agora sempre `''` (prompt do perfil já injetado em `funnelInstructionsSection`).

**Pipeline:** tsc 0 erros · vitest 958 pass (+9 novos) / 9 fail pré-existentes. Deploy ai-agent v77→v78 ACTIVE + ai-agent-playground v2→v3 ACTIVE via CLI.

**Sprint B status:** B1 ✅, B1.5 ✅, B2 ✅, B3 ✅. Restante: B4 (varredura R134), B5 (split index.ts — pré-req Sprint C).

**Deferred pra B5/B6:** drop coluna `ai_agents.sub_agents` · aposentar `SubAgentsConfig.tsx` da UI · remover `buildSubAgentInstruction` helper · atualizar `nicheTemplates.ts` pra seedar `agent_profiles` em vez de `sub_agents`.

---

### v7.40.2 (2026-05-21) — Sprint B2: strict mode em 9 tool schemas

`strict: true` + `additionalProperties: false` nas 9 tool schemas. Pré-req gpt-5-mini ✅ (Sprint A). Esperado: **alucinação args 3% → <0,1%** (R125-R127 família dissolvida no schema, não no prompt).

**Mudanças:**
- `_shared/llmProvider.ts`: `LLMToolDef` ganha `strict?: boolean`. `callOpenAI` injeta `strict:true` + `additionalProperties:false` quando flag setada (opt-in seguro pras outras edge fns).
- `ai-agent/index.ts:2097-2186`: 9 toolDefs ganham `strict: true`. As 5 desalinhadas (`search_products`, `send_carousel`, `send_media`, `update_lead_profile`, `send_poll`) reformuladas — opcionais → `["TIPO","null"]` + todos args em `required[]`. 4 já alinhadas (`assign_label`, `set_tags`, `move_kanban`, `handoff_to_human`) só ganham flag.

Handlers downstream JÁ defensivos contra null (`if (args.X)`, `X || default`). Sem ajuste.

**Pipeline:** tsc 0 erros · vitest 949 pass / 9 fail pré-existentes. Deploy ai-agent v76→v77 ACTIVE.

**Sprint B status:** B1 ✅, B1.5 ✅, B2 ✅. Restante: B3 (sub_agents reader), B4 (varredura R134), B5 (split index.ts — pré-req Sprint C).

---

### v7.40.1 (2026-05-21) — Sprint B1.5: fix R135 (anti-loop qualif) + R136 (multi-item horizontal)

**2 bugs reais em prod fixados** após v7.40.0 (paz + Paloma, ambos EletropisoV2):

- **R135** — IA repetiu LITERAL "Qual material? (granito, mármore, inox ou sintético)" depois do lead responder "Mas simples mesmo". Causa: `buildQualificationContext` reinjetava "FRASE EXATA SUGERIDA" sem detectar que o lead já tinha respondido no turn anterior sem casar com keywords.
- **R136** — IA ignorou lista multi-item "1 massa PVA / 1 Latão de tinta branco neve / 15 lixas d'água N° 150" e qualif só `tintas`, perdendo os 2 itens sem categoria cadastrada. Causa: sistema afunilou em mono-categoria quando só 1 categoria cadastrada casou na lista.

**Regra definida pelo user:** lista multi-item mista (cadastrado + não-cadastrado) → **qualificação horizontal** (1 pergunta abrangente sobre ambiente + marca/tipo + qualidade) → handoff rico com lista preservada. Vale também pra single-item-fora-catálogo.

**3 novos helpers (3 agentes paralelos):**
- `_shared/multiItemDetector.ts` (239 lin) — detecta lista numerada/comma/newline-separated, classifica items por categoria, devolve `{ detected, items, mixed, orphanCount, reason }`. 16/16 tests. Repro Paloma exato OK.
- `_shared/horizontalQualif.ts` (133 lin) — gera pergunta horizontal adaptativa (tintas → ambiente+marca+tipo+qualidade; portas/janelas → material+tamanho; só orphans → genérica) + constrói handoff reason rico (lista preservada + contexto + msg original). 10/10 tests.
- `_shared/qualificationAntiLoop.ts` (90 lin) — detecta se sistema está prestes a reinjetar mesma phrasing já enviada no turn anterior. Quando repeating=true, devolve nudge instruindo LLM a interpretar resposta do lead ou reformular com contexto. 10/10 tests. Repro paz exato OK.

**Wire em `ai-agent/index.ts` (5 edits):**
1. Imports dos 3 helpers
2. `buildQualificationContext` ganha branch prioritário pra tag `qualif_horizontal:pending` (força handoff_to_human imediato com reason no formato estruturado)
3. Fix R135 inline em `buildQualificationContext`: chama `detectQualifLoop`; quando repeating, substitui "FRASE EXATA SUGERIDA" pelo nudge
4. Call site de `buildQualificationContext` passa últimas 8 msgs do contexto
5. ANTES do bloco R129 (multi-categoria cadastrada), detector multi-item: se `mixed=true`, envia pergunta horizontal + seta tag pending + return (curto-circuita LLM, igual padrão R129)

**Pipeline:**
- `npx tsc --noEmit`: 0 erros
- `npx vitest run`: 949 pass / 9 fail pré-existentes (FormBuilder/useForms/excludedProducts — não-relacionados). **+36 testes novos B1.5 todos pass.**
- Deploy `ai-agent` v75 → v76 ACTIVE
- 4 arquivos novos + 1 estendido + vault particionado (erros-e-licoes 312→215, R124-R134 → wiki/erros/historico-2026-05-part3.md)

**Comportamento esperado pós-deploy:**

| Cenário | Antes | Depois |
|---|---|---|
| Lead manda lista multi-item mista | Afunila em 1 categoria, ignora orphans | 1 pergunta horizontal → handoff rico |
| Lead responde fora do menu ("mais simples") | IA repete frase literal | IA interpreta ou reformula com contexto |
| Lead manda 2+ categorias cadastradas | R129 dispara "qual prefere começar?" (mantido) | Mantido |
| Lead manda 1 item único | Qualif normal por field (mantido) | Mantido |

**Follow-up:** monitorar logs `r136_multi_item_horizontal` + `R135 anti-loop` por 3-5 dias. Casos edge devem voltar pra Sprint C (router + qualification_specialist) como comportamento natural do prompt.

**Regras preventivas:** [[wiki/erros/regras-preventivas]] entradas 135 + 136.

---

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
