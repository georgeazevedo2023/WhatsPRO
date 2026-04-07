---
title: Banco de Dados
tags: [supabase, banco-de-dados, rls, migrations]
sources: [CLAUDE.md, supabase/]
updated: 2026-04-07
---

# Banco de Dados

## Provedor

Supabase (PostgreSQL) — Projeto `wspro_v2` (ref: euljumeflwtljegknawy)

## Tabelas Principais

### Multi-tenancy & Auth
- `tenants`, `profiles` (roles: super_admin, gerente, user)
- `user_instance_access` — controle por instância

### WhatsApp
- `instances` — instâncias UAZAPI (token NUNCA no frontend)
- `conversations` — conversas com labels, status_ia, archived
- `conversation_messages` — mensagens com mídia
- `inboxes`, `inbox_members` — departamentos

### AI Agent
- `ai_agents` — config por instância (prompt_sections, business_info, tools)
- `ai_agent_knowledge` — FAQ/Q&A knowledge base
- `ai_agent_validations` — log do validator (score, PASS/REWRITE/BLOCK)
- `ai_products` — catálogo com busca fuzzy

### CRM & Leads
- `kanban_boards`, `kanban_columns`, `kanban_cards` — CRM com contact_id FK
- `lead_profiles` — dados do lead (full_name, city, interests, etc.)
- `contacts` — contatos WhatsApp

### Campanhas & Bio Link
- `utm_campaigns` — campanhas com landing_mode, kanban_board_id
- `utm_visits` — visitas com metadata JSONB
- `whatsapp_forms`, `form_fields`, `form_sessions`, `form_submissions` — formulários
- `bio_pages` — páginas Bio Link (Linktree-style)
- `bio_buttons` — botões das páginas (url, whatsapp, form, social, catalog)
- `bio_lead_captures` — capturas de leads com contact_id FK (M15)

### Infra
- `job_queue` — SKIP LOCKED job processor
- `admin_audit_log` — log imutável de ações admin
- `mv_user_inbox_roles` — materialized view (refresh periódico)

## Padrões

- RLS em todas as tabelas
- `has_inbox_access_fast()` — verifica acesso via materialized view
- `check_rate_limit()` — rate limit atômico via RPC
- `search_products_fuzzy()` — busca pg_trgm
- `increment_lead_msg_count` — contador atômico
- Types: `npx supabase gen types` — NUNCA editar manual

## Migrations

39 migrations commitadas. Localização: `supabase/migrations/`. Total: 48 tabelas.

## Links

- [[wiki/ai-agent]] — Tabelas do agente
- [[wiki/arquitetura]] — Stack completa
