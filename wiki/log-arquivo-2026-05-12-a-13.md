---
title: Log Arquivo 2026-05-12 a 2026-05-13
description: Entradas movidas de log.md em 2026-05-17 (hard limit). Cobre v7.35.1-v7.36.2.
type: log
audited_at: 2026-05-17
---

# Log Arquivo 2026-05-12 a 2026-05-13

> Movido de `log.md` em 2026-05-17 ao chegar perto do limite de 300 linhas.

---

## 2026-05-13 (noite) — Auto-extração de fields + carrossel bonito (v7.36.2)

### Bug 4 — IA pergunta o que lead já disse na 1ª msg
- Lead: "Tem tinta acrílica fosco?" → IA depois pediu tipo+acabamento (violação regra 1339)
- Confirmado por SQL: `conversations.tags` só tinha `interesse:tinta`+`ambiente:interno`+`tipo_tinta:acrílica` (tarde, T9) — faltou `acabamento:fosco`, e tipo_tinta veio tarde demais
- Diagnóstico: **timing**. LLM não chamava set_tags antes do qualificationContext computar próxima pergunta.
- **Fix:** defesa em código — `_shared/fieldAutoExtractor.ts` scaneia `incomingText` cruzando com `examples` dos fields. Pré-popula tags ANTES de `buildQualificationContext`. Log em `ai_agent_logs.event='auto_field_extracted'`.
- **Plus:** reforço de prompt em hardcodedRules com exemplo concreto.

### Bug 5 — Carrossel feio no helpdesk
- Fix CSS: botões com fundo colorido (verde REPLY, azul URL, âmbar CALL), CornerDownLeft, card maior w-52, shadow.

### Testes
- 20 vitest novos em `fieldAutoExtractor.test.ts` — cobrem parseExamples, word boundary, acentos, negação (até 4 palavras entre gatilho e match), fields numéricos pulados, alreadySetKeys honrado, flattenCategoryFields.
- tsc 0 erros.

### Deploys
- `ai-agent` v30 via MCP (HIGH RISK, aprovado pelo gestor)
- Frontend: refresh

### Validação
- ❌ E2E **pendente** — gestor precisa refazer "Tem tinta acrílica fosco?" pra confirmar que IA pula tipo + acabamento

### Lição registrada
[[wiki/erros-e-licoes]] — entrada nova "Timing entre LLM e qualificationContext: extração proativa requer defesa em código, não só prompt"

### Próximo handoff
Frase: **"validação auto-extract field 2026-05-13"**

---

## 2026-05-13 (tarde) — Carrossel: botões + button-reply + anti-eco (v7.36.1)

3 bugs E2E: (1) Bug 3 IA parava após clique no carrossel — webhook tentou 8 variantes Baileys (não funcionou, ver v7.36.3 abaixo pra fix definitivo); (2) Bug 2A helpdesk não exibia botões — `MessageBubble:396` lê `btn.label || btn.text`; (3) Bug 1 anti-eco — nova regra hardcoded em `ai-agent:1339`. Deploys: webhook v6, ai-agent v29. Detalhe completo em `CHANGELOG v7.36.1`.

---

## 2026-05-13 — Agente atende 24/7 + toggle "Avisar fora do horário" (v7.36.0)

Removido o skip out-of-hours em `ai-agent/index.ts:235-286`. Novo campo `ai_agents.notify_outside_hours_on_handoff` (default true): ON → atendentes só no horário, transbordo fora usa `handoff_message_outside_hours`; OFF → atendentes 24/7. Modo Estendido (D30) inalterado. `out_of_hours_message` virou legado.

SYNC RULE 8 locais cumprida (DB, types, admin UI `BusinessHoursEditor` + Switch tooltip, ALLOWED_FIELDS, backend, prompt hint fora-do-horário, defaults, vault). Vitest 13/13. tsc 0. Detalhe completo em `CHANGELOG v7.36.0` + `wiki/decisoes-chave.md` (D32).

Deploy `ai-agent` v29 via MCP. Frase de retomada: **"deploy notify_outside_hours_on_handoff 2026-05-13"**

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-12

> **Frase pra retomar na próxima sessão:**
>
> **`"contexto dashboard gestor v7.33-v7.35"`**
>
> Ao receber, executar protocolo de início (5 passos) e priorizar leitura deste handoff + 3 entradas mais recentes do log.

### O que foi entregue (sessão inteira) — 4 releases shipados em prod

| Versão | Tema | Commits |
|---|---|---|
| **v7.33.0** | Dashboard do Gestor unificado (Fase 1) — 4 zonas, `instances.is_sandbox`, RPC `get_leads_new_vs_returning` | `66d2461` |
| **v7.34.0** | Métricas avançadas (Fase 2) — 4 RPCs (response_time P50/P95, abandoned 24h, demand×coverage, conversion by origin) + 4 cards | `66d2461` |
| **v7.35.0** | Pivô comercial (Fase 3) — sem custos, com leads sem 1ª resposta + cotações em andamento + Top Objeções promovido | `c93bb36` |
| **v7.35.1** | Botão limpar pendências — tag `dashboard:dispensed` com undo (toast Sonner) | `fda01ea` |
| **v7.35.2** | Retention 24h em logs do Supabase — banco 52 MB → 23 MB, cron horário | `2cfcb99` |
| **v7.35.3** | 🐛 **Fix crítico** — RPC `append_ai_debounce_message` com tipo `uuid` quebrava IA inteira (pipeline silenciado por 3 fire-and-forget) | `1e44633` |

### Estado do código

- **Branch master** no commit `7172c2d` (= último, com 8 migrations registradas localmente).
- **DB Supabase**: todas 8 migrations aplicadas em prod (deployadas via MCP no momento do desenvolvimento).
- **Frontend Docker**: imagem nova no GHCR, redeploy do container `crm.wsmart.com.br` disparado via webhook Portainer (HTTP 204).
- **TypeScript**: `tsc --noEmit` = 0 erros.
- **Vault healthcheck**: ✅ todos arquivos ≤ 300 linhas.

### Validações E2E confirmadas

- Banco Supabase voltou a 23 MB (era 52 MB).
- Cron `purge_system_logs_24h` ativo (`active=true`, schedule `0 * * * *`).
- Áudio "Olá, boa noite, estou testando o áudio, vocês tem tinta esmalte..." disparou pipeline: `01:18:04 recebido → 01:18:36 IA respondeu` (fora do horário comercial, retornou `out_of_hours_message` — comportamento correto).

### Sinais de produto descobertos (vale levantar com o time)

1. **0 vendas tagueadas `venda:fechada`** em 30 dias na Eletropiso (12 conversas, 7 leads via "direto") → fluxo de tagueamento não está sendo aplicado pelo comercial.
2. **0 cotações tagueadas `motivo:orcamento`** apesar de leads pedindo orçamento → mesma causa.
3. **1 lead sem 1ª resposta há 716h (30 dias)** → time perdeu lead concreto.
4. **Bug do AI Agent estava quieto há possivelmente dias** sem ninguém notar — falta alarme no pipeline.

### Pendências declaradas (não bloqueantes)

- **Validar dashboard logado como gerente real**: Playwright caiu no /login (sem credencial), validação visual end-to-end ainda manual.
- **Fase 4 do dashboard (backlog)**: drill-down ao clicar em card, comparação período-vs-período (P50 hoje vs 7d), alertas configuráveis (P95 > X min → notify WhatsApp pessoal do gestor), export CSV.
- **Pipeline fire-and-forget sem alarme**: o bug `22P02` ficou invisível por dias. Vale uma observabilidade mínima (cron diário que verifica `ai_agent_logs` recente vs `conversation_messages incoming` recente, alerta se gap > 1h).

### Lição salva em `wiki/erros-e-licoes.md`

Top-1 atual: "Tipo de parâmetro de RPC divergente da coluna real (uuid vs text)" — com 3 regras preventivas.

---

## 2026-05-12 — Fix RPC append_ai_debounce_message (v7.35.3) ⚠️ bug crítico de prod

**Investigação iniciada pelo gestor:** "pq o agente ia não respondeu meu áudio?".

**Diagnóstico:**
- Mensagem incoming OK, transcrição OK (Groq fez), mas `ai_debounce_queue` sem entry nova e `ai_agent_logs` zerado em 24h.
- Webhook pula áudio de propósito ("Skip audio messages — transcribe-audio will trigger"). transcribe-audio chama ai-agent-debounce. ai-agent-debounce chama RPC `append_ai_debounce_message`.
- RPC declarada com `p_instance_id uuid`. Instâncias UAZAPI usam `text` (`r466a98889b5809`). Erro `22P02: invalid input syntax for type uuid` silenciado por 2 camadas de fire-and-forget.
- Reproduzi o erro chamando a RPC manualmente.

**Fix:** migration `fix_append_ai_debounce_message_instance_id_text` (DROP + CREATE com tipo correto). Smoke test rodou com instance/conv real.

**Pendente:** validação E2E (user precisa mandar msg nova no WhatsApp Eletropiso pra confirmar IA responde).

**Lição:** bugs em fire-and-forget de duas camadas viram invisíveis se a função interna estoura. Defesa: `ai-agent-debounce` deveria logar `error` da chamada RPC, não engolir.

---

## 2026-05-12 — Retention 24h em logs do Supabase (v7.35.2)

**Investigação iniciada pelo gestor:** "52 MB? o que está ocupando?". Análise revelou que 30 MB (55%) eram logs internos sem valor operacional:
- `net._http_response` (pg_net HTTP log) = 21 MB, cresce ~3 MB/hora.
- `cron.job_run_details` (pg_cron) = 8 MB, ~2.300 rows/dia.

**Ação imediata:** TRUNCATE nas duas → banco 52→23 MB.

**Permanente:** migration `cron_retention_system_logs_24h` cria função `purge_system_logs_older_than_24h()` (SECURITY DEFINER, retorna jsonb com contagens) + job pg_cron `purge_system_logs_24h` schedule `0 * * * *`. Bloco DO antes do schedule garante reaplicação idempotente (unschedule anterior se existir).

Smoke test: função roda OK, job ativo no `cron.job`.

---

## 2026-05-12 — Dashboard do Gestor: botão limpar pendências (v7.35.1)

**Pedido:** gestor precisa remover spam/teste das listas (ex: "Zig Online" não é negócio).

**Entregue:** tag `dashboard:dispensed` aplicada via 2 RPCs SECURITY DEFINER (`dispense_conversation_from_dashboard` / `restore_conversation_to_dashboard`). Append preserva tags existentes via DISTINCT unnest. As 3 RPCs de pendência filtram OUT a tag. UI: botão X ao lado do link externo + toast Sonner com action "Desfazer".

Não arquiva a conversa (helpdesk segue mostrando). Smoke test SQL completo OK. `tsc --noEmit` = 0.
