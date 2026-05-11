---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-05-11
audited_at: 2026-05-11
---

# Erros e Lições

> **Consultado no INÍCIO de cada sessão** (Protocolo de Início, passo 3 do `CLAUDE.md`). Verifique se o erro que você está prestes a cometer já está aqui.

## Mapa

- **Top-3 lições recentes** (incidentes da última semana): abaixo
- **Tabela de regras preventivas** (~30 regras): [[wiki/erros/regras-preventivas]]
- **Histórico detalhado** (R91-R114): [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]]
- **Arquivo histórico** (abril e anteriores): [[wiki/erros-arquivo-historico-abril]]

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
