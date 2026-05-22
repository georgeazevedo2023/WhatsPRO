---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-05-20
audited_at: 2026-05-20
---

# Erros e Lições

> **Consultado no INÍCIO de cada sessão** (Protocolo de Início, passo 3 do `CLAUDE.md`). Verifique se o erro que você está prestes a cometer já está aqui.

## Mapa

- **Top-3 lições recentes** (incidentes da última semana): abaixo
- **Tabela de regras preventivas** (~30 regras): [[wiki/erros/regras-preventivas]]
- **Histórico detalhado** (R91-R114): [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]]
- **Arquivo histórico** (abril e anteriores): [[wiki/erros-arquivo-historico-abril]]

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

> **Removido em 2026-05-21:** entry duplicada "LLM ignora dados óbvios (2026-05-13)" tinha mesmo conteúdo da seção "UAZAPI button reply" acima. Regras consolidadas em [[wiki/erros/regras-preventivas]].
>
> **Incidentes 2026-05-12 (RPC uuid vs text) e 2026-05-10 (schema mismatch max_retries) movidos** pra [[wiki/erros/historico-2026-05-part2]] pra respeitar 300-line limit.

---

> **Histórico:** incidentes antigos em [[wiki/erros/historico-2026-05-part1]] e [[wiki/erros/historico-2026-05-part2]]. ~30 regras em formato tabela: [[wiki/erros/regras-preventivas]].
