# Auditoria Completa WhatsPRO v3.2.0

**Data:** 2026-03-25
**Escopo:** 24 Edge Functions, 33 tabelas DB, 44 rotas frontend, Infra Docker/CI/CD
**Versão:** v3.2.0 (pós Sprint 9)

---

## Resumo Executivo

| Camada | CRITICAL | HIGH | MEDIUM | LOW | Score |
|---|---|---|---|---|---|
| **Edge Functions (24)** | 3 | 4 | 6 | 0 | 7/10 |
| **Frontend (44 rotas)** | 0 | 2 | 3 | 3 | 8/10 |
| **Banco de Dados (33 tabelas)** | 1 | 3 | 3 | 1 | 8/10 |
| **Infra (Docker/CI/CD)** | 0 | 0 | 1 | 1 | 9/10 |
| **TOTAL** | **4** | **9** | **13** | **5** | **8/10** |

---

## 1. Edge Functions (24 total)

### Inventário

| # | Function | Auth | APIs Externas | Status |
|---|----------|------|---------------|--------|
| 1 | activate-ia | verifySuperAdmin | UAZAPI | OK |
| 2 | admin-create-user | verifySuperAdmin | Supabase Auth | OK |
| 3 | admin-delete-user | verifySuperAdmin | Supabase Auth | OK |
| 4 | admin-update-user | verifySuperAdmin | Supabase Auth | OK |
| 5 | ai-agent | Token (anon key) | Gemini, Groq, Mistral, UAZAPI | ⚠️ Monolith |
| 6 | ai-agent-debounce | Webhook caller | — | OK |
| 7 | ai-agent-playground | verifySuperAdmin | Gemini | OK |
| 8 | analyze-summaries | verifySuperAdmin | Groq | OK |
| 9 | auto-summarize | verifyCronOrService | Groq | OK |
| 10 | cleanup-old-media | verifyCronOrService | Storage | OK |
| 11 | database-backup | verifySuperAdmin | RPC | OK |
| 12 | fire-outgoing-webhook | verifyAuth | External HTTPS | ⚠️ SSRF |
| 13 | go | Público | — | OK |
| 14 | group-reasons | verifyAuth | Groq | OK |
| 15 | process-follow-ups | verifyCronOrService | UAZAPI | OK |
| 16 | process-scheduled-messages | verifyCronOrService | UAZAPI | OK |
| 17 | scrape-product | verifyAuth | HTTP fetch | OK |
| 18 | scrape-products-batch | verifyAuth | HTTP fetch | OK |
| 19 | send-shift-report | verifyCronOrService + verifyAuth | Groq, UAZAPI | ✅ Fixed |
| 20 | summarize-conversation | verifyAuth | Groq | OK |
| 21 | sync-conversations | verifyAuth | UAZAPI | ⚠️ Full resync |
| 22 | transcribe-audio | verifyAuth/Service | Groq Whisper | OK |
| 23 | uazapi-proxy | verifyAuth + instance | UAZAPI | ⚠️ body.token |
| 24 | whatsapp-webhook | Secret (opcional) | UAZAPI, Edge Functions | ⚠️ Secret opcional |

### Issues Encontrados

| Severidade | Issue | Function | Status |
|---|---|---|---|
| CRITICAL | Cron sem auth | send-shift-report | ✅ Corrigido |
| CRITICAL | Webhook secret opcional | whatsapp-webhook | ⚠️ Pendente |
| CRITICAL | Monolith 1500+ LOC | ai-agent | ⚠️ Backlog |
| HIGH | SSRF incompleto (IPv6) | fire-outgoing-webhook | ⚠️ Pendente |
| HIGH | body.token backward compat | uazapi-proxy | ⚠️ Pendente |
| HIGH | Full resync sem dedup | sync-conversations | ⚠️ Pendente |
| HIGH | Background failures invisíveis | scrape-products-batch | ⚠️ Pendente |

---

## 2. Frontend (44 rotas)

### Rotas
- **Admin-only:** 19 rotas (broadcast, instances, users, settings, etc.)
- **CRM-only:** 4 rotas (crm, leads)
- **All users:** helpdesk
- **Public:** /, /login, /404
- **Auth guards:** Todos OK (AdminRoute, CrmRoute, ProtectedRoute)
- **Error boundaries:** Todos dashboard routes wrapped

### Issues Encontrados

| Severidade | Issue | Arquivo | Status |
|---|---|---|---|
| HIGH | Memory leak setInterval | Instances.tsx:145 | ✅ Corrigido |
| HIGH | Sem paginação (1000+ leads) | Leads.tsx | ⚠️ Pendente |
| MEDIUM | Filtros sem debounce | Leads.tsx:283 | ⚠️ Pendente |
| MEDIUM | Query limits 500 cortam dados | Leads.tsx:85,98 | ⚠️ Pendente |
| MEDIUM | InboxManagement 635 LOC | InboxManagement.tsx | ⚠️ Refatorar |
| LOW | Charts não lazy-loaded | Leads.tsx | ⚠️ Pendente |

### Build
- Chunk strategy OK (10+ vendor chunks)
- Largest chunks: vendor-pdf (593KB), vendor-charts (410KB), vendor-xlsx (332KB)
- All lazy-loaded per route

---

## 3. Banco de Dados (33 tabelas)

### Tabelas
Todas as 33 tabelas têm RLS habilitado (exceto rate_limit_log que não existe no banco).

### Security
- ✅ SECURITY DEFINER functions para RLS recursivo
- ✅ FK cascades em todas as tabelas críticas
- ✅ Storage buckets privados (helpdesk-media, audio-messages)
- ✅ Indexes em todos os FKs + queries frequentes
- ✅ CHECK constraints em conversas, scheduled_messages

### Issues Corrigidos Nesta Auditoria

| Issue | Status |
|---|---|
| CHECK constraints utm_campaigns (status, type) | ✅ Corrigido |
| FK shift_report_configs.instance_id | ✅ Corrigido |
| FK instance_connection_logs.instance_id | ✅ Corrigido |

### Pendentes

| Severidade | Issue |
|---|---|
| HIGH | Cron jobs com URL hardcoded do Supabase |
| MEDIUM | Webhook URLs em plaintext no banco |
| MEDIUM | Cascade delete em conversas ao excluir inbox |

---

## 4. Infraestrutura

### Docker & Deploy
- ✅ Multi-stage Dockerfile (node:20-alpine)
- ✅ Docker Swarm + Traefik v2.11.2 + Let's Encrypt SSL
- ✅ GitHub Actions CI/CD → ghcr.io → Portainer
- ✅ nginx com security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- ✅ Gzip habilitado
- ✅ SPA routing (try_files)

### Pendentes

| Severidade | Issue |
|---|---|
| MEDIUM | Anon key em .env no repositório (baixo risco — é pública) |
| LOW | Sem Sentry/error tracking |

---

## 5. Mapa de Dependências

```
whatsapp-webhook (entrada)
├─→ ai-agent-debounce → ai-agent (8 tools)
├─→ transcribe-audio → ai-agent-debounce
├─→ fire-outgoing-webhook (externo)
└─→ follow_up_executions update

Cron:
├─→ process-scheduled-messages (horário)
├─→ process-follow-ups (horário)
├─→ auto-summarize (3h)
├─→ cleanup-old-media (diário)
└─→ send-shift-report (diário)

Admin:
├─→ ai-agent-playground
├─→ scrape-product / scrape-products-batch
├─→ admin-create/update/delete-user
└─→ database-backup

Público:
└─→ go (UTM redirect)
```

---

## 6. Correções Aplicadas Nesta Auditoria

| # | Fix | Arquivos |
|---|---|---|
| 1 | Auth no send-shift-report (cron path) | send-shift-report/index.ts |
| 2 | CHECK constraints utm_campaigns | Migration SQL |
| 3 | FK shift_report_configs.instance_id | Migration SQL |
| 4 | FK instance_connection_logs.instance_id | Migration SQL |
| 5 | Memory leak Instances.tsx (setInterval) | Instances.tsx |

---

## 7. Backlog de Correções (próximas sprints)

### P1 (Próximo Sprint)
- Webhook secret obrigatório no whatsapp-webhook
- SSRF IPv6 no fire-outgoing-webhook
- Paginação no Leads.tsx
- Debounce nos filtros do Leads.tsx

### P2 (Futuro)
- Refatorar ai-agent (1500+ LOC → 3-4 funções)
- Deprecar body.token no uazapi-proxy
- Dedup no sync-conversations
- Lazy-load charts no Leads.tsx
- Split InboxManagement.tsx
