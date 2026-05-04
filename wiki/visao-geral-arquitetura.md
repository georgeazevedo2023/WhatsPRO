---
title: Visao Geral — Arquitetura, Stack, Banco e Fluxo de Dados
tags: [visao, arquitetura, stack, banco, edge-functions, supabase, deploy]
sources: [ARCHITECTURE.md, wiki/banco-de-dados.md, wiki/visao-geral-completa.md]
updated: 2026-05-04
---

# WhatsPRO — Arquitetura e Infraestrutura

> Stack tecnica, arquitetura de documentacao, banco de dados (59 tabelas) e fluxo de dados ponta-a-ponta. Sub-wiki de [[wiki/visao-geral-completa]].

---

## 1. Stack Tecnica

```
FRONTEND
├── React 18 + TypeScript + Vite
├── Tailwind CSS + shadcn/ui (componentes)
├── TanStack React Query 5 (data fetching)
├── Recharts (graficos)
├── @dnd-kit (drag & drop Kanban)
└── react-day-picker, qrcode, sonner (utilitarios)

BACKEND
├── Supabase
│   ├── PostgreSQL (banco + RLS + pg_trgm fuzzy search)
│   ├── Auth (JWT + roles)
│   ├── Storage (arquivos, midias, fotos de produto)
│   ├── Realtime (WebSocket para chat ao vivo)
│   └── Edge Functions (31 funcoes Deno)
└── UAZAPI (API WhatsApp — proxied via Edge Functions)

INTELIGENCIA ARTIFICIAL
├── OpenAI gpt-4.1-mini (agente principal — function calling nativo)
├── Gemini 2.5 Flash (fallback LLM + TTS voz + descricao produtos)
├── Mistral Small (fallback LLM + carousel copy)
├── Groq (Whisper transcricao + Llama sumarizacao)
├── Cartesia / Murf / Speechify (fallback TTS)
└── Circuit Breaker (3 falhas → OPEN 30s → fallback automatico)

INFRAESTRUTURA
├── Docker Swarm + Traefik (proxy reverso + SSL Let's Encrypt)
├── Hetzner CX42 (servidor dedicado)
├── Portainer (gerenciamento visual de containers)
├── GitHub Actions (CI/CD — push master → build → ghcr.io)
└── Health Check (DB + MV + env → 200/503)
```

> **Tecnico:** 31 edge functions em Deno runtime. verify_jwt=false para: whatsapp-webhook, fire-outgoing-webhook, go, health-check, form-public, bio-public, ai-agent, ai-agent-debounce, transcribe-audio. CORS: `getDynamicCorsHeaders(req)` obrigatorio para browser-facing. Secret `ALLOWED_ORIGIN=https://crm.wsmart.com.br` obrigatorio. 17 shared modules em `supabase/functions/_shared/`. Rate limit: RPC atomico `check_rate_limit()`. Job queue: `claim_jobs()` FOR UPDATE SKIP LOCKED.

---

## 2. Arquitetura de Documentacao

O projeto usa 4 camadas de documentacao que se complementam:

| Camada | Arquivo | Tamanho | Quando carregar |
|--------|---------|---------|-----------------|
| **Orquestrador** | CLAUDE.md | 109 linhas (4KB) | Automatico — toda sessao |
| **Regras** | RULES.md | 189 linhas (8KB) | Antes de implementar |
| **Referencia** | ARCHITECTURE.md | 100 linhas (5KB) | Quando precisa entender stack |
| **Padroes** | PATTERNS.md | 150 linhas (9KB) | Antes de codificar |

Mais **17 wikis detalhadas** no vault Obsidian com padrao dual (didatico para leigos + blocos tecnicos para devs). Total: **187 sub-funcionalidades** documentadas.

**Fluxo de carregamento:**
```
Sessao inicia → CLAUDE.md (automatico, 4KB)
  → Protocolo: index + roadmap + erros + log + decisoes
  → Tarefa do usuario
    → Implementar? → PATTERNS.md + wiki detalhada
    → Verificar regra? → RULES.md
    → Entender stack? → ARCHITECTURE.md
```

Ver detalhes: [[wiki/arquitetura-docs]]

---

## 3. Banco de Dados — 59 Tabelas

O sistema usa **59 tabelas** no PostgreSQL (Supabase) organizadas em 9 dominios:

| Dominio | Tabelas principais |
|---------|-------------------|
| **Comunicacao (8)** | `instances` (numeros WhatsApp), `contacts`, `conversations` (inbox/status/tags/status_ia), `conversation_messages` (direction/content/media), `conversation_labels`, `labels`, `inboxes`, `message_templates` |
| **Equipe (5)** | `user_profiles`, `user_roles` (super_admin/gerente/user), `inbox_users`, `departments`, `department_members` |
| **Leads & CRM (8)** | `lead_profiles` (25+ campos, FK UNIQUE), `lead_databases` + `_entries`, `kanban_boards`/`_columns`/`_cards`/`_card_data`/`_fields` |
| **Kanban Extras + AI Agent (10)** | `kanban_entities`/`_entity_values`/`_board_members`; `ai_agents` (50+ campos), `ai_agent_products` (pg_trgm), `ai_agent_knowledge`/`_logs`/`_media`, `ai_debounce_queue`, `agent_profiles`, `ai_agent_validations` |

### Campanhas, Funis, Forms, Enquetes, Infra (28 tabelas)
| Dominio | Tabelas |
|---------|---------|
| Campanhas & Funis | `utm_campaigns`, `utm_visits`, `bio_pages`, `bio_buttons`, `bio_lead_captures`, `funnels`, `automation_rules`, `follow_up_executions` |
| Formularios | `whatsapp_forms`, `form_fields`, `form_sessions`, `form_submissions` |
| Enquetes & NPS | `poll_messages`, `poll_responses`, `notifications` |
| Infraestrutura | `user_instance_access`, `instance_connection_logs`, `scheduled_messages`, `scheduled_message_logs`, `broadcast_logs`, `shift_report_configs`/`_logs`, `system_settings`, `rate_limit_log`, `scrape_jobs` |

> Detalhes completos campo a campo: [[wiki/banco-de-dados]]

---

## 4. Fluxo de Dados — Como Tudo se Conecta

```
LEAD CHEGA (Instagram, Google, QR Code, Bio Link)
  │
  ├─ Via Link UTM ──→ go (edge fn) ──→ utm_visits ──→ CampaignRedirect ──→ WhatsApp
  ├─ Via Bio Link ──→ bio-public ──→ bio_lead_captures ──→ WhatsApp
  └─ Via Formulario ─→ form-public ──→ form_submissions + lead_profiles ──→ WhatsApp
  │
  │  (em TODOS os caminhos: contact + lead_profile criados, tags aplicadas)
  ▼
MENSAGEM CHEGA NO WHATSAPP
  │
  ├─ UAZAPI recebe ──→ whatsapp-webhook (edge fn)
  │   ├─ Salva conversation_messages
  │   ├─ Broadcast helpdesk-realtime (WebSocket)
  │   ├─ Match UTM ref_code → vincula campanha
  │   ├─ Detecta FORM:slug → redireciona para form-bot
  │   └─ Se IA ligada → ai-agent-debounce (10s agrupamento)
  │       └─ ai-agent (cerebro IA)
  │           ├─ Carrega contexto: lead + campanha + formulario + funil + perfil
  │           ├─ OpenAI function calling → decide tools
  │           ├─ search_products → catalogo (pg_trgm fuzzy)
  │           ├─ send_carousel → UAZAPI /send/carousel
  │           ├─ set_tags → conversations.tags
  │           ├─ move_kanban → kanban_cards
  │           ├─ handoff → status_ia='shadow' + handoff_message
  │           ├─ send_poll → UAZAPI /send/menu
  │           └─ Validator audita resposta (PASS/REWRITE/BLOCK)
  ▼
HELPDESK (atendente humano)
  │
  ├─ Ve conversa em tempo real (Supabase Realtime)
  ├─ Aplica etiquetas, muda status, atribui agente
  ├─ Envia mensagem → uazapi-proxy → UAZAPI /send/text
  ├─ Notas privadas (direction='private_note')
  └─ Finalizar → TicketResolutionDrawer
      ├─ Categoriza: Venda/Perdido/Suporte/Spam
      ├─ Move card no Kanban
      ├─ Aplica tags resultado
      └─ Agenda NPS (se habilitado)
          └─ triggerNpsIfEnabled → delay → poll NPS
  ▼
METRICAS & ANALYTICS
  ├─ Dashboard KPIs (instancias, leads, funis, NPS)
  ├─ AgentPerformance (ranking, tempo resposta)
  ├─ FunnelConversionChart (visitas→leads→conversoes)
  ├─ PollMetrics + NPS distribuicao
  └─ Intelligence (analise IA de conversas → insights)
```

---

## Links Relacionados

- [[wiki/visao-geral-completa]] — Indice da visao geral
- [[wiki/visao-geral-projeto]] — O que e e diferenciais
- [[wiki/visao-geral-modulos]] — Os 19 modulos
- [[wiki/visao-geral-jornadas-numeros]] — Jornada do lead e numeros
- [[wiki/arquitetura]] — Stack tecnica detalhada
- [[wiki/banco-de-dados]] — Esquema de tabelas completo
- [[wiki/arquitetura-docs]] — Como a documentacao se organiza

---

*Documentado em: 2026-05-04 — Particionado de visao-geral-completa.md (regra 14 max 200 linhas)*
