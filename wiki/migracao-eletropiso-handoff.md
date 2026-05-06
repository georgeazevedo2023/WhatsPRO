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
| **2** | P1-6 ChatPanel `getSessionUserId` async sem await + P1-7 Promise.then sem catch + P2-1 `activate-ia` CORS dinâmico + P2-3 `helpdeskBroadcast` R93 pattern | 1h30 | Não |
| **3** | P1-2 `verify_jwt` drift (`activate-ia` + `ai-agent-playground`) | 1h | **Sim** (toca `ai-agent-playground`) |
| **4** | 5 P2 medium: env var `FLUX_WEBHOOK_URL`, rollback UI ChatPanel, schema Zod PasteTab, `ALLOWED_ORIGIN` secret, particionar 3 wikis grandes | 4h | Não |
| **5** | 6 P2 cleanup: `flow_followups` policies, `keep_alive` RLS, `apply-env-secrets` órfã, Docker `:latest` tag, sub-folder index, etc | 4h | Parcial |
| **6** | 7 P3 backlog (opcional) | 2-3h | Não |

### Fase B — Migração pro novo (8 ondas, ~6-8h)

| Onda | Conteúdo | Toca quem |
|---|---|---|
| 0 | Inventário read-only do antigo: `instance_id` Eletropiso, contagens por tabela, lista users, storage objects, vault keys, env vars | Antigo |
| 1 | Schema novo: replay de TODAS as migrations do repo, em ordem | Novo |
| 2 | Dados Eletropiso: `WHERE instance_id = $eletropiso_id` por tabela. Auth users: super_admin + atendentes Eletropiso | Antigo→Novo |
| 3 | Vault + secrets + env vars: você me passa valores quando eu pedir; setar via Management API | Novo |
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

**Pré-requisito antes de qualquer coisa:** confirmar que o MCP do Supabase tem acesso ao projeto novo `prfcbfumyrrycsrcrvms`. Testar com:

```
mcp__supabase__list_projects
```

Se aparecer `prfcbfumyrrycsrcrvms` na lista → **OK, prosseguir com Sprint 2**.
Se NÃO aparecer → **bloqueio**: o token MCP precisa ser trocado pelo `sbp_64d35110…`. Avisar o usuário pra editar `claude_desktop_config.json` (ou equivalente) e reiniciar Claude Code.

**Se MCP OK:** começar **Sprint 2 da auditoria**:
1. Ler `src/components/helpdesk/ChatPanel.tsx:206` (P1-6 — async sem await)
2. Ler `src/components/helpdesk/ChatPanel.tsx:83-84` (P1-7 — Promise.then sem catch)
3. Ler `supabase/functions/activate-ia/index.ts` (P2-1 — CORS estático)
4. Ler `src/lib/helpdeskBroadcast.ts:50,68` (P2-3 — UPDATE silencioso)
5. Aplicar fixes; rodar tsc + vitest baseline (esperado 736 pass); commit

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
