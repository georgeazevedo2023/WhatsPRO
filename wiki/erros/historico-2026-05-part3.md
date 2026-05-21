---
title: Histórico de erros — 2026-05 part3 (R124 a R134)
tags: [erros-historico, 2026-05, r124, r125, r126, r127, r128, r129, r130, r131, r133, r134]
description: Detalhe dos incidentes R124 (handoff bloqueado), R125 (badge fila OFF), R126 (search cross-categoria), R127-R130 (multi-categoria + sale_closed false positive), R131 (phrasing repetitivo), R133+R134 (regex overlap + loop R129). Movido de wiki/erros-e-licoes.md em 2026-05-21 (hard limit 300 linhas).
updated: 2026-05-21
audited_at: 2026-05-21
---

# Histórico de erros 2026-05 part3 — R124 → R134

## 🔁 R133+R134 — overlap regex tintas↔impermeabilizantes + loop R129 (v7.38.8, 2026-05-21)

Caso Branca: IA listou "tintas" fantasma + repetiu pergunta 2x. **R133:** regex `tintas` incluía `impermeabilizante` (overlap silencioso). Fix: migration jsonb UPDATE + seed corrigido. **R134:** R129 redispara sem checar `multi_interesse_pending`. Fix: guarda `!alreadyHasMultiPending` + `buildQualificationContext` instrui LLM a aceitar resposta. Detalhe: `CHANGELOG.md` v7.38.8.

**Regras preventivas:**
1. Auditar overlap entre regex de categorias — termo em 2+ regex = bug latente. SQL: `regexp_split_to_table(interesse_match,'\|')` cruzando categorias.
2. Curto-circuito que grava estado precisa de guarda anti-loop ANTES de disparar: `if (cond && !jaGravou) { acao; gravar; }`.
3. Categoria nova exige teste de unicidade: `matchAllCategoriesBySearchText('TERMO', cfg).length === 1` por termo.

---

## 🎨 R131 — phrasing repetia "Para encontrar a melhor opção" (v7.38.6, 2026-05-21)

IA Eletropiso fez 3 perguntas seguidas na qualif de tintas com mesma abertura. Causa: `formatPhrasing(stage.phrasing, field)` em `_shared/serviceCategories.ts` usa o MESMO template do stage pra cada field. **Fix híbrido:** `formatPhrasing` aceita `answeredCountInStage`; se `>= 1` substitui pelo curto `"Qual {label}? ({examples})"`. 3 call sites no `ai-agent/index.ts`. Detalhe completo no `CHANGELOG.md` v7.38.6.

**Regras preventivas:**
1. Template `phrasing` único por stage = repetição inevitável com N fields. Variar no formatter ou separar preâmbulo/continuação.
2. Cuidado ao "soltar" determinismo recém conquistado (R124-R130) — flexibilização nova deve ser cosmética, não comportamental.
3. UX consultiva ≠ transacional — lead que demonstra desconhecimento precisa de explicação antes do termo técnico. Sprint dedicada aberta.

---

## 🚨 R127/R128/R129/R130 — loop multi-categoria + sale_closed false positive (E2E sandbox 2026-05-21)

**4 bugs descobertos numa sessão de 10 jornadas E2E reais (sandbox 558185749970 → EletropisoV2). Fix completo em v7.38.5.**

**R127 — IA loop "Para qual ambiente você precisa da janela?":** lead pediu "porta e janela alumínio" → LLM passou `["interesse:portas", "interesse:janelas"]` numa só chamada → `mergeTags` faz REPLACE-by-key → `interesse:portas` sobrescrito silenciosamente → categoria virou só janelas → LLM inventou "ambiente da janela" (categoria janelas não tem `ambiente_janela`, só `material_janela` e `tamanho_janela`). Loop infinito. Fix: `_shared/setTagsValidator.ts` rejeita 2+ valores em mesma key + caso especial em `interesse:` devolve instrução pra perguntar ao lead qual começar.

**R128 — `sale_closed_detected` false positive:** regex `\bquero\s+(comprar|levar|fechar)\b` em `saleClosedDetection.ts` pegava "quero comprar um material" como SALE CLOSED → handoff prematuro com `venda:fechada` antes de qualquer qualif. Fix: removido o padrão (só "bora fechar", "fechei", "pix", "comprovante" disparam).

**R129 — auto-extract silencioso escolhe 1ª categoria em multi-interesse:** `matchCategoryBySearchText` retorna o PRIMEIRO match. Lead diz "porta + janela" → auto-extract setou só `interesse:portas`, ignorou janela. LLM não viu multi e respondeu genérico. Fix: novo `matchAllCategoriesBySearchText` + curto-circuita o LLM se detectar 2+ categorias: envia direto "Posso te ajudar com X e Y. Por qual prefere começar?" + seta `multi_interesse_pending:CSV`.

**R130 — após escolha lead, LLM improvisa field inválido:** depois do `set_tags(interesse:NEW_CAT)`, qualificationContext stale → LLM ignora reforço de prompt e improvisa. Chegou a usar `send_poll` com opções inventadas "sala/cozinha/quarto/banheiro" pra categoria janelas. Fix: flag `pendingForcedNextQuestion` no handler set_tags + OVERRIDE pós-LLM determinístico (se LLM divergiu OU usou send_poll, substitui pelo phrasing exato da próxima pergunta da nova categoria).

**Regras preventivas:**
1. **`mergeTags` REPLACE-by-key é silencioso e perigoso** — 2 valores numa mesma key viram 1. Validar ANTES do merge.
2. **Detectores determinísticos de "intenção avançada" (sale_closed, objecao, etc.) precisam de contexto de qualif prévia** — verbos como "quero comprar" no início são INTENÇÃO de início, não fechamento. Regex isolado é insuficiente.
3. **Prompt reinforcement não substitui override determinístico** — quando LLM tem padrão visual forte (greeting já no histórico, exemplos de outra categoria), regras em texto são ignoradas. Defesa real é flag + override pós-LLM.
4. **Multi-categoria não é caso edge raro** — lead que pede 2+ produtos é comum em obra (porta+janela, tinta+pincel, etc.). Sistema multi-tenant precisa suportar nativamente ou ter caminho explícito de "pergunte qual começar".
5. **E2E real explora combinações que unit-tests não pegam** — sessão de 10 jornadas descobriu 4 bugs que typecheck/vitest não viam. Custo: 30min E2E vs horas de debug pós-prod.

---

## 🚨 R126 — `search_products({query:"material"})` cross-categoria → enviou Telha PVC pra lead pedindo porta/janela alumínio (Guttemberg, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** lead msg1 "Olá gostaria de saber mais informações sobre um **material**" (genérico) → IA respondeu greeting. Msg2 4s depois: "**Porta em alumínio e janela em alumínio**, só uma de 139" → IA enviou carrossel **Telha de PVC R$62**. Categoria errada absoluta.

**Causa raiz (3 falhas em cascata):**
1. **Debounce não agregou msgs.** Log `ai_agent_logs.response_sent` mostrou `incoming_text="Olá gostaria…material"` + `message_count: 1` — a segunda msg ("Porta em alumínio…") chegou enquanto o ai-agent já processava a primeira. LLM nunca viu as palavras "porta/janela/alumínio".
2. **Query genérica escapa do guard de categoria.** LLM chamou `search_products({query: "material"})`. Bug 27 fix tenta deduzir categoria via `matchCategoryBySearchText("material…")` mas nenhuma regex casa "material" → `cat27=null` → `interesse:` não setada → `expectedCategory=null` → `filterProductsByExpectedCategory` vira no-op.
3. **Catálogo embrionário.** EletropisoV2 tem só 1 produto cadastrado (Telha PVC) com "material" na descrição → ILIKE `%material%` retornou ele. Carrossel enviado mesmo com `portas`/`janelas` configuradas como `catalog_status:offline`.

**Fix v7.38.4 — 3 camadas:**
1. Novo `_shared/searchGuard.ts` (testável): recusa `search_products` quando query é genérica + `expectedCategory=null` — devolve [INTERNO] pedindo qualificação primeiro.
2. Handler `search_products` respeita `expectedCategory.catalog_status === 'offline'` — pula query DB, devolve instrução pra qualificar + handoff.
3. (Sprint separado) Investigar debounce.

**Regras preventivas:**
1. **Tool call do LLM com payload genérico DEVE ser recusado pelo backend** quando não há categoria semântica derivável. LLM em input ambíguo "chuta" — defesa é determinística no handler, não no prompt.
2. **`catalog_status:offline` é um contrato — o backend tem que enforcar em TODAS as portas de entrada.** Hoje só auto-extract checa; LLM-driven entra direto na query DB.
3. **Catálogo embrionário (<5 produtos digitais) é alto risco de cross-categoria.**

---

## 🚨 R125 — badge "Em fila" aparecia mesmo com Modo Fila OFF (dinho, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** atendente desligou Modo Fila no QueueConfig (toggle off → `queue_mode_enabled=false`, default_assignee=Lucas), mas helpdesk continuava mostrando badge `⏱ Em fila — Lucas (2:10)` em conversas novas.

**Causa raiz** (`_shared/handoffQueue.ts:182-237` antes do fix): o INSERT em `handoff_queue_events` com `status='active'` rodava em **todo** handoff, independente do flag do dept. Hook `useActiveQueueEvents.ts:69` filtra só por `status='active'` — sem olhar `dept.queue_mode_enabled` — então renderizava badge mesmo no Modo OFF.

Pior: na transição ON→OFF, `QueueConfig.handleSave` só atualizava o flag, **sem cancelar** events ativos pré-existentes. UI mostrava badge até cada event expirar (5min).

**Fix v7.38.3 (2 camadas):**
1. **Backend** — INSERT/UPDATE de queue_event agora roda só se `dept.queue_mode_enabled === true`. Modo OFF: UPDATE só em `conversations.assigned_to` + cancela events ativos herdados.
2. **UI** — `QueueConfig.handleSave` cancela events ativos do dept quando toggle salva OFF (defense-in-depth).

**Regras preventivas:**
1. **Toda feature toggleável precisa testar "se flag=OFF, o usuário vê algum vestígio?".**
2. **Toggle OFF no admin precisa cancelar estado pendente** (events, jobs, timeouts).
3. **Hooks de UI que renderizam por shape do dado** precisam cruzar com a config que governa a feature.

---

## 🚨 R124 — handoff_to_human bloqueado eternamente após search_fail (Carla, Eletropiso 558781592373) — incidente 2026-05-20

**Erro:** lead pediu valor de arandela → IA buscou (0 resultados → tag `search_fail:1`) → pediu refinamento → lead voltou pedindo valor → IA tentou `handoff_to_human` **2x** mas o guard "REGRA BUSCA OBRIGATÓRIA" bloqueou. Conversa ficou "Não atribuída", sem mensagem de transbordo, sem atribuir Lucas. Loop infinito.

**Causa raiz** (`ai-agent/index.ts:3562-3575` antes do fix):
```ts
const hasSearched = toolCallsLog.some(t => t.name === 'search_products')
if (!hasSearched && productTags.length > 0) {  // bloqueia
```
`toolCallsLog` é a memória da **rodada atual** da edge function — reseta a cada invocação. A busca foi feita no turn 1; no turn 4 (quando lead voltou) ela já não estava mais. Tag `produto:arandela` ainda lá → bloqueio eterno.

**Fix v7.38.2:** extraído pra `_shared/handoffGuard.ts` (testável). Nova condição libera handoff se `tags.some(t => t.startsWith('search_fail:'))` — busca prévia já falhou, persistir é inútil.

**Regras preventivas:**
1. **Toda guard que depende de `toolCallsLog` (rodada atual) deve também olhar tags durables.**
2. **Antes de cravar bloqueio num guard, simular o "loop infinito":** "se isso disparar 1000x, o lead consegue sair?"
3. **Lógica de guard que cabe em ~10 linhas vai pra `_shared/` exportada.**
