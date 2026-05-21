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

## 🚨 R126 — `search_products({query:"material"})` cross-categoria → enviou Telha PVC pra lead pedindo porta/janela alumínio (Guttemberg, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** lead msg1 "Olá gostaria de saber mais informações sobre um **material**" (genérico) → IA respondeu greeting. Msg2 4s depois: "**Porta em alumínio e janela em alumínio**, só uma de 139" → IA enviou carrossel **Telha de PVC R$62**. Categoria errada absoluta (lead pediu portas/janelas, recebeu telha).

**Causa raiz (3 falhas em cascata):**
1. **Debounce não agregou msgs.** Log `ai_agent_logs.response_sent` mostrou `incoming_text="Olá gostaria…material"` + `message_count: 1` — a segunda msg ("Porta em alumínio…") chegou enquanto o ai-agent já processava a primeira. LLM nunca viu as palavras "porta/janela/alumínio".
2. **Query genérica escapa do guard de categoria.** LLM chamou `search_products({query: "material"})`. Bug 27 fix (`ai-agent/index.ts:2145`) tenta deduzir categoria via `matchCategoryBySearchText("material…")` mas nenhuma regex de categoria casa "material" → `cat27=null` → tag `interesse:` não setada → `expectedCategory=null` → `filterProductsByExpectedCategory` vira no-op.
3. **Catálogo embrionário.** EletropisoV2 tem só 1 produto cadastrado (Telha PVC) com palavra "material" na descrição → ILIKE `%material%` retornou ele. Carrossel enviado mesmo com `portas`/`janelas` configuradas como `catalog_status:offline`.

**Fix proposto (v7.38.4) — 3 camadas:**
1. Novo `_shared/searchGuard.ts` (testável): recusa `search_products` quando query é genérica (`material|produto|item|coisa|preço|valor`) E `expectedCategory=null` — devolve [INTERNO] pedindo qualificação primeiro.
2. Handler `search_products` respeita `expectedCategory.catalog_status === 'offline'` — pula query DB, devolve instrução pra qualificar + handoff (mesma rota do auto-extract `r121_auto_extract_inline`).
3. (Sprint separado) Investigar debounce: por que msg2 não agregou.

**Regras preventivas:**
1. **Tool call do LLM com payload genérico (`query: "material/produto"`) DEVE ser recusado pelo backend** quando não há categoria semântica derivável. LLM em input ambíguo "chuta" — defesa é determinística no handler, não no prompt.
2. **`catalog_status:offline` é um contrato — o backend tem que enforcar em TODAS as portas de entrada** (auto-extract, LLM-driven search, fallback). Hoje só o auto-extract checa; LLM-driven entra direto na query DB.
3. **Catálogo embrionário (<5 produtos digitais) é alto risco de cross-categoria** — ILIKE genérica retorna o único produto que tem a palavra na descrição. Admin deve marcar agente como "handoff-first" até atingir threshold (D27 já sugere).

---

## 🚨 R125 — badge "Em fila" aparecia mesmo com Modo Fila OFF (dinho, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** atendente desligou Modo Fila no QueueConfig (toggle off → `queue_mode_enabled=false`, default_assignee=Lucas), mas helpdesk continuava mostrando badge `⏱ Em fila — Lucas (2:10)` em conversas novas. "Se desliguei a fila, por que aparece?"

**Causa raiz** (`_shared/handoffQueue.ts:182-237` antes do fix): o INSERT em `handoff_queue_events` com `status='active'` + `expires_at` rodava em **todo** handoff, independente do flag do dept. Hook `useActiveQueueEvents.ts:69` filtra só por `status='active'` — sem olhar `dept.queue_mode_enabled` — então renderizava badge mesmo no Modo OFF onde fila não roda.

Pior: na transição ON→OFF, `QueueConfig.handleSave` só atualizava o flag, **sem cancelar** events ativos pré-existentes. UI mostrava badge até cada event expirar (5min).

**Fix (v7.38.3, 2 camadas):**
1. **Backend** — INSERT/UPDATE de queue_event agora roda só se `dept.queue_mode_enabled === true`. Modo OFF: UPDATE só em `conversations.assigned_to` + cancela events ativos herdados.
2. **UI** — `QueueConfig.handleSave` cancela events ativos do dept quando toggle salva OFF (defense-in-depth).

**Regras preventivas:**
1. **Toda feature toggleável precisa testar "se flag=OFF, o usuário vê algum vestígio?".** Backend que cria row em código compartilhado deve respeitar o flag do contexto, não criar incondicionalmente.
2. **Toggle OFF no admin precisa cancelar estado pendente** (events, jobs, timeouts) — não basta salvar o flag e contar com expiração natural. UX é "OFF = sumiu agora".
3. **Hooks de UI que renderizam por shape do dado** (`row existe → renderiza badge`) precisam cruzar com a configuração que governa a feature (`dept.queue_mode_enabled`). Senão vazam estado quando a feature está desligada.

---

## 🚨 R124 — handoff_to_human bloqueado eternamente após search_fail (Carla, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** lead pediu valor de arandela → IA buscou (0 resultados → tag `search_fail:1`) → pediu refinamento → lead voltou pedindo valor → IA tentou `handoff_to_human` **2x** mas o guard "REGRA BUSCA OBRIGATÓRIA" bloqueou. Conversa ficou "Não atribuída", sem mensagem de transbordo, sem atribuir Lucas. Loop infinito.

**Causa raiz** (`ai-agent/index.ts:3562-3575` antes do fix):
```ts
const hasSearched = toolCallsLog.some(t => t.name === 'search_products')
if (!hasSearched && productTags.length > 0) {  // bloqueia
```
`toolCallsLog` é a memória da **rodada atual** da edge function — reseta a cada invocação. A busca foi feita no turn 1; no turn 4 (quando lead voltou) ela já não estava mais. Tag `produto:arandela` ainda lá → bloqueio eterno.

**Fix (v7.38.2):** extraído pra `_shared/handoffGuard.ts` (testável). Nova condição libera handoff se `tags.some(t => t.startsWith('search_fail:'))` — busca prévia já falhou, persistir é inútil.

**Regras preventivas:**
1. **Toda guard que depende de `toolCallsLog` (rodada atual) deve também olhar tags durables.** Cada invocação do ai-agent é stateless; tags são a única memória persistente entre turnos.
2. **Antes de cravar bloqueio num guard, simular o "loop infinito":** "se isso disparar 1000x, o lead consegue sair?" Se a única forma de destravar é uma ação que o LLM já tentou e falhou, é bug.
3. **Lógica de guard que cabe em ~10 linhas vai pra `_shared/` exportada.** Inline no `index.ts` (gigante) ninguém testa.

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

## ⚠️ LLM ignora dados óbvios na 1ª msg quando qualificationContext já tem próxima pergunta — incidente 2026-05-13

**Erro:** lead clicou em "Eu quero!" num botão REPLY de carrossel. Helpdesk gravou mensagem incoming com `content=""`. Ai-agent fez early-return em `ai-agent/index.ts:253` (`if (!incomingText.trim()) return 'no_text'`). **IA parou de responder, lead esfriou, venda perdida.**

**Causa raiz:** `whatsapp-webhook/index.ts` só extraía `message.selectedButtonId` e `message.listResponse.id`. Mas UAZAPI/Baileys mandam o clique em payloads diferentes dependendo do tipo:
- Botão antigo: `selectedButtonId` / `selectedButtonText`
- Quick reply v2: `buttonsResponseMessage.selectedDisplayText`
- Carrossel template: `templateButtonReplyMessage.selectedId` + `selectedDisplayText`
- Native flow (carrossel moderno): `interactiveResponseMessage.nativeFlowResponseMessage.paramsJson` (JSON aninhado)
- Baileys puro: `buttonReply.id` + `displayText`
- Lista: `listResponseMessage.singleSelectReply.selectedRowId`

**Fix:** webhook agora tenta TODAS as 8 variantes em ordem. Pra carrossel, grava `content = "${displayText} (${id})"` (ex: `"Eu quero! (Tinta Acrílica Fosco 16L)"`) pra LLM saber QUAL produto.

**Como descobri:** gestor testou E2E em sandbox e reportou que IA parou após clique no botão. SQL mostrou row com content vazio. Code search no webhook expôs o caminho único de extração.

**Regras preventivas:**
1. **Webhook que processa payload externo (UAZAPI, Stripe, etc): NUNCA confiar em 1-2 nomes de campo**. Plataformas que rodam sobre Baileys/WhatsApp Cloud têm 5+ formatos por feature. Capturar TODAS as variantes conhecidas, com fallback em cascata.
2. **Mensagem de botão DEVE preservar contexto** (id do produto, valor da opção). Gravar só "Eu quero!" perde a referência. Formato: `"${displayText} (${id})"`.
3. **Toda extração de content do webhook deve ter teste E2E real** com clique em botão — não basta cobrir só text/audio/image.

---

## ⚠️ Tipo de parâmetro de RPC divergente da coluna real (uuid vs text) — incidente 2026-05-12

**Erro:** RPC `append_ai_debounce_message` declarava `p_instance_id uuid`. Mas `ai_debounce_queue.instance_id` é `text` (porque `instances.id` é `text` — IDs UAZAPI tipo `r466a98889b5809` não são UUID). Toda chamada explodia com `ERROR 22P02: invalid input syntax for type uuid: "r466a98889b5809"`. **Pipeline inteiro do AI Agent ficou quebrado** por dias até alguém perceber.

**Como descobri:** gestor mandou áudio no WhatsApp e a IA não respondeu. Investigação: msg criada ✓, transcrita ✓, mas `ai_debounce_queue` sem entry nova e `ai_agent_logs` zero em 24h. Suspeita do tipo confirmada chamando a RPC manualmente via SQL.

**Como ficou invisível:** o erro foi silenciado por **três camadas de fire-and-forget**: (1) `whatsapp-webhook` → `transcribe-audio` (background), (2) `transcribe-audio` → `ai-agent-debounce` (background), (3) `ai-agent-debounce` → `supabase.rpc(...)` sem `.throw()`. Toda camada engole erro pra não quebrar o flow do webhook. Erro só apareceria nos logs internos da edge fn — que ninguém olhava.

**Fix:** migration `20260512011546_fix_append_ai_debounce_message_instance_id_text` faz DROP da assinatura antiga + CREATE com `p_instance_id text`. E2E validado em produção (áudio teste respondeu em ~32s).

**Regras preventivas:**
1. **Quando criar/alterar RPC, o tipo do parâmetro DEVE bater com a coluna real**. Não confiar em "uuid é universal" — IDs externos (UAZAPI, Stripe, etc) chegam como `text`. Confirmar via `\d tabela` ou `information_schema.columns`.
2. **Pipelines fire-and-forget de várias camadas precisam de teste E2E periódico** que valide o resultado final (msg outgoing aparece?). TS-check não pega; logs internos da edge fn não escalam pra alarme.
3. **Para diagnosticar pipeline silenciosamente quebrado**: começar pela tabela final (a fila não recebe?) e voltar caminhando. Reproduzir chamada da RPC isoladamente via SQL revela o erro real escondido.

---

## ⚠️ Schema mismatch em INSERT silencioso (v2): `max_retries` vs `max_attempts` — incidente 2026-05-10

**Erro:** `whatsapp-webhook/index.ts` inseria `max_retries: 1` em `job_queue`, mas o schema usa `max_attempts`. INSERT falha com `column max_retries does not exist`. Erro foi para `log.error('Failed to enqueue transcription job')` mas como o pipeline não tinha alarmes, ninguém viu. Resultado: **transcrição de áudio quebrada por ~6 semanas** (corte temporal: 28/03/2026 em diante).

**Como descobri:** usuário reportou áudios incoming presos em "Transcrevendo...". Query `SELECT * FROM job_queue WHERE job_type='transcribe_audio'` retornou vazio. Tentativa de inserir manualmente expôs a coluna inexistente.

**Como agravou:** As RPCs `claim_jobs` e `complete_job` chamadas pelo `process-jobs/index.ts` também não existem no DB. Mesmo que o INSERT do webhook funcionasse, o cron nunca processaria.

**Fix:** removida a fila pra esse caso — webhook chama `transcribe-audio` direto via `backgroundFetch`. Dependência de `job_queue`/`claim_jobs`/`complete_job` eliminada para o caso de áudio.

**Regra preventiva:**
1. **Todo edge function que insere em tabela com schema crítico precisa de teste E2E real** que valide `error === null` no retorno do `.insert()`. TS-check não pega.
2. **Pipelines com chain de RPCs precisam de health-check** em runtime: `claim_jobs` existe? `complete_job` existe?
3. **Quando suspeitar do pipeline**: queries diretas no DB revelam silêncio melhor que logs.

---

> **Incidentes mais antigos:** PostgREST `.maybeSingle()` mascara erro (2026-05-09) e UAZAPI ≠ Business API Meta (2026-05-07) movidos para [[wiki/erros/historico-2026-05-part2]] para respeitar 300-line limit.

---

> Para **todas** as ~30 regras preventivas em formato tabela, veja [[wiki/erros/regras-preventivas]].
> Para detalhes de R91-R114 (incidentes de maio 2026), veja [[wiki/erros/historico-2026-05-part1]] e [[wiki/erros/historico-2026-05-part2]].
