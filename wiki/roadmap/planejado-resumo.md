---
title: Roadmap — Planejado (resumo)
type: roadmap
updated: 2026-05-11
audited_at: 2026-05-11
---

# Roadmap — Itens Planejados (resumo)

> Listas resumidas dos itens planejados. Para detalhe veja:
> - [[wiki/roadmap/novos-modulos-detalhe]] (M10-M22 detalhados)
> - [[wiki/roadmap/melhorias-existentes]] (R18-R30 detalhadas)
> - [[wiki/roadmap]] (milestones top-level, shipped)

### Próximas Funcionalidades (📋 Planejado)

| ID | Feature | Prioridade | Módulo |
|----|---------|-----------|--------|
| ~~R1~~ | ~~Chatbot/autoresponder configurável~~ | ✅ Evoluiu para M10 | Agente IA |
| R2 | Métricas por agente (tempo resposta, satisfação) | Alta | M6 |
| R3 | Webhook signature validation (HMAC) no whatsapp-webhook | Alta | M2 |
| R4 | Rate limiting nas edge functions | Alta | Infra |
| R5 | Deploy automatizado (Vercel/Netlify) | Média | Infra |
| R6 | Notificações push/desktop para novas mensagens | Média | M2 |
| R7 | Integração com CRM externo (HubSpot, Pipedrive) | Média | M4 |
| R8 | Relatórios exportáveis (PDF/Excel) | Média | M6 |
| R9 | Multi-idioma (i18n) | Baixa | Global |
| ~~R10~~ | ~~Tema claro/escuro configurável~~ | ✅ v1.2.0 | Global |
| R11 | Quick reply templates no chat (respostas rápidas) | Alta | M2 |
| R12 | Busca global de conversas (cross-inbox) | Alta | M2 |
| R13 | Ações em massa (atribuir, status, labels) | Alta | M2 |
| R14 | Indicador de conexão realtime (online/offline) | Média | M2 |
| R15 | Histórico de atribuições de agente | Média | M2 |

### Novos Módulos & Melhorias — Estudo ClickFunnels (📋 Planejado)

| ID | Feature | Prioridade | Módulo | Inspiração |
|----|---------|-----------|--------|------------|
| R16 | Funis conversacionais WhatsApp (flow builder visual) | Média | M14 (movido) | CF Funnels + Pages |
| R17 | Catálogo de produtos + pedidos via WhatsApp | Alta | M11 (novo) | CF Products, Orders, Fulfillment |
| R18 | Custom attributes em contatos (campos key-value) | Alta | M2 | CF Contact custom_attributes |
| R19 | Tags em contatos (CRUD completo, não só em conversas) | Alta | M2 | CF Contact Tags |
| R20 | API pública REST com Bearer token auth | Alta | Infra | CF API v2 |
| R21 | Pipeline analytics (forecast, velocity, conversion rate) | Alta | M4 | CF Sales Pipeline |
| R22 | Probabilidade de fechamento por stage do Kanban | Média | M4 | CF Pipeline Stages |
| R23 | Lead scoring automático baseado em interações | Média | M2/M4 | CF Visit tracking + engagement |
| R24 | Formulários via WhatsApp (bot sequencial de perguntas) | Média | M12 (novo) | CF Forms + Submissions |
| R25 | Cursos/membership com entrega via WhatsApp | Média | M13 (novo) | CF Courses + Enrollments |
| R26 | Agendamento de reuniões Calendly-like via WhatsApp | Média | M8 | CF Scheduled Events |
| R27 | GDPR compliance (redact/anonimizar dados de contato) | Média | M2 | CF Contact Redact |
| R28 | Webhooks tipados por evento (contact.created, order.paid, etc.) | Média | Infra | CF Webhook Outgoing Events |
| R29 | Multi-workspace / hierarquia organizacional | Baixa | Infra | CF Team → Workspace |
| R30 | Image management com resize automático e CDN | Baixa | Infra | CF Images API |

### Endpoints UAZAPI Pendentes — Necessários para Novos Módulos (📋 Planejado)

| ID | Feature | Prioridade | Módulo | Endpoint UAZAPI |
|----|---------|-----------|--------|-----------------|
| R31 | Implementar send/quickreply no proxy (botões de resposta rápida, max 3) | Crítica | M10, M12, M13 | `POST /send/quickreply` |
| R32 | Implementar send/list no proxy (lista interativa com seções, max 10) | Crítica | M10, M11, M12 | `POST /send/list` |
| R33 | Implementar send/reaction no proxy (reagir a mensagens com emoji) | Média | M2 | `POST /send/reaction` |
| R34 | Implementar send/template no proxy (templates WhatsApp Business aprovados) | Média | M10 | `POST /send/template` |
| R35 | Implementar group/create + group/add + group/remove no proxy | Média | M13 | `POST /group/create,add,remove` |
| R36 | Processar webhook events: status (entrega/leitura), presence (digitando), group (join/leave) | Média | M2, M13 | Webhook events |

### Auditoria v2.9.0 — 30 Sugestões de Melhoria (📋 Planejado)

#### Segurança (Crítica/Alta)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R38 | Rodar `npm audit fix` — XSS react-router + DoS flatted | Crítica | Infra |
| R39 | Forçar ALLOWED_ORIGIN em produção — cors.ts deve falhar se env var não setada | Crítica | Segurança |
| R40 | Rotacionar JWT tokens expostos nas migrations + mover para env vars | Crítica | Segurança |
| R41 | Rate limiting per-user em transcribe-audio, summarize-conversation, analyze-summaries | Alta | Infra |
| R42 | Timeout 30s em todos os fetch() das Edge Functions | Alta | Infra |
| R43 | Remover service role key da validação do ai-agent — aceitar apenas anon key | Alta | Segurança |

#### Banco de Dados (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R44 | Criar 10 indexes faltando: contacts(phone), conversations(assigned_to, status), etc. | Alta | DB |
| R45 | Adicionar 7 FKs faltando: assigned_to, sender_id, department_members.user_id, etc. | Alta | DB |
| R46 | UNIQUE constraint em lead_database_entries(database_id, phone) | Alta | DB |
| R47 | UNIQUE constraint em message_templates(user_id, name) | Média | DB |
| R48 | CHECK constraints em conversations.status/priority (ENUM ou CHECK) | Média | DB |
| R49 | Trigger update_last_message_at em conversation_messages INSERT | Média | DB |
| R50 | Corrigir race condition ai-agent-debounce — usar upsert com onConflict | Alta | DB |

#### Código & Tipagem (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R51 | Habilitar TypeScript strict mode progressivamente | Alta | Code |
| R52 | Reativar ESLint no-unused-vars com argsIgnorePattern: "^_" | Média | Code |
| R53 | Criar TypeScript types para 11 entidades faltando (Department, KanbanBoard, etc.) | Média | Code |
| R54 | Consolidar phone/JID utils — criar /lib/jidUtils.ts centralizado | Média | Code |
| R55 | Corrigir tipo em broadcastSender.ts — groupjid: number → string | Alta | Bug |
| R56 | Corrigir normalizePhone em saveToHelpdesk.ts — últimos 8→10-11 dígitos | Alta | Bug |

#### UX/UI (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R57 | Unificar navegação "Leads" — consolidar Broadcast/Leads e CRM/Leads | Alta | UX |
| R58 | Adicionar breadcrumbs no header principal | Média | UX |
| R59 | Implementar loading skeletons em tabelas (Leads, Broadcast History) | Média | UX |
| R60 | Empty states com CTAs de ação ("Criar primeiro quadro", etc.) | Média | UX |
| R61 | Validação inline em formulários — erros abaixo dos campos | Média | UX |
| R62 | Flow de "Esqueci minha senha" via Supabase Auth | Alta | UX |
| R63 | Responsividade Helpdesk mobile — tab switching (Lista/Chat/Info) | Alta | UX |
| R64 | Touch targets mínimo 44px em buttons mobile | Média | A11y |

#### Performance & Qualidade (Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R65 | Configurar staleTime global no QueryClient (5min default) | Média | Perf |
| R66 | Refatorar God Components — BackupModule (810L), KanbanBoard (679L), Leads (659L) | Média | Code |
| R67 | Padronizar formato de erro nas Edge Functions — { ok, data?, error? } | Média | API |

---

