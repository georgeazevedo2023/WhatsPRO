# WhatsPRO — CRM Multi-Tenant WhatsApp

Plataforma multi-tenant de **atendimento WhatsApp** (helpdesk), **CRM Kanban**, **AI Agent**, **Leads**, **Campanhas**, **Funis** e **Automação**.

**Produção:** [crm.wsmart.com.br](https://crm.wsmart.com.br)

---

## O que é

Junção de WhatsApp Web profissional + CRM de vendas + IA vendedora + sistema de campanhas + construtor de funis — tudo num único navegador. Multi-tenant: múltiplas empresas isoladas com seus próprios números, dados e configurações.

### Funcionalidades principais

- **Helpdesk** real-time com Supabase Realtime, etiquetas, departamentos, bulk actions, busca global, NPS
- **AI Agent (M10)** com 9 tools (search/carousel/media/handoff/labels/tags/kanban/profile/poll), SDR + qualificação + handoff inteligente, validator agent, TTS
- **CRM Kanban** com boards customizáveis, integração de leads via `contact_id` FK
- **Leads** com timeline de jornada, badge de origem, perfil com 25+ campos auto-preenchidos pela IA
- **Campanhas UTM** com landing page, QR code, attribution guards, contexto IA
- **Bio Link** Linktree-style com captação de leads e analytics
- **Forms WhatsApp** via chat com 16 tipos de campo, validações, webhook externo
- **Funis** que orquestram campanhas + bio + forms + kanban (7 tipos)
- **Motor de Automação** sem IA: 7 gatilhos, 4 condições, 6 ações
- **Enquetes nativas WhatsApp** + NPS automático pós-resolve
- **Fluxos v3.0 (M18)** — orquestrador conversacional unificado, 12 templates
- **Dashboard do Gestor (M19)** — fichas individuais, métricas de origem, painel de transbordo, IA conversacional

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL 17, Auth, Storage, Realtime, Edge Functions) |
| WhatsApp API | UAZAPI (proxied via Edge Function) |
| AI Agent (LLM primário) | OpenAI gpt-4.1-mini (function calling) |
| AI Agent (fallback) | Gemini 2.5 Flash → Mistral Small → templates |
| TTS | Gemini 2.5 Flash Preview TTS (6 vozes) |
| Transcrição | Groq (Whisper) |
| Resumos / Carrossel copy | Groq → Gemini → Mistral |
| Data Fetching | TanStack React Query 5 |

---

## Roles de Usuário

| Role | Acesso |
|------|--------|
| `super_admin` | Tudo — instâncias, inboxes, usuários, agente IA, funis, automações, deploy |
| `gerente` | Gerencia equipe nos inboxes atribuídos, CRM, leads, dashboard |
| `user` | Atende conversas nos inboxes atribuídos |

---

## Como rodar localmente

```bash
# 1. Clonar
git clone <repo-url>
cd whatspro

# 2. Instalar
npm install

# 3. Configurar .env (copie de .env.example se existir, peça ao mantenedor)

# 4. Rodar dev
npm run dev

# 5. Build de produção
npm run build

# 6. Verificar tipos / testes
npx tsc --noEmit
npx vitest run
```

### Deploy de Edge Function

```bash
SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <nome> --project-ref euljumeflwtljegknawy
```

---

## Deploy de Produção

- **URL:** crm.wsmart.com.br
- **Infra:** Docker Swarm + Traefik + SSL (Hetzner CX42)
- **CI/CD:** GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer:** Stack `whatspro` na VPS Hetzner

Antes de qualquer deploy, seguir [`wiki/deploy-checklist.md`](wiki/deploy-checklist.md).

---

## Documentação

A base de conhecimento vive no vault Obsidian na raiz do projeto:

- **[`PRD.md`](PRD.md)** — Fonte de verdade: módulos, changelog versionado, roadmap
- **[`CLAUDE.md`](CLAUDE.md)** — Orquestrador da IA (Claude Code) — protocolos, regras
- **[`RULES.md`](RULES.md)** — Regras detalhadas (integridade, entrega, SYNC, CORS, AI Agent)
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — Stack, edge functions, deploy
- **[`PATTERNS.md`](PATTERNS.md)** — Padrões de implementação por área
- **[`AGENTS.md`](AGENTS.md)** — Onboarding rápido em inglês para agentes externos
- **[`index.md`](index.md)** — Master index de todas as wikis

Wikis especializadas em `wiki/` (visão geral, módulos, arquitetura, AI agent, banco de dados, fluxos, casos de uso, decisões-chave, erros e lições, roadmap).

---

## Comandos do Claude Code

- `/prd` — PRD completo
- `/uazapi` — Referência da API UAZAPI

---

## Licença

Software proprietário. Uso restrito a clientes WhatsPRO. Para suporte ou licenciamento, contatar o mantenedor.
