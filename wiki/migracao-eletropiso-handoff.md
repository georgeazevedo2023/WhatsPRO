---
title: Handoff — Migração WhatsPRO Eletropiso para Supabase novo
tags: [handoff, migracao, eletropiso, supabase, sprints, auditoria]
sources: [auditoria-completa-2026-05-05, log.md, decisão sessão 2026-05-05 noite]
updated: 2026-05-05
---

# Handoff — Migração Eletropiso para Supabase novo

> Contexto pra próxima sessão (provavelmente eu mesmo, em outra janela do Claude). Sessão atual será encerrada antes da execução. **Frase de retomada na primeira linha.**

## 🔁 Frase pra retomar

```
continuar migração eletropiso
```

Quando você abrir nova sessão e digitar isso, eu devo:
1. Ler este arquivo INTEIRO
2. Ler `wiki/auditoria-completa-2026-05-05.md` (plano de correção)
3. Confirmar que MCP do Supabase agora vê o projeto novo (`prfcbfumyrrycsrcrvms`)
4. Começar pelo **próximo passo imediato** abaixo

## 🚨 Avisos de segurança (LER PRIMEIRO)

1. **Credenciais do projeto novo `prfcbfumyrrycsrcrvms` foram passadas em chat anterior** (Database password, Service Role JWT, Personal Access Token). Estão expostas no histórico de conversa do Claude. **Após a migração concluir e validar:** rotacionar TODAS as credenciais no painel Supabase (Settings → API → Rotate). Pessoal Access Token também (`sbp_*`).
2. **NUNCA commitar credenciais.** Salvar em `.env.local` (já no .gitignore) ou cofre tipo 1Password.
3. **Antes de reiniciar a sessão:** copiar as credenciais pra um local seguro fora do chat. Quando reiniciar Claude, o histórico antigo permanece acessível pelo runtime mas não pelos próximos modelos.

## 📍 Estado atual (sessão 2026-05-05 noite)

### Projeto antigo (`euljumeflwtljegknawy` — wspro_v2)
- **Sprint 1 da auditoria SHIPPED** (commit `e4def62`):
  - P1-3 ALTER FUNCTION SET search_path em 24 fns SECURITY DEFINER
  - P1-4 + P1-5 process-jobs/processProfilePicFetch fetchWithTimeout + log warn
  - P1-8 6 FKs form_sessions/submissions com CASCADE/SET NULL
  - P1-1 process-flow-followups deployada v1 + smoke 200 OK
- vitest 736 pass / tsc 0 (zero regressão)
- DB: 26.6 MB / 500 MB (5.3%)

### Projeto novo (`prfcbfumyrrycsrcrvms`)
- Status: **vazio** — nenhum schema, dado, fn ou storage ainda
- Localização: organização Supabase **diferente** da `qwxxtqdqletmetdnqmes` (onde mora o antigo)
- **Bloqueio:** MCP atual NÃO vê esse projeto. Próxima sessão precisa ter MCP reconfigurado com `Personal Access Token sbp_64d35110…` OU usar curl direto

## 📝 Decisões consolidadas (10 itens)

| # | Decisão |
|:-:|---|
| 1 | **Estratégia: Clean migration** — só dados Eletropiso, descarta lixo de teste |
| 2 | Auth users: tentar preservar hash; avisar se algum precisar reset |
| 3 | Janela de downtime: flexível, multi-sessão, cutover só após validação completa |
| 4 | Projeto antigo após migração: **PAUSAR** (recuperável 30d), apagar só após confirmação total |
| 5 | n8n workflow `requeue-conversations`: usuário atualiza URL no painel `flux.wsmart.com.br` |
| 6 | UAZAPI webhook (instance Eletropiso): usuário atualiza no painel UAZAPI |
| 7 | **Sprints 2-6 da auditoria PRIMEIRO** (corrigir tudo no antigo), DEPOIS migra projeto saudável |
| 8 | Tenant: **só Eletropiso** (resto era teste, descarta) |
| 9 | Schema: replay das ~80 migrations em ordem (auditável) |
| 10 | Edge fns órfãs: eu auto-decido + reporto. HIGH RISK fns exigem aprovação por commit |

## 🛣️ Plano completo (multi-sessão)

### Fase A — Limpeza no antigo (Sprints 2-6 da auditoria, ~12-14h)

| Sprint | Conteúdo | Tempo | HIGH RISK? |
|---|---|---|:-:|
| **2** ✅ | P1-6 ChatPanel `getSessionUserId` async sem await + P1-7 Promise.then sem catch + P2-1 `activate-ia` CORS dinâmico + P2-3 `helpdeskBroadcast` R93 pattern — **SHIPPED 2026-05-05** (commit pendente nesta sessão) | 1h30 | Não |
| **3** ✅ | P1-2 `verify_jwt` drift (`activate-ia` + `ai-agent-playground`) — **SHIPPED 2026-05-06** (config alinhada, prod activate-ia v12 com `verify_jwt=false`) | 1h | **Sim** (toca config de fn HIGH RISK; aprovação explícita recebida) |
| **4** | 5 P2 medium: env var `FLUX_WEBHOOK_URL`, rollback UI ChatPanel, schema Zod PasteTab, `ALLOWED_ORIGIN` secret, particionar 3 wikis grandes | 4h | Não |
| **5** | 6 P2 cleanup: `flow_followups` policies, `keep_alive` RLS, `apply-env-secrets` órfã, Docker `:latest` tag, sub-folder index, etc | 4h | Parcial |
| **6** | 7 P3 backlog (opcional) | 2-3h | Não |

### Fase B — Migração pro novo (8 ondas, ~6-8h)

| Onda | Conteúdo | Toca quem |
|---|---|---|
| 0 ✅ | Inventário read-only do antigo: `instance_id` Eletropiso, contagens por tabela, lista users, storage objects, vault keys, cron jobs — **SHIPPED 2026-05-06** ([[wiki/migracao-eletropiso-inventario]]) | Antigo |
| 1 ✅ | Schema novo: replay das migrations do repo + 11 antigo-MCP-only — **SHIPPED 2026-05-06** | Novo |
| 2 ✅ | Dados Eletropiso (~1.944 rows): auth users + core multi-tenant + 15 contacts + 13 lead_profiles + 17 conversations + 1.341 messages + 274 validations + ai_agent + 7 products + 13 knowledge + 4 profiles + kanban + forms + flows + handoff_queue + globais — **SHIPPED 2026-05-06 via dblink (cross-check diff=0)**. Pendente: 4 storage objects | Antigo→Novo |
| 3 ✅ | Vault + 8 edge fn secrets shipped 2026-05-06. Todas 5 keys externas validadas via HTTP (UAZAPI/OpenAI/Groq/Gemini/Mistral). INTERNAL_FUNCTION_KEY regenerada. ALLOWED_ORIGIN apontando crm.wsmart.com.br | Novo |
| 4 | Deploy de 38-39 edge fns (excluindo órfãs como `apply-env-secrets`); HIGH RISK pausas | Novo |
| 5 | Recriar 12 pg_cron jobs com URL do novo project_ref | Novo |
| 6 | Frontend Docker: rebuild com novas envs (URL + publishable key) → push → você redeploy via Portainer | Repo + você |
| 7 | n8n workflow URL update + UAZAPI webhook URL update | **Você no painel** |
| 8 | Smoke E2E (login, helpdesk, conversa, IA, cron, monitoring); SE OK → **PAUSAR antigo**; SE FALHAR → rollback (UAZAPI volta antigo) | Ambos |

### Critério de "produção liso"
- Login funciona
- Helpdesk carrega conversas Eletropiso
- IA responde mensagem nova
- pg_cron jobs rodando OK
- snapshot_platform_usage roda diariamente
- 0 erros 4xx/5xx fora do esperado
- 1 conversa real testada end-to-end (ou conversa Josafa de teste se ainda existir)

## ⏭️ Próximo passo imediato (próxima sessão)

**MCP `supabase-novo` confirmado conectado** ao projeto `prfcbfumyrrycsrcrvms` (verificado 2026-05-05 via `get_project_url` → `https://prfcbfumyrrycsrcrvms.supabase.co`). Projeto está vazio (só `keepalive` placeholder em `public`).

**Sprint 2 SHIPPED 2026-05-05** (vide log.md + PRD v7.29.4): 4 fixes aplicados, tsc 0, vitest 736 pass / 5 fail (FormBuilder pré-existente) / 3 skip — idêntico ao baseline. Commit pendente.

**Próximo passo decisão:**
- **Opção A — Sprint 3 (HIGH RISK, ~1h):** P1-2 `verify_jwt` drift. Toca `supabase/functions/ai-agent-playground/index.ts` (HIGH RISK). Antes: ler ambas as fns (`activate-ia` + `ai-agent-playground`) pra confirmar manual-auth interno, decidir caminho (atualizar config.toml OU re-deploy), **esperar aprovação explícita por commit**. `activate-ia` pode ser re-deployada nesta sprint (já fixada o CORS na Sprint 2).
- **Opção B — Sprint 4 (sem HIGH RISK, ~4h):** P2-2 env var FLUX_WEBHOOK_URL + P2-4 rollback optimistic UI ChatPanel + P2-5 schema Zod PasteTab + P2-9 setar ALLOWED_ORIGIN secret + P2-11 particionar 3 wikis grandes.
- **Opção C — Pular pra Fase B (Migração) parcial:** começar inventário da Onda 0 do projeto antigo enquanto rolas Sprints 3-6.

## 🔗 Referências

- [[wiki/auditoria-completa-2026-05-05]] — plano de correção completo (187 linhas)
- [[wiki/erros-e-licoes]] — 96 regras (R88, R93, R96 críticas)
- [[wiki/free-forever-playbook]] — sentinel R96
- [[CLAUDE.md]] — protocolo de início/fim sessão + regras
- [[RULES.md]] — HIGH RISK files
- [[log.md]] — sessão 2026-05-05 inteira

## ⚠️ HIGH RISK files (NÃO tocar sem aprovação explícita)

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/ai-agent/types.ts`
- `supabase/functions/e2e-test/index.ts`
- `supabase/functions/ai-agent-playground/index.ts` ← Sprint 3 vai precisar tocar (verify_jwt drift)
