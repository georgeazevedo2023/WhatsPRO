---
title: Deploy e Infraestrutura — Documentacao Detalhada
tags: [deploy, docker, cicd, github, portainer, hetzner, detalhado]
sources: [Dockerfile, .github/workflows/deploy.yml, supabase/functions/health-check/, wiki/deploy-checklist.md]
updated: 2026-04-10
---

# Deploy e Infraestrutura — Producao e CI/CD (6 Sub-Funcionalidades)

> A infraestrutura do WhatsPRO e baseada em **Docker + GitHub Actions + Portainer** rodando num servidor Hetzner. O frontend e um app React compilado e servido pelo nginx. As edge functions rodam no Supabase Cloud. O deploy e automatico: push no branch `master` → GitHub Actions builda → publica imagem Docker → Portainer atualiza.
>
> Ver tambem: [[wiki/deploy]], [[wiki/deploy-checklist]], [[wiki/arquitetura]]

---

## 17.1 Docker (Frontend)

**O que e:** O frontend React e empacotado num container Docker com nginx.

**Build em 2 estagios:**
1. **Build** — Node 20 Alpine compila o React com Vite. Env vars VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY injetadas no build.
2. **Serve** — nginx:alpine serve os arquivos estaticos na porta 80.

**nginx configurado com:**
- SPA routing: `try_files $uri $uri/ /index.html` (React Router funciona)
- Cache 30 dias para assets estaticos
- Headers de seguranca: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- Gzip compressao habilitada

> **Tecnico:** `Dockerfile` multi-stage. Stage 1: `FROM node:20-alpine`, `npm ci`, `npm run build`. Stage 2: `FROM nginx:alpine`, copia `dist/` para `/usr/share/nginx/html/`. `nginx.conf` com SPA fallback + security headers + gzip. Porta 80 exposta.

---

## 17.2 CI/CD (GitHub Actions)

**O que e:** Pipeline automatico que builda e publica a imagem Docker quando codigo e pushado para `master`.

**Fluxo:**
1. Push no branch `master`
2. GitHub Actions inicia workflow
3. Builda imagem Docker
4. Publica no GitHub Container Registry (ghcr.io)
5. Tags: `latest` + SHA do commit

**Imagem:** `ghcr.io/georgeazevedo2023/whatspro:latest`

> **Tecnico:** Workflow `.github/workflows/deploy.yml`. Trigger: `push: branches: [master]`. Uses: `docker/build-push-action@v5`. Registry: GHCR. Tags: `latest` + `${{ github.sha }}`. Secrets: GITHUB_TOKEN para push.

---

## 17.3 Servidor (Hetzner + Portainer)

**O que e:** O servidor de producao e uma maquina Hetzner CX42 com Docker Swarm, Traefik (proxy reverso + SSL) e Portainer (gerenciamento visual).

**Infraestrutura:**
- **Servidor:** Hetzner CX42 (IP: 65.108.51.109)
- **Orquestracao:** Docker Swarm (1 replica)
- **Proxy reverso:** Traefik com SSL automatico (Let's Encrypt)
- **Dominio:** crm.wsmart.com.br
- **Gerenciamento:** Portainer (stack "whatspro")
- **Rede:** Docker network externa `wsmart`

**Deploy:** Apos push no GitHub, o Portainer detecta nova imagem e atualiza o container automaticamente (ou manualmente via interface).

> **Tecnico:** `docker-compose.yml`: service whatspro, image `ghcr.io/...`, deploy replicas 1, labels Traefik (Host, entrypoints, certresolver). Network: external `wsmart`. Portainer: stack name "whatspro", webhook trigger ou pull manual.

---

## 17.4 Edge Functions (Supabase Cloud)

**O que e:** As 31 edge functions rodam no Supabase Cloud (nao no servidor proprio). Deploy via CLI separado do Docker.

**Deploy:** `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <nome> --project-ref euljumeflwtljegknawy`

**Secrets necessarios (Supabase Vault):**
- ALLOWED_ORIGIN (https://crm.wsmart.com.br)
- OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY
- UAZAPI_SERVER_URL, UAZAPI_ADMIN_TOKEN
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
- INTERNAL_FUNCTION_KEY

> **Tecnico:** Config em `supabase/config.toml` (project_id, 30 function entries com verify_jwt). Deploy: CLI `npx supabase functions deploy`. Cada function: Deno runtime, imports de `_shared/`. verify_jwt=false para: webhooks, ai-agent, transcribe-audio, form-public, bio-public, go, health-check.

---

## 17.5 Health Check

**O que e:** Edge function que verifica se o sistema esta funcionando. Retorna 200 (OK) ou 503 (degradado).

**O que verifica:**
- **Banco de dados** — consegue fazer query na tabela instances?
- **Materialized View** — RPC has_inbox_access_fast() funciona?
- **Variaveis de ambiente** — SUPABASE_URL, WEBHOOK_SECRET, GEMINI_API_KEY, GROQ_API_KEY estao configuradas?

**Resposta:** Status, uptime em segundos, latencia total, resultado de cada check, flags de env vars.

> **Tecnico:** Edge function `health-check/index.ts`. GET sem JWT. Checks: `supabase.from('instances').select('id').limit(1)` (DB), `supabase.rpc('has_inbox_access_fast', {...})` (MV). Response: `{ status, uptime_s, total_latency_ms, checks: {database, materialized_view}, env: {flags} }`. 200 se todos OK, 503 se qualquer falhar.

---

## 17.6 Checklist de Deploy

**O que e:** Lista de verificacao obrigatoria antes e depois de cada deploy. Documentada em `wiki/deploy-checklist.md`.

**Pre-deploy (codigo):**
- TypeScript compila: `npx tsc --noEmit`
- Testes passam: `npx vitest run`
- Build producao: `npm run build`
- Sem debug logs ou `as any`

**Pre-deploy (seguranca):**
- Token UAZAPI nao exposto no frontend
- Auth manual em novas edge functions
- RLS habilitado em novas tabelas
- Secrets via Supabase Vault

**Pre-deploy (AI Agent se alterado):**
- SYNC RULE verificada (8 pontos)
- Batch E2E executado
- Validator rules atualizadas

**Deploy:**
- Build + push Docker (via GitHub Actions)
- Deploy edge functions: `npx supabase functions deploy <name>`
- Atualizar Portainer stack
- Smoke test: login → helpdesk → enviar mensagem → IA responde

**Pos-deploy:**
- Registrar em log.md
- Atualizar wiki/roadmap.md
- Monitorar Supabase dashboard
- Monitorar health-check
- Teste completo em producao

> **Tecnico:** Checklist em `wiki/deploy-checklist.md`. Referenciado no CLAUDE.md protocolo de fim de sessao ("Antes de DEPLOY: seguir wiki/deploy-checklist.md"). Edge functions: deploy individual com `--no-verify-jwt` quando aplicavel.

---

## Resumo da Infraestrutura

```
GitHub (codigo)
  ↓ push master
GitHub Actions (CI/CD)
  ↓ build + push
GHCR (imagem Docker)
  ↓ pull
Hetzner CX42 (servidor)
  ├── Docker Swarm (orquestracao)
  ├── Traefik (proxy + SSL)
  ├── nginx (frontend React)
  └── Portainer (gerenciamento)

Supabase Cloud (backend)
  ├── PostgreSQL (banco + RLS)
  ├── Auth (autenticacao)
  ├── Storage (arquivos)
  ├── Realtime (WebSocket)
  └── Edge Functions (31 funcoes Deno)

UAZAPI Cloud (WhatsApp)
  └── API de envio/recebimento de mensagens
```

---

## Links Relacionados

- [[wiki/deploy]] — Detalhes do servidor e Docker
- [[wiki/deploy-checklist]] — Checklist obrigatorio
- [[wiki/arquitetura]] — Stack tecnica completa
- [[ARCHITECTURE.md]] — Referencia tecnica rapida

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
