---
title: Infraestrutura
type: infraestrutura
updated: 2026-05-11
audited_at: 2026-05-11
---

# Infraestrutura

> Snapshot da stack: banco, edge functions, storage, UAZAPI, segurança.


### Banco de Dados (38+ tabelas, 54 migrations)
- **RLS**: Habilitado em todas as tabelas (70+ policies — auditado v2.9.0 ✅)
- **FKs**: Todas com CASCADE ou SET NULL (corrigido v1.1.0). ⚠️ 7 FKs faltando identificadas em v2.9.0: conversations.assigned_to, conversation_messages.sender_id, department_members.user_id, kanban_board_members.user_id, kanban_cards.assigned_to → user_profiles
- **Indexes**: conversations (inbox_id, status, priority, assigned_to, department_id, last_message_at), conversation_messages (conv+created, conv+direction), contacts (jid UNIQUE, phone), instances (user_id, disabled), kanban_cards (board_id, column_id, assigned_to, created_by). ⚠️ 10 indexes adicionais recomendados em v2.9.0: contacts(phone), conversations(assigned_to, status), inbox_users(user_id), departments(inbox_id), lead_database_entries(phone)
- **UNIQUE faltando**: lead_database_entries(database_id, phone), message_templates(user_id, name)
- **CHECK faltando**: conversations.status/priority (ENUM recomendado), kanban_columns.position >= 0
- **Vault**: API keys armazenadas em `supabase_vault` (anon key para triggers)
- **RPC Functions**: `delete_inbox`, `get_kanban_board_counts`, `backup_query`, `is_super_admin`, `has_inbox_access`, `get_inbox_role`, `can_access_kanban_board`, `is_gerente`, `is_inbox_member`, `normalize_external_id`
- **Triggers**: 12+ triggers (updated_at automáticos, auto_summarize_on_resolve, log_instance_status_change, ensure_single_default_department)
- **Cron Jobs**: process-scheduled-messages (hourly), auto-summarize-inactive (3h) — ⚠️ JWT hardcoded nas migrations

### Edge Functions (22)
Todas com autenticação (JWT manual, cron/service, ou super_admin):
| Function | Auth | Propósito |
|----------|------|-----------|
| uazapi-proxy | JWT + instance access | Proxy para UAZAPI (17 actions, 50+ endpoints documentados) |
| whatsapp-webhook | Webhook (externo) | Receber mensagens |
| admin-create-user | super_admin | Criar usuário |
| admin-update-user | super_admin | Atualizar usuário |
| admin-delete-user | super_admin | Excluir usuário |
| activate-ia | JWT + instance access | Ativar IA na conversa |
| analyze-summaries | super_admin | Analisar motivos |
| auto-summarize | cron/service + JWT | Auto-resumir conversas |
| cleanup-old-media | cron/super_admin | Limpar mídia antiga |
| database-backup | super_admin | Backup do banco |
| fire-outgoing-webhook | JWT | Disparar webhook saída |
| group-reasons | JWT | Agrupar motivos com IA |
| process-scheduled-messages | cron/super_admin | Processar agendamentos |
| send-shift-report | cron/super_admin | Enviar relatório turno |
| summarize-conversation | JWT + inbox access | Resumir conversa |
| sync-conversations | JWT + inbox access | Sincronizar conversas |
| transcribe-audio | JWT | Transcrever áudio |
| ai-agent | Webhook (interno) | Cérebro IA (Gemini + function calling) |
| ai-agent-debounce | Webhook (interno) | Agrupa msgs 10s + typing indicator |
| ai-agent-playground | super_admin | Chat simulado para testar agente IA |
| scrape-product | JWT (user) | Importação rápida: scrape URL → dados do produto |

### Storage (3 buckets)
- `audio-messages` - Gravações de áudio
- `helpdesk-media` - Mídia do helpdesk
- `carousel-images` - Imagens de carrossel

### UAZAPI API (WhatsApp)
- **Servidor**: `https://wsmart.uazapi.com` (v2.0, baseada em Go)
- **Autenticação**: Header `token` (por instância) + `admintoken` (admin global)
- **Proxy Actions Implementadas (17)**: connect, status, list, groups, group-info, send-message, send-media, send-carousel, send-audio, send-chat, check-numbers, resolve-lids, download-media, create-instance, delete-instance, disconnect
- **Proxy Actions Planejadas (15)**: send-quickreply, send-list, send-reaction, send-location, send-contact, send-template, delete-message, group-create, group-add, group-remove, set-webhook, profile-update, contact-info, chat-list, message-list
- **Webhook Events Processados**: messages, status_ia
- **Webhook Events Não Processados**: status (entrega/leitura), connection, group, call, presence
- **Documentação completa**: Skill `/uazapi` (`.claude/commands/uazapi.md` — 1042 linhas)

### Segurança
- JWT verification manual em todas as edge functions
- CORS configurável via `ALLOWED_ORIGIN` env var — ⚠️ Default `*` se não setada (v2.9.0: deve falhar hard em produção)
- Instance tokens resolvidos server-side (nunca no frontend)
- Limites: 500 phones, 50 groups, 10 carousel cards, 12MB áudio, 10MB CSV, 50k linhas
- CSV sanitization contra injection (=, +, -, @)
- SSRF protection no fire-outgoing-webhook (bloqueia IPs privados, loopback, cloud metadata)
- Vault para armazenar keys de triggers
- ⚠️ **Pendente (v2.9.0 audit)**: Rate limiting em endpoints caros, fetch timeouts, webhook signature validation, audit logging em admin functions, rotação de JWT tokens expostos em migrations

---

