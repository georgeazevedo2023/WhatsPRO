---
title: Changelog
type: changelog
updated: 2026-05-18
audited_at: 2026-05-18
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.37.20 (2026-05-19) — R121 catalog_status + busca direta "tem X?" + migração Eletropiso v2

**Bug fix R121 (5 cenários auditados por 5 agentes paralelos).** Lead da Eletropiso perguntou "vcs tem mesa de plastico?" e bot respondeu "Para confirmar, você está interessado em mesas de plástico?" em vez de buscar ou qualificar — confirmação supérflua quando o lead já foi explícito.

**7 camadas defense-in-depth (3 determinísticas + 2 prompt + 1 validator + 1 governança):**

- **C1 `catalog_status` (digital/offline/none)** no schema `service_categories` — distingue categoria com produtos cadastrados (Camada 1) de categoria que vendemos sem catálogo digital (Camada 2). `serviceCategories.ts` + `src/types/serviceCategories.ts` + UI dropdown em `ServiceCategoriesConfig.tsx`. 21 cats Eletropiso marcadas como `offline`, 3 como `digital`.
- **C2 Auto-extract search trigger** — `ai-agent/index.ts:1741` estende Bug 24 v5 com else-if `search_products`. Score >= max_score + exit_action=search_products + catalog_status=digital → `pendingExitActionSearch` inline.
- **C3 Pre-LLM "tem X?" trigger** — `ai-agent/index.ts:1685-1715` regex `/(?:vcs?|você(s)? )?(?:tem|t[êe]m|vende[mn]?|fazem|trabalham\s+com)/i` detecta pergunta direta + categoria + catalog_status=digital → força search inline antes do LLM. Offline cai no fluxo natural (qualif + handoff sem dizer "não temos").
- **C4 Bloco "FATOS JÁ ESTABELECIDOS"** — `ai-agent/index.ts:1583` substitui listagem crua `Tags atuais: interesse:mesas, material_mesa:plástico` por bloco semântico legível com fields humanizados. LLM tem instrução explícita pra não reperguntar.
- **C5 Validator confirmation rule** — `validatorAgent.ts:90` regra GRAVE (-3) detecta "Para confirmar / Só pra confirmar / Você está interessado em / Você quer dizer / Entendi corretamente / Só esclarecendo / Confirmando" como início de resposta + reescreve.
- **C6 Prompt tightening** — `ai-agent/index.ts:1617+1627` estende lista proibida de prefixos + adiciona regra absoluta "LEAD PERGUNTOU TEM X? → search_products IMEDIATO" empatando prioridade com MARCA MENCIONADA.
- **C7 UI Admin** — dropdown `catalog_status` no editor de categoria + badge visual "Sem catalogo digital" no card list.

**R121 fix lookup webhook (queries em cascata):**
- `whatsapp-webhook/index.ts:532` — antes OR PostgREST quebrava com espaço em `instanceName` ("Sandbox IA"). Refatorado pra `eq()` separadas: token → owner_jid → id → name. Token tem prioridade máxima (único por instância). Necessário porque ambas Eletropiso (antiga e v2) tem mesmo `name="Eletropiso"` no UAZAPI.

**Migração Eletropiso v2 (+558781592373):**
- Nova instância `re662a6d32de7e0` criada aditiva — antiga preservada e DESABILITADA (`disabled=true` + `ai_agents.enabled=false`).
- Inbox `01a9c21d-98c8-4225-805a-18e79e7df719`, dept `5240c457-...` (queue_mode_enabled=false, default_assignee=Lucas único), agent `1062059a-...`.
- Clone integral: 56 colunas ai_agent + 24 service_categories + 13 excluded_products + 7 produtos com URLs de imagem compartilhadas.
- Handoff garantido pro Lucas via Modo OFF (handoffQueue.ts:168 cai em default_assignee_id sem exceções).
- Doc: [[wiki/migracao-eletropiso-558781592373]].

**Toggle Ativar/Desativar no dropdown 3-pontos do `AIAgentTab`** — antes só Editar/Duplicar/Excluir. Agora `handleToggleEnabled` faz UPDATE direto + toast + auto-refresh do badge.

**DB Reset pré-migração** — 32 tabelas truncadas via CASCADE (1941 msgs, 24 convs, 21 contacts, 18 leads). Configs/users/templates preservados. Doc: [[wiki/db-reset-2026-05-19]].

**Lição:** Defense-in-depth com 3 camadas determinísticas garante que LLM não pode burlar regras críticas — mesmo se prompt for ignorado, validator regrava ou auto-extract força ação correta. Vai pra `wiki/erros/regras-preventivas.md` como R122.

---

### v7.37.19 (2026-05-18) — Fila Inteligente bot/IA não fecha mais evento + UI revalida em tempo real

Dois bugs distintos corrigidos no D30 Fila depois que user reportou que handoff pra Lucas nunca rotacionava pro próximo da fila (Alberto/Jussara/Djavan/Slone).

**R115 — `handoff_queue_events` fora da publication realtime (UI stale).** Hook `useActiveQueueEvents` só recebia broadcast HTTP `fireAndForget` do cron — quando broadcast falhava silente a UI ficava com snapshot antigo do badge "Em fila — X (0:00)" para sempre. A tabela nunca foi adicionada ao `supabase_realtime` publication.

- Migration `20260518000000_handoff_queue_events_realtime_publication.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE handoff_queue_events` (idempotente). Aplicada via MCP.
- `src/hooks/useActiveQueueEvents.ts` — 3 camadas defense in depth: postgres_changes event='*' canônico + broadcast legacy mantido + poll fallback 3s quando evento ativo passou `expires_at`.

**R116 — `detectResponded` confundia msg do bot com resposta do atendente.** A msg de handoff do IA ("Vou conectar você...") é inserida ~7s após criar o evento, batia o grace de 5s, e `requeue-conversations/index.ts:140-153` contava qualquer outgoing como "atendente respondeu" → marcava `responded` → fila não rotacionava. George teve 3 eventos consecutivos com esse padrão.

- `requeue-conversations/index.ts` `detectResponded` agora filtra `.not('sender_id', 'is', null)`. Atendente humano via helpdesk preenche `sender_id` com user_id; IA/bot deixa NULL — discrimina perfeitamente.
- `RESPONDED_GRACE_SECONDS` ampliado de 5 → 15s (defense em camada).
- Deploy via CLI (`prfcbfumyrrycsrcrvms`).

**Validação 5 cenários E2E paralelos (sem Playwright, SQL puro):**
- A — George handoff natural 5min30s + 2 msgs bot ✅ Lucas timed_out → rotação
- B — Maria 3 msgs bot pós-handoff ✅ Lucas timed_out → Alberto rot 1
- C — Wrap-around Slone (qp50) → Lucas (qp10) ✅ pulando Josafá gerente
- D — Humano com `sender_id=Lucas` ✅ fechou `responded`, fila parou (caso positivo do filtro)
- E — Ciclo completo 6 rotações com wrap ✅

5/5 PASS. Bug confirmado: antes count=1 falso positivo na detecção, depois count=0 (mesmo evento, mesma query). Sem impacto em msgs reais de atendente.

**Files:**
- `supabase/functions/requeue-conversations/index.ts` (R116)
- `src/hooks/useActiveQueueEvents.ts` (R115)
- `supabase/migrations/20260518000000_handoff_queue_events_realtime_publication.sql` (R115)
- `wiki/erros/regras-preventivas.md` (R115 + R116 entries)
- `log.md` (registro)

---

### v7.37.18 (2026-05-17) — Bug 29-32 handoff fora horário sem horários FIXADO

User reportou que IA atendeu normal fora do horário (greeting + nome + qualif "trena profissional"), mas o transbordo enviou msg genérica *"Perfeito! Anotei seu pedido... assim que estivermos disponíveis"* sem mencionar horário. Esperado: msg explicando Seg-Sex 8h-18h, Sáb 8h-12h.

**Diagnóstico:** sistema funcionou correto (enviou `handoff_message_outside_hours`), mas o texto cadastrado pra Eletropiso estava genérico. Coluna LEGADO `out_of_hours_message` (que tinha o texto detalhado) não é mais lida desde D32 (2026-05-13).

**Bugs catalogados:**
- **B29** P1: Eletropiso `handoff_message_outside_hours` sem horários → atualizado pelo `UPDATE ai_agents` no DB prod
- **B30** P2: coluna LEGADO `out_of_hours_message` ainda em `ALLOWED_FIELDS` (AIAgentTab.tsx) → removida
- **B31** P2: fallback genérico do `pickHandoffMessage` sem horários → helper novo `enrichOutsideHoursMessage` em `_shared/businessHours.ts` injeta prefix com horários quando msg não menciona (regex `/\d{1,2}h\b|horário|seg-/i` detecta presença)
- **B32** P3: placeholder do admin UI sem direção → atualizado com exemplo + hint

**Helper novo:** `formatBusinessHours(business_hours)` agrupa dias consecutivos (Seg-Sex 8h-18h, Sáb 8h-12h). Tratamento de formato weekly + legacy. 13 testes Vitest novos.

**Validação E2E 5 cenários (Sandbox UAZAPI → Eletropiso prod, domingo 20:50 BRT):**
- C1 trena+profissional → handoff outside_hours COM horários ✅
- C2 trigger "vendedor" → handoff outside_hours COM horários ✅
- C3 cama box (excluded) → resposta educada + sugestões ✅
- C4 tinta acrílica fosco branco Suvinil → max_score → handoff outside_hours COM horários ✅
- C5 reabertura D34 (conv resolvida 2d) → status_ia=ligada + `reaberta:DATE` + tags preservadas + IA usa nome conhecido ✅

5/5 PASS. Acidente meio-caminho: deploy via MCP `deploy_edge_function` com content="" derrubou ai-agent prod (verify_jwt:true + version vazia). Recuperado em 1min via supabase CLI. Lição: NUNCA usar MCP `deploy_edge_function` pra ai-agent — sempre CLI `npx supabase functions deploy ai-agent` que entende shared imports.

Vitest: 27 passam em businessHours.test.ts (14 originais + 13 novos). tsc 0 erros. 9 falhas pré-existentes (FormBuilder, useForms, detectores) intactas.

### v7.37.15 (2026-05-17) — Bug 17 v2 + Bug 24 v5 search_products FIXADOS

User questionou backlog Bug 17 + Bug 24 search_products. Fixei ambos:

**Bug 17 v2 (recumprimento) - strip determinístico:** o strip antigo (linha 3481) só pegava `^(Olá|Oi|Ei|Hey),?\s*NOME`. Expandido pra regex multiline cobrindo `olá|ola|oi+e?|ei|hey|opa|eae|eai|fala|salve|bom dia|boa tarde|boa noite|bem-vindo` + nome opcional + qualquer linha. Limpa espaços/quebras resultantes. Não confia no LLM.

**Bug 24 v5 search_products (mirror do v4 handoff):** flag `pendingExitActionSearch: {query, category}` setada quando `score>=max_score && exit_action=search_products`. Query construída das tags (interesse + tipo_X + cor + ambiente + marca, excluindo meta-keys como motivo/lead_score/ia). Bloco inline pós-merge chama `executeToolSafe('search_products', {query, category})` e injeta resultado no retorno do set_tags pro LLM usar. Log `tool_called source=bug24v5_set_tags_inline`.

**Validação E2E 2 testes (Sandbox UAZAPI → Eletropiso prod, domingo):**
- TI tinta Pedro: LLM chamou search natural (score 15 < max 40, v5 inline não precisou disparar). Carrossel ok. Sem "Olá Pedro!" ✅
- TII tinta Sandra (7 turnos): 7 outgoing msgs sem "Olá Sandra!" ✅. 2 carrosseis disparados. Score 80, tags ricas (`interesse:tinta, ambiente:interna, acabamento:fosco, tipo_tinta:acrílica, marca_preferida:Coral, quantidade:5L`).

**Total acumulado sessão hoje: 15 releases (v7.37.0→v7.37.15), 13 bugs fixados.** Só Bug 27 minor (score cross-turn em disjuntor) em backlog.

Screenshot: `wiki/validacoes/bug17_24sp_validados.png`.

---

### v7.37.11-v7.37.14 (2026-05-17) — Bug 26+27 FIXADOS (4 PASS limpos em 5 testes E2E)

User: "fixar bug 27 e rodar mais 5 testes". Foco em Bug 27 (LLM pula `set_tags interesse` em várias categorias) + Bug 26 (LLM repete `interesse:hidraulica` mesmo após Bug 25 bloquear).

**Bug 27 fix (v7.37.11)**: handler `search_products` faz auto-seed de `interesse:CAT` via `matchCategoryBySearchText(query+incomingText)` se conv ainda não tem. Plus: auto-extract fields. Log `auto_field_extracted source=bug27_search_products_seed`.

**Bug 26 fix v3 (v7.37.14)** — 3 iterações:
1. v1: sugestão textual no retorno do set_tags. LLM ignorou.
2. v2: só rodava quando `newTags.length === 0`. Quebrou em casos misto (LLM enviou `[interesse:hidraulica, tipo_vaso:acoplado]`).
3. v3 (final): dispara SEMPRE que tag `interesse:*` foi rejeitada E conv ainda não tem interesse. Insere `interesse:CAT` correto direto em `newTags` via `matchCategoryBySearchText` no incomingText. Log `source=bug26_auto_apply_correct_category`.

**Validação E2E (5 testes Sandbox UAZAPI → Eletropiso prod, domingo fechada):**
| # | Cenário | Tags Final | Resultado |
|---|---|---|---|
| T1 | Sofia → lampada LED 12W | `interesse:lampadas` (corrigido de `iluminacao`), score 30 | ✅ handoff outside_hours |
| T2 | Felipe → disjuntor 32A bipolar | `interesse:disjuntores`, score 15 | ⚠️ Bug 27 ok, score split em turnos |
| T3 | Beatriz → vaso sanitário acoplado branco | `interesse:vaso_sanitario` (de `hidraulica`), score 30 | ✅ handoff |
| T4 | Lucas → torneira cozinha bancada | `interesse:torneiras` (de `hidraulica`), score 30 | ✅ handoff |
| T5 | Rafael → cano água 50mm | `interesse:cano` (de `hidraulica`), score 30 | ✅ handoff |

**4 PASS limpos + 1 parcial** — vs sessão anterior **0 PASS** nesses 5 cenários.

**Combinado com Bug 24 v4** (v7.37.10), as 23 categorias agora rodam handoff-completo end-to-end. **3 camadas de defesa em código**: Bug 25 bloqueia ID inválido → Bug 26 v3 auto-corrige pra ID certo → Bug 27 seed se LLM pular set_tags → Bug 24 v4 dispara handoff direto quando score atinge max. **LLM vira passageiro — backend força o caminho certo.**

**Bugs em backlog (não bloqueantes):** 17 regressão (recumprimento), 24 search_products (tinta), 27 minor (score progressivo cross-turn).

Screenshot: `wiki/validacoes/5testes_pos_bug26_27.png`. Arquivos: `ai-agent/index.ts` (~50 linhas search_products handler + ~20 set_tags handler).

---

### v7.37.10 (2026-05-17) — Bug 24 v4 FIXADO: RPC fantasma escondia o inline handler

User pediu "continuar até nota 10". Foco no Bug 24 v3 que não disparava (CRÍTICO — 90% das jornadas falhavam).

**Debug via breadcrumbs em ai_agent_logs** (sem stderr porque não é confiável em edge fns): adicionei inserts diretos no DB nos pontos chave do handler set_tags. Reteste J4 chuveiro/220v revelou:
- Breadcrumb `bug24_flag_set` apareceu (`pendingExitActionHandoff_setado=true`) ✅
- Breadcrumb `bug24_checkpoint_pre_inline` **NÃO apareceu** ❌

Handler retornava ANTES do bloco inline.

**Root cause:** `supabase.rpc('merge_conversation_tags', ...)` no handler set_tags. **RPC NÃO EXISTE no projeto novo** (`prfcbfumyrrycsrcrvms`). Confirmado via `SELECT proname FROM pg_proc WHERE proname='merge_conversation_tags'` → vazio. RPC retornava error → caía no fallback path → fazia merge in-memory → **return PRECOCE** pulando todo o resto do handler, incluindo o bloco Bug 24 v3 inline (handoff direto).

**Fix v7.37.10 (Bug 24 v4):** unifiquei os 2 paths. Ambos resolvem `merged` numa única variável; fluxo continua linearmente até o bloco inline. Sem `return` precoce.

**Validação E2E:** J4 chuveiro/220v retest → IA enviou EXATAMENTE `handoff_message_outside_hours` + `event=implicit_handoff reason=exit_action_set_tags_inline` + status_ia=shadow + ia:shadow tag + lead_score:30. ✅

**Impacto:** corrige o caminho CRÍTICO de handoff automático para categorias com `exit_action=handoff` no max_score do stage. Toda jornada de 2 fields × 15 score = max 30 agora dispara handoff direto correto (chuveiros, ferramentas, torneiras, canos, fechaduras, disjuntores, lâmpadas, vasos — quando LLM tagueia o `interesse:CAT` corretamente).

**Lição preventiva (R[novo]):** quando uma fn chama `supabase.rpc('X', ...)` E tem fallback com `return`, SEMPRE conferir se a RPC existe no DB atual. RPC missing causa fallback silencioso + return precoce que mascara código novo posterior. Buscar em todo codebase: `grep "supabase.rpc.*}.*return" -A 3`. Auditar.

**Bugs ainda em backlog (não bloqueantes):** Bug 17 regressão, Bug 24 search_products, Bug 26 LLM repete categoria inválida, Bug 27 LLM pula set_tags interesse. Próxima sessão.

Arquivos: `ai-agent/index.ts` (~10 linhas — refator de 2 paths em 1). Screenshot: `wiki/validacoes/bug24_v4_chuveiro_validado.png`.

---

### v7.37.8 / v7.37.9 (2026-05-17) — Sessão 10 jornadas E2E + Bug 25 fix + 4 bugs catalogados

User pediu 10 jornadas E2E completas. Resultado: **2 PASS + 1 parcial + 7 FAIL** — 5 bugs novos identificados, 1 fixado e validado em prod (Bug 25), 4 em backlog.

**Bug 25 (FIXADO + VALIDADO PROD):** o guard Bug 19 só bloqueava `interesse:CAT` se a categoria existia + regex não batia. Quando LLM cravava categoria **TOTALMENTE INEXISTENTE** no schema (ex: `interesse:hidraulica` quando só temos `torneiras`/`canos`), o guard passava silencioso porque `matchCategory()` retornava null e o if falhava. Fix: rejeitar também quando categoria não existe + log `interesse_hallucination_blocked, reason=category_not_in_schema`. **Validado em J5 prod** (cano água) — log mostra bloqueio 2x.

**Bug 24 v2 / v3 (DEPLOY EM PROD MAS NÃO FUNCIONOU):** tentativa de disparar handoff direto no `set_tags` handler quando score atinge max + exit_action=handoff (mirror do Bug 18 sale_closed). 2 abordagens deployadas (flag pós-loop em v7.37.8 + inline no handler em v7.37.9) — nenhuma disparou em prod. Suspeita: closure entre o handler dentro de `executeTool` (linha 2011) e a flag `pendingExitActionHandoff` declarada no scope serve (linha 452). Precisa debug com `console.error` + `get_logs`.

**Bugs em backlog:**
- **17 regressão** (LLM recumprimenta apesar da regra hardcoded)
- **24 v2 inline** (CRÍTICO — score=max → IA vazia, 90% das jornadas falham)
- **24 search_products** (categoria tinta nunca dispara search direto)
- **26 LLM repete categoria inválida** (mesmo após Bug 25 bloquear)
- **27 LLM pula set_tags interesse** (vai direto pra search sem tageiar)

**Sumário das 10 jornadas (Sandbox UAZAPI → Eletropiso prod, domingo fechada):**

| # | Jornada | Resultado |
|---|---|---|
| J1 | tinta acrílica fosco branco | ❌ Bug 17 regressão + Bug 24 search_products |
| J2 | porta madeira sala frisada | ✅ PASS `handoff_message_outside_hours` correto |
| J3 | torneira cozinha bancada Deca | ❌ LLM crava `interesse:hidraulica` |
| J4 | chuveiro elétrico 220v | ❌ Bug 24 v2/v3 não dispara, IA vazia |
| J5 | cano água 50mm | ⚠️ Bug 25 funcionou (block × 2) mas LLM persiste |
| J6 | lampada LED 12W | ❌ Bug 27 (sem interesse tag) |
| J7 | disjuntor 20A bipolar | ❌ Bug 27 |
| J8 | fechadura externa tetra-chave | ❌ LLM usa singular (`fechadura`) → score parcial |
| J9 | vaso sanitário acoplado branco | ❌ sem interesse tag, fields inventados |
| J10 | cama de casal (excluded) | ✅ PASS excluded reply funcionou |

**Causa-raiz dominante:** os fixes determinísticos (handlers, guards) funcionam isoladamente. Mas o **LLM em si** ainda não respeita regras hardcoded. Estratégia daqui pra frente: mais defesa em código (helpers compartilhados, validators), menos confiança no comportamento do LLM.

Screenshot: `wiki/validacoes/10jornadas_helpdesk.png`. Detalhes em `log.md`.

---

### v7.37.7 (2026-05-17) — Bug 24: auto-extract bypassava `exit_action` enforcement

User reportou: lead → trena → uso=profissional → **IA parou de responder**. Sem handoff, sem coleta, sem texto. Log `response_sent` com `response_text: ""`.

**Root cause:** o `exit_action` enforcement do R83 (instrução "AÇÃO chame handoff_to_human AGORA" injetada quando score atinge `max_score` do stage) só rodava DENTRO do `set_tags` handler (linha 2846). Mas o **auto-extract (Bug 13 fix da manhã, linha 1640)** pega fields deterministicamente sem passar pelo handler. Categoria `ferramentas_manuais`: T3 auto-tag `tipo_ferramenta:trena` (+15), T4 auto-tag `uso_ferramenta:profissional` (+15 = score 30 = max). Sem enforcement, LLM no T4 ficou sem direção → texto vazio.

**Fix:**
1. Auto-extract agora calcula `scoreDelta` (`calculateScoreDelta` helper) e adiciona `lead_score:N` à `mergedTags`.
2. Se `newScore >= stage.max_score && exit_action='handoff'`, seta flag `pendingExitActionHandoff` (mirror do `pendingSaleClosedHandoff` do Bug 18).
3. **Novo bloco** posicionado IMEDIATAMENTE após o auto-extract dispara o handoff (`pickHandoffMessage` respeita outside_hours, `runQueueAssignment`, broadcast, log `event=implicit_handoff, reason=exit_action_auto_extract`). Return early — LLM nem roda.

**Bug de ordem corrigido na hora:** primeira tentativa posicionou o bloco ANTES do auto-extract (junto do `pendingSaleClosedHandoff`). Flag sempre `null` quando avaliado → handoff nunca disparava. Validação E2E pegou na hora (`pending_exit_handoff: true` no log mas IA continuou respondendo). Mover o bloco pra DEPOIS do auto-extract resolveu.

**Validação E2E (4 turnos, domingo, Eletropiso fechada):**
- T1-T3: greeting → "Joao, em que posso te ajudar?" → "Pra te ajudar, uso? (profissional ou doméstico)"
- T4 "profissional" → IA enviou EXATAMENTE `handoff_message_outside_hours` ("Perfeito! Anotei... assim que estivermos disponíveis...") + status_ia=shadow + ia:shadow + lead_score:30 ✅

**Paridade admin UI ↔ código:** `ServiceCategoriesConfig.tsx` (admin) → `ai_agents.service_categories` JSONB → `getCurrentStage`/`matchCategoryBySearchText`/`autoExtractFields` (`_shared/`) → enforcement no `set_tags` handler **e agora também no auto-extract** (Bug 24 fix).

**Regra preventiva:** todo caminho determinístico pré-LLM que persiste tags (auto-extract, regex detectors, futuros) DEVE replicar o pipeline de score + exit_action enforcement. Considerar refactor `applyTagsWithScoreEnforcement()` helper compartilhado pra evitar 3º path bypassar.

**Cruza com:** Bug 13 fix (auto-extract), Bug 18 (pendingSaleClosedHandoff mirror), R83 (exit_action enforcement original 2026-04-29).

Arquivos: `ai-agent/index.ts` (~30+35 linhas). 2 deploys (corrigi bug de ordem). Screenshot: `wiki/validacoes/bug24_validado.png`.

---

### v7.37.6 (2026-05-17) — Bug 21+22: validator BLOCK ignorava outside_hours + transbordo prematuro

User reportou: lead "boa tarde" → "george" → "voces tem trena?" → IA respondeu *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno."* — handoff prematuro (faltava `uso_ferramenta` da categoria `ferramentas_manuais`) + mensagem regular em domingo (Eletropiso fechada — devia ser `_outside_hours`).

**Root cause:** o **validator BLOCK path** (linha antiga 3344) era o 4º caminho de handoff que escapou do fix do Bug 16 v7.37.3. Usava `agent.handoff_message` direto, sem `pickHandoffMessage` helper, sem checar `outside_hours`, e sem log `event=handoff` (invisível em observabilidade). E disparava transbordo mesmo com qualificação incompleta.

**Fix v7.37.6 — validator BLOCK reescrito em 2 frentes:**

1. **Bug 22 (msg correta):** `pickHandoffMessage({agent, profileData, funnelData, outsideHours})` aplicado. Adiciona log `event='handoff', metadata.reason='validator_block', outside_hours, queue` — observabilidade restaurada.

2. **Bug 21 (transbordo prematuro):** guard novo — se `qualificationContext` ainda contém `"PRÓXIMA PERGUNTA OBRIGATÓRIA"` (qualif incompleta), validator BLOCK NÃO transborda. Extrai a `"FRASE EXATA SUGERIDA"` do qualif context via regex e envia ao lead como próxima pergunta. Log `event='response_sent', metadata.source='validator_block_qualif_fallback'`. Handoff só ocorre se NÃO há qualif pendente OU lead pede explicitamente.

**Validação E2E (mesmo cenário do user — Sandbox UAZAPI → Eletropiso prod, domingo fechado):**
- T1 "oi" → greeting
- T2 "sou o Joao" → "Joao, em que posso te ajudar hoje?" (Bug 19 ok)
- T3 "voces tem trena?" → **"Pra te ajudar, uso? (profissional ou doméstico)"** ✅ Bug 21 ok
- T4 "profissional" → IA pergunta comprimento (LLM improvisou — Bug 23 paralelo)
- T5 "5 metros, fechar" → IA pergunta tipo de trabalho (enrichment)
- T6 "quero falar com vendedor agora" → **EXATAMENTE `handoff_message_outside_hours`** ("...assim que estivermos disponíveis...") ✅ Bug 22 ok. `status_ia=shadow`, `ia:shadow` aplicada

**Regra preventiva:** todo path de transbordo (handoff_to_human, auto, deferred, **validator BLOCK**, futuros) DEVE usar `pickHandoffMessage` helper. Buscar `agent.handoff_message ||` periodicamente — qualquer uso direto sem o helper é red flag de 5º caminho.

Arquivos: `ai-agent/index.ts` (~60 linhas no validator BLOCK path). tsc=77 (igual ao pre-fix, zero regressão). Screenshot: `wiki/validacoes/bug21_22_validado.png`.

**Cruza com:** v7.37.3 Bug 16 (fix de 3 paths anteriores), [[wiki/erros-e-licoes#bug-21-22]].

**Backlog Bug 23 (achado durante validação):** LLM em fase de enrichment improvisa pergunta sobre field NÃO cadastrado em `service_categories` (perguntou "comprimento" pra trena, não está no schema). Investigar: *"limitar improvisação LLM em enrichment / schema dinâmico — 2026-05-18"*.

---


### Releases anteriores hoje (v7.37.0 → v7.37.5) — arquivado

Detalhe completo em [[wiki/changelog/2026-05-17-v7.37.0-v7.37.5]]: v7.37.0 D34 reabertura conv, v7.37.1 Bug 13 auto-extract, v7.37.2 Bug 15b contact_id, v7.37.3 Bug 16 paths handoff, v7.37.4 Bugs 17+18 sale_closed + recumprimento, v7.37.5 Bug 19 anti-hallucination interesse.

### Releases anteriores (≤v7.36.6)

Arquivadas em [[wiki/changelog/]]:
- [[wiki/changelog/2026-05-14]] — v7.36.5 (loop fila + retention), v7.36.6 (bugs 8+11)
- [[wiki/changelog/2026-05-part5]] — v7.36.0-v7.36.4
- [[wiki/changelog/2026-05-part4]], [[part3]], [[part2b]], [[part2a]], [[part1]]
- [[wiki/changelog/2026-04-part1]] [[part2a]] [[part2b]]
- [[wiki/changelog/2026-pre-04-part1]] [[part2]] [[part3a]] [[part3b]]
