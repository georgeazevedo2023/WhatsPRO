---
title: Log Arquivo Pré 2026-05-08 (parte 4)
type: log-archive
description: 2026-05-06 noite — Handoffs + auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO
updated: 2026-05-11
---

# Log — Arquivo Pré 2026-05-08 (parte 4)

> Read-only. Index pai: [[log.md]] · Anteriores: [[wiki/log-arquivo-2026-04-04-a-09]]

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-06 noite

> Sessão limpa pelo usuário. Próxima sessão lê este bloco + MEMORY.md + roadmap + erros-e-licoes pra continuar sem contexto perdido.

### O que foi feito hoje (2026-05-06)

**Migração Eletropiso pós-cutover (continuação):**
- Smoke E2E completo via WhatsApp real ✅
- 7 hotfixes: R97 (instance_id), R98 (GRANTs anon/auth), R99 (27 colunas), R101 (GRANTs service_role), R102 (dept NULL), R103 (LLM pula tipo_tinta), R104 (brand falso positivo), R105 (business_hours NULL), R106 (out-of-hours repete)
- Projeto antigo `euljumeflwtljegknawy` PAUSADO via MCP

**Playwright shipado (4 ondas):**
- 120 testes, 120/120 PASS, 1 bug real corrigido (R100 SelectItem value="" CampaignForm)
- Wikis: `playwright-onda1`, `onda2`, `onda3`, `onda4` em `wiki/`
- Suite roda em ~20min

**Sandbox IA criada (testes reais):**
- Número: `558185749970` (UAZAPI: Testador da Eletropiso)
- Instance ID: `rb84e079eeab167`, Token: `9a6ff3f5-31ee-4302-9fd6-5d4bc488ff5e`
- AI Agent: clone integral Eletropiso (23 categorias), `business_hours=NULL` (24/7)
- Webhook UAZAPI já apontando direto pro `whatsapp-webhook` do Supabase novo
- Refs em `wiki/sandbox-ia-instancia.md`

**Plano de testes Sandbox:**
- 15 cenários documentados em `wiki/plano-testes-sandbox.md`
- Bloco A (smoke 3) + B (qualificação R103, 4) + C (produtos 3) + D (handoff 3) + E (edge cases 2)
- Cada cenário com PASS criteria + métricas reportadas
- + 6 specs Onda 5 Playwright planejados

### Estado de produção AGORA

- Projeto novo `prfcbfumyrrycsrcrvms` 100% operacional
- Eletropiso real atende em produção
- Sandbox IA pronta pra testes
- Edge fns mais recentes: `whatsapp-webhook` v2 (R102), `ai-agent` v3 (R103+R104+R106)
- Working tree limpo
- Branch: master, último commit: `5672caf` (R106 + Sandbox)

### Pendências paralelas (não bloqueantes)

1. **Cache stale React Query (B3)** — refresh contorna, mas merece investigação dedicada do realtime broadcast no useHelpdeskConversations
2. **Rotação de credenciais pós-migração** — lista em `wiki/migracao-eletropiso-COMPLETA`
3. **Catálogo Sandbox raso** — 7 produtos clonados; pra C1 funcionar bem, precisa cadastrar mais produtos OU aceitar que C2 (sem produtos) é o cenário comum

### 🚀 FRASE PRA RETOMAR

- Claude lê `wiki/plano-testes-sandbox.md`, monitora Sandbox via MCP, espera você mandar `oi` pelo celular pessoal pro `558185749970`
- Reporta PASS/FAIL com dados do DB
- Após A1 OK, segue A2, A3, B1...

**Opção 2:** **`executar Bloco B`** — pula direto pra qualificação por categoria (B1 valida R103)

**Opção 3:** **`continuar Onda 5 Playwright`** — prepara os 6 specs novos (sem precisar de WhatsApp real)

**Opção 4:** **`investigar cache stale realtime helpdesk`** — ataca B3

### Auto-avaliação 0-10 da sessão

- **Conteúdo:** 9/10 — 7 bugs reais corrigidos em prod, smoke E2E completo, Sandbox criada, plano de teste detalhado, 4 ondas Playwright (120 testes)
- **Orquestração:** 10/10 — log + 4 wikis Playwright + sandbox + plano-testes + erros-e-licoes (R97-R106) + MEMORY.md, todos cross-referenciados
- **Estado vault:** 10/10 — sem dívida documental, frase de retomada concreta
- **Honesto:** B3 (cache stale) ainda em aberto, mas refresh contorna. Catálogo Sandbox raso é limitação, não bug

---

## 2026-05-06 (noite — R106 + Sandbox IA criada para testes reais)

### R106 — Out-of-hours message repete + ignora shadow

**Sintoma:** George mandou "Ok" 21:34 → out_of_hours ✅. "obrigado" 21:42 → out_of_hours DE NOVO. Conversa estava em shadow (handoff feito) — IA deveria estar passiva.

**Causa:** `ai-agent/index.ts` envia `out_of_hours_message` cega — sem cooldown, sem checar `status_ia`. Lead manda N msgs fora de horário → recebe N respostas idênticas.

**Fix:** 2 guards antes do envio:
1. `conversation.status_ia === SHADOW` → retorna sem enviar (handoff feito, IA passiva)
2. SELECT de mensagem outgoing idêntica nos últimos 60min → cooldown (1 resposta por hora basta)

Deploy `ai-agent` v2 → v3.

### Sandbox IA criada (instância de teste 558185749970)

**Setup completo via MCP:**
- `instances`: id `rb84e079eeab167`, name "Sandbox IA", token `9a6ff3f5-...`, owner_jid `558185749970`, status `connected`
- `inboxes`: name "Sandbox IA"
- `departments`: name "Sandbox Vendas" (Modo Fila OFF, default_assignee George)
- `inbox_users`: George admin com tudo (can_view_all)
- `department_members`: George posição 10 disponível
- `user_instance_access`: George → Sandbox
- `ai_agents`: name "Sandbox Agent" — clonado integralmente do Eletropiso (23 service_categories, sub_agents, prompt_sections, validator, business_info, excluded_products...) **EXCETO** `business_hours = NULL` (sandbox atende 24/7)

**Webhook UAZAPI:** usuário configurou apontando pra `https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook` (direto, sem n8n).

**Smoke validado:** curl POST com payload simulado → 200 OK + conversation_id criado. Cleanup das rows de teste OK.

**Vantagens:**
- Testes não poluem dados Eletropiso real
- Pode testar fora de horário (ou simulando) sem afetar atendentes
- Config independente: pode mexer no agente sandbox sem risco
- Fixes R103/R104/R105/R106 valem aqui também (mesma versão da fn)

**Frase pra retomar:**
- **"executar plano de teste sandbox"** — começa do Cenário 1 do plano
- **"prossiga"** — Onda 5 Playwright

---

## 2026-05-06 (noite — Auditoria do AI Agent: R103 + R104 + R105 corrigidos)

**Trigger:** usuária reportou 4 perguntas após smoke E2E + análise da conversa do George (20:27-21:01 BRT). Investigação produziu 3 bugs reais corrigidos.

### R103 — LLM pulava `tipo_tinta` na qualificação

**Sintoma:** IA não perguntou se era acrílica/esmalte/verniz. Foi de ambiente direto pra cor (priority 3) misturada com marca (de outra stage).

**Causa:** helper `getNextField()` em `_shared/serviceCategories.ts` existia e era testado, mas **nunca era chamado em produção**. O LLM tinha que inferir a próxima pergunta sozinho com base em texto no system prompt — improvisava.

**Fix:** nova função `buildQualificationContext()` em `ai-agent/index.ts` que pré-computa a próxima pergunta a cada turno (categoria → stage → próximo field via `getNextField` → phrasing pronto via `formatPhrasing`) e injeta como bloco `[QUALIFICAÇÃO ATUAL]` no system prompt. LLM passa a transcrever em vez de inferir.

**Lição (R103):** helper exportado + testado mas sem caller em produção é dívida silenciosa.

### R104 — Tag `marca_indisponivel:rosa,_parede,_interna` (falso positivo)

**Sintoma:** após search_products falhar, IA tagou a query inteira como marca indisponível. "rosa" é cor, "parede"/"interna" é ambiente.

**Causa:** em `ai-agent/index.ts`, quando AND filter retorna zero produtos, código pega `missingTerms` (palavras da query ausentes em todo catálogo) e seta `brandNotFound = missingTerms.join(', ')`. Heurística boa pra catálogos grandes (faltar 1-2 termos = provável marca), péssima pra catálogos rasos (Eletropiso = 7 produtos → quase qualquer query tem 3+ termos faltando).

**Fix:** guard `missingTerms.length <= 2` em ambos caminhos (AND filter result + wordByWordBroad). Com ≥3 termos faltando, deixa `brandNotFound = null` (catálogo raso, não falta de marca).

**Lição (R104):** detecção heurística sem lista de referência (ex: marcas conhecidas) precisa de guard de tamanho contra falsos positivos.

### R105 — `business_hours` NULL pós-migração

**Sintoma:** usuária mandou msg 20:51 BRT (fora horário 08-18h), IA respondeu normalmente sem disparar `out_of_hours_message`.

**Causa:** coluna `ai_agents.business_hours` ficou NULL no projeto novo (não veio na migração via dblink). R99 cobriu schema mas não dados. Sem `business_hours`, o código do ai-agent pula a checagem inteira (`if (bh && typeof bh === 'object')`).

**Fix:** UPDATE direto via MCP populando formato weekly Eletropiso (Seg-Sex 8-18, Sáb 8-12, Dom fechado). `out_of_hours_message` já estava cadastrada — só faltavam os horários.

**Lição (R105):** ao migrar JSONB opcional, fazer diff explícito `WHERE coluna IS NULL` no novo + smoke test específico (cenário fora de horário). Validar schema não basta.

### Auditoria geral — outros achados

- ✅ **Crons HTTP:** todos 4 batendo no novo `prfcbfumyrrycsrcrvms.supabase.co`
- ✅ **status_ia consistente:** 17/17 conversas com valor válido (única `shadow` é a do George pós-handoff)
- ✅ **handoff_queue_events:** 12 totais, 1 responded (Alberto pegou George), 0 active orfãs
- ✅ **GRANTs service_role:** 91/91 tabelas após R101
- ✅ **Tabelas órfãs:** apenas `message_templates` (legítima — Broadcast templates) e `pg_stat_progress_basebackup` (system view nativa)
- ⚠️ **B3 (cache stale React Query):** ainda aberto, refresh resolve, baixa prioridade

### Deploy

- `ai-agent` v1 → v2 (R103 + R104) via `npx supabase functions deploy`
- `business_hours` populado via MCP (R105)
- 0 erros tsc

### Frase pra retomar
- **"testar nova conversa"** — você manda msg fora de horário OU manda msg pedindo tinta e valida ordem das perguntas
- **"prossiga"** — Onda 5 Playwright (drag-drop, realtime)
- **"investigar B3 cache stale"** — atacar o realtime do helpdesk

---

## 2026-05-06 (noite — Projeto antigo `euljumeflwtljegknawy` PAUSADO)

**Decisão usuária:** pausar projeto antigo agora (não esperar 24-48h) já que smoke E2E completo confirmou cutover OK.

**Confirmação dupla antes do pause:**
- `mcp__supabase__list_projects` listou 2 projetos na org `qwxxtqdqletmetdnqmes`:
  - `crzcpnczpuzwieyzbqev` "Novo WsmartQR" (2026-02-22) — **NÃO pausado** (não foi pedido)
  - `euljumeflwtljegknawy` "wspro_v2" (2026-03-20) — **migrado pro `prfcbfumyrrycsrcrvms`** ✅ alvo correto

**Pause executado:** `mcp__supabase__pause_project` retornou `{success:true}`. Status: `ACTIVE_HEALTHY → PAUSING → INACTIVE` (~30s). Free Tier: projeto fica recuperável por 90d antes de receber warning.

**Restore (caso precise):** dashboard → Settings → General → "Restore project" (<1min). Nada deletado, só compute desligado. DB + storage + edge fns + crons preservados em snapshot.

**Não impactado pelo pause:**
- Atendentes Eletropiso operam 100% no novo `prfcbfumyrrycsrcrvms`
- n8n workflow `eletropiso_2026` aponta pro novo (Onda 7 da migração)
- UAZAPI webhook aponta pro n8n (sem mudança necessária)
- Frontend bundle aponta pro novo (commit `629916e`)

**Pendências paralelas (não relacionadas ao pause):**
- Deploy `whatsapp-webhook` no novo (R102 fix) — `npx supabase functions deploy whatsapp-webhook --project-ref prfcbfumyrrycsrcrvms`
- Rotação de credenciais (lista em `wiki/migracao-eletropiso-COMPLETA`)
- Investigar realtime cache stale do helpdesk (#1 + #2 da última smoke)

**Frase pra retomar:**
- **"deployar webhook"** — eu te dou o comando, você roda
- **"prossiga"** — Onda 5 Playwright
- **"rotacionar credenciais"** — checklist da rotação pós-migração

---

## 2026-05-06 (noite — HOTFIX R102: dept NULL em conversas atendidas pela IA + smoke completo)

**Smoke E2E completo finalmente:** usuária mandou "Olá" no WhatsApp, IA respondeu "Olá! Bem-vindo a Eletropiso, com quem eu falo?". 🎉

**3 dúvidas reportadas pela usuária — diagnóstico:**

1. **Conversa George não aparece na lista** — está sim no DB (`828e45b2-...`, last_msg 23:27). **Cache stale do React Query** (hook `useHelpdeskConversations` carregou antes do INSERT, realtime broadcast não invalidou). **Refresh resolve.** Não é bug de DB.
2. **Botão "Ativar IA" desligado** — DB diz `status_ia='ligada'` ✅. Mesmo cache stale. **Refresh resolve.**
3. **Departamento "Nenhum"** — DB confirma `department_id=NULL` ❌. **Bug real R102.**

### R102 — Webhook não populava dept em conversas novas

**Causa:** `whatsapp-webhook/index.ts:789-801` setava apenas `inbox_id, contact_id, status, priority, is_read, last_message_at` no INSERT de conversa nova. R95 (2026-05-05) corrigiu o caminho do `assign-handoff`, mas conversas atendidas pela IA (que NUNCA fazem handoff) ficavam sem dept indefinidamente.

**Impacto:** 16 conversas Eletropiso afetadas (incluindo a recém-criada do George).

**Fix aplicado:**
1. **Backfill SQL via MCP** — 16 conversas ganharam `department_id=Vendas` (UPDATE com JOIN inboxes WHERE dept IS NULL AND default_department_id IS NOT NULL)
2. **Fix código:** SELECT de inbox passa a incluir `default_department_id`; INSERT de conversa popula `department_id: inbox.default_department_id ?? null`. tsc 0.

**Pendente operacional:** usuário precisa rodar `npx supabase functions deploy whatsapp-webhook --project-ref prfcbfumyrrycsrcrvms` (eu não tenho PAT da org nova). Sem deploy, próximas conversas novas voltam a entrar com dept NULL — backfill cobre só as existentes.

**SYNC RULE:** N/A (fix backend isolado, não AI Agent feature).

**R102 documentado** em `wiki/erros-e-licoes.md` (linhas 226-247) com regra preventiva: ao criar registro novo em tabela com FK opcional para config default em parent, popular desde criação — não confiar em fluxo posterior (handoff) pra setar.

### Status final do smoke E2E migração

✅ Mensagem WhatsApp recebida pelo webhook (R101 fechou o gate)
✅ IA processou e respondeu corretamente
✅ Conversa criada no helpdesk
✅ Department populado após R102 backfill (refresh do UI mostra "Vendas")
⚠️ Cache stale do React Query — refresh resolve, mas merece investigação do hook `useHelpdeskConversations`/realtime broadcast em sessão futura

**Smoke E2E migração Eletropiso COMPLETO.** Atendentes operam plenamente no projeto novo.

**Frase pra retomar:**
- **"investigar realtime cache stale helpdesk"** — atacar #1 e #2 (cache stale ao receber msg nova)
- **"prossiga"** — Onda 5 Playwright
- **"pausar projeto antigo"** — pausar `euljumeflwtljegknawy` (recuperável 30d) já que smoke 100%

---

## 2026-05-06 (noite — HOTFIX R101: GRANTs faltando para service_role)

**Goal:** Smoke E2E real da migração — usuária mandou WhatsApp pro Eletropiso, n8n recebeu UAZAPI webhook, encaminhou pro `whatsapp-webhook` do projeto novo, **404 "Instance not found"**. Atendentes não recebiam mensagens.

**Cadeia de diagnóstico:**
1. SQL direto: `SELECT * FROM instances WHERE name='Eletropiso'` → 1 row OK (token bate, owner_jid bate)
2. Reproduzi 404 via curl direto na edge fn
3. Testei query OR via PostgREST com publishable key → `[]` (esperado por RLS)
4. Policies RLS de `instances`: 4 policies normais
5. **GRANTs:** `anon`, `authenticated`, `postgres` tinham SELECT. **`service_role` NÃO tinha GRANT em NENHUMA das 91 tabelas public.**

**Causa raiz:** R98 (hotfix da migração) corrigiu GRANTs para `anon`/`authenticated` mas esqueceu `service_role`. Service_role normalmente bypassa RLS, mas precisa do GRANT básico antes — sem ele, recebe `[]` silenciosamente em SELECTs (sem erro 42501, sem nada). **TODAS as 41 edge fns que usam `createServiceClient()` estavam silenciosamente quebradas** desde o cutover (5h atrás).

**Fix:** Migration `20260506232300_r101_grant_service_role_public.sql` aplicada via MCP. Aplica os mesmos GRANTs do R98, mas para `service_role`.

**Validação:**
- `service_role_has_grants` 0 → 91 tabelas
- `curl POST /functions/v1/whatsapp-webhook` com payload UAZAPI Eletropiso → **200 OK + conversation_id `4e1625cd-...`**
- Cleanup: deletei conversa de teste + contact duplicado "George Test" (`410e62c1-...`); George real (`d54caaac...`, criado 2026-02-24) intacto

**SYNC RULE:** N/A (fix infraestrutural, não AI Agent feature). Migration registrada no repo.

**R101 documentado** em `wiki/erros-e-licoes.md` (linhas 191-225) com:
- Cadeia completa de descoberta
- Por que escapou (R98 cobriu apenas anon/authenticated, service_role não testado)
- Regra preventiva: ao replicar projeto Supabase, conferir GRANTs em **3 roles** (anon, authenticated, service_role)
- Verificação rápida via `information_schema.role_table_grants`
- **Smoke E2E real é o único teste que pega esse padrão** (Playwright client-side não detecta — passa pelo authenticated com RLS, não service_role)

**Próximo:** smoke E2E real completo — usuária precisa **mandar outra msg WhatsApp** (n8n não retentou a primeira). Validar fluxo end-to-end (msg recebida → IA responde → conversa visível no helpdesk).

**Frase pra retomar:**
- **"continuar smoke E2E"** — você manda outra msg pro 558181696546 e eu valido fluxo completo
- **"prossiga"** — Onda 5 Playwright

---

