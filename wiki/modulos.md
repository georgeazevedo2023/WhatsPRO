---
title: Módulos
tags: [modulos, features, helpdesk, crm, leads, broadcast]
sources: [CLAUDE.md, PRD.md, docs/CONTEXTO_PROJETO.md]
updated: 2026-04-07
---

# Módulos

## M1 — WhatsApp (Instâncias & Grupos) ✅
- Multi-instância, QR code, sincronização UAZAPI
- Controle de acesso por instância
- Envio de mensagens/mídia para grupos

## M2 — Helpdesk ✅
- Chat real-time com Supabase Realtime
- Labels, assignments, departamentos
- Bulk actions (ler, resolver, arquivar)
- Quick reply templates ("/" prefix)
- Typing indicator, date dividers
- Paginação: últimas 50 msgs + "Load older"

## M3 — Broadcast ✅
- Texto, mídia, carrossel para grupos e leads
- Agendamento de mensagens

## M4 — Leads (M11) ✅
- Lead cards, timeline, conversation modal
- Block IA, clear context, quick IA toggle
- CSV import, lead auto-creation from forms
- contact_id FK para kanban

## M5 — CRM Kanban ✅
- Boards customizáveis com campos custom
- Integração com leads (contact_id FK)
- TicketResolutionDrawer (4 categorias, move card, tags)

## M6 — Catálogo ✅
- Quick Product Import (URL → scrape → auto-fill)
- Busca fuzzy (pg_trgm, word-level similarity)
- Search pipeline: ILIKE → word-by-word → fuzzy → post-filter AND

## M7 — Campanhas UTM ✅
- Links, QR codes, métricas, AI contextual
- Landing page com countdown + captura client-side
- Clone, starts_at, attribution guards
- landing_mode: 'redirect' ou 'form'

## M8 — Relatórios ✅
- Dashboard de inteligência/analytics
- Agent performance (ranking, resolution rate, response time)

## M9 — Agendamentos ✅
- Mensagens agendadas/recorrentes
- Templates de mensagem

## M10 — AI Agent ✅
- Ver [[wiki/ai-agent]] para detalhes completos

## M11 — Leads Database ✅
- Ver M4 acima

## M12 — WhatsApp Forms ✅
- Trigger via FORM:<slug>
- Validações: CPF, email, CEP, scale, select, yes_no, signature
- Max 3 retries por campo
- Webhook externo POST ao completar
- 12 templates built-in

## M13 — Campanhas + Formulários + Funil Conversacional ✅

- Landing page rica com countdown + captura client-side
- landing_mode: 'redirect' (countdown→wa.me) ou 'form' (formulário na landing)
- Form na landing page com validações (CPF checksum, email, phone, CEP)
- Auto-criação de lead no submit (FIELD_MAP → lead_profiles)
- Auto-tag de conversa: `formulario:SLUG` + `origem:formulario`
- AI Agent form context: detecta tag `formulario:SLUG`, injeta dados no prompt
- LeadFormsSection: componente no LeadDetail com formulários respondidos
- form-public edge function: GET (sem JWT) + POST → contact + lead_profile + form_submission + kanban card
- Attribution guards: webhook checa status='active' + expires_at antes de tagar

## M15 — Integração de Funis (Bio + Campanhas + Forms) ✅

- Bio Link cria leads reais (contact + lead_profile com origin='bio')
- Tags unificadas: `origem:bio`, `bio_page:SLUG` em todos os sistemas
- AI Agent recebe `<bio_context>` quando lead vem do Bio Link
- leadHelper.ts compartilhado (elimina FIELD_MAP duplicado)
- Badge de origem colorido no LeadDetail (Bio/Campanha/Formulário)
- Timeline de jornada do lead (bio → form → conversa → kanban)
- Forms mostra "Usado em" (quais campanhas/bios usam cada form)
- Campaign Detail mostra leads convertidos

## Links

- [[wiki/ai-agent]] — Agente IA em profundidade
- [[wiki/roadmap]] — Status e próximos módulos
