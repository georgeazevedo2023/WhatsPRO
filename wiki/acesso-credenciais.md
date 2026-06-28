---
title: Acesso, Credenciais & Keys — mapa único
type: referencia
updated: 2026-06-28
audited_at: 2026-06-28
tags: [acesso, credenciais, secrets, deploy, supabase, uazapi, n8n]
---

# Acesso, Credenciais & Keys — mapa único

> Inventário consolidado de **todos** os pontos de acesso e segredos do WhatsPRO. Auditado contra o código em 2026-06-28 (nomes de env vars extraídos de `Deno.env.get(...)` e `import.meta.env.*`). Ponteiro a partir do `CLAUDE.md` → seção "Deploy, Supabase & Acesso".

## 🔒 Regra de ouro (secret policy)

**VALOR de segredo NUNCA entra em arquivo commitado** (o secret-scanning do GitHub bloqueia o push). Cada segredo vive em **um** dos três lugares; aqui ficam só os **nomes** e os **ponteiros**:

| Camada | Onde o VALOR vive | Commitado? |
|---|---|---|
| Frontend (Vite) | `.env.local` / `.env` na raiz (gitignored via `.env.*`) | ❌ |
| Edge Functions (Deno) | **Supabase → Project Settings → Edge Functions → Secrets** (ou `supabase secrets set`) | ❌ |
| Operação (PAT, webhook Portainer, senha admin) | **memória do Claude** (`reference_*`) + `.env.local` | ❌ |

---

## 1. Supabase (projeto de produção)

| Item | Valor |
|---|---|
| Project ref | `prfcbfumyrrycsrcrvms` ⚠️ antigo `euljumeflwtljegknawy` **MORTO** |
| URL | `https://prfcbfumyrrycsrcrvms.supabase.co` |
| Conta | `eletropiso.wsmart@gmail.com` |
| Org | `mqebydjkmkvbmvzjfwgl` (separada da antiga `qwxxtqdqletmetdnqmes`, que tinha o `wspro_v2` pausado) |
| PAT (deploy CLI) | **valor → memória [[reference_supabase_token_novo]]** (`sbp_…`). O antigo [[reference_supabase_token]] dá 403 |
| CLI | binário scoop `C:\Users\georg\scoop\shims\supabase.exe` — **`npx supabase` quebra** (`uv_spawn`) |
| Deploy edge fn | `$env:SUPABASE_ACCESS_TOKEN=<PAT>; supabase functions deploy <fn> --project-ref prfcbfumyrrycsrcrvms --use-api` |
| MCP `mcp__supabase` | lê metadados (list_*, get_logs, advisors). ⚠️ **`execute_sql` e endpoints de management dão 403** (privilégio da conta no endpoint) — confirmado 2026-06-28. Pra rodar SQL, usar conta/dashboard com acesso. |

**Secrets do runtime Supabase** (injetados automaticamente nas edge fns — NÃO setar à mão): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

---

## 2. Frontend — env vars (Vite, em `.env.local`/`.env`)

Lidas via `import.meta.env.*` (ver `src/integrations/supabase/client.ts`):

- `VITE_SUPABASE_URL` — URL do projeto
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferida) **ou** `VITE_SUPABASE_ANON_KEY` (fallback) — chave pública (RLS protege)
- `import.meta.env.PROD` — flag de build (não é segredo)

Sem essas duas o app lança `Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 3. Admin de produção (login)

- **Email:** `george.azevedo2023@gmail.com` · **Domínio:** `crm.wsmart.com.br`
- **Senha:** NÃO em memória (design) → `.env.local` como `ADMIN_PASSWORD` (+ `ADMIN_EMAIL`); Playwright/Node lê `process.env.ADMIN_*`. Detalhe: [[reference_admin_login]]
- O e-mail do usuário desta sessão (`userEmail`) pode diferir do admin de prod — confirmar antes de agir como admin.

---

## 4. Edge Functions — secrets (nomes; valores no painel Supabase)

Agrupados por finalidade (extraídos de `Deno.env.get(...)`):

- **LLM / IA:** `OPENAI_API_KEY` (primário), `GEMINI_API_KEY` (+ alias `GOOGLE_AI_API_KEY`), `GROQ_API_KEY` (Whisper/transcrição + resumos)
- **TTS:** `CARTESIA_API_KEY`, `MURF_API_KEY`, `SPEECHIFY_API_KEY`
- **WhatsApp/UAZAPI:** `UAZAPI_SERVER_URL` (= `https://wsmart.uazapi.com`), `UAZAPI_ADMIN_TOKEN` (admintoken global)
- **Interno/webhook:** `INTERNAL_FUNCTION_KEY` (auth de chamadas internas/cron — `_shared/auth.ts`), `WEBHOOK_SECRET` (**opcional** — UAZAPI não manda header, NUNCA torná-lo obrigatório: [[feedback_webhook_secret_uazapi]])
- **CORS / URLs:** `ALLOWED_ORIGIN` (obrigatório; default `*` é falha de segurança), `CRM_URL`, `APP_URL`

> ⚠️ Doc-drift: a memória antiga [[feedback_verify_jwt_cron_functions]] cita `CRON_AUTH_KEY`; o **código atual** usa `INTERNAL_FUNCTION_KEY` (`_shared/auth.ts` `verifyCronOrService`). Tratar `INTERNAL_FUNCTION_KEY` como a fonte da verdade.

---

## 5. Hosting & deploy do frontend

- **Pipeline:** `git push origin master` → GitHub Actions (`Build and Push Docker Image`) → `ghcr.io/georgeazevedo2023/whatspro:latest` → **webhook Portainer (MANUAL)** → redeploy.
- **Webhook Portainer:** URL-capability → **valor em [[reference_portainer_webhook]]** (`https://app.wsmart.com.br/api/webhooks/…`, POST sem body → 204). Não commitar.
- **Servidor:** Portainer stack `whatspro` · Hetzner CX42 (`65.108.51.109`) · Traefik + SSL letsencrypt · domínio `crm.wsmart.com.br`.
- ⚠️ **CI `success` ≠ DEPLOYADO** — o redeploy do servidor é o webhook manual. Verificar bundle live (hash do `index-*.js` mudou + grep de um marker do código novo). Lição completa em [[reference_portainer_webhook]].

---

## 6. Ingestão de mensagens (entrada) — via n8n, NÃO direto

`UAZAPI → n8n → whatsapp-webhook`. UAZAPI **não** chama a edge fn direto:

1. UAZAPI (webhook da instância) → **n8n** `https://fluxwebhook.wsmart.com.br/webhook/<path>` (ex.: `eletropiso_2026`, um path por instância)
2. n8n (Webhook node → HTTP Request POST, body = `$json.body` cru, **sem auth/retry/timeout**) → edge fn `whatsapp-webhook` (`.../functions/v1/whatsapp-webhook`, `verify_jwt=false`)
3. → DB → `ai-agent-debounce` → `ai-agent`

**Consequência:** lag/lote de entrada normalmente é do **n8n** (fila/retry/restart), não da edge fn. Detalhe: [[project_message_ingestion_n8n]].

---

## 7. UAZAPI (WhatsApp API)

- **Servidor:** `https://wsmart.uazapi.com` (v2 uazapiGO, Go) — env `UAZAPI_SERVER_URL`
- **Auth:** header `token` (por instância, resolvido server-side no `uazapi-proxy` — nunca no frontend) + `admintoken` (global, env `UAZAPI_ADMIN_TOKEN`)
- **Docs:** `https://docs.uazapi.com/` (SPA JS, não scrapável por WebFetch) → usar skill `/uazapi`
- **Quirk webhook:** `message.sender` vem como `@lid`; telefone real em `sender_pn`/`chatid` ([[reference_uazapi_webhook_sender_pn]])

---

## 8. Onde cada VALOR-segredo vive (ponteiro rápido)

| Segredo | Local | Ponteiro |
|---|---|---|
| Supabase PAT (deploy) | memória | [[reference_supabase_token_novo]] |
| Webhook Portainer | memória | [[reference_portainer_webhook]] |
| Senha admin prod | `.env.local` (`ADMIN_PASSWORD`) | [[reference_admin_login]] |
| Keys frontend (anon/url) | `.env.local` (`VITE_*`) | seção 2 |
| Keys edge fn (OpenAI/Gemini/Groq/UAZAPI/TTS…) | Supabase Secrets | seção 4 |

---

## 9. Pendências de segurança (conhecidas)

- 🔑 **Rotacionar o PAT Supabase** — trafegou em chat (2026-05-06); rotacionar junto às demais credenciais da migração.
- 🔑 **Senha admin fraca** (`123456@` na 1ª sessão) → trocar p/ 16+ chars, atualizar `.env.local`, revogar antiga no Supabase Auth.
- 🔑 **JWT hardcoded em migrations de cron** + rotação de tokens expostos (auditoria v2.9.0).
- 🔑 **`ALLOWED_ORIGIN`** deve falhar hard em prod (não cair pro default `*`).
