---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-06-03
audited_at: 2026-06-03
---

# Erros e Lições

> **Consultado no INÍCIO de cada sessão** (Protocolo de Início, passo 3 do `CLAUDE.md`). Verifique se o erro que você está prestes a cometer já está aqui.

## Mapa

- **Lições recentes** (incidentes da última semana): abaixo
- **Tabela de regras preventivas** (~30 regras): [[wiki/erros/regras-preventivas]]
- **Histórico detalhado** (R91-R114): [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]]
- **Histórico R124-R138 + incidentes 13-17/05:** [[wiki/erros/historico-2026-05-part3]] · [[wiki/erros/historico-2026-05-part4]]
- **Arquivo histórico** (abril e anteriores): [[wiki/erros-arquivo-historico-abril]]

---

## 🚨 Sessão 2026-06-03 (tarde III) — `getAccessToken` travava TODA edge function (`getSession()` sem timeout) — v7.71.1
Detalhe: CHANGELOG/log + [[project_member_create_hang_v7711]] · cruza [[project_tab_resume_session_zombie_v762]]. "Novo Membro" preso em "Criando...".
1. **`await supabase.auth.getSession()` CRU é um ponto de travamento GLOBAL.** O `getSession()` pendura em sessão zumbi (refreshingDeferred preso). `getAccessToken`/`getSessionUserId` (`useAuthSession.ts`, usados por TODA edge fn via `edgeFunctionFetch`) chamavam getSession SEM teto → a requisição nunca saía do navegador. **Diagnóstico-chave:** a edge fn alvo (`admin-create-user`) **não aparecia nos logs do servidor** = travou ANTES do fetch (no cliente), não no servidor/DB. **Regra:** todo `getSession()` em caminho crítico precisa de timeout + fallback (token persistido no localStorage). O fix do v7.62.1 (fetch-timeout em `/auth/v1/`) cobriu o Helpdesk mas NÃO os helpers de token — **ao corrigir um `getSession()` travado, varrer TODOS os usos** (`grep getSession`), não só o que reclamou.

## 🚨 Sessão 2026-06-03 (tarde) — `upsert` com `ON CONFLICT` num índice PARCIAL nunca casa (feature morta há meses) — v7.70.0
Detalhe: CHANGELOG/log + [[project_auto_enroll_broadcast_v770]]. Auto-cadastro de leads na base do Disparador.
1. **`.upsert({...}, { onConflict: 'instance_id' })` num índice único PARCIAL = erro `42P10` SEMPRE.** O índice era `... (instance_id) WHERE instance_id IS NOT NULL`. O PostgREST/supabase-js gera `ON CONFLICT (instance_id)` SEM predicado, e o Postgres **não infere índice parcial** sem repetir o `WHERE` na cláusula → "there is no unique or exclusion constraint matching the ON CONFLICT specification". A exceção caía num `catch` fire-and-forget → **nenhuma base era criada há meses** (`total_databases=0` em prod, feature deployada desde o commit base). **Regras:** (a) `ON CONFLICT` só infere índice parcial se você REPETE o predicado (em SQL: `ON CONFLICT (col) WHERE <mesmo predicado>`); supabase-js não suporta isso → quando o conflito é parcial, encapsular numa **RPC `SECURITY DEFINER`** com o INSERT/ON CONFLICT correto, não confiar no upsert do PostgREST; (b) `fire-and-forget` com `catch` silencioso **esconde bug fatal pra sempre** — logar o erro (foi assim que ficou invisível); (c) ao herdar um bloco "já existe", **verificar o estado real no DB** (`count`) antes de assumir que funciona — código presente ≠ código funcional.
2. **Chamada a RPC inexistente também era engolida.** O bloco chamava `update_lead_count_from_entries` (nunca existiu; só `recalc_lead_database_count`) com fallback — outro erro mascarado. **Regra:** o nome de toda RPC chamada do backend tem que existir no schema; um grep cruzando `.rpc('...')` × `pg_proc` pega isso.

## 🚨 Sessão 2026-06-02 (tarde) — Auditoria de paridade: ghost-column + 2 toggles mortos (v7.67.0)
Detalhe: CHANGELOG/log + [[project_audit_parity_handoff_caps_v767]]. Auditoria SYNC RULE (schema × ALLOWED_FIELDS × reads backend × UI).
1. **Campo no `ALLOWED_FIELDS` SEM coluna no banco = crash silencioso do auto-save inteiro.** `max_lead_messages` tinha input editável + era lido pelo backend, mas a coluna nunca foi criada → `.update({max_lead_messages})` retorna PostgREST "column does not exist" e **derruba o save de TODOS os campos do lote**, não só dele. Latente: só dispara quando alguém edita aquele campo (até lá, `if (key in cfg)` nunca inclui a chave). **Regra:** a SYNC RULE (8 itens) existe EXATAMENTE pra isso — `ALLOWED_FIELDS` (item 4) tem que casar 1:1 com coluna real (item 1). Auditar periodicamente cruzando `information_schema.columns` × allowlist × reads.
2. **Toggle salvável mas sem read no backend = controle morto que ENGANA o dono.** `handoff_negative_sentiment` e `handoff_max_conversation_minutes` salvavam ok (coluna + allowlist + UI) mas 0 leituras no backend → mexer não fazia nada. **Regra:** todo controle de UI precisa de um consumidor no caminho ATIVO; "salva sem erro" ≠ "tem efeito". Cruza [[feedback_ui_must_respect_feature_toggle]].
3. **Religar um flag que já tem default LIGADO em todos os rows = mass-handoff/mass-mudança em prod.** Os 2 toggles mortos tinham default 15/true gravado em TODO agente; ligar a leitura sem reset transbordaria todo mundo de uma vez. **Regra:** ao dar vida a config morta, trate o rollout como feature nova (default OFF + reset dos rows + ligar por-agente) e **aplique a migration de reset ANTES de deployar o código que enforça** — senão há janela de comportamento explosivo.

## 🚨 Sessão 2026-05-31 — `fetch_messages_timeout` no Helpdesk (sessão supabase-js zumbi) — v7.62.0→v7.62.1
Detalhe: CHANGELOG + [[project_tab_resume_session_zombie_v762]]. Frontend, não ai-agent.
1. **`getSession()` do supabase-js TRAVA ∞ num token expirado** (medido 14-20s no app real, ZERO request de rede → hang no estado interno do GoTrueClient), e o client fica **IRRECUPERÁVEL em memória** (`setSession()` com token cru tb trava; teto no fetch de auth retenta com sucesso mas o getSession original fica órfão). Toda query REST espera esse token → o `Promise.race` de 12s do ChatPanel estoura. **Regra:** recuperação de aba/sessão NUNCA refetcha sem garantir token; quando o client zumbi não destrava, a única saída confiável é **reinicializar** (reload PRESERVANDO estado via URL `?conv=`, condicional + guarda anti-loop). Lock funcional NÃO resolve (navigator.locks trava 10s em aba stale — foi desligado de propósito no `264a1b6`).
2. **1ª tentativa (v7.62.0) foi INSUFICIENTE** porque cobri só o caminho do RESUME e validei com reprodução incompleta (editar localStorage ≠ todos os caminhos de prod). **Regra:** quando o dono diz "ainda erro", REPRODUZIR no app real com instrumentação (`window.__sb`, medir timings) ANTES de re-shipar — não chutar a 2ª vez. Cruza "fix-de-raiz exige reprodução fiel".

## 🚨 Sessão 2026-05-30 (noite) — 4 incidentes: fila runaway · catálogo-vazio · greeting · phantom release (v7.58.1-4)
Detalhe: CHANGELOG/log + memórias [[project_queue_rotation_runaway_v7581]] · [[project_empty_catalog_handoff_v7583]] · [[project_greeting_hallucinated_interest_v7584]].
1. **Fila rotacionava INFINITAMENTE** (114 convs, rotation_number 293, ~4.7k eventos/24h, OOF "fora de horário" reenviada todo dia). Dedup era POR-EVENTO e a rotação reciclava eventos. **Regras:** (a) toda rotação/retry precisa de **CAP** (parar após N voltas pelos elegíveis); (b) dedup de ação lead-facing deve ser por **entidade DURÁVEL** (conversa + atividade do lead), NUNCA por linha efêmera (evento); (c) `external_id` carimba a ORIGEM (`queue_oof_`/`abandon_`/`follow_up_`/`ai_agent_`) — é o 1º diagnóstico de "quem mandou". **Mesma família** do "fila sem constraint explodiu banco" (part4): loop operacional sem teto.
2. **Catálogo-vazio premium NUNCA transbordava (loop + repergunta):** decisão comparava `answered.has(field.key)` com keys SUFFIXADOS da categoria (`ambiente_torneira`), mas o LLM grava GENÉRICAS (`ambiente:`). **Regras:** (a) comparação de chave entre camada LLM e camada determinística DEVE normalizar (base genérica ↔ key específica); (b) convergência/handoff NUNCA pode depender de "todos os campos coletados" quando o LLM tagueia genérico — precisa de **CAP de perguntas**; (c) **fixture de teste com keys genéricos ESCONDE o bug** — o teste passava porque divergia do schema do DB real; fixture deve espelhar produção.
3. **Greeting INVENTOU interesse pra lead NOVO** ("você estava vendo pisos"; ele nunca falou — viés de "Eletro·piso"). Gate de "returning" era TER-NOME → lead recém-apresentado virava recorrente; o exemplo no prompt (`"você estava vendo [interesse]"`) convidava o LLM a PREENCHER inventando; e o memory-block contava o resumo da PRÓPRIA conversa em andamento. **Regras:** (a) "lead recorrente" se gateia em FATO CONCRETO (interesse/produto de conversa ANTERIOR), nunca em ter-nome; (b) NUNCA dar exemplo com placeholder `[X]` que o LLM completa — é convite à hallucinação; (c) memória de retomada não pode incluir a conversa atual. **Cruza** Bug 19 (LLM alucina interesse, part4).
4. **Phantom release:** deep-qualify + abandono estavam DEPLOYADOS mas nunca commitados → repo ≠ prod (meus fixes assumiam arquivos untracked). **Regra (reforço):** deploy SEM commit é incompleto; commitar antes/junto. Bônus: migration aplicada com version gerado ≠ version do arquivo (`000002` vs `234430`) → `db push` re-aplicaria (OK porque `CREATE OR REPLACE` é idempotente, mas alinhar pra não poluir histórico).

## 🚨 R149 — `interesse_match` sem fronteira casava substring (biodigestor→portas) — v7.57.5, detalhe no CHANGELOG/log 2026-05-30
Cliente pediu biodigestor 1500L; IA ofereceu PORTAS + transbordou "pedido de portas". **Causa:** categoria portas tem `interesse_match: "porta|portas"` e o regex era `new RegExp(pattern,'i')` SEM fronteira → casou `porta` dentro de **"portanto"** (transcrição de áudio). Mesma classe: `cabo`⊂"acabou", `cano`⊂"canoa", `mesa`⊂"mesada", `piso`⊂"Eletro**piso**". **Fix:** `buildInteresseRegex` (fonte única nos 5 pontos) com lookaround de letra accent-safe (`\b` do JS falha com acento) + sufixo `(?:s|es|ns)?` p/ tolerar plural quando a config só lista singular + valida pattern cru antes de embrulhar. Config: `"caixa d"` (prefixo substring) → variantes explícitas nos 3 agentes (senão fronteira pararia de casar "caixa de água"). **Lições:** (1) regex de config exposto a texto livre SEMPRE com fronteira de palavra; (2) em pt-BR use lookaround `[A-Za-zÀ-ÿ]`, nunca `\b` (acento não é `\w`); (3) ao endurecer um matcher, varra os patterns que dependiam do comportamento frouxo (prefixos tipo "caixa d") pra não trocar bug por bug.

## 🚨 R148 — router não injetava Informações da Empresa → IA inventou cidade da loja (v7.57.4, detalhe no CHANGELOG/log 2026-05-29)
Lead: "essa loja é em São João né?" → IA confirmou; loja é Garanhuns-PE. Endereço estava CERTO no `business_info` — IA inventou. **Causa:** `buildBusinessSection` (+`REGRA ABSOLUTA: NÃO invente`) só ia no monolito; o systemPrompt do specialist (`specialistBase.runSpecialist`) não tinha → sob `routing_mode='router'` (os 3 agentes) ninguém sabia o endereço. **Fix:** injeta `buildBusinessSection(ctx.agent)` no systemPrompt. **Lições:** (1) migração monolito→specialist exige checklist de paridade de **contexto** (todo bloco do prompt), não só tools/boundary; (2) dado certo no DB+UI ≠ chega no prompt — o que importa é o consumo no caminho ATIVO; (3) info de negócio sem regra anti-invenção = LLM concorda com suposição errada do lead.

## 🚨 R146/R147 — qualify-first expôs 2 bugs (E2E prod 2026-05-24, v7.50.0)
**R146 — `so_se_pedir` cortava em 8 msgs:** código caía em `?? 8` (igual `apos_n_msgs`) contra o contrato-doc ("lead controla, max alto"). Qualify-first (+turnos) batia no handoff genérico antes do rico. Fix: default → 40. **Lição:** contrato-doc vs código divergentes = código errado. *(Relacionado: a auditoria v7.67.0 criou a coluna `max_lead_messages` nullable JUSTAMENTE pra não reintroduzir esse `?? 40`.)*
**R147 — handoff specialist (gpt-4.1-mini) vazava tool call como TEXTO** (`functions.handoff_to_human({...})`) em vez de invocá-la → handoff não executava + lead via sintaxe crua. Fix: → gpt-4.1 + `stripLeakedToolCalls`. **Lição:** specialist que DEPENDE de tool precisa de modelo confiável + saneamento.

## 🚨 R141 — TDZ `carouselSentInThisCall` (prod 2026-05-22, fix v7.41.8) — detalhe em [[wiki/erros/historico-2026-05-part2]]
`let carouselSentInThisCall` declarado dentro do LLM loop, mas `executeTool` (escopo enclosing) acessava antes via `runInlineSearchProducts` pré-LLM → **TDZ throw silenciado pelo executeToolSafe** → loop idiota. Crash só virou diagnosticável quando R140 persistiu stack trace. Fix: mover o `let` pro topo do handler. **Lições:** (1) `let`/`const` são hoisted SEM init (TDZ); declarar TODO state mutável ANTES de functions do mesmo escopo. (2) Observability (R140) PRIMEIRO, antes de chutar root cause. (3) vitest mock de tool isolada NÃO pega TDZ do caminho real — integration test precisa exercitar index.ts→executeTool→tool. Cruza: R140, R58, R59.

---

## 📦 R124-R138 + incidentes 13-17/05 — arquivados

> Movidos em 2026-06-02 (hard limit 300 linhas). **[[wiki/erros/historico-2026-05-part4]]:** R138 (PostgREST `.or()` vírgula), R137 (brand sem wire), R135/R136 (loop qualif), R132 (transcrição áudio ignorada), deploy MCP vazio, Bug 19 (alucina interesse), Bugs 17+18, fuzzy pg_trgm cross-categoria, LLM ignora dados na 1ª msg, fila sem constraint explodiu banco, UAZAPI `buttonOrListid`. **[[wiki/erros/historico-2026-05-part3]]:** R124-R134.

---

> **Histórico:** [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]] · [[wiki/erros/historico-2026-05-part3]] · [[wiki/erros/historico-2026-05-part4]]. ~140 R# em formato tabela: [[wiki/erros/regras-preventivas]]. **Famílias temáticas:** [[wiki/erros/familias-r-codes]].
