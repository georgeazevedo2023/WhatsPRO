---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-05-13
audited_at: 2026-05-13
---

# Erros e Lições

> **Consultado no INÍCIO de cada sessão** (Protocolo de Início, passo 3 do `CLAUDE.md`). Verifique se o erro que você está prestes a cometer já está aqui.

## Mapa

- **Top-3 lições recentes** (incidentes da última semana): abaixo
- **Tabela de regras preventivas** (~30 regras): [[wiki/erros/regras-preventivas]]
- **Histórico detalhado** (R91-R114): [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]]
- **Arquivo histórico** (abril e anteriores): [[wiki/erros-arquivo-historico-abril]]

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

## ⚠️ PostgREST `.maybeSingle()` mascara erro de coluna inexistente — incidente 2026-05-09

**Erro:** edge function `notify-vendor-assignment` selecionava `instance_id, contact_name, contact_phone` direto em `conversations` — colunas que **não existem** (acessíveis só via JOIN: `inboxes` para `instance_id`, `contacts` para `name`/`phone`). PostgREST retornou erro, mas `.maybeSingle()` engoliu e devolveu `data=null`. Resultado: a função sempre logava `skip_reason='conv_not_found'` e **nunca chegou a entregar uma notif em prod desde o shipping da v7.32.0**.

**Por que ninguém viu antes:** outro guard parava antes — nenhum vendor da Eletropiso tinha `personal_whatsapp` cadastrado, então o pipeline batia em `skip_no_number` antes de tentar enviar. Bug oculto por seleção dupla de skips silenciosos.

**Fix:** select reescrito com PostgREST embedding:
```ts
.select('id, inbox_id, contact_id, assigned_at, contact:contacts(name, phone, jid), inbox:inboxes(instance_id)')
```

**Regra preventiva:**
1. **Edge function que envia mensagem/notif PRECISA validação E2E real** — chamar a função com dado válido e verificar entrega.
2. **Skip silencioso é dívida técnica disfarçada** — quando uma função tem múltiplos `skip_*`, pelo menos um teste E2E deve forçar o caminho de sucesso até `status='sent'`.
3. **`.maybeSingle()` não substitui validação de schema** — preferir embedding PostgREST a duplo-fetch.

---

## ⚠️ UAZAPI ≠ WhatsApp Business API oficial (Meta) — incidente 2026-05-07

**Erro:** ao implementar v7.32.0 (notif handoff), apliquei a **regra de janela 24h** que é da **Business API oficial Meta** ao código que usa **UAZAPI**. UAZAPI é proxy não-oficial sobre WhatsApp Web (chip) — **não tem janela 24h formal**. Resultado: implementei ~80 linhas vestigiais (handshake, auto-resposta, guard `skip_session_expired`, banner amarelo/vermelho, 2 colunas DB) que tive que remover na v7.32.2.

**Causa raiz:** quando vi `uazapi-proxy` no código, mentalmente tratei como "WhatsApp Business API oficial" (regra default do meu treinamento). Não questionei a premissa.

**Regra preventiva:**
1. **WhatsPRO usa UAZAPI** (não Business API Meta). Sempre que mexer com WhatsApp, lembrar: **chip via Web protocol**, sem regras formais Meta.
2. Antes de aplicar qualquer regra "padrão" do WhatsApp pra empresas (HSM templates, janela 24h, opt-in formal, message_status callbacks), perguntar: **isso é da API oficial ou do WhatsApp em geral?**.
3. Risco real do UAZAPI: **banimento de chip** por uso abusivo. Mitigado por rate limit, batching, business_hours, opt-in. NÃO por handshake.

---

> Para **todas** as ~30 regras preventivas em formato tabela, veja [[wiki/erros/regras-preventivas]].
> Para detalhes de R91-R114 (incidentes de maio 2026), veja [[wiki/erros/historico-2026-05-part1]] e [[wiki/erros/historico-2026-05-part2]].
