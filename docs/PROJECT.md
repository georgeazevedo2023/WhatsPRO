# PROJECT.md - WhatsPRO

## Visao Geral
WhatsPRO e uma plataforma de automacao empresarial para WhatsApp. Combina helpdesk multi-agente, CRM com kanban, broadcasting em massa, e agentes de IA autonomos para atendimento ao cliente.

## Stack Tecnica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 |
| UI | Radix UI + shadcn/ui + Tailwind CSS 3.4 |
| State | TanStack React Query 5.83 + React Hook Form + Zod |
| Routing | React Router v6 (lazy loading) |
| Backend | Supabase (PostgreSQL + Edge Functions em Deno) |
| Auth | Supabase Auth (JWT) + RBAC (super_admin/gerente/user) |
| WhatsApp | UAZAPI (API REST) |
| IA | OpenAI GPT-4.1 (agente) + Google Gemini 2.5 (TTS/transcricao/sumarizacao) |
| Fallbacks LLM | Groq, Mistral (geracao de copy para carroseis) |
| Testes | Vitest + Testing Library + E2E edge functions |

## Arquitetura

```
Browser (React SPA)
    |
    v
Supabase Client (RLS enforced)
    |
    +---> PostgreSQL (102 migrations, 30+ tabelas, RLS em todas)
    |
    +---> 27 Edge Functions (Deno)
    |       |
    |       +---> ai-agent (processamento IA principal)
    |       +---> ai-agent-debounce (batching de msgs)
    |       +---> whatsapp-webhook (recebe msgs do UAZAPI)
    |       +---> process-follow-ups (cron: follow-up automatico)
    |       +---> process-scheduled-messages (cron: agendamentos)
    |       +---> transcribe-audio (Gemini TTS)
    |       +---> scrape-product/scrape-products-batch (catalogo)
    |       +---> admin-create/delete/update-user
    |       +---> ... (14 outras funcoes)
    |
    +---> UAZAPI (WhatsApp API)
    +---> OpenAI API (agente IA)
    +---> Google Gemini API (TTS, transcricao, sumarizacao)
```

## Estrutura do Projeto

```
src/
  components/
    admin/           # Config AI Agent (15+ paineis)
    broadcast/       # Broadcasting em massa
    campaigns/       # Campanhas
    helpdesk/        # Ticketing/atendimento
    kanban/          # CRM pipeline
    leads/           # Base de leads
    intelligence/    # Analytics
    ui/              # shadcn base components
  contexts/          # AuthContext (auth + roles)
  hooks/             # 25+ hooks customizados
  lib/               # Utilitarios (UAZAPI client, broadcast sender)
  integrations/      # Supabase client + types
  pages/dashboard/   # Paginas (lazy-loaded)

supabase/
  functions/         # 27 edge functions
  migrations/        # 102 migrations SQL
```

## Modulos Principais

1. **Helpdesk** - Atendimento real-time com filas, labels, status, notas internas
2. **Agente IA** - Atendimento autonomo com greeting, handoff, catalogo, voz, follow-up
3. **CRM Kanban** - Pipeline com drag-drop, campos customizados, boards compartilhados
4. **Broadcaster** - Envio em massa com delay, carrossel, agendamento, templates
5. **Leads** - Import CSV/Excel, enriquecimento, scoring, perfil completo
6. **Campanhas** - Criacao, UTM tracking, metricas de performance
7. **Intelligence** - Dashboards analiticos, metricas de agente, volume de msgs
8. **Admin** - Gestao de usuarios, departamentos, inboxes, secrets, backup

## Seguranca

- RLS em TODAS as tabelas (343 policies)
- RBAC: super_admin > gerente > user
- JWT auth com refresh automatico
- Webhook secret validation
- Advisory locks para operacoes atomicas (greeting dedup)
- Vault para API keys
- Audit log para acoes admin
