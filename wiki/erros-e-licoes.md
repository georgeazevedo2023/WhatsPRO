---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-05-30
audited_at: 2026-05-30
---

# Erros e Lições

> **Consultado no INÍCIO de cada sessão** (Protocolo de Início, passo 3 do `CLAUDE.md`). Verifique se o erro que você está prestes a cometer já está aqui.

## Mapa

- **Top-3 lições recentes** (incidentes da última semana): abaixo
- **Tabela de regras preventivas** (~30 regras): [[wiki/erros/regras-preventivas]]
- **Histórico detalhado** (R91-R114): [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]]
- **Arquivo histórico** (abril e anteriores): [[wiki/erros-arquivo-historico-abril]]

---

## 🚨 Sessão 2026-05-30 (noite) — 4 incidentes: fila runaway · catálogo-vazio · greeting · phantom release (v7.58.1-4)
Detalhe: CHANGELOG/log + memórias [[project_queue_rotation_runaway_v7581]] · [[project_empty_catalog_handoff_v7583]] · [[project_greeting_hallucinated_interest_v7584]].
1. **Fila rotacionava INFINITAMENTE** (114 convs, rotation_number 293, ~4.7k eventos/24h, OOF "fora de horário" reenviada todo dia). Dedup era POR-EVENTO e a rotação reciclava eventos. **Regras:** (a) toda rotação/retry precisa de **CAP** (parar após N voltas pelos elegíveis); (b) dedup de ação lead-facing deve ser por **entidade DURÁVEL** (conversa + atividade do lead), NUNCA por linha efêmera (evento); (c) `external_id` carimba a ORIGEM (`queue_oof_`/`abandon_`/`follow_up_`/`ai_agent_`) — é o 1º diagnóstico de "quem mandou". **Mesma família** do "fila sem constraint explodiu banco" (abaixo): loop operacional sem teto.
2. **Catálogo-vazio premium NUNCA transbordava (loop + repergunta):** decisão comparava `answered.has(field.key)` com keys SUFFIXADOS da categoria (`ambiente_torneira`), mas o LLM grava GENÉRICAS (`ambiente:`). **Regras:** (a) comparação de chave entre camada LLM e camada determinística DEVE normalizar (base genérica ↔ key específica); (b) convergência/handoff NUNCA pode depender de "todos os campos coletados" quando o LLM tagueia genérico — precisa de **CAP de perguntas**; (c) **fixture de teste com keys genéricos ESCONDE o bug** — o teste passava porque divergia do schema do DB real; fixture deve espelhar produção.
3. **Greeting INVENTOU interesse pra lead NOVO** ("você estava vendo pisos"; ele nunca falou — viés de "Eletro·piso"). Gate de "returning" era TER-NOME → lead recém-apresentado virava recorrente; o exemplo no prompt (`"você estava vendo [interesse]"`) convidava o LLM a PREENCHER inventando; e o memory-block contava o resumo da PRÓPRIA conversa em andamento. **Regras:** (a) "lead recorrente" se gateia em FATO CONCRETO (interesse/produto de conversa ANTERIOR), nunca em ter-nome; (b) NUNCA dar exemplo com placeholder `[X]` que o LLM completa — é convite à hallucinação; (c) memória de retomada não pode incluir a conversa atual. **Cruza** Bug 19 (LLM alucina interesse, abaixo).
4. **Phantom release:** deep-qualify + abandono estavam DEPLOYADOS mas nunca commitados → repo ≠ prod (meus fixes assumiam arquivos untracked). **Regra (reforço):** deploy SEM commit é incompleto; commitar antes/junto. Bônus: migration aplicada com version gerado ≠ version do arquivo (`000002` vs `234430`) → `db push` re-aplicaria (OK porque `CREATE OR REPLACE` é idempotente, mas alinhar pra não poluir histórico).

## 🚨 R149 — `interesse_match` sem fronteira casava substring (biodigestor→portas) — v7.57.5, detalhe no CHANGELOG/log 2026-05-30
Cliente pediu biodigestor 1500L; IA ofereceu PORTAS + transbordou "pedido de portas". **Causa:** categoria portas tem `interesse_match: "porta|portas"` e o regex era `new RegExp(pattern,'i')` SEM fronteira → casou `porta` dentro de **"portanto"** (transcrição de áudio). Mesma classe: `cabo`⊂"acabou", `cano`⊂"canoa", `mesa`⊂"mesada", `piso`⊂"Eletro**piso**". **Fix:** `buildInteresseRegex` (fonte única nos 5 pontos) com lookaround de letra accent-safe (`\b` do JS falha com acento) + sufixo `(?:s|es|ns)?` p/ tolerar plural quando a config só lista singular + valida pattern cru antes de embrulhar. Config: `"caixa d"` (prefixo substring) → variantes explícitas nos 3 agentes (senão fronteira pararia de casar "caixa de água"). **Lições:** (1) regex de config exposto a texto livre SEMPRE com fronteira de palavra; (2) em pt-BR use lookaround `[A-Za-zÀ-ÿ]`, nunca `\b` (acento não é `\w`); (3) ao endurecer um matcher, varra os patterns que dependiam do comportamento frouxo (prefixos tipo "caixa d") pra não trocar bug por bug.

## 🚨 R148 — router não injetava Informações da Empresa → IA inventou cidade da loja (v7.57.4, detalhe no CHANGELOG/log 2026-05-29)
Lead: "essa loja é em São João né?" → IA confirmou; loja é Garanhuns-PE. Endereço estava CERTO no `business_info` — IA inventou. **Causa:** `buildBusinessSection` (+`REGRA ABSOLUTA: NÃO invente`) só ia no monolito; o systemPrompt do specialist (`specialistBase.runSpecialist`) não tinha → sob `routing_mode='router'` (os 3 agentes) ninguém sabia o endereço. **Fix:** injeta `buildBusinessSection(ctx.agent)` no systemPrompt. **Lições:** (1) migração monolito→specialist exige checklist de paridade de **contexto** (todo bloco do prompt), não só tools/boundary; (2) dado certo no DB+UI ≠ chega no prompt — o que importa é o consumo no caminho ATIVO; (3) info de negócio sem regra anti-invenção = LLM concorda com suposição errada do lead.

## 🚨 R146/R147 — qualify-first expôs 2 bugs (E2E prod 2026-05-24, v7.50.0)
**R146 — `so_se_pedir` cortava em 8 msgs:** código caía em `?? 8` (igual `apos_n_msgs`) contra o contrato-doc ("lead controla, max alto"). Qualify-first (+turnos) batia no handoff genérico antes do rico. Fix: default → 40. **Lição:** contrato-doc vs código divergentes = código errado.
**R147 — handoff specialist (gpt-4.1-mini) vazava tool call como TEXTO** (`functions.handoff_to_human({...})`) em vez de invocá-la → handoff não executava + lead via sintaxe crua. Fix: → gpt-4.1 + `stripLeakedToolCalls`. **Lição:** specialist que DEPENDE de tool precisa de modelo confiável + saneamento.

## 🚨 R141 — TDZ `carouselSentInThisCall` (prod 2026-05-22, fix v7.41.8) — detalhe em [[wiki/erros/historico-2026-05-part2]]
`let carouselSentInThisCall` declarado dentro do LLM loop, mas `executeTool` (escopo enclosing) acessava antes via `runInlineSearchProducts` pré-LLM → **TDZ throw silenciado pelo executeToolSafe** → loop idiota. Crash só virou diagnosticável quando R140 persistiu stack trace. Fix: mover o `let` pro topo do handler. **Lições:** (1) `let`/`const` são hoisted SEM init (TDZ); declarar TODO state mutável ANTES de functions do mesmo escopo. (2) Observability (R140) PRIMEIRO, antes de chutar root cause. (3) vitest mock de tool isolada NÃO pega TDZ do caminho real — integration test precisa exercitar index.ts→executeTool→tool. Cruza: R140, R58, R59.

---

## 🚨 R138 — PostgREST `.or()` crashou com vírgula em `.ilike.%value%` (Wsmart Eletropiso 2026-05-22 19:13, prod)

**Erro:** primeira tentativa do R137 v7.41.4 quebrou em prod. Lead Wsmart (558193856099, conv 5b78ee46) mandou *"Por quanto está a tinta pintalar da Iquine, de 3,6L?\ncom george"* fora do horário. R137 wire detectou marca Iquine + construiu query bruta + chamou `search_products` inline. Search **crashou** com `"Erro interno ao executar search_products. Responda ao lead sem usar este resultado."` IA caiu no fallback (handoff outside_hours) com `qualification_chain: "Wsmart > tintas"` (raso).

**Causa raiz:**
- `escapeLike` em `agentHelpers.ts:172` escapa apenas `%`, `_`, `\`. NÃO escapa `,`.
- PostgREST `.or()` separator é `,`. Quando value de `.ilike.%X%` contém vírgula não-escapada, parser quebra: 400 Bad Request.
- Query R137 v7.41.4: `"iquine por quanto esta a tinta pintalar da , de 3,6l? com george"` — 2 vírgulas → throw.
- Bug é PRÉ-EXISTENTE do `escapeLike` (qualquer LLM mandando query com vírgula crasharia). R137 v1 só expôs porque construía query bruta sem sanitização.

**Fix v7.41.6 (defesa em 2 camadas):**
- **Camada 1 (entry de `searchProducts.ts`):** `cleanSearchQuery(raw)` strip `, ; : " ' ? ! ( ) [ ] { }` → espaço + colapsa whitespace. Aplicado em `args.query` e `args.category` no entry.
- **Camada 2 (R137 wire em `preLLMAutoExtract.ts`):** `stripLeadNameSuffix` (remove "com X" / "meu nome é X" do fim) + `cleanSearchQuery` antes de setar `pendingExitActionSearch`.

**6 integration tests reais** (`r137-integration.test.ts`) com mock supabase que REJEITA `.or()` mal-formado (simula PostgREST 400). Reproduzem o crash exato + 5 cenários. 6/6 PASS.

**Regras preventivas:**
1. **Helper escapeLike é insuficiente pra PostgREST `.or()`.** O comma é parser-significant. Qualquer value em `.ilike.%X%` dentro de `.or(...)` deve passar por sanitização forte — não só wildcards SQL.
2. **Testes unit limpos não pegam bugs de integração com PostgREST.** Vitest mocks de supabase precisam SIMULAR comportamento real do parser (rejeitar `,` em values), senão dão falso-positivo. R137 v7.41.4 tinha 8/8 unit tests passing mas crashou em prod.
3. **Quando extrair query do texto bruto do lead, SEMPRE sanitizar.** Texto do WhatsApp pode ter qualquer pontuação. Pre-existing bug do escapeLike + nova feature que constrói query crua = recipe pra crash.
4. **Defesa profunda > defesa pontual.** Layer 1 (entry de searchProducts) cobre TODOS os callers (LLM, R137, futuros). Layer 2 (R137 wire) é redundante mas garante que o problema não atravessa o boundary do módulo.

**Cruza com:** R137 (causa originadora), R121 (regex verbose), R126 (search guard).

---

## 🚨 R137 — IA pediu "qual produto?" 4× após lead nomear marca+volume (Sandrielly Eletropiso, 2026-05-22 17:43-17:51, prod)

**Sequência:** lead 558781324150 → "Boa tarde" → IA "Olá! Bem-vindo a Eletropiso, com quem eu falo?" → lead "**Por quanto está a tinta pintalar da Iquine, de 3,6L?**" + "Com Sandrielly" → IA **"Sandrielly, você poderia confirmar qual produto do nosso catálogo de tintas você deseja?"** → lead re-mandou produto exato → IA pergunta categoria de novo → IA lista 5 categorias → IA "tinta da categoria 'tintas'?" → 1 pergunta útil (ambiente) → handoff. **7 minutos de loop, search_products NUNCA rodou.**

**Causa raiz:** helper `detectIncomingSearchSignal` em `_shared/searchGuard.ts:157` cobre exatamente esse caso ("iquine" no `DEFAULT_BRANDS`) + R121 verboso ("preciso de/quero"). Grep do código ativo mostrou única menção em `ai-agent/index.ts` é comentário (linha 1444). **A chamada nunca foi feita.** Plano `wiki/plano-orquestrador-subagentes.md:55` marca como *"Edit 3 (searchGuard PRÉ-LLM wire) pulado — defer Sprint B5"*. Sprint B1 extraiu hardcodedRules do prompt mas a regra "marca → search imediato" ficou só como texto descritivo no prompt. LLM ignorou.

**Diferença pra R135/R136:**
- **R135** = repete pergunta LITERAL quando lead respondeu sem casar keyword → `qualificationContext` re-injeta frase exata. Fix B1.5 cobriu.
- **R136** = lista multi-item mista → `multiItemDetector` + horizontal qualif. Fix B1.5 cobriu.
- **R137** = lead nomeia produto+marca+volume SINGLE-ITEM mas LLM cai em qualif genérica porque `DIRECT_PRODUCT_QUESTION_RE` só pega verbo (`tem|vendem|trabalham com`) → não bate "Por quanto está X?". Brand detection ficou solta sem wire.

**Fix v7.41.4 (R137 wire):**
1. `preLLMAutoExtract.ts` importa `detectIncomingSearchSignal` + `DEFAULT_BRANDS`.
2. Novo bloco depois do R121 inline existente: quando `signal.force=true` em categoria digital + `!leadHasReceivedProducts` + `!SHADOW`, seta `pendingExitActionSearch` (mesma máquina do R121).
3. `exitActionDispatcher.runInlineSearchProducts` executa o search no caminho atual sem qualquer mudança upstream.
4. 8 testes vitest novos cobrindo caso Sandrielly exato + variações.

**Regras preventivas:**
1. **Helper extraído mas NÃO wired ainda existe.** Sempre que se extrair helper de pipeline crítico, grep imediato pra confirmar a chamada. Se não há chamada, o helper é cosmético — bug latente é só questão de tempo de aparecer.
2. **Regra "X → ação Y" em texto de prompt não é defesa.** Se a ação Y é determinística (chamar uma tool específica), implementa em código pré-LLM. Prompt é pra ambiguidade, código é pra invariantes.
3. **Marca conhecida tem 2 caminhos de detecção:** R121 verboso ("preciso de Iquine") + brand isolada ("Por quanto está Iquine?"). Antes do R137, só o 1º funcionava de fato. Brand-only ficou solto desde sempre.
4. **Cada fix textual no prompt sem guard determinístico paralelo é débito.** Auditoria 2026-05-21 viu isso (`hardcodedRules` cresceu 9 KB / 23 bullets). Sprint B1 extraiu, mas a transferência pra guards determinísticos foi parcial. Wires pulados viram bugs como Sandrielly.

**Cruza com:** R121 (regex verboso), R125-R127 (post-search filter, complementar), R135-R136 (loops de qualif).

---

## 🚨 R135 + R136 — IA repetiu pergunta literal + ignorou lista multi-item (2 leads Eletropiso, 2026-05-21 17:46-17:50, prod)

**2 bugs simultâneos pós-deploy v7.40.0 (Sprint B1).** Não causados pelo B1 — eram comportamentos pré-existentes do `buildQualificationContext` e do detector de multi-categoria.

### R135 — paz (558791319539, conv `691b0017`)

**Sequência:** lead "Me manda valor de pia para banheiro" → IA "Qual material? (granito, mármore, inox ou sintético)" (correto) → lead "Mas simples mesmo" → IA **repetiu LITERAL "Qual material? (granito, mármore, inox ou sintético)"**. Lead "Granito" + "E sintético" → handoff.

**Causa:** `buildQualificationContext` viu `material_pia=null` (porque "mas simples" não casa com keywords) e re-injetou a FRASE EXATA SUGERIDA. LLM transcreveu literal sem usar inteligência pra inferir "mais simples = sintético" ou reformular a pergunta com contexto.

### R136 — Paloma Pinheiro (558182563943, conv `0740250f`)

**Sequência:** lead "1 massa PVA / 1 Latão de tinta branco neve / 15 lixas d'água N° 150" → IA qualif só de **tintas** (ambiente/tipo) → lead reespondeu "Interno" + "qualidade primeira a tinta" → IA "Paloma, para qual produto você precisa do orçamento?" **(IGNOROU lista que já tinha)** → lead REPETIU lista → IA "qual tipo de tinta?" → lead "Acrílica" → handoff por `message_limit` (8/8).

**Causa:** `matchAllCategoriesBySearchText` só achou `tintas` (massa PVA + lixas não têm categoria cadastrada). Sistema afunilou em mono-categoria, ignorou massa PVA + lixas como ruído. R134 multi_interesse_pending só dispara com 2+ categorias **cadastradas** detectadas.

### Regra que o user definiu (2026-05-21)

> **Lista multi-item mista (cadastrado + não-cadastrado) deve disparar qualificação horizontal:** IA pergunta 1 coisa abrangente (ambiente, marca/tipo, qualidade) cobrindo os 3 itens, depois handoff com motivo rico (lista + contexto). Vale também pra single-item-fora-catálogo.

### Fix v7.40.1 — Sprint B1.5 (em progresso 2026-05-21)

- `_shared/multiItemDetector.ts` (novo) — detecta lista numerada + classifica items por categoria
- `_shared/horizontalQualif.ts` (novo) — monta pergunta horizontal + handoff reason rico
- `_shared/serviceCategories.ts` — `buildQualificationContext` ganha branch anti-repetição quando lead respondeu turn anterior sem casar

**Regras preventivas:** [[wiki/erros/regras-preventivas]] entradas 135 + 136.

---

## 🚨 R132 — IA ignorou transcrição de áudio (Edson, EletropisoV2 v7.38.7, 2026-05-21)

**Erro:** lead Edson (558781302237) mandou "Bom dia" → "Edson" → áudio (transcrição populada "Você tem a quartisolite rejunto pra piscina?") → IA respondeu pergunta genérica "Edson, em que tipo de material ou produto você tem interesse hoje?". Log `response_sent` mostrou `incoming_text="Edson"` + `incoming_has_audio=false` — ai-agent não enxergou a transcrição.

**Causa raiz (4º incidente família Camada 3):** pipeline áudio é assíncrono. Texto entra direto no `ai_debounce_queue.messages` (content="Edson"), debounce de 10s dispara `ai-agent` rapidamente. Áudio passa por `transcribe-audio` (~5-10s Groq Whisper) e só DEPOIS chama `ai-agent-debounce` com `content=transcription`. Mas o queue do "Edson" já foi processado/marcado — a transcrição vira queue paralelo órfão ou é simplesmente ignorada. Pior: na linha `ai-agent/index.ts:311-314`, `incomingText = msgs.map(m.content || '').filter(Boolean)` — pra áudio inicial com content="", `.filter(Boolean)` removia a row inteira do array.

**Mesma família que:** R126 Camada 3 (Guttemberg "porta+janela" enquanto greeting processava), C8 multi-msg combined (saudação+intent na mesma turno), R50 race debounce (backlog). 4º caso reportado da família.

**Fix v7.38.7 (Fix B — re-leitura DB antes do LLM):**
1. Novo `_shared/incomingMessagesLoader.ts` (helper testável, 4 funções puras + 14 testes)
2. Estratégia: `lower_bound = queue.first_message_at - 2s` → query `conversation_messages WHERE conversation_id=X AND direction='incoming' AND created_at >= lower_bound LIMIT 20`. Priority: `transcription` sobre `content`. Quando DB tem ≥1 row útil, substitui `incomingMessages` inteiro pelo array normalizado; senão fallback pro queue (comportamento pré-fix preservado).
3. Log estruturado `R132 db-vs-queue divergence resolved` quando DB enriquece.

**Regras preventivas:**
1. **Pipeline assíncrono multi-canal (texto+áudio+OCR+...) NÃO pode confiar 100% que o queue captura o estado real.** O queue é construído pelos webhooks; eles correm contra a clock real do banco. Defesa em profundidade é o consumidor final re-ler a fonte de verdade (a tabela) antes da decisão crítica.
2. **`.filter(Boolean)` em arrays de mensagens é uma armadilha** — qualquer row com `content=""` (áudio, imagem, sticker, audio-only-button) some silenciosamente. Sempre cruzar com colunas alternativas (`transcription`, `media_url`, `caption`) antes de filtrar.
3. **Family Camada 3 (race áudio + race msg-during-processing + race multi-msg) tem causa comum:** queue-based pipelines não são fonte de verdade. Toda nova feature que dependa de "última N mensagens do lead" deve consumir do DB direto, não do queue.

---

## 📦 R124 → R134 — arquivados em wiki/erros/historico-2026-05-part3

> Movido em 2026-05-21 (hard limit 300 linhas). Conteúdo: R124 handoff bloqueado, R125 badge fila OFF, R126 cross-categoria, R127-R130 multi-categoria + sale_closed false positive, R131 phrasing repetitivo, R133+R134 overlap regex + loop R129. Veja [[wiki/erros/historico-2026-05-part3]].

---

## 🚨 Deploy via MCP `deploy_edge_function` com content vazio derrubou prod — incidente 2026-05-17

**Erro:** chamei `mcp__supabase__deploy_edge_function({name:"ai-agent", files:[{"name":"index.ts","content":""}]})` achando que o MCP carregaria o arquivo local. Não carrega — o `content` é o blob real enviado pro Supabase. Resultado: ai-agent prod virou version 55 com index.ts vazio + `verify_jwt:true` (default do MCP), derrubando todas as chamadas internas (debounce, webhook → ai-agent). Janela de impacto ~1min.

**Como detectei:** `list_edge_functions` logo depois mostrou `verify_jwt:true` (config.toml local tem false) + version vazia. Sinal de alarme imediato.

**Fix:** `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` redeployou o source completo (40+ arquivos `_shared` incluídos automaticamente) + restaurou `verify_jwt:false` do `config.toml`. Version 56 ACTIVE.

**Regras preventivas:**
1. **NUNCA use MCP `deploy_edge_function` pra funções complexas** que importam `_shared/*.ts`. O MCP precisa do conteúdo de cada arquivo explicitamente — passar só `index.ts` deixa shared sem upload. CLI `npx supabase functions deploy <name>` resolve imports automaticamente.
2. **Após qualquer deploy de função crítica, validar imediatamente:** `list_edge_functions` deve mostrar `verify_jwt` conforme `config.toml` + `version` recém-atualizada + `ezbr_sha256` diferente do anterior. Se algum check falhar, redeploy via CLI.
3. **Funções no `config.toml` com `verify_jwt=false` (ai-agent, debounce, webhook, requeue, transcribe-audio, assign-handoff, etc.) DEVEM permanecer assim** — são chamadas internas por cron com `CRON_AUTH_KEY` ou por outras edge fns com `INTERNAL_FUNCTION_KEY`. Gateway com `verify_jwt:true` rejeita esses tokens.

---

## 🚨 Bug 19 (v7.37.5) — IA alucina interesse:CAT sem o lead pedir — incidente 2026-05-17

**Erro:** lead disse "boa tarde" + "George" (só nome). IA respondeu *"George, para qual material você está procurando a porta? Temos opções em madeira, PVC ou alumínio."* — LLM cravou tag `interesse:porta` via set_tags sem o lead mencionar produto algum. Auto-extract não foi culpado (regex `porta|portas` não bate em "George"); foi o LLM chutando pra "ter o que perguntar" + set_tags handler aceitando sem validar.

**Fix (v7.37.5):**
1. Guard determinístico no handler `set_tags`: tags `interesse:CAT` exigem que o regex `interesse_match` da categoria bate em pelo menos uma incoming do lead na sessão. Se não, rejeitar + log `interesse_hallucination_blocked`.
2. Regra hardcoded no prompt instruindo a IA a perguntar "No que posso ajudar?" quando lead só disse nome/saudação.
3. Migration: adiciona event `interesse_hallucination_blocked` + `auto_field_extracted` ao CHECK constraint de `ai_agent_logs` (R114).

**Regras preventivas:**
- Todo handler que persiste estado controlado por LLM (tags, profile, kanban move, status) DEVE validar contra evidência no histórico do lead — nunca confiar cegamente no payload do LLM.
- LLM em input trivial CHUTA pra completar o turno. Defesas determinísticas no servidor são a forma de garantir robustez.

---

## ✅ Bugs 17+18 (v7.37.4) — VALIDADO PROD 2026-05-17

**Bug 17 (LLM recumprimentava no meio da conv) + Bug 18 (sale_closed → handoff vazio):** fixados em v7.37.4 (commit 96e9283). Validação E2E REAL em prod via Sandbox UAZAPI → Eletropiso prod (5 turnos pós-greeting, helpdesk observado em tempo real via Playwright):
- Bug 17: 0 recumprimentos em 5 turnos consecutivos. IA usa nome como vocativo curto ("Maria, a Tinta...") sem "Olá NOME!".
- Bug 18: ai_agent_logs registrou `sale_closed_detected` + `implicit_handoff` (reason=sale_closed, sale_type=fechado, outside_hours=true, assignee=Djavan). Msg enviada = `handoff_message_outside_hours` exata. status_ia=shadow + tags `venda:fechada` + `ia:shadow` aplicadas. Detalhes em `log.md`.

---

## ⚠️ Fuzzy pg_trgm + LLM tag inválida = cross-category leak + fallback genérico — incidente 2026-05-14

**Erro 1 (Bug 8):** lead pediu "chuveiro elétrico" → `search_products` retornou carrossel de **tinta**. `pg_trgm` fuzzy (threshold 0.3) casa "chuv" contra "Sol e Chuva" tinta acrílica, bypassando o filtro de categoria. Auto-tag pós-search ainda **sobrescrevia silente** `interesse:chuveiros_eletricos` por `interesse:tintas` via `mergeTags` (replace-by-key).

**Erro 2 (Bug 11):** quando search falhava, IA respondia genérico "Para te ajudar melhor, me conta detalhes do chuveiro? **(exemplos: sala, cozinha, quarto ou banheiro)**". Examples não fazem sentido pra chuveiro — eram um **exemplo literal hardcoded** dentro da instrução `phrasingDiscipline` em `ai-agent/index.ts:1797`. LLM copiava o exemplo como se fossem os exemplos reais a usar, independente de categoria.

**Erro 3 (Bug bonus 12):** LLM crava `interesse:hidraulica` pra chuveiro elétrico (categoria inexistente nas 23 da Eletropiso). `matchCategory('hidraulica', config)` retorna null → caía no `default` category com pergunta genérica.

**Fix (v7.36.6):**
1. Helper novo `filterProductsByExpectedCategory(products, expectedCategory)` aplicado 2x (antes E depois do fuzzy).
2. `expectedCategory` via fallback chain `args.category → interesse: tag → searchText` — robusto mesmo quando LLM crava interesse inválido.
3. Auto-tag `interesse:` agora **NUNCA sobrescreve** valor existente (só preenche se vazio).
4. `phrasingDiscipline` sem exemplos literais cross-category — referência abstrata em vez disso.
5. `buildEnrichmentInstructions` ganha mesma fallback chain pra category.

**Regras preventivas:**
1. **Fuzzy/trigram match NUNCA pode rodar sem post-filter de categoria semântica.** Trigram casa "chuv" em "chuva" (tinta) ↔ "chuveiro" (produto totalmente diferente). Defesa: derivar categoria esperada de múltiplas fontes (arg explícito + tag + texto) e filtrar resultado.
2. **Auto-tag baseado em produto retornado NUNCA pode sobrescrever tag setada antes.** `mergeTags` faz replace-by-key. Use `if (!existingTag)` guard.
3. **Instruções pro LLM nunca devem ter exemplos literais cross-domain.** Se você precisa mostrar formato, use placeholder abstrato (`<exemplos do field>`). LLM copia exemplos literais regardless de contexto.
4. **set_tags com value não-validado = bomba relógio silenciosa.** Hoje `interesse:` aceita qualquer string. Tracked como backlog: validar `interesse:` ∈ `category.id` antes de aceitar. Mitigação atual: fallback chain pra categoria.

---

## ⚠️ LLM ignora dados óbvios na 1ª msg quando qualificationContext já tem próxima pergunta — incidente 2026-05-13

**Erro:** Lead disse *"Tem tinta acrílica fosco?"* — trazia tipo + acabamento. IA mesmo assim perguntou *"qual tipo de tinta?"* 5 turnos depois. Tags da conversa após o teste mostraram que LLM só populou `tipo_tinta:acrílica` no T9 (atrasado) e nunca populou `acabamento:fosco`.

**Causa raiz:** problema de **timing** entre engine determinística (`service_categories` → `qualificationContext`) e LLM:
1. Lead manda msg
2. Sistema computa `qualificationContext` baseado em tags atuais → "Próxima pergunta: tipo_tinta"
3. LLM lê esse context e obedece (a seção tem priority MÁXIMA)
4. LLM não chamou `set_tags` ANTES, então engine acha que `tipo_tinta` está vazio
5. Pergunta redundante

A regra hardcoded *"NUNCA repita pergunta já respondida"* existia mas é mais fraca que o context computado.

**Fix:** defesa em código — auto-extrator (`_shared/fieldAutoExtractor.ts`) scaneia `incomingText` cruzando com `examples` dos fields da categoria detectada ANTES de `buildQualificationContext`. Word boundary + acento normalizado + detecção de negação. Pré-popula `conversation.tags`. Reforço de prompt fica como cinto+suspensório.

**Regras preventivas:**
1. **Prompt instructions não substituem lógica determinística.** Quando o sistema computa "próxima ação" a partir de estado (tags, score, etc.), o LLM vai obedecer mesmo se houver regra em texto dizendo o contrário. Solução: garantir que o ESTADO esteja correto antes do compute — extrair dados do input ANTES de gerar context, não esperando o LLM fazer.
2. **Defesa em camada para fluxos críticos.** Qualificação que perde lead = perda de venda. Reforço de prompt + extração em código + validação manual no log. Cada camada cobre buracos da anterior.
3. **`ai_agent_logs.event` deve registrar passos intermediários**, não só `response_sent`. Sem ver `auto_field_extracted` ou `set_tags_called`, debug do "por que LLM perguntou X?" fica cego.

---

## ⚠️ Feature de fila sem constraint DB-level explodiu banco em 9h — incidente 2026-05-14

**Erro:** banco da Eletropiso saltou de ~50 MB → 116 MB em 9 horas (38.6% de uso saudável → 116/300). 1 única conversa de teste (sandbox George) acumulou:
- 22.682 `handoff_queue_events` com `status='active'` (deveria ser MÁX 1 por conversa)
- 136.521 `notifications` tipo `handoff_queue_full_rotation` (6 por ciclo × ~50 events expirando/min × 9h)

**Causa raiz:** cron `requeue-conversations` (1min) chamava `assignHandoff` que `INSERT`-ava event ativo sem checar se já havia outro. Durante os testes E2E do dia, eu fiz `UPDATE conversations SET status_ia='active'` várias vezes pra refazer cenários — cada reset destrava um novo handoff_to_human → novo INSERT. Os anteriores nunca fecharam (cron pausava em horário-fora ao invés de fechar). Sem constraint DB-level, acumulou silenciosamente.

**Detecção:** gestor reparou no Dashboard do Gestor (card "Tamanho do banco"). Top 5 tabelas mostrou `notifications: 60 MB` que era pra ser ~0.

**Fix (3 camadas):**
1. **DB constraint** `EXCLUDE USING gist (conversation_id WITH =) WHERE (status='active')` — Postgres recusa fisicamente o 2º event ativo.
2. **Código idempotente** `assignHandoff` reusa event existente (UPDATE) em vez de tentar INSERT que falharia.
3. **Dedup `notifyGestores`** — não cria full_rotation se já há uma <6h pra mesma conversa.
4. **Retention** cron horário `purge_notifications_older` (full_rotation 6h, lidas 7d, não-lidas 30d).

**Cleanup imediato:** DELETE 68.892 events + 136.519 notifs + VACUUM FULL → 116 MB → **35 MB**.

**Regras preventivas:**
1. **Toda feature que faz INSERT condicional baseado em estado externo (status, flag) precisa de constraint DB-level**. Lógica de aplicação falha silenciosamente em race conditions/loops; constraint do Postgres é o último porteiro.
2. **Tabelas de notificação NUNCA podem rodar sem retention.** Cron horário tipo `purge_X_older` é obrigatório no momento de criar a feature, não depois.
3. **Alertas operacionais (full_rotation, no_eligible) devem ser idempotentes por (tipo, conversa, janela_tempo).** Sem dedup, 1 bug operacional vira spam exponencial.
4. **Dashboards de saúde do banco** (tamanho total + Top N tabelas) **revelam problemas que logs não revelam** — esse incidente só foi pego porque o gestor olhou o card "Tamanho do banco".

---

## ⚠️ UAZAPI button reply: campo CANÔNICO é `message.buttonOrListid` (não os 8 formatos Baileys) — descoberta 2026-05-13

**Erro inicial:** quando o lead clicou em "Eu quero!" do carrossel, `conversation_messages.content` ficou vazio e a IA não respondeu (`ai-agent/index.ts:253` faz early-return em `no_text`). Eu chutei adicionando 8 variantes baseadas em Baileys/whatsmeow (`buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage.nativeFlowResponseMessage`, etc.) — **nenhuma funcionou**.

**Descoberta real:** UAZAPI v2 **desfaz o aninhamento Baileys** antes de mandar o webhook. Tudo vira:
- `message.buttonOrListid` — id do botão ou item de lista selecionado (campo único pra ambos)
- `message.convertOptions` — JSON-serializado com `displayText` quando aplicável
- `message.messageType` — informativo (`"buttonsResponseMessage"`, etc.)

Fonte: OpenAPI spec oficial em `https://docs.uazapi.com/openapi-bundled.json`, schema `components.schemas.Message`.

**Como achei:** WebFetch falhou (SPA). Playwright + `performance.getEntriesByType('resource')` listou todos os recursos carregados pela doc → achei `openapi-bundled.json` → baixei via curl → grep no schema `Message` → campo `buttonOrListid`.

**Validação:** POST simulado direto no webhook com `{message:{buttonOrListid:"X",convertOptions:"{...}"}}` gravou content corretamente no primeiro try.

**Regras preventivas:**
1. **Antes de adivinhar formato externo, procure spec oficial.** Doc SPA não é acessível via WebFetch — use Playwright + `performance.getEntriesByType` pra achar o JSON real subjacente. Vale também pra Stripe, Twilio, Slack, etc.
2. **APIs que rodam sobre Baileys/whatsmeow não necessariamente expõem a estrutura Baileys**. Muitas normalizam pra um payload flat. Testar com fixture conhecido antes de codar fallbacks.
3. **Cada deploy de webhook em prod sem teste prévio é roleta**. Antes deste fix, fiz 2 deploys do whatsapp-webhook que não resolveram nada porque eu não tinha provado o payload. Custo: 2 deploys HIGH RISK + perda de confiança do gestor.

---

> **Histórico:** incidentes antigos em [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]] · [[wiki/erros/historico-2026-05-part3]]. ~140 R# em formato tabela: [[wiki/erros/regras-preventivas]]. **Famílias temáticas:** [[wiki/erros/familias-r-codes]].
